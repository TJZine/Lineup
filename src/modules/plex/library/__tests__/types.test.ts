import { AppErrorCode } from '../../../../types/app-errors';
import { PlexLibraryErrorCode, mapPlexLibraryErrorCodeToAppErrorCode } from '../types';

describe('mapPlexLibraryErrorCodeToAppErrorCode', () => {
    it('maps PAGINATION_LIMIT_EXCEEDED to a dedicated AppErrorCode', () => {
        expect(
            mapPlexLibraryErrorCodeToAppErrorCode(PlexLibraryErrorCode.PAGINATION_LIMIT_EXCEEDED)
        ).toBe(AppErrorCode.PAGINATION_LIMIT_EXCEEDED);
    });
});

