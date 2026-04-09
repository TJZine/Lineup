import { AppErrorCode } from '../../../types/app-errors';
import { PlayerErrorCode, mapPlayerErrorCodeToAppErrorCode } from '../types';

describe('player error taxonomy exports', () => {
    it('reuses canonical AppErrorCode values', () => {
        expect(PlayerErrorCode.NETWORK_TIMEOUT).toBe(AppErrorCode.NETWORK_TIMEOUT);
        expect(PlayerErrorCode.TRACK_SWITCH_FAILED).toBe(AppErrorCode.TRACK_SWITCH_FAILED);
        expect(PlayerErrorCode.UNKNOWN).toBe(AppErrorCode.UNKNOWN);
    });

    it('keeps the player mapping helper as a stable passthrough surface', () => {
        expect(mapPlayerErrorCodeToAppErrorCode(PlayerErrorCode.PLAYBACK_DECODE_ERROR)).toBe(
            AppErrorCode.PLAYBACK_DECODE_ERROR
        );
        expect(mapPlayerErrorCodeToAppErrorCode(PlayerErrorCode.TRACK_SWITCH_TIMEOUT)).toBe(
            AppErrorCode.TRACK_SWITCH_TIMEOUT
        );
    });
});
