import type { EPGConfig } from '../../../modules/ui/epg';
import type { EpgVisibleRange } from '../../../modules/ui/epg/types';
import type {
    OrchestratorCoordinatorAssemblyInput,
    OrchestratorNavigationCoordinatorBuilderInput,
} from '../OrchestratorCoordinatorContracts';

const recordStoreInstance = { kind: 'record-store' };
const scratchStoreInstance = { kind: 'scratch-store' };
const planningServiceInstance = { kind: 'planning-service' };
const buildCommitterInstance = { kind: 'build-committer' };
const buildExecutorInstance = { kind: 'build-executor' };
const coordinatorInstance = { clearRerunRequest: jest.fn(), kind: 'coordinator' };
const completionTrackerInstance = { kind: 'completion-tracker' };
const workflowInstance = { kind: 'workflow' };

jest.mock('../../channel-setup/ChannelSetupRecordStore', () => ({
    ChannelSetupRecordStore: jest.fn(() => recordStoreInstance),
}));
jest.mock('../../channel-setup/ChannelSetupBuildScratchStore', () => ({
    ChannelSetupBuildScratchStore: jest.fn(() => scratchStoreInstance),
}));
jest.mock('../../channel-setup/ChannelSetupPlanningService', () => ({
    ChannelSetupPlanningService: jest.fn(() => planningServiceInstance),
}));
jest.mock('../../channel-setup/ChannelSetupBuildCommitter', () => ({
    ChannelSetupBuildCommitter: jest.fn(() => buildCommitterInstance),
}));
jest.mock('../../channel-setup/ChannelSetupBuildExecutor', () => ({
    ChannelSetupBuildExecutor: jest.fn(() => buildExecutorInstance),
}));
jest.mock('../../channel-setup/ChannelSetupCoordinator', () => ({
    ChannelSetupCoordinator: jest.fn(() => coordinatorInstance),
}));
jest.mock('../../channel-setup/ChannelSetupCompletionTracker', () => ({
    ChannelSetupCompletionTracker: jest.fn(() => completionTrackerInstance),
}));
jest.mock('../../channel-setup/ChannelSetupWorkflow', () => ({
    ChannelSetupWorkflow: jest.fn(() => workflowInstance),
}));

import { ChannelSetupBuildCommitter } from '../../channel-setup/ChannelSetupBuildCommitter';
import { ChannelSetupBuildExecutor } from '../../channel-setup/ChannelSetupBuildExecutor';
import { ChannelSetupBuildScratchStore } from '../../channel-setup/ChannelSetupBuildScratchStore';
import { ChannelSetupCompletionTracker } from '../../channel-setup/ChannelSetupCompletionTracker';
import { ChannelSetupCoordinator } from '../../channel-setup/ChannelSetupCoordinator';
import { ChannelSetupPlanningService } from '../../channel-setup/ChannelSetupPlanningService';
import { ChannelSetupRecordStore } from '../../channel-setup/ChannelSetupRecordStore';
import { ChannelSetupWorkflow } from '../../channel-setup/ChannelSetupWorkflow';
import {
    bindEpgVisibleRangeChange,
    buildChannelSetupOwners,
    buildChannelTransitionCoordinator,
    buildMiniGuideCoordinator,
    buildNavigationCoordinator,
    buildPlayerOsdCoordinator,
} from '../OrchestratorCoordinatorBuilders';

