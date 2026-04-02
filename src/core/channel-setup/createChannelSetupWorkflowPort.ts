import type { ChannelSetupCoordinator } from './ChannelSetupCoordinator';
import type { ChannelSetupWorkflowPort } from './ChannelSetupWorkflowPort';

export interface CreateChannelSetupWorkflowPortDeps {
    getChannelSetupCoordinator: () => ChannelSetupCoordinator | null;
}

export const createChannelSetupWorkflowPort = (
    deps: CreateChannelSetupWorkflowPortDeps
): ChannelSetupWorkflowPort => {
    const requireChannelSetupCoordinator = (): ChannelSetupCoordinator => {
        const coordinator = deps.getChannelSetupCoordinator();
        if (!coordinator) {
            throw new Error('Channel setup not initialized');
        }
        return coordinator;
    };

    return {
        invalidateFacetSnapshot: (): void => requireChannelSetupCoordinator().invalidateFacetSnapshot(),
        getLibrariesForSetup: async (signal?: AbortSignal | null) =>
            requireChannelSetupCoordinator().getLibrariesForSetup(signal ?? null),
        getChannelSetupRecord: (serverId: string) => deps.getChannelSetupCoordinator()?.getSetupRecord(serverId) ?? null,
        getSetupContextForSelectedServer: () =>
            deps.getChannelSetupCoordinator()?.getSetupContextForSelectedServer() ?? 'unknown',
        getSetupPreview: async (config, options) => requireChannelSetupCoordinator().getSetupPreview(config, options),
        getSetupReview: async (config, options) => requireChannelSetupCoordinator().getSetupReview(config, options),
        getSetupPlanDiagnostics: async (config, options) =>
            requireChannelSetupCoordinator().getSetupPlanDiagnostics(config, options),
        createChannelsFromSetup: async (config, options) =>
            requireChannelSetupCoordinator().createChannelsFromSetup(config, options),
        markSetupComplete: (serverId, setupConfig) =>
            requireChannelSetupCoordinator().markSetupComplete(serverId, setupConfig),
    };
};
