import { AppErrorCode } from '../../../../types/app-errors';
import { PlexLibraryError } from '../PlexLibraryError';

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
