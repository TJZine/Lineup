import { redactSensitiveTokens, redactUrlForLog, safeStringifyForLog, sanitizeDiagnosticText } from '../redact';

describe('redactSensitiveTokens', () => {
    it('redacts Plex token query params', () => {
        expect(redactSensitiveTokens('http://x?X-Plex-Token=abc123')).toBe('http://x?X-Plex-Token=REDACTED');
    });

    it('redacts access_token and token query params', () => {
        expect(redactSensitiveTokens('http://x?access_token=secret')).toBe('http://x?access_token=REDACTED');
        expect(redactSensitiveTokens('http://x?token=secret')).toBe('http://x?token=REDACTED');
    });

    it('redacts Plex token header-style strings', () => {
        expect(redactSensitiveTokens('X-Plex-Token: abc123')).toBe('X-Plex-Token: REDACTED');
        expect(redactSensitiveTokens('x-plex-token=abc123')).toBe('X-Plex-Token=REDACTED');
    });

    it('redacts Plex token in JSON-ish strings', () => {
        expect(redactSensitiveTokens('{"X-Plex-Token":"abc123"}')).toBe('{"X-Plex-Token":"REDACTED"}');
        expect(redactSensitiveTokens("{'X-Plex-Token':'abc123'}")).toBe("{'X-Plex-Token':'REDACTED'}");
        expect(redactSensitiveTokens("'access_token':'secret'")).toBe("'access_token':'REDACTED'");
        expect(redactSensitiveTokens("'token':'secret'")).toBe("'token':'REDACTED'");
    });

    it('redacts token-like substrings inside JSON string values without breaking structure', () => {
        expect(redactSensitiveTokens('{"url":"http://x?X-Plex-Token=abc123"}')).toBe(
            '{"url":"http://x?X-Plex-Token=REDACTED"}'
        );
        expect(redactSensitiveTokens('{"h":"X-Plex-Token: abc123"}')).toBe('{"h":"X-Plex-Token: REDACTED"}');
        expect(redactSensitiveTokens('{"h":"access_token: abc123"}')).toBe('{"h":"access_token: REDACTED"}');
        expect(redactSensitiveTokens('{"h":"token: abc123"}')).toBe('{"h":"token: REDACTED"}');
    });

    it('redacts standalone header-style token forms', () => {
        expect(redactSensitiveTokens('token: abc123')).toBe('token: REDACTED');
    });

    it('redacts bearer credentials in header and JSON-ish forms', () => {
        expect(redactSensitiveTokens('Authorization: Bearer secret')).toBe(
            'Authorization: Bearer REDACTED'
        );
        expect(redactSensitiveTokens('Authorization: Bearer "secret"')).toBe(
            'Authorization: Bearer REDACTED'
        );
        expect(redactSensitiveTokens('{"Authorization":"Bearer secret"}')).toBe(
            '{"Authorization":"Bearer REDACTED"}'
        );
        expect(redactSensitiveTokens("{'Authorization':'Bearer secret'}")).toBe(
            "{'Authorization':'Bearer REDACTED'}"
        );
    });
});

