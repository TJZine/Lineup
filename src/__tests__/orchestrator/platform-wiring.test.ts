import { AppErrorCode, AppOrchestrator } from '../../Orchestrator';

describe('AppOrchestrator platform wiring suite', () => {
    it('maps AppError into LifecycleAppError', () => {
        const orchestrator = new AppOrchestrator();
        const lifecycleError = orchestrator.toLifecycleAppError({
            code: AppErrorCode.UNKNOWN,
            message: 'boom',
            recoverable: true,
        });

        expect(lifecycleError.code).toBe(AppErrorCode.UNKNOWN);
        expect(lifecycleError.message).toBe('boom');
        expect(lifecycleError.recoverable).toBe(true);
        expect(lifecycleError.phase).toBe('error');
    });
});
