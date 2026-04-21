import { ChannelTransitionCoordinator } from '../ChannelTransitionCoordinator';
import { CHANNEL_TRANSITION_SHOW_DELAY_MS } from '../constants';
import type { IChannelTransitionOverlay } from '../interfaces';
import type { INavigationManager, Screen } from '../../../navigation';
import type { IVideoPlayer } from '../../../player';
import type { PlaybackState } from '../../../player/types';

const makeState = (status: PlaybackState['status']): PlaybackState => ({
    status,
    currentTimeMs: 0,
    durationMs: 0,
    bufferPercent: 0,
    volume: 1,
    isMuted: false,
    playbackRate: 1,
    activeSubtitleId: null,
    activeAudioId: null,
    errorInfo: null,
});

const makeOverlay = (): IChannelTransitionOverlay & { _visible: boolean } => {
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
    } as unknown as IChannelTransitionOverlay & { _visible: boolean };
    return overlay;
};

const makeNavigation = (overrides: Partial<INavigationManager> = {}): INavigationManager =>
    ({
        getCurrentScreen: jest.fn().mockReturnValue('player' as Screen),
        isModalOpen: jest.fn().mockReturnValue(false),
        ...overrides,
    } as unknown as INavigationManager);

const setup = (state: PlaybackState): {
    coordinator: ChannelTransitionCoordinator;
    overlay: IChannelTransitionOverlay & { _visible: boolean };
    navigation: INavigationManager;
    videoPlayer: IVideoPlayer;
    onActivityChange: jest.Mock<void, [boolean]>;
} => {
    const overlay = makeOverlay();
    const navigation = makeNavigation();
    const videoPlayer = {
        getState: jest.fn(() => state),
    } as unknown as IVideoPlayer;
    const onActivityChange = jest.fn<void, [boolean]>();

    const coordinator = new ChannelTransitionCoordinator({
        getOverlay: (): IChannelTransitionOverlay => overlay,
        getNavigation: (): INavigationManager => navigation,
        getVideoPlayer: (): IVideoPlayer => videoPlayer,
        onActivityChange,
    } as unknown as ConstructorParameters<typeof ChannelTransitionCoordinator>[0]);

    return { coordinator, overlay, navigation, videoPlayer, onActivityChange };
};

const getIsActive = (coordinator: ChannelTransitionCoordinator): boolean | undefined =>
    (coordinator as unknown as { isActive?: () => boolean }).isActive?.();

