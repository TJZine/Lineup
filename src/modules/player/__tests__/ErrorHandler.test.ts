/**
 * @jest-environment jsdom
 */

import { mapMediaErrorCodeToPlaybackError } from '../ErrorHandler';
import { PlayerErrorCode } from '../types';

describe('mapMediaErrorCodeToPlaybackError', () => {
    it('maps MEDIA_ERR_NETWORK (2) to NETWORK_TIMEOUT and is recoverable until retries exhausted', () => {
        const e0 = mapMediaErrorCodeToPlaybackError(2, 0, 3);
        const e2 = mapMediaErrorCodeToPlaybackError(2, 2, 3);
        const e3 = mapMediaErrorCodeToPlaybackError(2, 3, 3);

        expect(e0.code).toBe(PlayerErrorCode.NETWORK_TIMEOUT);
        expect(e0.recoverable).toBe(true);
        expect(e0.retryAfterMs).toBe(1000);

        expect(e2.code).toBe(PlayerErrorCode.NETWORK_TIMEOUT);
        expect(e2.recoverable).toBe(true);
        expect(e2.retryAfterMs).toBe(4000);

        expect(e3.code).toBe(PlayerErrorCode.NETWORK_TIMEOUT);
        expect(e3.recoverable).toBe(false);
        expect(e3.retryCount).toBe(3);
    });

    it('caps retryAfterMs to a reasonable maximum', () => {
        const retryCount = 10;
        const error = mapMediaErrorCodeToPlaybackError(2, retryCount, retryCount + 1);

        expect(error.recoverable).toBe(true);
        expect(error.retryAfterMs).toBe(30000);
    });

    it('maps MEDIA_ERR_DECODE (3) to PLAYBACK_DECODE_ERROR and recoverable=false', () => {
        const error = mapMediaErrorCodeToPlaybackError(3, 0, 3);

        expect(error.code).toBe(PlayerErrorCode.PLAYBACK_DECODE_ERROR);
        expect(error.recoverable).toBe(false);
    });

    it('maps MEDIA_ERR_SRC_NOT_SUPPORTED (4) to PLAYBACK_FORMAT_UNSUPPORTED', () => {
        const error = mapMediaErrorCodeToPlaybackError(4, 0, 3);

        expect(error.code).toBe(PlayerErrorCode.PLAYBACK_FORMAT_UNSUPPORTED);
        expect(error.recoverable).toBe(false);
    });

    it('maps unknown codes to UNKNOWN', () => {
        const error = mapMediaErrorCodeToPlaybackError(999, 0, 3);

        expect(error.code).toBe(PlayerErrorCode.UNKNOWN);
        expect(error.recoverable).toBe(false);
    });
});
