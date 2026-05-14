import type { IPlexLibrary } from '../../../modules/plex/library';
import type { IChannelManager } from '../../../modules/scheduler/channel-manager';
import type { ChannelSetupBuildExecutor } from '../build/ChannelSetupBuildExecutor';
import type { ChannelSetupBuildScratchStore } from '../build/ChannelSetupBuildScratchStore';
import type { ChannelSetupRecordStore } from '../persistence/ChannelSetupRecordStore';
import type { ChannelSetupPlanningService } from '../planning/ChannelSetupPlanningService';
import type { ChannelSetupRecord } from '../types';
import type { ChannelSetupWorkflowPortOwners } from './createChannelSetupWorkflowPort';
import { summarizeErrorForLog } from '../../../utils/errors';

export interface LazyChannelSetupWorkflowPortOwnersDeps {
    plexLibrary: IPlexLibrary;
    channelManager: IChannelManager;
    scratchStore: ChannelSetupBuildScratchStore;
    recordStore: ChannelSetupRecordStore;
    ensureEpgInitialized: () => Promise<void>;
    clearSelectedChannelScheduleSnapshot: () => void;
    primeEpgChannels: () => void;
    refreshEpgSchedules: (options?: { reason?: string; debounceMs?: number }) => Promise<void>;
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
            markSetupComplete: (serverId, setupConfig): ChannelSetupRecord => {
                const record = deps.recordStore.markSetupComplete(serverId, setupConfig);
                deps.clearRerunRequest();
                return record;
            },
        },
        getSelectedServerId: deps.getSelectedServerId,
        getExistingChannelCount: deps.getExistingChannelCount,
    };
}
