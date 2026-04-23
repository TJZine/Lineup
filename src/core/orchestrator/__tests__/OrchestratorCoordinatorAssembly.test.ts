import type { OrchestratorCoordinatorAssemblyInput } from '../OrchestratorCoordinatorContracts';
import type { PlaybackOptionsSectionId } from '../../../modules/ui/playback-options';

const buildEpgCoordinator = jest.fn();
const bindEpgVisibleRangeChange = jest.fn();
const buildChannelSetupOwners = jest.fn();
const buildNowPlayingDebugManager = jest.fn();
const buildNowPlayingInfoCoordinator = jest.fn();
const buildPlayerOsdCoordinator = jest.fn();
const buildMiniGuideCoordinator = jest.fn();
const buildChannelTransitionCoordinator = jest.fn();
const buildPlaybackRecovery = jest.fn();
const buildPlaybackOptionsCoordinator = jest.fn();
const buildExitConfirmCoordinator = jest.fn();
const buildChannelTuningCoordinator = jest.fn();
const buildNavigationCoordinator = jest.fn();

jest.mock('../OrchestratorCoordinatorBuilders', () => ({
    buildEpgCoordinator: (...args: unknown[]): unknown => buildEpgCoordinator(...args),
    bindEpgVisibleRangeChange: (...args: unknown[]): unknown => bindEpgVisibleRangeChange(...args),
    buildChannelSetupOwners: (...args: unknown[]): unknown => buildChannelSetupOwners(...args),
    buildNowPlayingDebugManager: (...args: unknown[]): unknown => buildNowPlayingDebugManager(...args),
    buildNowPlayingInfoCoordinator: (...args: unknown[]): unknown => buildNowPlayingInfoCoordinator(...args),
    buildPlayerOsdCoordinator: (...args: unknown[]): unknown => buildPlayerOsdCoordinator(...args),
    buildMiniGuideCoordinator: (...args: unknown[]): unknown => buildMiniGuideCoordinator(...args),
    buildChannelTransitionCoordinator: (...args: unknown[]): unknown => buildChannelTransitionCoordinator(...args),
    buildPlaybackRecovery: (...args: unknown[]): unknown => buildPlaybackRecovery(...args),
    buildPlaybackOptionsCoordinator: (...args: unknown[]): unknown => buildPlaybackOptionsCoordinator(...args),
    buildExitConfirmCoordinator: (...args: unknown[]): unknown => buildExitConfirmCoordinator(...args),
    buildChannelTuningCoordinator: (...args: unknown[]): unknown => buildChannelTuningCoordinator(...args),
    buildNavigationCoordinator: (...args: unknown[]): unknown => buildNavigationCoordinator(...args),
}));

import { createOrchestratorCoordinators } from '../OrchestratorCoordinatorAssembly';

type PlaybackOptionsPreparationResult = {
    focusableIds: string[];
    preferredFocusId: string | null;
};

type PreparePlaybackOptionsModal = (
    preferredSection?: PlaybackOptionsSectionId
) => PlaybackOptionsPreparationResult;

