import { AppErrorCode } from '../../../types/app-errors';
import type { PlaybackError } from '../types';

describe('player error taxonomy exports', () => {
    it('uses AppErrorCode directly for playback errors', () => {
        const error: PlaybackError = {
            code: AppErrorCode.TRACK_SWITCH_TIMEOUT,
            message: 'test',
            recoverable: true,
            retryCount: 1,
        };

        expect(error.code).toBe(AppErrorCode.TRACK_SWITCH_TIMEOUT);
    });
});
