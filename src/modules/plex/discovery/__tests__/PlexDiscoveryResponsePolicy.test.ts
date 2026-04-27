import { PLEX_DISCOVERY_CONSTANTS } from '../constants';
import { AppErrorCode } from '../../../lifecycle/types';
import { PlexApiError } from '../../auth/plexAuthTransport';
import {
    getDiscoveryRateLimitDelayMs,
    handleResponseError,
    redactDiscoveryUrl,
} from '../PlexDiscoveryResponsePolicy';

const createResponse = (retryAfter: string | null): Response => ({
    headers: {
        get: (name: string): string | null => (
            name.toLowerCase() === 'retry-after' ? retryAfter : null
        ),
    },
} as Response);

describe('getDiscoveryRateLimitDelayMs', () => {
    let dateNowSpy: jest.SpyInstance<number, []>;

    beforeEach(() => {
        dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2030-01-01T00:00:00.000Z'));
    });

    afterEach(() => {
        dateNowSpy.mockRestore();
    });

    it('uses the default delay when Retry-After is missing, zero, or negative', () => {
        for (const retryAfter of [null, '0', '-1']) {
            expect(getDiscoveryRateLimitDelayMs(createResponse(retryAfter))).toBe(
                PLEX_DISCOVERY_CONSTANTS.RATE_LIMIT_DEFAULT_DELAY_MS
            );
        }
    });

    it('honors fractional Retry-After seconds', () => {
        expect(getDiscoveryRateLimitDelayMs(createResponse('0.5'))).toBe(500);
    });

    it('honors HTTP-date Retry-After values', () => {
        const retryAfter = new Date(Date.now() + 4500).toUTCString();

        expect(getDiscoveryRateLimitDelayMs(createResponse(retryAfter))).toBe(4000);
    });

    it('caps excessive Retry-After seconds', () => {
        expect(getDiscoveryRateLimitDelayMs(createResponse('999999'))).toBe(
            PLEX_DISCOVERY_CONSTANTS.RATE_LIMIT_MAX_DELAY_MS
        );
    });

    it('caps excessive HTTP-date Retry-After values', () => {
        const retryAfter = new Date(Date.now() + PLEX_DISCOVERY_CONSTANTS.RATE_LIMIT_MAX_DELAY_MS + 5000)
            .toUTCString();

        expect(getDiscoveryRateLimitDelayMs(createResponse(retryAfter))).toBe(
            PLEX_DISCOVERY_CONSTANTS.RATE_LIMIT_MAX_DELAY_MS
        );
    });

    it('uses the default delay for invalid Retry-After values', () => {
        expect(getDiscoveryRateLimitDelayMs(createResponse('not-a-number'))).toBe(
            PLEX_DISCOVERY_CONSTANTS.RATE_LIMIT_DEFAULT_DELAY_MS
        );
    });
});

describe('handleResponseError', () => {
    it.each([
        [401, AppErrorCode.AUTH_REQUIRED, false],
        [403, AppErrorCode.AUTH_INVALID, false],
        [429, AppErrorCode.RATE_LIMITED, true],
        [500, AppErrorCode.SERVER_UNREACHABLE, true],
        [503, AppErrorCode.SERVER_UNREACHABLE, true],
        [404, AppErrorCode.RESOURCE_NOT_FOUND, false],
    ])(
        'maps status %i to %s with retryable=%s',
        (status: number, expectedCode: AppErrorCode, expectedRetryable: boolean) => {
            let thrown: unknown;
            try {
                (handleResponseError as (response: Response) => void)({ status } as Response);
            } catch (error) {
                thrown = error;
            }

            expect(thrown).toBeInstanceOf(PlexApiError);
            expect(thrown).toMatchObject({
                code: expectedCode,
                retryable: expectedRetryable,
                httpStatus: status,
            });
        }
    );
});

describe('redactDiscoveryUrl', () => {
    it('returns an empty string when no URL is available', () => {
        expect(redactDiscoveryUrl(undefined)).toBe('');
    });
});
