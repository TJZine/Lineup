import { AppErrorCode } from '../../../../types/app-errors';
import {
    PlexLibraryError,
    PlexLibraryScopeSupersededError,
    isPlexLibraryScopeSupersededError,
} from '../PlexLibraryError';

describe('PlexLibraryError', () => {
    it('stores the typed code and optional status', () => {
        const error = new PlexLibraryError(
            AppErrorCode.PARSE_ERROR,
            'bad payload',
            502
        );

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('PlexLibraryError');
        expect(error.code).toBe(AppErrorCode.PARSE_ERROR);
        expect(error.message).toBe('bad payload');
        expect(error.httpStatus).toBe(502);
    });
});

describe('PlexLibraryScopeSupersededError', () => {
    it('provides a narrow token-free discrimination seam', () => {
        const error = new PlexLibraryScopeSupersededError();

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('PlexLibraryScopeSupersededError');
        expect(error.message).toBe('Plex library request scope superseded');
        expect(isPlexLibraryScopeSupersededError(error)).toBe(true);
        expect(isPlexLibraryScopeSupersededError(new Error(error.message))).toBe(false);
    });
});
