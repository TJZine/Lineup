import type { IChannelManager } from '../../../modules/scheduler/channel-manager';
import type { PlexLibrarySection } from '../../../modules/plex/library';
import type {
    ChannelBuildProgress,
    ChannelBuildSummary,
    ChannelSetupConfig,
} from '../types';
import { diffChannelPlans } from '../planning/ChannelSetupPlanningTypes';
import type { ChannelSetupPlanBuildResult, ChannelSetupPlanningService } from '../planning/ChannelSetupPlanningService';
import type { ChannelSetupBuildCommitter } from './ChannelSetupBuildCommitter';
import { isSignalAborted } from '../shared/utils';
import { normalizeChannelSetupConfig } from '../planning/normalizeChannelSetupConfig';
import { formatChannelSetupWarning } from '../shared/formatChannelSetupWarning';

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
        const workflowWarnings: string[] = [];
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
                workflowWarnings.push(formatChannelSetupWarning('[ChannelSetup] progress callback failed', error));
            }
        };

        const checkCanceled = (): boolean => {
            return signal?.aborted ?? false;
        };

        if (checkCanceled()) {
            return appendBuildWarnings(createCanceledBuildSummary('init'), workflowWarnings);
        }

        reportProgress('fetch_playlists', 'Preparing...', 'Loading libraries', 0, null);

        let libraries: PlexLibrarySection[];
        try {
            libraries = await this._deps.planningService.getLibrariesForSetup(signal ?? null);
        } catch (e) {
            if (isSignalAborted(signal ?? undefined)) {
                reportProgress('fetch_playlists', 'Preparing...', 'Canceled', 0, null);
                return appendBuildWarnings(createCanceledBuildSummary('fetch_playlists'), workflowWarnings);
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
                return appendBuildWarnings(createCanceledBuildSummary('build_pending'), workflowWarnings);
            }
            throw e;
        }

        workflowWarnings.push(...planResult.warnings);

        if (planResult.canceled || !planResult.plan) {
            return appendBuildWarnings({
                created: 0,
                skipped: 0,
                reachedMaxChannels: false,
                errorCount: planResult.errorsTotal,
                canceled: planResult.canceled,
                lastTask: planResult.lastTask ?? 'build_pending',
                ...(planResult.blockedMessage !== undefined ? { blockedMessage: planResult.blockedMessage } : {}),
            }, workflowWarnings);
        }

        const pending = planResult.plan.pendingChannels;
        let skippedCount = planResult.plan.skipped;
        let reachedMax = planResult.plan.reachedMaxChannels;

        if (checkCanceled()) {
            return appendBuildWarnings({
                ...createCanceledBuildSummary('build_pending'),
                skipped: skippedCount,
                reachedMaxChannels: reachedMax,
                errorCount: planResult.errorsTotal,
            }, workflowWarnings);
        }

        const existingChannels = this._deps.channelManager.getAllChannels();
        const diff = diffChannelPlans(existingChannels, pending);
        const pendingToCreate = this._deps.planningService.getPendingChannelsForMode(normalizedConfig.buildMode, pending, diff);

        reportProgress('create_channels', 'Shuffling...', 'Setting up lineup', 0, pendingToCreate.length);

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
        return appendBuildWarnings(buildResult.summary, workflowWarnings);
    }
}

function createCanceledBuildSummary(
    lastTask: NonNullable<ChannelBuildSummary['lastTask']>
): ChannelBuildSummary {
    return {
        created: 0,
        skipped: 0,
        reachedMaxChannels: false,
        errorCount: 0,
        canceled: true,
        lastTask,
    };
}

function appendBuildWarnings(
    summary: ChannelBuildSummary,
    warnings: string[]
): ChannelBuildSummary {
    if (warnings.length === 0) {
        return summary;
    }

    const existingWarnings = summary.warnings ?? [];
    return {
        ...summary,
        warnings: [...existingWarnings, ...warnings],
    };
}
