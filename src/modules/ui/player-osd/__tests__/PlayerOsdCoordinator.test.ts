/**
 * @jest-environment jsdom
 */
import { PlayerOsdCoordinator } from '../PlayerOsdCoordinator';
import { PlayerOsdOverlay } from '../PlayerOsdOverlay';
import { PLAYER_OSD_CONTAINER_ID } from '../constants';
import type { IPlayerOsdOverlay } from '../interfaces';
import type { INavigationManager } from '../../../navigation';
import { NavigationManager } from '../../../navigation';
import type { AudioTrack, IVideoPlayer, PlaybackState, StreamDescriptor, SubtitleTrack } from '../../../player';
import type { ChannelConfig } from '../../../scheduler/channel-manager';
import type { ScheduledProgram } from '../../../scheduler/scheduler';
import type { NowPlayingDisplayStore } from '../../../settings/NowPlayingDisplayStore';
import type { PlaybackOptionsSection } from '../../playback-options/types';

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

const makeOverlay = (): IPlayerOsdOverlay => {
    let visible = false;
    const overlay = {
        initialize: jest.fn(),
        destroy: jest.fn(),
        show: jest.fn(() => {
            visible = true;
        }),
        hide: jest.fn(() => {
            visible = false;
        }),
        isVisible: jest.fn(() => visible),
        setViewModel: jest.fn(),
    } as unknown as IPlayerOsdOverlay;
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
        getFocusedElement: jest.fn().mockReturnValue(null),
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
        nowPlayingDisplayStore: {
            readPreferClearLogosEnabledAndClean: jest.fn().mockReturnValue(true),
        } as unknown as NowPlayingDisplayStore,
        getTrackDrawer: (section) => ({ title: section, options: [] }),
        ...overrides,
    };
}

