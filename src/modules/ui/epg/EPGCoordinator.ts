/**
 * @fileoverview Coordinates EPG state, schedule loading, and overlay lifecycle.
 * @module modules/ui/epg/EPGCoordinator
 * @version 1.0.0
 */

import type { EpgGuideDensity } from '../../settings/EpgPreferencesStore';
import { appendEpgDebugLog, isEpgDebugLoggingEnabled } from './utils';
import type { IEPGComponent } from './interfaces';
import type { ChannelConfig as EpgChannel, EPGConfig, EpgVisibleRange, ScheduledProgram as EpgScheduledProgram } from './types';
import type { GuideSettingChange } from '../settings/types';
import type { IChannelManager, ChannelConfig as SchedulerChannelConfig, ResolvedChannelContent } from '../../scheduler/channel-manager';
import type {
    IChannelScheduler,
    ScheduleConfig,
    ScheduleWindow as SchedulerScheduleWindow,
} from '../../scheduler/scheduler';
import { EpgPreferencesStore } from '../../settings/EpgPreferencesStore';
import { isAbortLikeError, summarizeErrorForLog } from '../../../utils/errors';
import type { ModuleRuntimeStatus } from '../../../core/module-status';
import {
    computeEpgScheduleRangeMs,
    type EpgStorageSnapshotForScheduleRange,
} from './EPGCoordinatorPolicies';
import { buildLibraries, countLibraryTypeVotes } from './epgLibraryUtils';
import { EPGVisibleRangeRefreshQueue } from './EPGVisibleRangeRefreshQueue';
import { EPGScheduleRefreshRuntime } from './EPGScheduleRefreshRuntime';
import { toEpgChannels, toEpgScheduleWindow } from './adapters';

export type EpgUiStatus = ModuleRuntimeStatus | undefined;

export interface EPGCoordinatorDeps {
    getEpg: () => IEPGComponent | null;
    getChannelManager: () => IChannelManager | null;
    getScheduler: () => IChannelScheduler | null;

    getEpgUiStatus: () => EpgUiStatus;
    ensureEpgInitialized: () => Promise<void>;

    getEpgConfig: () => EPGConfig | null;
    getLocalMidnightMs: (timeMs: number) => number;
    getEpgScheduleRangeSnapshot: () => EpgStorageSnapshotForScheduleRange;

    buildDailyScheduleConfig: (
        channel: SchedulerChannelConfig,
        items: ResolvedChannelContent['items'],
        referenceTimeMs: number
    ) => ScheduleConfig;

    getPreserveFocusOnOpen: () => boolean;

    setLastChannelChangeSourceToGuide: () => void;
    switchToChannel: (channelId: string) => Promise<void>;
    reportEpgInitWarning: (error: unknown) => void;
    epgPreferencesStore?: EpgPreferencesStore;
}

const EPG_SCHEDULE_CACHE_MIN_ENTRIES = 60;
const EPG_SCHEDULE_CACHE_MAX_ENTRIES = 240;
const EPG_SCHEDULE_CACHE_MIN_ENTRIES_AGGRESSIVE = 120;
const EPG_SCHEDULE_CACHE_MAX_ENTRIES_AGGRESSIVE = 360;
const DEFAULT_GUIDE_DENSITY: EpgGuideDensity = 'detailed';
const DETAILED_VISIBLE_HOURS = 2;
const WIDE_VISIBLE_HOURS = 3;

export class EPGCoordinator {
    private readonly _epgPreferencesStore: EpgPreferencesStore;
    private _visibleRangeRefreshQueue: EPGVisibleRangeRefreshQueue;
    private readonly _scheduleRefreshRuntime: EPGScheduleRefreshRuntime;
    private _openRequestId = 0;

