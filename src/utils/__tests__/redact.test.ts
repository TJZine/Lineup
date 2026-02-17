import { redactSensitiveTokens, safeStringifyForLog } from '../redact';

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
