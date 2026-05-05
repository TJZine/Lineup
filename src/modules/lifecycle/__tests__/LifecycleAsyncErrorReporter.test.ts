import { LifecycleAsyncErrorReporter } from '../LifecycleAsyncErrorReporter';
import { AppErrorCode } from '../../../types/app-errors';
import type { AppError, LifecycleEventMap } from '../types';

type ReporterFixture = {
    reporter: LifecycleAsyncErrorReporter;
    emitAsyncError: jest.Mock<void, [LifecycleEventMap['asyncError']]>;
    reportError: jest.Mock<void, [AppError]>;
    logger: { warn: jest.Mock };
};

describe('LifecycleAsyncErrorReporter', () => {
    const createReporter = (options: {
        fatalContexts?: ReadonlySet<string>;
        now?: () => number;
    } = {}): ReporterFixture => {
        const emitAsyncError = jest.fn<void, [LifecycleEventMap['asyncError']]>();
        const reportError = jest.fn<void, [AppError]>();
        const logger = { warn: jest.fn() };
        const reporter = new LifecycleAsyncErrorReporter({
            emitAsyncError,
            reportError,
            logger,
            now: options.now ?? ((): number => 1234),
            ...(options.fatalContexts ? { fatalContexts: options.fatalContexts } : {}),
        });
        return { reporter, emitAsyncError, reportError, logger };
    };

    it('emits asyncError without reporting a global app error for non-fatal contexts', () => {
        const { reporter, emitAsyncError, reportError, logger } = createReporter();

        reporter.handle(new Error('timer failed'), 'network-monitor');

        expect(logger.warn).toHaveBeenCalledWith('[AppLifecycle] Async lifecycle task failed', {
            context: 'network-monitor',
            error: {
                name: 'Error',
                message: 'timer failed',
            },
        });
        expect(emitAsyncError).toHaveBeenCalledWith({
            context: 'network-monitor',
            error: {
                name: 'Error',
                message: 'timer failed',
            },
            timestamp: 1234,
        });
        expect(reportError).not.toHaveBeenCalled();
    });

    it('reports a global app error only for explicitly fatal contexts', () => {
        const { reporter, emitAsyncError, reportError } = createReporter({
            fatalContexts: new Set(['startup']),
        });

        reporter.handle({ name: 'StartupError', message: 'boot failed' }, 'startup');

        expect(emitAsyncError).toHaveBeenCalledWith({
            context: 'startup',
            error: {
                name: 'StartupError',
                message: 'boot failed',
            },
            timestamp: 1234,
        });
        expect(reportError).toHaveBeenCalledWith({
            code: AppErrorCode.UNKNOWN,
            message: 'Async lifecycle task failed: startup',
            recoverable: true,
            context: {
                source: 'startup',
                error: {
                    name: 'StartupError',
                    message: 'boot failed',
                },
            },
        });
    });
});
