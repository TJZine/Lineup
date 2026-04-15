import type { PlexMediaItem } from '../../../../plex/library';
import type {
    ChannelConfig,
    ResolvedContentItem,
} from '../../../../scheduler/channel-manager';
import type {
    ScheduledProgram,
    ScheduleWindow,
} from '../../../../scheduler/scheduler';
import {
    toEpgChannel,
    toEpgItemDetails,
    toEpgScheduleWindow,
    toEpgScheduledProgram,
} from '../adapters';

const makeResolvedContentItem = (
    overrides: Partial<ResolvedContentItem> = {}
): ResolvedContentItem => ({
    ratingKey: 'item-1',
    type: 'episode',
    title: 'Program',
    fullTitle: 'Program',
    durationMs: 100,
    thumb: null,
    year: 2024,
    scheduledIndex: 0,
    ...overrides,
});

const makeChannel = (overrides: Partial<ChannelConfig> = {}): ChannelConfig => ({
    id: 'channel-1',
    number: 1,
    name: 'News',
    contentSource: {
        type: 'playlist',
        playlistKey: 'playlist-1',
        playlistName: 'Playlist 1',
    },
    playbackMode: 'sequential',
    startTimeAnchor: 0,
    skipIntros: false,
    skipCredits: false,
    createdAt: 0,
    updatedAt: 0,
    lastContentRefresh: 0,
    itemCount: 1,
    totalDurationMs: 100,
    ...overrides,
});

const makeScheduledProgram = (
    overrides: Partial<ScheduledProgram> = {}
): ScheduledProgram => ({
    item: makeResolvedContentItem(),
    scheduledStartTime: 0,
    scheduledEndTime: 100,
    elapsedMs: 0,
    remainingMs: 100,
    scheduleIndex: 0,
    loopNumber: 0,
    streamDescriptor: null,
    isCurrent: true,
    ...overrides,
});

const makeScheduleWindow = (
    overrides: Partial<ScheduleWindow> = {}
): ScheduleWindow => ({
    startTime: 0,
    endTime: 100,
    programs: [makeScheduledProgram()],
    ...overrides,
});

const makePlexMediaItem = (
    overrides: Partial<PlexMediaItem> = {}
): PlexMediaItem => ({
    ratingKey: 'item-1',
    key: '/library/metadata/1',
    type: 'episode',
    title: 'Program',
    sortTitle: 'Program',
    summary: 'Summary',
    year: 2024,
    durationMs: 100,
    addedAt: new Date(0),
    updatedAt: new Date(0),
    thumb: null,
    art: null,
    media: [
        {
            id: 'media-1',
            duration: 100,
            bitrate: 128000,
            width: 1920,
            height: 1080,
            aspectRatio: 1.78,
            videoCodec: 'h264',
            audioCodec: 'aac',
            audioChannels: 2,
            container: 'mp4',
            videoResolution: '1080',
            parts: [
                {
                    id: 'part-1',
                    key: '/library/parts/1',
                    duration: 100,
                    file: '/tmp/program.mp4',
                    size: 1024,
                    container: 'mp4',
                    streams: [
                        {
                            id: 'stream-1',
                            streamType: 2,
                            codec: 'aac',
                        },
                    ],
                },
            ],
        },
    ],
    ...overrides,
});

describe('EPG model adapters', () => {
    it('clones channel and scheduled-program nested data instead of leaking references', () => {
        const channel = makeChannel();
        const program = makeScheduledProgram({
            item: makeResolvedContentItem({
                title: 'Morning News',
                fullTitle: 'Morning News',
            }),
            scheduledEndTime: 1,
            remainingMs: 1,
        });

        const epgChannel = toEpgChannel(channel);
        const epgProgram = toEpgScheduledProgram(program);

        expect(epgChannel).toEqual(channel);
        expect(epgChannel).not.toBe(channel);
        expect(epgChannel.contentSource).toEqual(channel.contentSource);
        expect(epgChannel.contentSource).not.toBe(channel.contentSource);

        expect(epgProgram).toEqual(program);
        expect(epgProgram).not.toBe(program);
        expect(epgProgram.item).toEqual(program.item);
        expect(epgProgram.item).not.toBe(program.item);
    });

    it('clones schedule windows and item details recursively', () => {
        const window = makeScheduleWindow();
        const item = makePlexMediaItem();

        const epgWindow = toEpgScheduleWindow(window);
        const epgItem = toEpgItemDetails(item);
        const epgProgram = epgWindow.programs[0];
        const originalProgram = window.programs[0];

        expect(epgWindow).toEqual(window);
        expect(epgWindow.programs).not.toBe(window.programs);
        expect(epgProgram).toBeDefined();
        expect(originalProgram).toBeDefined();
        if (epgProgram === undefined || originalProgram === undefined) {
            throw new Error('Expected schedule windows to include one scheduled program');
        }
        expect(epgProgram).toEqual(originalProgram);
        expect(epgProgram).not.toBe(originalProgram);
        expect(epgProgram.item).toEqual(originalProgram.item);
        expect(epgProgram.item).not.toBe(originalProgram.item);

        expect(epgItem).not.toBeNull();
        if (epgItem === null) {
            throw new Error('Expected Plex item details to be cloned');
        }

        const epgMedia = epgItem.media;
        const originalMedia = item.media;
        const epgMediaFile = epgMedia?.[0];
        const originalMediaFile = originalMedia[0];
        const epgPart = epgMediaFile?.parts?.[0];
        const originalPart = originalMediaFile?.parts?.[0];
        const epgStreams = epgPart?.streams;
        const originalStreams = originalPart?.streams;

        expect(epgItem).toEqual(item);
        expect(epgItem).not.toBe(item);
        expect(epgMedia).toBeDefined();
        expect(epgMedia).toEqual(originalMedia);
        expect(epgMedia).not.toBe(originalMedia);
        expect(epgMediaFile).toBeDefined();
        expect(originalMediaFile).toBeDefined();
        if (
            epgMedia === undefined ||
            epgMediaFile === undefined ||
            originalMediaFile === undefined
        ) {
            throw new Error('Expected cloned Plex item media details to include one media file');
        }
        expect(epgMediaFile).toEqual(originalMediaFile);
        expect(epgMediaFile).not.toBe(originalMediaFile);
        expect(epgMediaFile.parts).toBeDefined();
        expect(originalMediaFile.parts).toBeDefined();
        expect(epgMediaFile.parts).toEqual(originalMediaFile.parts);
        expect(epgMediaFile.parts).not.toBe(originalMediaFile.parts);
        expect(epgPart).toBeDefined();
        expect(originalPart).toBeDefined();
        if (epgPart === undefined || originalPart === undefined) {
            throw new Error('Expected cloned Plex item media details to include one media part');
        }
        expect(epgPart).toEqual(originalPart);
        expect(epgPart).not.toBe(originalPart);
        expect(epgStreams).toBeDefined();
        expect(originalStreams).toBeDefined();
        if (epgStreams === undefined || originalStreams === undefined) {
            throw new Error('Expected cloned Plex item media details to include stream details');
        }
        expect(epgStreams).toEqual(originalStreams);
        expect(epgStreams).not.toBe(originalStreams);
        expect(epgStreams).toHaveLength(originalStreams.length);
        epgStreams.forEach((stream, index) => {
            expect(stream).toEqual(originalStreams[index]);
            expect(stream).not.toBe(originalStreams[index]);
        });
        expect(toEpgItemDetails(null)).toBeNull();
    });
});
