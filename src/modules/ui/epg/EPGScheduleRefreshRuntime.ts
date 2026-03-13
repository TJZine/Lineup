import { ShuffleGenerator, ScheduleCalculator } from '../../scheduler/scheduler';
import type {
    ChannelConfig,
    IChannelManager,
    ResolvedChannelContent,
} from '../../scheduler/channel-manager';
import type {
    IChannelScheduler,
    ScheduleConfig,
    ScheduleWindow,
} from '../../scheduler/scheduler';
import type { IEPGComponent } from './interfaces';
import { computeBackgroundWarmQueueCaps, partitionPrefetchChannels } from './EPGCoordinatorPolicies';
import { isAbortLikeError, summarizeErrorForLog } from '../../../utils/errors';
import type { ModuleRuntimeStatus } from '../../../core/module-status';
import { EPGBackgroundWarmQueue } from './EPGBackgroundWarmQueue';
import { EPGScheduleCacheStore } from './EPGScheduleCacheStore';

const EPG_BACKGROUND_DEBUG_LOG_EVERY_N = 20;

type EpgUiStatus = ModuleRuntimeStatus | undefined;

type RangeRefreshRequest = {
    channelStart: number;
    channelEnd: number;
    timeStartMs: number;
    timeEndMs: number;
};

type BackgroundDebugState = {
    refreshId: number;
    rangeKey: string;
    refreshStartedAt: number;
    logCount: number;
    immediateLoadedCount: number;
    backgroundLoadedCount: number;
    cacheHits: number;
    cacheMisses: number;
    firstVisibleScheduleReadyMs: number | null;
};

export interface EPGScheduleRefreshRuntimeDeps {
    getEpg: () => IEPGComponent | null;
    getChannelManager: () => IChannelManager | null;
    getScheduler: () => IChannelScheduler | null;
    getEpgUiStatus: () => EpgUiStatus;
    getEpgScheduleRangeMs: () => { startTime: number; endTime: number } | null;
    getLibraryFilterState: (allChannels: ChannelConfig[]) => {
        selectedId: string | null;
        shouldFilter: boolean;
    };
    getVisibleChannels: (
        allChannels: ChannelConfig[],
        selectedId: string | null,
        shouldFilter: boolean
    ) => ChannelConfig[];
    buildDailyScheduleConfig: (
        channel: ChannelConfig,
        items: ResolvedChannelContent['items'],
        referenceTimeMs: number
    ) => ScheduleConfig;
    computeScheduleCacheLimit: (channelCount: number, aggressive: boolean) => number;
    getScheduleLoadConcurrency: (
        channelCount: number,
        prefetchCount: number,
        aggressive: boolean
    ) => number;
    cloneScheduleWindow: (window: ScheduleWindow) => ScheduleWindow;
    isAggressivePreloadEnabled: () => boolean;
    isDebugEnabled: () => boolean;
    appendDebugLog: (event: string, payload: Record<string, unknown>) => void;
}

export class EPGScheduleRefreshRuntime {
    private _scheduleLoadToken = 0;
    private _inFlightByChannel = new Map<string, { controller: AbortController; rangeKey: string }>();
    private readonly _cacheStore = new EPGScheduleCacheStore();
    private readonly _warmQueue: EPGBackgroundWarmQueue;
    private _backgroundDebugState: BackgroundDebugState | null = null;

