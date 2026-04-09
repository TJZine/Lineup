import { AppErrorCode } from '../../../../types/app-errors';
import { PlexStreamErrorCode, mapPlexStreamErrorCodeToAppErrorCode } from '../types';

describe('plex stream error taxonomy exports', () => {
    it('reuses canonical AppErrorCode values for shared stream failures', () => {
        expect(PlexStreamErrorCode.AUTH_REQUIRED).toBe(AppErrorCode.AUTH_REQUIRED);
        expect(PlexStreamErrorCode.MIXED_CONTENT_BLOCKED).toBe(AppErrorCode.MIXED_CONTENT_BLOCKED);
        expect(PlexStreamErrorCode.TRANSCODE_FAILED).toBe(AppErrorCode.TRANSCODE_FAILED);
    });

    it('keeps SUBTITLE_STREAM_NOT_FOUND as the stream-local supplemental code', () => {
        expect(PlexStreamErrorCode.SUBTITLE_STREAM_NOT_FOUND).toBe('SUBTITLE_STREAM_NOT_FOUND');
        expect(
            mapPlexStreamErrorCodeToAppErrorCode(PlexStreamErrorCode.SUBTITLE_STREAM_NOT_FOUND)
        ).toBe(AppErrorCode.PLAYBACK_SOURCE_NOT_FOUND);
    });
});
