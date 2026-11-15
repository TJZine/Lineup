export type ChannelLoadOutcome =
    | { kind: 'unloaded' | 'absent' | 'read-failed'; generation: number; revision: number }
    | { kind: 'unreadable' | 'unsupported'; generation: number; revision: number; replacementHandle: string }
    | { kind: 'readable' | 'readable-degraded' | 'valid-empty'; generation: number; revision: number; channelCount: number };

export type ChannelMutationOutcome<T> =
    | { kind: 'committed'; value: T; revision: number; pointerWarning: boolean }
    | { kind: 'invalid' | 'conflict' | 'storage-failure'; error: Error };

export type ChannelStructuralBase = Readonly<{ generation: number; revision: number }>;
