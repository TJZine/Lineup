import { PlexStreamResolver } from '../PlexStreamResolver';
import { createMockConfig, createMockMediaItem } from './testUtils';

describe('PlexStreamResolver subtitle error taxonomy', () => {
    it('throws SUBTITLE_STREAM_NOT_FOUND when subtitleStreamId is provided but stream missing', async () => {
        const itemWithoutSubtitle = createMockMediaItem();
        const resolver = new PlexStreamResolver(createMockConfig({
            getItem: jest.fn().mockResolvedValue(itemWithoutSubtitle),
        }));

        await expect(resolver.resolveStream({
            itemKey: '12345',
            subtitleStreamId: 'sub-missing',
        })).rejects.toMatchObject({
            code: 'SUBTITLE_STREAM_NOT_FOUND',
            stage: 'media_selection',
        });
    });

    it('throws SUBTITLE_STREAM_NOT_FOUND when burn-in requested but stream missing', async () => {
        const itemWithoutSubtitle = createMockMediaItem();
        const resolver = new PlexStreamResolver(createMockConfig({
            getItem: jest.fn().mockResolvedValue(itemWithoutSubtitle),
        }));

        await expect(resolver.resolveStream({
            itemKey: '12345',
            subtitleMode: 'burn',
            subtitleStreamId: 'sub-missing',
        })).rejects.toMatchObject({
            code: 'SUBTITLE_STREAM_NOT_FOUND',
            stage: 'media_selection',
        });
    });
});
