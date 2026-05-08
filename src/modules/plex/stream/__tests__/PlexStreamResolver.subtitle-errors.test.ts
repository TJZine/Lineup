import { PlexStreamResolver } from '../resolver/PlexStreamResolver';
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

    it('throws SUBTITLE_STREAM_NOT_FOUND when burn-in is requested without subtitleStreamId', async () => {
        const item = createMockMediaItem();
        const resolver = new PlexStreamResolver(createMockConfig({
            getItem: jest.fn().mockResolvedValue(item),
        }));

        await expect(
            resolver.resolveStream({
                itemKey: '12345',
                subtitleMode: 'burn',
            })
        ).rejects.toMatchObject({
            code: 'SUBTITLE_STREAM_NOT_FOUND',
            stage: 'media_selection',
        });
    });

    it('throws SUBTITLE_STREAM_NOT_FOUND with burn_in_selected_part stage when subtitle disappears after selection', async () => {
        const subtitleStreamId = 'sub-1';
        const item = createMockMediaItem(
            {},
            {
                extraStreams: [
                    {
                        id: subtitleStreamId,
                        streamType: 3,
                        codec: 'srt',
                        language: 'English',
                        languageCode: 'en',
                    },
                ],
            }
        );

        const part = item.media[0]?.parts[0];
        if (!part) {
            throw new Error('Missing test part');
        }

        const streamsWithSubtitle = part.streams;
        const streamsWithoutSubtitle = streamsWithSubtitle.filter(
            (stream) => !(stream.streamType === 3 && stream.id === subtitleStreamId)
        );

        let reads = 0;
        Object.defineProperty(part, 'streams', {
            get() {
                reads += 1;
                return reads <= 6 ? streamsWithSubtitle : streamsWithoutSubtitle;
            },
        });

        const resolver = new PlexStreamResolver(createMockConfig({
            getItem: jest.fn().mockResolvedValue(item),
        }));

        await expect(
            resolver.resolveStream({
                itemKey: '12345',
                subtitleMode: 'burn',
                subtitleStreamId,
            })
        ).rejects.toMatchObject({
            code: 'SUBTITLE_STREAM_NOT_FOUND',
            stage: 'burn_in_selected_part',
        });
    });
});