describe('ChannelTransitionCoordinator', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('does not show before delay', () => {
        const { coordinator, overlay } = setup(makeState('loading'));

        coordinator.armForChannelSwitch('12 Comedy');
        jest.advanceTimersByTime(CHANNEL_TRANSITION_SHOW_DELAY_MS - 1);

        expect(overlay.show).not.toHaveBeenCalled();
    });

    it('shows after delay if not ready', () => {
        const { coordinator, overlay } = setup(makeState('loading'));

        coordinator.armForChannelSwitch('12 Comedy');
        jest.advanceTimersByTime(CHANNEL_TRANSITION_SHOW_DELAY_MS);

        expect(overlay.show).toHaveBeenCalled();
        expect(overlay.setViewModel).toHaveBeenCalledWith({
            title: 'Tuning…',
            subtitle: '12 Comedy',
            showSpinner: true,
        });
    });

    it('marks transition activity active immediately on arm before the delayed show runs', () => {
        const { coordinator, overlay, onActivityChange } = setup(makeState('loading'));

        coordinator.armForChannelSwitch('12 Comedy');

        expect(getIsActive(coordinator)).toBe(true);
        expect(onActivityChange).toHaveBeenCalledTimes(1);
        expect(onActivityChange).toHaveBeenCalledWith(true);
        expect(overlay.show).not.toHaveBeenCalled();
    });

    it('never shows if ready before delay', () => {
        const { coordinator, overlay, onActivityChange } = setup(makeState('loading'));

        coordinator.armForChannelSwitch('12 Comedy');
        coordinator.onPlayerStateChange(makeState('playing'));
        jest.advanceTimersByTime(CHANNEL_TRANSITION_SHOW_DELAY_MS + 10);

        expect(overlay.show).not.toHaveBeenCalled();
        expect(getIsActive(coordinator)).toBe(false);
        expect(onActivityChange).toHaveBeenNthCalledWith(1, true);
        expect(onActivityChange).toHaveBeenNthCalledWith(2, false);
    });

    it('still shows if idle before delay', () => {
        const { coordinator, overlay } = setup(makeState('loading'));

        coordinator.armForChannelSwitch('12 Comedy');
        coordinator.onPlayerStateChange(makeState('idle'));
        jest.advanceTimersByTime(CHANNEL_TRANSITION_SHOW_DELAY_MS + 10);

        expect(overlay.show).toHaveBeenCalled();
    });

    it('hides immediately on ready', () => {
        const { coordinator, overlay, onActivityChange } = setup(makeState('loading'));

        coordinator.armForChannelSwitch('12 Comedy');
        jest.advanceTimersByTime(CHANNEL_TRANSITION_SHOW_DELAY_MS);
        expect(overlay.show).toHaveBeenCalled();

        coordinator.onPlayerStateChange(makeState('playing'));

        expect(overlay.hide).toHaveBeenCalled();
        expect(getIsActive(coordinator)).toBe(false);
        expect(onActivityChange).toHaveBeenNthCalledWith(1, true);
        expect(onActivityChange).toHaveBeenNthCalledWith(2, false);
    });

    it('keeps transition activity continuously true across repeated arms', () => {
        const { coordinator, overlay, onActivityChange } = setup(makeState('loading'));

        coordinator.armForChannelSwitch('12 Comedy');
        jest.advanceTimersByTime(CHANNEL_TRANSITION_SHOW_DELAY_MS);
        coordinator.armForChannelSwitch('24 News');

        expect(getIsActive(coordinator)).toBe(true);
        expect(overlay.hide).toHaveBeenCalledTimes(1);
        expect(onActivityChange).toHaveBeenCalledTimes(1);
        expect(onActivityChange).toHaveBeenCalledWith(true);
        expect(onActivityChange).not.toHaveBeenCalledWith(false);

        jest.advanceTimersByTime(CHANNEL_TRANSITION_SHOW_DELAY_MS);

        expect(overlay.show).toHaveBeenCalledTimes(2);
        expect(overlay.setViewModel).toHaveBeenLastCalledWith({
            title: 'Tuning…',
            subtitle: '24 News',
            showSpinner: true,
        });
    });

    it('ends transition activity through the shared terminal path when the delayed show is abandoned by a modal guard', () => {
        const { coordinator, overlay, navigation, onActivityChange } = setup(makeState('loading'));
        jest.spyOn(navigation, 'isModalOpen').mockReturnValue(true);

        coordinator.armForChannelSwitch('12 Comedy');
        jest.advanceTimersByTime(CHANNEL_TRANSITION_SHOW_DELAY_MS);

        expect(overlay.show).not.toHaveBeenCalled();
        expect(getIsActive(coordinator)).toBe(false);
        expect(onActivityChange).toHaveBeenNthCalledWith(1, true);
        expect(onActivityChange).toHaveBeenNthCalledWith(2, false);
    });

    it('ends transition activity when the player screen is no longer active before the delayed show runs', () => {
        const { coordinator, overlay, onActivityChange } = setup(makeState('loading'));

        coordinator.armForChannelSwitch('12 Comedy');
        coordinator.onScreenChange('guide');

        expect(overlay.show).not.toHaveBeenCalled();
        expect(getIsActive(coordinator)).toBe(false);
        expect(onActivityChange).toHaveBeenNthCalledWith(1, true);
        expect(onActivityChange).toHaveBeenNthCalledWith(2, false);
    });

    it('ends transition activity when an error cancels the transition', () => {
        const { coordinator, onActivityChange } = setup(makeState('loading'));

        coordinator.armForChannelSwitch('12 Comedy');
        coordinator.onPlayerStateChange(makeState('error'));

        expect(getIsActive(coordinator)).toBe(false);
        expect(onActivityChange).toHaveBeenNthCalledWith(1, true);
        expect(onActivityChange).toHaveBeenNthCalledWith(2, false);
    });
});
