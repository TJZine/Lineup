import { isValidContentSource } from '../authoring/ChannelContentSourceValidator';

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
});
