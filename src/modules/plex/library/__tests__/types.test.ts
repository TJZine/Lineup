import { AppErrorCode } from '../../../../types/app-errors';
import * as libraryTypes from '../types';

describe('plex library types', () => {
    it('does not re-export a shadow error taxonomy', () => {
        const removedMapperKey = ['mapPlexLibrary', 'ErrorCodeToAppErrorCode'].join('');

        // @ts-expect-error removed export must stay absent from the type surface
        type _RemovedPlexLibraryErrorCode = libraryTypes.PlexLibraryErrorCode;
        // @ts-expect-error removed export must stay absent from the type surface
        libraryTypes.mapPlexLibraryErrorCodeToAppErrorCode;

        expect('PlexLibraryErrorCode' in libraryTypes).toBe(false);
        expect(removedMapperKey in libraryTypes).toBe(false);
        expect(AppErrorCode.PARSE_ERROR).toBe('PARSE_ERROR');
    });
});
