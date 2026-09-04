import {
    ShuffleGenerator,
    buildScheduleIndex,
    generateScheduleWindow,
} from '../../../scheduler/scheduler';
import type {
    ChannelConfig,
    IChannelManager,
    ResolvedChannelContent,
} from '../../../scheduler/channel-manager';
import type {
    IChannelScheduler,
    ScheduleConfig,
    ScheduleWindow,
} from '../../../scheduler/scheduler';
import type { AppendIssueDiagnostic } from '../../../debug/IssueDiagnosticsStore';
import type { IEPGComponent } from '../interfaces';
import { computeBackgroundWarmQueueCaps, partitionPrefetchChannels } from '../coordinator/EPGCoordinatorPolicies';
import { isAbortLikeError } from '../../../../utils/errors';
import { EPGBackgroundWarmQueue } from './EPGBackgroundWarmQueue';
import { EPGScheduleCacheStore } from './EPGScheduleCacheStore';
import { buildRefreshResult, createRefreshMetrics, markFastReadyChannel } from './EPGScheduleRefreshMetrics';
import { throwIfEpgRefreshAborted } from './EPGRefreshAbort';
import { createEpgRetainedOperationContext } from './EPGRetainedOperationContext';
import type { EpgRetainedOperationContext } from './EPGRetainedOperationContext';
import {
    assertEpgRefreshSessionCurrent,
    runIfEpgRefreshCurrent,
} from './EPGScheduleRefreshCurrentness';
import {
    cloneEpgResolvedItems,
    getEpgLocalDayKey,
    getEpgScheduleRangeKey,
    reportEpgBackgroundWarmQueueFailure,
} from './EPGScheduleRefreshUtilities';
import { startRetainedEpgBackgroundRefresh } from './EPGBackgroundRefreshLease';
import { toEpgScheduleWindow } from '../model/adapters';
import type {
    EpgScheduleRefreshResult,
    EpgGuideSelectionSnapshot,
    EpgUiStatus,
    GuideSelectionSnapshotRequest,
} from '../coordinator/EPGCoordinatorContracts';
import type { EpgVisibleRange } from '../types';
import type {
    AppliedScheduleSource,
    BackgroundDebugState,
    RefreshMetrics,
    RefreshPhase,
    RefreshSession,
    ScheduleCachePolicy,
    ScheduleDiagnosticCacheOutcome,
    ScheduleDiagnosticFailureStage,
    ScheduleDiagnosticInvalidation,
    SelectedRowSnapshotSeed,
} from './EPGScheduleRefreshRuntimeTypes';
import {
    createSkippedEpgScheduleRefreshResult,
    createSupersededEpgScheduleRefreshResult,
} from '../../../../shared/epgRefresh';

const EPG_BACKGROUND_DEBUG_LOG_EVERY_N = 20;
const QA_003B_ISSUE_ID = 'QA-003b';

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
    appendIssueDiagnostic: AppendIssueDiagnostic;
}

