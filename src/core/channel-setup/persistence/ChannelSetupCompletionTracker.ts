import type { ChannelSetupConfig } from '../types';
import type { ChannelSetupRecordStore } from './ChannelSetupRecordStore';

export interface ChannelSetupCompletionTrackerDeps {
    recordStore: Pick<ChannelSetupRecordStore, 'markSetupComplete'>;
    clearRerunRequest: () => void;
}

export class ChannelSetupCompletionTracker {
    constructor(private readonly _deps: ChannelSetupCompletionTrackerDeps) {}

    markSetupComplete(serverId: string, setupConfig: ChannelSetupConfig): void {
        this._deps.recordStore.markSetupComplete(serverId, setupConfig);
        this._deps.clearRerunRequest();
    }
}
