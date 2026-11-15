import { ChannelManager } from '../ChannelManager';
import { installMockLocalStorage, resetMockLocalStorage, restoreOriginalLocalStorage } from '../../../../__tests__/mocks/localStorage';
import { createMockItem, createMockLibrary } from './channel-manager-test-helpers';

installMockLocalStorage();

describe('ChannelManager season-zero Show authoring', () => {
    const library = createMockLibrary();
    const logger = { warn: jest.fn(), error: jest.fn() };
    let manager: ChannelManager;
    let reopenedManager: ChannelManager | undefined;

    beforeEach(() => {
        resetMockLocalStorage();
        jest.clearAllMocks();
        library.getShowEpisodes.mockResolvedValue([
            createMockItem({
                ratingKey: 'special-s0e1',
                type: 'episode',
                title: 'Holiday Special',
                grandparentTitle: 'My Show',
                seasonNumber: 0,
                episodeNumber: 1,
            }),
            createMockItem({
                ratingKey: 'episode-s1e1',
                type: 'episode',
                title: 'Regular Episode',
                grandparentTitle: 'My Show',
                seasonNumber: 1,
                episodeNumber: 1,
            }),
        ]);
        manager = new ChannelManager({ plexLibrary: library, logger });
    });

    afterEach(() => {
        manager.dispose();
        reopenedManager?.dispose();
        reopenedManager = undefined;
    });

    afterAll(() => restoreOriginalLocalStorage());

    it('persists, reloads, and resolves an authored season-zero filter', async () => {
        const created = await manager.createChannel({
            playbackMode: 'sequential',
            contentSource: {
                type: 'show',
                showKey: 'show-1',
                showName: 'My Show',
                seasonFilter: [0],
            },
        });
        await manager.saveChannels();

        reopenedManager = new ChannelManager({ plexLibrary: library, logger });
        await expect(reopenedManager.loadChannels()).resolves.toMatchObject({
            kind: 'readable',
            channelCount: 1,
        });

        const reopened = reopenedManager.getChannel(created.id);
        if (!reopened || reopened.contentSource.type !== 'show') {
            throw new Error('Expected the saved Show channel to reopen');
        }
        expect(reopened.contentSource.seasonFilter).toEqual([0]);
        expect(reopened.includeSpecials).toBeUndefined();

        reopened.contentSource.seasonFilter?.push(1);
        const untouched = reopenedManager.getChannel(created.id);
        if (!untouched || untouched.contentSource.type !== 'show') {
            throw new Error('Expected the saved Show channel to remain available');
        }
        expect(untouched.contentSource.seasonFilter).toEqual([0]);

        const resolved = await reopenedManager.refreshChannelContent(created.id);
        expect(resolved.items.map((item) => item.ratingKey)).toEqual(['special-s0e1']);
        expect(resolved.items.map((item) => item.seasonNumber)).toEqual([0]);
    });
});