    constructor(private readonly _deps: EPGScheduleRefreshRuntimeDeps) {
        this._warmQueue = new EPGBackgroundWarmQueue({
            getActiveRefreshId: (): number => this._scheduleLoadToken,
            getCacheSize: (): number => this._cacheStore.getSize(),
            getCacheLimit: (): number => this._cacheStore.getMaxEntries(),
            getInFlightCount: (): number => this._inFlightByChannel.size,
            onCancel: (reason, previousState): void => {
                if (this._deps.isDebugEnabled()) {
                    this._deps.appendDebugLog('EPG.backgroundWarmQueue.cancel', { reason });
                }

                if (
                    previousState &&
                    this._backgroundDebugState &&
                    this._backgroundDebugState.refreshId === previousState.refreshId &&
                    reason === 'warm-queue-complete' &&
                    this._deps.isDebugEnabled()
                ) {
                    const cacheHitRatio =
                        this._backgroundDebugState.cacheHits /
                        Math.max(1, this._backgroundDebugState.cacheHits + this._backgroundDebugState.cacheMisses);
                    this._deps.appendDebugLog('EPG.refreshEpgSchedulesForRange.background', {
                        refreshId: this._backgroundDebugState.refreshId,
                        rangeKey: this._backgroundDebugState.rangeKey,
                        rangeRefreshDurationMs: Date.now() - this._backgroundDebugState.refreshStartedAt,
                        immediateLoadedCount: this._backgroundDebugState.immediateLoadedCount,
                        backgroundLoadedCount: this._backgroundDebugState.backgroundLoadedCount,
                        cacheHitRatio,
                        firstVisibleScheduleReadyMs: this._backgroundDebugState.firstVisibleScheduleReadyMs,
                    });
                }

                if (
                    previousState &&
                    this._backgroundDebugState &&
                    this._backgroundDebugState.refreshId === previousState.refreshId
                ) {
                    this._backgroundDebugState = null;
                }
            },
            onError: (error: unknown): void => {
                if (isAbortLikeError(error)) {
                    return;
                }
                if (this._deps.isDebugEnabled()) {
                    this._deps.appendDebugLog('EPG.backgroundWarmQueue.runBatch.error', {
                        error: summarizeErrorForLog(error),
                    });
                    return;
                }
                console.error('[EPG] background warm batch failed:', summarizeErrorForLog(error));
            },
        });
    }

    clearScheduleCaches(): void {
        this._warmQueue.cancel('clear-schedule-caches');
        this._cacheStore.clearScheduleCaches();
    }

    clearLoadedScheduleMarkers(): void {
        this._cacheStore.clearLoadedSchedules();
    }

    cancelBackgroundWarmQueue(reason: string): void {
        this._warmQueue.cancel(reason);
    }

    abortAllInFlightSchedules(reason = 'abort-all-inflight'): void {
        this._warmQueue.cancel(reason);
        for (const entry of this._inFlightByChannel.values()) {
            entry.controller.abort();
        }
        this._inFlightByChannel.clear();
    }

    cacheScheduleForRange(
        channelId: string,
        startTime: number,
        endTime: number,
        schedule: ScheduleWindow
    ): void {
        const rangeKey = this._getScheduleRangeKey(startTime, endTime);
        this._cacheStore.markScheduleLoaded(channelId, rangeKey);
        this._cacheStore.storeSchedule(channelId, rangeKey, schedule);
    }

