/**
 * @fileoverview Manages mini-guide overlay state, row building, and channel switching.
 * @module modules/ui/mini-guide/MiniGuideCoordinator
 * @version 1.0.0
 */

import type { IChannelManager, ChannelConfig, ResolvedChannelContent } from '../../scheduler/channel-manager';
import type { IChannelScheduler, ScheduledProgram, ScheduleConfig } from '../../scheduler/scheduler';
import { ScheduleCalculator, ShuffleGenerator } from '../../scheduler/scheduler';
import type { IMiniGuideOverlay } from './interfaces';
import type { MiniGuideChannelViewModel, MiniGuideViewModel } from './types';
import { getChannelNameForDisplay } from '../channelDisplay';

const ROW_COUNT = 5;
const CENTER_INDEX = 2;
const PAGE_JUMP = 5;

interface MiniGuideCoordinatorDeps {
    getOverlay: () => IMiniGuideOverlay | null;
    getChannelManager: () => IChannelManager | null;
    getScheduler: () => IChannelScheduler | null;

    buildDailyScheduleConfig: (
        channel: ChannelConfig,
        items: ResolvedChannelContent['items'],
        referenceTimeMs: number
    ) => ScheduleConfig;

    switchToChannel: (channelId: string) => Promise<void>;
    getAutoHideMs: () => number;
}

export class MiniGuideCoordinator {
    private _autoHideTimer: number | null = null;
    private _focusedIndex = CENTER_INDEX;
    private _allChannels: ChannelConfig[] = [];
    private _windowStartIndex = 0;
    private _channels: ChannelConfig[] = [];
    private _viewModel: MiniGuideViewModel | null = null;
    private _showToken = 0;
    private _playingChannelId: string | null = null;
    private _channelResolves = new Map<string, AbortController>();
    private _windowChannelIndices = new Map<string, number[]>();
    private readonly _shuffler = new ShuffleGenerator();

    constructor(private readonly deps: MiniGuideCoordinatorDeps) { }

    show(): void {
        const overlay = this.deps.getOverlay();
        const channelManager = this.deps.getChannelManager();
        if (!overlay || !channelManager) {
            return;
        }
        const allChannels = channelManager.getAllChannels();
        if (allChannels.length === 0) {
            return;
        }

        const current = channelManager.getCurrentChannel() ?? allChannels[0]!;
        const currentIndex = Math.max(0, allChannels.findIndex((channel) => channel.id === current.id));
        this._allChannels = allChannels;
        this._playingChannelId = current?.id ?? null;
        this._windowStartIndex = wrapIndex(currentIndex - CENTER_INDEX, allChannels.length);
        this._channels = this._buildWindowChannels(this._windowStartIndex);
        this._focusedIndex = CENTER_INDEX;

        this._abortAllResolves();
        const token = this._showToken;
        const fastViewModel = this._buildFastViewModel(current);
        this._viewModel = fastViewModel;

        overlay.setViewModel(fastViewModel);
        overlay.setFocusedIndex(this._focusedIndex);
        overlay.show();

        this._startResolveForWindow(current, token);
    }

    hide(): void {
        this._abortAllResolves();
        this._clearAutoHideTimer();
        this._viewModel = null;
        this.deps.getOverlay()?.hide();
    }

    handleNavigation(direction: 'up' | 'down'): boolean {
        const overlay = this.deps.getOverlay();
        if (!overlay || !overlay.isVisible()) {
            return false;
        }
        if (direction === 'up') {
            if (this._focusedIndex > 0) {
                this._focusedIndex -= 1;
                overlay.setFocusedIndex(this._focusedIndex);
            } else {
                this._windowStartIndex = wrapIndex(this._windowStartIndex - 1, this._allChannels.length);
                this._refreshWindow();
            }
        } else {
            if (this._focusedIndex < ROW_COUNT - 1) {
                this._focusedIndex += 1;
                overlay.setFocusedIndex(this._focusedIndex);
            } else {
                this._windowStartIndex = wrapIndex(this._windowStartIndex + 1, this._allChannels.length);
                this._refreshWindow();
            }
        }
        this._scheduleAutoHide();
        return true;
    }

