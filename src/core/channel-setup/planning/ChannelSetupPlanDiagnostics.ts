import type { ChannelSetupPreviewFailureReason } from '../types';
import type { ChannelSetupPlannerDiagnostics } from './ChannelSetupPlanningTypes';

export interface ChannelSetupPlanDiagnosticsResult {
    status: 'ready' | 'blocked' | 'slow';
    diagnostics: ChannelSetupPlannerDiagnostics | null;
    warnings: string[];
    reachedMaxChannels: boolean;
    message?: string;
    failureReason?: ChannelSetupPreviewFailureReason;
}
