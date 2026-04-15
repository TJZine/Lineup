import { PLEX_MEDIA_TYPES } from './constants';
import type { PlexLibrarySection } from './types';

export type PlexTagDirectoryMediaTypes = {
    genreType: number;
    detailType: number;
};

export function getTagDirectoryMediaTypesForLibraryType(
    libraryType: PlexLibrarySection['type']
): PlexTagDirectoryMediaTypes {
    if (libraryType === 'show') {
        return {
            genreType: PLEX_MEDIA_TYPES.SHOW,
            detailType: PLEX_MEDIA_TYPES.EPISODE,
        };
    }

    return {
        genreType: PLEX_MEDIA_TYPES.MOVIE,
        detailType: PLEX_MEDIA_TYPES.MOVIE,
    };
}