    constructor(private readonly deps: EPGCoordinatorDeps) {
        this._epgPreferencesStore = deps.epgPreferencesStore ?? new EpgPreferencesStore();
        this._scheduleRefreshRuntime = new EPGScheduleRefreshRuntime({
            getEpg: (): IEPGComponent | null => this.deps.getEpg(),
            getChannelManager: (): IChannelManager | null => this.deps.getChannelManager(),
            getScheduler: (): IChannelScheduler | null => this.deps.getScheduler(),
            getEpgUiStatus: (): EpgUiStatus => this.deps.getEpgUiStatus(),
            getEpgScheduleRangeMs: (): { startTime: number; endTime: number } | null =>
                this._getEpgScheduleRangeMs(),
            getLibraryFilterState: (allChannels: SchedulerChannelConfig[]): { selectedId: string | null; shouldFilter: boolean } => {
                const { selectedId, shouldFilter } = this._getLibraryFilterState(allChannels);
                return { selectedId, shouldFilter };
            },
            getVisibleChannels: (
                allChannels: SchedulerChannelConfig[],
                selectedId: string | null,
                shouldFilter: boolean
            ): SchedulerChannelConfig[] => this._getVisibleChannels(allChannels, selectedId, shouldFilter),
            buildDailyScheduleConfig: (
                channel: SchedulerChannelConfig,
                items: ResolvedChannelContent['items'],
                referenceTimeMs: number
            ): ScheduleConfig => this.deps.buildDailyScheduleConfig(channel, items, referenceTimeMs),
            computeScheduleCacheLimit: (channelCount: number, aggressive: boolean): number =>
                this._computeScheduleCacheLimit(channelCount, aggressive),
            getScheduleLoadConcurrency: (
                channelCount: number,
                prefetchCount: number,
                aggressive: boolean
            ): number => this._getScheduleLoadConcurrency(channelCount, prefetchCount, aggressive),
            cloneScheduleWindow: (window: SchedulerScheduleWindow): SchedulerScheduleWindow => this._cloneScheduleWindow(window),
            isAggressivePreloadEnabled: (): boolean => this._isAggressivePreloadEnabled(),
            isDebugEnabled: (): boolean => this._isDebugEnabled(),
            appendDebugLog: (event: string, payload: Record<string, unknown>): void => {
                appendEpgDebugLog(event, payload);
            },
        });
        this._visibleRangeRefreshQueue = new EPGVisibleRangeRefreshQueue(
            (range: EpgVisibleRange, reason: string) => this._refreshEpgSchedulesForRange(range, reason)
        );
    }

    private _refreshEpgSchedulesBestEffort(options?: { reason?: string; debounceMs?: number }): void {
        void this.refreshEpgSchedules(options).catch((error: unknown) => {
            if (isAbortLikeError(error)) return;
            console.error('[EPGCoordinator] refreshEpgSchedules failed:', summarizeErrorForLog(error));
        });
    }

    private _refreshEpgSchedulesForRangeBestEffort(
        range: EpgVisibleRange,
        options?: { reason?: string; debounceMs?: number }
    ): void {
        void this.refreshEpgSchedulesForRange(range, options).catch((error: unknown) => {
            if (isAbortLikeError(error)) return;
            console.error('[EPGCoordinator] refreshEpgSchedulesForRange failed:', summarizeErrorForLog(error));
        });
    }

    /**
     * Clear schedule caches and "loaded range" markers.
     * Use this when the UI schedules are cleared (e.g. after library filter changes)
     * to avoid cache/UI mismatches where the coordinator believes data is loaded.
     */
    clearScheduleCaches(): void {
        this._scheduleRefreshRuntime.clearScheduleCaches();
    }

    private _cancelScheduledRefreshWork(reason: string): void {
        this._visibleRangeRefreshQueue.cancelPendingRefresh();
        this._scheduleRefreshRuntime.abortAllInFlightSchedules(reason);
    }

    withVisibleRangeRefreshPolicy(epgConfig: EPGConfig | null | undefined): EPGConfig | null {
        if (!epgConfig) {
            return null;
        }

        const previousOnVisibleRangeChange = epgConfig.onVisibleRangeChange ?? null;
        return {
            ...epgConfig,
            onVisibleRangeChange: (range): void => {
                if (previousOnVisibleRangeChange) {
                    previousOnVisibleRangeChange(range);
                }
                this._refreshEpgSchedulesForRangeBestEffort(range, { reason: 'visible-range' });
            },
        };
    }

    handleGuideSettingChange(change: GuideSettingChange): void {
        const shouldInvalidateSchedules =
            change.key === 'libraryTabs' ||
            change.key === 'guideDensity' ||
            change.key === 'aggressivePreload' ||
            change.key === 'pastItemsWindow';

        if (shouldInvalidateSchedules) {
            this._cancelScheduledRefreshWork('guide-settings');
            this.clearScheduleCaches();
        }

        const epg = this.deps.getEpg();
        if (!epg) return;

        if (shouldInvalidateSchedules) {
            epg.clearSchedules();
        }

        if (!epg.isVisible()) return;

        if (change.key === 'layoutMode') {
            epg.setLayoutMode(change.mode);
            return;
        }

        if (change.key === 'nowWatchingBanner') {
            epg.setNowWatchingBannerEnabled(change.enabled);
            return;
        }

        if (change.key === 'infoBackgroundMode') {
            return;
        }

        this.primeEpgChannels();
        if (
            change.key === 'libraryTabs' ||
            change.key === 'guideDensity' ||
            change.key === 'aggressivePreload' ||
            change.key === 'pastItemsWindow'
        ) {
            this._refreshEpgSchedulesBestEffort({ reason: 'guide-settings' });
        }
    }

