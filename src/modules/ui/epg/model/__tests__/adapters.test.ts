import {
    toEpgChannel,
    toEpgItemDetails,
    toEpgScheduleWindow,
    toEpgScheduledProgram,
} from '../adapters';

type ChannelInput = {
    id: string;
    number: number;
    name: string;
    contentSource: { type: string; id: string };
};

type ProgramInput = {
    item: { ratingKey: string; title: string };
    scheduledStartTime: number;
    scheduledEndTime: number;
    elapsedMs: number;
    remainingMs: number;
};

type WindowInput = {
    startTime: number;
    endTime: number;
    programs: ProgramInput[];
};

type ItemInput = {
    ratingKey: string;
    title: string;
    media: Array<{
        id: number;
        parts: Array<{
            id: number;
            streams: Array<{ id: number; codec: string }>;
        }>;
    }>;
};

describe('EPG model adapters', () => {
    it('clones channel and scheduled-program nested data instead of leaking references', () => {
        const channel: ChannelInput = {
            id: 'channel-1',
            number: 1,
            name: 'News',
            contentSource: { type: 'playlist', id: 'playlist-1' },
        };
        const program: ProgramInput = {
            item: { ratingKey: 'item-1', title: 'Morning News' },
            scheduledStartTime: 0,
            scheduledEndTime: 1,
            elapsedMs: 0,
            remainingMs: 1,
        };

        const epgChannel = toEpgChannel(channel as never);
        const epgProgram = toEpgScheduledProgram(program as never);

        expect(epgChannel).not.toBe(channel);
        expect(epgChannel.contentSource).not.toBe(channel.contentSource);
        expect(epgProgram).not.toBe(program);
        expect(epgProgram.item).not.toBe(program.item);
    });

    it('clones schedule windows and item details recursively', () => {
        const window: WindowInput = {
            startTime: 0,
            endTime: 100,
            programs: [
                {
                    item: { ratingKey: 'item-1', title: 'Program' },
                    scheduledStartTime: 0,
                    scheduledEndTime: 100,
                    elapsedMs: 0,
                    remainingMs: 100,
                },
            ],
        };
        const item: ItemInput = {
            ratingKey: 'item-1',
            title: 'Program',
            media: [
                {
                    id: 1,
                    parts: [
                        {
                            id: 1,
                            streams: [{ id: 1, codec: 'aac' }],
                        },
                    ],
                },
            ],
        };

        const epgWindow = toEpgScheduleWindow(window as never);
        const epgItem = toEpgItemDetails(item as never);

        expect(epgWindow.programs).not.toBe(window.programs);
        expect(epgWindow.programs[0]).not.toBe(window.programs[0]);
        expect(epgWindow.programs[0]?.item).not.toBe(window.programs[0]?.item);
        expect(epgItem?.media).not.toBe(item.media);
        expect(epgItem?.media?.[0]?.parts).not.toBe(item.media[0]?.parts);
        expect(epgItem?.media?.[0]?.parts?.[0]?.streams).not.toBe(item.media[0]?.parts?.[0]?.streams);
        expect(toEpgItemDetails(null)).toBeNull();
    });
});
