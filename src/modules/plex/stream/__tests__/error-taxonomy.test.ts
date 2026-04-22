import { AppErrorCode } from '../../../../types/app-errors';
import { PlexStreamErrorCode, mapPlexStreamErrorCodeToAppErrorCode } from '../types';

describe('plex stream error taxonomy exports', () => {
    it('accepts shared AppErrorCode values directly', () => {
        expect(mapPlexStreamErrorCodeToAppErrorCode(AppErrorCode.AUTH_REQUIRED)).toBe(
            AppErrorCode.AUTH_REQUIRED
        );
        expect(mapPlexStreamErrorCodeToAppErrorCode(AppErrorCode.MIXED_CONTENT_BLOCKED)).toBe(
            AppErrorCode.MIXED_CONTENT_BLOCKED
        );
    });

    it('keeps SUBTITLE_STREAM_NOT_FOUND as the stream-local supplemental code', () => {
        expect(PlexStreamErrorCode.SUBTITLE_STREAM_NOT_FOUND).toBe('SUBTITLE_STREAM_NOT_FOUND');
        expect(
            mapPlexStreamErrorCodeToAppErrorCode(PlexStreamErrorCode.SUBTITLE_STREAM_NOT_FOUND)
        ).toBe(AppErrorCode.PLAYBACK_SOURCE_NOT_FOUND);
    });

    it('falls back to UNKNOWN for unexpected runtime values', () => {
        expect(
            mapPlexStreamErrorCodeToAppErrorCode('NOT_A_REAL_STREAM_CODE')
        ).toBe(AppErrorCode.UNKNOWN);
    });
});
