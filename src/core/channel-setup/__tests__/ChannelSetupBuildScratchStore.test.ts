/**
 * @jest-environment jsdom
 */

import { ChannelSetupBuildScratchStore } from '../ChannelSetupBuildScratchStore';

describe('ChannelSetupBuildScratchStore', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('creates paired temp keys with expected prefixes', () => {
        const store = new ChannelSetupBuildScratchStore({
            storageRemove: (_key: string): void => undefined,
        });

        const keys = store.createTempKeys();

        expect(keys.channelsKey).toMatch(/^lineup_channels_build_tmp_v1:/);
        expect(keys.currentChannelKey).toMatch(/^lineup_current_channel_build_tmp_v1:/);
    });

    it('cleanupKeys removes both provided temp keys', () => {
        const removed: string[] = [];
        const store = new ChannelSetupBuildScratchStore({
            storageRemove: (key: string): void => {
                removed.push(key);
            },
        });

        store.cleanupKeys({
            channelsKey: 'lineup_channels_build_tmp_v1:abc',
            currentChannelKey: 'lineup_current_channel_build_tmp_v1:def',
        });

        expect(removed).toEqual([
            'lineup_channels_build_tmp_v1:abc',
            'lineup_current_channel_build_tmp_v1:def',
        ]);
    });

    it('cleanupStaleBuildKeys removes stale build keys without touching setup records', () => {
        const store = new ChannelSetupBuildScratchStore({
            storageRemove: (_key: string): void => undefined,
        });
        localStorage.setItem('lineup_channels_build_tmp_v1:abc', '1');
        localStorage.setItem('lineup_current_channel_build_tmp_v1:def', '2');
        localStorage.setItem('lineup_channel_setup_v2:server-1', 'keep');

        store.cleanupStaleBuildKeys();

        expect(localStorage.getItem('lineup_channels_build_tmp_v1:abc')).toBeNull();
        expect(localStorage.getItem('lineup_current_channel_build_tmp_v1:def')).toBeNull();
        expect(localStorage.getItem('lineup_channel_setup_v2:server-1')).toBe('keep');
    });
});
