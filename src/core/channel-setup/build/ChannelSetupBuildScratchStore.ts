import { safeLocalStorageRemoveByPrefixes } from '../../../utils/storage';

export type ChannelSetupBuildScratchKeys = {
    channelsKey: string;
    currentChannelKey: string;
};

export interface ChannelSetupBuildScratchStoreDeps {
    storageRemove: (key: string) => void;
}

const CHANNELS_BUILD_TMP_PREFIX = 'lineup_channels_build_tmp_v1:';
const CURRENT_CHANNEL_BUILD_TMP_PREFIX = 'lineup_current_channel_build_tmp_v1:';

export class ChannelSetupBuildScratchStore {
    constructor(private readonly _deps: ChannelSetupBuildScratchStoreDeps) {}

    createTempKeys(): ChannelSetupBuildScratchKeys {
        const keyId = `${Date.now()}-${generateUUID()}`;
        return {
            channelsKey: `${CHANNELS_BUILD_TMP_PREFIX}${keyId}`,
            currentChannelKey: `${CURRENT_CHANNEL_BUILD_TMP_PREFIX}${keyId}`,
        };
    }

    cleanupKeys(keys: ChannelSetupBuildScratchKeys): void {
        let firstError: unknown = null;
        try {
            this._deps.storageRemove(keys.channelsKey);
        } catch (error: unknown) {
            firstError = error;
        }

        let secondError: unknown = null;
        try {
            this._deps.storageRemove(keys.currentChannelKey);
        } catch (error: unknown) {
            secondError = error;
        }

        if (firstError !== null) {
            throw firstError;
        }
        if (secondError !== null) {
            throw secondError;
        }
    }

    cleanupStaleBuildKeys(): void {
        safeLocalStorageRemoveByPrefixes([
            CHANNELS_BUILD_TMP_PREFIX,
            CURRENT_CHANNEL_BUILD_TMP_PREFIX,
        ]);
    }
}

function generateUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try {
            return crypto.randomUUID();
        } catch {
            // Fall back to Math.random implementation.
        }
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
