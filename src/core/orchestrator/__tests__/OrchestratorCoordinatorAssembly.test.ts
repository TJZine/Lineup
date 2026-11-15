import type {
    OrchestratorCoordinatorAssemblyInput,
    OrchestratorCoordinatorAssemblyInputDraft,
} from '../assembly/OrchestratorCoordinatorContracts';
import type { PlaybackOptionsSection } from '../../../modules/ui/playback-options/types';

const buildEpgCoordinator = jest.fn();
const bindEpgVisibleRangeChange = jest.fn();
const buildChannelSetupOwners = jest.fn();
const buildNowPlayingDebugManager = jest.fn();
const buildPlayerOsdCoordinator = jest.fn();
const buildMiniGuideCoordinator = jest.fn();
const buildChannelTransitionCoordinator = jest.fn();
const buildPlaybackRecovery = jest.fn();
const buildPlaybackOptionsCoordinator = jest.fn();
const buildChannelTuningCoordinator = jest.fn();
const buildNavigationCoordinator = jest.fn();

jest.mock('../assembly/EpgChannelSetupCoordinatorAssembly', () => ({
    buildEpgCoordinator: (...args: unknown[]): unknown => buildEpgCoordinator(...args),
    bindEpgVisibleRangeChange: (...args: unknown[]): unknown => bindEpgVisibleRangeChange(...args),
    buildChannelSetupOwners: (...args: unknown[]): unknown => buildChannelSetupOwners(...args),
    buildEpgCoordinatorInput: jest.requireActual('../assembly/EpgChannelSetupCoordinatorAssembly')
        .buildEpgCoordinatorInput,
    buildChannelSetupInput: jest.requireActual('../assembly/EpgChannelSetupCoordinatorAssembly')
        .buildChannelSetupInput,
}));
jest.mock('../assembly/NowPlayingDebugCoordinatorAssembly', () => ({
    buildNowPlayingDebugManager: (...args: unknown[]): unknown => buildNowPlayingDebugManager(...args),
    buildNowPlayingDebugManagerInput: jest.requireActual('../assembly/NowPlayingDebugCoordinatorAssembly')
        .buildNowPlayingDebugManagerInput,
}));
jest.mock('../assembly/PlaybackOsdCoordinatorAssembly', () => ({
    buildPlayerOsdCoordinator: (...args: unknown[]): unknown => buildPlayerOsdCoordinator(...args),
    buildChannelTransitionCoordinator: (...args: unknown[]): unknown => buildChannelTransitionCoordinator(...args),
    buildPlaybackRecovery: (...args: unknown[]): unknown => buildPlaybackRecovery(...args),
    buildPlaybackOptionsCoordinator: (...args: unknown[]): unknown => buildPlaybackOptionsCoordinator(...args),
    buildChannelTuningCoordinator: (...args: unknown[]): unknown => buildChannelTuningCoordinator(...args),
    buildPlayerOsdCoordinatorInput: jest.requireActual('../assembly/PlaybackOsdCoordinatorAssembly')
        .buildPlayerOsdCoordinatorInput,
    buildChannelTransitionCoordinatorInput: jest.requireActual('../assembly/PlaybackOsdCoordinatorAssembly')
        .buildChannelTransitionCoordinatorInput,
    buildPlaybackRecoveryInput: jest.requireActual('../assembly/PlaybackOsdCoordinatorAssembly')
        .buildPlaybackRecoveryInput,
    buildPlaybackOptionsCoordinatorInput: jest.requireActual('../assembly/PlaybackOsdCoordinatorAssembly')
        .buildPlaybackOptionsCoordinatorInput,
    buildChannelTuningInput: jest.requireActual('../assembly/PlaybackOsdCoordinatorAssembly')
        .buildChannelTuningInput,
}));
jest.mock('../assembly/NavigationModalCoordinatorAssembly', () => ({
    buildMiniGuideCoordinator: (...args: unknown[]): unknown => buildMiniGuideCoordinator(...args),
    buildNavigationCoordinator: (...args: unknown[]): unknown => buildNavigationCoordinator(...args),
    buildMiniGuideCoordinatorInput: jest.requireActual('../assembly/NavigationModalCoordinatorAssembly')
        .buildMiniGuideCoordinatorInput,
    buildNavigationCoordinatorInput: jest.requireActual('../assembly/NavigationModalCoordinatorAssembly')
        .buildNavigationCoordinatorInput,
}));