    private _isLibraryTabsEnabled(): boolean {
        return this._epgPreferencesStore.readLibraryTabsEnabled(true);
    }

    private _isAggressivePreloadEnabled(): boolean {
        return this._epgPreferencesStore.readAggressivePreloadEnabled(false);
    }

    private _readSelectedLibraryId(): string | null {
        return this._epgPreferencesStore.readSelectedLibraryId();
    }

    private _readGuideDensity(): EpgGuideDensity {
        return this._epgPreferencesStore.readGuideDensity(DEFAULT_GUIDE_DENSITY);
    }

    private _getBaseVisibleHours(): number {
        return this._readGuideDensity() === 'wide' ? WIDE_VISIBLE_HOURS : DETAILED_VISIBLE_HOURS;
    }

    private _inferLibraryType(
        channels: SchedulerChannelConfig[],
        selectedId: string
    ): 'movie' | 'show' | null {
        const { movieVotes, showVotes } = countLibraryTypeVotes(channels, selectedId);

        if (movieVotes === 0 && showVotes === 0) {
            return null;
        }
        if (movieVotes === showVotes) {
            return null;
        }
        return movieVotes > showVotes ? 'movie' : 'show';
    }

    private _getVisibleHoursForCurrentFilter(
        channels: SchedulerChannelConfig[],
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

    private _getVisibleChannels(
        all: SchedulerChannelConfig[],
        selectedId: string | null,
        shouldFilter: boolean
    ): SchedulerChannelConfig[] {
        if (!shouldFilter || !selectedId) return all;
        return all.filter((c) => {
            if (c.sourceLibraryId === selectedId) return true;
            // Include manual library channels if they match
            if (c.contentSource.type === 'library' && c.contentSource.libraryId === selectedId) return true;
            return false;
        });
    }

    private _computeLibraryFilterState(all: SchedulerChannelConfig[], options: { mutateStorage: boolean }): {
        selectedId: string | null;
        tabsEnabled: boolean;
        shouldFilter: boolean;
        libraries: Array<{ id: string; name: string }>;
    } {
        const tabsEnabled = this._isLibraryTabsEnabled();
        let selectedId = this._readSelectedLibraryId();
        const libraries = buildLibraries(all);
        const hasMultipleLibraries = libraries.length > 1;
        const hasSelectedMatch = selectedId
            ? libraries.some((lib) => lib.id === selectedId) ||
            all.some((c) =>
                c.sourceLibraryId === selectedId ||
                (c.contentSource.type === 'library' && c.contentSource.libraryId === selectedId)
            )
            : false;

        if (!tabsEnabled || !hasMultipleLibraries || (selectedId && !hasSelectedMatch)) {
            if (options.mutateStorage && selectedId) {
                this._epgPreferencesStore.writeSelectedLibraryId(null);
            }
            selectedId = null;
        }

        const shouldFilter = tabsEnabled && hasMultipleLibraries && Boolean(selectedId);
        return { selectedId, tabsEnabled, shouldFilter, libraries };
    }

    private _getLibraryFilterState(all: SchedulerChannelConfig[]): {
        selectedId: string | null;
        tabsEnabled: boolean;
        shouldFilter: boolean;
        libraries: Array<{ id: string; name: string }>;
    } {
        return this._computeLibraryFilterState(all, { mutateStorage: true });
    }

    openEPG(): void {
        const epg = this.deps.getEpg();
        if (!epg) return;
        const requestId = ++this._openRequestId;

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
            this._refreshEpgSchedulesBestEffort();
            show();
            return;
        }

        show();
        void this.deps.ensureEpgInitialized()
            .then(() => {
                if (requestId !== this._openRequestId) {
                    return;
                }
                this.primeEpgChannels();
                this._refreshEpgSchedulesBestEffort();
                show();
            })
            .catch((error: unknown) => {
                if (requestId !== this._openRequestId) {
                    return;
                }
                console.error('[EPGCoordinator] Failed to init EPG:', summarizeErrorForLog(error));
                this.deps.getEpg()?.hide();
                this.deps.reportEpgInitWarning(error);
            });
    }

