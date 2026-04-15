import type { PlexLibrarySection } from '../../modules/plex/library';
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
import type { ChannelSetupBuildExecutor } from './ChannelSetupBuildExecutor';
import type { ChannelSetupPlanningService } from './ChannelSetupPlanningService';
import type { ChannelSetupRecordStore } from './ChannelSetupRecordStore';
import type { ChannelSetupCompletionTracker } from './ChannelSetupCompletionTracker';

export interface ChannelSetupWorkflowDeps {
    planningService: ChannelSetupPlanningService;
    buildExecutor: ChannelSetupBuildExecutor;
    recordStore: Pick<ChannelSetupRecordStore, 'getRecord'>;
    completionTracker: Pick<ChannelSetupCompletionTracker, 'markSetupComplete'>;
    getSelectedServerId: () => string | null;
    getExistingChannelCount: () => number;
}

export class ChannelSetupWorkflow {
    constructor(private readonly _deps: ChannelSetupWorkflowDeps) {}

    invalidateFacetSnapshot(): void {
        this._deps.planningService.invalidateFacetSnapshot();
    }

    getLibrariesForSetup(signal?: AbortSignal | null): Promise<PlexLibrarySection[]> {
        return this._deps.planningService.getLibrariesForSetup(signal ?? null);
    }

    getSetupRecord(serverId: string): ChannelSetupRecord | null {
        return this._deps.recordStore.getRecord(serverId);
    }

    getSetupContextForSelectedServer(): ChannelSetupContext {
        const serverId = this._deps.getSelectedServerId();
        if (!serverId) {
            return 'unknown';
        }
        return this._deps.getExistingChannelCount() === 0 ? 'first-time' : 'existing';
    }

    getSetupPreview(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSetupPreview> {
        return this._deps.planningService.getSetupPreview(config, options);
    }

    getSetupReview(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSetupReview> {
        return this._deps.planningService.getSetupReview(config, options);
    }

    getSetupPlanDiagnostics(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSetupPlanDiagnosticsResult> {
        return this._deps.planningService.getSetupPlanDiagnostics(config, options);
    }

    createChannelsFromSetup(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal; onProgress?: (p: ChannelBuildProgress) => void }
    ): Promise<ChannelBuildSummary> {
        return this._deps.buildExecutor.createChannelsFromSetup(config, options);
    }

    markSetupComplete(serverId: string, setupConfig: ChannelSetupConfig): void {
        this._deps.completionTracker.markSetupComplete(serverId, setupConfig);
    }
}
