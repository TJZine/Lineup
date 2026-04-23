import { AppErrorCode } from '../../../../types/app-errors';
import { PlexLibraryError } from '../PlexLibraryError';

describe('plex library error taxonomy exports', () => {
    it('uses AppErrorCode directly for library errors', () => {
        const error = new PlexLibraryError(AppErrorCode.PARSE_ERROR, 'bad payload');

        expect(error.code).toBe(AppErrorCode.PARSE_ERROR);
    });
});
