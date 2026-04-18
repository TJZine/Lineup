import { PlexLibraryError } from '../PlexLibraryError';
import { PlexLibraryErrorCode } from '../types';

describe('PlexLibraryError', () => {
    it('stores the typed code and optional status', () => {
        const error = new PlexLibraryError(
            PlexLibraryErrorCode.PARSE_ERROR,
            'bad payload',
            502
        );

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('PlexLibraryError');
        expect(error.code).toBe(PlexLibraryErrorCode.PARSE_ERROR);
        expect(error.message).toBe('bad payload');
        expect(error.httpStatus).toBe(502);
    });
});
