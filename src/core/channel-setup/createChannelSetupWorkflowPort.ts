import type { ChannelSetupWorkflow } from './ChannelSetupWorkflow';
import {
    ChannelSetupWorkflowUnavailableError,
    type ChannelSetupWorkflowPort,
} from './ChannelSetupWorkflowPort';

export interface CreateChannelSetupWorkflowPortDeps {
    getChannelSetupWorkflow: () => ChannelSetupWorkflow | null;
}

export const createChannelSetupWorkflowPort = (
    deps: CreateChannelSetupWorkflowPortDeps
): ChannelSetupWorkflowPort => {
    const requireChannelSetupWorkflow = (): ChannelSetupWorkflow => {
        const workflow = deps.getChannelSetupWorkflow();
        if (!workflow) {
            throw new ChannelSetupWorkflowUnavailableError();
        }
        return workflow;
    };

    return {
        invalidateFacetSnapshot: (): void => requireChannelSetupWorkflow().invalidateFacetSnapshot(),
        getLibrariesForSetup: async (signal?: AbortSignal | null) =>
            requireChannelSetupWorkflow().getLibrariesForSetup(signal ?? null),
        getChannelSetupRecord: (serverId: string) => requireChannelSetupWorkflow().getSetupRecord(serverId),
        getSetupContextForSelectedServer: () => requireChannelSetupWorkflow().getSetupContextForSelectedServer(),
        getSetupPreview: async (config, options) => requireChannelSetupWorkflow().getSetupPreview(config, options),
        getSetupReview: async (config, options) => requireChannelSetupWorkflow().getSetupReview(config, options),
        getSetupPlanDiagnostics: async (config, options) =>
            requireChannelSetupWorkflow().getSetupPlanDiagnostics(config, options),
        createChannelsFromSetup: async (config, options) =>
            requireChannelSetupWorkflow().createChannelsFromSetup(config, options),
        markSetupComplete: (serverId, setupConfig) =>
            requireChannelSetupWorkflow().markSetupComplete(serverId, setupConfig),
    };
};
