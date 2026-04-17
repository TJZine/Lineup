import {
    createRecoverableRuntimeIssueReporter,
    observeRecoverableAsyncFailure,
    safelyReportCleanupFailures,
} from '../OrchestratorRecoverableRuntimeReporter';
import type { OrchestratorEventCleanupFailure } from '../OrchestratorEventCleanupReporter';

describe('OrchestratorRecoverableRuntimeReporter', () => {
    it('routes appendIssueDiagnostic failures through the optional runtime warning sink', () => {
        const warn = jest.fn();
        const reporter = createRecoverableRuntimeIssueReporter({
            issueId: 'qa-1',
            appendIssueDiagnostic: () => {
                throw new Error('append failed');
            },
            warn,
        });

        expect(() => {
            reporter.reportIssue('runtime.event', 'Recoverable failure', { detail: 'x' });
        }).not.toThrow();

        expect(warn).toHaveBeenNthCalledWith(
            1,
            '[RecoverableRuntimeReporter] reportIssue failed:',
            expect.objectContaining({
                message: 'append failed',
            })
        );
        expect(warn).toHaveBeenNthCalledWith(2, 'Recoverable failure', { detail: 'x' });
    });

    it('swallows warn failures without introducing a second fallback path', () => {
        const appendIssueDiagnostic = jest.fn();
        const warn = jest.fn(() => {
            throw new Error('warn failed');
        });
        const reporter = createRecoverableRuntimeIssueReporter({
            issueId: 'qa-1',
            appendIssueDiagnostic,
            warn,
        });

        expect(() => {
            reporter.reportIssue('runtime.event', 'Recoverable failure', { detail: 'x' });
        }).not.toThrow();

        expect(appendIssueDiagnostic).toHaveBeenCalledWith(
            'qa-1',
            'runtime.event',
            expect.objectContaining({
                message: 'Recoverable failure',
                detail: 'x',
            })
        );
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith('Recoverable failure', { detail: 'x' });
    });

    it('routes recoverable async reporter failures through the optional runtime warning sink', async () => {
        const warn = jest.fn();

        await expect(
            observeRecoverableAsyncFailure(
                Promise.reject(new Error('background boom')),
                () => {
                    throw new Error('reporter boom');
                },
                'runtime.async',
                'Background task failed',
                warn
            )
        ).resolves.toBeUndefined();

        expect(warn).toHaveBeenCalledWith(
            '[RecoverableRuntimeReporter] observeRecoverableAsyncFailure failed:',
            expect.objectContaining({
                message: 'reporter boom',
            })
        );
    });

    it('reportError appends safeError and emits through the optional runtime warning sink', () => {
        const appendIssueDiagnostic = jest.fn();
        const warn = jest.fn();
        const reporter = createRecoverableRuntimeIssueReporter({
            issueId: 'qa-1',
            appendIssueDiagnostic,
            warn,
        });

        reporter.reportError('runtime.event', 'Recoverable error', new Error('boom'), { detail: 'x' });

        expect(appendIssueDiagnostic).toHaveBeenCalledWith(
            'qa-1',
            'runtime.event',
            expect.objectContaining({
                message: 'Recoverable error',
                detail: 'x',
                safeError: expect.objectContaining({
                    message: 'boom',
                }),
            })
        );
        expect(warn).toHaveBeenCalledWith(
            'Recoverable error',
            expect.objectContaining({
                detail: 'x',
                safeError: expect.objectContaining({
                    message: 'boom',
                }),
            })
        );
    });

    it('does nothing when cleanup failure list is empty', () => {
        const cleanupReporter = jest.fn();

        safelyReportCleanupFailures(cleanupReporter, []);

        expect(cleanupReporter).not.toHaveBeenCalled();
    });

    it('swallows cleanup reporter failures', () => {
        const failures: OrchestratorEventCleanupFailure[] = [
            { step: 'event-wiring.cleanup', error: { message: 'boom' } },
        ];
        const cleanupReporter = jest.fn(() => {
            throw new Error('cleanup failed');
        });

        expect(() => {
            safelyReportCleanupFailures(cleanupReporter, failures);
        }).not.toThrow();

        expect(cleanupReporter).toHaveBeenCalledTimes(1);
        expect(cleanupReporter).toHaveBeenCalledWith(failures);
    });
});
