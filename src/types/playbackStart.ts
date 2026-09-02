export type PlaybackStartOutcome =
    | { kind: 'started' }
    | { kind: 'failed' }
    | { kind: 'superseded' };
