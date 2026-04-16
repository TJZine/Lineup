import { summarizeErrorForLog } from '../../../utils/errors';
import { redactSensitiveTokens } from '../../../utils/redact';

type PlexLogMethod = 'warn' | 'error';

type PlexConsoleLogger = {
    warn: (message?: unknown, ...args: unknown[]) => void;
    error: (message?: unknown, ...args: unknown[]) => void;
};

export function createPlexConsoleLogger(): PlexConsoleLogger {
    return {
        warn: (message?: unknown, ...args: unknown[]): void => {
            writePlexConsole('warn', message, ...args);
        },
        error: (message?: unknown, ...args: unknown[]): void => {
            writePlexConsole('error', message, ...args);
        },
    };
}

export function logPlexWarning(message?: unknown, ...args: unknown[]): void {
    writePlexConsole('warn', message, ...args);
}

export function logPlexError(message?: unknown, ...args: unknown[]): void {
    writePlexConsole('error', message, ...args);
}

function writePlexConsole(method: PlexLogMethod, message?: unknown, ...args: unknown[]): void {
    try {
        const sink = globalThis.console[method];
        if (typeof sink !== 'function') {
            return;
        }

        sink.call(
            globalThis.console,
            sanitizePlexLogValue(message),
            ...args.map((arg) => sanitizePlexLogValue(arg))
        );
    } catch {
        // Ignore logging failures.
    }
}

function sanitizePlexLogValue(value: unknown, seen = new WeakSet<object>()): unknown {
    if (typeof value === 'string') {
        return redactSensitiveTokens(value);
    }

    if (value instanceof Error) {
        return summarizeErrorForLog(value);
    }

    if (!value || typeof value !== 'object') {
        return value;
    }

    if (seen.has(value)) {
        return '[Circular]';
    }

    seen.add(value);

    if (Array.isArray(value)) {
        return value.map((entry) => sanitizePlexLogValue(entry, seen));
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
        sanitized[key] = sanitizePlexLogField(key, entry, seen);
    }

    return sanitized;
}

function sanitizePlexLogField(
    key: string,
    value: unknown,
    seen: WeakSet<object>
): unknown {
    if (typeof value === 'string' && key.toLowerCase().includes('token')) {
        return 'REDACTED';
    }

    return sanitizePlexLogValue(value, seen);
}