    handlePage(direction: 'up' | 'down'): boolean {
        const overlay = this.deps.getOverlay();
        if (!overlay || !overlay.isVisible()) {
            return false;
        }
        const delta = direction === 'up' ? -PAGE_JUMP : PAGE_JUMP;
        this._windowStartIndex = wrapIndex(this._windowStartIndex + delta, this._allChannels.length);
        this._refreshWindow();
        this._scheduleAutoHide();
        return true;
    }

    handleSelect(): void {
        const selected = this._channels[this._focusedIndex];
        if (!selected) {
            return;
        }
        this.hide();
        this.deps.switchToChannel(selected.id).catch((error) => {
            console.warn('[MiniGuideCoordinator] Failed to switch channel:', error);
        });
    }

    private _refreshWindow(): void {
        if (this._allChannels.length === 0) {
            return;
        }
        const overlay = this.deps.getOverlay();
        if (!overlay || !overlay.isVisible()) {
            return;
        }
        const current = this._allChannels.find((channel) => channel.id === this._playingChannelId) ?? null;
        this._channels = this._buildWindowChannels(this._windowStartIndex);

        const token = this._showToken;
        const fastViewModel = this._buildFastViewModel(current);
        this._viewModel = fastViewModel;
        overlay.setViewModel(fastViewModel);
        overlay.setFocusedIndex(this._focusedIndex);

        this._startResolveForWindow(current, token);
    }

    private _buildWindowChannels(startIndex: number): ChannelConfig[] {
        const channels: ChannelConfig[] = [];
        const length = this._allChannels.length;
        for (let i = 0; i < ROW_COUNT; i += 1) {
            const index = wrapIndex(startIndex + i, length);
            channels.push(this._allChannels[index]!);
        }
        return channels;
    }

    private _startResolveForWindow(
        current: ChannelConfig | null,
        token: number
    ): void {
        const pendingResolves = new Map<string, ChannelConfig>();
        this._windowChannelIndices.clear();
        for (let i = 0; i < ROW_COUNT; i += 1) {
            const channel = this._channels[i]!;
            const indices = this._windowChannelIndices.get(channel.id) ?? [];
            indices.push(i);
            this._windowChannelIndices.set(channel.id, indices);
            if (current && channel.id === current.id) {
                continue;
            }
            if (!pendingResolves.has(channel.id)) {
                pendingResolves.set(channel.id, channel);
            }
        }

        const keepIds = new Set(pendingResolves.keys());
        this._pruneResolves(keepIds);

        for (const [channelId, channel] of pendingResolves) {
            const existing = this._channelResolves.get(channelId);
            if (existing && !existing.signal.aborted) {
                continue;
            }
            if (existing) {
                this._channelResolves.delete(channelId);
            }
            const controller = new AbortController();
            this._channelResolves.set(channelId, controller);
            void this._resolveChannel(channel, controller, token);
        }
    }

    private _buildFastViewModel(current: ChannelConfig | null): MiniGuideViewModel {
        const rows: MiniGuideChannelViewModel[] = [];
        for (let i = 0; i < ROW_COUNT; i += 1) {
            const channel = this._channels[i]!;
            if (current && channel.id === current.id) {
                rows.push(this._buildCurrentRow(channel, current));
                continue;
            }
            const cached = this._getCachedRow(channel.id);
            if (cached && cached.status === 'ready') {
                rows.push(cached);
                continue;
            }
            rows.push(this._buildLoadingRow(channel));
        }
        return { channels: rows };
    }

    private _getCachedRow(channelId: string): MiniGuideChannelViewModel | null {
        if (!this._viewModel) return null;
        return this._viewModel.channels.find((row) => row.channelId === channelId) ?? null;
    }

