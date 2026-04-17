import '../OrchestratorRuntimeSeams';
import type {
    PriorityOnePlaybackRecoveryPort,
    RecoverableAsyncFailureReporter,
} from '../OrchestratorRuntimeSeams';

describe('OrchestratorRuntimeSeams', () => {
    it('provides a direct contract import for priority-one runtime seams', () => {
        const reportRecoverableAsyncFailure: RecoverableAsyncFailureReporter = () => undefined;
        const playbackRecovery: PriorityOnePlaybackRecoveryPort = {
            isStreamRecoveryInProgress: () => false,
        };

        expect(typeof reportRecoverableAsyncFailure).toBe('function');
        expect(playbackRecovery.isStreamRecoveryInProgress()).toBe(false);
    });
});
