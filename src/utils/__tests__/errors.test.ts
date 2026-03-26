import { isAbortLikeError, summarizeErrorForLog } from '../errors';

describe('summarizeErrorForLog', () => {
    it('redacts string input', () => {
        const summary = summarizeErrorForLog('X-Plex-Token=abc123');

        expect(summary).toContain('X-Plex-Token=REDACTED');
        expect(summary).not.toContain('abc123');
    });

    it('returns redacted Error summaries without code', () => {
        const err = new Error('token=abc') as Error & { code?: unknown };
        err.code = 'E_BOOM';

        expect(summarizeErrorForLog(err)).toEqual({
            name: 'Error',
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

    it('distinguishes Error instances from plain-object error payloads with code', () => {
        const err = new Error('boom') as Error & { code?: unknown };
        err.code = 'E_BOOM';

        expect(summarizeErrorForLog(err)).toEqual({
            name: 'Error',
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
