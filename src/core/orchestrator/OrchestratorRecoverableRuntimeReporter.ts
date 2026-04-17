import type { AppendIssueDiagnostic } from '../../modules/debug/IssueDiagnosticsStore';
import { summarizeErrorForLog } from '../../utils/errors';
import type {
    OrchestratorEventCleanupFailure,
    OrchestratorEventCleanupReporter,
} from './OrchestratorEventCleanupReporter';
import type { RecoverableAsyncFailureReporter } from './OrchestratorRuntimeSeams';

export interface RecoverableRuntimeIssueReporter {
    reportIssue: (event: string, message: string, data?: Record<string, unknown>) => void;
    reportError: (
        event: string,
        message: string,
        error: unknown,
        data?: Record<string, unknown>
    ) => void;
}

interface RecoverableRuntimeIssueReporterInput {
    issueId: string;
    appendIssueDiagnostic: AppendIssueDiagnostic;
    warn?: (message?: unknown, ...optionalParams: unknown[]) => void;
}

export function logRecoverableRuntimeFallback(message: string, data: unknown): void {
    try {
        globalThis.console?.warn?.call(globalThis.console, message, data);
    } catch {
        // Recoverable reporter fallback logging must stay non-fatal.
    }
}

function safeAppendIssueDiagnostic(
    input: RecoverableRuntimeIssueReporterInput,
    event: string,
    data: Record<string, unknown>,
    scope: 'reportIssue' | 'reportError'
): void {
    try {
        input.appendIssueDiagnostic(input.issueId, event, data);
    } catch (error) {
        logRecoverableRuntimeFallback(
            `[RecoverableRuntimeReporter] ${scope} failed:`,
            summarizeErrorForLog(error)
        );
    }
}

function safeWarn(
    warn: RecoverableRuntimeIssueReporterInput['warn'],
    message: string,
    data: Record<string, unknown>
): void {
    try {
        if (warn) {
            warn(message, data);
            return;
        }
        console.warn(message, data);
    } catch (error) {
        logRecoverableRuntimeFallback(
            '[RecoverableRuntimeReporter] reportIssue failed:',
            summarizeErrorForLog(error)
        );
    }
}

export function createRecoverableRuntimeIssueReporter(
    input: RecoverableRuntimeIssueReporterInput
): RecoverableRuntimeIssueReporter {
    const reportIssue = (
        event: string,
        message: string,
        data: Record<string, unknown> = {}
    ): void => {
        const payload = { message, ...data };
        safeAppendIssueDiagnostic(input, event, payload, 'reportIssue');
        safeWarn(input.warn, message, data);
    };

    return {
        reportIssue,
        reportError: (
            event: string,
            message: string,
            error: unknown,
            data: Record<string, unknown> = {}
        ): void => {
            const payload = {
                ...data,
                safeError: summarizeErrorForLog(error),
            };
            safeAppendIssueDiagnostic(input, event, { message, ...payload }, 'reportError');
            logRecoverableRuntimeFallback(message, payload);
        },
    };
}

export function observeRecoverableAsyncFailure(
    promiseOrFactory: Promise<unknown> | (() => Promise<unknown>),
    reportRecoverableAsyncFailure: RecoverableAsyncFailureReporter,
    event: string,
    message: string
): Promise<void> {
    let promise: Promise<unknown>;
    try {
        promise = typeof promiseOrFactory === 'function'
            ? promiseOrFactory()
            : promiseOrFactory;
    } catch (error: unknown) {
        try {
            reportRecoverableAsyncFailure(event, message, error);
        } catch (reporterError) {
            logRecoverableRuntimeFallback(
                '[RecoverableRuntimeReporter] observeRecoverableAsyncFailure failed:',
                summarizeErrorForLog(reporterError)
            );
        }
        return Promise.resolve();
    }

    return promise.then(
        () => undefined,
        (error: unknown) => {
            try {
                reportRecoverableAsyncFailure(event, message, error);
            } catch (reporterError) {
                logRecoverableRuntimeFallback(
                    '[RecoverableRuntimeReporter] observeRecoverableAsyncFailure failed:',
                    summarizeErrorForLog(reporterError)
                );
            }
        }
    );
}

export function safelyReportCleanupFailures(
    cleanupReporter: OrchestratorEventCleanupReporter,
    cleanupFailures: OrchestratorEventCleanupFailure[]
): void {
    if (cleanupFailures.length === 0) {
        return;
    }

    try {
        cleanupReporter(cleanupFailures);
    } catch {
        // Runtime cleanup reporting must never crash binder teardown paths.
    }
}
