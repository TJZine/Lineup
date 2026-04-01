import { getTagDirectoryMediaTypesForLibraryType } from '../tagDirectoryPolicy';
import { PLEX_MEDIA_TYPES } from '../constants';

describe('getTagDirectoryMediaTypesForLibraryType', () => {
    it('uses show and episode media types for show libraries', () => {
        expect(getTagDirectoryMediaTypesForLibraryType('show')).toEqual({
            genreType: PLEX_MEDIA_TYPES.SHOW,
            detailType: PLEX_MEDIA_TYPES.EPISODE,
        });
    });

    it('uses movie media types for non-show libraries', () => {
        expect(getTagDirectoryMediaTypesForLibraryType('movie')).toEqual({
            genreType: PLEX_MEDIA_TYPES.MOVIE,
            detailType: PLEX_MEDIA_TYPES.MOVIE,
        });
    });
});
