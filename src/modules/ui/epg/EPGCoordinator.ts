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
import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
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
    reportEpgInitWarning: (error: unknown) => void;
}

const EPG_SCHEDULE_CACHE_TTL_MS = 2 * 60_000;
const EPG_SCHEDULE_CACHE_STALE_TTL_MS = 10 * 60_000;
const EPG_SCHEDULE_CACHE_MIN_ENTRIES = 60;
const EPG_SCHEDULE_CACHE_MAX_ENTRIES = 240;
const EPG_SCHEDULE_CACHE_MIN_ENTRIES_AGGRESSIVE = 120;
const EPG_SCHEDULE_CACHE_MAX_ENTRIES_AGGRESSIVE = 360;
const EPG_BACKGROUND_WARM_DEFAULT_MAX_QUEUED = 64;
const EPG_BACKGROUND_WARM_MAX_QUEUED = 120;
const EPG_BACKGROUND_WARM_DEFAULT_MAX_QUEUED_AGGRESSIVE = 128;
const EPG_BACKGROUND_WARM_MAX_QUEUED_AGGRESSIVE = 220;
const EPG_BACKGROUND_WARM_IDLE_TIMEOUT_MS = 120;
const EPG_BACKGROUND_WARM_TIMER_DELAY_MS = 24;
const EPG_BACKGROUND_WARM_BACKPRESSURE_DELAY_MS = 120;
const EPG_BACKGROUND_DEBUG_LOG_EVERY_N = 20;
const DEFAULT_GUIDE_DENSITY: 'detailed' | 'wide' = 'detailed';
const DETAILED_VISIBLE_HOURS = 2;
const WIDE_VISIBLE_HOURS = 3;

type IdleDeadlineLike = {
    didTimeout: boolean;
    timeRemaining: () => number;
};