import {
    createOrchestratorCoordinatorAssemblyInput,
    createOrchestratorCoordinators,
} from '../assembly/OrchestratorCoordinatorAssembly';

const createCoordinatorAssemblyInput = (): OrchestratorCoordinatorAssemblyInput => ({
    epgDebugRuntime: null,
    config: null,
    moduleStatus: { getRuntimeStatus: jest.fn() },
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
        playerOsd: {} as OrchestratorCoordinatorAssemblyInput['overlays']['playerOsd'],
        channelNumberOverlay: {} as OrchestratorCoordinatorAssemblyInput['overlays']['channelNumberOverlay'],
        miniGuide: {} as OrchestratorCoordinatorAssemblyInput['overlays']['miniGuide'],
        channelTransitionOverlay: {} as OrchestratorCoordinatorAssemblyInput['overlays']['channelTransitionOverlay'],
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
        getWatchingChannelId: jest.fn(() => null),
        state: {} as OrchestratorCoordinatorAssemblyInput['playback']['state'],
        getPlaybackInfoSnapshot: () => null,
        refreshPlaybackInfoSnapshot: async (): Promise<never> => {
            throw new Error('refreshPlaybackInfoSnapshot should not be called in this test');
        },
        stopPlayback: jest.fn(),
        setPlaybackIntent: jest.fn(() => true),
        setPlaybackRouteBlocking: jest.fn(),
        capturePlaybackAdmission: jest.fn(() => 1),
        isPlaybackAdmissionCurrent: jest.fn(() => true),
        canActivateRetainedSession: jest.fn(() => true),
        captureRecoveryAdmission: jest.fn(() => 1),
        isRecoveryAdmissionCurrent: jest.fn(() => true),
        canPlayForRecovery: jest.fn(() => true),
        acceptCommittedSession: jest.fn(),
        stopActiveTranscodeSession: jest.fn(),
        getMimeType: () => 'application/x-test',
        buildPlexResourceUrl: () => null,
    },
    schedule: {
        lastChannelChangeSource: () => null,
        setLastChannelChangeSource: jest.fn(),
        setActiveScheduleDayKey: jest.fn(),
        getActiveUserId: () => 'user-1',
        getSelectedServerId: () => null,
        getLocalMidnightMs: (timeMs) => timeMs,
        getLocalDayKey: () => 0,
        buildDailyScheduleConfig: (): never => {
            throw new Error('buildDailyScheduleConfig should not be called in this test');
        },
    },
    actions: {
        switchToChannel: async () => undefined,
        switchToChannelWithOutcome: async () => ({ kind: 'switched' }),
        switchToNextChannel: jest.fn(),
        switchToPreviousChannel: jest.fn(),
        switchToChannelByNumberWithOutcome: async (): Promise<never> => {
            throw new Error('switchToChannelByNumberWithOutcome should not be called in this test');
        },
        toggleEPG: jest.fn(),
        onOverlayVisibilityChange: jest.fn(),
        onChannelTransitionActivityChange: jest.fn(),
    },
    errors: {
        handleGlobalError: jest.fn(),
    },
    nowPlaying: {
        handler: () => null,
    },
});

const createCoordinatorAssemblyInputDraft = (): OrchestratorCoordinatorAssemblyInputDraft => {
    const input = createCoordinatorAssemblyInput();

    return {
        ...input,
        requiredSurfaces: {
            channelBadgeOverlay: {},
        },
    } as OrchestratorCoordinatorAssemblyInputDraft;
};

