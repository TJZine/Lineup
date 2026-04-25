/**
 * @jest-environment jsdom
 */

import { ChannelSetupBuildScratchStore } from '../build/ChannelSetupBuildScratchStore';
import { ChannelSetupCoordinator } from '../ChannelSetupCoordinator';
import { ChannelSetupRecordStore } from '../persistence/ChannelSetupRecordStore';

type CoordinatorHarness = {
    coordinator: ChannelSetupCoordinator;
    storage: Map<string, string>;
    navigationGoTo: jest.Mock;
    getSelectedServerId: jest.Mock<string | null, []>;
    getExistingChannelCount: jest.Mock<number, []>;
};

const createCoordinator = (overrides?: {
    selectedServerId?: string | null;
    existingChannelCount?: number;
}): CoordinatorHarness => {
    const storage = new Map<string, string>();
    const recordStore = new ChannelSetupRecordStore({
        storageGet: (key: string): string | null => storage.get(key) ?? null,
        storageSet: (key: string, value: string): void => void storage.set(key, value),
        storageRemove: (key: string): void => void storage.delete(key),
    });
    const navigationGoTo = jest.fn();
    const scratchStore = new ChannelSetupBuildScratchStore({
        storageRemove: (key: string): void => localStorage.removeItem(key),
    });
    const getSelectedServerId = jest.fn().mockReturnValue(
        overrides && 'selectedServerId' in overrides ? overrides.selectedServerId : 'server-1'
    );
    const getExistingChannelCount = jest.fn().mockReturnValue(
        overrides && 'existingChannelCount' in overrides ? overrides.existingChannelCount : 1
    );
    const coordinator = new ChannelSetupCoordinator({
        navigation: { goTo: navigationGoTo } as never,
        getSelectedServerId,
        recordStore,
        scratchStore,
        getExistingChannelCount,
    });

    return {
        coordinator,
        storage,
        navigationGoTo,
        getSelectedServerId,
        getExistingChannelCount,
    };
};

describe('ChannelSetupCoordinator', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('shouldRunChannelSetup returns false without selected server', () => {
        const { coordinator } = createCoordinator({ selectedServerId: null });
        expect(coordinator.shouldRunChannelSetup()).toBe(false);
    });

    it('shouldRunChannelSetup returns true when rerun requested', () => {
        const { coordinator } = createCoordinator();

        coordinator.requestChannelSetupRerun();

        expect(coordinator.shouldRunChannelSetup()).toBe(true);
    });

    it('clearRerunRequest resets rerun state', () => {
        const { coordinator, storage } = createCoordinator();
        storage.set('lineup_channel_setup_v2:server-1', JSON.stringify({
            serverId: 'server-1',
            selectedLibraryIds: ['lib-1'],
            strategyConfig: {
                collections: { enabled: true, priority: 1, scope: 'per-library' },
                playlists: { enabled: true, priority: 2, scope: 'per-library' },
                genres: { enabled: true, priority: 3, scope: 'per-library' },
                directors: { enabled: true, priority: 4, scope: 'per-library' },
                decades: { enabled: true, priority: 5, scope: 'per-library' },
                recentlyAdded: { enabled: true, priority: 6, scope: 'per-library' },
                studios: { enabled: true, priority: 7, scope: 'per-library' },
                actors: { enabled: true, priority: 8, scope: 'per-library' },
            },
            maxChannels: 10,
            buildMode: 'replace',
            actorStudioCombineMode: 'separate',
            minItemsPerChannel: 1,
            createdAt: 1,
            updatedAt: 2,
        }));

        coordinator.requestChannelSetupRerun();
        storage.set('lineup_channel_setup_v2:server-1', JSON.stringify({
            serverId: 'server-1',
            selectedLibraryIds: ['lib-1'],
            strategyConfig: {
                collections: { enabled: true, priority: 1, scope: 'per-library' },
                playlists: { enabled: true, priority: 2, scope: 'per-library' },
                genres: { enabled: true, priority: 3, scope: 'per-library' },
                directors: { enabled: true, priority: 4, scope: 'per-library' },
                decades: { enabled: true, priority: 5, scope: 'per-library' },
                recentlyAdded: { enabled: true, priority: 6, scope: 'per-library' },
                studios: { enabled: true, priority: 7, scope: 'per-library' },
                actors: { enabled: true, priority: 8, scope: 'per-library' },
            },
            maxChannels: 10,
            buildMode: 'replace',
            actorStudioCombineMode: 'separate',
            minItemsPerChannel: 1,
            createdAt: 1,
            updatedAt: 2,
        }));
        coordinator.clearRerunRequest();

        expect(coordinator.shouldRunChannelSetup()).toBe(false);
    });

    it('requestChannelSetupRerun clears stored setup record and navigates', () => {
        const { coordinator, storage, navigationGoTo } = createCoordinator({ selectedServerId: 'server-9' });
        storage.set('lineup_channel_setup_v2:server-9', JSON.stringify({
            serverId: 'server-9',
            selectedLibraryIds: ['lib-1'],
            strategyConfig: {
                collections: { enabled: true, priority: 1, scope: 'per-library' },
                playlists: { enabled: true, priority: 2, scope: 'per-library' },
                genres: { enabled: true, priority: 3, scope: 'per-library' },
                directors: { enabled: true, priority: 4, scope: 'per-library' },
                decades: { enabled: true, priority: 5, scope: 'per-library' },
                recentlyAdded: { enabled: true, priority: 6, scope: 'per-library' },
                studios: { enabled: true, priority: 7, scope: 'per-library' },
                actors: { enabled: true, priority: 8, scope: 'per-library' },
            },
            maxChannels: 10,
            buildMode: 'replace',
            actorStudioCombineMode: 'separate',
            minItemsPerChannel: 1,
            createdAt: 1,
            updatedAt: 2,
        }));

        coordinator.requestChannelSetupRerun();

        expect(storage.has('lineup_channel_setup_v2:server-9')).toBe(false);
        expect(navigationGoTo).toHaveBeenCalledWith('channel-setup');
    });

    it('shouldRunChannelSetup returns true with no channels', () => {
        const { coordinator } = createCoordinator({ existingChannelCount: 0 });
        expect(coordinator.shouldRunChannelSetup()).toBe(true);
    });

    it('cleanupStaleChannelBuildKeys removes only temp build keys', () => {
        const { coordinator } = createCoordinator();
        localStorage.setItem('lineup_channels_build_tmp_v1:abc', '1');
        localStorage.setItem('lineup_current_channel_build_tmp_v1:def', '2');
        localStorage.setItem('lineup_channel_setup_v2:server-1', 'keep');

        coordinator.cleanupStaleChannelBuildKeys();

        expect(localStorage.getItem('lineup_channels_build_tmp_v1:abc')).toBe(null);
        expect(localStorage.getItem('lineup_current_channel_build_tmp_v1:def')).toBe(null);
        expect(localStorage.getItem('lineup_channel_setup_v2:server-1')).toBe('keep');
    });
});