const setup = (overrides: Partial<CoordinatorOptions> = {}): {
    coordinator: PlayerOsdCoordinator;
    overlay: IPlayerOsdOverlay;
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

    const options = makeCoordinatorOptions(overrides);
    const overlay = options.getOverlay() as IPlayerOsdOverlay;
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

const selectRegisteredAction = (navigation: INavigationManager, id: string): void => {
    const calls = (navigation.registerFocusable as jest.Mock).mock.calls;
    const focusable = calls.map((call) => call[0]).find((candidate) => candidate?.id === id);
    if (!focusable?.onSelect) {
        throw new Error(`Focusable action not registered: ${id}`);
    }
    focusable.onSelect();
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

    it('explicit pause shows and stays visible', () => {
        const { coordinator, overlay } = setup();

        coordinator.onPlayerStateChange(makeState('paused'));
        coordinator.poke('pause');

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
        expect(overlay.isVisible()).toBe(false);

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

    it('keeps overlay copy local while using shared timecode formatting', () => {
        const overlay = makeOverlay();
        const coordinator = new PlayerOsdCoordinator(
            makeCoordinatorOptions({
                getOverlay: (): IPlayerOsdOverlay => overlay,
                getCurrentProgram: (): ScheduledProgram => ({
                    ...makeProgram(),
                    scheduledStartTime: 0,
                    scheduledEndTime: 4_000_000,
                }),
            })
        );

        coordinator.onTimeUpdate({ currentTimeMs: 3_723_000, durationMs: 4_000_000 });
        coordinator.poke('play');

        const viewModel = (overlay.setViewModel as jest.Mock).mock.calls[0]?.[0] as {
            timecode?: string;
            endsAtText?: string | null;
        };
        expect(viewModel.timecode).toBe('1:02:03 / 1:06:40');
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

        coordinator.poke('play');

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

    it('reveals compact controls with available actions', () => {
        const { coordinator, overlay, navigation } = setup();
        coordinator.revealCompact();
        expect(coordinator.getPresentationState()).toBe('compact');
        expect(overlay.isVisible()).toBe(true);
        expect(navigation.registerFocusable).toHaveBeenCalled();
        const vm = (overlay.setViewModel as jest.Mock).mock.calls[0]?.[0] as { actionIds?: Record<string, string> };
        expect(vm.actionIds?.subtitles).toBe('player-osd-action-subtitles');
    });

    it('expands only from a lower action without a Down neighbor', () => {
        const { coordinator, navigation } = setup();
        coordinator.revealCompact();
        (navigation.getFocusedElement as jest.Mock).mockReturnValue({
            id: 'player-osd-action-subtitles', neighbors: { down: 'player-osd-action-sleep' },
        });
        expect(coordinator.handleDown()).toBe(false);
        (navigation.getFocusedElement as jest.Mock).mockReturnValue({
            id: 'player-osd-action-audio', neighbors: {},
        });
        expect(coordinator.handleDown()).toBe(true);
        expect(coordinator.getPresentationState()).toBe('expanded');
    });

    it('does not steal focus when a modal is open', () => {
        const { coordinator, navigation } = setup();
        (navigation.isModalOpen as jest.Mock).mockReturnValue(true);

        coordinator.onPlayerStateChange(makeState('paused'));

        expect(navigation.registerFocusable).not.toHaveBeenCalled();
        expect(navigation.setFocus).not.toHaveBeenCalled();
    });

    it('registers OSD actions with scroll-neutral native focus', () => {
        const { coordinator, navigation } = setup();

        coordinator.poke('play');

        const focusables = (navigation.registerFocusable as jest.Mock).mock.calls.map(
            (call) => call[0]
        );
        expect(focusables).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'player-osd-action-subtitles',
                preventScrollOnFocus: true,
            }),
            expect.objectContaining({
                id: 'player-osd-action-sleep',
                preventScrollOnFocus: true,
            }),
            expect.objectContaining({
                id: 'player-osd-action-audio',
                preventScrollOnFocus: true,
            }),
        ]));
        expect(navigation.setFocus).toHaveBeenCalledWith('player-osd-action-subtitles', { persist: false });
    });

    it('opens audio and subtitles as Player children and returns through Back', () => {
        const getTrackDrawer = jest.fn((section: 'audio' | 'subtitles') => ({
            title: section, options: [],
        }));
        const { coordinator, navigation } = setup({ getTrackDrawer });
        coordinator.revealCompact();
        selectRegisteredAction(navigation, 'player-osd-action-subtitles');
        expect(coordinator.getPresentationState()).toBe('subtitles');
        expect(getTrackDrawer).toHaveBeenCalledWith('subtitles');
        expect(navigation.openModal).not.toHaveBeenCalled();
        expect(coordinator.handleBack()).toBe(true);
        expect(coordinator.getPresentationState()).toBe('compact');
        selectRegisteredAction(navigation, 'player-osd-action-audio');
        expect(coordinator.getPresentationState()).toBe('audio');
        expect(coordinator.handleBack()).toBe(true);
        expect(coordinator.getPresentationState()).toBe('compact');
        coordinator.expand();
        selectRegisteredAction(navigation, 'player-osd-action-subtitles');
        expect(coordinator.getPresentationState()).toBe('subtitles');
        expect(coordinator.handleBack()).toBe(true);
        expect(coordinator.getPresentationState()).toBe('expanded');
        expect(navigation.setFocus).toHaveBeenCalledWith('player-osd-action-subtitles', { persist: false });
    });

    it('opens Sleep without changing its deadline; selecting Off applies explicitly', () => {
        const cycleSleepTimerPreset = jest.fn().mockReturnValue(0);
        const setSleepTimerMinutes = jest.fn();
        const { coordinator, overlay, navigation } = setup({
            cycleSleepTimerPreset,
            setSleepTimerMinutes,
            getSleepTimerRemainingMs: jest.fn().mockReturnValue(0),
        });

        coordinator.poke('play');
        (overlay.setViewModel as jest.Mock).mockClear();

        selectRegisteredAction(navigation, 'player-osd-action-sleep');

        const calls = (overlay.setViewModel as jest.Mock).mock.calls;
        const lastViewModel = calls[calls.length - 1]?.[0] as { presentation?: string; sleepChoices?: Array<{minutes: number}> };
        expect(cycleSleepTimerPreset).not.toHaveBeenCalled();
        expect(setSleepTimerMinutes).not.toHaveBeenCalled();
        expect(lastViewModel.presentation).toBe('sleep');
        expect(lastViewModel.sleepChoices?.map((choice) => choice.minutes)).toEqual([0, 15, 30, 60, 90, 120]);
        coordinator.selectSleepMinutes(0);
        expect(setSleepTimerMinutes).toHaveBeenCalledWith(0);
    });

    it('does not reuse positive sleep action feedback after the active timer reaches zero', () => {
        let sleepTimerRemainingMs = 0;
        const cycleSleepTimerPreset = jest.fn().mockReturnValue(15);
        const { coordinator, overlay, navigation } = setup({
            cycleSleepTimerPreset,
            getSleepTimerRemainingMs: jest.fn(() => sleepTimerRemainingMs),
        });

        coordinator.poke('play');
        sleepTimerRemainingMs = 15 * 60_000;
        selectRegisteredAction(navigation, 'player-osd-action-sleep');

        let calls = (overlay.setViewModel as jest.Mock).mock.calls;
        let lastViewModel = calls[calls.length - 1]?.[0] as { sleepTimerText?: string | null };
        expect(lastViewModel.sleepTimerText).toBe('Sleep 15:00');

        sleepTimerRemainingMs = 0;
        (overlay.setViewModel as jest.Mock).mockClear();
        coordinator.refreshIfVisible();
        jest.advanceTimersByTime(300);

        calls = (overlay.setViewModel as jest.Mock).mock.calls;
        lastViewModel = calls[calls.length - 1]?.[0] as { sleepTimerText?: string | null };
        expect(lastViewModel.sleepTimerText).toBeUndefined();
    });

    it('omits clearLogoUrl when prefer clear logos is disabled', () => {
        const overlay = makeOverlay();
        const coordinator = new PlayerOsdCoordinator(
            makeCoordinatorOptions({
                getOverlay: () => overlay,
                getCurrentProgram: () => ({
                    ...makeProgram(),
                    item: { ...makeProgram().item, clearLogo: '/logo' } as unknown as ScheduledProgram['item'],
                }),
                buildPlexResourceUrl: jest.fn((path) => `http://mock${path}`) as unknown as (path: string) => string,
                nowPlayingDisplayStore: {
                    readPreferClearLogosEnabledAndClean: jest.fn().mockReturnValue(false),
                } as unknown as NowPlayingDisplayStore,
            })
        );

        coordinator.poke('play');

        const vm = (overlay.setViewModel as jest.Mock).mock.calls[0]?.[0] as { clearLogoUrl?: string | null };
        expect(vm.clearLogoUrl).toBeUndefined();
    });

    it('restores the actual parent presentation when Sleep closes without a selection', () => {
        const { coordinator } = setup();
        coordinator.poke('status');
        coordinator.openSleep();
        expect(coordinator.getPresentationState()).toBe('sleep');
        expect(coordinator.closeChild()).toBe(true);
        expect(coordinator.getPresentationState()).toBe('compact');

        coordinator.expand();
        coordinator.openSleep();
        expect(coordinator.closeChild()).toBe(true);
        expect(coordinator.getPresentationState()).toBe('expanded');
    });

    it('keeps expanded details visible past the compact timeout', () => {
        const { coordinator, overlay } = setup();
        coordinator.poke('status');
        coordinator.expand();
        jest.advanceTimersByTime(AUTO_HIDE_MS * 2);
        expect(overlay.hide).not.toHaveBeenCalled();
        expect(coordinator.getPresentationState()).toBe('expanded');
    });

    it('aborts loading details on expanded Close and refetches on reopening', async () => {
        const requests: Array<{ signal: AbortSignal; resolve: (value: null) => void }> = [];
        const fetchProgramDetails = jest.fn((_ratingKey: string, signal: AbortSignal) =>
            new Promise<null>((resolve) => { requests.push({ signal, resolve }); }));
        const { coordinator, overlay } = setup({ fetchProgramDetails });
        coordinator.poke('status');
        coordinator.expand();
        expect(fetchProgramDetails).toHaveBeenCalledTimes(1);
        expect(requests[0]?.signal.aborted).toBe(false);
        expect(coordinator.closeChild()).toBe(true);
        expect(coordinator.getPresentationState()).toBe('compact');
        expect(requests[0]?.signal.aborted).toBe(true);
        expect(jest.getTimerCount()).toBe(1);
        const rendersAfterClose = (overlay.setViewModel as jest.Mock).mock.calls.length;
        requests[0]?.resolve(null);
        await Promise.resolve();
        expect((overlay.setViewModel as jest.Mock).mock.calls.length).toBe(rendersAfterClose);
        coordinator.expand();
        expect(fetchProgramDetails).toHaveBeenCalledTimes(2);
        expect(jest.getTimerCount()).toBe(0);
        const loading = (overlay.setViewModel as jest.Mock).mock.calls.slice(-1)[0]?.[0] as { detailStatus: string };
        expect(loading.detailStatus).toBe('loading');
        requests[1]?.resolve(null);
        await Promise.resolve();
        const settled = (overlay.setViewModel as jest.Mock).mock.calls.slice(-1)[0]?.[0] as { detailStatus: string };
        expect(settled.detailStatus).toBe('unavailable');
    });

    it('does not publish a late detail fetch after profile scope changes', async () => {
        let finishFetch: (value: null) => void = () => undefined;
        const fetchProgramDetails = jest.fn(() => new Promise<null>((resolve) => {
            finishFetch = resolve;
        }));
        let userId = 'user-1';
        const { coordinator, overlay } = setup({
            fetchProgramDetails,
            getScopeIdentity: () => ({ userId, serverId: 'server-1' }),
        });
        coordinator.poke('status');
        coordinator.expand();
        expect(fetchProgramDetails).toHaveBeenCalledTimes(1);
        userId = 'user-2';
        finishFetch(null);
        await Promise.resolve();
        coordinator.refreshIfVisible();
        const calls = (overlay.setViewModel as jest.Mock).mock.calls;
        const last = calls[calls.length - 1]?.[0] as { detailStatus?: string };
        expect(last.detailStatus).not.toBe('ready');
    });

    it('treats a replacement stream as a new detail publication generation', async () => {
        let finishFetch: (value: null) => void = () => undefined;
        const fetchProgramDetails = jest.fn(() => new Promise<null>((resolve) => { finishFetch = resolve; }));
        let descriptor = { url: 'same-url' } as StreamDescriptor;
        const { coordinator, overlay } = setup({
            fetchProgramDetails,
            getCurrentStreamDescriptor: () => descriptor,
        });
        coordinator.poke('status');
        coordinator.expand();
        descriptor = { url: 'same-url' } as StreamDescriptor;
        finishFetch(null);
        await Promise.resolve();
        coordinator.refreshIfVisible();
        expect(fetchProgramDetails).toHaveBeenCalledTimes(2);
        const calls = (overlay.setViewModel as jest.Mock).mock.calls;
        const last = calls[calls.length - 1]?.[0] as { detailStatus?: string };
        expect(last.detailStatus).toBe('loading');
    });

    it('offers one explicit playback retry and ignores its completion after hide', async () => {
        let completeRetry: () => void = () => undefined;
        const onRetry = jest.fn(() => new Promise<void>((resolve) => { completeRetry = resolve; }));
        const { coordinator, overlay } = setup({ onRetry });
        coordinator.onPlayerStateChange(makeState('error'));
        expect(coordinator.getPresentationState()).toBe('compact');
        const calls = (overlay.setViewModel as jest.Mock).mock.calls;
        const first = calls[calls.length - 1]?.[0] as {
            actionIds?: { retry?: string };
            errorText?: string;
        };
        expect(first.actionIds?.retry).toBe('player-osd-action-retry');
        expect(first.errorText).toContain('Playback unavailable');
        coordinator.retryPlayback();
        coordinator.retryPlayback();
        expect(onRetry).toHaveBeenCalledTimes(1);
        const beforeHide = (overlay.setViewModel as jest.Mock).mock.calls.length;
        coordinator.hide();
        completeRetry();
        await Promise.resolve();
        expect((overlay.setViewModel as jest.Mock).mock.calls.length).toBe(beforeHide);
    });

    it.each(['paused', 'seeking'] as const)('caches hidden native %s without revealing controls', (status) => {
        const { coordinator, navigation, overlay } = setup();
        coordinator.onPlayerStateChange(makeState(status));
        expect(coordinator.getPresentationState()).toBe('hidden');
        expect(overlay.show).not.toHaveBeenCalled();
        expect(navigation.registerFocusable).not.toHaveBeenCalled();
        expect(navigation.setFocus).not.toHaveBeenCalled();
    });

    it('explicit routed Pause reveals the cached native state', () => {
        const { coordinator, navigation } = setup();
        coordinator.onPlayerStateChange(makeState('paused'));
        coordinator.poke('pause');
        expect(coordinator.getPresentationState()).toBe('compact');
        expect(navigation.registerFocusable).toHaveBeenCalled();
        expect(coordinator.handleBack()).toBe(true);
        expect(coordinator.getPresentationState()).toBe('hidden');
    });

    it('distinguishes expanded Back from explicit Close', () => {
        const { coordinator, navigation } = setup();
        coordinator.poke('status');
        coordinator.expand();
        expect(coordinator.closeChild()).toBe(true);
        expect(coordinator.getPresentationState()).toBe('compact');
        coordinator.expand();
        selectRegisteredAction(navigation, 'player-osd-action-audio');
        expect(coordinator.getPresentationState()).toBe('audio');
        expect(coordinator.handleBack()).toBe(true);
        expect(coordinator.getPresentationState()).toBe('expanded');
        expect(navigation.setFocus).toHaveBeenCalledWith('player-osd-action-audio', { persist: false });
        expect(coordinator.handleBack()).toBe(true);
        expect(coordinator.getPresentationState()).toBe('hidden');
    });

    it('cleans the child focus scope when playback fails', () => {
        const { coordinator, navigation } = setup();
        for (const id of ['player-osd-sleep-0', 'player-osd-sleep-close']) {
            const button = document.createElement('button');
            button.id = id;
            document.body.appendChild(button);
        }
        coordinator.poke('status');
        coordinator.openSleep();
        expect(coordinator.getPresentationState()).toBe('sleep');
        coordinator.onPlayerStateChange(makeState('error'));
        expect(coordinator.getPresentationState()).toBe('compact');
        expect(navigation.unregisterFocusable).toHaveBeenCalledWith('player-osd-sleep-0');
        expect(navigation.unregisterFocusable).toHaveBeenCalledWith('player-osd-sleep-close');
    });

    it('uses one navigation activation for a pointer Sleep click and restores compact', () => {
        const container = document.createElement('div');
        container.id = PLAYER_OSD_CONTAINER_ID;
        document.body.appendChild(container);
        const overlay = new PlayerOsdOverlay();
        overlay.initialize({ containerId: PLAYER_OSD_CONTAINER_ID });
        const navigation = new NavigationManager();
        const options = makeCoordinatorOptions({
            getOverlay: (): IPlayerOsdOverlay => overlay,
            getNavigation: (): INavigationManager => navigation,
        });
        const coordinator = new PlayerOsdCoordinator(options);
        coordinator.poke('status');
        (container.querySelector('#player-osd-action-sleep') as HTMLButtonElement).click();
        expect(coordinator.getPresentationState()).toBe('sleep');
        (container.querySelector('#player-osd-sleep-close') as HTMLButtonElement).click();
        expect(coordinator.getPresentationState()).toBe('compact');
        coordinator.hide();
        navigation.destroy();
        overlay.destroy();
        container.remove();
    });

    it('activates expanded pointer actions and a track choice once', () => {
        const container = document.createElement('div');
        container.id = PLAYER_OSD_CONTAINER_ID;
        document.body.appendChild(container);
        const overlay = new PlayerOsdOverlay();
        overlay.initialize({ containerId: PLAYER_OSD_CONTAINER_ID });
        const navigation = new NavigationManager();
        const trackSelect = jest.fn();
        const onGuide = jest.fn();
        const onTransport = jest.fn();
        const drawer: PlaybackOptionsSection = {
            title: 'Audio',
            options: [{ id: 'playback-audio-test', label: 'English', selected: true, onSelect: trackSelect }],
        };
        const options = makeCoordinatorOptions({
            getOverlay: (): IPlayerOsdOverlay => overlay,
            getNavigation: (): INavigationManager => navigation,
            getTrackDrawer: (): PlaybackOptionsSection => drawer,
            onGuide,
            onTransport,
        });
        const coordinator = new PlayerOsdCoordinator(options);
        coordinator.poke('status');
        coordinator.expand();
        (container.querySelector('#player-osd-action-guide') as HTMLButtonElement).click();
        (container.querySelector('#player-osd-action-transport') as HTMLButtonElement).click();
        expect(onGuide).toHaveBeenCalledTimes(1);
        expect(onTransport).toHaveBeenCalledTimes(1);
        (container.querySelector('#player-osd-action-audio') as HTMLButtonElement).click();
        expect(coordinator.getPresentationState()).toBe('audio');
        (container.querySelector('#playback-audio-test') as HTMLButtonElement).click();
        expect(trackSelect).toHaveBeenCalledTimes(1);
        (container.querySelector('#player-osd-track-close') as HTMLButtonElement).click();
        expect(coordinator.getPresentationState()).toBe('expanded');
        (container.querySelector('#player-osd-expanded-close') as HTMLButtonElement).click();
        expect(coordinator.getPresentationState()).toBe('compact');
        coordinator.hide();
        navigation.destroy();
        overlay.destroy();
        container.remove();
    });

    it('keeps reader Down inside the scroll region until its end', () => {
        const scroll = document.createElement('div');
        scroll.id = 'player-osd-reader-scroll';
        Object.defineProperty(scroll, 'scrollHeight', { value: 600 });
        Object.defineProperty(scroll, 'clientHeight', { value: 100 });
        document.body.appendChild(scroll);
        const close = document.createElement('button');
        close.id = 'player-osd-reader-close';
        document.body.appendChild(close);
        const navigation = new NavigationManager();
        navigation.initialize({
            enablePointerMode: false,
            keyRepeatDelayMs: 500,
            keyRepeatIntervalMs: 100,
            focusMemoryEnabled: false,
            debugMode: false,
        });
        const { coordinator } = setup({ getNavigation: (): INavigationManager => navigation });
        coordinator.poke('status');
        coordinator.expand();
        coordinator.openMoreInfo();
        expect(navigation.getFocusedElement()?.id).toBe(scroll.id);
        scroll.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', keyCode: 40, bubbles: true, cancelable: true }));
        expect(scroll.scrollTop).toBeGreaterThan(0);
        expect(navigation.getFocusedElement()?.id).toBe(scroll.id);
        scroll.scrollTop = 500;
        scroll.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', keyCode: 40, bubbles: true, cancelable: true }));
        expect(navigation.getFocusedElement()?.id).toBe(close.id);
        coordinator.hide();
        navigation.destroy();
    });

    it('scrolls a newly focused offscreen track into the drawer list', () => {
        const container = document.createElement('div');
        container.id = PLAYER_OSD_CONTAINER_ID;
        document.body.appendChild(container);
        const overlay = new PlayerOsdOverlay();
        overlay.initialize({ containerId: PLAYER_OSD_CONTAINER_ID });
        const navigation = new NavigationManager();
        const drawer: PlaybackOptionsSection = {
            title: 'Audio',
            options: Array.from({ length: 20 }, (_, index) => ({
                id: `playback-audio-${index}`,
                label: `Track ${index}`,
                selected: index === 0,
                onSelect: (): void => undefined,
            })),
        };
        const options = makeCoordinatorOptions({
            getOverlay: (): IPlayerOsdOverlay => overlay,
            getNavigation: (): INavigationManager => navigation,
            getTrackDrawer: (): PlaybackOptionsSection => drawer,
        });
        const coordinator = new PlayerOsdCoordinator(options);
        coordinator.poke('status');
        (container.querySelector('#player-osd-action-audio') as HTMLButtonElement).click();
        const last = container.querySelector('#playback-audio-19') as HTMLButtonElement;
        const scrollIntoView = jest.fn();
        last.scrollIntoView = scrollIntoView;
        navigation.setFocus(last.id);
        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
        coordinator.hide();
        navigation.destroy();
        overlay.destroy();
        container.remove();
    });
});
