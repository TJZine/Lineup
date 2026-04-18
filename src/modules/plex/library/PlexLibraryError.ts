import { PlexLibraryErrorCode } from './types';

/**
 * Plex Library error with typed error code.
 */
export class PlexLibraryError extends Error {
    constructor(
        public readonly code: PlexLibraryErrorCode,
        message: string,
        public readonly httpStatus?: number
    ) {
        super(message);
        this.name = 'PlexLibraryError';
    }
}
