import { AppErrorCode } from '../../../../types/app-errors';
import { mapMediaErrorCodeToPlaybackError } from '../../core/ErrorHandler';

describe('player error taxonomy exports', () => {
    it('maps media error codes onto the shared app error taxonomy', () => {
        const error = mapMediaErrorCodeToPlaybackError(2, 0, 3);

        expect(error.code).toBe(AppErrorCode.NETWORK_TIMEOUT);
        expect(error.recoverable).toBe(true);
    });
});
