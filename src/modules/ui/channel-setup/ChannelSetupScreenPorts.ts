import type { INavigationManager } from '../../navigation';
import type { PlexLibrarySection } from '../../plex/library';
import type {
    ChannelBuildProgress,
    ChannelBuildSummary,
    ChannelSetupConfig,
    ChannelSetupContext,
    ChannelSetupPreview,
    ChannelSetupRecord,
    ChannelSetupReview,
} from '../../../core/channel-setup/types';

export interface ChannelSetupScreenWorkflowPort {
    invalidateFacetSnapshot(): void;
    getLibrariesForSetup(signal?: AbortSignal | null): Promise<PlexLibrarySection[]>;
    getChannelSetupRecord(serverId: string): ChannelSetupRecord | null;
    getSetupContextForSelectedServer(): ChannelSetupContext;
    getSetupPreview(config: ChannelSetupConfig, options?: { signal?: AbortSignal }): Promise<ChannelSetupPreview>;
    getSetupReview(config: ChannelSetupConfig, options?: { signal?: AbortSignal }): Promise<ChannelSetupReview>;
    createChannelsFromSetup(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal; onProgress?: (p: ChannelBuildProgress) => void }
    ): Promise<ChannelBuildSummary>;
    markSetupComplete(serverId: string, setupConfig: ChannelSetupConfig): void;
}

export interface ChannelSetupScreenPorts {
    getNavigation(): INavigationManager | null;
    getSelectedServerId(): string | null;
    openServerSelect(): void;
    switchToChannelByNumber(number: number, options?: { signal?: AbortSignal }): Promise<void>;
    openEPG(): void;
}
