/**
 * @fileoverview Coordinates channel setup workflow and builds channel lineup.
 * @module core/channel-setup/ChannelSetupCoordinator
 * @version 1.0.0
 */

import type { IChannelManager } from '../../modules/scheduler/channel-manager';
import type { IPlexLibrary, PlexLibraryType } from '../../modules/plex/library';
import type { INavigationManager } from '../../modules/navigation';
import type { AppError } from '../../modules/lifecycle';

import type {
    ChannelSetupConfig,
    ChannelSetupContext,
    ChannelBuildSummary,
    ChannelBuildProgress,
    ChannelSetupRecord,
    ChannelSetupPreview,
    ChannelSetupReview,
} from './types';
import type { ChannelSetupPlanDiagnosticsResult } from './ChannelSetupPlanDiagnostics';
import { ChannelSetupRecordStore } from './ChannelSetupRecordStore';
import { ChannelSetupRerunController } from './ChannelSetupRerunController';
import { ChannelSetupPlanningService } from './ChannelSetupPlanningService';
import { ChannelSetupBuildCommitter } from './ChannelSetupBuildCommitter';
import { ChannelSetupBuildExecutor } from './ChannelSetupBuildExecutor';

export interface ChannelSetupCoordinatorDeps {
    // Primary modules
    plexLibrary: IPlexLibrary;
    channelManager: IChannelManager;
    navigation: INavigationManager;

    // Server + setup-record ownership
    getSelectedServerId: () => string | null;
    recordStore: Pick<ChannelSetupRecordStore, 'getRecord' | 'markSetupComplete' | 'clearRecord' | 'cleanupStaleBuildKeys'>;

    // Non-record storage callbacks required by build execution temp keys.
    storageRemove: (key: string) => void;

    // Orchestrator hooks
    handleGlobalError: (error: AppError, context: string) => void;

    // EPG hooks (do not inject the whole epg coordinator object)
    ensureEpgInitialized: () => Promise<void>;
    clearSelectedChannelScheduleSnapshot: () => void;
    primeEpgChannels: () => void;
    refreshEpgSchedules: (options?: { reason?: string; debounceMs?: number }) => Promise<void>;

    // Channel manager storage configuration already exists in Orchestrator; we do not move it in this slice.
    // Rerun flag storage remains in-memory in this coordinator (not in localStorage).
}

export class ChannelSetupCoordinator {
    private readonly _planningService: ChannelSetupPlanningService;
    private readonly _buildCommitter: ChannelSetupBuildCommitter;
    private readonly _buildExecutor: ChannelSetupBuildExecutor;
    private readonly _recordStore: Pick<ChannelSetupRecordStore, 'getRecord' | 'markSetupComplete' | 'clearRecord' | 'cleanupStaleBuildKeys'>;
    private readonly _rerunController: ChannelSetupRerunController;

    constructor(private readonly deps: ChannelSetupCoordinatorDeps) {
        this._planningService = new ChannelSetupPlanningService({
            plexLibrary: this.deps.plexLibrary,
            channelManager: this.deps.channelManager,
        });
        this._buildCommitter = new ChannelSetupBuildCommitter({
            plexLibrary: this.deps.plexLibrary,
            channelManager: this.deps.channelManager,
            storageRemove: (key: string): void => this.deps.storageRemove(key),
            ensureEpgInitialized: (): Promise<void> => this.deps.ensureEpgInitialized(),
            clearSelectedChannelScheduleSnapshot: (): void => this.deps.clearSelectedChannelScheduleSnapshot(),
            primeEpgChannels: (): void => this.deps.primeEpgChannels(),
            refreshEpgSchedules: (options?: { reason?: string; debounceMs?: number }): Promise<void> =>
                this.deps.refreshEpgSchedules(options),
        });
        this._buildExecutor = new ChannelSetupBuildExecutor({
            channelManager: this.deps.channelManager,
            planningService: this._planningService,
            buildCommitter: this._buildCommitter,
        });
        this._recordStore = this.deps.recordStore;
        this._rerunController = new ChannelSetupRerunController({
            navigation: this.deps.navigation,
            getSelectedServerId: (): string | null => this.deps.getSelectedServerId(),
            clearSetupRecord: (serverId: string): void => this._recordStore.clearRecord(serverId),
            getChannelCount: (): number => this.deps.channelManager.getAllChannels().length,
            hasSetupRecord: (serverId: string): boolean => this._recordStore.getRecord(serverId) !== null,
        });
    }

    // --- Public API mirrored from AppOrchestrator ---
    async getLibrariesForSetup(signal?: AbortSignal | null): Promise<PlexLibraryType[]> {
        return this._planningService.getLibrariesForSetup(signal ?? null);
    }

    getSetupRecord(serverId: string): ChannelSetupRecord | null {
        return this._recordStore.getRecord(serverId);
    }

    getSetupContextForSelectedServer(): ChannelSetupContext {
        const serverId = this.deps.getSelectedServerId();
        if (!serverId) {
            return 'unknown';
        }
        return this.deps.channelManager.getAllChannels().length === 0 ? 'first-time' : 'existing';
    }

    async getSetupPreview(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSetupPreview> {
        return this._planningService.getSetupPreview(config, options);
    }

    async getSetupReview(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSetupReview> {
        return this._planningService.getSetupReview(config, options);
    }

    async getSetupPlanDiagnostics(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSetupPlanDiagnosticsResult> {
        return this._planningService.getSetupPlanDiagnostics(config, options);
    }

    invalidateFacetSnapshot(): void {
        this._planningService.invalidateFacetSnapshot();
    }

    async createChannelsFromSetup(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal; onProgress?: (p: ChannelBuildProgress) => void }
    ): Promise<ChannelBuildSummary> {
        return this._buildExecutor.createChannelsFromSetup(config, options);
    }

    markSetupComplete(serverId: string, setupConfig: ChannelSetupConfig): void {
        this._recordStore.markSetupComplete(serverId, setupConfig);
        this._rerunController.clearRerunRequest();
    }

    requestChannelSetupRerun(): void {
        this._rerunController.requestChannelSetupRerun();
    }

    // --- Used by InitializationCoordinator + NavigationCoordinator ---
    shouldRunChannelSetup(): boolean {
        return this._rerunController.shouldRunChannelSetup();
    }

    // --- Called during initialize to clean up crash leftovers ---
    cleanupStaleChannelBuildKeys(): void {
        this._recordStore.cleanupStaleBuildKeys();
    }
}
