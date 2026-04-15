import type { ChannelSetupConfig, ChannelBuildProgress } from '../../../core/channel-setup/types';
import type { ChannelSetupWorkflowPort } from '../../../core/channel-setup/ChannelSetupWorkflowPort';

export type ChannelSetupBuildOutcome =
    | { kind: 'missing-server' }
    | { kind: 'canceled' }
    | { kind: 'blocked'; message: string }
    | { kind: 'error'; message: string }
    | {
        kind: 'success';
        serverId: string;
        config: ChannelSetupConfig;
        result: Awaited<ReturnType<ChannelSetupWorkflowPort['createChannelsFromSetup']>>;
        bookkeepingError?: string;
    };

export type ChannelSetupBuildHandlers = {
    onProgress: (progress: ChannelBuildProgress) => void;
    onStateChange: () => void;
};
