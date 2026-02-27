/**
 * @jest-environment jsdom
 */
import { INFO_BANNER_AUTO_HIDE_MS, PlayerOsdCoordinator } from '../PlayerOsdCoordinator';
import type { IPlayerOsdOverlay } from '../interfaces';
import type { INavigationManager } from '../../../navigation';
import type { IVideoPlayer } from '../../../player';
import type { AudioTrack, PlaybackState, SubtitleTrack } from '../../../player/types';
import type { ChannelConfig } from '../../../scheduler/channel-manager';
import type { ScheduledProgram } from '../../../scheduler/scheduler';

const AUTO_HIDE_MS = 3000;

type CoordinatorOptions = ConstructorParameters<typeof PlayerOsdCoordinator>[0];

const makeState = (status: PlaybackState['status']): PlaybackState => ({
    status,
    currentTimeMs: 0,
    durationMs: 100_000,
    bufferPercent: 0,
    volume: 1,
    isMuted: false,
    playbackRate: 1,
    activeSubtitleId: null,
    activeAudioId: null,
    errorInfo: null,
});

const makeOverlay = (): IPlayerOsdOverlay & { _visible: boolean } => {
    const overlay = {
        _visible: false,
        initialize: jest.fn(),
        destroy: jest.fn(),
        show: jest.fn(() => {
            overlay._visible = true;
        }),
        hide: jest.fn(() => {
            overlay._visible = false;
        }),
        isVisible: jest.fn(() => overlay._visible),
        setViewModel: jest.fn(),
    } as unknown as IPlayerOsdOverlay & { _visible: boolean };
    return overlay;
};

const makeProgram = (): ScheduledProgram => ({
    item: {
        ratingKey: 'rk1',
        title: 'Program Title',
        fullTitle: 'Program Title',
        type: 'movie',
        durationMs: 100_000,
        thumb: null,
        year: 2024,
        scheduledIndex: 0,
    } as ScheduledProgram['item'],
    scheduledStartTime: Date.now() - 10_000,
    scheduledEndTime: Date.now() + 90_000,
    elapsedMs: 10_000,
    remainingMs: 90_000,
    scheduleIndex: 0,
    loopNumber: 0,
    streamDescriptor: null,
    isCurrent: true,
});

const makeChannel = (): ChannelConfig => ({
    id: 'ch1',
    name: 'Channel 1',
    number: 1,
} as ChannelConfig);

function makeCoordinatorOptions(
    overrides: Partial<CoordinatorOptions> = {}
): CoordinatorOptions {
    const overlay = makeOverlay();
    const navigation = {
        registerFocusable: jest.fn(),
        unregisterFocusable: jest.fn(),
        setFocus: jest.fn(),
        isModalOpen: jest.fn().mockReturnValue(false),
        openModal: jest.fn(),
    } as unknown as INavigationManager;
    const videoPlayer = {
        getState: jest.fn(() => makeState('playing')),
        getAvailableAudio: jest.fn(() => []),
        getAvailableSubtitles: jest.fn(() => []),
    } as unknown as IVideoPlayer;

    return {
        getOverlay: (): IPlayerOsdOverlay => overlay,
        getCurrentProgram: (): ScheduledProgram => makeProgram(),
        getNextProgram: (): ScheduledProgram | null => null,
        getCurrentChannel: (): ChannelConfig => makeChannel(),
        getVideoPlayer: (): IVideoPlayer => videoPlayer,
        getAutoHideMs: (): number => AUTO_HIDE_MS,
        getNavigation: (): INavigationManager => navigation,
        buildPlexResourceUrl: jest.fn().mockReturnValue(null),
        playbackOptionsModalId: 'playback-options',
        preparePlaybackOptionsModal: jest.fn().mockReturnValue({
            focusableIds: ['playback-subtitle-off'],
            preferredFocusId: 'playback-subtitle-off',
        }),
        ...overrides,
    };
}

