import {
    createRecoverableRuntimeIssueReporter,
    observeRecoverableAsyncFailure,
    safelyReportCleanupFailures,
} from '../OrchestratorRecoverableRuntimeReporter';
import type { OrchestratorEventCleanupFailure } from '../OrchestratorEventCleanupReporter';

describe('OrchestratorRecoverableRuntimeReporter', () => {
    it('swallows appendIssueDiagnostic failures and falls back to console.error', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
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

        expect(warn).toHaveBeenCalledWith('Recoverable failure', { detail: 'x' });
        expect(consoleError).toHaveBeenCalledWith(
            '[RecoverableRuntimeReporter] reportIssue failed:',
            expect.objectContaining({
                message: 'append failed',
            })
        );

        consoleError.mockRestore();
    });

    it('swallows warn failures and falls back to console.error', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const appendIssueDiagnostic = jest.fn();
        const reporter = createRecoverableRuntimeIssueReporter({
            issueId: 'qa-1',
            appendIssueDiagnostic,
            warn: () => {
                throw new Error('warn failed');
            },
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
        expect(consoleError).toHaveBeenCalledWith(
            '[RecoverableRuntimeReporter] reportIssue failed:',
            expect.objectContaining({
                message: 'warn failed',
            })
        );

        consoleError.mockRestore();
    });

    it('swallows recoverable async reporter failures and falls back to console.error', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

        await expect(
            observeRecoverableAsyncFailure(
                Promise.reject(new Error('background boom')),
                () => {
                    throw new Error('reporter boom');
                },
                'runtime.async',
                'Background task failed'
            )
        ).resolves.toBeUndefined();

        expect(consoleError).toHaveBeenCalledWith(
            '[RecoverableRuntimeReporter] observeRecoverableAsyncFailure failed:',
            expect.objectContaining({
                message: 'reporter boom',
            })
        );

        consoleError.mockRestore();
    });

    it('reportError appends safeError and logs via console.error without calling warn', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const appendIssueDiagnostic = jest.fn();
        const warn = jest.fn();
        const reporter = createRecoverableRuntimeIssueReporter({
            issueId: 'qa-1',
            appendIssueDiagnostic,
            warn,
        });

        reporter.reportError('runtime.event', 'Recoverable error', new Error('boom'), { detail: 'x' });

        expect(warn).not.toHaveBeenCalled();
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
        expect(consoleError).toHaveBeenCalledWith(
            'Recoverable error',
            expect.objectContaining({
                detail: 'x',
                safeError: expect.objectContaining({
                    message: 'boom',
                }),
            })
        );

        consoleError.mockRestore();
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

        expect(cleanupReporter).toHaveBeenCalledWith(failures);
    });
});
