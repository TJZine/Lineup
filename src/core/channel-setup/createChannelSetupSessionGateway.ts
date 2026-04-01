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
        getLibrariesForSetup: (signal?: AbortSignal | null): Promise<PlexLibraryType[]> =>
            requireChannelSetupCoordinator().getLibrariesForSetup(signal ?? null),
        getChannelSetupRecord: (serverId: string): ChannelSetupRecord | null =>
            deps.getChannelSetupCoordinator()?.getSetupRecord(serverId) ?? null,
        getSetupContextForSelectedServer: (): ChannelSetupContext =>
            deps.getChannelSetupCoordinator()?.getSetupContextForSelectedServer() ?? 'unknown',
        getSetupPreview: (
            config: ChannelSetupConfig,
            options?: { signal?: AbortSignal }
        ): Promise<ChannelSetupPreview> =>
            requireChannelSetupCoordinator().getSetupPreview(config, options),
        getSetupReview: (
            config: ChannelSetupConfig,
            options?: { signal?: AbortSignal }
        ): Promise<ChannelSetupReview> =>
            requireChannelSetupCoordinator().getSetupReview(config, options),
        createChannelsFromSetup: (
            config: ChannelSetupConfig,
            options?: { signal?: AbortSignal; onProgress?: (p: ChannelBuildProgress) => void }
        ): Promise<ChannelBuildSummary> =>
            requireChannelSetupCoordinator().createChannelsFromSetup(config, options),
        markSetupComplete: (serverId: string, setupConfig: ChannelSetupConfig): void =>
            requireChannelSetupCoordinator().markSetupComplete(serverId, setupConfig),
    };
};
