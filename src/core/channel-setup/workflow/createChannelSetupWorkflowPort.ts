import type {
    ChannelSetupWorkflowPort,
} from './ChannelSetupWorkflowPort';
import { ChannelSetupWorkflowUnavailableError } from './ChannelSetupWorkflowPort';
import type { ChannelSetupCompletionResult, ChannelSetupConfig, ChannelSetupContext } from '../types';
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
        | 'scanSetupInventory'
        | 'retrySetupInventory'
        | 'getSetupPreview'
        | 'getSetupPlanDiagnostics'
    >;
    buildExecutor: Pick<ChannelSetupBuildExecutor,
        'prepareSetupReview' | 'applySetupReview' | 'cancelPreparedReview'>;
    recordStore: Pick<ChannelSetupRecordStore, 'getRecord'>;
    completionTracker: { markSetupComplete(serverId: string, setupConfig: ChannelSetupConfig,
        expectedScopeKey: string): ChannelSetupCompletionResult };
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
        scanSetupInventory: async (config, options) =>
            requireOwners().planningService.scanSetupInventory(config, options),
        retrySetupInventory: (libraryId) => requireOwners().planningService.retrySetupInventory(libraryId),
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
        getSetupReview: async (config, options) => requireOwners().buildExecutor.prepareSetupReview(config, options),
        applySetupReview: async (reviewId, config, consent, options) =>
            requireOwners().buildExecutor.applySetupReview(reviewId, config, consent, options),
        cancelPreparedReview: () => requireOwners().buildExecutor.cancelPreparedReview(),
        getSetupPlanDiagnostics: async (config, options) =>
            requireOwners().planningService.getSetupPlanDiagnostics(config, options),
        markSetupComplete: (serverId, setupConfig, expectedScopeKey) =>
            requireOwners().completionTracker.markSetupComplete(serverId, setupConfig, expectedScopeKey),
    };
};
