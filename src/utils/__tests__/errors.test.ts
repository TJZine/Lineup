import { formatErrorDetailForMessage, isAbortLikeError, summarizeErrorForLog } from '../errors';

describe('summarizeErrorForLog', () => {
    it('redacts string input', () => {
        const summary = summarizeErrorForLog('X-Plex-Token=abc123');

        expect(summary).toContain('X-Plex-Token=REDACTED');
        expect(summary).not.toContain('abc123');
    });

    it('returns redacted Error summaries and preserves code when present', () => {
        const err = new Error('token=abc') as Error & { code?: unknown };
        err.code = 'E_BOOM';

        expect(summarizeErrorForLog(err)).toEqual({
            name: 'Error',
            code: 'E_BOOM',
            message: 'token=REDACTED',
        });
    });

    it('preserves object name/code/message and redacts message', () => {
        expect(
            summarizeErrorForLog({
                name: 'BoomError',
                code: 418,
                message: 'X-Plex-Token=abc123',
            })
        ).toEqual({
            name: 'BoomError',
            code: 418,
            message: 'X-Plex-Token=REDACTED',
        });
    });

    it('preserves Error and plain-object code payloads', () => {
        const err = new Error('boom') as Error & { code?: unknown };
        err.code = 'E_BOOM';

        expect(summarizeErrorForLog(err)).toEqual({
            name: 'Error',
            code: 'E_BOOM',
            message: 'boom',
        });

        expect(summarizeErrorForLog({ name: 'Error', message: 'boom', code: 'E_BOOM' })).toEqual({
            name: 'Error',
            code: 'E_BOOM',
            message: 'boom',
        });
    });

    it('passes through non-object non-string values', () => {
        expect(summarizeErrorForLog(null)).toBeNull();
        expect(summarizeErrorForLog(123)).toBe(123);
    });
});

describe('formatErrorDetailForMessage', () => {
    it('passes through summarized string details', () => {
        expect(formatErrorDetailForMessage('plain failure')).toBe('plain failure');
    });

    it('prefers a summarized message over auxiliary object fields', () => {
        expect(formatErrorDetailForMessage({ message: 'oops', code: 'X', ignored: true })).toBe('oops');
    });

    it('stringifies summarized objects without a message', () => {
        expect(formatErrorDetailForMessage({ code: 'NETWORK_TIMEOUT' }))
            .toBe('{"code":"NETWORK_TIMEOUT"}');
    });

    it('stringifies null fallback details', () => {
        expect(formatErrorDetailForMessage(null)).toBe('null');
    });

    it('stringifies numeric fallback details', () => {
        expect(formatErrorDetailForMessage(123)).toBe('123');
    });
});

describe('isAbortLikeError', () => {
    it('returns true when signal is already aborted', () => {
        const controller = new AbortController();
        controller.abort();

        expect(isAbortLikeError(new Error('boom'), controller.signal)).toBe(true);
    });

    it('returns true for DOMException AbortError when available', () => {
        if (typeof DOMException === 'undefined') {
            expect('DOMException unavailable in this test environment').toBeTruthy();
            return;
        }

        expect(isAbortLikeError(new DOMException('request canceled', 'AbortError'))).toBe(true);
    });

    it('returns true for name-based AbortError objects', () => {
        expect(isAbortLikeError({ name: 'AbortError' })).toBe(true);
    });

    it('returns false for non-abort-like values', () => {
        expect(isAbortLikeError(new Error('boom'))).toBe(false);
        expect(isAbortLikeError({ name: 'DifferentError' })).toBe(false);
        expect(isAbortLikeError('AbortError')).toBe(false);
    });
});
