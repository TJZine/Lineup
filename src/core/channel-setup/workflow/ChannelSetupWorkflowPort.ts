import type { PlexLibrarySection } from '../../../modules/plex/library';
import type { ChannelSetupPlanDiagnosticsResult } from '../planning/ChannelSetupPlanDiagnostics';
import type {
    ChannelBuildProgress,
    ChannelBuildSummary,
    ChannelSetupCompletionResult,
    ChannelSetupConfig,
    ChannelSetupContext,
    ChannelSetupPreview,
    ChannelSetupRecord,
    ChannelSetupReview,
} from '../types';

export const CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE = 'Channel setup not initialized';

export class ChannelSetupWorkflowUnavailableError extends Error {
    constructor(message: string = CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE) {
        super(message);
        this.name = 'ChannelSetupWorkflowUnavailableError';
    }
}

export function isChannelSetupWorkflowUnavailableError(error: unknown): boolean {
    return (
        error instanceof ChannelSetupWorkflowUnavailableError
        || (
            error instanceof Error
            && error.name === 'ChannelSetupWorkflowUnavailableError'
        )
    );
}

export interface ChannelSetupWorkflowPort {
    invalidateFacetSnapshot(): void;
    invalidateSessionData(): void;
    getLibrariesForSetup(signal?: AbortSignal | null): Promise<PlexLibrarySection[]>;
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
    markSetupComplete(serverId: string, setupConfig: ChannelSetupConfig): ChannelSetupCompletionResult;
}
