export type ChannelSwitchFailureReason =
    | 'missing_channel'
    | 'missing_dependencies'
    | 'content_unavailable'
    | 'playback_start_failed';

export type ChannelSwitchOutcome =
    | { kind: 'switched' }
    | { kind: 'aborted' }
    | { kind: 'failed'; reason: ChannelSwitchFailureReason };

export interface ChannelSwitchPresentationOptions {
    signal?: AbortSignal;
    beforeProgramStart?: () => void;
}

export const CHANNEL_SWITCH_OUTCOME = {
    switched: { kind: 'switched' },
    aborted: { kind: 'aborted' },
    failed: (reason: ChannelSwitchFailureReason): ChannelSwitchOutcome => ({ kind: 'failed', reason }),
} as const satisfies {
    switched: ChannelSwitchOutcome;
    aborted: ChannelSwitchOutcome;
    failed: (reason: ChannelSwitchFailureReason) => ChannelSwitchOutcome;
};

export function isChannelSwitchAborted(outcome: ChannelSwitchOutcome): boolean {
    return outcome.kind === 'aborted';
}

export function isChannelSwitchFailed(outcome: ChannelSwitchOutcome): outcome is Extract<ChannelSwitchOutcome, { kind: 'failed' }> {
    return outcome.kind === 'failed';
}

export function isChannelSwitchSuccessful(outcome: ChannelSwitchOutcome): boolean {
    return outcome.kind === 'switched';
}
