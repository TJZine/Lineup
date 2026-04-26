import { NavigationCoordinator } from '../NavigationCoordinator';
import type { NavigationCoordinatorDeps } from '../NavigationCoordinatorDeps';
import type { INavigationManager, KeyEvent, NavigationEventMap, Screen } from '../interfaces';
import type { IEPGComponent } from '../../ui/epg';
import type { IVideoPlayer } from '../../player';
import type { IPlexAuth } from '../../plex/auth';
import {
    computeAcceleratedRepeatIntervalMs,
    EPG_REPEAT_TIMING,
    MINI_GUIDE_REPEAT_TIMING,
} from '../constants';
import { advanceTimersUntil } from '../../../__tests__/helpers';
import { NOW_PLAYING_INFO_MODAL_ID } from '../../ui/now-playing-info';
import { PLAYBACK_OPTIONS_MODAL_ID } from '../../ui/playback-options/constants';

type HandlerMap = Partial<{
    [K in keyof NavigationEventMap]: (payload: NavigationEventMap[K]) => void;
}>;

const makeNavigation = (): {
    navigation: INavigationManager;
    handlers: HandlerMap;
} => {
    const handlers: HandlerMap = {};
    const state = {
        currentScreen: 'player' as Screen,
        screenStack: [] as Screen[],
        focusedElementId: null,
        modalStack: [],
        isPointerActive: false,
    };
    const navigation: INavigationManager = {
        getCurrentScreen: jest.fn().mockReturnValue('player'),
        getState: jest.fn().mockReturnValue(state),
        isModalOpen: jest.fn().mockReturnValue(false),
        isInputBlocked: jest.fn().mockReturnValue(false),
        openModal: jest.fn(),
        closeModal: jest.fn(),
        goTo: jest.fn(),
        replaceScreen: jest.fn(),
        getServerSelectParams: jest.fn().mockReturnValue(null),
        setFocus: jest.fn(),
        handleLongPress: jest.fn(),
        on: jest.fn(<K extends keyof NavigationEventMap>(
            event: K,
            handler: (payload: NavigationEventMap[K]) => void
        ) => {
            handlers[event] = handler;
        }),
        off: jest.fn(),
    } as unknown as INavigationManager;
    return { navigation, handlers };
};

const makeKeyEvent = (
    button: KeyEvent['button'],
    overrides: Partial<KeyEvent> = {}
): KeyEvent => ({
    button,
    isRepeat: false,
    isLongPress: false,
    timestamp: Date.now(),
    originalEvent: { preventDefault: jest.fn() } as unknown as KeyboardEvent,
    ...overrides,
});

type LegacyNavigationCoordinatorDeps = {
    videoPlayer: IVideoPlayer | null;
    plexAuth: IPlexAuth | null;
    stopPlayback: jest.Mock;
    pokePlayerOsd: jest.Mock;
    togglePlayerOsd: jest.Mock;
    getSeekIncrementMs: jest.Mock;
    isPlayerOsdVisible: jest.Mock;
    showMiniGuide: jest.Mock;
    hideMiniGuide: jest.Mock;
    isMiniGuideVisible: jest.Mock;
    handleMiniGuideNavigation: jest.Mock;
    handleMiniGuidePage: jest.Mock;
    handleMiniGuideSelect: jest.Mock;
    isNowPlayingModalOpen: jest.Mock;
    toggleNowPlayingInfoOverlay: jest.Mock;
    showNowPlayingInfoOverlay: jest.Mock;
    hideNowPlayingInfoOverlay: jest.Mock;
    nowPlayingInfoModalId: string;
    playbackOptionsModalId: string;
    preparePlaybackOptionsModal: jest.Mock;
    showPlaybackOptionsModal: jest.Mock;
    hidePlaybackOptionsModal: jest.Mock;
    exitConfirmModalId: string;
    prepareExitConfirmModal: jest.Mock;
    showExitConfirmModal: jest.Mock;
    hideExitConfirmModal: jest.Mock;
    setLastChannelChangeSourceRemote: jest.Mock;
    setLastChannelChangeSourceNumber: jest.Mock;
    switchToNextChannel: jest.Mock;
    switchToPreviousChannel: jest.Mock;
    switchToChannelByNumber: jest.Mock;
    focusEpgOnCurrentChannel: jest.Mock;
    onChannelInputUpdate?: jest.Mock;
    toggleEpg: jest.Mock;
    shouldRunChannelSetup: jest.Mock;
    hidePlayerOsd: jest.Mock;
    hideChannelTransition: jest.Mock;
    reportRecoverableAsyncFailure: jest.Mock;
    readKeepPlayingInSettings: jest.Mock;
    readDebugLoggingEnabled: jest.Mock;
};