describe('safeStringifyForLog', () => {
    it('handles undefined by returning a string', () => {
        expect(safeStringifyForLog(undefined)).toBe('undefined');
    });

    it('redacts a plain string input', () => {
        expect(safeStringifyForLog('http://x?token=abc123')).toBe('http://x?token=REDACTED');
    });

    it('stringifies and redacts an Error instance', () => {
        expect(safeStringifyForLog(new Error('http://x?X-Plex-Token=abc123'))).toBe(
            '{"name":"Error","message":"http://x?X-Plex-Token=REDACTED"}'
        );
    });

    it('optionally includes stack for Error instances', () => {
        const error = new Error('boom');
        error.stack = 'STACK X-Plex-Token=abc123';
        expect(safeStringifyForLog(error, { includeStack: true })).toBe(
            '{"name":"Error","message":"boom","stack":"STACK X-Plex-Token=REDACTED"}'
        );
    });

    it('omits stack when includeStack is false', () => {
        const error = new Error('boom');
        error.stack = 'STACK X-Plex-Token=abc123';
        expect(safeStringifyForLog(error, { includeStack: false })).toBe(
            '{"name":"Error","message":"boom"}'
        );
    });

    it('stringifies and redacts token-like strings', () => {
        expect(safeStringifyForLog({ url: 'http://x?X-Plex-Token=abc123' })).toBe(
            '{"url":"http://x?X-Plex-Token=REDACTED"}'
        );
    });

    it('handles circular structures without throwing', () => {
        const a: Record<string, unknown> = {};
        a.self = a;
        const out = safeStringifyForLog(a);
        expect(typeof out).toBe('string');
        expect(out).toContain('"unserializable":true');
    });
});

describe('sanitizeDiagnosticText', () => {
    it('redacts tokens, absolute URLs, file URLs, and local filesystem paths', () => {
        const text = [
            'decision http://10.0.0.2:32400/video/:/transcode?X-Plex-Token=secret',
            'X-Plex-Token: secret',
            'Authorization: Bearer bearer-secret',
            'file:///Users/tristan/subtitles/movie.srt',
            'file:///Users/tristan/subtitles/Movie (2020)/English [SDH].srt',
            '/Users/tristan/Library/Application Support/Plex Media Server/media.srt',
            '/mnt/media/Movies/Example.srt',
            '/media/plex/Movie (2020)/subs/English [SDH].srt',
            '/data/TV/Episode [1080p].srt',
            '/volume1/video/Movies/Example.srt',
            '\\\\NAS\\Media\\Movie (2020)\\English [SDH].srt',
        ].join('\n');

        const sanitized = sanitizeDiagnosticText(text, { maxLength: null });

        expect(sanitized).toContain('[REDACTED_URL]');
        expect(sanitized).toContain('[REDACTED_FILE_URL]');
        expect(sanitized).toContain('[REDACTED_PATH]');
        expect(sanitized).toContain('X-Plex-Token: REDACTED');
        expect(sanitized).toContain('Authorization: Bearer REDACTED');
        expect(sanitized).not.toContain('10.0.0.2');
        expect(sanitized).not.toContain('secret');
        expect(sanitized).not.toContain('file:///');
        expect(sanitized).not.toContain('/Users/tristan');
        expect(sanitized).not.toContain('English [SDH].srt');
        expect(sanitized).not.toContain('/mnt/media');
        expect(sanitized).not.toContain('(2020)');
        expect(sanitized).not.toContain('[1080p]');
        expect(sanitized).not.toContain('[SDH]');
        expect(sanitized).not.toContain('/volume1/video');
        expect(sanitized).not.toContain('\\\\NAS');
    });

    it('caps long diagnostic text after redaction', () => {
        const sanitized = sanitizeDiagnosticText(`prefix ${'x'.repeat(100)}`, { maxLength: 24 });

        expect(sanitized).toHaveLength(24);
        expect(sanitized.endsWith('...')).toBe(true);
    });
});

describe('redactUrlForLog', () => {
    it('removes URL userinfo and redacts sensitive query params (case-insensitive)', () => {
        const url = 'https://user:pass@example.com/path?x-plex-token=abc123&ok=1';
        expect(redactUrlForLog(url)).toBe('https://example.com/path?x-plex-token=REDACTED&ok=1');
    });

    it('redacts sensitive tokens in URL fragments', () => {
        const url = 'https://example.com/path#access_token=abc123';
        expect(redactUrlForLog(url)).toBe('https://example.com/path#REDACTED_FRAGMENT');
    });

    it('handles malformed URLs by falling back to string redaction', () => {
        expect(redactUrlForLog('not a url?X-Plex-Token=abc123')).toBe('not a url?X-Plex-Token=REDACTED');
    });
});
