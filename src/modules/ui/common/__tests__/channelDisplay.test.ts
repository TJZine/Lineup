import { getChannelIdentityForDisplay, getChannelNameForDisplay } from '../channelDisplay';

describe('getChannelNameForDisplay', () => {
    it('strips library prefix when present', () => {
        expect(getChannelNameForDisplay({ name: 'Movies - Action', sourceLibraryName: 'Movies' }))
            .toBe('Action');
    });

    it('leaves exact library name unchanged', () => {
        expect(getChannelNameForDisplay({ name: 'Movies', sourceLibraryName: 'Movies' }))
            .toBe('Movies');
    });

    it('does not strip when prefix does not match', () => {
        expect(getChannelNameForDisplay({ name: 'TV - News', sourceLibraryName: 'Movies' }))
            .toBe('TV - News');
    });

    it('leaves matching library suffix unchanged for legacy callers', () => {
        expect(getChannelNameForDisplay({ name: 'Action - Movies', sourceLibraryName: 'Movies' }))
            .toBe('Action - Movies');
    });

    it('handles null or empty library name', () => {
        expect(getChannelNameForDisplay({ name: 'Movies - Action', sourceLibraryName: null }))
            .toBe('Movies - Action');
        expect(getChannelNameForDisplay({ name: 'Movies - Action', sourceLibraryName: '' }))
            .toBe('Movies - Action');
    });
});

describe('getChannelIdentityForDisplay', () => {
    it('splits actor suffix channels into primary identity and provenance', () => {
        expect(getChannelIdentityForDisplay({
            name: 'Gary Oldman - Movies Home',
            sourceLibraryName: 'Movies Home',
            buildStrategy: 'actors',
        })).toEqual({
            primaryName: 'Gary Oldman',
            sourceText: 'Movies Home',
            categoryText: 'Actor',
            provenanceText: 'Actor · Movies Home',
        });
    });

    it('splits genre prefix channels into primary identity and provenance', () => {
        expect(getChannelIdentityForDisplay({
            name: 'Movies - Action',
            sourceLibraryName: 'Movies',
            buildStrategy: 'genres',
        })).toEqual({
            primaryName: 'Action',
            sourceText: 'Movies',
            categoryText: 'Genre',
            provenanceText: 'Genre · Movies',
        });
    });

    it('suppresses category provenance when the category label is the primary identity', () => {
        expect(getChannelIdentityForDisplay({
            name: 'Movies - Recently Added',
            sourceLibraryName: 'Movies',
            buildStrategy: 'recentlyAdded',
        })).toEqual({
            primaryName: 'Recently Added',
            sourceText: 'Movies',
            categoryText: null,
            provenanceText: 'Movies',
        });
    });

    it('suppresses source provenance when the source is the primary identity', () => {
        expect(getChannelIdentityForDisplay({
            name: 'Movies',
            sourceLibraryName: 'Movies',
            buildStrategy: 'libraryFallback',
        })).toEqual({
            primaryName: 'Movies',
            sourceText: null,
            categoryText: 'Library',
            provenanceText: 'Library',
        });
    });

    it('returns only the trimmed name when no source or category is present', () => {
        expect(getChannelIdentityForDisplay({ name: ' Channel 1 ' })).toEqual({
            primaryName: 'Channel 1',
            sourceText: null,
            categoryText: null,
            provenanceText: null,
        });
    });

    it('falls back to the original name when stripping would leave an empty primary', () => {
        expect(getChannelIdentityForDisplay({
            name: 'Movies - ',
            sourceLibraryName: 'Movies',
            buildStrategy: 'genres',
        })).toEqual({
            primaryName: 'Movies -',
            sourceText: 'Movies',
            categoryText: 'Genre',
            provenanceText: 'Genre · Movies',
        });
    });
});