const setup = (
    overrides: Partial<NavigationCoordinatorDeps> & Partial<LegacyNavigationCoordinatorDeps> = {}
): {
    coordinator: NavigationCoordinator;
    deps: NavigationCoordinatorDeps & LegacyNavigationCoordinatorDeps;
    handlers: HandlerMap;
    navigation: INavigationManager;
    epg: IEPGComponent;
    videoPlayer: IVideoPlayer;
    plexAuth: IPlexAuth;
} => {
    const { navigation, handlers } = makeNavigation();
    const epg: IEPGComponent = {
        isVisible: jest.fn().mockReturnValue(false),
        handleNavigation: jest.fn().mockReturnValue(false),
        handlePage: jest.fn().mockReturnValue(false),
        handleSelect: jest.fn().mockReturnValue(false),
        handleBack: jest.fn().mockReturnValue(false),
        focusNow: jest.fn(),
        hide: jest.fn(),
    } as unknown as IEPGComponent;
    const videoPlayer: IVideoPlayer = {
        play: jest.fn().mockResolvedValue(undefined),
        pause: jest.fn(),
        stop: jest.fn(),
        seekRelative: jest.fn().mockResolvedValue(undefined),
    } as unknown as IVideoPlayer;
    const plexAuth: IPlexAuth = {
        isAuthenticated: jest.fn().mockReturnValue(true),
    } as unknown as IPlexAuth;

    const legacy: LegacyNavigationCoordinatorDeps = {
        videoPlayer,
        plexAuth,
        stopPlayback: jest.fn(),
        pokePlayerOsd: jest.fn(),
        togglePlayerOsd: jest.fn(),
        getSeekIncrementMs: jest.fn().mockReturnValue(10_000),
        isPlayerOsdVisible: jest.fn().mockReturnValue(false),
        showMiniGuide: jest.fn(),
        hideMiniGuide: jest.fn(),
        isMiniGuideVisible: jest.fn().mockReturnValue(false),
        handleMiniGuideNavigation: jest.fn().mockReturnValue(true),
        handleMiniGuidePage: jest.fn().mockReturnValue(true),
        handleMiniGuideSelect: jest.fn(),
        isNowPlayingModalOpen: jest.fn().mockReturnValue(false),
        toggleNowPlayingInfoOverlay: jest.fn(),
        showNowPlayingInfoOverlay: jest.fn(),
        hideNowPlayingInfoOverlay: jest.fn(),
        nowPlayingInfoModalId: NOW_PLAYING_INFO_MODAL_ID,
        playbackOptionsModalId: PLAYBACK_OPTIONS_MODAL_ID,
        preparePlaybackOptionsModal: jest.fn().mockReturnValue({
            focusableIds: ['playback-subtitle-off'],
            preferredFocusId: 'playback-subtitle-off',
        }),
        showPlaybackOptionsModal: jest.fn(),
        hidePlaybackOptionsModal: jest.fn(),
        exitConfirmModalId: 'exit-confirm',
        prepareExitConfirmModal: jest.fn().mockReturnValue({
            focusableIds: ['exit-confirm-cancel', 'exit-confirm-exit'],
        }),
        showExitConfirmModal: jest.fn(),
        hideExitConfirmModal: jest.fn(),
        setLastChannelChangeSourceRemote: jest.fn(),
        setLastChannelChangeSourceNumber: jest.fn(),
        switchToNextChannel: jest.fn(),
        switchToPreviousChannel: jest.fn(),
        switchToChannelByNumber: jest.fn().mockResolvedValue('switched'),
        focusEpgOnCurrentChannel: jest.fn(),
        toggleEpg: jest.fn(),
        shouldRunChannelSetup: jest.fn().mockReturnValue(false),
        hidePlayerOsd: jest.fn(),
        hideChannelTransition: jest.fn(),
        reportRecoverableAsyncFailure: jest.fn(),
        readKeepPlayingInSettings: jest.fn().mockReturnValue(false),
        readDebugLoggingEnabled: jest.fn().mockReturnValue(false),
    };
    Object.assign(legacy, overrides);

    const deps: NavigationCoordinatorDeps = {
        navigation,
        epg,
        playback: {
            videoPlayer: legacy.videoPlayer,
            plexAuth: legacy.plexAuth,
            stopPlayback: legacy.stopPlayback,
            getSeekIncrementMs: legacy.getSeekIncrementMs,
            playerOsd: {
                overlay: { isVisible: legacy.isPlayerOsdVisible },
                coordinator: {
                    poke: legacy.pokePlayerOsd,
                    toggle: legacy.togglePlayerOsd,
                    hide: legacy.hidePlayerOsd,
                },
            },
        },
        miniGuide: {
            overlay: { isVisible: legacy.isMiniGuideVisible },
            coordinator: {
                show: legacy.showMiniGuide,
                hide: legacy.hideMiniGuide,
                handleNavigation: legacy.handleMiniGuideNavigation,
                handlePage: legacy.handleMiniGuidePage,
                handleSelect: legacy.handleMiniGuideSelect,
            },
        },
        nowPlayingInfo: {
            modalId: legacy.nowPlayingInfoModalId,
            isModalOpen: legacy.isNowPlayingModalOpen,
            toggleOverlay: legacy.toggleNowPlayingInfoOverlay,
            showOverlay: legacy.showNowPlayingInfoOverlay,
            hideOverlay: legacy.hideNowPlayingInfoOverlay,
        },
        modals: {
            playbackOptions: {
                modalId: legacy.playbackOptionsModalId,
                prepare: legacy.preparePlaybackOptionsModal,
                show: legacy.showPlaybackOptionsModal,
                hide: legacy.hidePlaybackOptionsModal,
            },
            exitConfirm: {
                modalId: legacy.exitConfirmModalId,
                prepare: legacy.prepareExitConfirmModal,
                show: legacy.showExitConfirmModal,
                hide: legacy.hideExitConfirmModal,
            },
        },
        channelSwitching: {
            setLastChannelChangeSourceRemote: legacy.setLastChannelChangeSourceRemote,
            setLastChannelChangeSourceNumber: legacy.setLastChannelChangeSourceNumber,
            switchToNextChannel: legacy.switchToNextChannel,
            switchToPreviousChannel: legacy.switchToPreviousChannel,
            switchToChannelByNumber: legacy.switchToChannelByNumber,
            focusEpgOnCurrentChannel: legacy.focusEpgOnCurrentChannel,
            toggleEpg: legacy.toggleEpg,
            ...(legacy.onChannelInputUpdate
                ? { onChannelInputUpdate: legacy.onChannelInputUpdate }
                : {}),
        },
        uiGuards: {
            shouldRunChannelSetup: legacy.shouldRunChannelSetup,
            hideChannelTransition: legacy.hideChannelTransition,
        },
        reportRecoverableAsyncFailure: legacy.reportRecoverableAsyncFailure,
        readKeepPlayingInSettings: legacy.readKeepPlayingInSettings,
        readDebugLoggingEnabled: legacy.readDebugLoggingEnabled,
        ...overrides,
    };

    const coordinator = new NavigationCoordinator(deps);
    coordinator.wireNavigationEvents();

    return { coordinator, deps: Object.assign(deps, legacy), handlers, navigation, epg, videoPlayer, plexAuth };
};

describe('computeAcceleratedRepeatIntervalMs', () => {
    it('maps hold-duration boundaries to the expected repeat interval tiers', () => {
        expect(computeAcceleratedRepeatIntervalMs(0, EPG_REPEAT_TIMING)).toBe(EPG_REPEAT_TIMING.INTERVAL_1_MS);
        expect(
            computeAcceleratedRepeatIntervalMs(EPG_REPEAT_TIMING.TIER_1_MS - 1, EPG_REPEAT_TIMING)
        ).toBe(EPG_REPEAT_TIMING.INTERVAL_1_MS);
        expect(
            computeAcceleratedRepeatIntervalMs(EPG_REPEAT_TIMING.TIER_1_MS, EPG_REPEAT_TIMING)
        ).toBe(EPG_REPEAT_TIMING.INTERVAL_2_MS);
        expect(
            computeAcceleratedRepeatIntervalMs(EPG_REPEAT_TIMING.TIER_2_MS - 1, EPG_REPEAT_TIMING)
        ).toBe(EPG_REPEAT_TIMING.INTERVAL_2_MS);
        expect(
            computeAcceleratedRepeatIntervalMs(EPG_REPEAT_TIMING.TIER_2_MS, EPG_REPEAT_TIMING)
        ).toBe(EPG_REPEAT_TIMING.INTERVAL_3_MS);
    });
});