    closeEPG(): void {
        this._openRequestId++;
        this._cancelScheduledRefreshWork('close-epg');
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
        const categoryColorsEnabled = this._epgPreferencesStore.readGuideCategoryColorsEnabled(true);
        epg.setCategoryColorsEnabled(categoryColorsEnabled);

        // Tabs (only show if enabled; EPGComponent will hide if <=1 library)
        if (tabsEnabled) {
            epg.setLibraryTabs(libraries, selectedId);
        } else {
            epg.setLibraryTabs([], null);
        }

        const layoutMode = this._epgPreferencesStore.readLayoutMode('classic');
        const nowWatchingEnabled = this._epgPreferencesStore.readNowWatchingEnabled(true);
        epg.setLayoutMode(layoutMode);
        epg.setNowWatchingBannerEnabled(nowWatchingEnabled);
        epg.setVisibleHours(this._getVisibleHoursForCurrentFilter(all, selectedId, shouldFilter));

        const visible = this._getVisibleChannels(all, selectedId, shouldFilter);
        epg.loadChannels(toEpgChannels(visible));
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
            const schedule = this._cloneScheduleWindow(window);
            epg.loadScheduleForChannel(current.id, toEpgScheduleWindow(schedule));
            this._scheduleRefreshRuntime.cacheScheduleForRange(
                current.id,
                range.startTime,
                range.endTime,
                schedule
            );
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
            epg.loadScheduleForChannel(current.id, toEpgScheduleWindow(schedule));
            this._scheduleRefreshRuntime.cacheScheduleForRange(
                current.id,
                range.startTime,
                range.endTime,
                schedule
            );
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
        return this._visibleRangeRefreshQueue.request(range, options);
    }

    wireEpgEvents(): Array<() => void> {
        const epg = this.deps.getEpg();
        if (!epg) return [];

        const handler = (payload: { channel: EpgChannel; program: EpgScheduledProgram }): void => {
            const now = Date.now();
            if (
                payload.program.scheduleIndex === -1 ||
                payload.program.item.ratingKey.includes('-placeholder-')
            ) {
                return;
            }
            const { scheduledStartTime, scheduledEndTime } = payload.program;
            if (!Number.isFinite(scheduledStartTime) || !Number.isFinite(scheduledEndTime)) {
                return;
            }
            if (scheduledStartTime >= scheduledEndTime) {
                return;
            }
            if (now < scheduledStartTime || now >= scheduledEndTime) {
                return;
            }
            this.deps.setLastChannelChangeSourceToGuide();
            this.closeEPG();
            this.deps.switchToChannel(payload.channel.id).catch((error: unknown) => {
                if (isAbortLikeError(error)) return;
                console.error('[EPG] switchToChannel failed:', summarizeErrorForLog(error));
            });
        };
        epg.on('channelSelected', handler);

	        const onFilter = (payload: { libraryId: string | null }): void => {
	            this._epgPreferencesStore.writeSelectedLibraryId(payload.libraryId ?? null);

	            this._cancelScheduledRefreshWork('library-filter');
	            this._scheduleRefreshRuntime.clearLoadedScheduleMarkers();

	            const epgInstance = this.deps.getEpg();
	            if (epgInstance) {
	                epgInstance.clearSchedules();
	            }

	            this.primeEpgChannels();

	            // Reset to top to avoid scroll offsets pointing past end after filtering
	            if (epgInstance) {
	                epgInstance.scrollToChannel(0);
	                epgInstance.focusChannel(0);
	            }

	            this._refreshEpgSchedulesBestEffort({ reason: 'library-filter', debounceMs: 0 });
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
        const storage = this.deps.getEpgScheduleRangeSnapshot();
        return computeEpgScheduleRangeMs(this.deps, Date.now(), storage);
    }

    private _cloneScheduleWindow(window: SchedulerScheduleWindow): SchedulerScheduleWindow {
        return { ...window, programs: [...window.programs] };
    }

    private _computeScheduleCacheLimit(channelCount: number, aggressive: boolean): number {
        const scaled = Math.ceil(channelCount * (aggressive ? 1.6 : 1.25));
        const minEntries = aggressive ? EPG_SCHEDULE_CACHE_MIN_ENTRIES_AGGRESSIVE : EPG_SCHEDULE_CACHE_MIN_ENTRIES;
        const maxEntries = aggressive ? EPG_SCHEDULE_CACHE_MAX_ENTRIES_AGGRESSIVE : EPG_SCHEDULE_CACHE_MAX_ENTRIES;
        const clamped = Math.min(
            maxEntries,
            Math.max(minEntries, scaled)
        );
        return clamped;
    }

    private _getScheduleLoadConcurrency(
        channelCount: number,
        prefetchCount: number,
        aggressive: boolean
    ): number {
        if (prefetchCount <= 0) {
            return 1;
        }
        let target = aggressive ? 5 : 4;
        if (channelCount >= 180) target = aggressive ? 10 : 8;
        else if (channelCount >= 120) target = aggressive ? 8 : 7;
        else if (channelCount >= 80) target = aggressive ? 7 : 6;
        return Math.max(1, Math.min(target, prefetchCount));
    }

    private async _refreshEpgSchedulesForRange(
        range: { channelStart: number; channelEnd: number; timeStartMs: number; timeEndMs: number },
        reason: string
    ): Promise<void> {
        await this._scheduleRefreshRuntime.refreshForRange(range, reason);
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
        return isEpgDebugLoggingEnabled();
    }
}
