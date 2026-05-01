import type { ChannelSetupWorkflowPort } from './ChannelSetupWorkflowPort';

export type ChannelSetupScreenWorkflowPort = Omit<
    ChannelSetupWorkflowPort,
    'getSetupPlanDiagnostics'
>;
