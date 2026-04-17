import '../OrchestratorRuntimeSeams';
import type {
    PriorityOneEventRuntimePort,
    PriorityOnePlaybackRecoveryPort,
    PriorityOnePlaybackRuntimePort,
    PriorityOnePlayerEventPort,
    PriorityOneRequiredRuntimeModules,
    PriorityOneSchedulerRuntimePort,
    PriorityOneUiRuntimePort,
    RecoverableAsyncFailureReporter,
} from '../OrchestratorRuntimeSeams';

describe('OrchestratorRuntimeSeams', () => {
    it('provides direct type contracts for the priority-one runtime seams', () => {
        const reportRecoverableAsyncFailure: RecoverableAsyncFailureReporter = () => undefined;
        const playbackRecovery: PriorityOnePlaybackRecoveryPort = {
            isStreamRecoveryInProgress: () => false,
        };
        const modules: PriorityOneRequiredRuntimeModules = {
            scheduler: {} as PriorityOneRequiredRuntimeModules['scheduler'],
            videoPlayer: {} as PriorityOneRequiredRuntimeModules['videoPlayer'],
            lifecycle: {} as PriorityOneRequiredRuntimeModules['lifecycle'],
        };
        const playbackRuntime: PriorityOnePlaybackRuntimePort = {
            playbackState: {} as PriorityOnePlaybackRuntimePort['playbackState'],
            playbackRecovery,
            stopPlayback: () => undefined,
            unloadCurrentChannel: () => undefined,
            stopTranscodeSessionById: () => undefined,
            skipToNextProgram: () => undefined,
            pausePlayer: () => undefined,
            playPlayer: async () => undefined,
        };
        const schedulerRuntime: PriorityOneSchedulerRuntimePort = {
            cancelPendingDayRollover: () => undefined,
            pauseSchedulerSync: () => undefined,
            resumeSchedulerSync: () => undefined,
            syncSchedulerToCurrentTime: () => undefined,
        };
        const playerEvents: PriorityOnePlayerEventPort = {
            onPlayerStateChange: () => undefined,
            onPlayerTimeUpdate: () => undefined,
            onPlayerBufferUpdate: () => undefined,
        };
        const uiRuntime: PriorityOneUiRuntimePort = {
            handleGlobalError: () => undefined,
            showInfoBanner: () => undefined,
            onProgramStartUiSideEffects: () => undefined,
            onStreamResolved: () => undefined,
            onPlaybackStartFailure: () => undefined,
        };
        const eventRuntime: PriorityOneEventRuntimePort = {
            wireNavigationCoordinatorEvents: () => [],
            wireEpgCoordinatorEvents: () => [],
            handleScheduleDayRollover: async () => undefined,
            handlePlayerTrackChange: () => undefined,
            handlePlexLibraryAuthExpired: () => undefined,
            handlePlexStreamError: () => undefined,
            handleScreenChange: () => undefined,
            reportPersistenceWarning: () => undefined,
            cleanupReporter: {} as PriorityOneEventRuntimePort['cleanupReporter'],
            reportRecoverableAsyncFailure,
        };

        expect(typeof reportRecoverableAsyncFailure).toBe('function');
        expect(playbackRecovery.isStreamRecoveryInProgress()).toBe(false);
        expect(playbackRuntime.playbackRecovery).toBe(playbackRecovery);
        expect(typeof schedulerRuntime.syncSchedulerToCurrentTime).toBe('function');
        expect(typeof playerEvents.onPlayerStateChange).toBe('function');
        expect(typeof uiRuntime.showInfoBanner).toBe('function');
        expect(eventRuntime.wireNavigationCoordinatorEvents()).toEqual([]);
        expect(modules.scheduler).toBeDefined();
    });
});
