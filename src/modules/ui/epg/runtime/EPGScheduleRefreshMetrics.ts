import type { EpgScheduleRefreshResult } from '../coordinator/EPGCoordinatorContracts';
import type { RefreshMetrics, RefreshPhase, RefreshSession } from './EPGScheduleRefreshRuntimeTypes';

export function createRefreshMetrics(): RefreshMetrics {
    return {
        cacheHits: 0,
        staleCacheHits: 0,
        cacheMisses: 0,
        alreadyLoaded: 0,
        liveScheduleHits: 0,
        immediateReadyChannelIds: new Set<string>(),
        immediateFastReadyChannelIds: new Set<string>(),
        backgroundLoadedChannelIds: new Set<string>(),
        backgroundFastReadyChannelIds: new Set<string>(),
        immediateLoadedCount: 0,
        backgroundLoadedCount: 0,
        failedChannelCount: 0,
        firstVisibleScheduleReadyMs: null,
    };
}

export function markFastReadyChannel(
    session: RefreshSession,
    metrics: RefreshMetrics,
    channelId: string,
    phase: RefreshPhase
): void {
    if (phase === 'background') {
        metrics.backgroundFastReadyChannelIds.add(channelId);
        return;
    }

    metrics.immediateFastReadyChannelIds.add(channelId);
    if (metrics.firstVisibleScheduleReadyMs === null && session.visibleRangeIds.has(channelId)) {
        metrics.firstVisibleScheduleReadyMs = Date.now() - session.refreshStartedAt;
    }
}

export function buildRefreshResult(session: RefreshSession, metrics: RefreshMetrics): EpgScheduleRefreshResult {
    const immediateReadyChannelCount = new Set([
        ...metrics.immediateReadyChannelIds,
        ...metrics.immediateFastReadyChannelIds,
    ]).size;
    const attemptedChannelCount = session.immediateChannels.length;
    const readiness = attemptedChannelCount === 0 ? 'skipped' : immediateReadyChannelCount === 0
        ? 'failed'
        : metrics.failedChannelCount > 0 ? 'partial' : 'ready';
    return {
        readiness,
        attemptedChannelCount,
        immediateReadyChannelCount,
        backgroundQueuedChannelCount: session.backgroundChannels.length,
        failedChannelCount: metrics.failedChannelCount,
        staleCacheChannelCount: metrics.staleCacheHits,
        firstVisibleScheduleReady: metrics.firstVisibleScheduleReadyMs !== null,
    };
}
