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

export function createRecoverableRuntimeIssueReporter(
    input: RecoverableRuntimeIssueReporterInput
): RecoverableRuntimeIssueReporter {
    const reportIssue = (
        event: string,
        message: string,
        data: Record<string, unknown> = {}
    ): void => {
        input.appendIssueDiagnostic(input.issueId, event, { message, ...data });
        if (input.warn) {
            input.warn(message, data);
            return;
        }
        console.warn(message, data);
    };

    return {
        reportIssue,
        reportError: (
            event: string,
            message: string,
            error: unknown,
            data: Record<string, unknown> = {}
        ): void => {
            reportIssue(event, message, {
                ...data,
                safeError: summarizeErrorForLog(error),
            });
        },
    };
}

export function observeRecoverableAsyncFailure(
    promise: Promise<unknown>,
    reportRecoverableAsyncFailure: RecoverableAsyncFailureReporter,
    event: string,
    message: string
): Promise<void> {
    return promise.then(
        () => undefined,
        (error: unknown) => {
        reportRecoverableAsyncFailure(event, message, error);
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
