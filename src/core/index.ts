/**
 * @fileoverview Core module exports.
 * @module core
 * @version 1.0.0
 */

export { InitializationCoordinator } from './InitializationCoordinator';
export { ChannelTuningCoordinator } from './channel-tuning';
export type { ChannelTuningCoordinatorDeps } from './channel-tuning';
export { ChannelSetupCoordinator } from './channel-setup';
export type { ChannelSetupCoordinatorDeps } from './channel-setup';
export { OrchestratorStorageContext } from './orchestrator/OrchestratorStorageContext';
export { OrchestratorEventBinder } from './orchestrator/OrchestratorEventBinder';
export type { OrchestratorEventBinderDeps } from './orchestrator/OrchestratorEventBinder';
export type {
    ChannelSetupConfig,
    ChannelBuildSummary,
    ChannelBuildProgress,
    ChannelSetupRecord,
    ChannelSetupPreview,
    ChannelSetupReview,
} from './channel-setup';
export { PlaybackStartController } from './PlaybackStartController';
export type { PlaybackStartControllerDeps } from './PlaybackStartController';
export { PlaybackRuntimeController } from './PlaybackRuntimeController';
export type { PlaybackRuntimeControllerDeps } from './PlaybackRuntimeController';
export { OverlayRuntimePolicyController } from './orchestrator/OverlayRuntimePolicyController';
export type { OverlayRuntimePolicyControllerDeps } from './orchestrator/OverlayRuntimePolicyController';
export { ProfileSwitchCleanupController } from './orchestrator/ProfileSwitchCleanupController';
export type { ProfileSwitchCleanupControllerDeps } from './orchestrator/ProfileSwitchCleanupController';
// Note: InitializationDependencies and InitializationCallbacks are intentionally
// NOT exported. They are internal implementation details used only by Orchestrator.
