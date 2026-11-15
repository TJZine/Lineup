import { isExactAuthoredContentSource, isValidContentSource } from '../authoring/ChannelContentSourceValidator';

describe('ChannelContentSourceValidator', () => {
    it('accepts valid content sources', () => {
        expect(
            isValidContentSource({
                type: 'library',
                libraryId: 'lib-1',
                libraryType: 'movie',
                includeWatched: true,
            }),
        ).toBe(true);

        expect(
            isValidContentSource({
                type: 'collection',
                collectionKey: 'col-1',
                collectionName: 'My Collection',
            }),
        ).toBe(true);

        expect(
            isValidContentSource({
                type: 'show',
                showKey: 'show-1',
                showName: 'My Show',
                seasonFilter: [1, 2],
            }),
        ).toBe(true);

        expect(
            isValidContentSource({
                type: 'show',
                showKey: 'show-1',
                showName: 'My Show',
                seasonFilter: [0, 2],
            }),
        ).toBe(true);

        expect(
            isValidContentSource({
                type: 'playlist',
                playlistKey: 'pl-1',
                playlistName: 'My Playlist',
            }),
        ).toBe(true);

        expect(
            isValidContentSource({
                type: 'manual',
                items: [{ ratingKey: 'rk-1', title: 'Item', durationMs: 1000 }],
            }),
        ).toBe(true);

        expect(
            isValidContentSource({
                type: 'mixed',
                mixMode: 'interleave',
                sources: [
                    { type: 'library', libraryId: 'lib-1', libraryType: 'show', includeWatched: false },
                    { type: 'collection', collectionKey: 'col-1', collectionName: 'Col' },
                ],
            }),
        ).toBe(true);
    });

    it('rejects mixed sources nested deeper than the max depth guard', () => {
        const base = { type: 'library', libraryId: 'lib-1', libraryType: 'movie', includeWatched: true };
        const wrapMixed = (inner: unknown): unknown => ({
            type: 'mixed',
            mixMode: 'sequential',
            sources: [inner],
        });

        // MAX_CONTENT_SOURCE_DEPTH is 25 in ChannelContentSourceValidator.
        let atLimit: unknown = base;
        for (let i = 0; i < 25; i++) {
            atLimit = wrapMixed(atLimit);
        }
        expect(isValidContentSource(atLimit)).toBe(true);

        let beyondLimit: unknown = base;
        for (let i = 0; i < 26; i++) {
            beyondLimit = wrapMixed(beyondLimit);
        }
        expect(isValidContentSource(beyondLimit)).toBe(false);
    });

    it('rejects sources missing required fields or with invalid shapes', () => {
        expect(isValidContentSource(null)).toBe(false);
        expect(isValidContentSource([])).toBe(false);
        expect(isValidContentSource({})).toBe(false);
        expect(isValidContentSource({ type: 'unknown' })).toBe(false);
        expect(() => isValidContentSource({ type: '__proto__' })).not.toThrow();
        expect(isValidContentSource({ type: '__proto__' })).toBe(false);
        expect(isValidContentSource({ type: 'constructor' })).toBe(false);

        expect(isValidContentSource({ type: 'library', libraryId: 'lib-1' })).toBe(false);
        expect(isValidContentSource({ type: 'library', libraryId: 'lib-1', libraryType: 'movie' })).toBe(false);
        expect(
            isValidContentSource({ type: 'library', libraryId: 'lib-1', libraryType: 'bad', includeWatched: true }),
        ).toBe(false);

        expect(isValidContentSource({ type: 'collection', collectionKey: 'col-1' })).toBe(false);
        expect(isValidContentSource({ type: 'show', showKey: 'show-1', showName: '' })).toBe(false);
        expect(
            isValidContentSource({
                type: 'show',
                showKey: 'show-1',
                showName: 'Show',
                seasonFilter: ['1'],
            }),
        ).toBe(false);

        expect(isValidContentSource({ type: 'playlist', playlistKey: 'pl-1' })).toBe(false);

        expect(
            isValidContentSource({
                type: 'manual',
                items: [{ ratingKey: 'rk-1', title: 'Item', durationMs: '1000' }],
            }),
        ).toBe(false);

        expect(isValidContentSource({ type: 'mixed', sources: [] })).toBe(false);
        expect(
            isValidContentSource({
                type: 'mixed',
                mixMode: 'unknown',
                sources: [{ type: 'library', libraryId: 'lib-1', libraryType: 'movie', includeWatched: true }],
            }),
        ).toBe(false);
        expect(
            isValidContentSource({
                type: 'mixed',
                mixMode: 'sequential',
                sources: [{ type: 'library', libraryId: 'lib-1' }],
            }),
        ).toBe(false);
    });

    it('preserves all-seasons filters and rejects invalid season numbers', () => {
        const show = (seasonFilter?: unknown): unknown => ({
            type: 'show',
            showKey: 'show-1',
            showName: 'Show',
            ...(seasonFilter === undefined ? {} : { seasonFilter }),
        });

        expect(isValidContentSource(show())).toBe(true);
        expect(isValidContentSource(show([]))).toBe(true);
        expect(isValidContentSource(show([0]))).toBe(true);

        for (const seasonFilter of [[-1], [1.5], [Infinity], [NaN], ['0'], [null], [0, -1]]) {
            expect(isValidContentSource(show(seasonFilter))).toBe(false);
        }
    });

    it('accepts collection picker metadata only when the complete valid triple is authored', () => {
        const legacy = {
            type: 'collection',
            collectionKey: 'collection-1',
            collectionName: 'Favorites',
        };
        const scoped = {
            ...legacy,
            libraryId: 'library-1',
            libraryType: 'movie',
            libraryName: 'Movies',
        };

        expect(isExactAuthoredContentSource(legacy)).toBe(true);
        expect(isExactAuthoredContentSource(scoped)).toBe(true);
        expect(isValidContentSource({ ...legacy, libraryId: 'library-1' })).toBe(true);

        for (const invalid of [
            { ...legacy, libraryId: 'library-1' },
            { ...legacy, libraryId: 'library-1', libraryType: 'movie' },
            { ...scoped, libraryName: '' },
            { ...scoped, libraryId: 'undefined' },
            { ...scoped, libraryType: 'artist' },
            { ...legacy, libraryId: undefined },
            { ...scoped, unrecognizedField: undefined },
        ]) {
            expect(isExactAuthoredContentSource(invalid)).toBe(false);
        }

        expect(isExactAuthoredContentSource({
            type: 'mixed',
            mixMode: 'sequential',
            sources: [scoped, { ...legacy, libraryId: 'library-2', libraryType: 'show', libraryName: 'TV' }],
        })).toBe(true);
        expect(isExactAuthoredContentSource({
            type: 'mixed',
            mixMode: 'sequential',
            sources: [{ ...legacy, libraryType: 'show' }],
        })).toBe(false);
    });
});
