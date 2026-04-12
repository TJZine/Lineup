export { AppOrchestrator, type PlaybackInfoSnapshot } from './core/orchestrator/AppOrchestrator';
export type { ModuleStatus, OrchestratorConfig } from './core/orchestrator/OrchestratorTypes';
export type {
    ChannelSetupConfig,
    ChannelSetupContext,
    ChannelBuildSummary,
    ChannelBuildProgress,
    ChannelSetupRecord,
    ChannelSetupPreview,
    ChannelSetupReview,
} from './core/channel-setup/types';
export type { OrchestratorServerSelectionResult } from './core/server-selection/ServerSelectionTypes';
export type { ErrorRecoveryAction } from './core/error-recovery/types';
export { AppErrorCode } from './modules/lifecycle';
