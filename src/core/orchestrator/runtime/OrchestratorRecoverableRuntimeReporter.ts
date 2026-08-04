import type { AppendIssueDiagnostic } from '../../../modules/debug/IssueDiagnosticsStore';
import { summarizeErrorForLog } from '../../../utils/errors';
import type {
    OrchestratorEventCleanupFailure,
    OrchestratorEventCleanupReporter,
} from '../events/OrchestratorEventCleanupReporter';
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

function emitWarning(
    message: string,
    data: unknown,
    warn?: RecoverableRuntimeIssueReporterInput['warn']
): void {
    try {
        if (warn) {
            warn(message, data);
        } else {
            globalThis.console?.warn?.call(globalThis.console, message, data);
        }
    } catch (error) {
        if (warn) {
            try {
                globalThis.console?.warn?.call(
                    globalThis.console,
                    '[RecoverableRuntimeWarning] injected warn failed:',
                    {
                        warning: { message, data },
                        error: summarizeErrorForLog(error),
                    }
                );
            } catch {
                // Warning delivery is best-effort.
            }
        }
    }
}

export function createRecoverableRuntimeIssueReporter(
    input: RecoverableRuntimeIssueReporterInput
): RecoverableRuntimeIssueReporter {
    const appendDiagnostic = (
        event: string,
        data: Record<string, unknown>,
        scope: 'reportIssue' | 'reportError'
    ): void => {
        try {
            input.appendIssueDiagnostic(input.issueId, event, data);
        } catch (error) {
            emitWarning(
                `[RecoverableRuntimeReporter] ${scope} failed:`,
                summarizeErrorForLog(error),
                input.warn
            );
        }
    };

    const reportIssue = (
        event: string,
        message: string,
        data: Record<string, unknown> = {}
    ): void => {
        const payload = { message, ...data };
        appendDiagnostic(event, payload, 'reportIssue');
        emitWarning(message, data, input.warn);
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
            appendDiagnostic(event, { message, ...payload }, 'reportError');
            emitWarning(message, payload, input.warn);
        },
    };
}

export function createDefaultRecoverableRuntimeIssueReporter(
    issueId: string,
    appendIssueDiagnostic: AppendIssueDiagnostic
): RecoverableRuntimeIssueReporter {
    return createRecoverableRuntimeIssueReporter({
        issueId,
        appendIssueDiagnostic,
    });
}

export function observeRecoverableAsyncFailure(
    promiseOrFactory: Promise<unknown> | (() => Promise<unknown>),
    reportRecoverableAsyncFailure: RecoverableAsyncFailureReporter,
    event: string,
    message: string,
    warn?: RecoverableRuntimeIssueReporterInput['warn']
): Promise<void> {
    const reportFailure = (error: unknown): void => {
        try {
            reportRecoverableAsyncFailure(event, message, error);
        } catch (reporterError) {
            emitWarning(
                '[RecoverableRuntimeReporter] observeRecoverableAsyncFailure failed:',
                summarizeErrorForLog(reporterError),
                warn
            );
        }
    };
    let promise: Promise<unknown>;
    try {
        promise = typeof promiseOrFactory === 'function'
            ? promiseOrFactory()
            : promiseOrFactory;
    } catch (error: unknown) {
        reportFailure(error);
        return Promise.resolve();
    }

    return promise.then(
        () => undefined,
        (error: unknown) => {
            reportFailure(error);
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
