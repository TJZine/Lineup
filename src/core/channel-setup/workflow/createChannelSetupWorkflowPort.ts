import type {
    ChannelSetupWorkflowPort,
} from './ChannelSetupWorkflowPort';
import { ChannelSetupWorkflowUnavailableError } from './ChannelSetupWorkflowPort';
import type { ChannelSetupContext } from '../types';
import type { ChannelSetupRecordStore } from '../persistence/ChannelSetupRecordStore';
import type { ChannelSetupBuildExecutor } from '../build/ChannelSetupBuildExecutor';
import type { ChannelSetupPlanningService } from '../planning/ChannelSetupPlanningService';

export interface CreateChannelSetupWorkflowPortDeps {
    getOwners: () => ChannelSetupWorkflowPortOwners | null;
}

export interface ChannelSetupWorkflowPortOwners {
    planningService: Pick<
        ChannelSetupPlanningService,
        | 'invalidateFacetSnapshot'
        | 'invalidateSessionData'
        | 'getLibrariesForSetup'
        | 'getSetupPreview'
        | 'getSetupReview'
        | 'getSetupPlanDiagnostics'
    >;
    buildExecutor: Pick<ChannelSetupBuildExecutor, 'createChannelsFromSetup'>;
    recordStore: Pick<ChannelSetupRecordStore, 'getRecord'>;
    completionTracker: Pick<ChannelSetupRecordStore, 'markSetupComplete'>;
    getSelectedServerId: () => string | null;
    getExistingChannelCount: () => number;
}

export const createChannelSetupWorkflowPort = (
    deps: CreateChannelSetupWorkflowPortDeps
): ChannelSetupWorkflowPort => {
    const requireOwners = (): ChannelSetupWorkflowPortOwners => {
        const owners = deps.getOwners();
        if (!owners) {
            throw new ChannelSetupWorkflowUnavailableError();
        }
        return owners;
    };

    return {
        invalidateFacetSnapshot: (): void => requireOwners().planningService.invalidateFacetSnapshot(),
        invalidateSessionData: (): void => requireOwners().planningService.invalidateSessionData(),
        getLibrariesForSetup: async (signal?: AbortSignal | null) =>
            requireOwners().planningService.getLibrariesForSetup(signal ?? null),
        getChannelSetupRecord: (serverId: string) => requireOwners().recordStore.getRecord(serverId),
        getSetupContextForSelectedServer: (): ChannelSetupContext => {
            const owners = requireOwners();
            const serverId = owners.getSelectedServerId();
            if (!serverId) {
                return 'unknown';
            }
            return owners.getExistingChannelCount() === 0 ? 'first-time' : 'existing';
        },
        getSetupPreview: async (config, options) => requireOwners().planningService.getSetupPreview(config, options),
        getSetupReview: async (config, options) => requireOwners().planningService.getSetupReview(config, options),
        getSetupPlanDiagnostics: async (config, options) =>
            requireOwners().planningService.getSetupPlanDiagnostics(config, options),
        createChannelsFromSetup: async (config, options) =>
            requireOwners().buildExecutor.createChannelsFromSetup(config, options),
        markSetupComplete: (serverId, setupConfig) =>
            requireOwners().completionTracker.markSetupComplete(serverId, setupConfig),
    };
};
