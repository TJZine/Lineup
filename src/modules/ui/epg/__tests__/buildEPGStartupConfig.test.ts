/**
 * @jest-environment jsdom
 */

import { APP_SHELL_CONTAINER_IDS } from '../../common/appShellContainerIds';
import { formatTimeRange } from '../utils';
import {
    buildEPGStartupConfig,
    CLASSIC_EPG_PIP_CLASS,
    type EPGStartupConfigInputs,
} from '../buildEPGStartupConfig';
import type { EPGConfig } from '../types';

const createBaseConfig = (): EPGConfig => ({
    containerId: 'epg',
    visibleChannels: 5,
    timeSlotMinutes: 30,
    visibleHours: 3,
    totalHours: 24,
    pixelsPerMinute: 4,
    rowHeight: 80,
    showCurrentTimeIndicator: true,
    autoScrollToNow: true,
});

const createInputs = (): EPGStartupConfigInputs => ({
    epgConfig: createBaseConfig(),
    plexLibrary: {
        getItem: jest.fn(),
        getImageUrl: jest.fn().mockReturnValue('https://resized.test/thumb.jpg'),
    } as unknown as EPGStartupConfigInputs['plexLibrary'],
    videoPlayer: {
        isPlaying: jest.fn().mockReturnValue(true),
    } as unknown as EPGStartupConfigInputs['videoPlayer'],
    channelManager: {
        getCurrentChannel: jest.fn().mockReturnValue({
            number: 7,
            name: 'Action',
        }),
    } as unknown as EPGStartupConfigInputs['channelManager'],
    scheduler: {
        getCurrentProgram: jest.fn().mockReturnValue({
            item: { title: 'Movie Night' },
            scheduledStartTime: Date.UTC(2026, 3, 13, 19, 0, 0, 0),
            scheduledEndTime: Date.UTC(2026, 3, 13, 21, 0, 0, 0),
        }),
    } as unknown as EPGStartupConfigInputs['scheduler'],
    buildPlexResourceUrl: jest.fn((path: string | null) => path ? `https://fallback.test${path}` : null),
    readEpgLayoutMode: jest.fn(() => 'classic'),
    readShowNowWatchingBanner: jest.fn(() => true),
    debugRuntime: null,
});

describe('buildEPGStartupConfig', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    it('clones fetched item details through toEpgItemDetails', async () => {
        const inputs = createInputs();
        const source = {
            ratingKey: 'rk-1',
            title: 'Movie',
            media: [{ parts: [{ streams: [{ id: 1 }] }] }],
        };
        (inputs.plexLibrary!.getItem as jest.Mock).mockResolvedValue(source);

        const config = buildEPGStartupConfig(inputs);
        const details = await config.fetchItemDetails?.('rk-1');

        expect(details).toEqual(source);
        expect(details).not.toBe(source);
        expect((inputs.plexLibrary!.getItem as jest.Mock)).toHaveBeenCalledWith(
            'rk-1',
            { signal: null }
        );
    });

    it('preserves current-channel time label formatting', () => {
        const inputs = createInputs();
        const config = buildEPGStartupConfig(inputs);
        const info = config.getCurrentChannelInfo?.();
        const expected = formatTimeRange(
            Date.UTC(2026, 3, 13, 19, 0, 0, 0),
            Date.UTC(2026, 3, 13, 21, 0, 0, 0)
        );

        expect(info).toEqual({
            channelNumber: 7,
            channelName: 'Action',
            programTitle: 'Movie Night',
            timeLabel: expected,
        });
    });

    it('toggles the classic PiP class on layout mode changes', () => {
        const inputs = createInputs();
        const config = buildEPGStartupConfig(inputs);
        const videoContainer = document.createElement('div');
        videoContainer.id = APP_SHELL_CONTAINER_IDS.VIDEO;
        document.body.appendChild(videoContainer);

        config.onLayoutModeChange?.('classic');
        expect(videoContainer.classList.contains(CLASSIC_EPG_PIP_CLASS)).toBe(true);

        config.onLayoutModeChange?.('overlay');
        expect(videoContainer.classList.contains(CLASSIC_EPG_PIP_CLASS)).toBe(false);
    });

    it('keeps null and missing dependency paths safe', async () => {
        const inputs = createInputs();
        inputs.plexLibrary = null;
        inputs.channelManager = null;
        inputs.scheduler = null;
        inputs.videoPlayer = null;
        const config = buildEPGStartupConfig(inputs);

        await expect(config.fetchItemDetails?.('rk-2')).resolves.toBeNull();
        expect(config.getCurrentChannelInfo?.()).toBeNull();
        expect(config.resolveThumbUrl?.(null)).toBeNull();
        expect(config.isVideoPlaying?.()).toBe(false);
    });

    it('preserves previous onLayoutModeChange and no-ops when the container is missing', () => {
        const previousOnLayoutModeChange = jest.fn();
        const inputs = createInputs();
        inputs.epgConfig = {
            ...inputs.epgConfig,
            onLayoutModeChange: previousOnLayoutModeChange,
        };
        const config = buildEPGStartupConfig(inputs);

        config.onLayoutModeChange?.('classic');

        expect(previousOnLayoutModeChange).toHaveBeenCalledWith('classic');
    });
});
