import { AppErrorCode } from '../../../types/app-errors';

/**
 * Plex Library error with typed error code.
 */
export class PlexLibraryError extends Error {
    constructor(
        public readonly code: AppErrorCode,
        message: string,
        public readonly httpStatus?: number
    ) {
        super(message);
        this.name = 'PlexLibraryError';
    }
}
