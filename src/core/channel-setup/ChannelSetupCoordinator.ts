/**
 * @fileoverview Coordinates channel setup rerun lifecycle policy.
 * @module core/channel-setup/ChannelSetupCoordinator
 * @version 1.0.0
 */

import type { INavigationManager } from '../../modules/navigation';
import { ChannelSetupRecordStore } from './ChannelSetupRecordStore';
import { ChannelSetupRerunController } from './ChannelSetupRerunController';

export interface ChannelSetupCoordinatorDeps {
    navigation: INavigationManager;
    getSelectedServerId: () => string | null;
    recordStore: Pick<ChannelSetupRecordStore, 'getRecord' | 'clearRecord' | 'cleanupStaleBuildKeys'>;
    getExistingChannelCount: () => number;
}

export class ChannelSetupCoordinator {
    private readonly _recordStore: Pick<ChannelSetupRecordStore, 'getRecord' | 'clearRecord' | 'cleanupStaleBuildKeys'>;
    private readonly _rerunController: ChannelSetupRerunController;

    constructor(private readonly deps: ChannelSetupCoordinatorDeps) {
        this._recordStore = this.deps.recordStore;
        this._rerunController = new ChannelSetupRerunController({
            navigation: this.deps.navigation,
            getSelectedServerId: (): string | null => this.deps.getSelectedServerId(),
            clearSetupRecord: (serverId: string): void => this._recordStore.clearRecord(serverId),
            getChannelCount: (): number => this.deps.getExistingChannelCount(),
            hasSetupRecord: (serverId: string): boolean => this._recordStore.getRecord(serverId) !== null,
        });
    }

    requestChannelSetupRerun(): void {
        this._rerunController.requestChannelSetupRerun();
    }

    clearRerunRequest(): void {
        this._rerunController.clearRerunRequest();
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
