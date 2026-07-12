import type { AppError } from '../../modules/lifecycle';
import type { AppendIssueDiagnostic } from '../../modules/debug/IssueDiagnosticsStore';
import { AppErrorCode, getAppErrorCode } from '../../types/app-errors';
import { summarizeErrorForLog } from '../../utils/errors';
import { redactSensitiveTokens } from '../../utils/redact';

type ChannelTuningOperation = 'switchToChannel' | 'switchToChannelByNumber';

export type ChannelTuningErrorFallback = {
    code: AppErrorCode;
    message: string;
    recoverable: boolean;
    context?: Record<string, unknown>;
};

export class ChannelTuningDiagnostics {
    constructor(private readonly _deps: {
        appendIssueDiagnostic: AppendIssueDiagnostic;
        handleGlobalError: (error: AppError, context: string) => void;
    }) {}

    append(stage: string, details: Record<string, unknown>): void {
        try {
            this._deps.appendIssueDiagnostic('QA-003b', stage, details);
        } catch {
            // Diagnostics are best-effort.
        }
    }

    reportUnknown(
        stage: string,
        error: unknown,
        fallback: ChannelTuningErrorFallback,
        operation: ChannelTuningOperation,
        details: Record<string, unknown> = {}
    ): AppError {
        const appError = this._normalize(error, fallback);
        this.report(stage, appError, operation, {
            ...details,
            error: summarizeErrorForLog(error),
        });
        return appError;
    }

    report(
        stage: string,
        error: AppError,
        operation: ChannelTuningOperation,
        details: Record<string, unknown> = {}
    ): void {
        this.append(stage, {
            ...details,
            code: error.code,
            message: error.message,
            recoverable: error.recoverable,
            context: error.context ?? null,
        });
        this._deps.handleGlobalError(error, operation);
    }

    private _normalize(error: unknown, fallback: ChannelTuningErrorFallback): AppError {
        if (!error || typeof error !== 'object') return { ...fallback };
        const maybeError = error as {
            code?: unknown;
            message?: unknown;
            recoverable?: unknown;
            context?: unknown;
        };
        const message = typeof maybeError.message === 'string'
            ? redactSensitiveTokens(maybeError.message).trim() || fallback.message
            : fallback.message;
        return {
            code: getAppErrorCode(maybeError.code) ?? fallback.code,
            message,
            recoverable: typeof maybeError.recoverable === 'boolean'
                ? maybeError.recoverable
                : fallback.recoverable,
            context: {
                ...(fallback.context ?? {}),
                ...(maybeError.context && typeof maybeError.context === 'object'
                    ? maybeError.context as Record<string, unknown>
                    : {}),
                errorSummary: summarizeErrorForLog(error),
            },
        };
    }
}
