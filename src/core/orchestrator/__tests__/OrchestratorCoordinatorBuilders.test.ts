import type { EPGConfig } from '../../../modules/ui/epg';
import type { OrchestratorCoordinatorBuilderInput } from '../OrchestratorCoordinatorContracts';

const recordStoreInstance = { kind: 'record-store' };
const scratchStoreInstance = { kind: 'scratch-store' };
const planningServiceInstance = { kind: 'planning-service' };
const buildCommitterInstance = { kind: 'build-committer' };
const buildExecutorInstance = { kind: 'build-executor' };
const coordinatorInstance = { clearRerunRequest: jest.fn(), kind: 'coordinator' };
const completionTrackerInstance = { kind: 'completion-tracker' };
const workflowInstance = { kind: 'workflow' };

jest.mock('../../channel-setup', () => ({
    ChannelSetupRecordStore: jest.fn(() => recordStoreInstance),
    ChannelSetupBuildScratchStore: jest.fn(() => scratchStoreInstance),
    ChannelSetupPlanningService: jest.fn(() => planningServiceInstance),
    ChannelSetupBuildCommitter: jest.fn(() => buildCommitterInstance),
    ChannelSetupBuildExecutor: jest.fn(() => buildExecutorInstance),
    ChannelSetupCoordinator: jest.fn(() => coordinatorInstance),
    ChannelSetupCompletionTracker: jest.fn(() => completionTrackerInstance),
    ChannelSetupWorkflow: jest.fn(() => workflowInstance),
}));

import {
    ChannelSetupBuildCommitter,
    ChannelSetupBuildExecutor,
    ChannelSetupBuildScratchStore,
    ChannelSetupCompletionTracker,
    ChannelSetupCoordinator,
    ChannelSetupPlanningService,
    ChannelSetupRecordStore,
    ChannelSetupWorkflow,
} from '../../channel-setup';
import {
    bindEpgVisibleRangeChange,
    buildChannelSetupOwners,
} from '../OrchestratorCoordinatorBuilders';

const createInput = (): OrchestratorCoordinatorBuilderInput => {
    const channelManager = {
        getAllChannels: jest.fn(() => [{ id: 'channel-1' }, { id: 'channel-2' }]),
    };

    return {
        epgDebugRuntime: null,
        config: null,
        moduleStatus: new Map(),
        init: {
            ensureEpgInitialized: jest.fn().mockResolvedValue(undefined),
        },
        modules: {
            navigation: { kind: 'navigation' },
            plexAuth: { kind: 'plex-auth' },
            plexDiscovery: { kind: 'plex-discovery' },
            plexLibrary: { kind: 'plex-library' },
            plexStreamResolver: { kind: 'plex-stream-resolver' },
            channelManager,
            scheduler: { kind: 'scheduler' },
            videoPlayer: { kind: 'video-player' },
            lifecycle: { kind: 'lifecycle' },
            epg: { kind: 'epg' },
        } as unknown as OrchestratorCoordinatorBuilderInput['modules'],
        overlays: {
            nowPlayingInfo: { kind: 'now-playing' },
            playerOsd: { kind: 'player-osd' },
            channelNumberOverlay: { kind: 'channel-number' },
            miniGuide: { kind: 'mini-guide' },
            channelTransitionOverlay: { kind: 'transition' },
            playbackOptionsModal: { kind: 'playback-options-modal' },
            exitConfirmModal: { kind: 'exit-confirm-modal' },
            sleepTimer: { kind: 'sleep-timer' },
        } as unknown as OrchestratorCoordinatorBuilderInput['overlays'],
        stores: {
            developerSettingsStore: { kind: 'developer-settings-store' },
            debugOverridesStore: { kind: 'debug-overrides-store' },
            subtitlePreferencesStore: { kind: 'subtitle-preferences-store' },
            epgPreferencesStore: { kind: 'epg-preferences-store' },
            nowPlayingDisplayStore: { kind: 'now-playing-display-store' },
            profileSessionStore: { kind: 'profile-session-store' },
        } as unknown as OrchestratorCoordinatorBuilderInput['stores'],
        diagnostics: {
            appendIssueDiagnostic: jest.fn(),
            reportRecoverableAsyncFailure: jest.fn(),
        },
        playback: {
            state: { kind: 'state' },
            getPlaybackInfoSnapshot: jest.fn(),
            refreshPlaybackInfoSnapshot: jest.fn(),
            stopPlayback: jest.fn(),
            stopActiveTranscodeSession: jest.fn(),
            getMimeType: jest.fn(),
            buildPlexResourceUrl: jest.fn(),
        } as unknown as OrchestratorCoordinatorBuilderInput['playback'],
        schedule: {
            lastChannelChangeSource: jest.fn(() => null),
            setLastChannelChangeSource: jest.fn(),
            setActiveScheduleDayKey: jest.fn(),
            getSelectedServerId: jest.fn(() => 'server-1'),
            getLocalMidnightMs: jest.fn(() => 0),
            getLocalDayKey: jest.fn(() => 0),
            buildDailyScheduleConfig: jest.fn(),
        },
        actions: {
            switchToChannel: jest.fn(),
            switchToNextChannel: jest.fn(),
            switchToPreviousChannel: jest.fn(),
            switchToChannelByNumberWithOutcome: jest.fn(),
            toggleEPG: jest.fn(),
            onOverlayVisibilityChange: jest.fn(),
            toggleNowPlayingInfoOverlay: jest.fn(),
        } as unknown as OrchestratorCoordinatorBuilderInput['actions'],
        errors: {
            handleGlobalError: jest.fn(),
        },
        nowPlaying: {
            handler: jest.fn(() => null),
        },
    };
};

