import { TIMING_CONFIG } from '../../config/timing';
import { PersistenceWarningBackoffPolicy } from '../persistenceWarningBackoffPolicy';

describe('PersistenceWarningBackoffPolicy', () => {
    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(1_000);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('throttles warnings until the current backoff expires', () => {
        const policy = new PersistenceWarningBackoffPolicy();

        expect(policy.shouldEmitWarning(false)).toBe(true);
        expect(policy.shouldEmitWarning(false)).toBe(false);

        jest.advanceTimersByTime(TIMING_CONFIG.PERSISTENCE_WARNING_BACKOFF_MS - 1);
        expect(policy.shouldEmitWarning(false)).toBe(false);

        jest.advanceTimersByTime(1);
        expect(policy.shouldEmitWarning(false)).toBe(true);
    });

    it('doubles quota backoff and caps it at the configured maximum', () => {
        const policy = new PersistenceWarningBackoffPolicy();
        let expectedBackoff: number = TIMING_CONFIG.PERSISTENCE_WARNING_BACKOFF_MS;

        for (let attempt = 0; attempt < 8; attempt += 1) {
            expect(policy.shouldEmitWarning(true)).toBe(true);
            expect(policy.shouldEmitWarning(true)).toBe(false);

            jest.advanceTimersByTime(expectedBackoff);
            expectedBackoff = Math.min(
                expectedBackoff * 2,
                TIMING_CONFIG.PERSISTENCE_WARNING_MAX_BACKOFF_MS
            );
        }

        expect(expectedBackoff).toBe(TIMING_CONFIG.PERSISTENCE_WARNING_MAX_BACKOFF_MS);
    });

    it('resets quota backoff without clearing the active warning window', () => {
        const policy = new PersistenceWarningBackoffPolicy();

        expect(policy.shouldEmitWarning(true)).toBe(true);
        jest.advanceTimersByTime(TIMING_CONFIG.PERSISTENCE_WARNING_BACKOFF_MS);
        expect(policy.shouldEmitWarning(true)).toBe(true);

        policy.resetQuotaBackoff();

        expect(policy.shouldEmitWarning(true)).toBe(false);
        jest.advanceTimersByTime(TIMING_CONFIG.PERSISTENCE_WARNING_BACKOFF_MS);
        expect(policy.shouldEmitWarning(true)).toBe(false);
        jest.advanceTimersByTime(TIMING_CONFIG.PERSISTENCE_WARNING_BACKOFF_MS);
        expect(policy.shouldEmitWarning(true)).toBe(true);
    });

    it('resets quota backoff and clears the active warning window', () => {
        const policy = new PersistenceWarningBackoffPolicy();

        expect(policy.shouldEmitWarning(true)).toBe(true);

        policy.resetAll();

        expect(policy.shouldEmitWarning(true)).toBe(true);
    });
});
