import { summarizeErrorForLog } from '../../utils/errors';
import { AppErrorCode } from '../../types/app-errors';
import type { AppError, LifecycleEventMap } from './types';

export interface LifecycleAsyncErrorReporterDeps {
    emitAsyncError(payload: LifecycleEventMap['asyncError']): void;
    reportError(error: AppError): void;
    fatalContexts?: ReadonlySet<string>;
    now?: () => number;
    logger?: Pick<Console, 'warn'>;
}

export class LifecycleAsyncErrorReporter {
    private readonly _emitAsyncError: (payload: LifecycleEventMap['asyncError']) => void;
    private readonly _reportError: (error: AppError) => void;
    private readonly _fatalContexts: ReadonlySet<string>;
    private readonly _now: () => number;
    private readonly _logger: Pick<Console, 'warn'>;

    public constructor(deps: LifecycleAsyncErrorReporterDeps) {
        this._emitAsyncError = deps.emitAsyncError;
        this._reportError = deps.reportError;
        this._fatalContexts = deps.fatalContexts ?? new Set<string>();
        this._now = deps.now ?? Date.now;
        this._logger = deps.logger ?? console;
    }

    public handle(error: unknown, context: string): void {
        const summarizedError = summarizeErrorForLog(error);
        this._logger.warn('[AppLifecycle] Async lifecycle task failed', {
            context,
            error: summarizedError,
        });
        this._emitAsyncError({
            context,
            error: summarizedError,
            timestamp: this._now(),
        });
        if (!this._fatalContexts.has(context)) {
            return;
        }
        this._reportError({
            code: AppErrorCode.UNKNOWN,
            message: `Async lifecycle task failed: ${context}`,
            recoverable: true,
            context: {
                source: context,
                error: summarizedError,
            },
        });
    }
}
