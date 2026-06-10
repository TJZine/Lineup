import { readAbortSignalReason, readOptionalAbortSignalReason } from '../abortSignalReason';

describe('abortSignalReason', () => {
    it('returns a stable fallback reason when a legacy signal has no reason', () => {
        const signal = { aborted: true } as AbortSignal;

        const first = readAbortSignalReason(signal);
        const second = readAbortSignalReason(signal);

        expect(first).toBe(second);
        expect(first).toMatchObject({ name: 'AbortError' });
    });

    it('preserves explicit null reasons', () => {
        const signal = { aborted: true, reason: null } as AbortSignal;

        expect(readAbortSignalReason(signal)).toBeNull();
    });

    it('returns undefined for missing optional signals', () => {
        expect(readOptionalAbortSignalReason(null)).toBeUndefined();
        expect(readOptionalAbortSignalReason(undefined)).toBeUndefined();
    });
});
