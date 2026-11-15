import type { PlexLibrarySection } from '../../../modules/plex/library';
import type { ChannelSetupInventory } from '../planning/ChannelSetupInventory';
import type { ChannelSetupPlanDiagnosticsResult } from '../planning/ChannelSetupPlanDiagnostics';
import type {
    ChannelBuildProgress,
    ChannelSetupApplyResult,
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
    scanSetupInventory(config: ChannelSetupConfig, options?: {
        signal?: AbortSignal;
        onProgress?: (inventory: ChannelSetupInventory) => void;
    }): Promise<ChannelSetupInventory>;
    retrySetupInventory(libraryId: string): void;
    getChannelSetupRecord(serverId: string): ChannelSetupRecord | null;
    getSetupContextForSelectedServer(): ChannelSetupContext;
    getSetupPreview(config: ChannelSetupConfig, options?: { signal?: AbortSignal }): Promise<ChannelSetupPreview>;
    getSetupReview(config: ChannelSetupConfig, options?: {
        signal?: AbortSignal;
        acceptedReadyLibraryIds?: readonly string[];
        confirmedDeselectedLibraryIds?: readonly string[];
    }): Promise<ChannelSetupReview>;
    applySetupReview(reviewId: string, config: ChannelSetupConfig,
        consent: { removalConfirmedForReviewId: string | null;
            wholeLineupReplacementConfirmedForReviewId: string | null },
        options?: { signal?: AbortSignal; onProgress?: (p: ChannelBuildProgress) => void }): Promise<ChannelSetupApplyResult>;
    cancelPreparedReview(): void;
    getSetupPlanDiagnostics(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSetupPlanDiagnosticsResult>;
    markSetupComplete(serverId: string, setupConfig: ChannelSetupConfig,
        expectedScopeKey: string): ChannelSetupCompletionResult;
}
