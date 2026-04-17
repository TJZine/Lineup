import {
    summarizeEventCleanupFailure,
    type OrchestratorEventCleanupFailure,
    type OrchestratorEventCleanupReporter,
} from '../OrchestratorEventCleanupReporter';

describe('OrchestratorEventCleanupReporter', () => {
    it('summarizes cleanup failures for safe logging', () => {
        const failure = summarizeEventCleanupFailure(
            'event-wiring.cleanup',
            new Error('token=abc123 exploded')
        );

        expect(failure).toEqual({
            step: 'event-wiring.cleanup',
            error: {
                name: 'Error',
                message: 'token=REDACTED exploded',
            },
        });
    });

    it('preserves the reporter callback contract for summarized cleanup batches', () => {
        const reporter: OrchestratorEventCleanupReporter = jest.fn();
        const failures: OrchestratorEventCleanupFailure[] = [
            summarizeEventCleanupFailure('event-wiring.cleanup', new Error('cleanup failed')),
            summarizeEventCleanupFailure('event-wiring.onCleanupError', { message: 'fallback failed' }),
        ];

        reporter(failures);

        expect(reporter).toHaveBeenCalledWith(failures);
    });
});