describe('OrchestratorCoordinatorBuilders', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        coordinatorInstance.clearRerunRequest.mockReset();
    });

    it('bindEpgVisibleRangeChange leaves caller config untouched when no EPG config exists', () => {
        const input = createInput();
        input.config = null;

        bindEpgVisibleRangeChange(input, {
            handleVisibleRangeChange: jest.fn(),
        } as never);

        expect(input.config).toBeNull();
    });

    it('bindEpgVisibleRangeChange wraps visible-range handling without mutating the caller-owned config object', () => {
        const previousOnVisibleRangeChange = jest.fn();
        const handleVisibleRangeChange = jest.fn();
        const input = createInput();
        const originalConfig: EPGConfig = {
            containerId: 'epg',
            visibleChannels: 5,
            timeSlotMinutes: 30,
            visibleHours: 3,
            totalHours: 24,
            pixelsPerMinute: 4,
            rowHeight: 80,
            showCurrentTimeIndicator: true,
            autoScrollToNow: true,
            onVisibleRangeChange: previousOnVisibleRangeChange,
        };
        const config = {
            epgConfig: originalConfig,
        } as unknown as NonNullable<OrchestratorCoordinatorBuilderInput['config']>;
        input.config = config;

        bindEpgVisibleRangeChange(input, {
            handleVisibleRangeChange,
        } as never);

        expect(config.epgConfig).not.toBe(originalConfig);
        expect(originalConfig.onVisibleRangeChange).toBe(previousOnVisibleRangeChange);

        const range = { startTime: 1_000, endTime: 2_000, channelStartIndex: 0, channelEndIndex: 4 } as never;
        config.epgConfig.onVisibleRangeChange?.(range);

        expect(previousOnVisibleRangeChange).toHaveBeenCalledWith(range);
        expect(handleVisibleRangeChange).toHaveBeenCalledWith(range);
    });

    it('buildChannelSetupOwners wires shared selected-server and channel-count context through the coordinator/workflow pair', async () => {
        const input = createInput();
        const epgCoordinator = {
            clearSelectedChannelScheduleSnapshot: jest.fn(),
            primeEpgChannels: jest.fn(),
            refreshEpgSchedules: jest.fn().mockResolvedValue(undefined),
        };

        const owners = buildChannelSetupOwners(input, epgCoordinator as never);

        expect(ChannelSetupRecordStore).toHaveBeenCalledTimes(1);
        expect(ChannelSetupBuildScratchStore).toHaveBeenCalledTimes(1);
        expect(ChannelSetupPlanningService).toHaveBeenCalledWith({
            plexLibrary: input.modules.plexLibrary,
            channelManager: input.modules.channelManager,
        });
        expect(ChannelSetupBuildExecutor).toHaveBeenCalledWith({
            channelManager: input.modules.channelManager,
            planningService: planningServiceInstance,
            buildCommitter: buildCommitterInstance,
        });
        expect(owners).toEqual({
            coordinator: coordinatorInstance,
            workflow: workflowInstance,
        });

        const buildCommitterArgs = (ChannelSetupBuildCommitter as jest.Mock).mock.calls[0]?.[0];
        await expect(buildCommitterArgs.ensureEpgInitialized()).resolves.toBeUndefined();
        buildCommitterArgs.clearSelectedChannelScheduleSnapshot();
        buildCommitterArgs.primeEpgChannels();
        await expect(buildCommitterArgs.refreshEpgSchedules({ reason: 'rerun' })).resolves.toBeUndefined();

        expect(input.init.ensureEpgInitialized).toHaveBeenCalledTimes(1);
        expect(epgCoordinator.clearSelectedChannelScheduleSnapshot).toHaveBeenCalledTimes(1);
        expect(epgCoordinator.primeEpgChannels).toHaveBeenCalledTimes(1);
        expect(epgCoordinator.refreshEpgSchedules).toHaveBeenCalledWith({ reason: 'rerun' });

        const coordinatorArgs = (ChannelSetupCoordinator as jest.Mock).mock.calls[0]?.[0];
        const completionTrackerArgs = (ChannelSetupCompletionTracker as jest.Mock).mock.calls[0]?.[0];
        const workflowArgs = (ChannelSetupWorkflow as jest.Mock).mock.calls[0]?.[0];

        expect(coordinatorArgs.getSelectedServerId()).toBe('server-1');
        expect(coordinatorArgs.getExistingChannelCount()).toBe(2);
        expect(workflowArgs.getSelectedServerId()).toBe('server-1');
        expect(workflowArgs.getExistingChannelCount()).toBe(2);
        completionTrackerArgs.clearRerunRequest();
        expect(coordinatorInstance.clearRerunRequest).toHaveBeenCalledTimes(1);
        expect(workflowArgs.recordStore).toBe(recordStoreInstance);
        expect(workflowArgs.completionTracker).toBe(completionTrackerInstance);
    });
});