    private _buildCurrentRow(channel: ChannelConfig, current: ChannelConfig): MiniGuideChannelViewModel {
        if (channel.id !== current.id) {
            return this._buildLoadingRow(channel);
        }
        const scheduler = this.deps.getScheduler();
        if (!scheduler) {
            return this._buildUnavailableRow(channel);
        }
        try {
            const state = scheduler.getState();
            if (!state.isActive || state.channelId !== current.id) {
                return this._buildUnavailableRow(channel);
            }
            const now = scheduler.getCurrentProgram();
            const next = scheduler.getNextProgram();
            return this._buildRowFromPrograms(channel, now, next);
        } catch {
            return this._buildUnavailableRow(channel);
        }
    }

    private _buildLoadingRow(channel: ChannelConfig): MiniGuideChannelViewModel {
        const displayName = getChannelNameForDisplay({
            name: channel.name,
            sourceLibraryName: channel.sourceLibraryName ?? null,
        });
        return {
            channelId: channel.id,
            channelNumber: channel.number,
            channelName: displayName,
            buildStrategy: channel.buildStrategy ?? null,
            status: 'loading',
            nowTitle: 'Loading...',
            nowStartTime: null,
            nextTitle: null,
            nowProgress: 0,
        };
    }

    private _buildUnavailableRow(channel: ChannelConfig): MiniGuideChannelViewModel {
        const displayName = getChannelNameForDisplay({
            name: channel.name,
            sourceLibraryName: channel.sourceLibraryName ?? null,
        });
        return {
            channelId: channel.id,
            channelNumber: channel.number,
            channelName: displayName,
            buildStrategy: channel.buildStrategy ?? null,
            status: 'unavailable',
            nowTitle: 'Unavailable',
            nowStartTime: null,
            nextTitle: null,
            nowProgress: 0,
        };
    }

    private async _resolveChannel(
        channel: ChannelConfig,
        controller: AbortController,
        token: number
    ): Promise<void> {
        const channelManager = this.deps.getChannelManager();
        if (!channelManager) {
            return;
        }
        try {
            const resolved = await channelManager.resolveChannelContent(channel.id, {
                signal: controller.signal,
            });
            if (controller.signal.aborted || token !== this._showToken) {
                return;
            }
            const active = this._channelResolves.get(channel.id);
            if (!active || active !== controller) {
                return;
            }
            const row = this._buildResolvedRow(channel, resolved, Date.now());
            const indices = this._windowChannelIndices.get(channel.id);
            if (indices) {
                for (const index of indices) {
                    this._updateRow(index, row, token);
                }
            }
        } catch {
            if (controller.signal.aborted || token !== this._showToken) {
                return;
            }
            const active = this._channelResolves.get(channel.id);
            if (!active || active !== controller) {
                return;
            }
            const row = this._buildUnavailableRow(channel);
            const indices = this._windowChannelIndices.get(channel.id);
            if (indices) {
                for (const index of indices) {
                    this._updateRow(index, row, token);
                }
            }
        } finally {
            const active = this._channelResolves.get(channel.id);
            if (active && active === controller) {
                this._channelResolves.delete(channel.id);
            }
        }
    }

    private _buildResolvedRow(
        channel: ChannelConfig,
        resolved: ResolvedChannelContent,
        nowMs: number
    ): MiniGuideChannelViewModel {
        try {
            const cfg = this.deps.buildDailyScheduleConfig(channel, resolved.items, nowMs);
            const index = ScheduleCalculator.buildScheduleIndex(cfg, this._shuffler);
            const now = ScheduleCalculator.calculateProgramAtTime(nowMs, index, cfg.anchorTime);
            const next = ScheduleCalculator.calculateNextProgram(now, index, cfg.anchorTime);
            return this._buildRowFromPrograms(channel, now, next);
        } catch {
            return this._buildUnavailableRow(channel);
        }
    }

