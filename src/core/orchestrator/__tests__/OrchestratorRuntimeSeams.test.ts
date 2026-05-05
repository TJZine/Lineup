import type {
    PriorityOneEventRuntimePort,
    PriorityOnePlaybackRecoveryPort,
    PriorityOnePlaybackRuntimePort,
    PriorityOnePlayerEventPort,
    PriorityOneRequiredRuntimeModules,
    PriorityOneSchedulerRuntimePort,
    PriorityOneUiRuntimePort,
    RecoverableAsyncFailureReporter,
} from '../runtime/OrchestratorRuntimeSeams';

describe('OrchestratorRuntimeSeams', () => {
    it('accepts minimal runtime-safe fixtures that satisfy the priority-one seam contracts', () => {
        const cleanupCallbacks: Array<() => void> = [];
        const reportRecoverableAsyncFailure: RecoverableAsyncFailureReporter = jest.fn();
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
            wireNavigationCoordinatorEvents: () => cleanupCallbacks,
            wireEpgCoordinatorEvents: () => cleanupCallbacks,
            handleScheduleDayRollover: async () => undefined,
            handlePlayerTrackChange: () => undefined,
            handlePlexLibraryAuthExpired: () => undefined,
            handlePlexStreamError: () => undefined,
            handleScreenChange: () => undefined,
            reportPersistenceWarning: () => undefined,
            cleanupReporter: {} as PriorityOneEventRuntimePort['cleanupReporter'],
            reportRecoverableAsyncFailure,
        };

        expect(playbackRecovery.isStreamRecoveryInProgress()).toBe(false);
        expect(playbackRuntime.playbackRecovery).toBe(playbackRecovery);
        expect(eventRuntime.wireNavigationCoordinatorEvents()).toBe(cleanupCallbacks);
        expect(eventRuntime.wireEpgCoordinatorEvents()).toBe(cleanupCallbacks);
        expect(modules.scheduler).toBeDefined();
        expect(schedulerRuntime.syncSchedulerToCurrentTime).toBeDefined();
        expect(playerEvents.onPlayerStateChange).toBeDefined();
        expect(uiRuntime.showInfoBanner).toBeDefined();
    });
});
