import type { OrchestratorCoordinatorFactoryDeps } from '../OrchestratorCoordinatorContracts';
import type { PlaybackOptionsSectionId } from '../../../modules/ui/playback-options/types';

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

const createCoordinatorFactoryDeps = (): OrchestratorCoordinatorFactoryDeps => ({
    epgDebugRuntime: null,
    config: null,
    moduleStatus: new Map(),
    init: {
        ensureEpgInitialized: jest.fn(async () => undefined),
    },
    modules: {
        navigation: {} as OrchestratorCoordinatorFactoryDeps['modules']['navigation'],
        plexAuth: {} as OrchestratorCoordinatorFactoryDeps['modules']['plexAuth'],
        plexDiscovery: {} as OrchestratorCoordinatorFactoryDeps['modules']['plexDiscovery'],
        plexLibrary: {} as OrchestratorCoordinatorFactoryDeps['modules']['plexLibrary'],
        plexStreamResolver: {} as OrchestratorCoordinatorFactoryDeps['modules']['plexStreamResolver'],
        channelManager: {} as OrchestratorCoordinatorFactoryDeps['modules']['channelManager'],
        scheduler: {} as OrchestratorCoordinatorFactoryDeps['modules']['scheduler'],
        videoPlayer: {} as OrchestratorCoordinatorFactoryDeps['modules']['videoPlayer'],
        lifecycle: {} as OrchestratorCoordinatorFactoryDeps['modules']['lifecycle'],
        epg: {} as OrchestratorCoordinatorFactoryDeps['modules']['epg'],
    },
    overlays: {
        nowPlayingInfo: {} as OrchestratorCoordinatorFactoryDeps['overlays']['nowPlayingInfo'],
        playerOsd: {} as OrchestratorCoordinatorFactoryDeps['overlays']['playerOsd'],
        channelNumberOverlay: {} as OrchestratorCoordinatorFactoryDeps['overlays']['channelNumberOverlay'],
        miniGuide: {} as OrchestratorCoordinatorFactoryDeps['overlays']['miniGuide'],
        channelTransitionOverlay: {} as OrchestratorCoordinatorFactoryDeps['overlays']['channelTransitionOverlay'],
        playbackOptionsModal: {} as OrchestratorCoordinatorFactoryDeps['overlays']['playbackOptionsModal'],
        exitConfirmModal: {} as OrchestratorCoordinatorFactoryDeps['overlays']['exitConfirmModal'],
        sleepTimer: {} as OrchestratorCoordinatorFactoryDeps['overlays']['sleepTimer'],
    },
    stores: {
        developerSettingsStore: {} as OrchestratorCoordinatorFactoryDeps['stores']['developerSettingsStore'],
        debugOverridesStore: {} as OrchestratorCoordinatorFactoryDeps['stores']['debugOverridesStore'],
        subtitlePreferencesStore: {} as OrchestratorCoordinatorFactoryDeps['stores']['subtitlePreferencesStore'],
        epgPreferencesStore: {} as OrchestratorCoordinatorFactoryDeps['stores']['epgPreferencesStore'],
        nowPlayingDisplayStore: {} as OrchestratorCoordinatorFactoryDeps['stores']['nowPlayingDisplayStore'],
        profileSessionStore: {} as OrchestratorCoordinatorFactoryDeps['stores']['profileSessionStore'],
    },
    diagnostics: {
        appendIssueDiagnostic: jest.fn(),
        reportRecoverableAsyncFailure: jest.fn(),
    },
    playback: {
        state: {} as OrchestratorCoordinatorFactoryDeps['playback']['state'],
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
        const deps = createCoordinatorFactoryDeps();
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

        expect(buildEpgCoordinator).toHaveBeenCalledWith(deps);
        expect(bindEpgVisibleRangeChange).toHaveBeenCalledWith(deps, epgCoordinator);
        expect(buildChannelSetupOwners).toHaveBeenCalledWith(deps, epgCoordinator);
        expect(buildNowPlayingInfoCoordinator).toHaveBeenCalledWith(deps, nowPlayingDebugManager);
        expect(buildNavigationCoordinator).toHaveBeenCalledWith(
            deps,
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
        const deps = createCoordinatorFactoryDeps();
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
