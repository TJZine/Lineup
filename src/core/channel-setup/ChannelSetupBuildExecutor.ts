import type { IChannelManager } from '../../modules/scheduler/channel-manager';
import type { PlexLibraryType } from '../../modules/plex/library';
import { summarizeErrorForLog } from '../../utils/errors';
import type {
    ChannelBuildProgress,
    ChannelBuildSummary,
    ChannelSetupConfig,
} from './types';
import { diffChannelPlans } from './ChannelSetupPlanner';
import type { ChannelSetupPlanBuildResult, ChannelSetupPlanningService } from './ChannelSetupPlanningService';
import type { ChannelSetupBuildCommitter } from './ChannelSetupBuildCommitter';
import { isSignalAborted } from './utils';
import { normalizeChannelSetupConfig } from './normalizeChannelSetupConfig';

export interface ChannelSetupBuildExecutorDeps {
    channelManager: IChannelManager;
    planningService: ChannelSetupPlanningService;
    buildCommitter: ChannelSetupBuildCommitter;
}

export class ChannelSetupBuildExecutor {
    constructor(private readonly _deps: ChannelSetupBuildExecutorDeps) {}

    async createChannelsFromSetup(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal; onProgress?: (p: ChannelBuildProgress) => void }
    ): Promise<ChannelBuildSummary> {
        const signal = options?.signal;
        const reportProgress = (
            task: ChannelBuildProgress['task'],
            label: string,
            detail: string,
            current: number,
            total: number | null
        ): void => {
            try {
                options?.onProgress?.({ task, label, detail, current, total });
            } catch (error: unknown) {
                console.warn('[ChannelSetup] progress callback failed:', summarizeErrorForLog(error));
            }
        };

        const checkCanceled = (): boolean => {
            return signal?.aborted ?? false;
        };

        if (checkCanceled()) {
            return { created: 0, skipped: 0, reachedMaxChannels: false, errorCount: 0, canceled: true, lastTask: 'init' };
        }

        reportProgress('fetch_playlists', 'Preparing...', 'Loading libraries', 0, null);

        let libraries: PlexLibraryType[];
        try {
            libraries = await this._deps.planningService.getLibrariesForSetup(signal ?? null);
        } catch (e) {
            if (isSignalAborted(signal ?? undefined)) {
                reportProgress('fetch_playlists', 'Preparing...', 'Canceled', 0, null);
                return { created: 0, skipped: 0, reachedMaxChannels: false, errorCount: 0, canceled: true, lastTask: 'fetch_playlists' };
            }
            throw e;
        }

        const normalizedConfig = normalizeChannelSetupConfig(config);
        let planResult: ChannelSetupPlanBuildResult;
        try {
            planResult = await this._deps.planningService.buildSetupPlan(
                normalizedConfig,
                libraries,
                signal ?? null,
                'build',
                reportProgress
            );
        } catch (e) {
            if (isSignalAborted(signal ?? undefined)) {
                reportProgress('build_pending', 'Preparing...', 'Canceled', 0, null);
                return { created: 0, skipped: 0, reachedMaxChannels: false, errorCount: 0, canceled: true, lastTask: 'build_pending' };
            }
            throw e;
        }

        if (planResult.canceled || !planResult.plan) {
            const blockedSummary = planResult.blockedMessage !== undefined
                ? { blockedMessage: planResult.blockedMessage }
                : {};
            return {
                created: 0,
                skipped: 0,
                reachedMaxChannels: false,
                errorCount: planResult.errorsTotal,
                canceled: planResult.canceled,
                lastTask: planResult.lastTask ?? 'build_pending',
                ...blockedSummary,
            };
        }

        const pending = planResult.plan.pendingChannels;
        let skippedCount = planResult.plan.skipped;
        let reachedMax = planResult.plan.reachedMaxChannels;

        if (checkCanceled()) {
            return { created: 0, skipped: skippedCount, reachedMaxChannels: reachedMax, errorCount: planResult.errorsTotal, canceled: true, lastTask: 'build_pending' };
        }

        const existingChannels = this._deps.channelManager.getAllChannels();
        const diff = diffChannelPlans(existingChannels, pending);
        const pendingToCreate = this._deps.planningService.getPendingChannelsForMode(normalizedConfig.buildMode, pending, diff);

        reportProgress('create_channels', 'Shuffling...', 'Setting up lineup', 0, pendingToCreate.length);

        try {
            const buildResult = await this._deps.buildCommitter.commitBuild({
                buildMode: normalizedConfig.buildMode ?? 'replace',
                existingChannels,
                pendingToCreate,
                skippedCount,
                reachedMaxChannels: reachedMax,
                errorCount: planResult.errorsTotal,
                diff,
                signal: signal ?? null,
                reportProgress,
            });
            return buildResult.summary;
        } catch (e) {
            console.error('[ChannelSetup] Channel build failed:', summarizeErrorForLog(e));
            throw e;
        }
    }
}
