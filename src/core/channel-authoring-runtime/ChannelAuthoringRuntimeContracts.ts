import type { ChannelConfig } from '../../modules/scheduler/channel-manager';

/** Opaque identity of the descriptor actually owned by the native player. */
export interface ActiveMediaIdentity {
    readonly sessionId: string;
    readonly scopeKey: string;
    readonly channelId: string;
}

export interface SavedChannelEffect {
    previous: ChannelConfig | null;
    saved: ChannelConfig;
    programmingChanged: boolean;
}

export interface ChannelAuthoringRuntime {
    getActiveMediaIdentity(): ActiveMediaIdentity | null;
    getDirectoryScopeKey(): string;
    stopDeletedMediaIfCurrent(identity: ActiveMediaIdentity): Promise<'stopped' | 'superseded'>;
    refreshAfterSave(effect: SavedChannelEffect): Promise<void>;
}