const setup = (): {
    coordinator: PlayerOsdCoordinator;
    overlay: IPlayerOsdOverlay & { _visible: boolean };
    videoPlayer: IVideoPlayer;
    navigation: INavigationManager;
} => {
    const subtitles = document.createElement('button');
    subtitles.id = 'player-osd-action-subtitles';
    document.body.appendChild(subtitles);
    const sleep = document.createElement('button');
    sleep.id = 'player-osd-action-sleep';
    document.body.appendChild(sleep);
    const audio = document.createElement('button');
    audio.id = 'player-osd-action-audio';
    document.body.appendChild(audio);

    const options = makeCoordinatorOptions();
    const overlay = options.getOverlay() as IPlayerOsdOverlay & { _visible: boolean };
    const navigation = options.getNavigation() as INavigationManager;
    const videoPlayer = options.getVideoPlayer() as IVideoPlayer;

    const coordinator = new PlayerOsdCoordinator({
        ...options,
        getOverlay: (): IPlayerOsdOverlay => overlay,
        getNavigation: (): INavigationManager => navigation,
        getVideoPlayer: (): IVideoPlayer => videoPlayer,
    });

    return { coordinator, overlay, videoPlayer, navigation };
};

describe('PlayerOsdCoordinator', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        jest.useFakeTimers();
        jest.setSystemTime(0);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('refreshIfVisible does not update view model when overlay is hidden', () => {
        const { coordinator, overlay } = setup();
        expect(overlay.isVisible()).toBe(false);

        coordinator.refreshIfVisible();

        expect(overlay.setViewModel).not.toHaveBeenCalled();
    });

    it('refreshIfVisible triggers throttled render when overlay is visible', () => {
        const { coordinator, overlay } = setup();
        coordinator.poke('play');

        (overlay.setViewModel as jest.Mock).mockClear();
        coordinator.refreshIfVisible();

        jest.advanceTimersByTime(300);
        expect(overlay.setViewModel).toHaveBeenCalled();
    });

    it('labels active tracks', () => {
        const overlay = makeOverlay();
        const videoPlayer = {
            getState: jest.fn(() => ({
                ...makeState('playing'),
                activeAudioId: 'audio-1',
                activeSubtitleId: 'sub-1',
            })),
            getAvailableAudio: jest.fn(() => ([
                { id: 'audio-1', language: 'English', codec: 'aac', channels: 2 } as AudioTrack,
            ])),
            getAvailableSubtitles: jest.fn(() => ([
                { id: 'sub-1', label: 'English (SRT)' } as SubtitleTrack,
            ])),
        } as unknown as IVideoPlayer;

        const coordinator = new PlayerOsdCoordinator(
            makeCoordinatorOptions({
                getOverlay: (): IPlayerOsdOverlay => overlay,
                getCurrentProgram: (): ScheduledProgram => ({
                    ...makeProgram(),
                    item: { ...makeProgram().item, mediaInfo: { resolution: '4K' } },
                }),
                getVideoPlayer: (): IVideoPlayer => videoPlayer,
            })
        );

        coordinator.poke('play');

        const viewModel = (overlay.setViewModel as jest.Mock).mock.calls[0]?.[0] as {
            audioLabel?: string | null;
            subtitleLabel?: string | null;
        };
        expect(viewModel.audioLabel).toContain('English');
        expect(viewModel.subtitleLabel).toBe('English (SRT)');
    });

    it('pause shows and stays visible', () => {
        const { coordinator, overlay } = setup();

        coordinator.onPlayerStateChange(makeState('paused'));

        expect(overlay.show).toHaveBeenCalled();
        jest.advanceTimersByTime(AUTO_HIDE_MS * 2);
        expect(overlay.hide).not.toHaveBeenCalled();
    });

    it('play after poke auto-hides', () => {
        const { coordinator, overlay } = setup();

        coordinator.poke('play');
        coordinator.onPlayerStateChange(makeState('playing'));

        jest.advanceTimersByTime(AUTO_HIDE_MS - 1);
        expect(overlay.hide).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);
        expect(overlay.hide).toHaveBeenCalled();
    });

    it('fires visibility callback on show and hide', () => {
        const onVisibilityChange = jest.fn();
        const options = makeCoordinatorOptions({ onVisibilityChange });
        const coordinator = new PlayerOsdCoordinator(options);

        coordinator.poke('play');
        expect(onVisibilityChange).toHaveBeenCalledWith(true);

        coordinator.hide();
        expect(onVisibilityChange).toHaveBeenCalledWith(false);
    });

    it('timeUpdate ignored when hidden', () => {
        const { coordinator, overlay } = setup();
        overlay._visible = false;

        coordinator.onTimeUpdate({ currentTimeMs: 1000, durationMs: 10_000 });

        expect(overlay.setViewModel).not.toHaveBeenCalled();
    });

    it('throttles time updates while visible', () => {
        const { coordinator, overlay } = setup();

        coordinator.poke('play');
        (overlay.setViewModel as jest.Mock).mockClear();

        for (let i = 0; i < 10; i++) {
            coordinator.onTimeUpdate({ currentTimeMs: i * 1000, durationMs: 100_000 });
        }

        expect((overlay.setViewModel as jest.Mock).mock.calls.length).toBeLessThanOrEqual(1);

        jest.advanceTimersByTime(249);
        expect((overlay.setViewModel as jest.Mock).mock.calls.length).toBeLessThanOrEqual(1);

        jest.advanceTimersByTime(1);
        expect((overlay.setViewModel as jest.Mock).mock.calls.length).toBeLessThanOrEqual(2);
    });

    it('includes remaining minutes and ends at when not live', () => {
        const overlay = makeOverlay();
        const coordinator = new PlayerOsdCoordinator(
            makeCoordinatorOptions({
                getOverlay: (): IPlayerOsdOverlay => overlay,
                getCurrentProgram: (): ScheduledProgram => ({
                    ...makeProgram(),
                    scheduledEndTime: Date.now() + 5 * 60_000,
                }),
            })
        );

        coordinator.onTimeUpdate({ currentTimeMs: 0, durationMs: 100_000 });
        coordinator.poke('play');

        const viewModel = (overlay.setViewModel as jest.Mock).mock.calls[0]?.[0] as {
            endsAtText?: string | null;
        };
        expect(viewModel.endsAtText).toContain('m left');
        expect(viewModel.endsAtText).toContain('Ends');
    });

    it('hides ends line when live', () => {
        const overlay = makeOverlay();
        const videoPlayer = {
            getState: jest.fn(() => ({ ...makeState('playing'), durationMs: 0 })),
            getAvailableAudio: jest.fn(() => []),
            getAvailableSubtitles: jest.fn(() => []),
        } as unknown as IVideoPlayer;
        const coordinator = new PlayerOsdCoordinator(
            makeCoordinatorOptions({
                getOverlay: (): IPlayerOsdOverlay => overlay,
                getVideoPlayer: (): IVideoPlayer => videoPlayer,
            })
        );

        coordinator.poke('play');

        const viewModel = (overlay.setViewModel as jest.Mock).mock.calls[0]?.[0] as {
            endsAtText?: string | null;
        };
        expect(viewModel.endsAtText).toBeNull();
    });

    it('formats remaining label boundary at one minute', () => {
        const overlay = makeOverlay();
        const program = {
            ...makeProgram(),
            scheduledStartTime: 0,
            scheduledEndTime: 60_000,
        };
        const coordinator = new PlayerOsdCoordinator(
            makeCoordinatorOptions({
                getOverlay: (): IPlayerOsdOverlay => overlay,
                getCurrentProgram: (): ScheduledProgram => program,
            })
        );

        coordinator.onTimeUpdate({ currentTimeMs: 0, durationMs: 100_000 });
        coordinator.poke('play');
        let viewModel = (overlay.setViewModel as jest.Mock).mock.calls[0]?.[0] as {
            endsAtText?: string | null;
        };
        expect(viewModel.endsAtText).toContain('1m left');

        jest.setSystemTime(1000);
        (overlay.setViewModel as jest.Mock).mockClear();
        coordinator.poke('play');
        viewModel = (overlay.setViewModel as jest.Mock).mock.calls[0]?.[0] as {
            endsAtText?: string | null;
        };
        expect(viewModel.endsAtText).toContain('<1m left');
    });

    it('clears throttled timer and renders immediately on poke after timeupdate', () => {
        const { coordinator, overlay } = setup();

        coordinator.poke('play');
        (overlay.setViewModel as jest.Mock).mockClear();

        coordinator.onTimeUpdate({ currentTimeMs: 1000, durationMs: 100_000 });
        expect(overlay.setViewModel).not.toHaveBeenCalled();

        coordinator.poke('pause');
        expect(overlay.setViewModel).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(250);
        expect(overlay.setViewModel).toHaveBeenCalledTimes(1);
    });

    it('clears throttled timer on pause state change', () => {
        const { coordinator, overlay } = setup();

        coordinator.poke('play');
        (overlay.setViewModel as jest.Mock).mockClear();

        coordinator.onTimeUpdate({ currentTimeMs: 2000, durationMs: 100_000 });
        expect(overlay.setViewModel).not.toHaveBeenCalled();

        coordinator.onPlayerStateChange(makeState('paused'));
        expect(overlay.setViewModel).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(250);
        expect(overlay.setViewModel).toHaveBeenCalledTimes(1);
    });

    it('includes up next when available and not live', () => {
        const overlay = makeOverlay();
        const nextProgram = {
            ...makeProgram(),
            scheduledStartTime: 60_000,
            item: { ...makeProgram().item, title: 'Next Program' },
        } as ScheduledProgram;
        const videoPlayer = {
            getState: jest.fn(() => makeState('playing')),
            getAvailableAudio: jest.fn(() => []),
            getAvailableSubtitles: jest.fn(() => []),
        } as unknown as IVideoPlayer;
        const coordinator = new PlayerOsdCoordinator(
            makeCoordinatorOptions({
                getOverlay: (): IPlayerOsdOverlay => overlay,
                getCurrentProgram: (): ScheduledProgram => makeProgram(),
                getNextProgram: (): ScheduledProgram | null => nextProgram,
                getVideoPlayer: (): IVideoPlayer => videoPlayer,
            })
        );

        coordinator.onPlayerStateChange(makeState('playing'));

        const viewModel = (overlay.setViewModel as jest.Mock).mock.calls[0]?.[0] as {
            upNextText?: string;
        };
        const expectedTime = new Intl.DateTimeFormat(undefined, {
            hour: 'numeric',
            minute: '2-digit',
        }).format(new Date(60_000));
        expect(viewModel.upNextText).toBe(`Up next • ${expectedTime} — Next Program`);
    });

    it('omits up next when playback is live', () => {
        const overlay = makeOverlay();
        const nextProgram = {
            ...makeProgram(),
            scheduledStartTime: 60_000,
            item: { ...makeProgram().item, title: 'Next Program' },
        } as ScheduledProgram;
        const videoPlayer = {
            getState: jest.fn(() => ({ ...makeState('playing'), durationMs: 0 })),
            getAvailableAudio: jest.fn(() => []),
            getAvailableSubtitles: jest.fn(() => []),
        } as unknown as IVideoPlayer;
        const coordinator = new PlayerOsdCoordinator(
            makeCoordinatorOptions({
                getOverlay: (): IPlayerOsdOverlay => overlay,
                getCurrentProgram: (): ScheduledProgram => makeProgram(),
                getNextProgram: (): ScheduledProgram | null => nextProgram,
                getVideoPlayer: (): IVideoPlayer => videoPlayer,
            })
        );

        coordinator.poke('play');

        const viewModel = (overlay.setViewModel as jest.Mock).mock.calls[0]?.[0] as {
            upNextText?: string;
        };
        expect(viewModel.upNextText).toBeUndefined();
    });

    it('keeps info banner visible through transient loading/buffering/idle states', () => {
        const { coordinator, overlay } = setup();

        coordinator.showInfoBanner();
        expect(overlay.isVisible()).toBe(true);

        (overlay.hide as jest.Mock).mockClear();

        coordinator.onPlayerStateChange(makeState('buffering'));
        coordinator.onPlayerStateChange(makeState('loading'));
        coordinator.onPlayerStateChange(makeState('idle'));

        expect(overlay.hide).not.toHaveBeenCalled();
    });

    it('showInfoBanner does not register focusables', () => {
        const { coordinator, navigation } = setup();
        coordinator.showInfoBanner();
        expect(navigation.registerFocusable).not.toHaveBeenCalled();
    });

    it('showInfoBanner clears pending throttled renders', () => {
        const { coordinator, overlay } = setup();

        coordinator.poke('play');
        (overlay.setViewModel as jest.Mock).mockClear();

        coordinator.onTimeUpdate({ currentTimeMs: 1000, durationMs: 100_000 });
        coordinator.showInfoBanner();

        const callsAfterBanner = (overlay.setViewModel as jest.Mock).mock.calls.length;
        jest.advanceTimersByTime(250);
        expect((overlay.setViewModel as jest.Mock).mock.calls.length).toBe(callsAfterBanner);
    });

    it('restores interactive actions when paused during info banner', () => {
        const { coordinator, navigation, overlay } = setup();

        coordinator.showInfoBanner();
        expect(navigation.registerFocusable).not.toHaveBeenCalled();

        coordinator.onPlayerStateChange(makeState('paused'));

        const calls = (overlay.setViewModel as jest.Mock).mock.calls;
        const lastVm = calls[calls.length - 1]?.[0] as { infoOnly?: boolean };
        expect(lastVm?.infoOnly).toBeFalsy();
        expect(navigation.registerFocusable).toHaveBeenCalledTimes(3);
    });

    it('showInfoBanner auto-hides after 6s', () => {
        const { coordinator, overlay } = setup();
        coordinator.showInfoBanner();
        expect(overlay.show).toHaveBeenCalled();
        jest.advanceTimersByTime(INFO_BANNER_AUTO_HIDE_MS - 1);
        expect(overlay.hide).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        expect(overlay.hide).toHaveBeenCalled();
    });

    it('showInfoBanner preserves infoOnly on time updates while visible', () => {
        const { coordinator, overlay } = setup();

        coordinator.showInfoBanner();
        const firstVm = (overlay.setViewModel as jest.Mock).mock.calls[0]?.[0] as { infoOnly?: boolean };
        expect(firstVm?.infoOnly).toBe(true);

        coordinator.onTimeUpdate({ currentTimeMs: 1_000, durationMs: 10_000 });
        jest.advanceTimersByTime(300);

        const calls = (overlay.setViewModel as jest.Mock).mock.calls;
        const lastVm = calls[calls.length - 1]?.[0] as { infoOnly?: boolean };
        expect(lastVm?.infoOnly).toBe(true);
    });

    it('does not steal focus when a modal is open', () => {
        const { coordinator, navigation } = setup();
        (navigation.isModalOpen as jest.Mock).mockReturnValue(true);

        coordinator.onPlayerStateChange(makeState('paused'));

        expect(navigation.registerFocusable).toHaveBeenCalledTimes(3);
        expect(navigation.setFocus).not.toHaveBeenCalled();
    });
});
