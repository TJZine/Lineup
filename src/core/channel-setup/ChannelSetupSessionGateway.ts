import type { INavigationManager } from '../../modules/navigation';
import type { PlexLibraryType } from '../../modules/plex/library';
import type { ChannelSetupPlanDiagnosticsResult } from './ChannelSetupPlanDiagnostics';
import type {
    ChannelBuildProgress,
    ChannelBuildSummary,
    ChannelSetupConfig,
    ChannelSetupContext,
    ChannelSetupPreview,
    ChannelSetupRecord,
    ChannelSetupReview,
} from './types';

export interface ChannelSetupSessionGateway {
    getNavigation(): INavigationManager | null;
    getSelectedServerStorageKey(): string;
    getServerHealthStorageKey(): string;
    getSelectedServerId(): string | null;
    openServerSelect(): void;
    switchToChannelByNumber(number: number, options?: { signal?: AbortSignal }): Promise<void>;
    openEPG(): void;
    requestChannelSetupRerun(): void;
    invalidateFacetSnapshot(): void;
    getLibrariesForSetup(signal?: AbortSignal | null): Promise<PlexLibraryType[]>;
    getChannelSetupRecord(serverId: string): ChannelSetupRecord | null;
    getSetupContextForSelectedServer(): ChannelSetupContext;
    getSetupPreview(config: ChannelSetupConfig, options?: { signal?: AbortSignal }): Promise<ChannelSetupPreview>;
    getSetupReview(config: ChannelSetupConfig, options?: { signal?: AbortSignal }): Promise<ChannelSetupReview>;
    getSetupPlanDiagnostics(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSetupPlanDiagnosticsResult>;
    createChannelsFromSetup(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal; onProgress?: (p: ChannelBuildProgress) => void }
    ): Promise<ChannelBuildSummary>;
    markSetupComplete(serverId: string, setupConfig: ChannelSetupConfig): void;
}
