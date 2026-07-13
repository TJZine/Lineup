import { redactSensitiveTokens, safeStringifyForLog } from './redact';

export function summarizeErrorForLog(value: unknown): unknown {
    if (typeof value === 'string') {
        return redactSensitiveTokens(value);
    }
    if (value instanceof Error) {
        const maybeWithCode = value as Error & { code?: unknown };
        const code = summarizeErrorCode(maybeWithCode.code);
        return {
            name: value.name,
            ...(code !== undefined ? { code } : {}),
            message: redactSensitiveTokens(value.message),
        };
    }
    if (value && typeof value === 'object') {
        const maybe = value as { name?: unknown; message?: unknown; code?: unknown };
        const code = summarizeErrorCode(maybe.code);
        return {
            ...(typeof maybe.name === 'string' ? { name: maybe.name } : {}),
            ...(code !== undefined ? { code } : {}),
            ...(typeof maybe.message === 'string'
                ? { message: redactSensitiveTokens(maybe.message) }
                : {}),
        };
    }
    return value;
}

function summarizeErrorCode(code: unknown): unknown {
    if (typeof code === 'string') return redactSensitiveTokens(code);
    if (typeof code === 'number') return code;
    if (!code || typeof code !== 'object') return undefined;
    const serialized = safeStringifyForLog(code);
    try {
        return JSON.parse(serialized) as unknown;
    } catch {
        return serialized;
    }
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

export function emitBestEffortWarning(message: string, data?: unknown): void {
    try {
        if (typeof data === 'undefined') {
            globalThis.console?.warn?.call(globalThis.console, message);
            return;
        }
        globalThis.console?.warn?.call(globalThis.console, message, data);
    } catch {
        // Warning delivery is diagnostic-only and must never mask the source failure.
    }
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