    private _buildRowFromPrograms(
        channel: ChannelConfig,
        now: ScheduledProgram | null,
        next: ScheduledProgram | null
    ): MiniGuideChannelViewModel {
        const nowTitle = this._formatMiniGuideTitle(now) ?? 'Unavailable';
        const nextTitle = this._formatMiniGuideTitle(next);
        const nowStartTime = now?.scheduledStartTime
            ? new Date(now.scheduledStartTime).toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            })
            : null;
        const displayName = getChannelNameForDisplay({
            name: channel.name,
            sourceLibraryName: channel.sourceLibraryName ?? null,
        });

        const durationMs = getDurationMs(now);
        const elapsedMs = Math.max(0, Math.min(durationMs, now?.elapsedMs ?? 0));
        const nowProgress = durationMs > 0 ? clamp01(elapsedMs / durationMs) : 0;

        return {
            channelId: channel.id,
            channelNumber: channel.number,
            channelName: displayName,
            buildStrategy: channel.buildStrategy ?? null,
            status: 'ready',
            nowTitle,
            nowStartTime,
            nextTitle,
            nowProgress,
        };
    }

    private _formatMiniGuideTitle(program: ScheduledProgram | null): string | null {
        if (!program) return null;
        const item = program.item;
        if (item.type !== 'episode') {
            return item.title ?? null;
        }

        const showTitle = item.showTitle ?? '';
        const episodeTitle = item.title ?? '';
        const hasSeason = typeof item.seasonNumber === 'number' && item.seasonNumber > 0;
        const hasEpisode = typeof item.episodeNumber === 'number' && item.episodeNumber > 0;
        const hasSeasonEpisode = hasSeason && hasEpisode;
        const seasonText = hasSeasonEpisode
            ? `S${String(item.seasonNumber).padStart(2, '0')}E${String(item.episodeNumber).padStart(2, '0')}`
            : null;

        if (showTitle && episodeTitle) {
            if (hasSeasonEpisode && seasonText) {
                return `${showTitle} • ${seasonText} • ${episodeTitle}`;
            }
            if (showTitle !== episodeTitle) {
                return `${showTitle} • ${episodeTitle}`;
            }
        }

        if (item.fullTitle) {
            return item.fullTitle;
        }

        return episodeTitle || showTitle || null;
    }

    private _updateRow(index: number, row: MiniGuideChannelViewModel, token: number): void {
        if (token !== this._showToken || !this._viewModel) {
            return;
        }
        const currentRow = this._viewModel.channels[index];
        if (!currentRow || currentRow.channelId !== row.channelId) {
            return;
        }
        const overlay = this.deps.getOverlay();
        if (!overlay || !overlay.isVisible()) {
            return;
        }
        const channels = this._viewModel.channels.slice();
        channels[index] = row;
        const nextViewModel = { channels };
        this._viewModel = nextViewModel;
        overlay.setViewModel(nextViewModel);
    }

    private _scheduleAutoHide(): void {
        this._clearAutoHideTimer();
        const autoHideMs = this.deps.getAutoHideMs();
        if (!Number.isFinite(autoHideMs) || autoHideMs <= 0) {
            return;
        }
        this._autoHideTimer = globalThis.setTimeout(() => {
            this._autoHideTimer = null;
            this.hide();
        }, autoHideMs) as unknown as number;
    }

    private _clearAutoHideTimer(): void {
        if (this._autoHideTimer !== null) {
            globalThis.clearTimeout(this._autoHideTimer);
            this._autoHideTimer = null;
        }
    }

    private _abortAllResolves(): void {
        for (const controller of this._channelResolves.values()) {
            controller.abort();
        }
        this._channelResolves.clear();
        this._showToken += 1;
    }

    private _pruneResolves(keepIds: Set<string>): void {
        for (const [channelId, controller] of this._channelResolves) {
            if (!keepIds.has(channelId)) {
                controller.abort();
                this._channelResolves.delete(channelId);
            }
        }
    }
}

function wrapIndex(index: number, length: number): number {
    if (length <= 0) return 0;
    return ((index % length) + length) % length;
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

function getDurationMs(program: ScheduledProgram | null): number {
    if (!program) return 0;
    const itemDuration = program.item?.durationMs ?? 0;
    if (Number.isFinite(itemDuration) && itemDuration > 0) {
        return itemDuration;
    }
    const fallback = program.scheduledEndTime - program.scheduledStartTime;
    if (Number.isFinite(fallback) && fallback > 0) {
        return fallback;
    }
    return 0;
}
