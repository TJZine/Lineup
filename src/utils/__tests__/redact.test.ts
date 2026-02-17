import { redactSensitiveTokens, safeStringifyForLog } from '../redact';

describe('redactSensitiveTokens', () => {
    it('redacts Plex token query params', () => {
        expect(redactSensitiveTokens('http://x?X-Plex-Token=abc123')).toBe('http://x?X-Plex-Token=REDACTED');
    });

    it('redacts Plex token header-style strings', () => {
        expect(redactSensitiveTokens('X-Plex-Token: abc123')).toBe('X-Plex-Token: REDACTED');
        expect(redactSensitiveTokens('x-plex-token=abc123')).toBe('X-Plex-Token=REDACTED');
    });

    it('redacts Plex token in JSON-ish strings', () => {
        expect(redactSensitiveTokens('{"X-Plex-Token":"abc123"}')).toBe('{"X-Plex-Token":"REDACTED"}');
        expect(redactSensitiveTokens("{'X-Plex-Token':'abc123'}")).toBe("{'X-Plex-Token':'REDACTED'}");
    });
});

describe('safeStringifyForLog', () => {
    it('stringifies and redacts token-like strings', () => {
        expect(safeStringifyForLog({ url: 'http://x?X-Plex-Token=abc123' })).toContain('X-Plex-Token=REDACTED');
    });

    it('handles circular structures without throwing', () => {
        const a: Record<string, unknown> = {};
        a.self = a;
        expect(() => safeStringifyForLog(a)).not.toThrow();
    });
});
