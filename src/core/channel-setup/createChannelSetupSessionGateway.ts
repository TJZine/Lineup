import type { INavigationManager } from '../../modules/navigation';
import type { PlexLibraryType } from '../../modules/plex/library';
import type { ChannelSetupCoordinator } from './ChannelSetupCoordinator';
import type { ChannelSetupSessionGateway } from './ChannelSetupSessionGateway';
import type {
    ChannelBuildProgress,
    ChannelBuildSummary,
    ChannelSetupConfig,
    ChannelSetupContext,
    ChannelSetupPreview,
    ChannelSetupRecord,
    ChannelSetupReview,
} from './types';

export interface CreateChannelSetupSessionGatewayDeps {
    getNavigation: () => INavigationManager | null;
    getSelectedServerStorageKey: () => string;
    getServerHealthStorageKey: () => string;
    getSelectedServerId: () => string | null;
    openServerSelect: () => void;
    switchToChannelByNumber: (number: number, options?: { signal?: AbortSignal }) => Promise<void>;
    openEPG: () => void;
    getChannelSetupCoordinator: () => ChannelSetupCoordinator | null;
}

export const createChannelSetupSessionGateway = (
    deps: CreateChannelSetupSessionGatewayDeps
): ChannelSetupSessionGateway => {
    const requireChannelSetupCoordinator = (): ChannelSetupCoordinator => {
        const coordinator = deps.getChannelSetupCoordinator();
        if (!coordinator) {
            throw new Error('Channel setup not initialized');
        }
        return coordinator;
    };

    return {
        getNavigation: (): INavigationManager | null => deps.getNavigation(),
        getSelectedServerStorageKey: (): string => deps.getSelectedServerStorageKey(),
        getServerHealthStorageKey: (): string => deps.getServerHealthStorageKey(),
        getSelectedServerId: (): string | null => deps.getSelectedServerId(),
        openServerSelect: (): void => deps.openServerSelect(),
        switchToChannelByNumber: (number: number, options?: { signal?: AbortSignal }): Promise<void> =>
            deps.switchToChannelByNumber(number, options),
        openEPG: (): void => deps.openEPG(),
        requestChannelSetupRerun: (): void => requireChannelSetupCoordinator().requestChannelSetupRerun(),
        invalidateFacetSnapshot: (): void => requireChannelSetupCoordinator().invalidateFacetSnapshot(),
        getLibrariesForSetup: async (signal?: AbortSignal | null): Promise<PlexLibraryType[]> => {
            const coordinator = requireChannelSetupCoordinator();
            return coordinator.getLibrariesForSetup(signal ?? null);
        },
        getChannelSetupRecord: (serverId: string): ChannelSetupRecord | null =>
            deps.getChannelSetupCoordinator()?.getSetupRecord(serverId) ?? null,
        getSetupContextForSelectedServer: (): ChannelSetupContext =>
            deps.getChannelSetupCoordinator()?.getSetupContextForSelectedServer() ?? 'unknown',
        getSetupPreview: async (
            config: ChannelSetupConfig,
            options?: { signal?: AbortSignal }
        ): Promise<ChannelSetupPreview> => {
            const coordinator = requireChannelSetupCoordinator();
            return coordinator.getSetupPreview(config, options);
        },
        getSetupReview: async (
            config: ChannelSetupConfig,
            options?: { signal?: AbortSignal }
        ): Promise<ChannelSetupReview> => {
            const coordinator = requireChannelSetupCoordinator();
            return coordinator.getSetupReview(config, options);
        },
        getSetupPlanDiagnostics: async (
            config: ChannelSetupConfig,
            options?: { signal?: AbortSignal }
        ): ReturnType<ChannelSetupSessionGateway['getSetupPlanDiagnostics']> => {
            const coordinator = requireChannelSetupCoordinator();
            return coordinator.getSetupPlanDiagnostics(config, options);
        },
        createChannelsFromSetup: async (
            config: ChannelSetupConfig,
            options?: { signal?: AbortSignal; onProgress?: (p: ChannelBuildProgress) => void }
        ): Promise<ChannelBuildSummary> => {
            const coordinator = requireChannelSetupCoordinator();
            return coordinator.createChannelsFromSetup(config, options);
        },
        markSetupComplete: (serverId: string, setupConfig: ChannelSetupConfig): void =>
            requireChannelSetupCoordinator().markSetupComplete(serverId, setupConfig),
    };
};
