import {
    createRecoverableRuntimeIssueReporter,
    observeRecoverableAsyncFailure,
    safelyReportCleanupFailures,
} from '../runtime/OrchestratorRecoverableRuntimeReporter';
import type { OrchestratorEventCleanupFailure } from '../events/OrchestratorEventCleanupReporter';
import { expectConsoleWarn } from '../../../__tests__/helpers';
import { AppOrchestrator } from '../../../Orchestrator';
import { AppErrorCode } from '../../../types/app-errors';

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

    it('keeps recoverable reporter failures inside the reporter collaborator during global error handling', () => {
        const warn = jest.fn();
        const orchestrator = new AppOrchestrator();
        Reflect.set(
            orchestrator as object,
            '_recoverableRuntimeReporter',
            createRecoverableRuntimeIssueReporter({
                issueId: 'qa-1',
                appendIssueDiagnostic: () => {
                    throw new Error('append failed');
                },
                warn,
            })
        );

        expect(() => {
            orchestrator.handleGlobalError(
                {
                    code: AppErrorCode.NETWORK_TIMEOUT,
                    message: 'test',
                    recoverable: true,
                },
                'test-context'
            );
        }).not.toThrow();

        expect(warn).toHaveBeenCalledWith(
            '[RecoverableRuntimeReporter] reportError failed:',
            expect.objectContaining({
                message: 'append failed',
            })
        );
    });

    it('forwards stream resolver access-denied events through global error handling', () => {
        const orchestrator = new AppOrchestrator();
        const handleGlobalError = jest.spyOn(orchestrator, 'handleGlobalError').mockImplementation(() => undefined);
        const handlePlexStreamError = Reflect.get(orchestrator as object, '_handlePlexStreamError') as (
            error: { code: AppErrorCode; message: string; recoverable: boolean }
        ) => void;

        handlePlexStreamError.call(orchestrator, {
            code: AppErrorCode.ACCESS_DENIED,
            message: 'Access denied',
            recoverable: false,
        });

        expect(handleGlobalError).toHaveBeenCalledWith(
            {
                code: AppErrorCode.ACCESS_DENIED,
                message: 'Access denied',
                recoverable: false,
            },
            'plex-stream'
        );
    });

    it('swallows warn failures without introducing a second fallback path', () => {
        const appendIssueDiagnostic = jest.fn();
        const warn = jest.fn(() => {
            throw new Error('warn failed');
        });
        expectConsoleWarn([
            '[RecoverableRuntimeWarning] injected warn failed:',
            expect.objectContaining({
                warning: { message: 'Recoverable failure', data: { detail: 'x' } },
                error: { name: 'Error', message: 'warn failed' },
            }),
        ]);
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
