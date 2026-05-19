import * as domainTypes from '../model/domainTypes';
import type {
    EpgChannel,
    EpgItemDetails,
    EpgProgramItem,
    EpgScheduledProgram,
} from '../model/domainTypes';

describe('domainTypes', () => {
    const requiredChannelFields = {
        skipIntros: false,
        skipCredits: false,
        createdAt: 0,
        updatedAt: 0,
        lastContentRefresh: 0,
        itemCount: 0,
        totalDurationMs: 0,
    } as const;

    it('exports only type-level EPG domain contracts at runtime', () => {
        expect(domainTypes).toEqual({});
    });

    it('narrows the direct EPG schedule/detail contract shapes', () => {
        const details: EpgItemDetails = {
            ratingKey: 'item-1',
            type: 'episode',
            grandparentThumb: '/thumb.jpg',
            media: [
                {
                    parts: [
                        {
                            streams: [
                                {
                                    streamType: 1,
                                    title: 'Main',
                                    hdr: 'hdr10',
                                },
                            ],
                        },
                    ],
                },
            ],
        };
        const item: EpgProgramItem = {
            ratingKey: 'item-1',
            type: 'episode',
            title: 'Pilot',
            fullTitle: 'Show Name - Pilot',
            durationMs: 1_800_000,
            thumb: '/thumb.jpg',
            year: 2024,
            scheduledIndex: 3,
        };
        const program: EpgScheduledProgram = {
            item,
            scheduledStartTime: 1_000,
            scheduledEndTime: 2_000,
            elapsedMs: 250,
            remainingMs: 750,
            scheduleIndex: 1,
            loopNumber: 0,
            streamDescriptor: null,
            isCurrent: true,
        };
        const channel: EpgChannel = {
            id: 'channel-7',
            number: 7,
            name: 'Seven',
            icon: '/icon.png',
            buildStrategy: 'genres',
            sourceLibraryId: 'library-1',
            sourceLibraryName: 'Movies',
            contentSource: {
                type: 'library',
                libraryId: 'library-1',
                libraryType: 'movie',
                includeWatched: false,
            },
            playbackMode: 'shuffle',
            startTimeAnchor: 0,
            ...requiredChannelFields,
        };

        expect(details.media?.[0]?.parts?.[0]?.streams?.[0]?.hdr).toBe('hdr10');
        expect(program.item.fullTitle).toBe('Show Name - Pilot');
        expect(channel.contentSource.type).toBe('library');
        expect(channel.playbackMode).toBe('shuffle');
    });

    it('rejects channel color at the EPG channel type boundary', () => {
        const baseChannel: EpgChannel = {
            id: 'channel-8',
            number: 8,
            name: 'Eight',
            contentSource: { type: 'manual', items: [] },
            playbackMode: 'sequential',
            startTimeAnchor: 0,
            ...requiredChannelFields,
        };

        const channelWithRemovedColor: EpgChannel = {
            id: baseChannel.id,
            number: baseChannel.number,
            name: baseChannel.name,
            contentSource: baseChannel.contentSource,
            playbackMode: baseChannel.playbackMode,
            startTimeAnchor: baseChannel.startTimeAnchor,
            skipIntros: baseChannel.skipIntros,
            skipCredits: baseChannel.skipCredits,
            createdAt: baseChannel.createdAt,
            updatedAt: baseChannel.updatedAt,
            lastContentRefresh: baseChannel.lastContentRefresh,
            itemCount: baseChannel.itemCount,
            totalDurationMs: baseChannel.totalDurationMs,
            // @ts-expect-error EpgChannel intentionally rejects removed color metadata.
            color: '#ffffff',
        };

        expect((channelWithRemovedColor as Record<string, unknown>).color).toBe('#ffffff');
    });
});