const createCoordinatorAssemblyInput = (): OrchestratorCoordinatorAssemblyInput => ({
    epgDebugRuntime: null,
    config: null,
    moduleStatus: new Map(),
    init: {
        ensureEpgInitialized: jest.fn(async () => undefined),
    },
    modules: {
        navigation: {} as OrchestratorCoordinatorAssemblyInput['modules']['navigation'],
        plexAuth: {} as OrchestratorCoordinatorAssemblyInput['modules']['plexAuth'],
        plexDiscovery: {} as OrchestratorCoordinatorAssemblyInput['modules']['plexDiscovery'],
        plexLibrary: {} as OrchestratorCoordinatorAssemblyInput['modules']['plexLibrary'],
        plexStreamResolver: {} as OrchestratorCoordinatorAssemblyInput['modules']['plexStreamResolver'],
        channelManager: {} as OrchestratorCoordinatorAssemblyInput['modules']['channelManager'],
        scheduler: {} as OrchestratorCoordinatorAssemblyInput['modules']['scheduler'],
        videoPlayer: {} as OrchestratorCoordinatorAssemblyInput['modules']['videoPlayer'],
        lifecycle: {} as OrchestratorCoordinatorAssemblyInput['modules']['lifecycle'],
        epg: {} as OrchestratorCoordinatorAssemblyInput['modules']['epg'],
    },
    overlays: {
        nowPlayingInfo: {} as OrchestratorCoordinatorAssemblyInput['overlays']['nowPlayingInfo'],
        playerOsd: {} as OrchestratorCoordinatorAssemblyInput['overlays']['playerOsd'],
        channelNumberOverlay: {} as OrchestratorCoordinatorAssemblyInput['overlays']['channelNumberOverlay'],
        miniGuide: {} as OrchestratorCoordinatorAssemblyInput['overlays']['miniGuide'],
        channelTransitionOverlay: {} as OrchestratorCoordinatorAssemblyInput['overlays']['channelTransitionOverlay'],
        playbackOptionsModal: {} as OrchestratorCoordinatorAssemblyInput['overlays']['playbackOptionsModal'],
        exitConfirmModal: {} as OrchestratorCoordinatorAssemblyInput['overlays']['exitConfirmModal'],
        sleepTimer: {} as OrchestratorCoordinatorAssemblyInput['overlays']['sleepTimer'],
    },
    stores: {
        developerSettingsStore: {} as OrchestratorCoordinatorAssemblyInput['stores']['developerSettingsStore'],
        debugOverridesStore: {} as OrchestratorCoordinatorAssemblyInput['stores']['debugOverridesStore'],
        subtitlePreferencesStore: {} as OrchestratorCoordinatorAssemblyInput['stores']['subtitlePreferencesStore'],
        epgPreferencesStore: {} as OrchestratorCoordinatorAssemblyInput['stores']['epgPreferencesStore'],
        nowPlayingDisplayStore: {} as OrchestratorCoordinatorAssemblyInput['stores']['nowPlayingDisplayStore'],
        profileSessionStore: {} as OrchestratorCoordinatorAssemblyInput['stores']['profileSessionStore'],
    },
    diagnostics: {
        appendIssueDiagnostic: jest.fn(),
        reportRecoverableAsyncFailure: jest.fn(),
    },
    playback: {
        state: {} as OrchestratorCoordinatorAssemblyInput['playback']['state'],
        getPlaybackInfoSnapshot: () => null,
        refreshPlaybackInfoSnapshot: async (): Promise<never> => {
            throw new Error('refreshPlaybackInfoSnapshot should not be called in this test');
        },
        stopPlayback: jest.fn(),
        stopActiveTranscodeSession: jest.fn(),
        getMimeType: () => 'application/x-test',
        buildPlexResourceUrl: () => null,
    },
    schedule: {
        lastChannelChangeSource: () => null,
        setLastChannelChangeSource: jest.fn(),
        setActiveScheduleDayKey: jest.fn(),
        getSelectedServerId: () => null,
        getLocalMidnightMs: (timeMs) => timeMs,
        getLocalDayKey: () => 0,
        buildDailyScheduleConfig: (): never => {
            throw new Error('buildDailyScheduleConfig should not be called in this test');
        },
    },
    actions: {
        switchToChannel: async () => undefined,
        switchToNextChannel: jest.fn(),
        switchToPreviousChannel: jest.fn(),
        switchToChannelByNumberWithOutcome: async (): Promise<never> => {
            throw new Error('switchToChannelByNumberWithOutcome should not be called in this test');
        },
        toggleEPG: jest.fn(),
        onOverlayVisibilityChange: jest.fn(),
        onChannelTransitionActivityChange: jest.fn(),
        toggleNowPlayingInfoOverlay: jest.fn(),
    },
    errors: {
        handleGlobalError: jest.fn(),
    },
    nowPlaying: {
        handler: () => null,
    },
});