type IdleSchedulerLike = typeof globalThis & {
    requestIdleCallback?: (
        callback: (deadline: IdleDeadlineLike) => void,
        options?: { timeout: number }
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
};

type BackgroundWarmQueueState = {
    refreshId: number;
    reason: string;
    channels: ChannelConfig[];
    runForChannel: (channel: ChannelConfig) => Promise<void>;
    concurrency: number;
    cursor: number;
};

type EpgPastItemsWindowSetting = 'auto' | '0' | '15' | '30';

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
    private _backgroundWarmQueueState: BackgroundWarmQueueState | null = null;
    private _backgroundWarmQueueTimer: ReturnType<typeof setTimeout> | null = null;
    private _backgroundWarmQueueIdleHandle: number | null = null;
    private _backgroundDebugState: {
        refreshId: number;
        rangeKey: string;
        refreshStartedAt: number;
        logCount: number;
        immediateLoadedCount: number;
        backgroundLoadedCount: number;
        cacheHits: number;
        cacheMisses: number;
        firstVisibleScheduleReadyMs: number | null;
    } | null = null;

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
        return readStoredBoolean(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, true);
    }

    private _isAggressivePreloadEnabled(): boolean {
        return readStoredBoolean(LINEUP_STORAGE_KEYS.EPG_AGGRESSIVE_PRELOAD_ENABLED, false);
    }

    private _readSelectedLibraryId(): string | null {
        const raw = safeLocalStorageGet(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER);
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
        const raw = safeLocalStorageGet(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY);
        return raw === 'wide' ? 'wide' : DEFAULT_GUIDE_DENSITY;
    }

    private _getBaseVisibleHours(): number {
        return this._readGuideDensity() === 'wide' ? WIDE_VISIBLE_HOURS : DETAILED_VISIBLE_HOURS;
    }

    private _readPastItemsWindowSetting(): EpgPastItemsWindowSetting {
        const raw = safeLocalStorageGet(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW);
        if (raw === '0' || raw === '15' || raw === '30') return raw;
        return 'auto';
    }

    private _countLibraryTypeVotes(
        channels: ChannelConfig[],
        selectedId: string
    ): { movieVotes: number; showVotes: number } {
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

        return { movieVotes, showVotes };
    }

    private _countLibraryTypeVotesAcrossAllChannels(
        channels: ChannelConfig[]
    ): { movieVotes: number; showVotes: number; unknownVotes: number } {
        let movieVotes = 0;
        let showVotes = 0;
        let unknownVotes = 0;

        for (const channel of channels) {
            const source = channel.contentSource;
            if (!source) {
                unknownVotes++;
                continue;
            }
            if (source.type === 'library') {
                if (source.libraryType === 'movie') {
                    movieVotes++;
                } else {
                    showVotes++;
                }
                continue;
            }
            if (source.type === 'show') {
                showVotes++;
                continue;
            }
            unknownVotes++;
        }

        return { movieVotes, showVotes, unknownVotes };
    }

    private _getEffectivePastWindowMinutes(allChannels: ChannelConfig[]): number {
        const setting = this._readPastItemsWindowSetting();
        if (setting !== 'auto') {
            return Number(setting);
        }

        const { selectedId, shouldFilter } = this._getLibraryFilterState(allChannels);
        if (!shouldFilter || !selectedId) {
            const { movieVotes, showVotes, unknownVotes } = this._countLibraryTypeVotesAcrossAllChannels(allChannels);
            if (unknownVotes === 0 && showVotes > 0 && movieVotes === 0) {
                return 0;
            }
            return 15;
        }

        const { movieVotes, showVotes } = this._countLibraryTypeVotes(allChannels, selectedId);
        if (showVotes > 0 && movieVotes === 0) {
            return 0;
        }
        return 15;
    }

    private _inferLibraryType(
        channels: ChannelConfig[],
        selectedId: string
    ): 'movie' | 'show' | null {
        const { movieVotes, showVotes } = this._countLibraryTypeVotes(channels, selectedId);

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
                safeLocalStorageRemove(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER);
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
            .catch((error: unknown) => {
                console.error('[EPGCoordinator] Failed to init EPG:', summarizeErrorForLog(error));
                this.deps.getEpg()?.hide();
                this.deps.reportEpgInitWarning(error);
            });
    }

    closeEPG(): void {
        this._cancelBackgroundWarmQueue('close-epg');
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
        const categoryColorsEnabled = readStoredBoolean(LINEUP_STORAGE_KEYS.GUIDE_CATEGORY_COLORS, true);
        epg.setCategoryColorsEnabled(categoryColorsEnabled);

        // Tabs (only show if enabled; EPGComponent will hide if <=1 library)
        if (tabsEnabled) {
            epg.setLibraryTabs(libraries, selectedId);
        } else {
            epg.setLibraryTabs([], null);
        }

        const storedLayoutMode = safeLocalStorageGet(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE);
        const layoutMode = storedLayoutMode === 'overlay' ? 'overlay' : 'classic';
        const nowWatchingEnabled = readStoredBoolean(LINEUP_STORAGE_KEYS.EPG_NOW_WATCHING_ENABLED, true);
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
                safeLocalStorageSet(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER, payload.libraryId);
            } else {
                safeLocalStorageRemove(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER);
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
        const channelManager = this.deps.getChannelManager();
        const allChannels = channelManager?.getAllChannels() ?? [];
        const pastWindowMinutes = this._getEffectivePastWindowMinutes(allChannels);
        const now = Date.now();
        const dayStart = this.deps.getLocalMidnightMs(now);
        const startTime = Math.max(
            Math.floor((now - pastWindowMinutes * 60_000) / slotMs) * slotMs,
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

    private _getChannelOverscanCount(channelCount: number, aggressive: boolean): number {
        if (aggressive) {
            if (channelCount >= 200) return 16;
            if (channelCount >= 120) return 12;
            if (channelCount >= 80) return 10;
            return 8;
        }
        if (channelCount >= 200) return 10;
        if (channelCount >= 120) return 8;
        if (channelCount >= 80) return 7;
        return 6;
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

    private _getBackgroundWarmQueueCaps(
        channelCount: number,
        visibleCount: number,
        aggressive: boolean
    ): { maxQueuedChannels: number; maxConcurrency: number } {
        if (channelCount >= 260) {
            if (aggressive) {
                return { maxQueuedChannels: 140, maxConcurrency: 2 };
            }
            return { maxQueuedChannels: 96, maxConcurrency: 1 };
        }

        const baseQueue = aggressive
            ? EPG_BACKGROUND_WARM_DEFAULT_MAX_QUEUED_AGGRESSIVE
            : EPG_BACKGROUND_WARM_DEFAULT_MAX_QUEUED;
        const maxQueueCap = aggressive
            ? EPG_BACKGROUND_WARM_MAX_QUEUED_AGGRESSIVE
            : EPG_BACKGROUND_WARM_MAX_QUEUED;
        const scaledQueue = Math.max(baseQueue, visibleCount * (aggressive ? 20 : 12));
        const maxQueuedChannels = Math.min(
            maxQueueCap,
            Math.max(48, Math.min(channelCount, scaledQueue))
        );
        const maxConcurrency = aggressive
            ? (channelCount >= 120 ? 3 : 2)
            : (channelCount >= 120 ? 2 : 1);
        return { maxQueuedChannels, maxConcurrency };
    }

    private _getBackgroundLookAheadCount(
        channelCount: number,
        visibleCount: number,
        aggressive: boolean
    ): number {
        const scaled = Math.max(visibleCount * (aggressive ? 14 : 8), aggressive ? 48 : 24);
        if (channelCount >= 200) {
            return Math.max(scaled, aggressive ? 160 : 96);
        }
        if (channelCount >= 120) {
            return Math.max(scaled, aggressive ? 120 : 72);
        }
        return Math.max(scaled, aggressive ? 84 : 48);
    }

    private _partitionPrefetchChannels(
        channels: ChannelConfig[],
        range: { channelStart: number; channelEnd: number },
        ids: { liveChannelId: string | null; focusedChannelId: string | null },
        caps: { visibleCount: number; maxQueuedChannels: number; aggressive: boolean }
    ): {
        immediateChannels: ChannelConfig[];
        backgroundChannels: ChannelConfig[];
        overscan: number;
        bufferedRange: { start: number; end: number }; // [start, end)
        backgroundRange: { start: number; end: number }; // [start, end)
    } {
        const overscan = this._getChannelOverscanCount(channels.length, caps.aggressive);
        // `range.channelEnd` is inclusive (see visibleCount computation); Array#slice end is exclusive.
        const startIndex = Math.max(0, range.channelStart - overscan);
        const endIndex = Math.min(channels.length, range.channelEnd + 1 + overscan);

        const immediateChannels: ChannelConfig[] = [];
        const immediateIds = new Set<string>();
        const addImmediate = (channel: ChannelConfig | null | undefined): void => {
            if (!channel) return;
            if (immediateIds.has(channel.id)) return;
            immediateIds.add(channel.id);
            immediateChannels.push(channel);
        };

        if (ids.liveChannelId) {
            addImmediate(channels.find((channel) => channel.id === ids.liveChannelId));
        }
        if (ids.focusedChannelId) {
            addImmediate(channels.find((channel) => channel.id === ids.focusedChannelId));
        }
        for (const channel of channels.slice(startIndex, endIndex)) {
            addImmediate(channel);
        }

        const lookAhead = this._getBackgroundLookAheadCount(channels.length, caps.visibleCount, caps.aggressive);
        const warmStart = endIndex;
        const warmEnd = Math.min(channels.length, warmStart + lookAhead);

        const backgroundChannels: ChannelConfig[] = [];
        for (const channel of channels.slice(warmStart, warmEnd)) {
            if (immediateIds.has(channel.id)) {
                continue;
            }
            backgroundChannels.push(channel);
            if (backgroundChannels.length >= caps.maxQueuedChannels) {
                break;
            }
        }

        return {
            immediateChannels,
            backgroundChannels,
            overscan,
            bufferedRange: { start: startIndex, end: endIndex },
            backgroundRange: { start: warmStart, end: warmEnd },
        };
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
        this._cancelBackgroundWarmQueue('clear-schedule-caches');
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
        this._cancelBackgroundWarmQueue('abort-all-inflight');
        for (const entry of this._epgScheduleInFlight.values()) {
            entry.controller.abort();
        }
        this._epgScheduleInFlight.clear();
    }

    private _cancelBackgroundWarmQueue(reason: string): void {
        const previousWarmState = this._backgroundWarmQueueState;
        this._backgroundWarmQueueState = null;

        if (this._backgroundWarmQueueTimer) {
            clearTimeout(this._backgroundWarmQueueTimer);
            this._backgroundWarmQueueTimer = null;
        }

        if (this._backgroundWarmQueueIdleHandle !== null) {
            const idleScheduler = globalThis as IdleSchedulerLike;
            if (typeof idleScheduler.cancelIdleCallback === 'function') {
                idleScheduler.cancelIdleCallback(this._backgroundWarmQueueIdleHandle);
            }
            this._backgroundWarmQueueIdleHandle = null;
        }

        if (this._isDebugEnabled()) {
            appendEpgDebugLog('EPG.backgroundWarmQueue.cancel', { reason });
        }

        if (
            previousWarmState &&
            this._backgroundDebugState &&
            this._backgroundDebugState.refreshId === previousWarmState.refreshId &&
            reason === 'warm-queue-complete' &&
            this._isDebugEnabled()
        ) {
            const cacheHitRatio =
                this._backgroundDebugState.cacheHits /
                Math.max(1, this._backgroundDebugState.cacheHits + this._backgroundDebugState.cacheMisses);
            appendEpgDebugLog('EPG.refreshEpgSchedulesForRange.background', {
                refreshId: this._backgroundDebugState.refreshId,
                rangeKey: this._backgroundDebugState.rangeKey,
                rangeRefreshDurationMs: Date.now() - this._backgroundDebugState.refreshStartedAt,
                immediateLoadedCount: this._backgroundDebugState.immediateLoadedCount,
                backgroundLoadedCount: this._backgroundDebugState.backgroundLoadedCount,
                cacheHitRatio,
                firstVisibleScheduleReadyMs: this._backgroundDebugState.firstVisibleScheduleReadyMs,
            });
        }

        if (previousWarmState && this._backgroundDebugState?.refreshId === previousWarmState.refreshId) {
            this._backgroundDebugState = null;
        }
    }

    private _startBackgroundWarmQueue(
        state: Omit<BackgroundWarmQueueState, 'cursor'>
    ): void {
        if (state.channels.length === 0) {
            return;
        }

        this._cancelBackgroundWarmQueue('replace-background-warm-queue');
        const queueState: BackgroundWarmQueueState = {
            ...state,
            cursor: 0,
        };
        this._backgroundWarmQueueState = queueState;

        const scheduleNextBatch = (): void => {
            if (this._backgroundWarmQueueState !== queueState) {
                return;
            }
            if (queueState.refreshId !== this._epgScheduleLoadToken) {
                this._cancelBackgroundWarmQueue('stale-refresh-token');
                return;
            }
            if (queueState.cursor >= queueState.channels.length) {
                this._cancelBackgroundWarmQueue('warm-queue-complete');
                return;
            }
            if (this._epgScheduleCache.size >= this._epgScheduleCacheMaxEntries) {
                this._cancelBackgroundWarmQueue('schedule-cache-cap-reached');
                return;
            }
            if (this._epgScheduleInFlight.size > queueState.concurrency * 2) {
                if (this._backgroundWarmQueueTimer) {
                    return;
                }
                this._backgroundWarmQueueTimer = setTimeout(() => {
                    this._backgroundWarmQueueTimer = null;
                    scheduleNextBatch();
                }, EPG_BACKGROUND_WARM_BACKPRESSURE_DELAY_MS);
                return;
            }

            const runBatch = async (): Promise<void> => {
                if (this._backgroundWarmQueueState !== queueState) {
                    return;
                }
                const batchSize = Math.max(1, queueState.concurrency * 2);
                const batch = queueState.channels.slice(queueState.cursor, queueState.cursor + batchSize);
                queueState.cursor += batch.length;
                if (batch.length === 0) {
                    this._cancelBackgroundWarmQueue('warm-queue-complete');
                    return;
                }

                let cursor = 0;
                const workers = Array.from(
                    { length: Math.min(queueState.concurrency, batch.length) },
                    async () => {
                        while (true) {
                            const channel = batch[cursor++];
                            if (!channel) return;
                            await queueState.runForChannel(channel);
                        }
                    }
                );
                await Promise.all(workers);
                scheduleNextBatch();
            };

            const runBatchSafe = (): void => {
                runBatch().catch((error: unknown) => {
                    if (isAbortLikeError(error)) return;
                    if (this._isDebugEnabled()) {
                        appendEpgDebugLog('EPG.backgroundWarmQueue.runBatch.error', {
                            error: summarizeErrorForLog(error),
                        });
                        return;
                    }
                    console.error('[EPG] background warm batch failed:', summarizeErrorForLog(error));
                });
            };

            const idleScheduler = globalThis as IdleSchedulerLike;
            if (typeof idleScheduler.requestIdleCallback === 'function') {
                this._backgroundWarmQueueIdleHandle = idleScheduler.requestIdleCallback((deadline) => {
                    this._backgroundWarmQueueIdleHandle = null;
                    if (this._backgroundWarmQueueState !== queueState) {
                        return;
                    }
                    if (!deadline.didTimeout && deadline.timeRemaining() < 4) {
                        scheduleNextBatch();
                        return;
                    }
                    runBatchSafe();
                }, { timeout: EPG_BACKGROUND_WARM_IDLE_TIMEOUT_MS });
                return;
            }

            this._backgroundWarmQueueTimer = setTimeout(() => {
                this._backgroundWarmQueueTimer = null;
                if (this._backgroundWarmQueueState !== queueState) {
                    return;
                }
                runBatchSafe();
            }, EPG_BACKGROUND_WARM_TIMER_DELAY_MS);
        };

        scheduleNextBatch();
    }

    private async _refreshEpgSchedulesForRange(
        range: { channelStart: number; channelEnd: number; timeStartMs: number; timeEndMs: number },
        reason: string
    ): Promise<void> {
        const refreshStartedAt = Date.now();
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

        const refreshId = ++this._epgScheduleLoadToken;
        this._cancelBackgroundWarmQueue('new-visible-range-request');
        const rangeKey = this._getScheduleRangeKey(startTime, endTime);
        const forceRefresh = reason === 'channel-setup' || reason === 'server-swap';
        if (forceRefresh) {
            this._clearScheduleCaches();
        }
        const shuffler = new ShuffleGenerator();
        const aggressive = this._isAggressivePreloadEnabled();
        this._epgScheduleCacheMaxEntries = this._computeScheduleCacheLimit(channels.length, aggressive);

        const liveChannelId = channelManager.getCurrentChannel()?.id ?? null;
        const epgState = epg.getState();
        const focusedChannelId = epgState.focusedCell
            ? channels[epgState.focusedCell.channelIndex]?.id ?? null
            : null;
        const visibleCount = Math.max(1, range.channelEnd - range.channelStart + 1);
        const backgroundCaps = this._getBackgroundWarmQueueCaps(channels.length, visibleCount, aggressive);
        const partitioned = this._partitionPrefetchChannels(
            channels,
            range,
            {
                liveChannelId,
                focusedChannelId,
            },
            {
                visibleCount,
                maxQueuedChannels: backgroundCaps.maxQueuedChannels,
                aggressive,
            }
        );
        const immediateChannels = partitioned.immediateChannels;
        const backgroundChannels = partitioned.backgroundChannels;
        const visibleStart = Math.max(0, Math.min(range.channelStart, channels.length - 1));
        const visibleEnd = Math.min(channels.length, range.channelEnd + 1);
        const visibleRangeIds = new Set(channels.slice(visibleStart, visibleEnd).map((channel) => channel.id));

        const neededIds = new Set(
            [...immediateChannels, ...backgroundChannels].map((channel) => channel.id)
        );
        const abortAll = reason === 'library-filter' || forceRefresh;
        const { kept: inFlightKept, aborted: inFlightAborted } = this._pruneInFlightSchedules(
            neededIds,
            rangeKey,
            abortAll
        );
        this._pruneScheduleCache(Date.now());

        const debugEnabled = this._isDebugEnabled();
        let cacheHits = 0;
        let staleCacheHits = 0;
        let cacheMisses = 0;
        let inFlightSkipped = 0;
        let alreadyLoaded = 0;
        let liveScheduleHits = 0;
        let immediateLoadedCount = 0;
        let backgroundLoadedCount = 0;
        let firstVisibleScheduleReadyMs: number | null = null;
        const immediateConcurrency = this._getScheduleLoadConcurrency(
            channels.length,
            immediateChannels.length,
            aggressive
        );

        if (debugEnabled && backgroundChannels.length > 0) {
            this._backgroundDebugState = {
                refreshId,
                rangeKey,
                refreshStartedAt,
                logCount: 0,
                immediateLoadedCount: 0,
                backgroundLoadedCount: 0,
                cacheHits: 0,
                cacheMisses: 0,
                firstVisibleScheduleReadyMs: null,
            };
        }

        const applySchedule = (
            channelId: string,
            schedule: ScheduleWindow,
            options?: { updateCache?: boolean; phase?: 'immediate' | 'background' }
        ): void => {
            const phase = options?.phase ?? 'immediate';
            const shouldApplyToUi = phase !== 'background';

            if (phase === 'background') {
                backgroundLoadedCount += 1;
            } else {
                immediateLoadedCount += 1;
            }

            if (shouldApplyToUi) {
                if (firstVisibleScheduleReadyMs === null && visibleRangeIds.has(channelId)) {
                    firstVisibleScheduleReadyMs = Date.now() - refreshStartedAt;
                }
                epg.loadScheduleForChannel(channelId, schedule);
            }
            if (phase === 'background' && debugEnabled && this._backgroundDebugState?.refreshId === refreshId) {
                const state = this._backgroundDebugState;
                state.immediateLoadedCount = immediateLoadedCount;
                state.backgroundLoadedCount = backgroundLoadedCount;
                state.cacheHits = cacheHits;
                state.cacheMisses = cacheMisses;
                state.firstVisibleScheduleReadyMs = firstVisibleScheduleReadyMs;
                state.logCount += 1;

                if (state.logCount % EPG_BACKGROUND_DEBUG_LOG_EVERY_N === 0) {
                    const cacheHitRatio = cacheHits / Math.max(1, cacheHits + cacheMisses);
                    appendEpgDebugLog('EPG.refreshEpgSchedulesForRange.background', {
                        refreshId,
                        rangeKey,
                        rangeRefreshDurationMs: Date.now() - refreshStartedAt,
                        immediateLoadedCount,
                        backgroundLoadedCount,
                        cacheHitRatio,
                        firstVisibleScheduleReadyMs,
                    });
                }
            }

            if (options?.updateCache === false) {
                return;
            }
            this._storeScheduleCache(channelId, rangeKey, schedule);
            if (shouldApplyToUi) {
                this._markScheduleLoaded(channelId, rangeKey);
            }
        };

        if (this._isDebugEnabled()) {
            const payload = {
                reason,
                refreshId,
                rangeKey,
                channelCount: channels.length,
                preloadCount: immediateChannels.length,
                warmQueueCount: backgroundChannels.length,
                liveChannelId,
                focusedChannelId,
                visibleRange: {
                    start: range.channelStart,
                    end: range.channelEnd,
                },
                bufferedRange: partitioned.bufferedRange,
                backgroundRange: partitioned.backgroundRange,
                overscan: partitioned.overscan,
                inFlight: {
                    kept: inFlightKept,
                    aborted: inFlightAborted,
                },
                concurrency: immediateConcurrency,
                backgroundConcurrency: backgroundCaps.maxConcurrency,
                cacheSize: this._epgScheduleCache.size,
                cacheMaxEntries: this._epgScheduleCacheMaxEntries,
            };
            appendEpgDebugLog('EPG.refreshEpgSchedulesForRange', payload);
        }

        const runForChannel = async (
            channel: ChannelConfig,
            phase: 'immediate' | 'background'
        ): Promise<void> => {
            if (refreshId !== this._epgScheduleLoadToken) {
                return;
            }
            if (!forceRefresh && this._isScheduleLoadedForRange(channel.id, rangeKey)) {
                alreadyLoaded += 1;
                return;
            }

            if (liveChannelId && channel.id === liveChannelId && scheduler) {
                const state = scheduler.getState();
                if (state.isActive && state.channelId === channel.id) {
                    const window = scheduler.getScheduleWindow(startTime, endTime);
                    applySchedule(channel.id, this._cloneScheduleWindow(window), { phase });
                    liveScheduleHits += 1;
                    return;
                }
            }

            const cached = forceRefresh ? null : this._getCachedSchedule(channel.id, rangeKey);
            if (cached) {
                const cachedSchedule = this._cloneScheduleWindow(cached.schedule);
                if (cached.isStale) {
                    applySchedule(channel.id, cachedSchedule, { updateCache: false, phase });
                    staleCacheHits += 1;
                } else {
                    cacheHits += 1;
                    applySchedule(channel.id, cachedSchedule, { phase });
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
                const items =
                    phase === 'background'
                        ? await channelManager.resolveChannelItemsForSchedule(channel.id, {
                            signal: controller.signal,
                        })
                        : (await channelManager.resolveChannelContent(channel.id, {
                            signal: controller.signal,
                        })).items;
                if (refreshId !== this._epgScheduleLoadToken) {
                    return;
                }
                const active = this._epgScheduleInFlight.get(channel.id);
                if (!active || active.controller !== controller || controller.signal.aborted) {
                    return;
                }

                const scheduleConfig = this.deps.buildDailyScheduleConfig(
                    channel,
                    items,
                    startTime
                );
                const index = ScheduleCalculator.buildScheduleIndex(scheduleConfig, shuffler);
                const programs = ScheduleCalculator.generateScheduleWindow(
                    startTime,
                    endTime,
                    index,
                    scheduleConfig.anchorTime
                );

                applySchedule(channel.id, { startTime, endTime, programs }, { phase });
            } catch (error) {
                if (isAbortLikeError(error, controller.signal)) {
                    return;
                }
                if (this._isDebugEnabled()) {
                    appendEpgDebugLog('EPG.refreshEpgSchedulesForRange.channelLoad.error', {
                        channelId: channel.id,
                        phase,
                        error: summarizeErrorForLog(error),
                    });
                }
            } finally {
                const active = this._epgScheduleInFlight.get(channel.id);
                if (active && active.controller === controller) {
                    this._epgScheduleInFlight.delete(channel.id);
                }
            }
        };

        let cursor = 0;
        const workers = Array.from({ length: immediateConcurrency }, async () => {
            while (true) {
                const channel = immediateChannels[cursor++];
                if (!channel) return;
                await runForChannel(channel, 'immediate');
            }
        });
        await Promise.all(workers);

        if (refreshId === this._epgScheduleLoadToken && backgroundChannels.length > 0) {
            this._startBackgroundWarmQueue({
                refreshId,
                reason,
                channels: backgroundChannels,
                runForChannel: (channel) => runForChannel(channel, 'background'),
                concurrency: Math.max(
                    1,
                    Math.min(backgroundCaps.maxConcurrency, backgroundChannels.length)
                ),
            });
        }

        if (this._isDebugEnabled()) {
            const rangeRefreshDurationMs = Date.now() - refreshStartedAt;
            const cacheHitRatio = cacheHits / Math.max(1, cacheHits + cacheMisses);
            const payload = {
                refreshId,
                rangeKey,
                rangeRefreshDurationMs,
                cacheHits,
                staleCacheHits,
                cacheMisses,
                cacheHitRatio,
                inFlightSkipped,
                alreadyLoaded,
                liveScheduleHits,
                immediateLoadedCount,
                backgroundLoadedCount,
                firstVisibleScheduleReadyMs,
                immediateCount: immediateChannels.length,
                backgroundQueuedCount: backgroundChannels.length,
                concurrency: immediateConcurrency,
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
            return localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_DEBUG) === '1';
        } catch {
            return false;
        }
    }
}
