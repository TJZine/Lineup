import { TIMING_CONFIG } from '../timing';

describe('TIMING_CONFIG', () => {
    it('keeps timing values positive and ordered for backoff usage', () => {
        expect(TIMING_CONFIG.CALLBACK_TIMEOUT_MS).toBeGreaterThan(0);
        expect(TIMING_CONFIG.SAVE_DEBOUNCE_MS).toBeGreaterThan(0);
        expect(TIMING_CONFIG.NETWORK_CHECK_TIMEOUT_MS).toBeGreaterThan(0);
        expect(TIMING_CONFIG.NETWORK_CHECK_INTERVAL_MS).toBeGreaterThan(TIMING_CONFIG.NETWORK_CHECK_TIMEOUT_MS);
        expect(TIMING_CONFIG.PERSISTENCE_WARNING_MAX_BACKOFF_MS).toBeGreaterThan(
            TIMING_CONFIG.PERSISTENCE_WARNING_BACKOFF_MS
        );
        expect(TIMING_CONFIG.NETWORK_WARNING_BACKOFF_MS).toBeGreaterThan(
            TIMING_CONFIG.NETWORK_CHECK_INTERVAL_MS
        );
    });
});
