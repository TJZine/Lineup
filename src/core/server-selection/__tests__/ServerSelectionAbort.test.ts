import { isSelectionAbortError, throwIfSelectionAborted } from '../ServerSelectionAbort';

describe('ServerSelectionAbort', () => {
    it('uses a stable fallback abort reason for legacy aborted signals', () => {
        const signal = { aborted: true } as AbortSignal;
        let reason: unknown;

        try {
            throwIfSelectionAborted(signal);
        } catch (error) {
            reason = error;
        }

        expect(reason).toBeDefined();
        expect(isSelectionAbortError(reason, signal)).toBe(true);
    });

    it('preserves explicit null abort reasons', () => {
        const signal = { aborted: true, reason: null } as AbortSignal;
        let thrown: unknown = 'not thrown';

        try {
            throwIfSelectionAborted(signal);
        } catch (error) {
            thrown = error;
        }
        expect(thrown).toBeNull();
        expect(isSelectionAbortError(null, signal)).toBe(true);
    });
});
