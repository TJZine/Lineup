import { PLEX_MEDIA_TYPES } from './constants';
import type { PlexLibrary as PlexLibraryType } from './types';

export type PlexTagDirectoryMediaTypes = {
    genreType: number;
    detailType: number;
};

export function getTagDirectoryMediaTypesForLibraryType(
    libraryType: PlexLibraryType['type']
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