export class EPGScheduleRefreshRuntime {
    private _scheduleLoadToken = 0;
    private _inFlightByChannel = new Map<string, {
        controller: AbortController;
        refreshId: number;
        phase: RefreshPhase;
        rowOrdinal: number | null;
        startedAt: number;
        cacheOutcome: ScheduleDiagnosticCacheOutcome;
    }>();
    private readonly _cacheStore = new EPGScheduleCacheStore();
    private readonly _warmQueue: EPGBackgroundWarmQueue;
    private _backgroundDebugState: BackgroundDebugState | null = null;
    private _selectedRowSnapshotSeed: SelectedRowSnapshotSeed | null = null;

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
                        errorKind: 'non-abort',
                    });
                }
                reportEpgBackgroundWarmQueueFailure(this._deps.appendIssueDiagnostic, { phase: 'background' });
            },
        });
    }

    clearScheduleCaches(): void {
        this._warmQueue.cancel('clear-schedule-caches');
        this._cacheStore.clearScheduleCaches();
        this._selectedRowSnapshotSeed = null;
    }

    clearLoadedScheduleMarkers(): void {
        this._cacheStore.clearLoadedSchedules();
    }

    clearSelectedChannelScheduleSnapshot(): void {
        this._selectedRowSnapshotSeed = null;
    }

    async buildGuideSelectionSnapshot(
        request: GuideSelectionSnapshotRequest,
        signal?: AbortSignal | null
    ): Promise<EpgGuideSelectionSnapshot | null> {
        if (signal?.aborted) {
            return null;
        }
        const channelManager = this._deps.getChannelManager();
        if (!channelManager) {
            return null;
        }

        const dayKey = getEpgLocalDayKey(request.selectedAt);
        const seed = this._selectedRowSnapshotSeed;
        if (
            seed &&
            seed.channelId === request.channelId &&
            seed.source === 'resolved-immediate' &&
            seed.dayKey === dayKey &&
            seed.orderedItems.some((item) => item.ratingKey === request.ratingKey)
        ) {
            this._selectedRowSnapshotSeed = null;
            return {
                channelId: request.channelId,
                ratingKey: request.ratingKey,
                scheduledStartTime: request.scheduledStartTime,
                scheduledEndTime: request.scheduledEndTime,
                source: 'resolved-immediate',
                referenceTimeMs: seed.referenceTimeMs,
                dayKey: seed.dayKey,
                orderedItems: cloneEpgResolvedItems(seed.orderedItems),
            };
        }

        let orderedItems: ResolvedChannelContent['items'];
        try {
            orderedItems = await channelManager.resolveChannelItemsForSchedule(request.channelId, {
                signal: signal ?? null,
            });
        } catch (error: unknown) {
            if (isAbortLikeError(error, signal ?? undefined)) {
                return null;
            }
            throw error;
        }
        if (signal?.aborted) {
            return null;
        }
        if (!orderedItems.some((item) => item.ratingKey === request.ratingKey)) {
            return null;
        }

        return {
            channelId: request.channelId,
            ratingKey: request.ratingKey,
            scheduledStartTime: request.scheduledStartTime,
            scheduledEndTime: request.scheduledEndTime,
            source: 'on-demand-materialized',
            referenceTimeMs: request.selectedAt,
            dayKey,
            orderedItems: cloneEpgResolvedItems(orderedItems),
        };
    }

    cancelBackgroundWarmQueue(reason: string): void {
        this._warmQueue.cancel(reason);
    }

    dispose(reason = 'shutdown'): void {
        this._invalidateRefreshWork(reason, { abortInFlight: true });
    }

    abortAllInFlightSchedules(reason = 'abort-all-inflight'): void {
        this.dispose(reason);
    }

    /**
     * Wait for the background warm queue to drain.
     * Immediate visible-channel loads are settled by refreshForRange().
     */
    async whenBackgroundRefreshIdle(): Promise<void> {
        await this._warmQueue.whenIdle();
    }

    async refreshForRange(
        range: EpgVisibleRange,
        reason: string,
        options?: { signal?: AbortSignal | null; operationContext?: EpgRetainedOperationContext }
    ): Promise<EpgScheduleRefreshResult> {
        const signal = options?.signal ?? null;
        throwIfEpgRefreshAborted(signal);
        const operation = options?.operationContext
            ? options.operationContext.retain('schedule-refresh')
            : createEpgRetainedOperationContext([]);
        let cleanup = (): void => undefined;

        try {
            operation.assertCurrent();
            const session = this._createRefreshSession(range, reason, signal, operation);
            if (!session) {
                return createSkippedEpgScheduleRefreshResult();
            }
            cleanup = this._bindRefreshAbort(session);
            const metrics = createRefreshMetrics();
            runIfEpgRefreshCurrent(session, () => this._reportRefreshStarted(session));
            runIfEpgRefreshCurrent(session, () => this._initializeBackgroundDebugState(session));
            runIfEpgRefreshCurrent(session, () => this._logRefreshStart(session));
            await this._refreshImmediateChannels(session, metrics);
            assertEpgRefreshSessionCurrent(session);
            if (!this._isRefreshSessionActive(session)) {
                return createSupersededEpgScheduleRefreshResult();
            }
            this._startBackgroundRefresh(session, metrics);
            runIfEpgRefreshCurrent(session, () => this._logRefreshResults(session, metrics));
            runIfEpgRefreshCurrent(session, () => this._restoreFocusAfterRefresh(session));
            const result = runIfEpgRefreshCurrent(session, () => buildRefreshResult(session, metrics));
            runIfEpgRefreshCurrent(session, () => this._reportRefreshSettled(session, metrics, result));
            return result;
        } finally {
            try {
                cleanup();
            } finally {
                operation.release();
            }
        }
    }

    private _createRefreshSession(
        range: EpgVisibleRange,
        reason: string,
        signal: AbortSignal | null,
        operation: EpgRetainedOperationContext
    ): RefreshSession | null {
        const refreshStartedAt = Date.now();
        const epg = this._deps.getEpg();
        const channelManager = this._deps.getChannelManager();
        const scheduler = this._deps.getScheduler();
        if (!epg || !channelManager) {
            return null;
        }
        if (this._deps.getEpgUiStatus() !== 'ready') {
            return null;
        }

        const scheduleRange = this._deps.getEpgScheduleRangeMs();
        if (!scheduleRange) {
            return null;
        }

        const { startTime, endTime } = scheduleRange;
        operation.assertCurrent();
        epg.setGridAnchorTime(startTime);
        operation.assertCurrent();

        const allChannels = channelManager.getAllChannels();
        const { selectedId, shouldFilter } = this._deps.getLibraryFilterState(allChannels);
        const channels = this._deps.getVisibleChannels(allChannels, selectedId, shouldFilter);
        if (channels.length === 0) {
            operation.assertCurrent();
            this._invalidateRefreshWork('no-visible-channels', { abortInFlight: true });
            operation.assertCurrent();
            return null;
        }

        operation.assertCurrent();
        const refreshId = ++this._scheduleLoadToken;
        operation.assertCurrent();
        this._warmQueue.cancel('new-visible-range-request');
        operation.assertCurrent();

        const rangeKey = getEpgScheduleRangeKey(startTime, endTime);
        const forceRefresh = reason === 'channel-setup' || reason === 'server-swap';
        if (forceRefresh) {
            operation.assertCurrent();
            this.clearScheduleCaches();
            operation.assertCurrent();
        }

        const aggressive = this._deps.isAggressivePreloadEnabled() || reason === 'server-swap';
        operation.assertCurrent();
        this._cacheStore.setMaxEntries(this._deps.computeScheduleCacheLimit(channels.length, aggressive));
        operation.assertCurrent();

        const liveChannelId = channelManager.getCurrentChannel()?.id ?? null;
        const epgState = epg.getState();
        const focusedChannelId = epgState.focusedCell
            ? channels[epgState.focusedCell.channelIndex]?.id ?? null
            : null;
        const visibleCount = Math.max(1, range.channelEndExclusive - range.channelStart);
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

        const visibleStart = Math.max(0, Math.min(range.channelStart, channels.length - 1));
        const visibleEnd = Math.min(channels.length, range.channelEndExclusive);
        const visibleRangeIds = new Set(channels.slice(visibleStart, visibleEnd).map((channel) => channel.id));
        const channelOrdinals = new Map(channels.map((channel, ordinal) => [channel.id, ordinal]));
        operation.assertCurrent();
        this._selectedRowSnapshotSeed = null;
        operation.assertCurrent();

        // Every new session invalidates the previous session token, so retaining
        // any of its promises would leave work that can no longer apply or cache.
        operation.assertCurrent();
        const inFlightAborted = this._abortSupersededInFlightSchedules();
        this._cacheStore.prune(Date.now());
        operation.assertCurrent();

        return {
            refreshId,
            failurePublicationToken: refreshId,
            reason,
            refreshStartedAt,
            range,
            signal,
            operation,
            epg,
            channelManager,
            scheduler,
            startTime,
            endTime,
            rangeKey,
            forceRefresh,
            debugEnabled: this._deps.isDebugEnabled(),
            shuffler: new ShuffleGenerator(),
            liveChannelId,
            focusedChannelId,
            visibleRangeIds,
            channelOrdinals,
            immediateChannels: partitioned.immediateChannels,
            backgroundChannels: partitioned.backgroundChannels,
            immediateConcurrency: this._deps.getScheduleLoadConcurrency(
                channels.length,
                partitioned.immediateChannels.length,
                aggressive
            ),
            backgroundConcurrency: Math.max(
                1,
                Math.min(backgroundCaps.maxConcurrency, partitioned.backgroundChannels.length)
            ),
            inFlightAborted,
            bufferedRange: partitioned.bufferedRange,
            backgroundRange: partitioned.backgroundRange,
            overscan: partitioned.overscan,
        };
    }

    private _initializeBackgroundDebugState(session: RefreshSession): void {
        if (!session.debugEnabled || session.backgroundChannels.length === 0) {
            return;
        }

        this._backgroundDebugState = {
            refreshId: session.refreshId,
            rangeKey: session.rangeKey,
            refreshStartedAt: session.refreshStartedAt,
            logCount: 0,
            immediateLoadedCount: 0,
            backgroundLoadedCount: 0,
            cacheHits: 0,
            cacheMisses: 0,
            firstVisibleScheduleReadyMs: null,
        };
    }

    private _logRefreshStart(session: RefreshSession): void {
        if (!session.debugEnabled) {
            return;
        }

        this._deps.appendDebugLog('EPG.refreshEpgSchedulesForRange', {
            reason: session.reason,
            refreshId: session.refreshId,
            rangeKey: session.rangeKey,
            channelCount: session.immediateChannels.length + session.backgroundChannels.length,
            preloadCount: session.immediateChannels.length,
            warmQueueCount: session.backgroundChannels.length,
            visibleRange: {
                start: session.range.channelStart,
                endExclusive: session.range.channelEndExclusive,
            },
            bufferedRange: session.bufferedRange,
            backgroundRange: session.backgroundRange,
            overscan: session.overscan,
            inFlight: { aborted: session.inFlightAborted },
            concurrency: session.immediateConcurrency,
            backgroundConcurrency: session.backgroundConcurrency,
            cacheSize: this._cacheStore.getSize(),
            cacheMaxEntries: this._cacheStore.getMaxEntries(),
        });
    }

    private _reportRefreshStarted(session: RefreshSession): void {
        this._deps.appendIssueDiagnostic(QA_003B_ISSUE_ID, 'epg.scheduleRefresh.started', {
            refreshId: session.refreshId,
            phase: 'immediate',
            visibleRange: {
                startOrdinal: Math.max(0, session.range.channelStart),
                endExclusiveOrdinal: Math.max(0, session.range.channelEndExclusive),
            },
            visibleChannelCount: session.visibleRangeIds.size,
            immediateChannelCount: session.immediateChannels.length,
            backgroundChannelCount: session.backgroundChannels.length,
            supersededInFlightCount: session.inFlightAborted,
        });
    }

    private _reportRefreshSettled(
        session: RefreshSession,
        metrics: RefreshMetrics,
        result: EpgScheduleRefreshResult
    ): void {
        this._deps.appendIssueDiagnostic(QA_003B_ISSUE_ID, 'epg.scheduleRefresh.settled', {
            refreshId: session.refreshId,
            phase: 'immediate',
            elapsedMs: Date.now() - session.refreshStartedAt,
            readiness: result.readiness,
            visibleChannelCount: session.visibleRangeIds.size,
            immediateChannelCount: session.immediateChannels.length,
            backgroundChannelCount: session.backgroundChannels.length,
            immediateReadyChannelCount: result.immediateReadyChannelCount,
            failedChannelCount: metrics.failedChannelCount,
            networkRequestCount: metrics.cacheMisses,
            loadedMarkerCount: metrics.alreadyLoaded,
            freshCacheHitCount: metrics.cacheHits,
            staleCacheHitCount: metrics.staleCacheHits,
            liveSchedulerHitCount: metrics.liveScheduleHits,
            focusKind: session.epg.getState().focusedCell?.kind ?? 'absent',
        });
    }

    private _reportRowFailure(
        session: RefreshSession,
        channelId: string,
        phase: RefreshPhase,
        cacheOutcome: ScheduleDiagnosticCacheOutcome,
        networkStarted: boolean,
        startedAt: number,
        failureStage: ScheduleDiagnosticFailureStage
    ): void {
        runIfEpgRefreshCurrent(session, () => this._deps.appendIssueDiagnostic(
            QA_003B_ISSUE_ID,
            'epg.scheduleRow.settled',
            {
                refreshId: session.refreshId,
                phase,
                rowOrdinal: session.channelOrdinals.get(channelId) ?? -1,
                attemptCount: networkStarted ? 1 : 0,
                networkStarted,
                status: 'failure',
                cacheOutcome,
                failureStage,
                errorKind: 'non-abort',
                elapsedMs: Date.now() - startedAt,
            }
        ));
    }

    private _applySchedule(
        session: RefreshSession,
        metrics: RefreshMetrics,
        channelId: string,
        schedule: ScheduleWindow,
        options?: {
            cachePolicy?: ScheduleCachePolicy;
            phase?: RefreshPhase;
            source?: AppliedScheduleSource;
            materializationSeed?: ResolvedChannelContent['items'];
        }
    ): void {
        if (!this._isRefreshSessionActive(session)) return;
        const phase = options?.phase ?? 'immediate';
        const shouldApplyToUi = phase !== 'background';

        assertEpgRefreshSessionCurrent(session);
        if (phase === 'background') {
            metrics.backgroundLoadedCount = metrics.backgroundLoadedChannelIds.add(channelId).size;
        } else {
            metrics.immediateLoadedCount = metrics.immediateReadyChannelIds.add(channelId).size;
        }
        assertEpgRefreshSessionCurrent(session);

        if (shouldApplyToUi) {
            const now = Date.now();
            if (
                session.focusedChannelId &&
                channelId === session.focusedChannelId &&
                options?.source === 'resolved-immediate' &&
                options.materializationSeed
            ) {
                this._selectedRowSnapshotSeed = {
                    channelId,
                    source: 'resolved-immediate',
                    dayKey: getEpgLocalDayKey(now),
                    referenceTimeMs: now,
                    orderedItems: cloneEpgResolvedItems(options.materializationSeed),
                };
            }
            if (metrics.firstVisibleScheduleReadyMs === null && session.visibleRangeIds.has(channelId)) {
                metrics.firstVisibleScheduleReadyMs = Date.now() - session.refreshStartedAt;
            }
            runIfEpgRefreshCurrent(session, () =>
                session.epg.loadScheduleForChannel(channelId, toEpgScheduleWindow(schedule)));
        }

        if (phase === 'background') {
            runIfEpgRefreshCurrent(session, () => this._syncBackgroundDebugState(session, metrics));
        }

        if ((options?.cachePolicy ?? 'persist') === 'skip') {
            return;
        }

        runIfEpgRefreshCurrent(session, () => this._cacheStore.storeSchedule(channelId, session.rangeKey, schedule));
        if (shouldApplyToUi) {
            runIfEpgRefreshCurrent(session, () =>
                this._cacheStore.markScheduleLoaded(channelId, session.rangeKey));
        }
    }

    private _syncBackgroundDebugState(session: RefreshSession, metrics: RefreshMetrics): void {
        if (!session.debugEnabled || this._backgroundDebugState?.refreshId !== session.refreshId) {
            return;
        }

        const debugState = this._backgroundDebugState;
        debugState.immediateLoadedCount = metrics.immediateLoadedCount;
        debugState.backgroundLoadedCount = metrics.backgroundLoadedCount;
        debugState.cacheHits = metrics.cacheHits;
        debugState.cacheMisses = metrics.cacheMisses;
        debugState.firstVisibleScheduleReadyMs = metrics.firstVisibleScheduleReadyMs;
        debugState.logCount += 1;

        if (debugState.logCount % EPG_BACKGROUND_DEBUG_LOG_EVERY_N !== 0) {
            return;
        }

        const cacheHitRatio = metrics.cacheHits / Math.max(1, metrics.cacheHits + metrics.cacheMisses);
        this._deps.appendDebugLog('EPG.refreshEpgSchedulesForRange.background', {
            refreshId: session.refreshId,
            rangeKey: session.rangeKey,
            rangeRefreshDurationMs: Date.now() - session.refreshStartedAt,
            immediateLoadedCount: metrics.immediateLoadedCount,
            backgroundLoadedCount: metrics.backgroundLoadedCount,
            cacheHitRatio,
            firstVisibleScheduleReadyMs: metrics.firstVisibleScheduleReadyMs,
        });
    }

    private async _refreshChannelSchedule(
        session: RefreshSession,
        metrics: RefreshMetrics,
        channel: ChannelConfig,
        phase: RefreshPhase
    ): Promise<void> {
        if (session.refreshId !== this._scheduleLoadToken) {
            return;
        }

        let controller: AbortController | null = null;
        let requestStartedAt = session.refreshStartedAt;
        let cacheOutcome: ScheduleDiagnosticCacheOutcome = 'not-checked';
        let failureStage: ScheduleDiagnosticFailureStage = 'live-scheduler';

        try {
            if (session.liveChannelId && channel.id === session.liveChannelId && session.scheduler) {
                const schedulerState = session.scheduler.getState();
                if (schedulerState.isActive && schedulerState.channelId === channel.id) {
                    const liveWindow = session.scheduler.getScheduleWindow(session.startTime, session.endTime);
                    const liveSchedule = this._deps.cloneScheduleWindow(liveWindow);
                    if (!this._isRefreshSessionActive(session)) {
                        return;
                    }
                    this._applySchedule(session, metrics, channel.id, liveSchedule, {
                        cachePolicy: 'skip',
                        phase,
                        source: 'live-scheduler',
                    });
                    metrics.liveScheduleHits += 1;
                    return;
                }
            }

            failureStage = 'cache';
            cacheOutcome = 'miss';
            if (!session.forceRefresh && this._cacheStore.isScheduleLoadedForRange(channel.id, session.rangeKey)) {
                metrics.alreadyLoaded += 1;
                markFastReadyChannel(session, metrics, channel.id, phase);
                return;
            }

            const cached = session.forceRefresh ? null : this._cacheStore.getCachedSchedule(channel.id, session.rangeKey);
            if (cached) {
                cacheOutcome = cached.isStale ? 'stale-hit' : 'fresh-hit';
                const cachedSchedule = this._deps.cloneScheduleWindow(cached.schedule);
                if (!this._isRefreshSessionActive(session)) {
                    return;
                }
                if (cached.isStale) {
                    failureStage = 'publication';
                    this._applySchedule(session, metrics, channel.id, cachedSchedule, {
                        cachePolicy: 'skip',
                        phase,
                        source: 'schedule-cache-stale',
                    });
                    metrics.staleCacheHits += 1;
                } else {
                    metrics.cacheHits += 1;
                    failureStage = 'publication';
                    this._applySchedule(session, metrics, channel.id, cachedSchedule, {
                        phase,
                        source: 'schedule-cache',
                    });
                    return;
                }
            }

            const existing = this._inFlightByChannel.get(channel.id);
            if (existing) {
                this._reportInFlightInvalidated(
                    existing,
                    existing.refreshId === session.refreshId ? 'request-replaced' : 'newer-session'
                );
                existing.controller.abort();
                this._inFlightByChannel.delete(channel.id);
            }

            controller = new AbortController();
            requestStartedAt = Date.now();
            const rowOrdinal = session.visibleRangeIds.has(channel.id)
                ? session.channelOrdinals.get(channel.id) ?? null
                : null;
            this._inFlightByChannel.set(channel.id, {
                controller,
                refreshId: session.refreshId,
                phase,
                rowOrdinal,
                startedAt: requestStartedAt,
                cacheOutcome,
            });
            metrics.cacheMisses += 1;
            if (rowOrdinal !== null) {
                runIfEpgRefreshCurrent(session, () => this._deps.appendIssueDiagnostic(
                    QA_003B_ISSUE_ID,
                    'epg.scheduleRow.requestStarted',
                    {
                        refreshId: session.refreshId,
                        phase,
                        rowOrdinal,
                        attemptCount: 1,
                        cacheOutcome,
                        elapsedMs: requestStartedAt - session.refreshStartedAt,
                    }
                ));
            }

            failureStage = 'resolution';
            const items =
                phase === 'background'
                    ? await session.channelManager.resolveChannelItemsForSchedule(channel.id, {
                        signal: controller.signal,
                    })
                    : (await session.channelManager.resolveChannelContent(channel.id, {
                        signal: controller.signal,
                    })).items;
            if (!this._isRefreshSessionActive(session)) {
                return;
            }
            const active = this._inFlightByChannel.get(channel.id);
            if (!active || active.controller !== controller || controller.signal.aborted) {
                return;
            }

            failureStage = 'schedule-generation';
            const scheduleConfig = this._deps.buildDailyScheduleConfig(channel, items, session.startTime);
            if (!this._isRefreshSessionActive(session)) {
                return;
            }
            const index = buildScheduleIndex(scheduleConfig, session.shuffler);
            const programs = generateScheduleWindow(
                session.startTime,
                session.endTime,
                index,
                scheduleConfig.anchorTime
            );
            if (!this._isRefreshSessionActive(session)) {
                return;
            }
            failureStage = 'publication';
            this._applySchedule(session, metrics, channel.id, { startTime: session.startTime, endTime: session.endTime, programs }, {
                phase,
                source: phase === 'background' ? 'resolved-background' : 'resolved-immediate',
                ...(phase === 'background' ? {} : { materializationSeed: items }),
            });
        } catch (error) {
            if (isAbortLikeError(error) || (
                controller?.signal.aborted === true && error === controller.signal.reason
            )) {
                return;
            }
            session.operation.assertCurrent();
            if (session.failurePublicationToken !== this._scheduleLoadToken) {
                return;
            }
            if (session.debugEnabled) {
                this._deps.appendDebugLog('EPG.refreshEpgSchedulesForRange.channelLoad.error', {
                    phase,
                    rowOrdinal: session.channelOrdinals.get(channel.id) ?? -1,
                    failureStage,
                    errorKind: 'non-abort',
                });
            }
            metrics.failedChannelCount += 1;
            this._reportRowFailure(
                session,
                channel.id,
                phase,
                cacheOutcome,
                controller !== null,
                requestStartedAt,
                failureStage
            );
        } finally {
            if (controller) {
                let canPublishCleanup = false;
                try {
                    session.operation.assertCurrent();
                    canPublishCleanup = true;
                } catch {
                    // A newer owner is responsible for clearing superseded entries.
                }
                if (canPublishCleanup) {
                    const active = this._inFlightByChannel.get(channel.id);
                    if (active && active.controller === controller) {
                        this._inFlightByChannel.delete(channel.id);
                    }
                }
            }
        }
    }

    private async _refreshImmediateChannels(session: RefreshSession, metrics: RefreshMetrics): Promise<void> {
        let cursor = 0;
        const workers = Array.from({ length: session.immediateConcurrency }, async () => {
            while (true) {
                const channel = session.immediateChannels[cursor++];
                if (!channel) {
                    return;
                }
                await this._refreshChannelSchedule(session, metrics, channel, 'immediate');
            }
        });
        await Promise.all(workers);
    }

    private _startBackgroundRefresh(session: RefreshSession, metrics: RefreshMetrics): void {
        if (!this._isRefreshSessionActive(session) || session.backgroundChannels.length === 0) {
            return;
        }
        startRetainedEpgBackgroundRefresh({
            queue: this._warmQueue,
            session,
            metrics,
            refreshChannel: (backgroundSession, backgroundMetrics, channel) =>
                this._refreshChannelSchedule(backgroundSession, backgroundMetrics, channel, 'background'),
        });
    }

    private _logRefreshResults(session: RefreshSession, metrics: RefreshMetrics): void {
        if (!session.debugEnabled) {
            return;
        }

        const rangeRefreshDurationMs = Date.now() - session.refreshStartedAt;
        const cacheHitRatio = metrics.cacheHits / Math.max(1, metrics.cacheHits + metrics.cacheMisses);
        this._deps.appendDebugLog('EPG.refreshEpgSchedulesForRange.results', {
            refreshId: session.refreshId,
            rangeKey: session.rangeKey,
            rangeRefreshDurationMs,
            cacheHits: metrics.cacheHits,
            staleCacheHits: metrics.staleCacheHits,
            cacheMisses: metrics.cacheMisses,
            cacheHitRatio,
            alreadyLoaded: metrics.alreadyLoaded,
            liveScheduleHits: metrics.liveScheduleHits,
            immediateLoadedCount: metrics.immediateLoadedCount,
            backgroundLoadedCount: metrics.backgroundLoadedCount,
            failedChannelCount: metrics.failedChannelCount,
            firstVisibleScheduleReadyMs: metrics.firstVisibleScheduleReadyMs,
            immediateCount: session.immediateChannels.length,
            backgroundQueuedCount: session.backgroundChannels.length,
            concurrency: session.immediateConcurrency,
            cacheSize: this._cacheStore.getSize(),
            cacheMaxEntries: this._cacheStore.getMaxEntries(),
        });
    }

    private _restoreFocusAfterRefresh(session: RefreshSession): void {
        const focusedProgram = session.epg.getFocusedProgram();
        const focusedCell = session.epg.getState().focusedCell;
        const focusedIsPlaceholder = focusedCell?.kind === 'placeholder';
        const focusedIsInvalidProgram = focusedProgram
            ? focusedProgram.scheduleIndex === -1 || focusedProgram.item.ratingKey.includes('-placeholder-')
            : false;

        if (
            this._isRefreshSessionActive(session) &&
            session.epg.isVisible() &&
            (!focusedProgram || focusedIsPlaceholder || focusedIsInvalidProgram)
        ) {
            session.epg.focusNow();
        }
    }

    private _bindRefreshAbort(session: RefreshSession): () => void {
        const bindings: Array<{ signal: AbortSignal; onAbort: () => void }> = [];
        const bindSignal = (
            signal: AbortSignal,
            source: 'operation' | 'caller'
        ): void => {
            const onAbort = (): void => {
                if (session.refreshId !== this._scheduleLoadToken) {
                    return;
                }
                this._invalidateRefreshWork(
                    source === 'caller' ? 'caller-abort' : 'operation-superseded',
                    { abortInFlight: true }
                );
                if (source === 'caller') {
                    session.failurePublicationToken = this._scheduleLoadToken;
                }
            };
            signal.addEventListener('abort', onAbort, { once: true });
            bindings.push({ signal, onAbort });
            if (signal.aborted) {
                onAbort();
            }
        };

        bindSignal(session.operation.signal, 'operation');
        if (session.signal && session.signal !== session.operation.signal) {
            bindSignal(session.signal, 'caller');
        }

        return () => {
            for (const { signal, onAbort } of bindings) {
                signal.removeEventListener('abort', onAbort);
            }
        };
    }

    private _isRefreshSessionActive(session: RefreshSession): boolean {
        assertEpgRefreshSessionCurrent(session);
        return session.refreshId === this._scheduleLoadToken;
    }

    private _invalidateRefreshWork(
        reason: string,
        options?: { abortInFlight?: boolean }
    ): void {
        this._scheduleLoadToken += 1;
        this._warmQueue.cancel(reason);
        if (options?.abortInFlight) {
            for (const entry of this._inFlightByChannel.values()) {
                this._reportInFlightInvalidated(entry, this._classifyInvalidation(reason));
                entry.controller.abort(reason);
            }
            this._inFlightByChannel.clear();
        }
        this._backgroundDebugState = null;
        this._selectedRowSnapshotSeed = null;
    }

    private _abortSupersededInFlightSchedules(): number {
        let aborted = 0;
        for (const [channelId, entry] of this._inFlightByChannel) {
            this._reportInFlightInvalidated(entry, 'newer-session');
            entry.controller.abort();
            this._inFlightByChannel.delete(channelId);
            aborted += 1;
        }
        return aborted;
    }

    private _reportInFlightInvalidated(
        entry: {
            refreshId: number;
            phase: RefreshPhase;
            rowOrdinal: number | null;
            startedAt: number;
            cacheOutcome: ScheduleDiagnosticCacheOutcome;
        },
        invalidation: ScheduleDiagnosticInvalidation
    ): void {
        if (entry.rowOrdinal === null) {
            return;
        }
        this._deps.appendIssueDiagnostic(QA_003B_ISSUE_ID, 'epg.scheduleRow.invalidated', {
            refreshId: entry.refreshId,
            phase: entry.phase,
            rowOrdinal: entry.rowOrdinal,
            attemptCount: 1,
            networkStarted: true,
            cacheOutcome: entry.cacheOutcome,
            invalidation,
            elapsedMs: Date.now() - entry.startedAt,
        });
    }

    private _classifyInvalidation(reason: string): ScheduleDiagnosticInvalidation {
        switch (reason) {
            case 'caller-abort': return 'caller-abort';
            case 'operation-superseded': return 'operation-superseded';
            case 'close-epg': return 'guide-closed';
            case 'guide-settings': return 'settings-changed';
            case 'library-filter': return 'library-filter-changed';
            case 'shutdown': return 'shutdown';
            case 'no-visible-channels': return 'no-visible-channels';
            default: return 'runtime-invalidated';
        }
    }
}
