import { PLEX_DISCOVERY_CONSTANTS } from '../constants';
import { getDiscoveryRateLimitDelayMs } from '../PlexDiscoveryResponsePolicy';

const createResponse = (retryAfter: string | null): Response => ({
    headers: {
        get: (name: string): string | null => (
            name.toLowerCase() === 'retry-after' ? retryAfter : null
        ),
    },
} as Response);

describe('getDiscoveryRateLimitDelayMs', () => {
    it('honors fractional Retry-After seconds', () => {
        expect(getDiscoveryRateLimitDelayMs(createResponse('0.5'))).toBe(500);
    });

    it('caps excessive Retry-After seconds', () => {
        expect(getDiscoveryRateLimitDelayMs(createResponse('999999'))).toBe(
            PLEX_DISCOVERY_CONSTANTS.RATE_LIMIT_MAX_DELAY_MS
        );
    });

    it('uses the default delay for invalid Retry-After values', () => {
        expect(getDiscoveryRateLimitDelayMs(createResponse('not-a-number'))).toBe(
            PLEX_DISCOVERY_CONSTANTS.RATE_LIMIT_DEFAULT_DELAY_MS
        );
    });
});
