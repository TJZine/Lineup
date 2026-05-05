import {
    summarizeEventCleanupFailure,
} from '../events/OrchestratorEventCleanupReporter';

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
});
