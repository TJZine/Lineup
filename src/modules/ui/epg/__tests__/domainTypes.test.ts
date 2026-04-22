import * as domainTypes from '../model/domainTypes';
import type {
    EpgChannel,
    EpgItemDetails,
    EpgProgramItem,
    EpgScheduledProgram,
} from '../model/domainTypes';

describe('domainTypes', () => {
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
            color: '#ffffff',
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
        };

        expect(details.media?.[0]?.parts?.[0]?.streams?.[0]?.hdr).toBe('hdr10');
        expect(program.item.fullTitle).toBe('Show Name - Pilot');
        expect(channel.contentSource.type).toBe('library');
        expect(channel.playbackMode).toBe('shuffle');
    });
});
