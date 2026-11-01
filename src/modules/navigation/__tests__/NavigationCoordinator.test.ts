import {
    NavigationCoordinator,
    type NavigationCoordinatorDeps,
} from '../coordinator/NavigationCoordinator';
import {
    NavigationChannelNumberHandler,
    type NavigationChannelNumberPort,
} from '../handlers/NavigationChannelNumberHandler';
import type {
    NavigationEpgPort,
    NavigationMiniGuideIntent,
    NavigationMiniGuidePort,
    NavigationPlayerOsdIntent,
    NavigationPlaybackPort,
} from '../contracts/NavigationFeaturePorts';
import { createNavigationCoordinatorRuntimeServices } from '../coordinator/NavigationCoordinatorRuntimeServices';
import {
    NavigationKeyModeRouter,
    type NavigationKeyModeRouterPort,
} from '../handlers/NavigationKeyModeRouter';
import {
    NavigationModalEffectsHandler,
    type NavigationModalEffectsPort,
} from '../handlers/NavigationModalEffectsHandler';
import {
    NavigationRepeatHandler,
    type NavigationRepeatHandlerPort,
} from '../handlers/NavigationRepeatHandler';
import {
    NavigationScreenEffectsHandler,
    type NavigationScreenEffectsPort,
} from '../handlers/NavigationScreenEffectsHandler';
import type { INavigationManager, KeyEvent, NavigationEventMap, Screen } from '../contracts/interfaces';
import {
    computeAcceleratedRepeatIntervalMs,
    EPG_REPEAT_TIMING,
    MINI_GUIDE_REPEAT_TIMING,
} from '../config/constants';
import { advanceTimersUntil, createDeferred } from '../../../__tests__/helpers';
import type { IDisposable } from '../../../utils/interfaces';
import { NavigationRemoteInputRouter } from '../input/NavigationRemoteInputRouter';

type HandlerMap = Partial<{
    [K in keyof NavigationEventMap]: (payload: NavigationEventMap[K]) => void;
}>;

type NavigationPlaybackTestPort = NavigationPlaybackPort & {
    playerOsd: {
        overlay: { isVisible: jest.Mock };
        coordinator: {
            poke: jest.Mock;
            toggle: jest.Mock;
            hide: jest.Mock;
        };
    };
};

type NavigationMiniGuideTestPort = NavigationMiniGuidePort & {
    overlay: { isVisible: jest.Mock };
    coordinator: {
        show: jest.Mock;
        hide: jest.Mock;
        handleNavigation: jest.Mock;
        handlePage: jest.Mock;
        handleSelect: jest.Mock;
    };
};

type NavigationVideoPlayerTestPort = {
    play: jest.Mock<Promise<void>, []>;
    pause: jest.Mock<void, []>;
    seekRelative: jest.Mock<Promise<void>, [number]>;
};

type NavigationAuthTestPort = {
    isAuthenticated: jest.Mock<boolean, []>;
};

type NavigationCoordinatorTestDeps = NavigationCoordinatorDeps & {
    events: Omit<NavigationCoordinatorDeps['events'], 'miniGuide'> & {
        miniGuide: NavigationMiniGuideTestPort;
    };
    repeats: Omit<NavigationRepeatHandlerPort, 'miniGuide'> & {
        miniGuide: NavigationMiniGuideTestPort;
    };
    guideMiniGuide: {
        hideForGuideToggle: jest.Mock;
        isGuideVisible: jest.Mock;
    };
    keyModeRouter: Omit<NavigationKeyModeRouterPort, 'playback' | 'miniGuide'> & {
        playback: NavigationPlaybackTestPort;
        miniGuide: NavigationMiniGuideTestPort;
    };
    screenEffects: Omit<NavigationScreenEffectsPort, 'playback' | 'miniGuide'> & {
        playback: NavigationPlaybackTestPort;
        miniGuide: NavigationMiniGuideTestPort;
    };
    modalEffects: Omit<NavigationModalEffectsPort, 'miniGuide'> & {
        miniGuide: NavigationMiniGuideTestPort;
    };
    channelNumber: NavigationChannelNumberPort;
};

const makeNavigation = (): {
    navigation: INavigationManager;
    handlers: HandlerMap;
    disposeCalls: jest.Mock[];
} => {
    const handlers: HandlerMap = {};
    const disposeCalls: jest.Mock[] = [];
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
        goBack: jest.fn().mockReturnValue(false),
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
        ): IDisposable => {
            const typedHandlers = handlers as Record<K, (payload: NavigationEventMap[K]) => void>;
            typedHandlers[event] = handler;
            const dispose = jest.fn((): void => {
                if (handlers[event] === handler) {
                    delete handlers[event];
                }
            });
            disposeCalls.push(dispose);
            return { dispose };
        }),
        off: jest.fn(),
    } as unknown as INavigationManager;
    return { navigation, handlers, disposeCalls };
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

type NavigationCoordinatorTestOverrides = {
    videoPlayer: NavigationVideoPlayerTestPort | null;
    plexAuth: NavigationAuthTestPort | null;
    stopPlayback: jest.Mock;
    pokePlayerOsd: jest.Mock;
    togglePlayerOsd: jest.Mock;
    getSeekIncrementMs: jest.Mock;
    isPlayerOsdVisible: jest.Mock;
    isPlayerTransportContext: jest.Mock;
    showMiniGuide: jest.Mock;
    hideMiniGuide: jest.Mock;
    isMiniGuideVisible: jest.Mock;
    handleMiniGuideNavigation: jest.Mock;
    handleMiniGuidePage: jest.Mock;
    handleMiniGuideSelect: jest.Mock;
    setLastChannelChangeSourceRemote: jest.Mock;
    setLastChannelChangeSourceNumber: jest.Mock;
    switchToNextChannel: jest.Mock;
    switchToPreviousChannel: jest.Mock;
    switchToChannelByNumber: jest.Mock;
    focusEpgOnCurrentChannel: jest.Mock;
    onChannelInputUpdate?: jest.Mock;
    toggleEpg: jest.Mock;
    closeEpg: jest.Mock;
    shouldRunChannelSetup: jest.Mock;
    hidePlayerOsd: jest.Mock;
    hideChannelTransition: jest.Mock;
    reportRecoverableAsyncFailure: jest.Mock;
    reportToast: jest.Mock | undefined;
    readKeepPlayingInSettings: jest.Mock;
    readDebugLoggingEnabled: jest.Mock;
};