describe('createOrchestratorCoordinators', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('assembles the final coordinator bundle from focused owners', () => {
        const deps = createCoordinatorAssemblyInput();
        const epgCoordinator = { kind: 'epg' };
        const channelSetup = { kind: 'channel-setup' };
        const channelSetupPortOwners = { kind: 'channel-setup-port-owners' };
        const nowPlayingDebugManager = { kind: 'debug-manager' };
        const playerOsdCoordinator = { kind: 'player-osd' };
        const miniGuideCoordinator = { kind: 'mini-guide' };
        const channelTransitionCoordinator = { kind: 'transition' };
        const playbackRecovery = { kind: 'playback-recovery' };
        const playbackOptionsCoordinator = { kind: 'playback-options' };
        const channelTuning = { kind: 'channel-tuning' };
        const navigationCoordinator = { kind: 'navigation' };

        buildEpgCoordinator.mockReturnValue(epgCoordinator);
        buildChannelSetupOwners.mockReturnValue({
            coordinator: channelSetup,
            portOwners: channelSetupPortOwners,
        });
        buildNowPlayingDebugManager.mockReturnValue(nowPlayingDebugManager);
        buildPlayerOsdCoordinator.mockReturnValue(playerOsdCoordinator);
        buildMiniGuideCoordinator.mockReturnValue(miniGuideCoordinator);
        buildChannelTransitionCoordinator.mockReturnValue(channelTransitionCoordinator);
        buildPlaybackRecovery.mockReturnValue(playbackRecovery);
        buildPlaybackOptionsCoordinator.mockReturnValue(playbackOptionsCoordinator);
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
                navigation: deps.modules.navigation,
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
                switchToChannelWithOutcome: deps.actions.switchToChannelWithOutcome,
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
                getActiveUserId: deps.schedule.getActiveUserId,
                getSelectedServerId: deps.schedule.getSelectedServerId,
            },
            diagnostics: {
                appendIssueDiagnostic: deps.diagnostics.appendIssueDiagnostic,
            },
        });
        expect(channelSetupInput).not.toHaveProperty('overlays');
        expect(buildChannelSetupOwners).toHaveBeenCalledWith(channelSetupInput, epgCoordinator);

        expect(buildNowPlayingDebugManager.mock.calls[0]?.[0]).toEqual({
            modules: {
                navigation: deps.modules.navigation,
                plexStreamResolver: deps.modules.plexStreamResolver,
                scheduler: deps.modules.scheduler,
            },
            stores: {
                debugOverridesStore: deps.stores.debugOverridesStore,
            },
            playback: {
                state: deps.playback.state,
            },
        });
        expect(buildPlayerOsdCoordinator.mock.calls[0]?.[0]).toEqual({
            config: deps.config,
            modules: {
                navigation: deps.modules.navigation,
                scheduler: deps.modules.scheduler,
                channelManager: deps.modules.channelManager,
                videoPlayer: deps.modules.videoPlayer,
                plexLibrary: deps.modules.plexLibrary,
            },
            overlays: {
                playerOsd: deps.overlays.playerOsd,
                miniGuide: deps.overlays.miniGuide,
                sleepTimer: deps.overlays.sleepTimer,
            },
            stores: {
                nowPlayingDisplayStore: deps.stores.nowPlayingDisplayStore,
            },
            playback: {
                state: deps.playback.state,
                buildPlexResourceUrl: deps.playback.buildPlexResourceUrl,
                setPlaybackIntent: deps.playback.setPlaybackIntent,
                getPlaybackInfoSnapshot: deps.playback.getPlaybackInfoSnapshot,
            },
            schedule: {
                getActiveUserId: deps.schedule.getActiveUserId,
                getSelectedServerId: deps.schedule.getSelectedServerId,
            },
            actions: {
                onOverlayVisibilityChange: deps.actions.onOverlayVisibilityChange,
                toggleEPG: deps.actions.toggleEPG,
                switchToChannel: expect.any(Function),
            },
        });
        expect(buildMiniGuideCoordinator).toHaveBeenCalledWith({
            config: deps.config,
            modules: {
                channelManager: deps.modules.channelManager,
                scheduler: deps.modules.scheduler,
            },
            playback: { getWatchingChannelId: deps.playback.getWatchingChannelId },
            overlays: {
                miniGuide: deps.overlays.miniGuide,
            },
            schedule: {
                buildDailyScheduleConfig: deps.schedule.buildDailyScheduleConfig,
            },
            actions: {
                switchToChannel: deps.actions.switchToChannel,
                toggleEPG: deps.actions.toggleEPG,
            },
            nowPlaying: deps.nowPlaying,
        });
        expect(buildChannelTransitionCoordinator).toHaveBeenCalledWith({
            modules: {
                navigation: deps.modules.navigation,
                videoPlayer: deps.modules.videoPlayer,
            },
            overlays: {
                channelTransitionOverlay: deps.overlays.channelTransitionOverlay,
            },
            actions: {
                onChannelTransitionActivityChange: deps.actions.onChannelTransitionActivityChange,
            },
        });
        expect(buildPlaybackRecovery.mock.calls[0]?.[0]).not.toHaveProperty('config');
        expect(buildPlaybackOptionsCoordinator).toHaveBeenCalledWith(
            {
                modules: {
                    videoPlayer: deps.modules.videoPlayer,
                    scheduler: deps.modules.scheduler,
                    channelManager: deps.modules.channelManager,
                },
                stores: {
                    subtitlePreferencesStore: deps.stores.subtitlePreferencesStore,
                },
                playback: { state: deps.playback.state },
                schedule: {
                    getActiveUserId: deps.schedule.getActiveUserId,
                    getSelectedServerId: deps.schedule.getSelectedServerId,
                },
                nowPlaying: deps.nowPlaying,
            },
            playbackRecovery,
            expect.any(Function)
        );
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
                    channelNumberOverlay: deps.overlays.channelNumberOverlay,
                },
                stores: {
                    developerSettingsStore: deps.stores.developerSettingsStore,
                    profileSessionStore: deps.stores.profileSessionStore,
                },
                diagnostics: {
                    reportRecoverableAsyncFailure: deps.diagnostics.reportRecoverableAsyncFailure,
                    appendIssueDiagnostic: deps.diagnostics.appendIssueDiagnostic,
                },
                playback: {
                    stopPlayback: deps.playback.stopPlayback,
                    setPlaybackIntent: deps.playback.setPlaybackIntent,
                    setPlaybackRouteBlocking: deps.playback.setPlaybackRouteBlocking,
                },
                schedule: {
                    setLastChannelChangeSource: deps.schedule.setLastChannelChangeSource,
                },
                actions: {
                    switchToNextChannel: deps.actions.switchToNextChannel,
                    switchToPreviousChannel: deps.actions.switchToPreviousChannel,
                    switchToChannelByNumberWithOutcome: deps.actions.switchToChannelByNumberWithOutcome,
                    toggleEPG: deps.actions.toggleEPG,
                },
                nowPlaying: deps.nowPlaying,
            },
            expect.objectContaining({
                epgCoordinator,
                channelSetup,
                playerOsdCoordinator,
                miniGuideCoordinator,
                channelTransitionCoordinator,
            })
        );
        expect(coordinators).toEqual({
            epgCoordinator,
            channelSetup,
            channelSetupPortOwners,
            nowPlayingDebugManager,
            playerOsdCoordinator,
            miniGuideCoordinator,
            channelTransitionCoordinator,
            playbackOptionsCoordinator,
            playbackRecovery,
            channelTuning,
            navigationCoordinator,
        });
    });

    it('creates typed assembly input from a complete nullable draft', () => {
        const draft = createCoordinatorAssemblyInputDraft();

        const input = createOrchestratorCoordinatorAssemblyInput(draft);

        expect(input.modules.navigation).toBe(draft.modules.navigation);
        expect(input.modules.plexStreamResolver).toBe(draft.modules.plexStreamResolver);
        expect(input.overlays.playerOsd).toBe(draft.overlays.playerOsd);
        expect(input.overlays.sleepTimer).toBe(draft.overlays.sleepTimer);
        expect(input).not.toHaveProperty('requiredSurfaces');
    });

    it('fails before coordinator creation when a required module is missing', () => {
        const draft = createCoordinatorAssemblyInputDraft();
        draft.modules.plexLibrary = null;

        expect(() => createOrchestratorCoordinatorAssemblyInput(draft)).toThrow(
            'Orchestrator coordinator initialization requires module instances: modules.plexLibrary'
        );
        expect(buildEpgCoordinator).not.toHaveBeenCalled();
    });

    it('fails before coordinator creation when a required overlay is missing', () => {
        const draft = createCoordinatorAssemblyInputDraft();
        draft.overlays.playerOsd = null;

        expect(() => createOrchestratorCoordinatorAssemblyInput(draft)).toThrow(
            'Orchestrator coordinator initialization requires module instances: overlays.playerOsd'
        );
        expect(buildEpgCoordinator).not.toHaveBeenCalled();
    });

    it('keeps channel badge overlay in the pre-coordinator required surface contract', () => {
        const draft = createCoordinatorAssemblyInputDraft();
        draft.requiredSurfaces.channelBadgeOverlay = null;

        expect(() => createOrchestratorCoordinatorAssemblyInput(draft)).toThrow(
            'Orchestrator coordinator initialization requires module instances: requiredSurfaces.channelBadgeOverlay'
        );
        expect(buildEpgCoordinator).not.toHaveBeenCalled();
    });

    it('reads the initialized playback-options policy for Player track drawers', () => {
        const deps = createCoordinatorAssemblyInput();
        const audio: PlaybackOptionsSection = { title: 'Audio', options: [] };
        const subtitles: PlaybackOptionsSection = { title: 'Subtitles', options: [] };
        let getTrackDrawer: ((section: 'audio' | 'subtitles') => PlaybackOptionsSection) | null = null;

        buildEpgCoordinator.mockReturnValue({ kind: 'epg' });
        buildChannelSetupOwners.mockReturnValue({
            coordinator: { kind: 'channel-setup' },
            portOwners: { kind: 'channel-setup-port-owners' },
        });
        buildNowPlayingDebugManager.mockReturnValue({ kind: 'debug-manager' });
        buildPlayerOsdCoordinator.mockImplementation((_deps, callback) => {
            getTrackDrawer = callback;
            return { kind: 'player-osd' };
        });
        buildMiniGuideCoordinator.mockReturnValue({ kind: 'mini-guide' });
        buildChannelTransitionCoordinator.mockReturnValue({ kind: 'transition' });
        buildPlaybackRecovery.mockReturnValue({ kind: 'recovery' });
        const getViewModel = jest.fn().mockReturnValue({ audio, subtitles });
        buildPlaybackOptionsCoordinator.mockReturnValue({ getViewModel });
        buildChannelTuningCoordinator.mockReturnValue({ kind: 'channel-tuning' });
        buildNavigationCoordinator.mockReturnValue({ kind: 'navigation' });

        createOrchestratorCoordinators(deps);

        expect(getTrackDrawer).not.toBeNull();
        if (!getTrackDrawer) throw new Error('Player track drawer policy was not wired');
        const readTrackDrawer: (section: 'audio' | 'subtitles') => PlaybackOptionsSection = getTrackDrawer;
        expect(readTrackDrawer('audio')).toBe(audio);
        expect(readTrackDrawer('subtitles')).toBe(subtitles);
        expect(getViewModel).toHaveBeenCalledTimes(2);
    });

});
