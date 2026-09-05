import {
    ShuffleGenerator,
    buildScheduleIndex,
    generateScheduleWindow,
} from '../../../scheduler/scheduler';
import type {
    ChannelConfig,
    IChannelManager,
    ObserveSourceResolution,
    ResolvedChannelContent,
    SourceResolutionDiagnostic,
} from '../../../scheduler/channel-manager';
import {
    describeGuideFailure,
    guideDiagnosticClock,
    type GuideFailureDiagnostic,
} from '../../../debug/GuideDiagnosticValues';
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
import {
    EPGScheduleCacheStore,
    EPG_SCHEDULE_CACHE_STALE_TTL_MS,
    EPG_SCHEDULE_CACHE_TTL_MS,
} from './EPGScheduleCacheStore';
import {
    buildRefreshResult,
    createRefreshMetrics,
    markFastReadyChannel,
    markVisibleReadyChannel,
    markVisibleUnavailableChannel,
} from './EPGScheduleRefreshMetrics';
import { throwIfEpgRefreshAborted } from './EPGRefreshAbort';
import { createEpgRetainedOperationContext } from './EPGRetainedOperationContext';
import type { EpgRetainedOperationContext } from './EPGRetainedOperationContext';
import type { OperationContextUpstream } from '../../../../utils/RetainedOperationContext';
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
import {
    isMatchingEpgChannelSnapshot,
    type EpgHeldScheduleSnapshot,
    type EpgVisibleRange,
} from '../types';
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

function createSettledDeferred(): { settled: Promise<void>; resolveSettled: () => void } {
    let resolveSettled!: () => void;
    const settled = new Promise<void>((resolve) => {
        resolveSettled = resolve;
    });
    return { settled, resolveSettled };
}

type InFlightScheduleOutcome = 'pending' | 'success' | 'failure' | 'aborted';

type InFlightScheduleAdoption = {
    refreshId: number;
    generation: number;
    rangeKey: string;
    channelSnapshot: ChannelConfig;
    operation: EpgRetainedOperationContext;
    onAbort: () => void;
};

type InFlightScheduleEntry = {
    controller: AbortController;
    refreshId: number;
    generation: number;
    rangeKey: string;
    channelSnapshot: ChannelConfig;
    operation: EpgRetainedOperationContext;
    phase: RefreshPhase;
    rowOrdinal: number | null;
    startedAt: number;
    cacheOutcome: ScheduleDiagnosticCacheOutcome;
    settled: Promise<void>;
    resolveSettled: () => void;
    preservedRetain: EpgRetainedOperationContext | null;
    adoption: InFlightScheduleAdoption | null;
    adoptionBlocked: boolean;
    schedule: ScheduleWindow | null;
    producerResultCurrent: boolean;
    outcome: InFlightScheduleOutcome;
    failureObservation: ScheduleFailureObservation | null;
};

type ScheduleFailureObservation = {
    failure: GuideFailureDiagnostic;
    attemptControllerAborted: boolean;
    sessionAborted: boolean;
    matchesAttemptControllerReason: boolean;
    matchesSessionSignalReason: boolean;
    matchesOperationReason: boolean;
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
    appendIssueDiagnostic: AppendIssueDiagnostic;
}

export class EPGScheduleRefreshRuntime {
    private _scheduleLoadToken = 0;
    private _epgGeneration = 0;
    private _inFlightByChannel = new Map<string, InFlightScheduleEntry>();
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
                        allVisibleRowsSettledMs: this._backgroundDebugState.allVisibleRowsSettledMs,
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
        this._epgGeneration += 1;
        const epg = this._deps.getEpg();
        epg?.clearAllRowLifecycles();
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

