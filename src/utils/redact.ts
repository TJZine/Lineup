/**
 * @fileoverview Redaction helpers for safe logging.
 * @module utils/redact
 * @version 1.0.0
 */

/**
 * Redact common sensitive tokens in a string.
 *
 * Intended for logging only. This does not guarantee complete sanitization for all cases.
 */
export function redactSensitiveTokens(value: string): string {
    return value
        // JSON-ish forms
        .replace(/"X-Plex-Token"\s*:\s*"[^"]*"/gi, '"X-Plex-Token":"REDACTED"')
        .replace(/'X-Plex-Token'\s*:\s*'[^']*'/gi, "'X-Plex-Token':'REDACTED'")
        .replace(/"access_token"\s*:\s*"[^"]*"/gi, '"access_token":"REDACTED"')
        .replace(/'access_token'\s*:\s*'[^']*'/gi, "'access_token':'REDACTED'")
        .replace(/"token"\s*:\s*"[^"]*"/gi, '"token":"REDACTED"')
        .replace(/'token'\s*:\s*'[^']*'/gi, "'token':'REDACTED'")
        // Header-ish forms
        .replace(/\bX-Plex-Token\s*:\s*[^\s,;"'`{}]+/gi, 'X-Plex-Token: REDACTED')
        .replace(/\baccess_token\s*:\s*[^\s,;"'`{}]+/gi, 'access_token: REDACTED')
        .replace(/(^|[\s,{\["'`])token\s*:\s*[^\s,;"'`{}]+/gi, '$1token: REDACTED')
        // Query-param-ish forms (avoid matching inside X-Plex-Token)
        .replace(/X-Plex-Token=[^&\s"'`{}]*/gi, 'X-Plex-Token=REDACTED')
        .replace(/access_token=[^&\s"'`{}]*/gi, 'access_token=REDACTED')
        .replace(/(^|[?&\s])token=[^&\s"'`{}]*/gi, '$1token=REDACTED');
}

/**
 * Best-effort JSON stringify that redacts sensitive tokens.
 * Intended for logging only.
 */
export function safeStringifyForLog(value: unknown): string {
    if (typeof value === 'string') {
        return redactSensitiveTokens(value);
    }
    if (value instanceof Error) {
        return redactSensitiveTokens(JSON.stringify({ name: value.name, message: value.message }));
    }
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
        return redactSensitiveTokens(String(value));
    }
    try {
        const stringified = JSON.stringify(value);
        if (stringified === undefined) {
            return redactSensitiveTokens(String(value));
        }
        return redactSensitiveTokens(stringified);
    } catch (error) {
        try {
            return redactSensitiveTokens(JSON.stringify({ unserializable: true, error: String(error) }));
        } catch {
            return '[Unserializable]';
        }
    }
}
