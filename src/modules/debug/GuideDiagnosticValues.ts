import { isAppErrorCode, type AppErrorCode } from '../../types/app-errors';

const ERROR_CLASSES = new Set([
    'Error', 'TypeError', 'RangeError', 'AbortError', 'TimeoutError',
    'ChannelError', 'PlexLibraryError', 'PlexLibraryScopeSupersededError',
]);
const CANCELLATION_REASONS = new Set([
    'request-replaced', 'newer-session', 'caller-abort', 'operation-superseded',
    'guide-closed', 'settings-changed', 'library-filter-changed', 'shutdown',
    'no-visible-channels', 'runtime-invalidated', 'clear-schedule-caches',
]);

export interface GuideFailureDiagnostic {
    thrownType: string;
    errorClass: string | null;
    errorCode: AppErrorCode | null;
    httpStatus: number | null;
    cancellationReason: string | null;
}

/** Only allowlisted scalar values cross this diagnostic privacy boundary. */
export function describeGuideFailure(error: unknown): GuideFailureDiagnostic {
    let errorClass: string | null = null;
    let errorCode: AppErrorCode | null = null;
    let httpStatus: number | null = null;
    try {
        if (error !== null && typeof error === 'object') {
            const name = 'name' in error ? error.name : null;
            const code = 'code' in error ? error.code : null;
            const status = 'httpStatus' in error ? error.httpStatus : null;
            if (typeof name === 'string' && ERROR_CLASSES.has(name)) {
                errorClass = name;
            }
            if (isAppErrorCode(code)) errorCode = code;
            if (typeof status === 'number'
                && Number.isInteger(status) && status >= 100 && status <= 599) {
                httpStatus = status;
            }
        }
    } catch {
        // A throwable with accessors must not turn diagnostic collection into a failure.
    }
    return {
        thrownType: error === null ? 'null' : typeof error,
        errorClass,
        errorCode,
        httpStatus,
        cancellationReason: typeof error === 'string' && CANCELLATION_REASONS.has(error) ? error : null,
    };
}

export function guideDiagnosticClock(): { timeOrigin: number; monotonicMs: number } {
    return { timeOrigin: performance.timeOrigin, monotonicMs: performance.now() };
}
