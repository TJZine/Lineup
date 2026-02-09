/**
 * @fileoverview Shared error helpers for safe logging and control-flow checks.
 * @module utils/errors
 * @version 1.0.0
 */

import { redactSensitiveTokens } from './redact';

export function summarizeErrorForLog(value: unknown): unknown {
    if (typeof value === 'string') {
        return redactSensitiveTokens(value);
    }
    if (value instanceof Error) {
        return {
            name: value.name,
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

