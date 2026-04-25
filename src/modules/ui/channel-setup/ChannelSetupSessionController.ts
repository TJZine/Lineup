import type { ChannelSetupWorkflowPort } from '../../../core/channel-setup/workflow/ChannelSetupWorkflowPort';
import type { ChannelSetupConfig } from '../../../core/channel-setup/types';
import type {
    ChannelSetupBuildHandlers,
    ChannelSetupBuildOutcome,
    ChannelSetupSessionSnapshot,
    SetupStep,
    StrategyStepMutableState,
} from './ChannelSetupSessionContracts';
import {
    ChannelSetupSessionRuntime,
} from './ChannelSetupSessionRuntime';
import {
    ChannelSetupSessionState,
} from './ChannelSetupSessionState';

export class ChannelSetupSessionController {
    private readonly _state: ChannelSetupSessionState;
    private readonly _runtime: ChannelSetupSessionRuntime;

    constructor(deps: {
        workflowPort: ChannelSetupWorkflowPort;
        getSelectedServerId: () => string | null;
    }) {
        this._state = new ChannelSetupSessionState();
        this._runtime = new ChannelSetupSessionRuntime({
            workflowPort: deps.workflowPort,
            getSelectedServerId: deps.getSelectedServerId,
            state: this._state,
        });
    }

    getSnapshot(): ChannelSetupSessionSnapshot {
        return this._state.getSnapshot();
    }

    beginSession(): void {
        this._runtime.beginSession();
    }

    endSession(): void {
        this._runtime.endSession();
    }

    async loadLibraries(): Promise<void> {
        await this._runtime.loadLibraries();
    }

    syncSetupContext(): void {
        this._runtime.syncSetupContext();
    }

    setStep(step: SetupStep): void {
        this._runtime.setStep(step);
    }

    beginConfirmedBuild(): void {
        this._runtime.beginConfirmedBuild();
    }

    selectAllLibraries(): void {
        this._runtime.selectAllLibraries();
    }

    clearAllLibraries(): void {
        this._runtime.clearAllLibraries();
    }

    toggleLibrary(libraryId: string): boolean {
        return this._runtime.toggleLibrary(libraryId);
    }

    updateStrategyState(mutate: (draft: StrategyStepMutableState) => void): void {
        this._runtime.updateStrategyState(mutate);
    }

    clearReviewForEdits(): void {
        this._runtime.clearReviewForEdits();
    }

    clearReviewAndReturnToStep2(): void {
        this._runtime.clearReviewAndReturnToStep2();
    }

    toggleReplaceConfirm(): void {
        this._state.replaceConfirm = !this._state.replaceConfirm;
    }

    buildConfig(serverId: string): ChannelSetupConfig {
        return this._state.buildConfig(serverId);
    }

    buildPreviewKey(config: ChannelSetupConfig): string {
        return this._state.buildPreviewKey(config);
    }

    schedulePreview(onStateChange: () => void): void {
        this._runtime.schedulePreview(onStateChange);
    }

    async ensureReviewLoaded(onStateChange: () => void): Promise<void> {
        await this._runtime.ensureReviewLoaded(onStateChange);
    }

    async beginBuild(
        options: ChannelSetupBuildHandlers
    ): Promise<ChannelSetupBuildOutcome> {
        return this._runtime.beginBuild(options);
    }

    cancelBuild(): boolean {
        return this._runtime.cancelBuild();
    }
}
