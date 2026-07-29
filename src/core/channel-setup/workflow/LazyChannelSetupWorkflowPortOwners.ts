import type { IPlexLibrary } from '../../../modules/plex/library';
import type { IChannelManager } from '../../../modules/scheduler/channel-manager';
import type { ChannelSetupBuildExecutor } from '../build/ChannelSetupBuildExecutor';
import type { ChannelSetupEpgRefreshOptions } from '../build/ChannelSetupBuildCommitter';
import type { ChannelSetupBuildScratchStore } from '../build/ChannelSetupBuildScratchStore';
import type { ChannelSetupRecordStore } from '../persistence/ChannelSetupRecordStore';
import type { ChannelSetupPlanningService } from '../planning/ChannelSetupPlanningService';
import type { ChannelSetupWorkflowPortOwners } from './createChannelSetupWorkflowPort';
import { summarizeErrorForLog } from '../../../utils/errors';
import type { EpgScheduleRefreshResult } from '../../../shared/epgRefresh';
import type { ChannelSetupCompletionResult } from '../types';

export interface LazyChannelSetupWorkflowPortOwnersDeps {
    plexLibrary: IPlexLibrary;
    channelManager: IChannelManager;
    scratchStore: ChannelSetupBuildScratchStore;
    recordStore: ChannelSetupRecordStore;
    ensureEpgInitialized: () => Promise<void>;
    clearSelectedChannelScheduleSnapshot: () => void;
    primeEpgChannels: () => void;
    refreshEpgSchedules: (options?: ChannelSetupEpgRefreshOptions) => Promise<EpgScheduleRefreshResult>;
    clearRerunRequest: () => void;
    getSelectedServerId: () => string | null;
    getExistingChannelCount: () => number;
}

async function createPlanningService(
    deps: LazyChannelSetupWorkflowPortOwnersDeps
): Promise<ChannelSetupPlanningService> {
    const { ChannelSetupPlanningService } = await import('../planning/ChannelSetupPlanningService');
    return new ChannelSetupPlanningService({
        plexLibrary: deps.plexLibrary,
        channelManager: deps.channelManager,
    });
}

async function createBuildExecutor(
    deps: LazyChannelSetupWorkflowPortOwnersDeps,
    planningService: ChannelSetupPlanningService
): Promise<ChannelSetupBuildExecutor> {
    const [
        { ChannelSetupBuildCommitter },
        { ChannelSetupBuildExecutor },
    ] = await Promise.all([
        import('../build/ChannelSetupBuildCommitter'),
        import('../build/ChannelSetupBuildExecutor'),
    ]);
    const buildCommitter = new ChannelSetupBuildCommitter({
        plexLibrary: deps.plexLibrary,
        channelManager: deps.channelManager,
        scratchStore: deps.scratchStore,
        ensureEpgInitialized: deps.ensureEpgInitialized,
        clearSelectedChannelScheduleSnapshot: deps.clearSelectedChannelScheduleSnapshot,
        primeEpgChannels: deps.primeEpgChannels,
        refreshEpgSchedules: deps.refreshEpgSchedules,
    });
    return new ChannelSetupBuildExecutor({
        channelManager: deps.channelManager,
        planningService,
        buildCommitter,
    });
}

export function createLazyChannelSetupWorkflowPortOwners(
    deps: LazyChannelSetupWorkflowPortOwnersDeps
): ChannelSetupWorkflowPortOwners {
    let planningServicePromise: Promise<ChannelSetupPlanningService> | null = null;
    let buildExecutorPromise: Promise<ChannelSetupBuildExecutor> | null = null;

    const getPlanningService = (): Promise<ChannelSetupPlanningService> => {
        planningServicePromise ??= createPlanningService(deps).catch((error: unknown) => {
            planningServicePromise = null;
            throw error;
        });
        return planningServicePromise;
    };

    const getBuildExecutor = (): Promise<ChannelSetupBuildExecutor> => {
        buildExecutorPromise ??= getPlanningService().then((planningService) =>
            createBuildExecutor(deps, planningService)
        ).catch((error: unknown) => {
            buildExecutorPromise = null;
            throw error;
        });
        return buildExecutorPromise;
    };

    return {
        planningService: {
            invalidateFacetSnapshot: (): void => {
                const planningServiceLoad = planningServicePromise;
                if (!planningServiceLoad) {
                    return;
                }
                void planningServiceLoad
                    .then((planningService) => {
                        planningService.invalidateFacetSnapshot();
                    })
                    .catch((error: unknown) => {
                        // Best-effort invalidation should not surface from this void API.
                        globalThis.console?.debug?.(
                            'Channel setup invalidateFacetSnapshot failed',
                            summarizeErrorForLog(error)
                        );
                    });
            },
            getLibrariesForSetup: async (signal) =>
                (await getPlanningService()).getLibrariesForSetup(signal),
            getSetupPreview: async (config, options) =>
                (await getPlanningService()).getSetupPreview(config, options),
            getSetupReview: async (config, options) =>
                (await getPlanningService()).getSetupReview(config, options),
            getSetupPlanDiagnostics: async (config, options) =>
                (await getPlanningService()).getSetupPlanDiagnostics(config, options),
        },
        buildExecutor: {
            createChannelsFromSetup: async (config, options) =>
                (await getBuildExecutor()).createChannelsFromSetup(config, options),
        },
        recordStore: deps.recordStore,
        completionTracker: {
            markSetupComplete: (serverId, setupConfig): ChannelSetupCompletionResult => {
                const result = deps.recordStore.markSetupComplete(serverId, setupConfig);
                if (result.ok) {
                    deps.clearRerunRequest();
                }
                return result;
            },
        },
        getSelectedServerId: deps.getSelectedServerId,
        getExistingChannelCount: deps.getExistingChannelCount,
    };
}
