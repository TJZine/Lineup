import type { AppendIssueDiagnostic } from '../../../modules/debug/IssueDiagnosticsStore';
import { summarizeErrorForLog } from '../../../utils/errors';
import type {
    OrchestratorEventCleanupFailure,
    OrchestratorEventCleanupReporter,
} from '../events/OrchestratorEventCleanupReporter';
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

export function createRecoverableRuntimeIssueReporter(
    input: RecoverableRuntimeIssueReporterInput
): RecoverableRuntimeIssueReporter {
    const warningSink = input.warningSink ?? createRecoverableRuntimeWarningSink({ warn: input.warn });
    const appendDiagnostic = (
        event: string,
        data: Record<string, unknown>,
        scope: 'reportIssue' | 'reportError'
    ): void => {
        try {
            input.appendIssueDiagnostic(input.issueId, event, data);
        } catch (error) {
            warningSink.emit({
                message: `[RecoverableRuntimeReporter] ${scope} failed:`,
                data: summarizeErrorForLog(error),
            });
        }
    };

    const reportIssue = (
        event: string,
        message: string,
        data: Record<string, unknown> = {}
    ): void => {
        const payload = { message, ...data };
        appendDiagnostic(event, payload, 'reportIssue');
        warningSink.emit({ message, data });
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
            warningSink.emit({ message, data: payload });
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
    const reportFailure = (error: unknown): void => {
        try {
            reportRecoverableAsyncFailure(event, message, error);
        } catch (reporterError) {
            warningSink.emit({
                message: '[RecoverableRuntimeReporter] observeRecoverableAsyncFailure failed:',
                data: summarizeErrorForLog(reporterError),
            });
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
