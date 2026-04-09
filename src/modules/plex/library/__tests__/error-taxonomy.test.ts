import { AppErrorCode } from '../../../../types/app-errors';
import { PlexLibraryErrorCode, mapPlexLibraryErrorCodeToAppErrorCode } from '../types';

describe('plex library error taxonomy exports', () => {
    it('reuses canonical AppErrorCode values', () => {
        expect(PlexLibraryErrorCode.AUTH_REQUIRED).toBe(AppErrorCode.AUTH_REQUIRED);
        expect(PlexLibraryErrorCode.SERVER_ERROR).toBe(AppErrorCode.SERVER_ERROR);
        expect(PlexLibraryErrorCode.PAGINATION_LIMIT_EXCEEDED).toBe(AppErrorCode.PAGINATION_LIMIT_EXCEEDED);
    });

    it('keeps the library mapping helper as a stable passthrough surface', () => {
        expect(
            mapPlexLibraryErrorCodeToAppErrorCode(PlexLibraryErrorCode.PAGINATION_LIMIT_EXCEEDED)
        ).toBe(AppErrorCode.PAGINATION_LIMIT_EXCEEDED);
    });
});