const setup = (
    overrides: Partial<NavigationCoordinatorTestOverrides> = {}
): {
    coordinator: NavigationCoordinator;
    deps: NavigationCoordinatorTestDeps;
    handlers: HandlerMap;
    navigation: INavigationManager;
    epg: NavigationEpgPort;
    videoPlayer: NavigationVideoPlayerTestPort;
    plexAuth: NavigationAuthTestPort;
    unsubs: Array<() => void>;
    disposeCalls: jest.Mock[];
} => {
    const { navigation, handlers, disposeCalls } = makeNavigation();
    const epg: NavigationEpgPort = {
        isVisible: jest.fn().mockReturnValue(false),
        handleNavigation: jest.fn().mockReturnValue(false),
        handlePage: jest.fn().mockReturnValue(false),
        handleSelect: jest.fn().mockReturnValue(false),
        handleBack: jest.fn().mockReturnValue(false),
        focusNow: jest.fn(),
        openLineupMenu: jest.fn(),
    };
    const videoPlayer: NavigationVideoPlayerTestPort = {
        play: jest.fn().mockResolvedValue(undefined),
        pause: jest.fn(),
        seekRelative: jest.fn().mockResolvedValue(undefined),
    };
    const plexAuth: NavigationAuthTestPort = {
        isAuthenticated: jest.fn().mockReturnValue(true),
    };

    const testDoubles: NavigationCoordinatorTestOverrides = {
        videoPlayer,
        plexAuth,
        stopPlayback: jest.fn(),
        pokePlayerOsd: jest.fn(),
        togglePlayerOsd: jest.fn(),
        getSeekIncrementMs: jest.fn().mockReturnValue(10_000),
        isPlayerOsdVisible: jest.fn().mockReturnValue(false),
        isPlayerTransportContext: jest.fn().mockReturnValue(true),
        showMiniGuide: jest.fn(),
        hideMiniGuide: jest.fn(),
        isMiniGuideVisible: jest.fn().mockReturnValue(false),
        handleMiniGuideNavigation: jest.fn().mockReturnValue(true),
        handleMiniGuidePage: jest.fn().mockReturnValue(true),
        handleMiniGuideSelect: jest.fn(),
        setLastChannelChangeSourceRemote: jest.fn(),
        setLastChannelChangeSourceNumber: jest.fn(),
        switchToNextChannel: jest.fn(),
        switchToPreviousChannel: jest.fn(),
        switchToChannelByNumber: jest.fn().mockResolvedValue({ kind: 'switched' }),
        focusEpgOnCurrentChannel: jest.fn(),
        toggleEpg: jest.fn(),
        closeEpg: jest.fn(),
        shouldRunChannelSetup: jest.fn().mockReturnValue(false),
        hidePlayerOsd: jest.fn(),
        hideChannelTransition: jest.fn(),
        reportRecoverableAsyncFailure: jest.fn(),
        reportToast: undefined,
        readKeepPlayingInSettings: jest.fn().mockReturnValue(false),
        readDebugLoggingEnabled: jest.fn().mockReturnValue(false),
        ...overrides,
    };

    const requestPlayerOsdIntent = jest.fn((_intent: NavigationPlayerOsdIntent): boolean => true);
    const requestMiniGuideIntent = jest.fn((intent: NavigationMiniGuideIntent): boolean => {
        if (intent.type === 'select') {
            testDoubles.setLastChannelChangeSourceRemote();
        }
        return true;
    });

    const playback = {
        isAuthenticatedForServerSelection: (): boolean => testDoubles.plexAuth?.isAuthenticated() ?? false,
        playFromRemote: (): Promise<void> | null => {
            if (!testDoubles.videoPlayer) {
                return null;
            }
            try {
                return testDoubles.videoPlayer.play();
            } catch (error) {
                return Promise.reject(error);
            }
        },
        pauseFromRemote: (): boolean => {
            if (!testDoubles.videoPlayer) {
                return false;
            }
            testDoubles.videoPlayer.pause();
            return true;
        },
        seekFromRemote: (deltaMs: number): Promise<void> | null => {
            if (!testDoubles.videoPlayer) {
                return null;
            }
            try {
                return testDoubles.videoPlayer.seekRelative(deltaMs);
            } catch (error) {
                return Promise.reject(error);
            }
        },
        pauseForScreenChange: (): boolean => {
            if (!testDoubles.videoPlayer) {
                return false;
            }
            testDoubles.videoPlayer.pause();
            return true;
        },
        resumeForScreenChange: (): Promise<void> | null => {
            if (!testDoubles.videoPlayer) {
                return null;
            }
            try {
                return testDoubles.videoPlayer.play();
            } catch (error) {
                return Promise.reject(error);
            }
        },
        stopPlayback: testDoubles.stopPlayback,
        getSeekIncrementMs: testDoubles.getSeekIncrementMs,
        isPlayerOsdVisible: testDoubles.isPlayerOsdVisible,
        isPlayerTransportContext: testDoubles.isPlayerTransportContext,
        requestPlayerOsdIntent,
        playerOsd: {
            overlay: { isVisible: testDoubles.isPlayerOsdVisible },
            coordinator: {
                poke: testDoubles.pokePlayerOsd,
                toggle: testDoubles.togglePlayerOsd,
                hide: testDoubles.hidePlayerOsd,
            },
        },
    };
    const miniGuide = {
        isVisible: testDoubles.isMiniGuideVisible,
        requestMiniGuideIntent,
        overlay: { isVisible: testDoubles.isMiniGuideVisible },
        coordinator: {
            show: testDoubles.showMiniGuide,
            hide: testDoubles.hideMiniGuide,
            handleNavigation: testDoubles.handleMiniGuideNavigation,
            handlePage: testDoubles.handleMiniGuidePage,
            handleSelect: testDoubles.handleMiniGuideSelect,
        },
    };
    const channelSwitching = {
        setLastChannelChangeSourceRemote: testDoubles.setLastChannelChangeSourceRemote,
        setLastChannelChangeSourceNumber: testDoubles.setLastChannelChangeSourceNumber,
        switchToNextChannel: testDoubles.switchToNextChannel,
        switchToPreviousChannel: testDoubles.switchToPreviousChannel,
        focusEpgOnCurrentChannel: testDoubles.focusEpgOnCurrentChannel,
        toggleEpg: testDoubles.toggleEpg,
        switchToChannelByNumber: testDoubles.switchToChannelByNumber,
        ...(testDoubles.onChannelInputUpdate
            ? { onChannelInputUpdate: testDoubles.onChannelInputUpdate }
            : {}),
    };
    const uiGuards = {
        shouldRunChannelSetup: testDoubles.shouldRunChannelSetup,
        hideChannelTransition: testDoubles.hideChannelTransition,
    };

    const deps = {
        events: {
            navigation,
            miniGuide,
            channelSwitching,
            reportRecoverableAsyncFailure: testDoubles.reportRecoverableAsyncFailure,
            ...(testDoubles.reportToast ? { reportToast: testDoubles.reportToast } : {}),
            readDebugLoggingEnabled: testDoubles.readDebugLoggingEnabled,
        },
        repeats: {
            navigation,
            epg,
            miniGuide,
        },
        guideMiniGuide: {
            hideForGuideToggle: jest.fn(() => {
                testDoubles.hideMiniGuide();
            }),
            isGuideVisible: epg.isVisible,
        },
        keyModeRouter: {
            navigation,
            epg,
            closeEpg: testDoubles.closeEpg,
            playback,
            miniGuide,
            channelSwitching,
        },
        screenEffects: {
            navigation,
            epg,
            closeEpg: testDoubles.closeEpg,
            playback,
            miniGuide,
            channelSwitching,
            uiGuards,
            readKeepPlayingInSettings: testDoubles.readKeepPlayingInSettings,
        },
        modalEffects: {
            miniGuide,
        },
        channelNumber: {
            epg,
            channelSwitching,
        },
    } as unknown as NavigationCoordinatorTestDeps;

    const runtime = createNavigationCoordinatorRuntimeServices(deps.events);
    const repeats = new NavigationRepeatHandler({
        navigation,
        epg,
        miniGuide,
    });
    deps.runtime = runtime;
    deps.handlers = {
        repeats,
        keyModeRouter: new NavigationKeyModeRouter(
            {
                navigation,
                epg,
                closeEpg: testDoubles.closeEpg,
                playback,
                miniGuide,
                channelSwitching,
            },
            repeats,
            runtime.fireAndReport,
            runtime.observeNonBlockingPromise,
            runtime.logInputNotHandled
        ),
        screenEffects: new NavigationScreenEffectsHandler(
            {
                navigation,
                epg,
                closeEpg: testDoubles.closeEpg,
                playback,
                miniGuide,
                channelSwitching,
                uiGuards,
                readKeepPlayingInSettings: testDoubles.readKeepPlayingInSettings,
            },
            repeats,
            runtime.fireAndReport
        ),
        modalEffects: new NavigationModalEffectsHandler(
            {
                miniGuide,
            },
            repeats
        ),
        channelNumber: new NavigationChannelNumberHandler({
            epg,
            channelSwitching,
        }),
    };

    const coordinator = new NavigationCoordinator(deps);
    const unsubs = coordinator.wireNavigationEvents();

    return { coordinator, deps, handlers, navigation, epg, videoPlayer, plexAuth, unsubs, disposeCalls };
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

    it('returns cleanup callbacks that dispose navigation subscriptions', () => {
        const { unsubs, disposeCalls, handlers, navigation } = setup();

        expect(unsubs.length).toBeGreaterThan(0);
        for (const unsubscribe of unsubs) {
            unsubscribe();
        }

        expect(disposeCalls.length).toBeGreaterThan(0);
        expect(disposeCalls.every((dispose) => dispose.mock.calls.length === 1)).toBe(true);
        expect(handlers.keyPress).toBeUndefined();
        expect(navigation.off).not.toHaveBeenCalled();
    });

    it('does not log an error when channel-number entry is superseded (AbortError)', async () => {
        const abortError = Object.assign(new Error('superseded'), { name: 'AbortError' });
        const { handlers, deps } = setup({
            switchToChannelByNumber: jest.fn().mockRejectedValue(abortError),
        });

        handlers.channelNumberEntered?.({ channelNumber: 12 });

        // Allow the catch handler to run.
        await Promise.resolve();

        expect(deps.events.channelSwitching.setLastChannelChangeSourceNumber).toHaveBeenCalledTimes(1);
        expect(deps.events.channelSwitching.switchToChannelByNumber).toHaveBeenCalledWith(12);
        expect(deps.events.reportRecoverableAsyncFailure).not.toHaveBeenCalled();
    });

    it('reports diagnostics when channel-number entry fails unexpectedly', async () => {
        const failure = new Error('boom');
        const { handlers, deps } = setup({
            switchToChannelByNumber: jest.fn().mockRejectedValue(failure),
        });

        handlers.channelNumberEntered?.({ channelNumber: 7 });
        await Promise.resolve();
        await Promise.resolve();

        expect(deps.events.reportRecoverableAsyncFailure).toHaveBeenCalledWith(
            'navigation.channel-number',
            '[Navigation] channel-number failed:',
            failure
        );
    });

    it('channelNumberEntered focuses EPG current channel after numeric switch when guide is visible', async () => {
        const focusEpgOnCurrentChannel = jest.fn();
        const { handlers, deps, epg } = setup({
            focusEpgOnCurrentChannel,
            switchToChannelByNumber: jest.fn().mockResolvedValue({ kind: 'switched' }),
        });
        (epg.isVisible as jest.Mock).mockReturnValue(true);

        handlers.channelNumberEntered?.({ channelNumber: 42 });
        await Promise.resolve();

        expect(deps.events.channelSwitching.switchToChannelByNumber).toHaveBeenCalledWith(42);
        expect(focusEpgOnCurrentChannel).toHaveBeenCalledTimes(1);
    });

    it('channelNumberEntered does not call focusEpgOnCurrentChannel when guide is not visible', async () => {
        const focusEpgOnCurrentChannel = jest.fn();
        const { handlers, deps, epg } = setup({
            focusEpgOnCurrentChannel,
            switchToChannelByNumber: jest.fn().mockResolvedValue({ kind: 'switched' }),
        });
        (epg.isVisible as jest.Mock).mockReturnValue(false);

        handlers.channelNumberEntered?.({ channelNumber: 42 });
        await Promise.resolve();

        expect(deps.events.channelSwitching.switchToChannelByNumber).toHaveBeenCalledWith(42);
        expect(focusEpgOnCurrentChannel).not.toHaveBeenCalled();
    });

    it('channelNumberEntered does not focus EPG when switch outcome is aborted', async () => {
        const focusEpgOnCurrentChannel = jest.fn();
        const { handlers, deps, epg } = setup({
            focusEpgOnCurrentChannel,
            switchToChannelByNumber: jest.fn().mockResolvedValue({ kind: 'aborted' }),
        });
        (epg.isVisible as jest.Mock).mockReturnValue(true);

        handlers.channelNumberEntered?.({ channelNumber: 42 });
        await Promise.resolve();

        expect(deps.events.channelSwitching.switchToChannelByNumber).toHaveBeenCalledWith(42);
        expect(focusEpgOnCurrentChannel).not.toHaveBeenCalled();
    });

    it('channelNumberEntered does not focus EPG when switch outcome is failed', async () => {
        const focusEpgOnCurrentChannel = jest.fn();
        const { handlers, deps, epg } = setup({
            focusEpgOnCurrentChannel,
            switchToChannelByNumber: jest.fn().mockResolvedValue({ kind: 'failed', reason: 'content_unavailable' }),
        });
        (epg.isVisible as jest.Mock).mockReturnValue(true);

        handlers.channelNumberEntered?.({ channelNumber: 42 });
        await Promise.resolve();

        expect(deps.events.channelSwitching.switchToChannelByNumber).toHaveBeenCalledWith(42);
        expect(focusEpgOnCurrentChannel).not.toHaveBeenCalled();
    });

    it('forwards channelInputUpdate payload to dependency callback', () => {
        const onChannelInputUpdate = jest.fn();
        const { handlers } = setup({ onChannelInputUpdate });

        handlers.channelInputUpdate?.({ digits: '42', isComplete: false });

        expect(onChannelInputUpdate).toHaveBeenCalledWith({ digits: '42', isComplete: false });
    });

    it('leaves long Back to the system', () => {
        const { navigation } = setup();
        expect(navigation.handleLongPress).not.toHaveBeenCalledWith('back', expect.any(Function));
    });

    it('toggles player OSD on ok when in player screen', () => {
        const { handlers, deps } = setup();
        const keyPress = handlers.keyPress;
        if (!keyPress) {
            throw new Error('keyPress handler not registered');
        }

        const event = makeKeyEvent('ok');
        keyPress(event);

        expect(deps.keyModeRouter.playback.requestPlayerOsdIntent).toHaveBeenCalledWith({ type: 'reveal' });
        expect(deps.keyModeRouter.playback.playerOsd.coordinator?.toggle).not.toHaveBeenCalled();
        expect(event.handled).toBe(true);
        expect(event.originalEvent.preventDefault).toHaveBeenCalled();
    });

    it('does not toggle player OSD on ok when already visible', () => {
        const { handlers, deps } = setup({
            isPlayerOsdVisible: jest.fn().mockReturnValue(true),
        });
        const event = makeKeyEvent('ok');

        handlers.keyPress?.(event);

        expect(deps.keyModeRouter.playback.requestPlayerOsdIntent).not.toHaveBeenCalled();
        expect(deps.keyModeRouter.playback.playerOsd.coordinator?.toggle).not.toHaveBeenCalled();
        expect(event.handled).not.toBe(true);
    });

    it('opens player OSD on down when hidden on player screen', () => {
        const { handlers, deps } = setup({
            isPlayerOsdVisible: jest.fn().mockReturnValue(false),
        });
        const event = makeKeyEvent('down');

        handlers.keyPress?.(event);

        expect(deps.keyModeRouter.playback.requestPlayerOsdIntent).toHaveBeenCalledWith({ type: 'reveal' });
        expect(deps.keyModeRouter.playback.playerOsd.coordinator?.toggle).not.toHaveBeenCalled();
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

        expect(deps.events.miniGuide.requestMiniGuideIntent).toHaveBeenCalledWith({ type: 'show' });
        expect(deps.events.miniGuide.coordinator?.show).not.toHaveBeenCalled();
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

        expect(deps.events.miniGuide.requestMiniGuideIntent).not.toHaveBeenCalled();
        expect(deps.events.miniGuide.coordinator?.show).not.toHaveBeenCalled();
        expect(event.handled).not.toBe(true);
    });

    it('routes navigation to mini-guide when visible and prevents OSD toggles', () => {
        const { handlers, deps } = setup({
            isMiniGuideVisible: jest.fn().mockReturnValue(true),
        });

        const downEvent = makeKeyEvent('down');
        handlers.keyPress?.(downEvent);
        expect(deps.events.miniGuide.requestMiniGuideIntent).toHaveBeenCalledWith({
            type: 'navigate',
            direction: 'down',
        });
        expect(deps.events.miniGuide.coordinator?.handleNavigation).not.toHaveBeenCalled();
        expect(deps.keyModeRouter.playback.requestPlayerOsdIntent).not.toHaveBeenCalled();
        expect(deps.keyModeRouter.playback.playerOsd.coordinator?.toggle).not.toHaveBeenCalled();
        expect(downEvent.handled).toBe(true);

        const okEvent = makeKeyEvent('ok');
        handlers.keyPress?.(okEvent);
        expect(deps.events.miniGuide.requestMiniGuideIntent).toHaveBeenCalledWith({ type: 'select' });
        expect(deps.events.miniGuide.coordinator?.handleSelect).not.toHaveBeenCalled();
        expect(deps.events.channelSwitching.setLastChannelChangeSourceRemote).toHaveBeenCalledTimes(1);
        expect(deps.keyModeRouter.playback.requestPlayerOsdIntent).not.toHaveBeenCalled();
        expect(deps.keyModeRouter.playback.playerOsd.coordinator?.toggle).not.toHaveBeenCalled();
        expect(okEvent.handled).toBe(true);
    });

    it('does not route mini-guide when input is blocked', () => {
        const { handlers, deps, navigation } = setup({
            isMiniGuideVisible: jest.fn().mockReturnValue(true),
        });
        (navigation.isInputBlocked as jest.Mock).mockReturnValue(true);

        const event = makeKeyEvent('down');
        handlers.keyPress?.(event);

        expect(deps.events.miniGuide.requestMiniGuideIntent).not.toHaveBeenCalled();
        expect(deps.events.miniGuide.coordinator?.handleNavigation).not.toHaveBeenCalled();
        expect(event.handled).toBe(true);
        expect(event.originalEvent.preventDefault).toHaveBeenCalled();
    });

    it('back hides mini-guide and does not open exit-confirm', () => {
        const { handlers, deps, navigation } = setup({
            isMiniGuideVisible: jest.fn().mockReturnValue(true),
        });
        const event = makeKeyEvent('back');

        handlers.keyPress?.(event);

        expect(deps.events.miniGuide.requestMiniGuideIntent).toHaveBeenCalledWith({ type: 'hide' });
        expect(deps.events.miniGuide.coordinator?.hide).not.toHaveBeenCalled();
        expect(navigation.openModal).not.toHaveBeenCalled();
        expect(event.handled).toBe(true);
    });

    it('pages mini-guide on channel up/down without switching channels', () => {
        const { handlers, deps } = setup({
            isMiniGuideVisible: jest.fn().mockReturnValue(true),
        });

        handlers.keyPress?.(makeKeyEvent('channelUp'));
        expect(deps.events.miniGuide.requestMiniGuideIntent).toHaveBeenCalledWith({ type: 'page', direction: 'up' });
        expect(deps.events.miniGuide.coordinator?.handlePage).not.toHaveBeenCalled();
        expect(deps.events.channelSwitching.switchToPreviousChannel).not.toHaveBeenCalled();

        handlers.keyPress?.(makeKeyEvent('channelDown'));
        expect(deps.events.miniGuide.requestMiniGuideIntent).toHaveBeenCalledWith({ type: 'page', direction: 'down' });
        expect(deps.events.miniGuide.coordinator?.handlePage).not.toHaveBeenCalled();
        expect(deps.events.channelSwitching.switchToNextChannel).not.toHaveBeenCalled();
    });

    it('prefers mini-guide paging over EPG when both are visible', () => {
        const { handlers, deps, epg, navigation } = setup({
            isMiniGuideVisible: jest.fn().mockReturnValue(true),
        });
        (epg.isVisible as jest.Mock).mockReturnValue(true);
        (navigation.isModalOpen as jest.Mock).mockReturnValue(false);

        const event = makeKeyEvent('channelUp');
        handlers.keyPress?.(event);

        expect(deps.events.miniGuide.requestMiniGuideIntent).toHaveBeenCalledWith({ type: 'page', direction: 'up' });
        expect(deps.events.miniGuide.coordinator?.handlePage).not.toHaveBeenCalled();
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

        expect(deps.events.miniGuide.requestMiniGuideIntent).toHaveBeenCalledWith({ type: 'hide' });
        expect(deps.events.miniGuide.coordinator?.hide).not.toHaveBeenCalled();
        expect(deps.events.navigation.goTo).toHaveBeenCalledWith('guide');
        expect(event.handled).toBe(true);
    });

    it('returns from Player to Guide when no modal is open', () => {
        const { handlers, navigation } = setup();
        const event = makeKeyEvent('back');

        handlers.keyPress?.(event);

        expect(navigation.goTo).toHaveBeenCalledWith('guide');
        expect(navigation.setFocus).not.toHaveBeenCalled();
        expect(event.handled).toBe(true);
        expect(event.originalEvent.preventDefault).toHaveBeenCalled();
    });

    it('uses the cached routing state when handling player back', () => {
        const { handlers, navigation } = setup({
        });
        (navigation.getCurrentScreen as jest.Mock)
            .mockReturnValueOnce('player')
            .mockReturnValueOnce('settings');
        (navigation.isModalOpen as jest.Mock)
            .mockReturnValueOnce(false)
            .mockReturnValueOnce(true);
        const event = makeKeyEvent('back');

        handlers.keyPress?.(event);

        expect(navigation.goTo).toHaveBeenCalledWith('guide');
        expect(navigation.getCurrentScreen).toHaveBeenCalledTimes(1);
        expect(navigation.isModalOpen).toHaveBeenCalledTimes(1);
    });

    it('hides player OSD on Back before returning to Guide', () => {
        const { handlers, deps, navigation } = setup({
            isPlayerOsdVisible: jest.fn().mockReturnValue(true),
        });
        const event = makeKeyEvent('back');

        handlers.keyPress?.(event);

        expect(deps.keyModeRouter.playback.requestPlayerOsdIntent).toHaveBeenCalledWith({ type: 'back' });
        expect(deps.keyModeRouter.playback.playerOsd.coordinator?.hide).not.toHaveBeenCalled();
        expect(navigation.openModal).not.toHaveBeenCalled();
        expect(event.handled).toBe(true);
        expect(event.originalEvent.preventDefault).toHaveBeenCalled();
    });

    it('consumes held Back while the Player panel is visible without cascading to Guide', () => {
        const { handlers, deps, navigation } = setup({
            isPlayerOsdVisible: jest.fn().mockReturnValue(true),
        });
        const first = makeKeyEvent('back');
        const held = makeKeyEvent('back', { isRepeat: true });

        handlers.keyPress?.(first);
        handlers.keyPress?.(held);

        expect(deps.keyModeRouter.playback.requestPlayerOsdIntent).toHaveBeenCalledTimes(1);
        expect(deps.keyModeRouter.playback.requestPlayerOsdIntent).toHaveBeenCalledWith({ type: 'back' });
        expect(navigation.goTo).not.toHaveBeenCalled();
        expect(first.handled).toBe(true);
        expect(held.handled).toBe(true);
    });

    it('returns Player to Guide even when a back stack exists', () => {
        const { handlers, navigation } = setup({
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

        expect(navigation.goTo).toHaveBeenCalledWith('guide');
        expect(event.handled).toBe(true);
        expect(event.originalEvent.preventDefault).toHaveBeenCalled();
    });

    it('does not route repeated info or blue keypresses', () => {
        const { handlers, navigation } = setup();

        handlers.keyPress?.(makeKeyEvent('info', { isRepeat: true }));
        handlers.keyPress?.(makeKeyEvent('blue', { isRepeat: true }));

        expect(navigation.goTo).not.toHaveBeenCalled();
    });

    it('routes Info to Player details and Blue to the Lineup menu', () => {
        const { handlers, deps, navigation, epg } = setup();

        handlers.keyPress?.(makeKeyEvent('info'));
        handlers.keyPress?.(makeKeyEvent('blue'));

        expect(deps.keyModeRouter.playback.requestPlayerOsdIntent).toHaveBeenCalledWith({ type: 'toggleExpanded' });
        expect(navigation.goTo).toHaveBeenCalledWith('guide');
        expect(epg.openLineupMenu).toHaveBeenCalledTimes(1);
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
        expect(deps.events.channelSwitching.switchToPreviousChannel).not.toHaveBeenCalled();
        expect(upEvent.handled).toBe(true);
        expect(upEvent.originalEvent.preventDefault).toHaveBeenCalled();

        const downEvent = makeKeyEvent('channelDown');
        handlers.keyPress?.(downEvent);
        expect(epg.handlePage).toHaveBeenCalledWith('down');
        expect(deps.events.channelSwitching.switchToNextChannel).not.toHaveBeenCalled();
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
        expect(deps.events.channelSwitching.switchToPreviousChannel).not.toHaveBeenCalled();
        expect(upEvent.handled).not.toBe(true);

        const downEvent = makeKeyEvent('channelDown');
        handlers.keyPress?.(downEvent);
        expect(epg.handlePage).not.toHaveBeenCalled();
        expect(deps.events.channelSwitching.switchToNextChannel).not.toHaveBeenCalled();
        expect(downEvent.handled).not.toBe(true);
    });

    it('handles channel up/down with remote source', () => {
        const { handlers, deps } = setup();

        handlers.keyPress?.(makeKeyEvent('channelUp'));
        expect(deps.events.channelSwitching.setLastChannelChangeSourceRemote).toHaveBeenCalled();
        expect(deps.events.channelSwitching.switchToPreviousChannel).toHaveBeenCalled();

        handlers.keyPress?.(makeKeyEvent('channelDown'));
        expect(deps.events.channelSwitching.setLastChannelChangeSourceRemote).toHaveBeenCalledTimes(2);
        expect(deps.events.channelSwitching.switchToNextChannel).toHaveBeenCalled();
    });

    it('play triggers pokePlayerOsd', async () => {
        const { handlers, deps } = setup();
        handlers.keyPress?.(makeKeyEvent('play'));

        await Promise.resolve();
        expect(deps.keyModeRouter.playback.requestPlayerOsdIntent).toHaveBeenCalledWith({
            type: 'poke',
            reason: 'play',
        });
        expect(deps.keyModeRouter.playback.requestPlayerOsdIntent).toHaveBeenCalledTimes(1);
        expect(deps.keyModeRouter.playback.playerOsd.coordinator?.poke).not.toHaveBeenCalled();
    });

    it.each(['screen', 'modal', 'mini-guide', 'player child', 'IME', 'guide'])(
        'does not publish a late Play poke after %s takes input ownership', async (owner) => {
            const play = createDeferred<void>();
            const { handlers, deps, videoPlayer, navigation, epg } = setup();
            (videoPlayer.play as jest.Mock).mockReturnValueOnce(play.promise);
            handlers.keyPress?.(makeKeyEvent('play'));

            if (owner === 'screen') (navigation.getCurrentScreen as jest.Mock).mockReturnValue('settings');
            if (owner === 'modal') (navigation.isModalOpen as jest.Mock).mockReturnValue(true);
            if (owner === 'mini-guide') (deps.keyModeRouter.miniGuide.isVisible as jest.Mock).mockReturnValue(true);
            if (owner === 'player child') (deps.keyModeRouter.playback.isPlayerTransportContext as jest.Mock).mockReturnValue(false);
            if (owner === 'IME') (navigation.isInputBlocked as jest.Mock).mockReturnValue(true);
            if (owner === 'guide') (epg.isVisible as jest.Mock).mockReturnValue(true);

            play.resolve();
            await play.promise;
            await Promise.resolve();
            expect(deps.keyModeRouter.playback.requestPlayerOsdIntent).not.toHaveBeenCalled();
        }
    );

    it.each(['pause', 'stop', 'rewind', 'fastforward', 'play'] as const)(
        'does not publish an older Play after a later %s command', async (laterButton) => {
            const firstPlay = createDeferred<void>();
            const { handlers, deps, videoPlayer } = setup();
            (videoPlayer.play as jest.Mock).mockReturnValueOnce(firstPlay.promise);
            handlers.keyPress?.(makeKeyEvent('play'));
            handlers.keyPress?.(makeKeyEvent(laterButton));
            if (laterButton === 'pause') expect(videoPlayer.pause).toHaveBeenCalledTimes(1);
            if (laterButton === 'stop') expect(deps.keyModeRouter.playback.stopPlayback).toHaveBeenCalledTimes(1);
            await Promise.resolve();
            (deps.keyModeRouter.playback.requestPlayerOsdIntent as jest.Mock).mockClear();

            firstPlay.resolve();
            await firstPlay.promise;
            await Promise.resolve();
            expect(deps.keyModeRouter.playback.requestPlayerOsdIntent).not.toHaveBeenCalled();
        }
    );

    it('play jumps to now when EPG is visible', () => {
        const { handlers, epg, deps, videoPlayer, navigation } = setup();
        (epg.isVisible as jest.Mock).mockReturnValue(true);
        (navigation.isModalOpen as jest.Mock).mockReturnValue(false);

        const event = makeKeyEvent('play');
        handlers.keyPress?.(event);

        expect(epg.focusNow).toHaveBeenCalledTimes(1);
        expect(deps.keyModeRouter.playback.requestPlayerOsdIntent).not.toHaveBeenCalledWith({
            type: 'poke',
            reason: 'play',
        });
        expect(deps.keyModeRouter.playback.playerOsd.coordinator?.poke).not.toHaveBeenCalledWith('play');
        expect(videoPlayer.play).not.toHaveBeenCalled();
        expect(event.handled).toBe(true);
        expect(event.originalEvent.preventDefault).toHaveBeenCalled();
    });

    it('pause triggers pokePlayerOsd', () => {
        const { handlers, deps } = setup();
        handlers.keyPress?.(makeKeyEvent('pause'));

        expect(deps.keyModeRouter.playback.requestPlayerOsdIntent).toHaveBeenCalledWith({
            type: 'poke',
            reason: 'pause',
        });
        expect(deps.keyModeRouter.playback.playerOsd.coordinator?.poke).not.toHaveBeenCalled();
    });

    it.each(['audio', 'subtitles', 'more-info', 'sleep', 'mini-guide', 'ordinary modal', 'settings', 'guide'])(
        'does not dispatch native transport behind %s', (context) => {
            const { handlers, navigation, epg, videoPlayer, deps } = setup({
                isMiniGuideVisible: jest.fn().mockReturnValue(context === 'mini-guide'),
                isPlayerTransportContext: jest.fn().mockReturnValue(
                    !['audio', 'subtitles', 'more-info', 'sleep'].includes(context)
                ),
            });
            if (context === 'ordinary modal') (navigation.isModalOpen as jest.Mock).mockReturnValue(true);
            if (context === 'settings' || context === 'guide') {
                (navigation.getCurrentScreen as jest.Mock).mockReturnValue(context);
            }
            if (context === 'guide') (epg.isVisible as jest.Mock).mockReturnValue(true);

            for (const button of ['play', 'pause', 'rewind', 'fastforward', 'stop'] as const) {
                const event = makeKeyEvent(button);
                handlers.keyPress?.(event);
                expect(event.handled).toBe(true);
            }

            expect(videoPlayer.play).not.toHaveBeenCalled();
            expect(videoPlayer.pause).not.toHaveBeenCalled();
            expect(videoPlayer.seekRelative).not.toHaveBeenCalled();
            expect(deps.keyModeRouter.playback.stopPlayback).not.toHaveBeenCalled();
            expect(deps.keyModeRouter.playback.requestPlayerOsdIntent).not.toHaveBeenCalled();
        }
    );

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
        expect(deps.keyModeRouter.playback.requestPlayerOsdIntent).toHaveBeenCalledWith({
            type: 'poke',
            reason: 'seek',
        });
        expect(deps.keyModeRouter.playback.playerOsd.coordinator?.poke).not.toHaveBeenCalled();
    });

    it('fastforward uses the configured seek increment from the playback port', () => {
        const { handlers, videoPlayer } = setup({
            getSeekIncrementMs: jest.fn().mockReturnValue(30_000),
        });

        handlers.keyPress?.(makeKeyEvent('fastforward'));

        expect(videoPlayer.seekRelative).toHaveBeenCalledWith(30_000);
    });

    it('rewind seeks backward and pokes OSD', () => {
        const { handlers, deps, videoPlayer } = setup();

        handlers.keyPress?.(makeKeyEvent('rewind'));

        expect(videoPlayer.seekRelative).toHaveBeenCalledWith(-10_000);
        expect(deps.keyModeRouter.playback.requestPlayerOsdIntent).toHaveBeenCalledWith({
            type: 'poke',
            reason: 'seek',
        });
        expect(deps.keyModeRouter.playback.playerOsd.coordinator?.poke).not.toHaveBeenCalled();
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

    it('settings handler returns to the previous screen through the navigation stack', () => {
        const { handlers, navigation } = setup();
        (navigation.getCurrentScreen as jest.Mock).mockReturnValue('settings' as Screen);
        (navigation.isModalOpen as jest.Mock).mockReturnValue(false);
        (navigation.goBack as jest.Mock).mockReturnValue(true);

        handlers.settings?.(undefined);

        expect(navigation.goBack).toHaveBeenCalledTimes(1);
        expect(navigation.replaceScreen).not.toHaveBeenCalled();
    });

    it('settings handler falls back to the player when settings is at the stack root', () => {
        const { handlers, navigation } = setup();
        (navigation.getCurrentScreen as jest.Mock).mockReturnValue('settings' as Screen);
        (navigation.isModalOpen as jest.Mock).mockReturnValue(false);
        (navigation.goBack as jest.Mock).mockReturnValue(false);

        handlers.settings?.(undefined);

        expect(navigation.goBack).toHaveBeenCalledTimes(1);
        expect(navigation.replaceScreen).toHaveBeenCalledWith('player');
    });

    it('settings handler leaves protected settings modals in place', () => {
        const { handlers, navigation } = setup();
        (navigation.getCurrentScreen as jest.Mock).mockReturnValue('settings' as Screen);
        (navigation.isModalOpen as jest.Mock).mockReturnValue(true);

        handlers.settings?.(undefined);

        expect(navigation.goBack).not.toHaveBeenCalled();
        expect(navigation.replaceScreen).not.toHaveBeenCalled();
    });

    it('screen change shows/hides EPG and pauses/resumes player', () => {
        const { handlers, epg, videoPlayer, deps, navigation } = setup();
        (epg.isVisible as jest.Mock).mockReturnValue(false);

        handlers.screenChange?.({ from: 'player', to: 'guide' });
        expect(deps.events.channelSwitching.toggleEpg).toHaveBeenCalled();

        handlers.screenChange?.({ from: 'guide', to: 'player' });
        expect(deps.screenEffects.closeEpg).toHaveBeenCalled();

        handlers.screenChange?.({ from: 'player', to: 'settings' });
        expect(videoPlayer.pause).toHaveBeenCalled();
        expect(deps.events.miniGuide.requestMiniGuideIntent).toHaveBeenCalledWith({ type: 'hide' });
        expect(deps.events.miniGuide.coordinator?.hide).not.toHaveBeenCalled();

        handlers.screenChange?.({ from: 'settings', to: 'player' });
        expect(videoPlayer.play).toHaveBeenCalled();

        (navigation.isModalOpen as jest.Mock).mockReturnValue(true);
        handlers.screenChange?.({ from: 'player', to: 'home' });
    });

    it('reports a toast when resume playback fails on screen change', async () => {
        const reportToast = jest.fn();
        const { handlers, deps, videoPlayer } = setup({ reportToast });
        (videoPlayer.play as jest.Mock).mockRejectedValueOnce(new Error('play failed'));

        handlers.screenChange?.({ from: 'settings', to: 'player' });
        await Promise.resolve();

        expect(deps.events.reportRecoverableAsyncFailure).toHaveBeenCalledWith(
            'navigation.resume_play',
            '[Navigation] resume_play failed:',
            expect.any(Error)
        );
        expect(reportToast).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.any(String), type: 'warning' })
        );
    });

    it('reports a toast when resume playback throws synchronously on screen change', async () => {
        const reportToast = jest.fn();
        const { handlers, deps, videoPlayer } = setup({ reportToast });
        (videoPlayer.play as jest.Mock).mockImplementationOnce(() => {
            throw new Error('sync play failed');
        });

        expect(() => {
            handlers.screenChange?.({ from: 'settings', to: 'player' });
        }).not.toThrow();
        await Promise.resolve();

        expect(deps.events.reportRecoverableAsyncFailure).toHaveBeenCalledWith(
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
        const { handlers, deps, videoPlayer } = setup({ reportToast });
        (videoPlayer.play as jest.Mock).mockRejectedValueOnce(new Error('play failed'));

        handlers.keyPress?.(makeKeyEvent('play'));
        await Promise.resolve();

        expect(deps.events.reportRecoverableAsyncFailure).toHaveBeenCalledWith(
            'navigation.remote_play',
            '[Navigation] remote_play failed:',
            expect.any(Error)
        );
        expect(reportToast).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.any(String), type: 'warning' })
        );
    });

    it('reports a toast when Play key playback throws synchronously', async () => {
        const reportToast = jest.fn();
        const { handlers, deps, videoPlayer } = setup({ reportToast });
        (videoPlayer.play as jest.Mock).mockImplementationOnce(() => {
            throw new Error('sync play failed');
        });

        expect(() => {
            handlers.keyPress?.(makeKeyEvent('play'));
        }).not.toThrow();
        await Promise.resolve();

        expect(deps.events.reportRecoverableAsyncFailure).toHaveBeenCalledWith(
            'navigation.remote_play',
            '[Navigation] remote_play failed:',
            expect.any(Error)
        );
        expect(reportToast).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.any(String), type: 'warning' })
        );
    });

    it('reports seek failures when rewind throws synchronously', async () => {
        const { handlers, deps, videoPlayer } = setup();
        (videoPlayer.seekRelative as jest.Mock).mockImplementationOnce(() => {
            throw new Error('sync seek failed');
        });

        expect(() => {
            handlers.keyPress?.(makeKeyEvent('rewind'));
        }).not.toThrow();
        await Promise.resolve();

        expect(deps.events.reportRecoverableAsyncFailure).toHaveBeenCalledWith(
            'navigation.seek',
            '[Navigation] seek failed:',
            expect.any(Error)
        );
        expect(deps.keyModeRouter.playback.requestPlayerOsdIntent).toHaveBeenCalledWith({
            type: 'poke',
            reason: 'seek',
        });
        expect(deps.keyModeRouter.playback.playerOsd.coordinator?.poke).not.toHaveBeenCalled();
    });

    it('throttles duplicate non-blocking failures to one toast and one diagnostics callback per key window', async () => {
        const reportToast = jest.fn();
        const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000);
        const playFailure = new Error('play failed');
        const { handlers, deps, videoPlayer } = setup({ reportToast });
        (videoPlayer.play as jest.Mock).mockRejectedValue(playFailure);

        handlers.keyPress?.(makeKeyEvent('play'));
        await Promise.resolve();
        handlers.keyPress?.(makeKeyEvent('play'));
        await Promise.resolve();

        expect(deps.events.reportRecoverableAsyncFailure).toHaveBeenCalledTimes(1);
        expect(reportToast).toHaveBeenCalledTimes(1);

        nowSpy.mockRestore();
    });

    it('swallows failures from diagnostics and toast reporters in non-blocking paths', async () => {
        const reportToast = jest.fn(() => {
            throw new Error('toast failed');
        });
        const { handlers, deps, videoPlayer } = setup({
            reportRecoverableAsyncFailure: jest.fn(() => {
                throw new Error('diagnostics failed');
            }),
            reportToast,
        });
        (videoPlayer.play as jest.Mock).mockRejectedValue(new Error('play failed'));

        expect(() => {
            handlers.keyPress?.(makeKeyEvent('play'));
        }).not.toThrow();

        await Promise.resolve();

        expect(deps.events.reportRecoverableAsyncFailure).toHaveBeenCalledTimes(1);
        expect(reportToast).toHaveBeenCalledTimes(1);
    });

    it('guide hides mini-guide before toggling EPG', () => {
        const { handlers, deps } = setup();

        handlers.guide?.(undefined);

        expect(deps.guideMiniGuide.hideForGuideToggle).toHaveBeenCalledTimes(1);
        expect(deps.events.miniGuide.coordinator?.hide).toHaveBeenCalledTimes(1);
        expect(deps.events.navigation.goTo).toHaveBeenCalledWith('guide');
    });

    it.each(['guide', 'green'] as const)('scopes remote %s to Player and Guide outside modals', (button) => {
        const { handlers, deps, navigation, epg } = setup();
        const remote = new NavigationRemoteInputRouter({
            isInputBlocked: (): boolean => navigation.isInputBlocked(),
            logInputSuppressed: jest.fn(),
            cancelDirectionalRepeat: jest.fn(),
            emitKeyPress: (event): void => handlers.keyPress?.(event),
            repairFocusDesync: jest.fn(),
            handleDirectionalKeyDown: jest.fn(),
            handleOk: jest.fn(),
            handleBack: jest.fn(),
            handleNumberKey: jest.fn(),
            emitGuide: (): void => handlers.guide?.(undefined),
            emitSettings: jest.fn(),
        });
        for (const screen of [
            'splash', 'auth', 'profile-select', 'server-select', 'audio-setup',
            'channel-setup', 'settings', 'channels', 'channel-studio',
        ] satisfies Screen[]) {
            (navigation.getCurrentScreen as jest.Mock).mockReturnValue(screen);
            remote.handleKeyEvent(makeKeyEvent(button));
        }
        for (const screen of ['player', 'guide'] satisfies Screen[]) {
            (navigation.getCurrentScreen as jest.Mock).mockReturnValue(screen);
            (navigation.isModalOpen as jest.Mock).mockReturnValue(true);
            remote.handleKeyEvent(makeKeyEvent(button));
        }
        expect(navigation.goTo).not.toHaveBeenCalled();
        expect(deps.events.channelSwitching.toggleEpg).not.toHaveBeenCalled();
        expect(deps.guideMiniGuide.hideForGuideToggle).not.toHaveBeenCalled();

        (navigation.getCurrentScreen as jest.Mock).mockReturnValue('player');
        (navigation.isModalOpen as jest.Mock).mockReturnValue(false);
        remote.handleKeyEvent(makeKeyEvent(button));
        expect(navigation.goTo).toHaveBeenCalledTimes(1);
        expect(navigation.goTo).toHaveBeenCalledWith('guide');
        expect(deps.guideMiniGuide.hideForGuideToggle).toHaveBeenCalledTimes(1);

        (navigation.getCurrentScreen as jest.Mock).mockReturnValue('guide');
        (epg.isVisible as jest.Mock).mockReturnValue(true);
        remote.handleKeyEvent(makeKeyEvent(button));
        remote.handleKeyEvent(makeKeyEvent(button, { isRepeat: true }));
        expect(navigation.goTo).toHaveBeenCalledTimes(1);
        expect(deps.events.channelSwitching.toggleEpg).not.toHaveBeenCalled();
        expect(deps.guideMiniGuide.hideForGuideToggle).toHaveBeenCalledTimes(2);
    });

    it('reopens a hidden Guide projection on the current Guide route without resetting the route', () => {
        const { handlers, deps } = setup();
        (deps.events.navigation.getCurrentScreen as jest.Mock).mockReturnValue('guide');

        handlers.guide?.(undefined);

        expect(deps.events.channelSwitching.toggleEpg).toHaveBeenCalledTimes(1);
        expect(deps.events.navigation.goTo).not.toHaveBeenCalled();
        expect(deps.guideMiniGuide.hideForGuideToggle).toHaveBeenCalledTimes(1);
    });

    it('does not pause when keep-playing-in-settings is enabled', () => {
        const { handlers, videoPlayer, deps } = setup({
            readKeepPlayingInSettings: jest.fn().mockReturnValue(true),
        });
        handlers.screenChange?.({ from: 'player', to: 'settings' });
        expect(deps.screenEffects.readKeepPlayingInSettings).toHaveBeenCalled();
        expect(videoPlayer.pause).not.toHaveBeenCalled();
    });

    it('pauses when leaving player for settings and keep-playing-in-settings is disabled', () => {
        const { handlers, videoPlayer, deps } = setup({
            readKeepPlayingInSettings: jest.fn().mockReturnValue(false),
        });

        handlers.screenChange?.({ from: 'player', to: 'settings' });

        expect(deps.screenEffects.readKeepPlayingInSettings).toHaveBeenCalled();
        expect(videoPlayer.pause).toHaveBeenCalledTimes(1);
    });

    it('holds Guide playback through Settings and Studio until leaving both routes', () => {
        const { handlers, videoPlayer } = setup({
            readKeepPlayingInSettings: jest.fn().mockReturnValue(false),
        });
        handlers.screenChange?.({ from: 'guide', to: 'settings' });
        handlers.screenChange?.({ from: 'settings', to: 'channel-studio' });
        expect(videoPlayer.pause).toHaveBeenCalledTimes(1);
        expect(videoPlayer.play).not.toHaveBeenCalled();
        handlers.screenChange?.({ from: 'channel-studio', to: 'guide' });
        expect(videoPlayer.play).toHaveBeenCalledTimes(1);
    });

    it('channel setup gate replaces player screen', () => {
        const { handlers, deps, navigation } = setup({
            shouldRunChannelSetup: jest.fn().mockReturnValue(true),
        });

        handlers.screenChange?.({ from: 'home', to: 'player' });

        expect(deps.screenEffects.uiGuards.shouldRunChannelSetup).toHaveBeenCalled();
        expect(navigation.replaceScreen).toHaveBeenCalledWith('channel-setup');
    });

    it('hides EPG before channel setup redirects a guide-to-player transition', () => {
        const { handlers, deps, navigation } = setup({
            shouldRunChannelSetup: jest.fn().mockReturnValue(true),
        });

        handlers.screenChange?.({ from: 'guide', to: 'player' });

        expect(deps.screenEffects.closeEpg).toHaveBeenCalledTimes(1);
        expect(navigation.replaceScreen).toHaveBeenCalledWith('channel-setup');
        expect(deps.events.miniGuide.requestMiniGuideIntent).not.toHaveBeenCalled();
        expect(deps.events.miniGuide.coordinator?.hide).not.toHaveBeenCalled();
    });

    it('modal open hides mini-guide', () => {
        const { handlers, deps } = setup();

        handlers.modalOpen?.({ modalId: 'any-modal' });

        expect(deps.events.miniGuide.requestMiniGuideIntent).toHaveBeenCalledWith({ type: 'hide' });
        expect(deps.events.miniGuide.coordinator?.hide).not.toHaveBeenCalled();
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

    it.each(['player', 'guide'] as Screen[])('routes to EPG when overlay is visible on %s with no modal open', (screen) => {
        const { handlers, epg, navigation } = setup();
        (epg.isVisible as jest.Mock).mockReturnValue(true);
        (navigation.getCurrentScreen as jest.Mock).mockReturnValue(screen);
        (navigation.isModalOpen as jest.Mock).mockReturnValue(false);
        (epg.handleNavigation as jest.Mock).mockReturnValue(true);

        const event = makeKeyEvent('right');
        handlers.keyPress?.(event);
        handlers.keyUp?.({ button: 'right' });

        expect(epg.handleNavigation).toHaveBeenCalledWith('right');
        expect(event.handled).toBe(true);
    });

    it.each([
        'splash',
        'auth',
        'profile-select',
        'server-select',
        'audio-setup',
        'channel-setup',
        'home',
        'channels',
        'channel-studio',
        'settings',
        'error',
    ] as Screen[])('does not route navigation, selection, or paging to a visible EPG on %s', (screen) => {
        const { handlers, epg, navigation } = setup();
        (epg.isVisible as jest.Mock).mockReturnValue(true);
        (navigation.getCurrentScreen as jest.Mock).mockReturnValue(screen);
        (navigation.isModalOpen as jest.Mock).mockReturnValue(false);

        handlers.keyPress?.(makeKeyEvent('left'));
        handlers.keyPress?.(makeKeyEvent('ok'));
        handlers.keyPress?.(makeKeyEvent('channelUp'));

        expect(epg.handleNavigation).not.toHaveBeenCalled();
        expect(epg.handleSelect).not.toHaveBeenCalled();
        expect(epg.handlePage).not.toHaveBeenCalled();
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
        expect(deps.keyModeRouter.playback.playerOsd.coordinator?.toggle).not.toHaveBeenCalled();
        expect(event.handled).toBe(true);
    });

    it.each([
        'splash',
        'auth',
        'profile-select',
        'server-select',
        'audio-setup',
        'channel-setup',
        'home',
        'channels',
        'channel-studio',
        'settings',
        'error',
    ] as Screen[])('hides EPG when entering %s screen', (to) => {
        const { handlers, deps } = setup();

        handlers.screenChange?.({ from: 'player', to });

        expect(deps.screenEffects.closeEpg).toHaveBeenCalledTimes(1);
    });

    it('preserves player continuity across settings roundtrip', () => {
        const { handlers, deps, videoPlayer } = setup();

        handlers.screenChange?.({ from: 'player', to: 'settings' });

        expect(deps.screenEffects.closeEpg).toHaveBeenCalledTimes(1);
        expect(deps.events.miniGuide.requestMiniGuideIntent).toHaveBeenCalledWith({ type: 'hide' });
        expect(deps.events.miniGuide.coordinator?.hide).not.toHaveBeenCalled();
        expect(deps.keyModeRouter.playback.playerOsd.coordinator?.hide).not.toHaveBeenCalled();
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
            expect(deps.events.miniGuide.requestMiniGuideIntent).toHaveBeenCalledTimes(1);
            expect(deps.events.miniGuide.requestMiniGuideIntent).toHaveBeenCalledWith({
                type: 'navigate',
                direction: 'down',
            });
            expect(deps.events.miniGuide.coordinator?.handleNavigation).not.toHaveBeenCalled();

            await advanceTimersUntil(() => {
                expect(deps.events.miniGuide.requestMiniGuideIntent).toHaveBeenCalledTimes(2);
            }, {
                stepMs: 25,
                timeoutMs: MINI_GUIDE_REPEAT_TIMING.INITIAL_DELAY_MS + 200,
            });

            handlers.keyUp?.({ button: 'down' });
            const callsOnStop = (deps.events.miniGuide.requestMiniGuideIntent as jest.Mock).mock.calls.length;
            expect(jest.getTimerCount()).toBe(0);
            expect(deps.events.miniGuide.requestMiniGuideIntent).toHaveBeenCalledTimes(callsOnStop);
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
                expect(deps.events.miniGuide.requestMiniGuideIntent).toHaveBeenCalledTimes(2);
            }, {
                stepMs: 25,
                timeoutMs: MINI_GUIDE_REPEAT_TIMING.INITIAL_DELAY_MS + 200,
            });

            isInputBlocked.mockReturnValue(true);
            const callsBeforeBlock = (deps.events.miniGuide.requestMiniGuideIntent as jest.Mock).mock.calls.length;
            jest.advanceTimersByTime(MINI_GUIDE_REPEAT_TIMING.INTERVAL_1_MS + 1);
            expect(jest.getTimerCount()).toBe(0);
            expect(deps.events.miniGuide.requestMiniGuideIntent).toHaveBeenCalledTimes(callsBeforeBlock);
            expect(deps.events.miniGuide.coordinator?.handleNavigation).not.toHaveBeenCalled();
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
                expect(deps.events.miniGuide.requestMiniGuideIntent).toHaveBeenCalledTimes(2);
            }, {
                stepMs: 25,
                timeoutMs: MINI_GUIDE_REPEAT_TIMING.INITIAL_DELAY_MS + 200,
            });

            getCurrentScreen.mockReturnValue('settings');
            const callsBeforeLeave = (deps.events.miniGuide.requestMiniGuideIntent as jest.Mock).mock.calls.length;
            jest.advanceTimersByTime(MINI_GUIDE_REPEAT_TIMING.INTERVAL_1_MS + 1);
            expect(jest.getTimerCount()).toBe(0);
            expect(deps.events.miniGuide.requestMiniGuideIntent).toHaveBeenCalledTimes(callsBeforeLeave);
            expect(deps.events.miniGuide.coordinator?.handleNavigation).not.toHaveBeenCalled();
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

        it('repeat stops when a visible EPG remains after leaving player or guide', async () => {
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

            (navigation.getCurrentScreen as jest.Mock).mockReturnValue('settings');
            const callsBeforeLeave = (epg.handleNavigation as jest.Mock).mock.calls.length;
            jest.advanceTimersByTime(EPG_REPEAT_TIMING.INTERVAL_1_MS + 1);

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
