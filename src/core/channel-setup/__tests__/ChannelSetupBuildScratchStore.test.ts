/**
 * @jest-environment jsdom
 */

import { ChannelSetupBuildScratchStore } from '../build/ChannelSetupBuildScratchStore';

describe('ChannelSetupBuildScratchStore', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('cleanupStaleBuildKeys removes stale build keys without touching setup records', () => {
        const store = new ChannelSetupBuildScratchStore();
        localStorage.setItem('lineup_channels_build_tmp_v1:abc', '1');
        localStorage.setItem('lineup_current_channel_build_tmp_v1:def', '2');
        localStorage.setItem('lineup_channel_setup_v3:server-1:user-1', 'keep');
        localStorage.setItem('lineup_channels_v4', 'channels');
        localStorage.setItem('lineup_current_channel_v2', 'current');
        localStorage.setItem('lineup_selected_server_v1', 'server');

        store.cleanupStaleBuildKeys();

        expect(localStorage.getItem('lineup_channels_build_tmp_v1:abc')).toBeNull();
        expect(localStorage.getItem('lineup_current_channel_build_tmp_v1:def')).toBeNull();
        expect(localStorage.getItem('lineup_channel_setup_v3:server-1:user-1')).toBe('keep');
        expect(localStorage.getItem('lineup_channels_v4')).toBe('channels');
        expect(localStorage.getItem('lineup_current_channel_v2')).toBe('current');
        expect(localStorage.getItem('lineup_selected_server_v1')).toBe('server');
    });
});
