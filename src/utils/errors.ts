import { redactSensitiveTokens, safeStringifyForLog } from './redact';

export function summarizeErrorForLog(value: unknown): unknown {
    if (typeof value === 'string') {
        return redactSensitiveTokens(value);
    }
    if (value instanceof Error) {
        const maybeWithCode = value as Error & { code?: unknown };
        return {
            name: value.name,
            ...('code' in maybeWithCode ? { code: maybeWithCode.code } : {}),
            message: redactSensitiveTokens(value.message),
        };
    }
    if (value && typeof value === 'object') {
        const maybe = value as { name?: unknown; message?: unknown; code?: unknown };
        return {
            ...(typeof maybe.name === 'string' ? { name: maybe.name } : {}),
            ...('code' in maybe ? { code: maybe.code } : {}),
            ...(typeof maybe.message === 'string'
                ? { message: redactSensitiveTokens(maybe.message) }
                : {}),
        };
    }
    return value;
}

export function formatErrorDetailForMessage(detail: unknown): string {
    const summary = summarizeErrorForLog(detail);
    if (typeof summary === 'string') {
        return summary;
    }
    if (summary && typeof summary === 'object') {
        if ('message' in summary && typeof summary.message === 'string') {
            return summary.message;
        }
        return safeStringifyForLog(summary);
    }
    return String(summary);
}

export function isAbortLikeError(error: unknown, signal?: AbortSignal): boolean {
    if (signal?.aborted) return true;
    if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') {
        return true;
    }
    if (error && typeof error === 'object' && 'name' in error) {
        const named = error as { name?: unknown };
        if (named.name === 'AbortError') return true;
    }
    return false;
}