    async retryChannelSchedule(
        channelId: string,
        options?: { operationContext?: EpgRetainedOperationContext }
    ): Promise<void> {
        const epg = this._deps.getEpg();
        const channelManager = this._deps.getChannelManager();
        if (!epg || !channelManager) {
            return;
        }
        if (this._deps.getEpgUiStatus() !== 'ready') {
            return;
        }
        const scheduleRange = this._deps.getEpgScheduleRangeMs();
        if (!scheduleRange) {
            return;
        }
        const allChannels = channelManager.getAllChannels();
        const { selectedId, shouldFilter } = this._deps.getLibraryFilterState(allChannels);
        const channels = this._deps.getVisibleChannels(allChannels, selectedId, shouldFilter);
        const channel = channels.find((candidate) => candidate.id === channelId) ?? null;
        if (!channel) {
            epg.clearRowLifecycle(channelId);
            return;
        }
        const rangeKey = getEpgScheduleRangeKey(scheduleRange.startTime, scheduleRange.endTime);
        const existing = this._inFlightByChannel.get(channelId);
        if (
            existing &&
            !existing.controller.signal.aborted &&
            existing.generation === this._epgGeneration &&
            existing.rangeKey === rangeKey &&
            isMatchingEpgChannelSnapshot(existing.channelSnapshot, channel)
        ) {
            if (
                existing.phase === 'immediate' ||
                (existing.adoption && this._isAdoptionCurrent(existing, existing.adoption))
            ) {
                return;
            }
        }
        const operation = options?.operationContext
            ? options.operationContext.retain('manual-retry')
            : createEpgRetainedOperationContext([]);
        try {
            operation.assertCurrent();
            epg.setRowLifecycle(channelId, { kind: 'retrying', rangeKey });
            const channelOrdinals = new Map(channels.map((candidate, ordinal) => [candidate.id, ordinal]));
            const session: RefreshSession = {
                refreshId: this._scheduleLoadToken,
                generation: this._epgGeneration,
                failurePublicationToken: this._scheduleLoadToken,
                reason: 'manual-retry',
                refreshStartedAt: Date.now(),
                range: {
                    channelStart: channelOrdinals.get(channelId) ?? 0,
                    channelEndExclusive: (channelOrdinals.get(channelId) ?? 0) + 1,
                    timeStartMs: scheduleRange.startTime,
                    timeEndMs: scheduleRange.endTime,
                },
                signal: null,
                operation,
                epg,
                channelManager,
                scheduler: this._deps.getScheduler(),
                startTime: scheduleRange.startTime,
                endTime: scheduleRange.endTime,
                rangeKey,
                forceRefresh: false,
                manualRetry: true,
                debugEnabled: this._deps.isDebugEnabled(),
                shuffler: new ShuffleGenerator(),
                liveChannelId: channelManager.getCurrentChannel()?.id ?? null,
                focusedChannelId: channelId,
                visibleRangeIds: new Set([channelId]),
                channelOrdinals,
                immediateChannels: [channel],
                backgroundChannels: [],
                immediateConcurrency: 1,
                backgroundConcurrency: 1,
                inFlightAborted: 0,
                bufferedRange: { start: 0, endExclusive: 0 },
                backgroundRange: { start: 0, endExclusive: 0 },
                overscan: 0,
            };
            const metrics = createRefreshMetrics();
            await this._refreshChannelSchedule(session, metrics, channel, 'immediate');
        } catch (error) {
            if (isAbortLikeError(error)) {
                return;
            }
            throw error;
        } finally {
            operation.release();
        }
    }

