import type { ModuleStatus } from './core/orchestrator/contracts/OrchestratorTypes';
import type { Screen } from './modules/navigation';

export { AppOrchestrator } from './core/orchestrator/AppOrchestrator';
export type { PlaybackInfoSnapshot } from './core/orchestrator/runtime/OrchestratorPlaybackInfoSnapshot';
export type { ModuleStatus } from './core/orchestrator/contracts/OrchestratorTypes';

export interface AppOrchestratorRuntime {
    getChannelAuthoringManager(): import('./core/app-shell/runtime/AppShellRuntimeContracts').AppShellAuthoringManager | null;
    getChannelAuthoringLibrary(): import('./core/app-shell/runtime/AppShellRuntimeContracts').AppShellAuthoringLibrary | null;
    getChannelAuthoringImageUrl(path: string, width: number, height: number): string | null;
    refreshChannelDirectoryAfterCommit(): Promise<void>;
    switchToChannelWithOutcome(channelId: string): Promise<import('./types/channelSwitch').ChannelSwitchOutcome>;
    subscribeToStartupRestoreProjection(listener: (projection: import('./core/initialization/InitializationRestoreProjection').InitializationRestoreProjection) => void): import('./utils/interfaces').IDisposable;
    getActiveMediaIdentity(): import('./core/channel-authoring-runtime/ChannelAuthoringRuntimeContracts').ActiveMediaIdentity | null;
    getDirectoryScopeKey(): string;
    stopDeletedMediaIfCurrent(identity: import('./core/channel-authoring-runtime/ChannelAuthoringRuntimeContracts').ActiveMediaIdentity): Promise<'stopped' | 'superseded'>;
    refreshAfterSave(effect: import('./core/channel-authoring-runtime/ChannelAuthoringRuntimeContracts').SavedChannelEffect): Promise<void>;
    getModuleStatus(): Map<string, ModuleStatus>;
    isReady(): boolean;
    getCurrentScreen(): Screen | null;
    openEPG(): void;
    closeEPG(): void;
    toggleEPG(): void;
}
