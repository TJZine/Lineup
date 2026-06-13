import type { ChannelSetupCompletionResult, ChannelSetupConfig } from '../types';
import type { ChannelSetupRecordStore } from './ChannelSetupRecordStore';

export interface ChannelSetupCompletionTrackerDeps {
    recordStore: Pick<ChannelSetupRecordStore, 'markSetupComplete'>;
    clearRerunRequest: () => void;
}

export class ChannelSetupCompletionTracker {
    constructor(private readonly _deps: ChannelSetupCompletionTrackerDeps) {}

    markSetupComplete(serverId: string, setupConfig: ChannelSetupConfig): ChannelSetupCompletionResult {
        const result = this._deps.recordStore.markSetupComplete(serverId, setupConfig);
        if (result.ok) {
            this._deps.clearRerunRequest();
        }
        return result;
    }
}