describe('createOrchestratorCoordinators', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('assembles the final coordinator bundle from focused owners', () => {
        const deps = createCoordinatorAssemblyInput();
        const epgCoordinator = { kind: 'epg' };
        const channelSetup = { kind: 'channel-setup' };
        const channelSetupWorkflow = { kind: 'channel-setup-workflow' };
        const nowPlayingDebugManager = { kind: 'debug-manager' };
        const nowPlayingInfoCoordinator = { kind: 'now-playing-info' };
        const playerOsdCoordinator = { kind: 'player-osd' };
        const miniGuideCoordinator = { kind: 'mini-guide' };
        const channelTransitionCoordinator = { kind: 'transition' };
        const playbackRecovery = { kind: 'playback-recovery' };
        const playbackOptionsCoordinator = { kind: 'playback-options' };
        const exitConfirmCoordinator = { kind: 'exit-confirm' };
        const channelTuning = { kind: 'channel-tuning' };
        const navigationCoordinator = { kind: 'navigation' };

        buildEpgCoordinator.mockReturnValue(epgCoordinator);
        buildChannelSetupOwners.mockReturnValue({
            coordinator: channelSetup,
            workflow: channelSetupWorkflow,
        });
        buildNowPlayingDebugManager.mockReturnValue(nowPlayingDebugManager);
        buildNowPlayingInfoCoordinator.mockReturnValue(nowPlayingInfoCoordinator);
        buildPlayerOsdCoordinator.mockReturnValue(playerOsdCoordinator);
        buildMiniGuideCoordinator.mockReturnValue(miniGuideCoordinator);
        buildChannelTransitionCoordinator.mockReturnValue(channelTransitionCoordinator);
        buildPlaybackRecovery.mockReturnValue(playbackRecovery);
        buildPlaybackOptionsCoordinator.mockReturnValue(playbackOptionsCoordinator);
        buildExitConfirmCoordinator.mockReturnValue(exitConfirmCoordinator);
        buildChannelTuningCoordinator.mockReturnValue(channelTuning);
        buildNavigationCoordinator.mockReturnValue(navigationCoordinator);

        const coordinators = createOrchestratorCoordinators(deps);

        const epgBuilderInput = buildEpgCoordinator.mock.calls[0]?.[0];
        expect(epgBuilderInput).toEqual({
            epgDebugRuntime: deps.epgDebugRuntime,
            config: deps.config,
            moduleStatus: deps.moduleStatus,
            init: deps.init,
            modules: {
                epg: deps.modules.epg,
                channelManager: deps.modules.channelManager,
                scheduler: deps.modules.scheduler,
            },
            stores: {
                epgPreferencesStore: deps.stores.epgPreferencesStore,
            },
            diagnostics: {
                appendIssueDiagnostic: deps.diagnostics.appendIssueDiagnostic,
            },
            schedule: {
                lastChannelChangeSource: deps.schedule.lastChannelChangeSource,
                setLastChannelChangeSource: deps.schedule.setLastChannelChangeSource,
                getLocalMidnightMs: deps.schedule.getLocalMidnightMs,
                buildDailyScheduleConfig: deps.schedule.buildDailyScheduleConfig,
            },
            actions: {
                switchToChannel: deps.actions.switchToChannel,
                onOverlayVisibilityChange: deps.actions.onOverlayVisibilityChange,
            },
            nowPlaying: deps.nowPlaying,
        });
        expect(epgBuilderInput).not.toHaveProperty('overlays');
        expect(bindEpgVisibleRangeChange).toHaveBeenCalledWith(epgBuilderInput, epgCoordinator);

        const channelSetupInput = buildChannelSetupOwners.mock.calls[0]?.[0];
        expect(channelSetupInput).toEqual({
            init: deps.init,
            modules: {
                navigation: deps.modules.navigation,
                plexLibrary: deps.modules.plexLibrary,
                channelManager: deps.modules.channelManager,
            },
            schedule: {
                getSelectedServerId: deps.schedule.getSelectedServerId,
            },
        });
        expect(channelSetupInput).not.toHaveProperty('overlays');
        expect(buildChannelSetupOwners).toHaveBeenCalledWith(channelSetupInput, epgCoordinator);
        expect(buildNowPlayingInfoCoordinator).toHaveBeenCalledWith(deps, nowPlayingDebugManager);
        expect(buildPlaybackRecovery.mock.calls[0]?.[0]).not.toHaveProperty('config');
        expect(buildChannelTuningCoordinator.mock.calls[0]?.[0]).not.toHaveProperty('overlays');
        expect(buildNavigationCoordinator).toHaveBeenCalledWith(
            {
                config: deps.config,
                modules: {
                    navigation: deps.modules.navigation,
                    epg: deps.modules.epg,
                    plexAuth: deps.modules.plexAuth,
                    videoPlayer: deps.modules.videoPlayer,
                },
                overlays: {
                    playerOsd: deps.overlays.playerOsd,
                    miniGuide: deps.overlays.miniGuide,
                    nowPlayingInfo: deps.overlays.nowPlayingInfo,
                    channelNumberOverlay: deps.overlays.channelNumberOverlay,
                },
                stores: {
                    developerSettingsStore: deps.stores.developerSettingsStore,
                    profileSessionStore: deps.stores.profileSessionStore,
                },
                diagnostics: {
                    reportRecoverableAsyncFailure: deps.diagnostics.reportRecoverableAsyncFailure,
                },
                playback: {
                    stopPlayback: deps.playback.stopPlayback,
                },
                schedule: {
                    setLastChannelChangeSource: deps.schedule.setLastChannelChangeSource,
                },
                actions: {
                    switchToNextChannel: deps.actions.switchToNextChannel,
                    switchToPreviousChannel: deps.actions.switchToPreviousChannel,
                    switchToChannelByNumberWithOutcome: deps.actions.switchToChannelByNumberWithOutcome,
                    toggleEPG: deps.actions.toggleEPG,
                    toggleNowPlayingInfoOverlay: deps.actions.toggleNowPlayingInfoOverlay,
                },
                nowPlaying: deps.nowPlaying,
            },
            expect.objectContaining({
                epgCoordinator,
                channelSetup,
                nowPlayingInfoCoordinator,
                playerOsdCoordinator,
                miniGuideCoordinator,
                channelTransitionCoordinator,
                playbackOptionsCoordinator,
                exitConfirmCoordinator,
            })
        );
        expect(coordinators).toEqual({
            epgCoordinator,
            channelSetup,
            channelSetupWorkflow,
            nowPlayingDebugManager,
            nowPlayingInfoCoordinator,
            playerOsdCoordinator,
            miniGuideCoordinator,
            channelTransitionCoordinator,
            playbackOptionsCoordinator,
            exitConfirmCoordinator,
            playbackRecovery,
            channelTuning,
            navigationCoordinator,
        });
    });

    it('keeps the deferred playback-options preparation seam wired through the assembled callback', () => {
        const deps = createCoordinatorAssemblyInput();
        const prepareModal = jest.fn().mockReturnValue({
            focusableIds: ['audio-track'],
            preferredFocusId: 'audio-track',
        });
        let preparePlaybackOptionsModal: PreparePlaybackOptionsModal | null = null;
        let fallbackPreparation: PlaybackOptionsPreparationResult | null = null;

        buildEpgCoordinator.mockReturnValue({ kind: 'epg' });
        buildChannelSetupOwners.mockReturnValue({
            coordinator: { kind: 'channel-setup' },
            workflow: { kind: 'channel-setup-workflow' },
        });
        buildNowPlayingDebugManager.mockReturnValue({ kind: 'debug-manager' });
        buildNowPlayingInfoCoordinator.mockReturnValue({ kind: 'now-playing-info' });
        buildPlayerOsdCoordinator.mockImplementation((_deps, callback) => {
            preparePlaybackOptionsModal = callback;
            fallbackPreparation = callback('audio');
            return { kind: 'player-osd' };
        });
        buildMiniGuideCoordinator.mockReturnValue({ kind: 'mini-guide' });
        buildChannelTransitionCoordinator.mockReturnValue({ kind: 'transition' });
        buildPlaybackRecovery.mockReturnValue({ kind: 'recovery' });
        buildPlaybackOptionsCoordinator.mockReturnValue({ prepareModal });
        buildExitConfirmCoordinator.mockReturnValue({ kind: 'exit-confirm' });
        buildChannelTuningCoordinator.mockReturnValue({ kind: 'channel-tuning' });
        buildNavigationCoordinator.mockReturnValue({ kind: 'navigation' });

        createOrchestratorCoordinators(deps);

        expect(fallbackPreparation).toEqual({
            focusableIds: [],
            preferredFocusId: null,
        });
        expect(preparePlaybackOptionsModal).not.toBeNull();
        if (preparePlaybackOptionsModal === null) {
            throw new Error('Expected playback-options preparation seam to be wired');
        }
        const preparePlaybackOptions: PreparePlaybackOptionsModal = preparePlaybackOptionsModal;
        expect(preparePlaybackOptions('audio')).toEqual({
            focusableIds: ['audio-track'],
            preferredFocusId: 'audio-track',
        });
        expect(prepareModal).toHaveBeenCalledWith('audio');
    });
});
