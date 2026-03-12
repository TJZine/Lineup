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
import { ChannelSetupRecordStore } from './ChannelSetupRecordStore';
import { ChannelSetupRerunController } from './ChannelSetupRerunController';
import { ChannelSetupPlanningService } from './ChannelSetupPlanningService';
import { ChannelSetupBuildExecutor } from './ChannelSetupBuildExecutor';

export interface ChannelSetupCoordinatorDeps {
    // Primary modules
    plexLibrary: IPlexLibrary;
    channelManager: IChannelManager;
    navigation: INavigationManager;

    // Server + storage
    getSelectedServerId: () => string | null;
    storageGet: (key: string) => string | null;
    storageSet: (key: string, value: string) => void;
    storageRemove: (key: string) => void;

    // Orchestrator hooks
    handleGlobalError: (error: AppError, context: string) => void;

    // EPG hooks (do not inject the whole epg coordinator object)
    primeEpgChannels: () => void;
    refreshEpgSchedules: (options?: { reason?: string; debounceMs?: number }) => Promise<void>;

    // Channel manager storage configuration already exists in Orchestrator; we do not move it in this slice.
    // Rerun flag storage remains in-memory in this coordinator (not in localStorage).
}

export class ChannelSetupCoordinator {
    private readonly _planningService: ChannelSetupPlanningService;
    private readonly _buildExecutor: ChannelSetupBuildExecutor;
    private readonly _recordStore: ChannelSetupRecordStore;
    private readonly _rerunController: ChannelSetupRerunController;

    constructor(private readonly deps: ChannelSetupCoordinatorDeps) {
        this._planningService = new ChannelSetupPlanningService({
            plexLibrary: this.deps.plexLibrary,
            channelManager: this.deps.channelManager,
        });
        this._buildExecutor = new ChannelSetupBuildExecutor({
            plexLibrary: this.deps.plexLibrary,
            channelManager: this.deps.channelManager,
            storageRemove: (key: string): void => this.deps.storageRemove(key),
            primeEpgChannels: (): void => this.deps.primeEpgChannels(),
            refreshEpgSchedules: (options?: { reason?: string; debounceMs?: number }): Promise<void> =>
                this.deps.refreshEpgSchedules(options),
            planningService: this._planningService,
        });
        this._recordStore = new ChannelSetupRecordStore({
            storageGet: (key: string): string | null => this.deps.storageGet(key),
            storageSet: (key: string, value: string): void => this.deps.storageSet(key, value),
            storageRemove: (key: string): void => this.deps.storageRemove(key),
            normalizeConfig: (config: ChannelSetupConfig): ChannelSetupConfig => this._planningService.normalizeConfig(config),
        });
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
