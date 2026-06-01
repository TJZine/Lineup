import {
    isStartupAbortError,
    readStartupAbortReason,
    throwIfStartupAborted,
} from '../InitializationAbort';

describe('InitializationAbort', () => {
    it('uses a stable fallback abort reason for legacy aborted signals', () => {
        const signal = { aborted: true } as AbortSignal;

        const reason = readStartupAbortReason(signal);

        expect(readStartupAbortReason(signal)).toBe(reason);
        expect(() => throwIfStartupAborted(signal)).toThrow(reason as Error);
        expect(isStartupAbortError(reason, signal)).toBe(true);
    });

    it('preserves explicit null abort reasons', () => {
        const signal = { aborted: true, reason: null } as AbortSignal;
        let thrown: unknown = 'not thrown';

        expect(readStartupAbortReason(signal)).toBeNull();
        try {
            throwIfStartupAborted(signal);
        } catch (error) {
            thrown = error;
        }
        expect(thrown).toBeNull();
        expect(isStartupAbortError(null, signal)).toBe(true);
    });
});
