/**
 * @fileoverview Coordinates EPG state, schedule loading, and overlay lifecycle.
 * @module modules/ui/epg/EPGCoordinator
 * @version 1.0.0
 */

import { ShuffleGenerator, ScheduleCalculator } from '../../scheduler/scheduler';
import { appendEpgDebugLog } from './utils';
import type { IEPGComponent } from './interfaces';
import type { EPGConfig } from './types';
import type { IChannelManager, ChannelConfig, ResolvedChannelContent } from '../../scheduler/channel-manager';
import type { IChannelScheduler, ScheduledProgram, ScheduleConfig, ScheduleWindow } from '../../scheduler/scheduler';
import { readStoredBoolean, safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from '../../../utils/storage';
import { RETUNE_STORAGE_KEYS } from '../../../config/storageKeys';
import { isAbortLikeError, summarizeErrorForLog } from '../../../utils/errors';

export type EpgUiStatus = 'pending' | 'initializing' | 'ready' | 'error' | 'disabled' | undefined;

export interface EPGCoordinatorDeps {
    getEpg: () => IEPGComponent | null;
    getChannelManager: () => IChannelManager | null;
    getScheduler: () => IChannelScheduler | null;

    getEpgUiStatus: () => EpgUiStatus;
    ensureEpgInitialized: () => Promise<void>;

    getEpgConfig: () => EPGConfig | null;
    getLocalMidnightMs: (timeMs: number) => number;

    buildDailyScheduleConfig: (
        channel: ChannelConfig,
        items: ResolvedChannelContent['items'],
        referenceTimeMs: number
    ) => ScheduleConfig;

    getPreserveFocusOnOpen: () => boolean;

    setLastChannelChangeSourceToGuide: () => void;
    switchToChannel: (channelId: string) => Promise<void>;
}

const EPG_SCHEDULE_CACHE_TTL_MS = 2 * 60_000;
const EPG_SCHEDULE_CACHE_STALE_TTL_MS = 10 * 60_000;
const EPG_SCHEDULE_CACHE_MIN_ENTRIES = 60;
const EPG_SCHEDULE_CACHE_MAX_ENTRIES = 240;
const DEFAULT_GUIDE_DENSITY: 'detailed' | 'wide' = 'detailed';
const DETAILED_VISIBLE_HOURS = 2;
const WIDE_VISIBLE_HOURS = 3;

export class EPGCoordinator {
    private _epgScheduleLoadToken = 0;
    private _epgScheduleInFlight = new Map<string, { controller: AbortController; rangeKey: string }>();
    private _epgScheduleRangeKeyByChannel = new Map<string, { rangeKey: string; loadedAt: number }>();
    private _epgScheduleCache = new Map<string, { rangeKey: string; schedule: ScheduleWindow; loadedAt: number }>();
    private _epgScheduleCacheMaxEntries = EPG_SCHEDULE_CACHE_MIN_ENTRIES;
    private _visibleRangeTimer: ReturnType<typeof setTimeout> | null = null;
    private _pendingVisibleRange: {
        channelStart: number;
        channelEnd: number;
        timeStartMs: number;
        timeEndMs: number;
    } | null = null;
    private _pendingVisibleRangeReason: string | null = null;
    private _pendingVisibleRangePromise: Promise<void> | null = null;
    private _pendingVisibleRangeResolve: (() => void) | null = null;
    private _pendingVisibleRangeReject: ((error: unknown) => void) | null = null;

    constructor(private readonly deps: EPGCoordinatorDeps) { }

    /**
     * Clear schedule caches and "loaded range" markers.
     * Use this when the UI schedules are cleared (e.g. after library filter changes)
     * to avoid cache/UI mismatches where the coordinator believes data is loaded.
     */
    clearScheduleCaches(): void {
        this._clearScheduleCaches();
    }

    private _isLibraryTabsEnabled(): boolean {
        return readStoredBoolean(RETUNE_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, true);
    }

    private _readSelectedLibraryId(): string | null {
        const raw = safeLocalStorageGet(RETUNE_STORAGE_KEYS.EPG_LIBRARY_FILTER);
        if (!raw) return null;
        const trimmed = raw.trim();
        return trimmed ? trimmed : null;
    }

    private _buildLibraries(channels: ChannelConfig[]): Array<{ id: string; name: string }> {
        const map = new Map<string, string>();
        for (const c of channels) {
            if (c.sourceLibraryId && c.sourceLibraryName) {
                map.set(c.sourceLibraryId, c.sourceLibraryName);
            }
        }
        return Array.from(map.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    private _readGuideDensity(): 'detailed' | 'wide' {
        const raw = safeLocalStorageGet(RETUNE_STORAGE_KEYS.EPG_GUIDE_DENSITY);
        return raw === 'wide' ? 'wide' : DEFAULT_GUIDE_DENSITY;
    }

    private _getBaseVisibleHours(): number {
        return this._readGuideDensity() === 'wide' ? WIDE_VISIBLE_HOURS : DETAILED_VISIBLE_HOURS;
    }

    private _inferLibraryType(
        channels: ChannelConfig[],
        selectedId: string
    ): 'movie' | 'show' | null {
        let movieVotes = 0;
        let showVotes = 0;

        for (const channel of channels) {
            const belongsToLibrary =
                channel.sourceLibraryId === selectedId ||
                (channel.contentSource.type === 'library' && channel.contentSource.libraryId === selectedId);
            if (!belongsToLibrary) {
                continue;
            }

            if (channel.contentSource.type === 'library') {
                if (channel.contentSource.libraryType === 'movie') {
                    movieVotes++;
                } else {
                    showVotes++;
                }
                continue;
            }

            if (channel.contentSource.type === 'show') {
                showVotes++;
            }
        }

        if (movieVotes === 0 && showVotes === 0) {
            return null;
        }
        return movieVotes > showVotes ? 'movie' : 'show';
    }

    private _getVisibleHoursForCurrentFilter(
        channels: ChannelConfig[],
        selectedId: string | null,
        shouldFilter: boolean
    ): number {
        if (!shouldFilter || !selectedId) {
            return this._getBaseVisibleHours();
        }

        const libraryType = this._inferLibraryType(channels, selectedId);
        if (libraryType === 'movie') {
            return WIDE_VISIBLE_HOURS;
        }
        if (libraryType === 'show') {
            return DETAILED_VISIBLE_HOURS;
        }
        return this._getBaseVisibleHours();
    }

    private _getVisibleChannels(all: ChannelConfig[], selectedId: string | null, shouldFilter: boolean): ChannelConfig[] {
        if (!shouldFilter || !selectedId) return all;
        return all.filter((c) => {
            if (c.sourceLibraryId === selectedId) return true;
            // Include manual library channels if they match
            if (c.contentSource.type === 'library' && c.contentSource.libraryId === selectedId) return true;
            return false;
        });
    }

    private _getLibraryFilterState(all: ChannelConfig[]): {
        selectedId: string | null;
        tabsEnabled: boolean;
        shouldFilter: boolean;
        libraries: Array<{ id: string; name: string }>;
    } {
        const tabsEnabled = this._isLibraryTabsEnabled();
        let selectedId = this._readSelectedLibraryId();
        const libraries = this._buildLibraries(all);
        const hasMultipleLibraries = libraries.length > 1;
        const hasSelectedMatch = selectedId
            ? libraries.some((lib) => lib.id === selectedId) ||
            all.some((c) =>
                c.sourceLibraryId === selectedId ||
                (c.contentSource.type === 'library' && c.contentSource.libraryId === selectedId)
            )
            : false;

        if (!tabsEnabled || !hasMultipleLibraries || (selectedId && !hasSelectedMatch)) {
            if (selectedId) {
                safeLocalStorageRemove(RETUNE_STORAGE_KEYS.EPG_LIBRARY_FILTER);
            }
            selectedId = null;
        }

        const shouldFilter = tabsEnabled && hasMultipleLibraries && Boolean(selectedId);
        return { selectedId, tabsEnabled, shouldFilter, libraries };
    }

    openEPG(): void {
        const epg = this.deps.getEpg();
        if (!epg) return;

        const show = (): void => {
            this._preseedCurrentChannelSchedule();
            const preserveFocus = this.deps.getPreserveFocusOnOpen();
            epg.show({ preserveFocus });
            if (!preserveFocus) {
                this._focusEpgOnCurrentChannel();
                epg.focusNow();
            }
        };

        const status = this.deps.getEpgUiStatus();
        if (status === 'ready') {
            this.primeEpgChannels();
            void this.refreshEpgSchedules();
            show();
            return;
        }

        show();
        void this.deps.ensureEpgInitialized()
            .then(() => {
                this.primeEpgChannels();
                void this.refreshEpgSchedules();
                show();
            })
            .catch((error: unknown) => console.error('[Orchestrator] Failed to init EPG:', error));
    }

    closeEPG(): void {
        this.deps.getEpg()?.hide();
    }

    toggleEPG(): void {
        const epg = this.deps.getEpg();
        if (!epg) return;
        if (epg.isVisible()) {
            this.closeEPG();
        } else {
            this.openEPG();
        }
    }

    primeEpgChannels(): void {
        const epg = this.deps.getEpg();
        const channelManager = this.deps.getChannelManager();
        if (!epg || !channelManager) return;
        if (this.deps.getEpgUiStatus() !== 'ready') return;
        const all = channelManager.getAllChannels();
        const { selectedId, tabsEnabled, shouldFilter, libraries } = this._getLibraryFilterState(all);

        // Category colors
        const categoryColorsEnabled = readStoredBoolean(RETUNE_STORAGE_KEYS.GUIDE_CATEGORY_COLORS, true);
        epg.setCategoryColorsEnabled(categoryColorsEnabled);

        // Tabs (only show if enabled; EPGComponent will hide if <=1 library)
        if (tabsEnabled) {
            epg.setLibraryTabs(libraries, selectedId);
        } else {
            epg.setLibraryTabs([], null);
        }

        const storedLayoutMode = safeLocalStorageGet(RETUNE_STORAGE_KEYS.EPG_LAYOUT_MODE);
        const layoutMode = storedLayoutMode === 'classic' ? 'classic' : 'overlay';
        const nowWatchingEnabled = readStoredBoolean(RETUNE_STORAGE_KEYS.EPG_NOW_WATCHING_ENABLED, true);
        epg.setLayoutMode(layoutMode);
        epg.setNowWatchingBannerEnabled(nowWatchingEnabled);
        epg.setVisibleHours(this._getVisibleHoursForCurrentFilter(all, selectedId, shouldFilter));

        const visible = this._getVisibleChannels(all, selectedId, shouldFilter);
        epg.loadChannels(visible);
    }

    async refreshEpgSchedules(options?: { reason?: string; debounceMs?: number }): Promise<void> {
        const epg = this.deps.getEpg();
        if (!epg) return;
        const epgState = epg.getState();
        const range = {
            channelStart: epgState.viewWindow.startChannelIndex,
            channelEnd: epgState.viewWindow.endChannelIndex,
            timeStartMs: epgState.viewWindow.startTime,
            timeEndMs: epgState.viewWindow.endTime,
        };
        const reason = options?.reason ?? 'manual';
        if (options?.debounceMs !== undefined) {
            await this.refreshEpgSchedulesForRange(range, { reason, debounceMs: options.debounceMs });
            return;
        }
        await this._refreshEpgSchedulesForRange(range, reason);
    }

    refreshEpgScheduleForLiveChannel(): void {
        const epg = this.deps.getEpg();
        const channelManager = this.deps.getChannelManager();
        const scheduler = this.deps.getScheduler();
        if (!epg || !channelManager || !scheduler) return;
        if (this.deps.getEpgUiStatus() !== 'ready') return;
        if (!epg.isVisible()) return;

        const range = this._getEpgScheduleRangeMs();
        if (!range) return;

        const current = channelManager.getCurrentChannel();
        if (!current) return;

        const all = channelManager.getAllChannels();
        const { selectedId, shouldFilter } = this._getLibraryFilterState(all);
        const visible = this._getVisibleChannels(all, selectedId, shouldFilter);
        if (!visible.some((c) => c.id === current.id)) return;

        const state = scheduler.getState();
        if (!state.isActive || state.channelId !== current.id) {
            return;
        }

        try {
            const window = scheduler.getScheduleWindow(range.startTime, range.endTime);
            epg.loadScheduleForChannel(current.id, this._cloneScheduleWindow(window));
            const rangeKey = this._getScheduleRangeKey(range.startTime, range.endTime);
            this._markScheduleLoaded(current.id, rangeKey);
            this._storeScheduleCache(current.id, rangeKey, this._cloneScheduleWindow(window));
        } catch (error) {
            if (this._isDebugEnabled()) {
                appendEpgDebugLog('EPG.refreshEpgScheduleForLiveChannel.error', {
                    error: summarizeErrorForLog(error),
                });
            }
        }
    }

    private _preseedCurrentChannelSchedule(): void {
        const epg = this.deps.getEpg();
        const channelManager = this.deps.getChannelManager();
        const scheduler = this.deps.getScheduler();
        if (!epg || !channelManager || !scheduler) return;
        if (this.deps.getEpgUiStatus() !== 'ready') return;

        const range = this._getEpgScheduleRangeMs();
        if (!range) return;

        const current = channelManager.getCurrentChannel();
        if (!current) return;

        const all = channelManager.getAllChannels();
        const { selectedId, shouldFilter } = this._getLibraryFilterState(all);
        const visible = this._getVisibleChannels(all, selectedId, shouldFilter);
        if (!visible.some((c) => c.id === current.id)) return;

        const state = scheduler.getState();
        if (!state.isActive || state.channelId !== current.id) {
            return;
        }

        try {
            const window = scheduler.getScheduleWindow(range.startTime, range.endTime);
            const schedule = this._cloneScheduleWindow(window);
            epg.loadScheduleForChannel(current.id, schedule);
            const rangeKey = this._getScheduleRangeKey(range.startTime, range.endTime);
            this._markScheduleLoaded(current.id, rangeKey);
            this._storeScheduleCache(current.id, rangeKey, schedule);
        } catch (error) {
            if (this._isDebugEnabled()) {
                appendEpgDebugLog('EPG._preseedCurrentChannelSchedule.error', {
                    error: summarizeErrorForLog(error),
                });
            }
        }
    }

    async refreshEpgSchedulesForRange(range: {
        channelStart: number;
        channelEnd: number;
        timeStartMs: number;
        timeEndMs: number;
    }, options?: { reason?: string; debounceMs?: number }): Promise<void> {
        const debounceMs = Math.max(0, options?.debounceMs ?? 80);
        const reason = options?.reason ?? 'visible-range';
        if (debounceMs === 0) {
            await this._refreshEpgSchedulesForRange(range, reason);
            return;
        }
        this._pendingVisibleRange = range;
        this._pendingVisibleRangeReason = reason;
        if (this._visibleRangeTimer) {
            return this._pendingVisibleRangePromise ?? Promise.resolve();
        }
        if (!this._pendingVisibleRangePromise) {
            this._pendingVisibleRangePromise = new Promise<void>((resolve, reject) => {
                this._pendingVisibleRangeResolve = resolve;
                this._pendingVisibleRangeReject = reject;
            });
        }
        this._visibleRangeTimer = setTimeout(() => {
            this._visibleRangeTimer = null;
            const pending = this._pendingVisibleRange;
            const pendingReason = this._pendingVisibleRangeReason;
            this._pendingVisibleRange = null;
            this._pendingVisibleRangeReason = null;
            const resolvePending = this._pendingVisibleRangeResolve;
            const rejectPending = this._pendingVisibleRangeReject;
            this._pendingVisibleRangeResolve = null;
            this._pendingVisibleRangeReject = null;
            if (!pending) {
                resolvePending?.();
                this._pendingVisibleRangePromise = null;
                return;
            }
            this._refreshEpgSchedulesForRange(pending, pendingReason ?? 'visible-range')
                .then(() => resolvePending?.())
                .catch((error: unknown) => rejectPending?.(error))
                .finally(() => {
                    this._pendingVisibleRangePromise = null;
                });
        }, debounceMs);
        return this._pendingVisibleRangePromise ?? Promise.resolve();
    }

    wireEpgEvents(): Array<() => void> {
        const epg = this.deps.getEpg();
        if (!epg) return [];

        const handler = (payload: { channel: ChannelConfig; program: ScheduledProgram }): void => {
            this.deps.setLastChannelChangeSourceToGuide();
            const now = Date.now();
            if (
                payload.program.scheduleIndex === -1 ||
                payload.program.item.ratingKey.includes('-placeholder-')
            ) {
                return;
            }
            if (now < payload.program.scheduledStartTime) {
                return;
            }
            this.closeEPG();
            this.deps.switchToChannel(payload.channel.id).catch((error: unknown) => {
                if (isAbortLikeError(error)) return;
                console.error('[EPG] switchToChannel failed:', summarizeErrorForLog(error));
            });
        };
        epg.on('channelSelected', handler);

        const onFilter = (payload: { libraryId: string | null }): void => {
            if (payload.libraryId) {
                safeLocalStorageSet(RETUNE_STORAGE_KEYS.EPG_LIBRARY_FILTER, payload.libraryId);
            } else {
                safeLocalStorageRemove(RETUNE_STORAGE_KEYS.EPG_LIBRARY_FILTER);
            }

            const epgInstance = this.deps.getEpg();
            if (epgInstance) {
                epgInstance.clearSchedules();
            }
            this._clearLoadedSchedules();
            this._abortAllInFlightSchedules();

            this.primeEpgChannels();

            // Reset to top to avoid scroll offsets pointing past end after filtering
            const epg2 = this.deps.getEpg();
            if (epg2) {
                epg2.scrollToChannel(0);
                epg2.focusChannel(0);
            }

            void this.refreshEpgSchedules({ reason: 'library-filter', debounceMs: 0 });
        };

        epg.on('libraryFilterChanged', onFilter);

        return [
            (): void => {
                const epgInstance = this.deps.getEpg();
                if (epgInstance) {
                    epgInstance.off('channelSelected', handler);
                }
            },
            (): void => {
                const epgInstance = this.deps.getEpg();
                if (epgInstance) {
                    epgInstance.off('libraryFilterChanged', onFilter);
                }
            },
        ];
    }

    focusEpgOnCurrentChannel(): void {
        this._focusEpgOnCurrentChannel();
    }

    private _getEpgScheduleRangeMs(): { startTime: number; endTime: number } | null {
        const config = this.deps.getEpgConfig();
        if (!config) return null;
        const totalHours = config.totalHours;
        const slotMinutes = config.timeSlotMinutes;
        const slotMs = slotMinutes * 60_000;
        const PAST_WINDOW_MINUTES = 30;
        const now = Date.now();
        const dayStart = this.deps.getLocalMidnightMs(now);
        const startTime = Math.max(
            Math.floor((now - PAST_WINDOW_MINUTES * 60_000) / slotMs) * slotMs,
            dayStart
        );
        const endTime = startTime + totalHours * 60 * 60 * 1000;
        return { startTime, endTime };
    }

    private _getScheduleRangeKey(startTime: number, endTime: number): string {
        return `${startTime}-${endTime}`;
    }

    private _getScheduleCacheKey(channelId: string, rangeKey: string): string {
        return `${channelId}::${rangeKey}`;
    }

    private _cloneScheduleWindow(window: ScheduleWindow): ScheduleWindow {
        return { ...window, programs: [...window.programs] };
    }

    private _computeScheduleCacheLimit(channelCount: number): number {
        const scaled = Math.ceil(channelCount * 1.25);
        const clamped = Math.min(
            EPG_SCHEDULE_CACHE_MAX_ENTRIES,
            Math.max(EPG_SCHEDULE_CACHE_MIN_ENTRIES, scaled)
        );
        return clamped;
    }

    private _getChannelOverscanCount(channelCount: number): number {
        if (channelCount >= 200) return 10;
        if (channelCount >= 120) return 8;
        if (channelCount >= 80) return 7;
        return 6;
    }

    private _getScheduleLoadConcurrency(channelCount: number, prefetchCount: number): number {
        if (prefetchCount <= 0) {
            return 1;
        }
        let target = 4;
        if (channelCount >= 180) target = 8;
        else if (channelCount >= 120) target = 7;
        else if (channelCount >= 80) target = 6;
        return Math.max(1, Math.min(target, prefetchCount));
    }

    private _pruneScheduleCache(nowMs: number): void {
        for (const [key, entry] of this._epgScheduleCache) {
            if (nowMs - entry.loadedAt > EPG_SCHEDULE_CACHE_STALE_TTL_MS) {
                this._epgScheduleCache.delete(key);
            }
        }
        for (const [channelId, entry] of this._epgScheduleRangeKeyByChannel) {
            if (nowMs - entry.loadedAt > EPG_SCHEDULE_CACHE_TTL_MS) {
                this._epgScheduleRangeKeyByChannel.delete(channelId);
            }
        }
        while (this._epgScheduleCache.size > this._epgScheduleCacheMaxEntries) {
            const oldestKey = this._epgScheduleCache.keys().next().value;
            if (oldestKey === undefined) break;
            this._epgScheduleCache.delete(oldestKey);
        }
    }

    private _getCachedSchedule(
        channelId: string,
        rangeKey: string
    ): { schedule: ScheduleWindow; isStale: boolean } | null {
        const key = this._getScheduleCacheKey(channelId, rangeKey);
        const entry = this._epgScheduleCache.get(key);
        if (!entry) return null;
        const now = Date.now();
        const ageMs = now - entry.loadedAt;
        if (ageMs > EPG_SCHEDULE_CACHE_STALE_TTL_MS) {
            this._epgScheduleCache.delete(key);
            return null;
        }
        return { schedule: entry.schedule, isStale: ageMs > EPG_SCHEDULE_CACHE_TTL_MS };
    }

    private _storeScheduleCache(channelId: string, rangeKey: string, schedule: ScheduleWindow): void {
        const key = this._getScheduleCacheKey(channelId, rangeKey);
        if (this._epgScheduleCache.has(key)) {
            this._epgScheduleCache.delete(key);
        }
        this._epgScheduleCache.set(key, { rangeKey, schedule, loadedAt: Date.now() });
        this._pruneScheduleCache(Date.now());
    }

    private _isScheduleLoadedForRange(channelId: string, rangeKey: string): boolean {
        const entry = this._epgScheduleRangeKeyByChannel.get(channelId);
        if (!entry || entry.rangeKey !== rangeKey) return false;
        const now = Date.now();
        if (now - entry.loadedAt > EPG_SCHEDULE_CACHE_TTL_MS) {
            this._epgScheduleRangeKeyByChannel.delete(channelId);
            return false;
        }
        return true;
    }

    private _markScheduleLoaded(channelId: string, rangeKey: string): void {
        this._epgScheduleRangeKeyByChannel.set(channelId, { rangeKey, loadedAt: Date.now() });
    }

    private _clearLoadedSchedules(): void {
        this._epgScheduleRangeKeyByChannel.clear();
    }

    private _clearScheduleCaches(): void {
        this._epgScheduleRangeKeyByChannel.clear();
        this._epgScheduleCache.clear();
    }

    private _pruneInFlightSchedules(
        keepIds: Set<string>,
        rangeKey: string,
        abortAll: boolean
    ): { kept: number; aborted: number } {
        let kept = 0;
        let aborted = 0;
        for (const [channelId, entry] of this._epgScheduleInFlight) {
            if (abortAll || entry.rangeKey !== rangeKey || !keepIds.has(channelId)) {
                entry.controller.abort();
                this._epgScheduleInFlight.delete(channelId);
                aborted += 1;
            } else {
                kept += 1;
            }
        }
        return { kept, aborted };
    }

    private _abortAllInFlightSchedules(): void {
        for (const entry of this._epgScheduleInFlight.values()) {
            entry.controller.abort();
        }
        this._epgScheduleInFlight.clear();
    }

    private async _refreshEpgSchedulesForRange(
        range: { channelStart: number; channelEnd: number; timeStartMs: number; timeEndMs: number },
        reason: string
    ): Promise<void> {
        const epg = this.deps.getEpg();
        const channelManager = this.deps.getChannelManager();
        const scheduler = this.deps.getScheduler();
        if (!epg || !channelManager) return;
        if (this.deps.getEpgUiStatus() !== 'ready') return;

        const scheduleRange = this._getEpgScheduleRangeMs();
        if (!scheduleRange) return;

        const { startTime, endTime } = scheduleRange;
        epg.setGridAnchorTime(startTime);
        const all = channelManager.getAllChannels();
        const { selectedId, shouldFilter } = this._getLibraryFilterState(all);
        const channels = this._getVisibleChannels(all, selectedId, shouldFilter);
        if (channels.length === 0) return;

        const overscan = this._getChannelOverscanCount(channels.length);
        const startIndex = Math.max(0, range.channelStart - overscan);
        const endIndex = Math.min(channels.length, range.channelEnd + overscan);
        const rangeChannels = channels.slice(startIndex, endIndex);

        const refreshId = ++this._epgScheduleLoadToken;
        const rangeKey = this._getScheduleRangeKey(startTime, endTime);
        const forceRefresh = reason === 'channel-setup' || reason === 'server-swap';
        if (forceRefresh) {
            this._clearScheduleCaches();
        }
        const shuffler = new ShuffleGenerator();
        this._epgScheduleCacheMaxEntries = this._computeScheduleCacheLimit(channels.length);

        const liveChannelId = channelManager.getCurrentChannel()?.id ?? null;
        const epgState = epg.getState();
        const focusedChannelId = epgState.focusedCell
            ? channels[epgState.focusedCell.channelIndex]?.id ?? null
            : null;

        const prioritized: ChannelConfig[] = [];
        const addChannel = (channel: ChannelConfig | null | undefined): void => {
            if (!channel) return;
            if (prioritized.some((existing) => existing.id === channel.id)) return;
            prioritized.push(channel);
        };

        if (liveChannelId) {
            addChannel(channels.find((c) => c.id === liveChannelId));
        }
        if (focusedChannelId) {
            addChannel(channels.find((c) => c.id === focusedChannelId));
        }
        for (const channel of rangeChannels) {
            addChannel(channel);
        }

        const neededIds = new Set(prioritized.map((channel) => channel.id));
        const abortAll = reason === 'library-filter' || forceRefresh;
        const { kept: inFlightKept, aborted: inFlightAborted } = this._pruneInFlightSchedules(
            neededIds,
            rangeKey,
            abortAll
        );
        this._pruneScheduleCache(Date.now());

        let cacheHits = 0;
        let staleCacheHits = 0;
        let cacheMisses = 0;
        let inFlightSkipped = 0;
        let alreadyLoaded = 0;
        let liveScheduleHits = 0;
        const concurrency = this._getScheduleLoadConcurrency(channels.length, prioritized.length);

        const applySchedule = (
            channelId: string,
            schedule: ScheduleWindow,
            options?: { updateCache?: boolean }
        ): void => {
            epg.loadScheduleForChannel(channelId, schedule);
            if (options?.updateCache === false) {
                return;
            }
            this._markScheduleLoaded(channelId, rangeKey);
            this._storeScheduleCache(channelId, rangeKey, schedule);
        };

        if (this._isDebugEnabled()) {
            const payload = {
                reason,
                refreshId,
                rangeKey,
                channelCount: channels.length,
                preloadCount: prioritized.length,
                liveChannelId,
                focusedChannelId,
                visibleRange: {
                    start: range.channelStart,
                    end: range.channelEnd,
                },
                bufferedRange: {
                    start: startIndex,
                    end: endIndex,
                },
                overscan,
                inFlight: {
                    kept: inFlightKept,
                    aborted: inFlightAborted,
                },
                concurrency,
                cacheSize: this._epgScheduleCache.size,
                cacheMaxEntries: this._epgScheduleCacheMaxEntries,
            };
            appendEpgDebugLog('EPG.refreshEpgSchedulesForRange', payload);
        }

        const runForChannel = async (channel: ChannelConfig): Promise<void> => {
            if (!forceRefresh && this._isScheduleLoadedForRange(channel.id, rangeKey)) {
                alreadyLoaded += 1;
                return;
            }

            if (liveChannelId && channel.id === liveChannelId && scheduler) {
                const state = scheduler.getState();
                if (state.isActive && state.channelId === channel.id) {
                    const window = scheduler.getScheduleWindow(startTime, endTime);
                    applySchedule(channel.id, this._cloneScheduleWindow(window));
                    liveScheduleHits += 1;
                    return;
                }
            }

            const cached = forceRefresh ? null : this._getCachedSchedule(channel.id, rangeKey);
            if (cached) {
                const cachedSchedule = this._cloneScheduleWindow(cached.schedule);
                if (cached.isStale) {
                    applySchedule(channel.id, cachedSchedule, { updateCache: false });
                    staleCacheHits += 1;
                } else {
                    applySchedule(channel.id, cachedSchedule);
                    cacheHits += 1;
                    return;
                }
            }

            const existing = this._epgScheduleInFlight.get(channel.id);
            if (existing && existing.rangeKey === rangeKey) {
                inFlightSkipped += 1;
                return;
            }
            if (existing) {
                existing.controller.abort();
                this._epgScheduleInFlight.delete(channel.id);
            }

            const controller = new AbortController();
            this._epgScheduleInFlight.set(channel.id, { controller, rangeKey });
            cacheMisses += 1;

            try {
                const resolved = await channelManager.resolveChannelContent(channel.id, {
                    signal: controller.signal,
                });
                const active = this._epgScheduleInFlight.get(channel.id);
                if (!active || active.controller !== controller || controller.signal.aborted) {
                    return;
                }

                const scheduleConfig = this.deps.buildDailyScheduleConfig(
                    channel,
                    resolved.items,
                    startTime
                );
                const index = ScheduleCalculator.buildScheduleIndex(scheduleConfig, shuffler);
                const programs = ScheduleCalculator.generateScheduleWindow(
                    startTime,
                    endTime,
                    index,
                    scheduleConfig.anchorTime
                );

                applySchedule(channel.id, { startTime, endTime, programs });
            } catch (error) {
                if (controller.signal.aborted) {
                    return;
                }
                if ((error as { name?: string }).name === 'AbortError') {
                    return;
                }
            } finally {
                const active = this._epgScheduleInFlight.get(channel.id);
                if (active && active.controller === controller) {
                    this._epgScheduleInFlight.delete(channel.id);
                }
            }
        };

        let cursor = 0;
        const workers = Array.from({ length: concurrency }, async () => {
            while (true) {
                const channel = prioritized[cursor++];
                if (!channel) return;
                await runForChannel(channel);
            }
        });
        await Promise.all(workers);

        if (this._isDebugEnabled()) {
            const payload = {
                refreshId,
                rangeKey,
                cacheHits,
                staleCacheHits,
                cacheMisses,
                inFlightSkipped,
                alreadyLoaded,
                liveScheduleHits,
                concurrency,
                cacheSize: this._epgScheduleCache.size,
                cacheMaxEntries: this._epgScheduleCacheMaxEntries,
            };
            appendEpgDebugLog('EPG.refreshEpgSchedulesForRange.results', payload);
        }

        const focusedProgram = epg.getFocusedProgram();
        const focusedCell = epg.getState().focusedCell;
        const focusedIsPlaceholder = focusedCell?.kind === 'placeholder';
        const focusedIsInvalidProgram = focusedProgram
            ? focusedProgram.scheduleIndex === -1 ||
              focusedProgram.item.ratingKey.includes('-placeholder-')
            : false;

        if (
            refreshId === this._epgScheduleLoadToken &&
            epg.isVisible() &&
            (!focusedProgram || focusedIsPlaceholder || focusedIsInvalidProgram)
        ) {
            epg.focusNow();
        }
    }

    private _focusEpgOnCurrentChannel(): void {
        const epg = this.deps.getEpg();
        const channelManager = this.deps.getChannelManager();
        if (!epg || !channelManager) return;
        const current = channelManager.getCurrentChannel();
        if (!current) return;
        const all = channelManager.getAllChannels();
        const { selectedId, shouldFilter } = this._getLibraryFilterState(all);
        const channels = this._getVisibleChannels(all, selectedId, shouldFilter);
        const index = channels.findIndex((channel) => channel.id === current.id);
        if (index >= 0) {
            epg.focusChannel(index);
        }
    }

    private _isDebugEnabled(): boolean {
        try {
            return localStorage.getItem('retune_debug_epg') === '1';
        } catch {
            return false;
        }
    }
}