const createInput = (): OrchestratorCoordinatorAssemblyInput => {
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
        } as unknown as OrchestratorCoordinatorAssemblyInput['modules'],
        overlays: {
            nowPlayingInfo: { kind: 'now-playing' },
            playerOsd: { kind: 'player-osd' },
            channelNumberOverlay: { kind: 'channel-number' },
            miniGuide: { kind: 'mini-guide' },
            channelTransitionOverlay: { kind: 'transition' },
            playbackOptionsModal: { kind: 'playback-options-modal' },
            exitConfirmModal: { kind: 'exit-confirm-modal' },
            sleepTimer: { kind: 'sleep-timer' },
        } as unknown as OrchestratorCoordinatorAssemblyInput['overlays'],
        stores: {
            developerSettingsStore: { kind: 'developer-settings-store' },
            debugOverridesStore: { kind: 'debug-overrides-store' },
            subtitlePreferencesStore: { kind: 'subtitle-preferences-store' },
            epgPreferencesStore: { kind: 'epg-preferences-store' },
            nowPlayingDisplayStore: { kind: 'now-playing-display-store' },
            profileSessionStore: { kind: 'profile-session-store' },
        } as unknown as OrchestratorCoordinatorAssemblyInput['stores'],
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
        } as unknown as OrchestratorCoordinatorAssemblyInput['playback'],
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
            onChannelTransitionActivityChange: jest.fn(),
            toggleNowPlayingInfoOverlay: jest.fn(),
        } as unknown as OrchestratorCoordinatorAssemblyInput['actions'],
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
        } as unknown as NonNullable<OrchestratorCoordinatorAssemblyInput['config']>;
        input.config = config;

        bindEpgVisibleRangeChange(input, {
            handleVisibleRangeChange,
        } as never);

        expect(config.epgConfig).not.toBe(originalConfig);
        expect(originalConfig.onVisibleRangeChange).toBe(previousOnVisibleRangeChange);

        const range: EpgVisibleRange = {
            timeStartMs: 1_000,
            timeEndMs: 2_000,
            channelStart: 0,
            channelEnd: 4,
        };
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

    it('buildNavigationCoordinator preserves navigation-facing reporting semantics with the narrowed input seam', () => {
        const reportRecoverableAsyncFailure = jest.fn();
        const reportToast = jest.fn();
        const input: OrchestratorNavigationCoordinatorBuilderInput = {
            config: {
                playerConfig: {
                    seekIncrementSec: 15,
                },
                channelNumberOverlayConfig: {
                    completeHideDelayMs: 900,
                },
            } as OrchestratorCoordinatorAssemblyInput['config'],
            modules: {
                navigation: { kind: 'navigation' },
                epg: { kind: 'epg' },
                plexAuth: { kind: 'plex-auth' },
                videoPlayer: { kind: 'video-player' },
            } as unknown as OrchestratorNavigationCoordinatorBuilderInput['modules'],
            overlays: {
                playerOsd: { kind: 'player-osd' },
                miniGuide: { kind: 'mini-guide' },
                nowPlayingInfo: { resetAutoHideTimer: jest.fn() },
                channelNumberOverlay: {
                    showDigits: jest.fn(),
                    scheduleHide: jest.fn(),
                },
            } as unknown as OrchestratorNavigationCoordinatorBuilderInput['overlays'],
            stores: {
                developerSettingsStore: {
                    readDebugLoggingEnabledAndClean: jest.fn(() => true),
                },
                profileSessionStore: {
                    readKeepPlayingInSettingsAndClean: jest.fn(() => false),
                },
            } as unknown as OrchestratorNavigationCoordinatorBuilderInput['stores'],
            diagnostics: {
                reportRecoverableAsyncFailure,
            },
            playback: {
                stopPlayback: jest.fn(),
            },
            schedule: {
                setLastChannelChangeSource: jest.fn(),
            },
            actions: {
                switchToNextChannel: jest.fn(),
                switchToPreviousChannel: jest.fn(),
                switchToChannelByNumberWithOutcome: jest.fn(),
                toggleEPG: jest.fn(),
                toggleNowPlayingInfoOverlay: jest.fn(),
            },
            nowPlaying: {
                handler: jest.fn(() => reportToast),
            },
        };
        const deps = {
            epgCoordinator: {
                focusEpgOnCurrentChannel: jest.fn(),
            },
            channelSetup: {
                shouldRunChannelSetup: jest.fn(() => false),
            },
            nowPlayingInfoCoordinator: {
                handleModalOpen: jest.fn(),
                handleModalClose: jest.fn(),
            },
            playerOsdCoordinator: {
                poke: jest.fn(),
                toggle: jest.fn(),
                hide: jest.fn(),
            },
            miniGuideCoordinator: {
                show: jest.fn(),
                hide: jest.fn(),
                handleNavigation: jest.fn(() => true),
                handlePage: jest.fn(() => true),
                handleSelect: jest.fn(),
            },
            channelTransitionCoordinator: {
                hide: jest.fn(),
            },
            playbackOptionsCoordinator: {
                prepareModal: jest.fn(() => ({
                    focusableIds: ['audio-track'],
                    preferredFocusId: 'audio-track',
                })),
                handleModalOpen: jest.fn(),
                handleModalClose: jest.fn(),
            },
            exitConfirmCoordinator: {
                handleModalOpen: jest.fn(),
                handleModalClose: jest.fn(),
            },
        };

        const coordinator = buildNavigationCoordinator(input, deps as never);
        const navigationDeps = (
            coordinator as unknown as {
                deps: Pick<
                    import('../../../modules/navigation/NavigationCoordinator').NavigationCoordinatorDeps,
                    | 'reportRecoverableAsyncFailure'
                    | 'reportToast'
                    | 'playback'
                    | 'readKeepPlayingInSettings'
                    | 'readDebugLoggingEnabled'
                >;
            }
        ).deps;

        expect(navigationDeps.reportRecoverableAsyncFailure).toBe(reportRecoverableAsyncFailure);
        expect(navigationDeps.reportToast).toBeDefined();
        navigationDeps.reportToast?.({ message: 'Recovered', type: 'warning' });
        expect(reportToast).toHaveBeenCalledWith({ message: 'Recovered', type: 'warning' });
        expect(navigationDeps.playback.getSeekIncrementMs()).toBe(15_000);
        input.config!.playerConfig!.seekIncrementSec = 30;
        expect(navigationDeps.playback.getSeekIncrementMs()).toBe(30_000);
        input.config!.playerConfig!.seekIncrementSec = Number.NaN;
        expect(navigationDeps.playback.getSeekIncrementMs()).toBe(10_000);
        expect(navigationDeps.readKeepPlayingInSettings()).toBe(false);
        expect(navigationDeps.readDebugLoggingEnabled()).toBe(true);
    });

    it('buildChannelTransitionCoordinator routes transition activity changes through the named orchestrator callback path', () => {
        jest.useFakeTimers();
        const input = createInput();
        input.modules.navigation = {
            getCurrentScreen: jest.fn(() => 'player'),
            isModalOpen: jest.fn(() => false),
        } as unknown as OrchestratorCoordinatorAssemblyInput['modules']['navigation'];
        input.modules.videoPlayer = {
            getState: jest.fn(() => ({ status: 'loading' })),
        } as unknown as OrchestratorCoordinatorAssemblyInput['modules']['videoPlayer'];

        try {
            const coordinator = buildChannelTransitionCoordinator(input);
            const onChannelTransitionActivityChange = (
                input.actions as OrchestratorCoordinatorAssemblyInput['actions'] & {
                    onChannelTransitionActivityChange: jest.Mock<void, [boolean]>;
                }
            ).onChannelTransitionActivityChange;

            coordinator.armForChannelSwitch('12 Comedy');
            coordinator.armForChannelSwitch('24 News');
            coordinator.onScreenChange('guide');

            expect(onChannelTransitionActivityChange).toHaveBeenCalledTimes(2);
            expect(onChannelTransitionActivityChange).toHaveBeenNthCalledWith(1, true);
            expect(onChannelTransitionActivityChange).toHaveBeenNthCalledWith(2, false);
        } finally {
            jest.useRealTimers();
        }
    });

    it('buildMiniGuideCoordinator routes select-failure toasts through input.nowPlaying.handler()', async () => {
        const reportToast = jest.fn();
        const input = createInput();
        const overlay = {
            setViewModel: jest.fn(),
            setFocusedIndex: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            isVisible: jest.fn(() => true),
        };
        input.overlays.miniGuide = overlay as unknown as OrchestratorCoordinatorAssemblyInput['overlays']['miniGuide'];
        input.modules.channelManager = {
            getAllChannels: jest.fn(() => [
                { id: 'channel-1', number: 1, name: 'One' },
                { id: 'channel-2', number: 2, name: 'Two' },
                { id: 'channel-3', number: 3, name: 'Three' },
                { id: 'channel-4', number: 4, name: 'Four' },
                { id: 'channel-5', number: 5, name: 'Five' },
            ]),
            getCurrentChannel: jest.fn(() => ({ id: 'channel-3', number: 3, name: 'Three' })),
        } as unknown as OrchestratorCoordinatorAssemblyInput['modules']['channelManager'];
        input.modules.scheduler = {
            getCurrentProgram: jest.fn(() => null),
        } as unknown as OrchestratorCoordinatorAssemblyInput['modules']['scheduler'];
        input.actions.switchToChannel = jest.fn().mockRejectedValue(new Error('switch failed'));
        input.nowPlaying.handler = jest.fn(() => reportToast);

        const coordinator = buildMiniGuideCoordinator(input);

        coordinator.show();
        coordinator.handleSelect();
        await Promise.resolve();

        expect(input.nowPlaying.handler).toHaveBeenCalled();
        expect(input.actions.switchToChannel).toHaveBeenCalledWith('channel-3');
        expect(reportToast).toHaveBeenCalledWith({
            message: 'Failed to switch channel',
            type: 'warning',
        });
    });

    it('buildMiniGuideCoordinator keeps no-type toast routing object-shaped', () => {
        const reportToast = jest.fn();
        const input = createInput();
        input.nowPlaying.handler = jest.fn(() => reportToast);

        const coordinator = buildMiniGuideCoordinator(input);
        const miniGuideDeps = (
            coordinator as unknown as {
                deps: {
                    notifyToast?: (toast: { message: string; type?: 'warning' | 'error' | 'info' | 'success' }) => void;
                };
            }
        ).deps;

        miniGuideDeps.notifyToast?.({ message: 'Recovered without explicit type' });

        expect(reportToast).toHaveBeenCalledWith({ message: 'Recovered without explicit type' });
    });

    it('buildPlayerOsdCoordinator falls back to the default auto-hide duration when playerConfig is absent', () => {
        const input = createInput();
        input.config = {
            epgConfig: {
                containerId: 'epg',
                visibleChannels: 5,
                timeSlotMinutes: 30,
                visibleHours: 3,
                totalHours: 24,
                pixelsPerMinute: 4,
                rowHeight: 80,
                showCurrentTimeIndicator: true,
                autoScrollToNow: false,
            },
        } as OrchestratorCoordinatorAssemblyInput['config'];

        const coordinator = buildPlayerOsdCoordinator(input, () => ({
            focusableIds: [],
            preferredFocusId: null,
        }));
        const playerOsdDeps = (
            coordinator as unknown as {
                deps: {
                    getAutoHideMs: () => number;
                };
            }
        ).deps;

        expect(playerOsdDeps.getAutoHideMs()).toBe(3000);
    });
});