    async warmHiddenChannels(
        channels: ChannelConfig[],
        options?: {
            signal?: AbortSignal | null;
            shouldContinue?: () => boolean;
            operationContext?: EpgRetainedOperationContext;
            scheduleRange?: { startTime: number; endTime: number };
        }
    ): Promise<void> {
        if (channels.length === 0) {
            return;
        }
        const epg = this._deps.getEpg();
        const channelManager = this._deps.getChannelManager();
        if (!epg || !channelManager) {
            return;
        }
        if (this._deps.getEpgUiStatus() !== 'ready') {
            return;
        }
        const scheduleRange = options?.scheduleRange ?? this._deps.getEpgScheduleRangeMs();
        if (!scheduleRange) {
            return;
        }
        if (options?.signal?.aborted) {
            return;
        }
        if (options?.shouldContinue && !options.shouldContinue()) {
            return;
        }
        const upstreams: OperationContextUpstream[] = [];
        if (options?.operationContext) {
            upstreams.push(options.operationContext);
        }
        if (options?.signal) {
            const signal = options.signal;
            upstreams.push({
                signal,
                assertCurrent: (): void => {
                    if (signal.aborted) {
                        throw signal.reason;
                    }
                },
            });
        }
        const operation = createEpgRetainedOperationContext(upstreams);
        try {
            operation.assertCurrent();
            const rangeKey = getEpgScheduleRangeKey(scheduleRange.startTime, scheduleRange.endTime);
            const scheduler = this._deps.getScheduler();
            const liveChannelId = channelManager.getCurrentChannel()?.id ?? null;
            const channelOrdinals = new Map(
                channelManager.getAllChannels().map((candidate, ordinal) => [candidate.id, ordinal])
            );
            const session: RefreshSession = {
                refreshId: this._scheduleLoadToken,
                generation: this._epgGeneration,
                failurePublicationToken: this._scheduleLoadToken,
                reason: 'startup-warmup',
                refreshStartedAt: Date.now(),
                range: {
                    channelStart: 0,
                    channelEndExclusive: 0,
                    timeStartMs: scheduleRange.startTime,
                    timeEndMs: scheduleRange.endTime,
                },
                signal: options?.signal ?? null,
                operation,
                epg,
                channelManager,
                scheduler,
                startTime: scheduleRange.startTime,
                endTime: scheduleRange.endTime,
                rangeKey,
                forceRefresh: false,
                manualRetry: false,
                debugEnabled: this._deps.isDebugEnabled(),
                shuffler: new ShuffleGenerator(),
                liveChannelId,
                focusedChannelId: liveChannelId,
                visibleRangeIds: new Set(),
                channelOrdinals,
                immediateChannels: [],
                backgroundChannels: channels,
                immediateConcurrency: 1,
                backgroundConcurrency: 1,
                inFlightAborted: 0,
                bufferedRange: { start: 0, endExclusive: 0 },
                backgroundRange: { start: 0, endExclusive: 0 },
                overscan: 0,
            };
            const metrics = createRefreshMetrics();
            this._deps.appendIssueDiagnostic(QA_003B_ISSUE_ID, 'epg.warmup.started', {
                refreshId: session.refreshId,
                phase: 'background',
                visibleChannelCount: 0,
                immediateChannelCount: 0,
                backgroundChannelCount: channels.length,
            });
            startRetainedEpgBackgroundRefresh({
                queue: this._warmQueue,
                session,
                metrics,
                refreshChannel: (backgroundSession, backgroundMetrics, channel) =>
                    this._refreshChannelSchedule(backgroundSession, backgroundMetrics, channel, 'background'),
                ...(options?.shouldContinue ? { shouldContinue: options.shouldContinue } : {}),
            });
            await this._warmQueue.whenIdle();
            operation.assertCurrent();
            this._deps.appendIssueDiagnostic(QA_003B_ISSUE_ID, 'epg.warmup.settled', {
                refreshId: session.refreshId,
                phase: 'background',
                backgroundChannelCount: channels.length,
                failedChannelCount: metrics.failedChannelCount,
                resolutionAttemptCount: metrics.cacheMisses,
                loadedMarkerCount: metrics.alreadyLoaded,
                freshCacheHitCount: metrics.cacheHits,
                staleCacheHitCount: metrics.staleCacheHits,
            });
        } catch (error) {
            if (isAbortLikeError(error)) {
                return;
            }
            throw error;
        } finally {
            operation.release();
        }
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

        // Every new session invalidates the previous session token. In-flight work
        // that still matches the new range, generation, and channel/source snapshot
        // is preserved for foreground adoption instead of abort/restart churn.
        // Preserve (and retain) before cancelling the warm queue: the cancel
        // releases the previous background lease, which would otherwise dispose
        // the operation that preserved work still needs to complete.
        operation.assertCurrent();
        const generation = this._epgGeneration;
        const immediateIds = new Set(partitioned.immediateChannels.map((channel) => channel.id));
        const channelsById = new Map(channels.map((channel) => [channel.id, channel]));
        const inFlightAborted = this._abortSupersededInFlightSchedulesExcept({
            rangeKey,
            generation,
            channelIds: immediateIds,
            channelsById,
        });
        operation.assertCurrent();
        this._warmQueue.cancel('new-visible-range-request');
        operation.assertCurrent();
        this._cacheStore.prune(Date.now());
        operation.assertCurrent();

        return {
            refreshId,
            generation,
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
            manualRetry: false,
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
            allVisibleRowsSettledMs: null,
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
            resolutionAttemptCount: metrics.cacheMisses,
            loadedMarkerCount: metrics.alreadyLoaded,
            freshCacheHitCount: metrics.cacheHits,
            staleCacheHitCount: metrics.staleCacheHits,
            liveSchedulerHitCount: metrics.liveScheduleHits,
            allVisibleRowsSettledMs: metrics.allVisibleRowsSettledMs,
            visibleReadyChannelCount: metrics.visibleReadyChannelIds.size,
            visibleUnavailableChannelCount: metrics.visibleUnavailableChannelIds.size,
            focusKind: session.epg.getState().focusedCell?.kind ?? 'absent',
        });
    }

    private _reportRowFailure(
        session: RefreshSession,
        channelId: string,
        phase: RefreshPhase,
        cacheOutcome: ScheduleDiagnosticCacheOutcome,
        resolutionStarted: boolean,
        startedAt: number,
        failureStage: ScheduleDiagnosticFailureStage,
        observation: ScheduleFailureObservation
    ): void {
        runIfEpgRefreshCurrent(session, () => this._deps.appendIssueDiagnostic(
            QA_003B_ISSUE_ID,
            'epg.scheduleRow.settled',
            {
                refreshId: session.refreshId,
                phase,
                rowOrdinal: session.channelOrdinals.get(channelId) ?? -1,
                attemptCount: resolutionStarted ? 1 : 0,
                resolutionStarted,
                status: 'failure',
                cacheOutcome,
                failureStage,
                errorKind: 'non-abort',
                failure: observation.failure,
                attemptControllerAborted: observation.attemptControllerAborted,
                sessionAborted: observation.sessionAborted,
                matchesAttemptControllerReason: observation.matchesAttemptControllerReason,
                matchesSessionSignalReason: observation.matchesSessionSignalReason,
                matchesOperationReason: observation.matchesOperationReason,
                elapsedMs: Date.now() - startedAt,
            }
        ));
    }

    private _observeScheduleFailure(
        error: unknown,
        session: RefreshSession,
        controller: AbortController | null
    ): ScheduleFailureObservation {
        const attemptSignal = controller?.signal ?? null;
        const sessionSignal = session.signal;
        const operationSignal = session.operation.signal;
        return {
            failure: describeGuideFailure(error),
            attemptControllerAborted: attemptSignal?.aborted === true,
            sessionAborted: sessionSignal?.aborted === true || operationSignal.aborted,
            matchesAttemptControllerReason: attemptSignal?.aborted === true && error === attemptSignal.reason,
            matchesSessionSignalReason: sessionSignal?.aborted === true && error === sessionSignal.reason,
            matchesOperationReason: operationSignal.aborted && error === operationSignal.reason,
        };
    }

    private _appendIssueDiagnosticBestEffort(
        event: string,
        payload: Record<string, unknown>
    ): void {
        try {
            this._deps.appendIssueDiagnostic(QA_003B_ISSUE_ID, event, payload);
        } catch {
            // Diagnostics must never change schedule resolution or publication.
        }
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
            attemptController?: AbortController;
            channelSnapshot?: ChannelConfig;
            loadedAt?: number;
        }
    ): void {
        const phase = options?.phase ?? 'immediate';
        if (phase === 'background') {
            if (!this._isBackgroundWorkCurrent(session)) return;
            if (!options?.attemptController || !this._canPublishBackgroundSchedule(
                session,
                channelId,
                options.attemptController
            )) {
                return;
            }
        } else if (!this._isRefreshSessionActive(session)) {
            return;
        }
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
            runIfEpgRefreshCurrent(session, () => {
                const epgSchedule = toEpgScheduleWindow(schedule);
                if (options?.loadedAt === undefined) {
                    session.epg.loadScheduleForChannel(channelId, epgSchedule);
                    return;
                }
                session.epg.loadScheduleForChannel(channelId, epgSchedule, {
                    loadedAt: options.loadedAt,
                    channelSnapshot: options.channelSnapshot!,
                });
            });
            markVisibleReadyChannel(session, metrics, channelId);
        }

        if (phase === 'background') {
            runIfEpgRefreshCurrent(session, () => this._syncBackgroundDebugState(session, metrics));
        }

        if ((options?.cachePolicy ?? 'persist') === 'skip') {
            return;
        }

        runIfEpgRefreshCurrent(session, () => this._cacheStore.storeSchedule(
            channelId,
            session.rangeKey,
            schedule,
            options?.channelSnapshot
        ));
        if (shouldApplyToUi) {
            runIfEpgRefreshCurrent(session, () =>
                this._cacheStore.markScheduleLoaded(channelId, session.rangeKey, options?.channelSnapshot));
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
        debugState.allVisibleRowsSettledMs = metrics.allVisibleRowsSettledMs;
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
            allVisibleRowsSettledMs: metrics.allVisibleRowsSettledMs,
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
        let inFlightEntry: InFlightScheduleEntry | null = null;
        let removeOperationAbortListener = (): void => undefined;
        let requestStartedAt = session.refreshStartedAt;
        let cacheOutcome: ScheduleDiagnosticCacheOutcome = 'not-checked';
        let failureStage: ScheduleDiagnosticFailureStage = 'live-scheduler';
        let publishedUsableSchedule = false;
        let heldSchedule: EpgHeldScheduleSnapshot | null = null;
        let heldScheduleAgeMs: number | null = null;
        let shouldRevalidateHeldSchedule = false;
        const sourceEvents: SourceResolutionDiagnostic[] = [];
        let sourceEventsDropped = 0;
        let resolutionStartedMonotonic: number | null = null;
        let resolutionMs: number | null = null;
        let generationMs: number | null = null;
        let publicationMs: number | null = null;
        let resolvedItemCount: number | null = null;
        const onSourceDiagnostic: ObserveSourceResolution | undefined = session.debugEnabled
            ? (diagnostic): void => {
                if (sourceEvents.length < 8) {
                    sourceEvents.push(diagnostic);
                } else {
                    sourceEventsDropped += 1;
                }
            }
            : undefined;

        try {
            if (phase === 'immediate') {
                const lifecycle = session.epg.getRowLifecycle(channel.id);
                if (lifecycle && lifecycle.rangeKey !== session.rangeKey) {
                    session.epg.clearRowLifecycle(channel.id, lifecycle.rangeKey);
                }
            }
            if (session.liveChannelId && channel.id === session.liveChannelId && session.scheduler) {
                const schedulerState = session.scheduler.getState();
                if (schedulerState.isActive && schedulerState.channelId === channel.id) {
                    const liveWindow = session.scheduler.getScheduleWindow(session.startTime, session.endTime);
                    const liveSchedule = this._deps.cloneScheduleWindow(liveWindow);
                    if (!this._isChannelWorkCurrent(session, phase)) {
                        return;
                    }
                    this._applySchedule(session, metrics, channel.id, liveSchedule, {
                        cachePolicy: 'skip',
                        phase,
                        source: 'live-scheduler',
                        channelSnapshot: channel,
                    });
                    metrics.liveScheduleHits += 1;
                    return;
                }
            }

            if (phase === 'immediate') {
                heldSchedule = this._getUsableHeldSchedule(session, channel);
                if (heldSchedule) {
                    heldScheduleAgeMs = Math.max(0, Date.now() - heldSchedule.loadedAt);
                    metrics.immediateReadyChannelIds.add(channel.id);
                    metrics.immediateLoadedCount = metrics.immediateReadyChannelIds.size;
                    publishedUsableSchedule = true;
                    markVisibleReadyChannel(session, metrics, channel.id);
                    shouldRevalidateHeldSchedule = heldScheduleAgeMs > EPG_SCHEDULE_CACHE_TTL_MS;
                }
                if (heldSchedule && heldScheduleAgeMs !== null &&
                    heldScheduleAgeMs <= EPG_SCHEDULE_CACHE_TTL_MS) {
                    metrics.alreadyLoaded += 1;
                    markFastReadyChannel(session, metrics, channel.id, phase);
                    return;
                }
            }

            failureStage = 'cache';
            cacheOutcome = 'miss';
            if (
                !session.forceRefresh &&
                !shouldRevalidateHeldSchedule &&
                this._cacheStore.isScheduleLoadedForRange(channel.id, session.rangeKey, channel)
            ) {
                metrics.alreadyLoaded += 1;
                markFastReadyChannel(session, metrics, channel.id, phase);
                return;
            }

            const cached = session.forceRefresh
                ? null
                : this._cacheStore.getCachedSchedule(channel.id, session.rangeKey, channel);
            if (cached) {
                cacheOutcome = cached.isStale ? 'stale-hit' : 'fresh-hit';
                const cachedSchedule = this._deps.cloneScheduleWindow(cached.schedule);
                if (!this._isChannelWorkCurrent(session, phase)) {
                    return;
                }
                if (cached.isStale) {
                    failureStage = 'publication';
                    this._applySchedule(session, metrics, channel.id, cachedSchedule, {
                        cachePolicy: 'skip',
                        phase,
                        source: 'schedule-cache-stale',
                        channelSnapshot: channel,
                        loadedAt: cached.loadedAt,
                    });
                    metrics.staleCacheHits += 1;
                    publishedUsableSchedule = true;
                } else {
                    metrics.cacheHits += 1;
                    failureStage = 'publication';
                    this._applySchedule(session, metrics, channel.id, cachedSchedule, {
                        cachePolicy: 'skip',
                        phase,
                        source: 'schedule-cache',
                        channelSnapshot: channel,
                        loadedAt: cached.loadedAt,
                    });
                    if (!shouldRevalidateHeldSchedule) {
                        return;
                    }
                }
            }

            const terminalLifecycle = phase === 'immediate'
                ? session.epg.getRowLifecycle(channel.id)
                : null;
            if (
                phase === 'immediate' &&
                !session.manualRetry &&
                terminalLifecycle?.kind === 'unavailable' &&
                terminalLifecycle.rangeKey === session.rangeKey
            ) {
                if (!this._isChannelWorkCurrent(session, phase)) {
                    return;
                }
                metrics.failedChannelCount += 1;
                markVisibleUnavailableChannel(session, metrics, channel.id);
                return;
            }

            const existing = this._inFlightByChannel.get(channel.id);
            if (existing) {
                if (this._isAdoptableInFlight(existing, session, channel, phase)) {
                    await this._adoptMatchingInFlight(existing, session, metrics, channel, phase);
                    return;
                }
                if (this._isCoalescableInFlight(existing, session, channel, phase)) {
                    return;
                }
                this._reportInFlightInvalidated(
                    existing,
                    existing.refreshId === session.refreshId ? 'request-replaced' : 'newer-session'
                );
                this._abortInFlightEntry(existing, 'request-replaced');
                if (this._inFlightByChannel.get(channel.id) === existing) {
                    this._inFlightByChannel.delete(channel.id);
                }
            }

            controller = new AbortController();
            requestStartedAt = Date.now();
            const rowOrdinal = session.visibleRangeIds.has(channel.id)
                ? session.channelOrdinals.get(channel.id) ?? null
                : null;
            const { settled, resolveSettled } = createSettledDeferred();
            inFlightEntry = {
                controller,
                refreshId: session.refreshId,
                generation: session.generation,
                rangeKey: session.rangeKey,
                channelSnapshot: channel,
                operation: session.operation,
                phase,
                rowOrdinal,
                startedAt: requestStartedAt,
                cacheOutcome,
                settled,
                resolveSettled,
                preservedRetain: null,
                adoption: null,
                adoptionBlocked: false,
                schedule: null,
                producerResultCurrent: false,
                outcome: 'pending',
                failureObservation: null,
            };
            this._inFlightByChannel.set(channel.id, inFlightEntry);
            const onOperationAbort = (): void => {
                if (!controller?.signal.aborted) {
                    controller?.abort(session.operation.signal.reason);
                }
            };
            session.operation.signal.addEventListener('abort', onOperationAbort, { once: true });
            removeOperationAbortListener = (): void => {
                session.operation.signal.removeEventListener('abort', onOperationAbort);
            };
            if (session.operation.signal.aborted) {
                onOperationAbort();
            }
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
            resolutionStartedMonotonic = guideDiagnosticClock().monotonicMs;
            const items =
                phase === 'background'
                    ? await session.channelManager.resolveChannelItemsForSchedule(channel.id, {
                        signal: controller.signal,
                        ...(onSourceDiagnostic ? { onSourceDiagnostic } : {}),
                    })
                    : (await session.channelManager.resolveChannelContent(channel.id, {
                        signal: controller.signal,
                        ...(session.manualRetry ? { cacheMode: 'revalidate' as const } : {}),
                        ...(onSourceDiagnostic ? { onSourceDiagnostic } : {}),
                    })).items;
            resolutionMs = guideDiagnosticClock().monotonicMs - resolutionStartedMonotonic;
            resolvedItemCount = items.length;
            if (!this._isChannelWorkCurrent(session, phase)) {
                return;
            }
            const active = this._inFlightByChannel.get(channel.id);
            if (!active || active.controller !== controller || controller.signal.aborted) {
                return;
            }

            failureStage = 'schedule-generation';
            const generationStartedMonotonic = guideDiagnosticClock().monotonicMs;
            const scheduleConfig = this._deps.buildDailyScheduleConfig(channel, items, session.startTime);
            if (!this._isChannelWorkCurrent(session, phase)) {
                return;
            }
            const index = buildScheduleIndex(scheduleConfig, session.shuffler);
            const programs = generateScheduleWindow(
                session.startTime,
                session.endTime,
                index,
                scheduleConfig.anchorTime
            );
            generationMs = guideDiagnosticClock().monotonicMs - generationStartedMonotonic;
            if (!this._isChannelWorkCurrent(session, phase)) {
                return;
            }
            failureStage = 'publication';
            const schedule = { startTime: session.startTime, endTime: session.endTime, programs };
            if (inFlightEntry) {
                inFlightEntry.schedule = this._deps.cloneScheduleWindow(schedule);
                inFlightEntry.producerResultCurrent = this._isProducerResultCurrent(session, inFlightEntry);
                inFlightEntry.outcome = 'success';
            }
            const publicationStartedMonotonic = guideDiagnosticClock().monotonicMs;
            this._applySchedule(session, metrics, channel.id, schedule, {
                phase,
                source: phase === 'background' ? 'resolved-background' : 'resolved-immediate',
                channelSnapshot: channel,
                ...(phase === 'background' ? {} : { materializationSeed: items }),
                ...(phase === 'background' ? { attemptController: controller } : {}),
            });
            publicationMs = guideDiagnosticClock().monotonicMs - publicationStartedMonotonic;
        } catch (error) {
            if (resolutionStartedMonotonic !== null && resolutionMs === null) {
                resolutionMs = guideDiagnosticClock().monotonicMs - resolutionStartedMonotonic;
            }
            const failureObservation = this._observeScheduleFailure(error, session, controller);
            if (inFlightEntry) {
                inFlightEntry.failureObservation = failureObservation;
            }
            if (isAbortLikeError(error) || (
                controller?.signal.aborted === true && error === controller.signal.reason
            )) {
                if (inFlightEntry) {
                    inFlightEntry.outcome = 'aborted';
                }
                return;
            }
            if (inFlightEntry) {
                inFlightEntry.outcome = 'failure';
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
                failureStage,
                failureObservation
            );
            if (phase === 'immediate' && !publishedUsableSchedule) {
                this._publishUnavailableRow(session, metrics, channel.id);
            }
        } finally {
            removeOperationAbortListener();
            if (controller) {
                const clock = guideDiagnosticClock();
                this._appendIssueDiagnosticBestEffort('epg.scheduleRow.requestCompleted', {
                    refreshId: session.refreshId,
                    phase,
                    rowOrdinal: session.channelOrdinals.get(channel.id) ?? -1,
                    scheduleAdmissionMs: requestStartedAt - session.refreshStartedAt,
                    resolutionMs,
                    generationMs,
                    publicationMs,
                    itemCount: resolvedItemCount,
                    outcome: inFlightEntry?.outcome === 'pending'
                        ? (controller.signal.aborted ? 'aborted' : 'stale')
                        : inFlightEntry?.outcome ?? (controller.signal.aborted ? 'aborted' : 'stale'),
                    sourceEvents,
                    sourceEventsDropped,
                    timeOrigin: clock.timeOrigin,
                    monotonicMs: clock.monotonicMs,
                });
                // Always settle our own entry so foreground adopters waiting on it
                // can never deadlock, even when our operation was superseded. The
                // controller identity guard keeps a newer owner entry safe.
                if (inFlightEntry) {
                    inFlightEntry.resolveSettled();
                    if (this._inFlightByChannel.get(channel.id) === inFlightEntry) {
                        this._inFlightByChannel.delete(channel.id);
                        this._releasePreservedRetain(inFlightEntry);
                    }
                }
            }
        }
    }

    private _getUsableHeldSchedule(
        session: RefreshSession,
        channel: ChannelConfig
    ): EpgHeldScheduleSnapshot | null {
        const heldSchedule = session.epg.getHeldScheduleForChannel?.(channel.id) ?? null;
        if (!heldSchedule) {
            return null;
        }
        const rangeMatches = heldSchedule.schedule.startTime === session.startTime &&
            heldSchedule.schedule.endTime === session.endTime;
        const sourceMatches = isMatchingEpgChannelSnapshot(heldSchedule.channelSnapshot, channel);
        const ageMs = Math.max(0, Date.now() - heldSchedule.loadedAt);
        if (!rangeMatches || !sourceMatches || ageMs > EPG_SCHEDULE_CACHE_STALE_TTL_MS) {
            session.epg.clearScheduleForChannel?.(channel.id);
            return null;
        }
        return heldSchedule;
    }

    private _isMatchingAttempt(
        existing: InFlightScheduleEntry,
        session: RefreshSession,
        channel: ChannelConfig
    ): boolean {
        if (existing.generation !== session.generation) {
            return false;
        }
        if (existing.rangeKey !== session.rangeKey) {
            return false;
        }
        return isMatchingEpgChannelSnapshot(existing.channelSnapshot, channel);
    }

    private _isAdoptableInFlight(
        existing: InFlightScheduleEntry,
        session: RefreshSession,
        channel: ChannelConfig,
        phase: RefreshPhase
    ): boolean {
        if (phase !== 'immediate' || existing.phase !== 'background') {
            return false;
        }
        if (existing.controller.signal.aborted) {
            return false;
        }
        return this._isMatchingAttempt(existing, session, channel);
    }

    private _isCoalescableInFlight(
        existing: InFlightScheduleEntry,
        session: RefreshSession,
        channel: ChannelConfig,
        phase: RefreshPhase
    ): boolean {
        if (existing.controller.signal.aborted) {
            return false;
        }
        if (!this._isMatchingAttempt(existing, session, channel)) {
            return false;
        }
        if (existing.phase === phase) {
            return true;
        }
        return existing.phase === 'immediate' && phase === 'background';
    }

    private async _adoptMatchingInFlight(
        existing: InFlightScheduleEntry,
        session: RefreshSession,
        metrics: RefreshMetrics,
        channel: ChannelConfig,
        phase: RefreshPhase
    ): Promise<void> {
        if (existing.adoption) {
            const previousAdoption = existing.adoption;
            if (this._isAdoptionCurrent(existing, previousAdoption)) {
                return;
            }
            this._clearAdoption(existing, previousAdoption, true);
        }
        let adoptionOperation: EpgRetainedOperationContext;
        try {
            adoptionOperation = session.operation.retain('foreground-adoption');
        } catch {
            return;
        }
        const adoption: InFlightScheduleAdoption = {
            refreshId: session.refreshId,
            generation: session.generation,
            rangeKey: session.rangeKey,
            channelSnapshot: channel,
            operation: adoptionOperation,
            onAbort: (): void => {
                this._clearAdoption(existing, adoption, true);
            },
        };
        if (this._inFlightByChannel.get(channel.id) !== existing) {
            adoptionOperation.release();
            return;
        }
        existing.adoption = adoption;
        // A superseded adopter cannot publish this result, but a newer current
        // foreground adopter may take its place on the same retained producer.
        existing.adoptionBlocked = false;
        adoptionOperation.signal.addEventListener('abort', adoption.onAbort, { once: true });
        if (adoptionOperation.signal.aborted) {
            adoption.onAbort();
            return;
        }
        try {
            runIfEpgRefreshCurrent(session, () => this._deps.appendIssueDiagnostic(
                QA_003B_ISSUE_ID,
                'epg.scheduleRow.adopted',
                {
                    refreshId: session.refreshId,
                    phase,
                    rowOrdinal: session.visibleRangeIds.has(channel.id)
                        ? session.channelOrdinals.get(channel.id) ?? -1
                        : -1,
                    attemptCount: 0,
                    resolutionStarted: false,
                    adoptedRefreshId: existing.refreshId,
                    adoptedPhase: existing.phase,
                }
            ));
            await existing.settled;
            if (!this._isAdoptionCurrent(existing, adoption)) {
                return;
            }
            if (existing.outcome === 'aborted') {
                return;
            }
            if (existing.outcome === 'success' && existing.producerResultCurrent) {
                const adoptedSchedule = existing.schedule
                    ? this._deps.cloneScheduleWindow(existing.schedule)
                    : null;
                if (!adoptedSchedule || !this._isAdoptionCurrent(existing, adoption)) {
                    return;
                }
                this._applySchedule(session, metrics, channel.id, adoptedSchedule, {
                    phase,
                    source: 'resolved-background',
                    channelSnapshot: channel,
                });
                return;
            }
            if (existing.outcome !== 'failure') {
                return;
            }
            metrics.failedChannelCount += 1;
            this._reportRowFailure(
                session,
                channel.id,
                phase,
                existing.cacheOutcome,
                true,
                existing.startedAt,
                'resolution',
                existing.failureObservation ?? this._observeScheduleFailure(
                    undefined,
                    session,
                    existing.controller
                )
            );
            if (!this._getUsableHeldSchedule(session, channel)) {
                this._publishUnavailableRow(session, metrics, channel.id);
            } else {
                markVisibleReadyChannel(session, metrics, channel.id);
            }
        } finally {
            this._clearAdoption(existing, adoption);
        }
    }

    private _isProducerResultCurrent(session: RefreshSession, entry: InFlightScheduleEntry): boolean {
        if (entry.controller.signal.aborted || entry.generation !== session.generation) {
            return false;
        }
        if (session.generation !== this._epgGeneration || entry.rangeKey !== session.rangeKey) {
            return false;
        }
        try {
            entry.operation.assertCurrent();
            return true;
        } catch {
            return false;
        }
    }

    private _isAdoptionCurrent(entry: InFlightScheduleEntry, adoption: InFlightScheduleAdoption): boolean {
        if (entry.adoption !== adoption || entry.adoptionBlocked || entry.controller.signal.aborted) {
            return false;
        }
        if (
            adoption.refreshId !== this._scheduleLoadToken ||
            adoption.generation !== this._epgGeneration ||
            entry.generation !== adoption.generation ||
            entry.rangeKey !== adoption.rangeKey ||
            !isMatchingEpgChannelSnapshot(entry.channelSnapshot, adoption.channelSnapshot)
        ) {
            this._clearAdoption(entry, adoption, true);
            return false;
        }
        try {
            adoption.operation.assertCurrent();
            return true;
        } catch {
            this._clearAdoption(entry, adoption, true);
            return false;
        }
    }

    private _canPublishBackgroundSchedule(
        session: RefreshSession,
        channelId: string,
        controller: AbortController
    ): boolean {
        const entry = this._inFlightByChannel.get(channelId);
        if (!entry || entry.controller !== controller || entry.adoptionBlocked) {
            return false;
        }
        if (!this._isProducerResultCurrent(session, entry)) {
            return false;
        }
        if (!entry.adoption) {
            return true;
        }
        return this._isAdoptionCurrent(entry, entry.adoption);
    }

    private _clearAdoption(
        entry: InFlightScheduleEntry,
        adoption: InFlightScheduleAdoption,
        cancelled = false
    ): void {
        if (entry.adoption !== adoption) {
            return;
        }
        adoption.operation.signal.removeEventListener('abort', adoption.onAbort);
        entry.adoption = null;
        if (cancelled) {
            entry.adoptionBlocked = true;
        }
        try {
            adoption.operation.release();
        } catch {
            // Best-effort lease accounting; entry settlement is authoritative.
        }
    }

    private _abortInFlightEntry(entry: InFlightScheduleEntry, reason: string): void {
        if (entry.adoption) {
            this._clearAdoption(entry, entry.adoption, true);
        }
        entry.outcome = 'aborted';
        entry.controller.abort(reason);
        entry.resolveSettled();
        this._releasePreservedRetain(entry);
    }

    private _publishUnavailableRow(session: RefreshSession, metrics: RefreshMetrics, channelId: string): void {
        try {
            session.operation.assertCurrent();
        } catch {
            return;
        }
        if (!this._isRefreshSessionActive(session)) {
            return;
        }
        if (session.generation !== this._epgGeneration) {
            return;
        }
        if (session.failurePublicationToken !== this._scheduleLoadToken) {
            return;
        }
        runIfEpgRefreshCurrent(session, () =>
            session.epg.setRowLifecycle(channelId, { kind: 'unavailable', rangeKey: session.rangeKey }));
        markVisibleUnavailableChannel(session, metrics, channelId);
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
            allVisibleRowsSettledMs: metrics.allVisibleRowsSettledMs,
            visibleReadyChannelCount: metrics.visibleReadyChannelIds.size,
            visibleUnavailableChannelCount: metrics.visibleUnavailableChannelIds.size,
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
        return session.refreshId === this._scheduleLoadToken
            && session.generation === this._epgGeneration;
    }

    private _isBackgroundWorkCurrent(session: RefreshSession): boolean {
        try {
            session.operation.assertCurrent();
        } catch {
            return false;
        }
        return session.generation === this._epgGeneration;
    }

    private _isChannelWorkCurrent(session: RefreshSession, phase: RefreshPhase): boolean {
        if (phase === 'background') {
            return this._isBackgroundWorkCurrent(session);
        }
        return this._isRefreshSessionActive(session);
    }

    private _invalidateRefreshWork(
        reason: string,
        options?: { abortInFlight?: boolean }
    ): void {
        this._scheduleLoadToken += 1;
        this._epgGeneration += 1;
        this._warmQueue.cancel(reason);
        if (options?.abortInFlight) {
            for (const entry of this._inFlightByChannel.values()) {
                this._reportInFlightInvalidated(entry, this._classifyInvalidation(reason));
                this._abortInFlightEntry(entry, reason);
            }
            this._inFlightByChannel.clear();
        }
        this._backgroundDebugState = null;
        this._selectedRowSnapshotSeed = null;
    }

    private _abortSupersededInFlightSchedulesExcept(preserve: {
        rangeKey: string;
        generation: number;
        channelIds: Set<string>;
        channelsById: Map<string, ChannelConfig>;
    } | null): number {
        let aborted = 0;
        for (const [channelId, entry] of this._inFlightByChannel) {
            if (preserve && this._retainPreservableInFlight(entry, preserve)) {
                continue;
            }
            this._reportInFlightInvalidated(entry, 'newer-session');
            this._abortInFlightEntry(entry, 'newer-session');
            this._inFlightByChannel.delete(channelId);
            aborted += 1;
        }
        return aborted;
    }

    private _releasePreservedRetain(entry: { preservedRetain: EpgRetainedOperationContext | null }): void {
        if (!entry.preservedRetain) {
            return;
        }
        try {
            entry.preservedRetain.release();
        } catch {
            // Best-effort lease accounting; entry settlement is authoritative.
        }
        entry.preservedRetain = null;
    }

    private _retainPreservableInFlight(
        entry: {
            generation: number;
            rangeKey: string;
            channelSnapshot: ChannelConfig;
            operation: EpgRetainedOperationContext;
            phase: RefreshPhase;
            preservedRetain: EpgRetainedOperationContext | null;
        },
        preserve: {
            rangeKey: string;
            generation: number;
            channelIds: Set<string>;
            channelsById: Map<string, ChannelConfig>;
        }
    ): boolean {
        if (!this._isPreservableInFlight(entry, preserve)) {
            return false;
        }
        if (entry.preservedRetain) {
            return true;
        }
        try {
            entry.preservedRetain = entry.operation.retain('preserved-background');
        } catch {
            return false;
        }
        return true;
    }

    private _isPreservableInFlight(
        entry: {
            generation: number;
            rangeKey: string;
            channelSnapshot: ChannelConfig;
            phase: RefreshPhase;
        },
        preserve: {
            rangeKey: string;
            generation: number;
            channelIds: Set<string>;
            channelsById: Map<string, ChannelConfig>;
        }
    ): boolean {
        if (entry.phase !== 'background') {
            return false;
        }
        if (entry.generation !== preserve.generation) {
            return false;
        }
        if (entry.rangeKey !== preserve.rangeKey) {
            return false;
        }
        if (!preserve.channelIds.has(entry.channelSnapshot.id)) {
            return false;
        }
        const current = preserve.channelsById.get(entry.channelSnapshot.id);
        if (!current) {
            return false;
        }
        return isMatchingEpgChannelSnapshot(entry.channelSnapshot, current);
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
            resolutionStarted: true,
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
