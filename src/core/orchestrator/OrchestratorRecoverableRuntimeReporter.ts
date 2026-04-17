import type { AppendIssueDiagnostic } from '../../modules/debug/IssueDiagnosticsStore';
import { summarizeErrorForLog } from '../../utils/errors';
import type {
    OrchestratorEventCleanupFailure,
    OrchestratorEventCleanupReporter,
} from './OrchestratorEventCleanupReporter';
import type { RecoverableAsyncFailureReporter } from './OrchestratorRuntimeSeams';
import {
    createRecoverableRuntimeWarningSink,
    type RecoverableRuntimeWarningSink,
} from './OrchestratorRecoverableRuntimeWarnings';

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
    warningSink?: RecoverableRuntimeWarningSink;
}

function emitRecoverableRuntimeWarning(
    warningSink: RecoverableRuntimeWarningSink,
    message: string,
    data: unknown
): void {
    warningSink.emit({ message, data });
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
        emitRecoverableRuntimeWarning(
            input.warningSink ?? createRecoverableRuntimeWarningSink({ warn: input.warn }),
            `[RecoverableRuntimeReporter] ${scope} failed:`,
            summarizeErrorForLog(error)
        );
    }
}

function safeWarn(
    warningSink: RecoverableRuntimeWarningSink,
    message: string,
    data: Record<string, unknown>
): void {
    emitRecoverableRuntimeWarning(warningSink, message, data);
}

export function createRecoverableRuntimeIssueReporter(
    input: RecoverableRuntimeIssueReporterInput
): RecoverableRuntimeIssueReporter {
    const warningSink = input.warningSink ?? createRecoverableRuntimeWarningSink({ warn: input.warn });
    const reportIssue = (
        event: string,
        message: string,
        data: Record<string, unknown> = {}
    ): void => {
        const payload = { message, ...data };
        safeAppendIssueDiagnostic(input, event, payload, 'reportIssue');
        safeWarn(warningSink, message, data);
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
            emitRecoverableRuntimeWarning(warningSink, message, payload);
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
        warningSink: createRecoverableRuntimeWarningSink(),
    });
}

export function observeRecoverableAsyncFailure(
    promiseOrFactory: Promise<unknown> | (() => Promise<unknown>),
    reportRecoverableAsyncFailure: RecoverableAsyncFailureReporter,
    event: string,
    message: string,
    warn?: RecoverableRuntimeIssueReporterInput['warn']
): Promise<void> {
    const warningSink = createRecoverableRuntimeWarningSink({ warn });
    let promise: Promise<unknown>;
    try {
        promise = typeof promiseOrFactory === 'function'
            ? promiseOrFactory()
            : promiseOrFactory;
    } catch (error: unknown) {
        try {
            reportRecoverableAsyncFailure(event, message, error);
        } catch (reporterError) {
            emitRecoverableRuntimeWarning(
                warningSink,
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
                emitRecoverableRuntimeWarning(
                    warningSink,
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
