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
): ChannelSetupSessionGateway => ({
    getNavigation: (): INavigationManager | null => deps.getNavigation(),
    getSelectedServerStorageKey: (): string => deps.getSelectedServerStorageKey(),
    getServerHealthStorageKey: (): string => deps.getServerHealthStorageKey(),
    getSelectedServerId: (): string | null => deps.getSelectedServerId(),
    openServerSelect: (): void => deps.openServerSelect(),
    switchToChannelByNumber: (number: number, options?: { signal?: AbortSignal }): Promise<void> =>
        deps.switchToChannelByNumber(number, options),
    openEPG: (): void => deps.openEPG(),
    requestChannelSetupRerun: (): void => deps.getChannelSetupCoordinator()?.requestChannelSetupRerun(),
    invalidateFacetSnapshot: (): void => deps.getChannelSetupCoordinator()?.invalidateFacetSnapshot(),
    getLibrariesForSetup: (signal?: AbortSignal | null): Promise<PlexLibraryType[]> =>
        deps.getChannelSetupCoordinator()?.getLibrariesForSetup(signal ?? null)
        ?? Promise.reject(new Error('Channel setup not initialized')),
    getChannelSetupRecord: (serverId: string): ChannelSetupRecord | null =>
        deps.getChannelSetupCoordinator()?.getSetupRecord(serverId) ?? null,
    getSetupContextForSelectedServer: (): ChannelSetupContext =>
        deps.getChannelSetupCoordinator()?.getSetupContextForSelectedServer() ?? 'unknown',
    getSetupPreview: (
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSetupPreview> =>
        deps.getChannelSetupCoordinator()?.getSetupPreview(config, options)
        ?? Promise.reject(new Error('Channel setup not initialized')),
    getSetupReview: (
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSetupReview> =>
        deps.getChannelSetupCoordinator()?.getSetupReview(config, options)
        ?? Promise.reject(new Error('Channel setup not initialized')),
    createChannelsFromSetup: (
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal; onProgress?: (p: ChannelBuildProgress) => void }
    ): Promise<ChannelBuildSummary> =>
        deps.getChannelSetupCoordinator()?.createChannelsFromSetup(config, options)
        ?? Promise.reject(new Error('Channel setup not initialized')),
    markSetupComplete: (serverId: string, setupConfig: ChannelSetupConfig): void =>
        deps.getChannelSetupCoordinator()?.markSetupComplete(serverId, setupConfig),
});
