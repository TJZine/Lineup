import type { ChannelLoadOutcome } from '../../modules/scheduler/channel-manager/contracts/ChannelDurability';

export type InitializationRestoreProjection = Readonly<{
    generation: number;
    phase: 'auth' | 'server' | 'read-lineup' | 'prepare-runtime' | 'prepare-guide' | 'complete';
    outcome: ChannelLoadOutcome['kind'] | 'auth-invalid' | 'server-unavailable' | 'superseded' | 'canceled' | 'restore-failed' | null;
    channelCount: number | null;
    requiredComplete: boolean;
    optionalComplete: boolean | null;
    reason: string | null;
    actions: readonly ('retry' | 'switch-server' | 'switch-profile' | 'rerun-setup' | 'support')[];
}>;

export class StartupRestoreBlockedError extends Error {
    constructor(readonly outcome: ChannelLoadOutcome) {
        super(`Saved lineup ${outcome.kind === 'unreadable' || outcome.kind === 'unsupported'
            ? 'cannot be read safely' : 'could not be loaded'}.`);
        this.name = 'StartupRestoreBlockedError';
    }
}
