import { safeLocalStorageRemoveByPrefixes } from '../../../utils/storage';

const CHANNELS_BUILD_TMP_PREFIX = 'lineup_channels_build_tmp_v1:';
const CURRENT_CHANNEL_BUILD_TMP_PREFIX = 'lineup_current_channel_build_tmp_v1:';

export class ChannelSetupBuildScratchStore {
    cleanupStaleBuildKeys(): void {
        safeLocalStorageRemoveByPrefixes([
            CHANNELS_BUILD_TMP_PREFIX,
            CURRENT_CHANNEL_BUILD_TMP_PREFIX,
        ]);
    }
}
