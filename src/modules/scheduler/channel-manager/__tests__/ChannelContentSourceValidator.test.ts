import { isValidContentSource } from '../ChannelContentSourceValidator';

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

    it('rejects sources missing required fields or with invalid shapes', () => {
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