describe('NavigationCoordinator', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
    });

    it('does not log an error when channel-number entry is superseded (AbortError)', async () => {
        const abortError = Object.assign(new Error('superseded'), { name: 'AbortError' });
        const { handlers, deps } = setup({
            switchToChannelByNumber: jest.fn().mockRejectedValue(abortError),
        });

        handlers.channelNumberEntered?.({ channelNumber: 12 });

        // Allow the catch handler to run.
        await Promise.resolve();

        expect(deps.setLastChannelChangeSourceNumber).toHaveBeenCalledTimes(1);
        expect(deps.switchToChannelByNumber).toHaveBeenCalledWith(12);
        expect(deps.reportRecoverableAsyncFailure).not.toHaveBeenCalled();
    });

    it('reports diagnostics when channel-number entry fails unexpectedly', async () => {
        const failure = new Error('boom');
        const { handlers, deps } = setup({
            switchToChannelByNumber: jest.fn().mockRejectedValue(failure),
        });

        handlers.channelNumberEntered?.({ channelNumber: 7 });
        await Promise.resolve();
        await Promise.resolve();

        expect(deps.reportRecoverableAsyncFailure).toHaveBeenCalledWith(
            'navigation.channel-number',
            '[Navigation] channel-number failed:',
            failure
        );
    });

    it('channelNumberEntered focuses EPG current channel after numeric switch when guide is visible', async () => {
        const focusEpgOnCurrentChannel = jest.fn();
        const { handlers, deps, epg } = setup({
            focusEpgOnCurrentChannel,
            switchToChannelByNumber: jest.fn().mockResolvedValue('switched'),
        });
        (epg.isVisible as jest.Mock).mockReturnValue(true);

        handlers.channelNumberEntered?.({ channelNumber: 42 });
        await Promise.resolve();

        expect(deps.switchToChannelByNumber).toHaveBeenCalledWith(42);
        expect(focusEpgOnCurrentChannel).toHaveBeenCalledTimes(1);
    });

    it('channelNumberEntered does not call focusEpgOnCurrentChannel when guide is not visible', async () => {
        const focusEpgOnCurrentChannel = jest.fn();
        const { handlers, deps, epg } = setup({
            focusEpgOnCurrentChannel,
            switchToChannelByNumber: jest.fn().mockResolvedValue('switched'),
        });
        (epg.isVisible as jest.Mock).mockReturnValue(false);

        handlers.channelNumberEntered?.({ channelNumber: 42 });
        await Promise.resolve();

        expect(deps.switchToChannelByNumber).toHaveBeenCalledWith(42);
        expect(focusEpgOnCurrentChannel).not.toHaveBeenCalled();
    });

    it('channelNumberEntered does not focus EPG when switch outcome is aborted', async () => {
        const focusEpgOnCurrentChannel = jest.fn();
        const { handlers, deps, epg } = setup({
            focusEpgOnCurrentChannel,
            switchToChannelByNumber: jest.fn().mockResolvedValue('aborted'),
        });
        (epg.isVisible as jest.Mock).mockReturnValue(true);

        handlers.channelNumberEntered?.({ channelNumber: 42 });
        await Promise.resolve();

        expect(deps.switchToChannelByNumber).toHaveBeenCalledWith(42);
        expect(focusEpgOnCurrentChannel).not.toHaveBeenCalled();
    });

    it('channelNumberEntered does not focus EPG when switch outcome is failed', async () => {
        const focusEpgOnCurrentChannel = jest.fn();
        const { handlers, deps, epg } = setup({
            focusEpgOnCurrentChannel,
            switchToChannelByNumber: jest.fn().mockResolvedValue('failed'),
        });
        (epg.isVisible as jest.Mock).mockReturnValue(true);

        handlers.channelNumberEntered?.({ channelNumber: 42 });
        await Promise.resolve();

        expect(deps.switchToChannelByNumber).toHaveBeenCalledWith(42);
        expect(focusEpgOnCurrentChannel).not.toHaveBeenCalled();
    });

    it('forwards channelInputUpdate payload to dependency callback', () => {
        const onChannelInputUpdate = jest.fn();
        const { handlers } = setup({ onChannelInputUpdate });

        handlers.channelInputUpdate?.({ digits: '42', isComplete: false });

        expect(onChannelInputUpdate).toHaveBeenCalledWith({ digits: '42', isComplete: false });
    });

    it('registers long-press back handler', () => {
        const { navigation } = setup();

        expect(navigation.handleLongPress).toHaveBeenCalledWith('back', expect.any(Function));
    });

    it('long-press back closes EPG, closes modals, and returns to player', () => {
        const { navigation, epg } = setup();
        const handleLongPress = navigation.handleLongPress as jest.Mock;
        const callback = handleLongPress.mock.calls[0]?.[1] as () => void;

        (navigation.isInputBlocked as jest.Mock).mockReturnValue(false);
        (navigation.isModalOpen as jest.Mock)
            .mockImplementationOnce(() => true)
            .mockImplementationOnce(() => true)
            .mockImplementationOnce(() => false);

        callback();

        expect(epg.hide).toHaveBeenCalledTimes(1);
        expect(navigation.closeModal).toHaveBeenCalledTimes(2);
        expect(navigation.replaceScreen).toHaveBeenCalledWith('player');
    });

    it('long-press back does nothing when input is blocked', () => {
        const { navigation, epg } = setup();
        const handleLongPress = navigation.handleLongPress as jest.Mock;
        const callback = handleLongPress.mock.calls[0]?.[1] as () => void;

        (navigation.isInputBlocked as jest.Mock).mockReturnValue(true);

        callback();

        expect(epg.hide).not.toHaveBeenCalled();
        expect(navigation.closeModal).not.toHaveBeenCalled();
        expect(navigation.replaceScreen).not.toHaveBeenCalled();
    });

    it('toggles player OSD on ok when in player screen', () => {
        const { handlers, deps } = setup();
        const keyPress = handlers.keyPress;
        if (!keyPress) {
            throw new Error('keyPress handler not registered');
        }

        const event = makeKeyEvent('ok');
        keyPress(event);

        expect(deps.togglePlayerOsd).toHaveBeenCalledTimes(1);
        expect(event.handled).toBe(true);
        expect(event.originalEvent.preventDefault).toHaveBeenCalled();
    });

    it('does not toggle player OSD on ok when already visible', () => {
        const { handlers, deps } = setup({
            isPlayerOsdVisible: jest.fn().mockReturnValue(true),
        });
        const event = makeKeyEvent('ok');

        handlers.keyPress?.(event);

        expect(deps.togglePlayerOsd).not.toHaveBeenCalled();
        expect(event.handled).not.toBe(true);
    });

    it('opens player OSD on down when hidden on player screen', () => {
        const { handlers, deps } = setup({
            isPlayerOsdVisible: jest.fn().mockReturnValue(false),
        });
        const event = makeKeyEvent('down');

        handlers.keyPress?.(event);

        expect(deps.togglePlayerOsd).toHaveBeenCalledTimes(1);
        expect(event.handled).toBe(true);
        expect(event.originalEvent.preventDefault).toHaveBeenCalled();
    });

    it('shows mini-guide on up when player and OSD hidden', () => {
        const { handlers, deps } = setup({
            isPlayerOsdVisible: jest.fn().mockReturnValue(false),
            isMiniGuideVisible: jest.fn().mockReturnValue(false),
        });
        const event = makeKeyEvent('up');

        handlers.keyPress?.(event);

        expect(deps.showMiniGuide).toHaveBeenCalledTimes(1);
        expect(event.handled).toBe(true);
        expect(event.originalEvent.preventDefault).toHaveBeenCalled();
    });

    it('does not show mini-guide when OSD is visible', () => {
        const { handlers, deps } = setup({
            isPlayerOsdVisible: jest.fn().mockReturnValue(true),
            isMiniGuideVisible: jest.fn().mockReturnValue(false),
        });
        const event = makeKeyEvent('up');

        handlers.keyPress?.(event);

        expect(deps.showMiniGuide).not.toHaveBeenCalled();
        expect(event.handled).not.toBe(true);
    });

    it('routes navigation to mini-guide when visible and prevents OSD toggles', () => {
        const { handlers, deps } = setup({
            isMiniGuideVisible: jest.fn().mockReturnValue(true),
        });

        const downEvent = makeKeyEvent('down');
        handlers.keyPress?.(downEvent);
        expect(deps.handleMiniGuideNavigation).toHaveBeenCalledWith('down');
        expect(deps.togglePlayerOsd).not.toHaveBeenCalled();
        expect(downEvent.handled).toBe(true);

        const okEvent = makeKeyEvent('ok');
        handlers.keyPress?.(okEvent);
        expect(deps.handleMiniGuideSelect).toHaveBeenCalledTimes(1);
        expect(deps.togglePlayerOsd).not.toHaveBeenCalled();
        expect(okEvent.handled).toBe(true);
    });

    it('does not route mini-guide when input is blocked', () => {
        const { handlers, deps, navigation } = setup({
            isMiniGuideVisible: jest.fn().mockReturnValue(true),
        });
        (navigation.isInputBlocked as jest.Mock).mockReturnValue(true);

        const event = makeKeyEvent('down');
        handlers.keyPress?.(event);

        expect(deps.handleMiniGuideNavigation).not.toHaveBeenCalled();
        expect(event.handled).toBe(true);
        expect(event.originalEvent.preventDefault).toHaveBeenCalled();
    });

    it('back hides mini-guide and does not open exit-confirm', () => {
        const { handlers, deps, navigation } = setup({
            isMiniGuideVisible: jest.fn().mockReturnValue(true),
        });
        const event = makeKeyEvent('back');

        handlers.keyPress?.(event);

        expect(deps.hideMiniGuide).toHaveBeenCalledTimes(1);
        expect(navigation.openModal).not.toHaveBeenCalled();
        expect(event.handled).toBe(true);
    });

    it('pages mini-guide on channel up/down without switching channels', () => {
        const { handlers, deps } = setup({
            isMiniGuideVisible: jest.fn().mockReturnValue(true),
        });

        handlers.keyPress?.(makeKeyEvent('channelUp'));
        expect(deps.handleMiniGuidePage).toHaveBeenCalledWith('up');
        expect(deps.switchToPreviousChannel).not.toHaveBeenCalled();

        handlers.keyPress?.(makeKeyEvent('channelDown'));
        expect(deps.handleMiniGuidePage).toHaveBeenCalledWith('down');
        expect(deps.switchToNextChannel).not.toHaveBeenCalled();
    });

    it('prefers mini-guide paging over EPG when both are visible', () => {
        const { handlers, deps, epg, navigation } = setup({
            isMiniGuideVisible: jest.fn().mockReturnValue(true),
        });
        (epg.isVisible as jest.Mock).mockReturnValue(true);
        (navigation.isModalOpen as jest.Mock).mockReturnValue(false);

        const event = makeKeyEvent('channelUp');
        handlers.keyPress?.(event);

        expect(deps.handleMiniGuidePage).toHaveBeenCalledWith('up');
        expect(epg.handlePage).not.toHaveBeenCalled();
        expect(event.handled).toBe(true);
        expect(event.originalEvent.preventDefault).toHaveBeenCalled();
    });

    it('right hides mini-guide then opens full guide', () => {
        const { handlers, deps } = setup({
            isMiniGuideVisible: jest.fn().mockReturnValue(true),
        });

        const event = makeKeyEvent('right');
        handlers.keyPress?.(event);

        expect(deps.hideMiniGuide).toHaveBeenCalledTimes(1);
        expect(deps.toggleEpg).toHaveBeenCalledTimes(1);
        expect(event.handled).toBe(true);
    });

    it('swallows back when now playing modal open', () => {
        const { handlers, epg } = setup({
            isNowPlayingModalOpen: jest.fn().mockReturnValue(true),
        });
        const event = makeKeyEvent('back');

        handlers.keyPress?.(event);

        expect(epg.handleBack).not.toHaveBeenCalled();
        expect(event.originalEvent.preventDefault).not.toHaveBeenCalled();
    });

    it('opens exit-confirm on back from player when no modal is open', () => {
        const focus = {
            focusableIds: ['exit-confirm-cancel', 'exit-confirm-exit'],
        };
        const { handlers, navigation, deps } = setup({
            prepareExitConfirmModal: jest.fn().mockReturnValue(focus),
        });
        const event = makeKeyEvent('back');

        handlers.keyPress?.(event);

        expect(deps.prepareExitConfirmModal).toHaveBeenCalledTimes(1);
        expect(navigation.openModal).toHaveBeenCalledWith(deps.exitConfirmModalId, focus.focusableIds);
        expect(navigation.setFocus).not.toHaveBeenCalled();
        expect(event.handled).toBe(true);
        expect(event.originalEvent.preventDefault).toHaveBeenCalled();
    });

    it('uses the cached routing state when handling player back', () => {
        const focus = {
            focusableIds: ['exit-confirm-cancel', 'exit-confirm-exit'],
        };
        const { handlers, navigation, deps } = setup({
            prepareExitConfirmModal: jest.fn().mockReturnValue(focus),
        });
        (navigation.getCurrentScreen as jest.Mock)
            .mockReturnValueOnce('player')
            .mockReturnValueOnce('settings');
        (navigation.isModalOpen as jest.Mock)
            .mockReturnValueOnce(false)
            .mockReturnValueOnce(true);
        const event = makeKeyEvent('back');

        handlers.keyPress?.(event);

        expect(navigation.openModal).toHaveBeenCalledWith(deps.exitConfirmModalId, focus.focusableIds);
        expect(navigation.getCurrentScreen).toHaveBeenCalledTimes(1);
        expect(navigation.isModalOpen).toHaveBeenCalledTimes(1);
    });

    it('hides player OSD on back before exit-confirm', () => {
        const { handlers, deps, navigation } = setup({
            isPlayerOsdVisible: jest.fn().mockReturnValue(true),
        });
        const event = makeKeyEvent('back');

        handlers.keyPress?.(event);

        expect(deps.hidePlayerOsd).toHaveBeenCalledTimes(1);
        expect(navigation.openModal).not.toHaveBeenCalled();
        expect(event.handled).toBe(true);
        expect(event.originalEvent.preventDefault).toHaveBeenCalled();
    });

    it('still opens exit-confirm on back from player even when back stack is available', () => {
        const focus = {
            focusableIds: ['exit-confirm-cancel', 'exit-confirm-exit'],
        };
        const { handlers, navigation, deps } = setup({
            prepareExitConfirmModal: jest.fn().mockReturnValue(focus),
        });
        (navigation.getState as jest.Mock).mockReturnValue({
            currentScreen: 'player',
            screenStack: ['server-select'],
            focusedElementId: null,
            modalStack: [],
            isPointerActive: false,
        });
        const event = makeKeyEvent('back');

        handlers.keyPress?.(event);

        expect(navigation.openModal).toHaveBeenCalledWith(deps.exitConfirmModalId, focus.focusableIds);
        expect(event.handled).toBe(true);
        expect(event.originalEvent.preventDefault).toHaveBeenCalled();
    });

    it('opens playback options when OK pressed in now playing modal', () => {
        const focus = {
            focusableIds: ['playback-subtitle-off'],
            preferredFocusId: 'playback-subtitle-off',
        };
        const { handlers, navigation, deps } = setup({
            isNowPlayingModalOpen: jest.fn().mockReturnValue(true),
            preparePlaybackOptionsModal: jest.fn().mockReturnValue(focus),
        });
        const event = makeKeyEvent('ok');

        handlers.keyPress?.(event);

        expect(deps.preparePlaybackOptionsModal).toHaveBeenCalledWith('subtitles');
        expect(navigation.closeModal).toHaveBeenCalledWith(NOW_PLAYING_INFO_MODAL_ID);
        expect(navigation.openModal).toHaveBeenCalledWith(
            PLAYBACK_OPTIONS_MODAL_ID,
            focus.focusableIds
        );
        expect(event.handled).toBe(true);
    });

    it('routes EPG key handling and marks handled', () => {
        const { handlers, epg, navigation } = setup();
        (epg.isVisible as jest.Mock).mockReturnValue(true);
        (epg.handleNavigation as jest.Mock).mockReturnValue(true);
        (navigation.isModalOpen as jest.Mock).mockReturnValue(false);

        const event = makeKeyEvent('up');
        handlers.keyPress?.(event);
        handlers.keyUp?.({ button: 'up' });

        expect(event.handled).toBe(true);
        expect(event.originalEvent.preventDefault).toHaveBeenCalled();
    });

    it('routes back to EPG handleBack when guide is visible and no modal is open', () => {
        const { handlers, epg, navigation } = setup();
        (epg.isVisible as jest.Mock).mockReturnValue(true);
        (navigation.isModalOpen as jest.Mock).mockReturnValue(false);
        (epg.handleBack as jest.Mock).mockReturnValue(true);

        const event = makeKeyEvent('back');
        handlers.keyPress?.(event);

        expect(epg.handleBack).toHaveBeenCalledTimes(1);
        expect(event.handled).toBe(true);
        expect(event.originalEvent.preventDefault).toHaveBeenCalled();
    });

    it('EPG direction keys always consumed', () => {
        const { handlers, epg, navigation } = setup();
        (epg.isVisible as jest.Mock).mockReturnValue(true);
        (epg.handleNavigation as jest.Mock).mockReturnValue(false);
        (navigation.isModalOpen as jest.Mock).mockReturnValue(false);

        const event = makeKeyEvent('up');
        handlers.keyPress?.(event);

        expect(event.handled).toBe(true);
        expect(event.originalEvent.preventDefault).toHaveBeenCalled();
    });

    it('pages EPG on channel up/down when guide visible and no modal', () => {
        const { handlers, epg, deps, navigation } = setup();
        (epg.isVisible as jest.Mock).mockReturnValue(true);
        (navigation.isModalOpen as jest.Mock).mockReturnValue(false);

        const upEvent = makeKeyEvent('channelUp');
        handlers.keyPress?.(upEvent);
        expect(epg.handlePage).toHaveBeenCalledWith('up');
        expect(deps.switchToPreviousChannel).not.toHaveBeenCalled();
        expect(upEvent.handled).toBe(true);
        expect(upEvent.originalEvent.preventDefault).toHaveBeenCalled();

        const downEvent = makeKeyEvent('channelDown');
        handlers.keyPress?.(downEvent);
        expect(epg.handlePage).toHaveBeenCalledWith('down');
        expect(deps.switchToNextChannel).not.toHaveBeenCalled();
        expect(downEvent.handled).toBe(true);
        expect(downEvent.originalEvent.preventDefault).toHaveBeenCalled();
    });

    it('does not page EPG or switch channels when modal is open', () => {
        const { handlers, epg, deps, navigation } = setup();
        (epg.isVisible as jest.Mock).mockReturnValue(true);
        (navigation.isModalOpen as jest.Mock).mockReturnValue(true);

        const upEvent = makeKeyEvent('channelUp');
        handlers.keyPress?.(upEvent);
        expect(epg.handlePage).not.toHaveBeenCalled();
        expect(deps.switchToPreviousChannel).not.toHaveBeenCalled();
        expect(upEvent.handled).not.toBe(true);

        const downEvent = makeKeyEvent('channelDown');
        handlers.keyPress?.(downEvent);
        expect(epg.handlePage).not.toHaveBeenCalled();
        expect(deps.switchToNextChannel).not.toHaveBeenCalled();
        expect(downEvent.handled).not.toBe(true);
    });

    it('handles channel up/down with remote source', () => {
        const { handlers, deps } = setup();

        handlers.keyPress?.(makeKeyEvent('channelUp'));
        expect(deps.setLastChannelChangeSourceRemote).toHaveBeenCalled();
        expect(deps.switchToPreviousChannel).toHaveBeenCalled();

        handlers.keyPress?.(makeKeyEvent('channelDown'));
        expect(deps.setLastChannelChangeSourceRemote).toHaveBeenCalledTimes(2);
        expect(deps.switchToNextChannel).toHaveBeenCalled();
    });

    it('play triggers pokePlayerOsd', async () => {
        const { handlers, deps } = setup();
        handlers.keyPress?.(makeKeyEvent('play'));

        await Promise.resolve();
        expect(deps.pokePlayerOsd).toHaveBeenCalledWith('play');
    });

    it('play jumps to now when EPG is visible', () => {
        const { handlers, epg, deps, videoPlayer, navigation } = setup();
        (epg.isVisible as jest.Mock).mockReturnValue(true);
        (navigation.isModalOpen as jest.Mock).mockReturnValue(false);

        const event = makeKeyEvent('play');
        handlers.keyPress?.(event);

        expect(epg.focusNow).toHaveBeenCalledTimes(1);
        expect(deps.pokePlayerOsd).not.toHaveBeenCalledWith('play');
        expect(videoPlayer.play).not.toHaveBeenCalled();
        expect(event.handled).toBe(true);
        expect(event.originalEvent.preventDefault).toHaveBeenCalled();
    });

    it('pause triggers pokePlayerOsd', () => {
        const { handlers, deps } = setup();
        handlers.keyPress?.(makeKeyEvent('pause'));

        expect(deps.pokePlayerOsd).toHaveBeenCalledWith('pause');
    });

    it('consumes EPG mode input without handling selection while input is blocked', () => {
        const { handlers, epg, navigation } = setup();
        (epg.isVisible as jest.Mock).mockReturnValue(true);
        (navigation.isModalOpen as jest.Mock).mockReturnValue(false);
        (navigation.isInputBlocked as jest.Mock).mockReturnValue(true);
        const event = makeKeyEvent('ok');

        handlers.keyPress?.(event);

        expect(epg.handleSelect).not.toHaveBeenCalled();
        expect(event.handled).toBe(true);
        expect(event.originalEvent.preventDefault).toHaveBeenCalled();
    });

    it('fastforward seeks forward and pokes OSD', () => {
        const { handlers, deps, videoPlayer } = setup();

        handlers.keyPress?.(makeKeyEvent('fastforward'));

        expect(videoPlayer.seekRelative).toHaveBeenCalledWith(10_000);
        expect(deps.pokePlayerOsd).toHaveBeenCalledWith('seek');
    });

    it('rewind seeks backward and pokes OSD', () => {
        const { handlers, deps, videoPlayer } = setup();

        handlers.keyPress?.(makeKeyEvent('rewind'));

        expect(videoPlayer.seekRelative).toHaveBeenCalledWith(-10_000);
        expect(deps.pokePlayerOsd).toHaveBeenCalledWith('seek');
    });

    it('settings handler only runs from player or guide', () => {
        const { handlers, navigation } = setup();

        (navigation.getCurrentScreen as jest.Mock).mockReturnValue('player' as Screen);
        handlers.settings?.(undefined);
        expect(navigation.goTo).toHaveBeenCalledWith('settings');

        (navigation.getCurrentScreen as jest.Mock).mockReturnValue('auth' as Screen);
        handlers.settings?.(undefined);
        expect(navigation.goTo).toHaveBeenCalledTimes(1);
    });

    it('screen change shows/hides EPG and pauses/resumes player', () => {
        const { handlers, epg, videoPlayer, deps, navigation } = setup();
        (epg.isVisible as jest.Mock).mockReturnValue(false);

        handlers.screenChange?.({ from: 'player', to: 'guide' });
        expect(deps.toggleEpg).toHaveBeenCalled();

        handlers.screenChange?.({ from: 'guide', to: 'player' });
        expect(epg.hide).toHaveBeenCalled();

        handlers.screenChange?.({ from: 'player', to: 'settings' });
        expect(videoPlayer.pause).toHaveBeenCalled();
        expect(deps.hideMiniGuide).toHaveBeenCalled();

        handlers.screenChange?.({ from: 'settings', to: 'player' });
        expect(videoPlayer.play).toHaveBeenCalled();

        (navigation.isModalOpen as jest.Mock).mockReturnValue(true);
        handlers.screenChange?.({ from: 'player', to: 'home' });
        expect(navigation.closeModal).toHaveBeenCalledWith(NOW_PLAYING_INFO_MODAL_ID);
    });

    it('reports a toast when resume playback fails on screen change', async () => {
        const reportToast = jest.fn();
        const { handlers, deps, videoPlayer } = setup();
        (deps as unknown as { reportToast?: (toast: unknown) => void }).reportToast = reportToast;
        (videoPlayer.play as jest.Mock).mockRejectedValueOnce(new Error('play failed'));

        handlers.screenChange?.({ from: 'settings', to: 'player' });
        await Promise.resolve();

        expect(deps.reportRecoverableAsyncFailure).toHaveBeenCalledWith(
            'navigation.resume_play',
            '[Navigation] resume_play failed:',
            expect.any(Error)
        );
        expect(reportToast).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.any(String), type: 'warning' })
        );
    });

    it('reports a toast when resume playback throws synchronously on screen change', () => {
        const reportToast = jest.fn();
        const { handlers, deps, videoPlayer } = setup();
        (deps as unknown as { reportToast?: (toast: unknown) => void }).reportToast = reportToast;
        (videoPlayer.play as jest.Mock).mockImplementationOnce(() => {
            throw new Error('sync play failed');
        });

        expect(() => {
            handlers.screenChange?.({ from: 'settings', to: 'player' });
        }).not.toThrow();

        expect(deps.reportRecoverableAsyncFailure).toHaveBeenCalledWith(
            'navigation.resume_play',
            '[Navigation] resume_play failed:',
            expect.any(Error)
        );
        expect(reportToast).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.any(String), type: 'warning' })
        );
    });

    it('reports a toast when Play key playback fails', async () => {
        const reportToast = jest.fn();
        const { handlers, deps, videoPlayer } = setup();
        (deps as unknown as { reportToast?: (toast: unknown) => void }).reportToast = reportToast;
        (videoPlayer.play as jest.Mock).mockRejectedValueOnce(new Error('play failed'));

        handlers.keyPress?.(makeKeyEvent('play'));
        await Promise.resolve();

        expect(deps.reportRecoverableAsyncFailure).toHaveBeenCalledWith(
            'navigation.remote_play',
            '[Navigation] remote_play failed:',
            expect.any(Error)
        );
        expect(reportToast).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.any(String), type: 'warning' })
        );
    });

    it('reports a toast when Play key playback throws synchronously', () => {
        const reportToast = jest.fn();
        const { handlers, deps, videoPlayer } = setup();
        (deps as unknown as { reportToast?: (toast: unknown) => void }).reportToast = reportToast;
        (videoPlayer.play as jest.Mock).mockImplementationOnce(() => {
            throw new Error('sync play failed');
        });

        expect(() => {
            handlers.keyPress?.(makeKeyEvent('play'));
        }).not.toThrow();

        expect(deps.reportRecoverableAsyncFailure).toHaveBeenCalledWith(
            'navigation.remote_play',
            '[Navigation] remote_play failed:',
            expect.any(Error)
        );
        expect(reportToast).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.any(String), type: 'warning' })
        );
    });

    it('reports seek failures when rewind throws synchronously', () => {
        const { handlers, deps, videoPlayer } = setup();
        (videoPlayer.seekRelative as jest.Mock).mockImplementationOnce(() => {
            throw new Error('sync seek failed');
        });

        expect(() => {
            handlers.keyPress?.(makeKeyEvent('rewind'));
        }).not.toThrow();

        expect(deps.reportRecoverableAsyncFailure).toHaveBeenCalledWith(
            'navigation.seek',
            '[Navigation] seek failed:',
            expect.any(Error)
        );
        expect(deps.pokePlayerOsd).toHaveBeenCalledWith('seek');
    });

    it('throttles duplicate non-blocking failures to one toast and one diagnostics callback per key window', async () => {
        const reportToast = jest.fn();
        const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000);
        const playFailure = new Error('play failed');
        const { handlers, deps, videoPlayer } = setup();
        (deps as unknown as { reportToast?: (toast: unknown) => void }).reportToast = reportToast;
        (videoPlayer.play as jest.Mock).mockRejectedValue(playFailure);

        handlers.keyPress?.(makeKeyEvent('play'));
        await Promise.resolve();
        handlers.keyPress?.(makeKeyEvent('play'));
        await Promise.resolve();

        expect(deps.reportRecoverableAsyncFailure).toHaveBeenCalledTimes(1);
        expect(reportToast).toHaveBeenCalledTimes(1);

        nowSpy.mockRestore();
    });

    it('swallows failures from diagnostics and toast reporters in non-blocking paths', async () => {
        const { handlers, deps, videoPlayer } = setup({
            reportRecoverableAsyncFailure: jest.fn(() => {
                throw new Error('diagnostics failed');
            }),
        });
        const reportToast = jest.fn(() => {
            throw new Error('toast failed');
        });
        (deps as unknown as { reportToast?: (toast: unknown) => void }).reportToast = reportToast;
        (videoPlayer.play as jest.Mock).mockRejectedValue(new Error('play failed'));

        expect(() => {
            handlers.keyPress?.(makeKeyEvent('play'));
        }).not.toThrow();

        await Promise.resolve();

        expect(deps.reportRecoverableAsyncFailure).toHaveBeenCalledTimes(1);
        expect(reportToast).toHaveBeenCalledTimes(1);
    });

    it('guide hides mini-guide before toggling EPG', () => {
        const { handlers, deps } = setup();

        handlers.guide?.(undefined);

        expect(deps.hideMiniGuide).toHaveBeenCalledTimes(1);
        expect(deps.toggleEpg).toHaveBeenCalledTimes(1);
    });

    it('does not pause when keep-playing-in-settings is enabled', () => {
        const { handlers, videoPlayer, deps } = setup({
            readKeepPlayingInSettings: jest.fn().mockReturnValue(true),
        });
        handlers.screenChange?.({ from: 'player', to: 'settings' });
        expect(deps.readKeepPlayingInSettings).toHaveBeenCalled();
        expect(videoPlayer.pause).not.toHaveBeenCalled();
    });

    it('channel setup gate replaces player screen', () => {
        const { handlers, deps, navigation } = setup({
            shouldRunChannelSetup: jest.fn().mockReturnValue(true),
        });

        handlers.screenChange?.({ from: 'home', to: 'player' });

        expect(deps.shouldRunChannelSetup).toHaveBeenCalled();
        expect(navigation.replaceScreen).toHaveBeenCalledWith('channel-setup');
    });

    it('hides EPG before channel setup redirects a guide-to-player transition', () => {
        const { handlers, deps, epg, navigation } = setup({
            shouldRunChannelSetup: jest.fn().mockReturnValue(true),
        });

        handlers.screenChange?.({ from: 'guide', to: 'player' });

        expect(epg.hide).toHaveBeenCalledTimes(1);
        expect(navigation.replaceScreen).toHaveBeenCalledWith('channel-setup');
        expect(deps.hideMiniGuide).not.toHaveBeenCalled();
    });

    it('modal open/close triggers now playing overlay handlers', () => {
        const { handlers, deps } = setup();

        handlers.modalOpen?.({ modalId: NOW_PLAYING_INFO_MODAL_ID });
        expect(deps.showNowPlayingInfoOverlay).toHaveBeenCalled();

        handlers.modalClose?.({ modalId: NOW_PLAYING_INFO_MODAL_ID });
        expect(deps.hideNowPlayingInfoOverlay).toHaveBeenCalled();
    });

    it('modal open/close triggers exit-confirm handlers', () => {
        const { handlers, deps } = setup();

        handlers.modalOpen?.({ modalId: deps.exitConfirmModalId });
        expect(deps.showExitConfirmModal).toHaveBeenCalled();

        handlers.modalClose?.({ modalId: deps.exitConfirmModalId });
        expect(deps.hideExitConfirmModal).toHaveBeenCalled();
    });

    it('modal open hides mini-guide', () => {
        const { handlers, deps } = setup();

        handlers.modalOpen?.({ modalId: 'any-modal' });

        expect(deps.hideMiniGuide).toHaveBeenCalledTimes(1);
    });

    it('does not route to EPG when overlay is not visible', () => {
        const { handlers, epg } = setup();
        (epg.isVisible as jest.Mock).mockReturnValue(false);

        const event = makeKeyEvent('left');
        handlers.keyPress?.(event);

        expect(epg.handleNavigation).not.toHaveBeenCalled();
        expect(event.handled).toBeUndefined();
    });

    it('does not route to EPG when a modal is open', () => {
        const { handlers, epg, navigation } = setup();
        (epg.isVisible as jest.Mock).mockReturnValue(true);
        (navigation.isModalOpen as jest.Mock).mockReturnValue(true);

        const event = makeKeyEvent('down');
        handlers.keyPress?.(event);

        expect(epg.handleNavigation).not.toHaveBeenCalled();
    });

    it('routes to EPG when overlay is visible and no modal open', () => {
        const { handlers, epg, navigation } = setup();
        (epg.isVisible as jest.Mock).mockReturnValue(true);
        (navigation.isModalOpen as jest.Mock).mockReturnValue(false);
        (epg.handleNavigation as jest.Mock).mockReturnValue(true);

        const event = makeKeyEvent('right');
        handlers.keyPress?.(event);
        handlers.keyUp?.({ button: 'right' });

        expect(epg.handleNavigation).toHaveBeenCalledWith('right');
        expect(event.handled).toBe(true);
    });

    it('routes to EPG when overlay is visible on player screen', () => {
        const { handlers, epg, navigation } = setup();
        (epg.isVisible as jest.Mock).mockReturnValue(true);
        (navigation.getCurrentScreen as jest.Mock).mockReturnValue('player' as Screen);
        (navigation.isModalOpen as jest.Mock).mockReturnValue(false);
        (epg.handleNavigation as jest.Mock).mockReturnValue(true);

        const event = makeKeyEvent('down');
        handlers.keyPress?.(event);
        handlers.keyUp?.({ button: 'down' });

        expect(epg.handleNavigation).toHaveBeenCalledWith('down');
        expect(event.handled).toBe(true);
    });

    it('routes ok to EPG selection before player OSD toggling when guide is visible', () => {
        const { handlers, epg, deps, navigation } = setup();
        (epg.isVisible as jest.Mock).mockReturnValue(true);
        (navigation.isModalOpen as jest.Mock).mockReturnValue(false);
        const event = makeKeyEvent('ok');

        handlers.keyPress?.(event);

        expect(epg.handleSelect).toHaveBeenCalledTimes(1);
        expect(deps.togglePlayerOsd).not.toHaveBeenCalled();
        expect(event.handled).toBe(true);
    });

    it('hides EPG when entering settings screen', () => {
        const { handlers, epg } = setup();

        handlers.screenChange?.({ from: 'player', to: 'settings' });

        expect(epg.hide).toHaveBeenCalled();
    });

    it('preserves player continuity across settings roundtrip', () => {
        const { handlers, deps, epg, videoPlayer, navigation } = setup();
        (navigation.isModalOpen as jest.Mock).mockImplementation(
            (modalId?: string) => modalId === NOW_PLAYING_INFO_MODAL_ID
        );

        handlers.screenChange?.({ from: 'player', to: 'settings' });

        expect(epg.hide).toHaveBeenCalledTimes(1);
        expect(navigation.closeModal).toHaveBeenCalledWith(NOW_PLAYING_INFO_MODAL_ID);
        expect(deps.hideMiniGuide).toHaveBeenCalledTimes(1);
        expect(deps.hidePlayerOsd).toHaveBeenCalledTimes(1);
        expect(videoPlayer.pause).toHaveBeenCalledTimes(1);

        handlers.screenChange?.({ from: 'settings', to: 'player' });

        expect(videoPlayer.play).toHaveBeenCalledTimes(1);
    });

    describe('mini guide repeat', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            jest.setSystemTime(0);
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('starts repeating after initial delay and stops on keyUp', async () => {
            const { handlers, deps, navigation } = setup({
                isMiniGuideVisible: jest.fn().mockReturnValue(true),
                handleMiniGuideNavigation: jest.fn().mockReturnValue(true),
            });
            (navigation.isModalOpen as jest.Mock).mockReturnValue(false);
            (navigation.isInputBlocked as jest.Mock).mockReturnValue(false);

            handlers.keyPress?.(makeKeyEvent('down'));
            expect(deps.handleMiniGuideNavigation).toHaveBeenCalledTimes(1);

            await advanceTimersUntil(() => {
                expect(deps.handleMiniGuideNavigation).toHaveBeenCalledTimes(2);
            }, {
                stepMs: 25,
                timeoutMs: MINI_GUIDE_REPEAT_TIMING.INITIAL_DELAY_MS + 200,
            });

            handlers.keyUp?.({ button: 'down' });
            const callsOnStop = (deps.handleMiniGuideNavigation as jest.Mock).mock.calls.length;
            expect(jest.getTimerCount()).toBe(0);
            expect(deps.handleMiniGuideNavigation).toHaveBeenCalledTimes(callsOnStop);
        });

        it('repeat stops when input is blocked', async () => {
            const { handlers, deps, navigation } = setup({
                isMiniGuideVisible: jest.fn().mockReturnValue(true),
                handleMiniGuideNavigation: jest.fn().mockReturnValue(true),
            });
            const isInputBlocked = navigation.isInputBlocked as jest.Mock;
            isInputBlocked.mockReturnValue(false);

            handlers.keyPress?.(makeKeyEvent('down'));
            await advanceTimersUntil(() => {
                expect(deps.handleMiniGuideNavigation).toHaveBeenCalledTimes(2);
            }, {
                stepMs: 25,
                timeoutMs: MINI_GUIDE_REPEAT_TIMING.INITIAL_DELAY_MS + 200,
            });

            isInputBlocked.mockReturnValue(true);
            const callsBeforeBlock = (deps.handleMiniGuideNavigation as jest.Mock).mock.calls.length;
            jest.advanceTimersByTime(MINI_GUIDE_REPEAT_TIMING.INTERVAL_1_MS + 1);
            expect(jest.getTimerCount()).toBe(0);
            expect(deps.handleMiniGuideNavigation).toHaveBeenCalledTimes(callsBeforeBlock);
        });

        it('repeat stops when leaving player screen', async () => {
            const { handlers, deps, navigation } = setup({
                isMiniGuideVisible: jest.fn().mockReturnValue(true),
                handleMiniGuideNavigation: jest.fn().mockReturnValue(true),
            });
            (navigation.isInputBlocked as jest.Mock).mockReturnValue(false);
            const getCurrentScreen = navigation.getCurrentScreen as jest.Mock;
            getCurrentScreen.mockReturnValue('player');

            handlers.keyPress?.(makeKeyEvent('down'));
            await advanceTimersUntil(() => {
                expect(deps.handleMiniGuideNavigation).toHaveBeenCalledTimes(2);
            }, {
                stepMs: 25,
                timeoutMs: MINI_GUIDE_REPEAT_TIMING.INITIAL_DELAY_MS + 200,
            });

            getCurrentScreen.mockReturnValue('settings');
            const callsBeforeLeave = (deps.handleMiniGuideNavigation as jest.Mock).mock.calls.length;
            jest.advanceTimersByTime(MINI_GUIDE_REPEAT_TIMING.INTERVAL_1_MS + 1);
            expect(jest.getTimerCount()).toBe(0);
            expect(deps.handleMiniGuideNavigation).toHaveBeenCalledTimes(callsBeforeLeave);
        });
    });

    describe('epg repeat', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            jest.setSystemTime(0);
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('starts repeating after initial delay and stops on keyUp', async () => {
            const { handlers, epg, navigation } = setup();
            (epg.isVisible as jest.Mock).mockReturnValue(true);
            (navigation.isModalOpen as jest.Mock).mockReturnValue(false);
            (navigation.isInputBlocked as jest.Mock).mockReturnValue(false);
            (epg.handleNavigation as jest.Mock).mockReturnValue(true);

            handlers.keyPress?.(makeKeyEvent('down'));
            expect(epg.handleNavigation).toHaveBeenCalledTimes(1);

            await advanceTimersUntil(() => {
                expect(epg.handleNavigation).toHaveBeenCalledTimes(2);
            }, {
                stepMs: 25,
                timeoutMs: EPG_REPEAT_TIMING.INITIAL_DELAY_MS + 200,
            });

            handlers.keyUp?.({ button: 'down' });
            const callsOnStop = (epg.handleNavigation as jest.Mock).mock.calls.length;
            expect(jest.getTimerCount()).toBe(0);
            expect(epg.handleNavigation).toHaveBeenCalledTimes(callsOnStop);
        });

        it('repeat stops on modal open', async () => {
            const { handlers, epg, navigation } = setup();
            (epg.isVisible as jest.Mock).mockReturnValue(true);
            (navigation.isModalOpen as jest.Mock).mockReturnValue(false);
            (navigation.isInputBlocked as jest.Mock).mockReturnValue(false);
            (epg.handleNavigation as jest.Mock).mockReturnValue(true);

            handlers.keyPress?.(makeKeyEvent('right'));
            await advanceTimersUntil(() => {
                expect(epg.handleNavigation).toHaveBeenCalledTimes(2);
            }, {
                stepMs: 25,
                timeoutMs: EPG_REPEAT_TIMING.INITIAL_DELAY_MS + 200,
            });

            handlers.modalOpen?.({ modalId: 'any' });
            const callsBeforeModal = (epg.handleNavigation as jest.Mock).mock.calls.length;
            expect(jest.getTimerCount()).toBe(0);
            expect(epg.handleNavigation).toHaveBeenCalledTimes(callsBeforeModal);
        });

        it('repeat stops on screen change away from guide', async () => {
            const { handlers, epg, navigation } = setup();
            (epg.isVisible as jest.Mock).mockReturnValue(true);
            (navigation.isModalOpen as jest.Mock).mockReturnValue(false);
            (navigation.isInputBlocked as jest.Mock).mockReturnValue(false);
            (epg.handleNavigation as jest.Mock).mockReturnValue(true);

            handlers.keyPress?.(makeKeyEvent('left'));
            await advanceTimersUntil(() => {
                expect(epg.handleNavigation).toHaveBeenCalledTimes(2);
            }, {
                stepMs: 25,
                timeoutMs: EPG_REPEAT_TIMING.INITIAL_DELAY_MS + 200,
            });

            handlers.screenChange?.({ from: 'guide', to: 'player' });
            const callsBeforeLeave = (epg.handleNavigation as jest.Mock).mock.calls.length;
            expect(jest.getTimerCount()).toBe(0);
            expect(epg.handleNavigation).toHaveBeenCalledTimes(callsBeforeLeave);
        });

        it('repeat stops when input is blocked', async () => {
            const { handlers, epg, navigation } = setup();
            const isInputBlocked = navigation.isInputBlocked as jest.Mock;
            (epg.isVisible as jest.Mock).mockReturnValue(true);
            (navigation.isModalOpen as jest.Mock).mockReturnValue(false);
            isInputBlocked.mockReturnValue(false);
            (epg.handleNavigation as jest.Mock).mockReturnValue(true);

            handlers.keyPress?.(makeKeyEvent('down'));
            await advanceTimersUntil(() => {
                expect(epg.handleNavigation).toHaveBeenCalledTimes(2);
            }, {
                stepMs: 25,
                timeoutMs: EPG_REPEAT_TIMING.INITIAL_DELAY_MS + 200,
            });

            isInputBlocked.mockReturnValue(true);
            const callsBeforeBlock = (epg.handleNavigation as jest.Mock).mock.calls.length;
            jest.advanceTimersByTime(EPG_REPEAT_TIMING.INTERVAL_1_MS + 1);
            expect(jest.getTimerCount()).toBe(0);
            expect(epg.handleNavigation).toHaveBeenCalledTimes(callsBeforeBlock);
        });

        it('repeat stops immediately on back', async () => {
            const { handlers, epg, navigation } = setup();
            (epg.isVisible as jest.Mock).mockReturnValue(true);
            (navigation.isModalOpen as jest.Mock).mockReturnValue(false);
            (navigation.isInputBlocked as jest.Mock).mockReturnValue(false);
            (epg.handleNavigation as jest.Mock).mockReturnValue(true);
            (epg.handleBack as jest.Mock).mockReturnValue(true);

            handlers.keyPress?.(makeKeyEvent('right'));
            await advanceTimersUntil(() => {
                expect(epg.handleNavigation).toHaveBeenCalledTimes(2);
            }, {
                stepMs: 25,
                timeoutMs: EPG_REPEAT_TIMING.INITIAL_DELAY_MS + 200,
            });

            handlers.keyPress?.(makeKeyEvent('back'));
            const callsBeforeBack = (epg.handleNavigation as jest.Mock).mock.calls.length;
            expect(jest.getTimerCount()).toBe(0);
            expect(epg.handleNavigation).toHaveBeenCalledTimes(callsBeforeBack);
        });
    });
});
