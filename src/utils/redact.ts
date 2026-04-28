
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
export function safeStringifyForLog(
    value: unknown,
    options?: { includeStack?: boolean }
): string {
    if (typeof value === 'string') {
        return redactSensitiveTokens(value);
    }
    if (value instanceof Error) {
        const payload: { name: string; message: string; stack?: string } = {
            name: value.name,
            message: value.message,
        };
        if (options?.includeStack && typeof value.stack === 'string') {
            payload.stack = value.stack;
        }
        return redactSensitiveTokens(JSON.stringify(payload));
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
        // Deliberate double try/catch:
        // 1) Best effort: stringify an "unserializable" sentinel and redact it (so redactSensitiveTokens always sees a string).
        // 2) Guardrail: even `String(error)` / `toString()` can throw for hand-crafted exceptions, so the inner catch returns
        //    the final fallback string.
        try {
            return redactSensitiveTokens(JSON.stringify({ unserializable: true, error: String(error) }));
        } catch {
            return '[Unserializable]';
        }
    }
}

/**
 * Redact sensitive tokens from a URL-like string for safe logging.
 *
 * - Removes basic-auth userinfo (username/password).
 * - Redacts token query params (case-insensitive) for common Plex patterns.
 * - Redacts fragments when they appear to contain sensitive tokens.
 *
 * Intended for logging only.
 */
export function redactUrlForLog(url: string): string {
    const isSensitiveKey = (key: string): boolean => {
        const k = key.toLowerCase();
        return k === 'x-plex-token' || k === 'access_token' || k === 'token';
    };

    try {
        const parsed = new URL(url);
        parsed.username = '';
        parsed.password = '';

        for (const key of [...parsed.searchParams.keys()]) {
            if (isSensitiveKey(key)) {
                parsed.searchParams.set(key, 'REDACTED');
            }
        }

        if (parsed.hash) {
            const hashLower = parsed.hash.toLowerCase();
            if (
                hashLower.includes('x-plex-token=') ||
                hashLower.includes('access_token=') ||
                hashLower.includes('token=')
            ) {
                parsed.hash = '#REDACTED_FRAGMENT';
            }
        }

        return parsed.toString();
    } catch {
        const withoutUserinfo = url.replace(/\/\/[^@/]*@/g, '//');
        const redacted = redactSensitiveTokens(withoutUserinfo);
        if (/#.*(x-plex-token|access_token|token)=/i.test(redacted)) {
            return redacted.replace(/#.*$/i, '#REDACTED_FRAGMENT');
        }
        return redacted;
    }
}
