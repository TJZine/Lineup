import type { IChannelManager, ChannelConfig, ChannelStructuralBase } from '../../../modules/scheduler/channel-manager';
import { ContentResolver } from '../../../modules/scheduler/channel-manager/resolution/ContentResolver';
import type { IPlexLibrary } from '../../../modules/plex/library';
import type { ChannelBuildProgress, ChannelBuildSummary, ChannelSetupApplyResult, ChannelSetupGuideRefreshFailureStage } from '../types';
import { formatChannelSetupWarning } from '../shared/formatChannelSetupWarning';
import { isAbortLikeError } from '../../../utils/errors';
import type { EpgScheduleRefreshResult } from '../../../shared/epgRefresh';

export type ChannelSetupEpgRefreshOptions = {
    reason?: string;
    debounceMs?: number;
    signal?: AbortSignal | null;
};

export interface ChannelSetupBuildCommitterDeps {
    plexLibrary: IPlexLibrary;
    channelManager: IChannelManager;
    ensureEpgInitialized: () => Promise<void>;
    clearSelectedChannelScheduleSnapshot: () => void;
    primeEpgChannels: () => void;
    refreshEpgSchedules: (options?: ChannelSetupEpgRefreshOptions) => Promise<EpgScheduleRefreshResult>;
}

export class ChannelSetupBuildCommitter {
    constructor(private readonly _deps: ChannelSetupBuildCommitterDeps) {}

    async commitPreparedCandidate(request: {
        channels: readonly ChannelConfig[];
        sourceCheckIds: readonly string[];
        minItemsPerChannel: number;
        expectedBase: ChannelStructuralBase;
        protectedReplacementHandle: string | null;
        isCurrent: () => boolean;
        signal: AbortSignal | null;
        onProgress?: (progress: ChannelBuildProgress) => void;
        created: number;
        skipped: number;
        reachedMaxChannels: boolean;
    }): Promise<ChannelSetupApplyResult> {
        const summary: ChannelBuildSummary = {
            created: request.created, skipped: request.skipped,
            reachedMaxChannels: request.reachedMaxChannels,
            errorCount: 0, canceled: false, lastTask: 'create_channels',
        };
        const blocked = (message: string, reason: 'stale' | 'source' | 'invalid' | 'conflict' | 'storage-failure'):
        ChannelSetupApplyResult => ({ kind: 'blocked', message, reason });
        const report = (task: ChannelBuildProgress['task'], label: string, detail: string,
            current: number, total: number | null): void => {
            try { request.onProgress?.({ task, label, detail, current, total }); }
            catch (error) { (summary.warnings ??= []).push(formatChannelSetupWarning('Progress callback failed', error)); }
        };
        const resolver = new ContentResolver(this._deps.plexLibrary);
        try {
            // Resolve only the reviewed new/changed sources. A vanished source cannot silently
            // reduce the structural candidate after the user has seen it.
            const sourceCheckIds = new Set(request.sourceCheckIds);
            for (let index = 0; index < request.channels.length; index++) {
                if (!request.isCurrent()) return blocked('Review changed before Apply. Refresh Review.', 'stale');
                const channel = request.channels[index];
                if (!channel || !sourceCheckIds.has(channel.id)) continue;
                report('create_channels', 'Checking sources...', channel.name, index + 1, request.channels.length);
                const items = await resolver.resolveSource(channel.contentSource, {
                    signal: request.signal,
                    cacheMode: 'revalidate',
                });
                if (!request.isCurrent()) return blocked('Review changed before Apply. Refresh Review.', 'stale');
                const playableCount = resolver.selectChannelItems(channel, items).length;
                if (playableCount < request.minItemsPerChannel) {
                    return blocked(`Source for ${channel.name} has ${playableCount} playable items after its settings; ${request.minItemsPerChannel} required. Refresh Review.`, 'source');
                }
            }
        } catch {
            if (request.signal?.aborted) return { kind: 'canceled' };
            return blocked('Source check failed. Retry the scan and refresh Review.', 'source');
        } finally {
            resolver.clearCaches();
        }
        if (!request.isCurrent()) return blocked('Review changed before saving. Refresh Review.', 'stale');
        report('apply_channels', 'Saving...', 'Saving reviewed lineup', 0, null);
        if (!request.isCurrent()) return blocked('Review changed before saving. Refresh Review.', 'stale');
        const result = await this._deps.channelManager.tryReplaceAllChannels([...request.channels], {
            expectedBase: request.expectedBase,
            ...(request.protectedReplacementHandle
                ? { protectedReplacementHandle: request.protectedReplacementHandle } : {}),
        });
        if (result.kind !== 'committed') {
            return blocked(result.kind === 'conflict'
                ? 'Saved lineup changed. Refresh Review.'
                : result.kind === 'invalid'
                    ? 'Reviewed lineup is invalid. Return to Configure.'
                    : 'Storage failed. Lineup was not saved; retry Apply.', result.kind);
        }
        summary.pointerWarning = result.pointerWarning;
        if (result.pointerWarning) {
            (summary.warnings ??= []).push('Channels saved, but the selected-channel pointer could not be saved.');
        }
        summary.lastTask = 'refresh_epg';
        let refreshStage: ChannelSetupGuideRefreshFailureStage = 'prepare';
        const interrupted = (): boolean => {
            if (!request.signal?.aborted) return false;
            summary.guideRefresh = { kind: 'interrupted', interruption: { kind: 'aborted', stage: refreshStage } };
            return true;
        };
        try {
            if (interrupted()) return { kind: 'committed', summary };
            report('refresh_epg', 'Refreshing guide...', 'Loading schedules', 0, null);
            if (interrupted()) return { kind: 'committed', summary };
            this._deps.clearSelectedChannelScheduleSnapshot();
            if (interrupted()) return { kind: 'committed', summary };
            refreshStage = 'ensure_initialized';
            await this._deps.ensureEpgInitialized();
            if (interrupted()) return { kind: 'committed', summary };
            refreshStage = 'prime_channels';
            this._deps.primeEpgChannels();
            if (interrupted()) return { kind: 'committed', summary };
            refreshStage = 'refresh_schedules';
            const refresh = await this._deps.refreshEpgSchedules({ reason: 'channel-setup', debounceMs: 0,
                signal: request.signal });
            if (interrupted()) return { kind: 'committed', summary };
            summary.guideRefresh = { kind: 'completed', result: refresh };
            if (refresh.readiness !== 'ready' && refresh.readiness !== 'superseded') {
                (summary.warnings ??= []).push('Channels saved, but Guide refresh needs retry.');
            }
        } catch (error) {
            if (request.signal?.aborted || isAbortLikeError(error, request.signal ?? undefined)) {
                summary.guideRefresh = { kind: 'interrupted', interruption: { kind: 'aborted', stage: refreshStage } };
            } else {
                summary.guideRefresh = { kind: 'failed', failure: { kind: 'thrown', stage: refreshStage } };
                (summary.warnings ??= []).push(formatChannelSetupWarning('Channels saved, but Guide refresh failed', error));
            }
        }
        summary.lastTask = 'done';
        report('done', 'Done!', 'Reviewed lineup saved', request.created, request.created);
        return { kind: 'committed', summary };
    }
}