    async refreshForRange(range: RangeRefreshRequest, reason: string): Promise<void> {
        const refreshStartedAt = Date.now();
        const epg = this._deps.getEpg();
        const channelManager = this._deps.getChannelManager();
        const scheduler = this._deps.getScheduler();
        if (!epg || !channelManager) return;
        if (this._deps.getEpgUiStatus() !== 'ready') return;

        const scheduleRange = this._deps.getEpgScheduleRangeMs();
        if (!scheduleRange) return;

        const { startTime, endTime } = scheduleRange;
        epg.setGridAnchorTime(startTime);

        const allChannels = channelManager.getAllChannels();
        const { selectedId, shouldFilter } = this._deps.getLibraryFilterState(allChannels);
        const channels = this._deps.getVisibleChannels(allChannels, selectedId, shouldFilter);
        if (channels.length === 0) {
            return;
        }

        const refreshId = ++this._scheduleLoadToken;
        this._warmQueue.cancel('new-visible-range-request');

        const rangeKey = this._getScheduleRangeKey(startTime, endTime);
        const forceRefresh = reason === 'channel-setup' || reason === 'server-swap';
        if (forceRefresh) {
            this.clearScheduleCaches();
        }

        const shuffler = new ShuffleGenerator();
        const aggressive = this._deps.isAggressivePreloadEnabled();
        this._cacheStore.setMaxEntries(this._deps.computeScheduleCacheLimit(channels.length, aggressive));

        const liveChannelId = channelManager.getCurrentChannel()?.id ?? null;
        const epgState = epg.getState();
        const focusedChannelId = epgState.focusedCell
            ? channels[epgState.focusedCell.channelIndex]?.id ?? null
            : null;
        const visibleCount = Math.max(1, range.channelEnd - range.channelStart + 1);
        const backgroundCaps = computeBackgroundWarmQueueCaps(channels.length, visibleCount, aggressive);
        const partitioned = partitionPrefetchChannels(
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

        const neededIds = new Set([...immediateChannels, ...backgroundChannels].map((channel) => channel.id));
        const abortAll = reason === 'library-filter' || forceRefresh;
        const { kept: inFlightKept, aborted: inFlightAborted } = this._pruneInFlightSchedules(
            neededIds,
            rangeKey,
            abortAll
        );
        this._cacheStore.prune(Date.now());

        const debugEnabled = this._deps.isDebugEnabled();
        let cacheHits = 0;
        let staleCacheHits = 0;
        let cacheMisses = 0;
        let inFlightSkipped = 0;
        let alreadyLoaded = 0;
        let liveScheduleHits = 0;
        let immediateLoadedCount = 0;
        let backgroundLoadedCount = 0;
        let firstVisibleScheduleReadyMs: number | null = null;
        const immediateConcurrency = this._deps.getScheduleLoadConcurrency(
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
                const debugState = this._backgroundDebugState;
                debugState.immediateLoadedCount = immediateLoadedCount;
                debugState.backgroundLoadedCount = backgroundLoadedCount;
                debugState.cacheHits = cacheHits;
                debugState.cacheMisses = cacheMisses;
                debugState.firstVisibleScheduleReadyMs = firstVisibleScheduleReadyMs;
                debugState.logCount += 1;

                if (debugState.logCount % EPG_BACKGROUND_DEBUG_LOG_EVERY_N === 0) {
                    const cacheHitRatio = cacheHits / Math.max(1, cacheHits + cacheMisses);
                    this._deps.appendDebugLog('EPG.refreshEpgSchedulesForRange.background', {
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

            this._cacheStore.storeSchedule(channelId, rangeKey, schedule);
            if (shouldApplyToUi) {
                this._cacheStore.markScheduleLoaded(channelId, rangeKey);
            }
        };

        if (debugEnabled) {
            this._deps.appendDebugLog('EPG.refreshEpgSchedulesForRange', {
                reason,
                refreshId,
                rangeKey,
                channelCount: channels.length,
                preloadCount: immediateChannels.length,
                warmQueueCount: backgroundChannels.length,
                liveChannelId,
                focusedChannelId,
                visibleRange: { start: range.channelStart, end: range.channelEnd },
                bufferedRange: partitioned.bufferedRange,
                backgroundRange: partitioned.backgroundRange,
                overscan: partitioned.overscan,
                inFlight: { kept: inFlightKept, aborted: inFlightAborted },
                concurrency: immediateConcurrency,
                backgroundConcurrency: backgroundCaps.maxConcurrency,
                cacheSize: this._cacheStore.getSize(),
                cacheMaxEntries: this._cacheStore.getMaxEntries(),
            });
        }

        const runForChannel = async (
            channel: ChannelConfig,
            phase: 'immediate' | 'background'
        ): Promise<void> => {
            if (refreshId !== this._scheduleLoadToken) {
                return;
            }

            if (!forceRefresh && this._cacheStore.isScheduleLoadedForRange(channel.id, rangeKey)) {
                alreadyLoaded += 1;
                return;
            }

            if (liveChannelId && channel.id === liveChannelId && scheduler) {
                const schedulerState = scheduler.getState();
                if (schedulerState.isActive && schedulerState.channelId === channel.id) {
                    const liveWindow = scheduler.getScheduleWindow(startTime, endTime);
                    applySchedule(channel.id, this._deps.cloneScheduleWindow(liveWindow), { phase });
                    liveScheduleHits += 1;
                    return;
                }
            }

            const cached = forceRefresh ? null : this._cacheStore.getCachedSchedule(channel.id, rangeKey);
            if (cached) {
                const cachedSchedule = this._deps.cloneScheduleWindow(cached.schedule);
                if (cached.isStale) {
                    applySchedule(channel.id, cachedSchedule, { updateCache: false, phase });
                    staleCacheHits += 1;
                } else {
                    cacheHits += 1;
                    applySchedule(channel.id, cachedSchedule, { phase });
                    return;
                }
            }

            const existing = this._inFlightByChannel.get(channel.id);
            if (existing && existing.rangeKey === rangeKey) {
                inFlightSkipped += 1;
                return;
            }
            if (existing) {
                existing.controller.abort();
                this._inFlightByChannel.delete(channel.id);
            }

            const controller = new AbortController();
            this._inFlightByChannel.set(channel.id, { controller, rangeKey });
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
                if (refreshId !== this._scheduleLoadToken) {
                    return;
                }
                const active = this._inFlightByChannel.get(channel.id);
                if (!active || active.controller !== controller || controller.signal.aborted) {
                    return;
                }

                const scheduleConfig = this._deps.buildDailyScheduleConfig(channel, items, startTime);
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
                if (debugEnabled) {
                    this._deps.appendDebugLog('EPG.refreshEpgSchedulesForRange.channelLoad.error', {
                        channelId: channel.id,
                        phase,
                        error: summarizeErrorForLog(error),
                    });
                }
            } finally {
                const active = this._inFlightByChannel.get(channel.id);
                if (active && active.controller === controller) {
                    this._inFlightByChannel.delete(channel.id);
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

        if (refreshId === this._scheduleLoadToken && backgroundChannels.length > 0) {
            this._warmQueue.start({
                refreshId,
                reason,
                channels: backgroundChannels,
                runForChannel: (channel) => runForChannel(channel, 'background'),
                concurrency: Math.max(1, Math.min(backgroundCaps.maxConcurrency, backgroundChannels.length)),
            });
        }

        if (debugEnabled) {
            const rangeRefreshDurationMs = Date.now() - refreshStartedAt;
            const cacheHitRatio = cacheHits / Math.max(1, cacheHits + cacheMisses);
            this._deps.appendDebugLog('EPG.refreshEpgSchedulesForRange.results', {
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
                cacheSize: this._cacheStore.getSize(),
                cacheMaxEntries: this._cacheStore.getMaxEntries(),
            });
        }

        const focusedProgram = epg.getFocusedProgram();
        const focusedCell = epg.getState().focusedCell;
        const focusedIsPlaceholder = focusedCell?.kind === 'placeholder';
        const focusedIsInvalidProgram = focusedProgram
            ? focusedProgram.scheduleIndex === -1 || focusedProgram.item.ratingKey.includes('-placeholder-')
            : false;

        if (
            refreshId === this._scheduleLoadToken &&
            epg.isVisible() &&
            (!focusedProgram || focusedIsPlaceholder || focusedIsInvalidProgram)
        ) {
            epg.focusNow();
        }
    }

    private _getScheduleRangeKey(startTime: number, endTime: number): string {
        return `${startTime}-${endTime}`;
    }

    private _pruneInFlightSchedules(
        keepIds: Set<string>,
        rangeKey: string,
        abortAll: boolean
    ): { kept: number; aborted: number } {
        let kept = 0;
        let aborted = 0;
        for (const [channelId, entry] of this._inFlightByChannel) {
            if (abortAll || entry.rangeKey !== rangeKey || !keepIds.has(channelId)) {
                entry.controller.abort();
                this._inFlightByChannel.delete(channelId);
                aborted += 1;
            } else {
                kept += 1;
            }
        }
        return { kept, aborted };
    }
}
