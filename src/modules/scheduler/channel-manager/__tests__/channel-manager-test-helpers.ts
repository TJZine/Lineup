import type { IPlexLibraryMinimal, PlexMediaItemMinimal } from '../interfaces';
import type { LibraryContentSource } from '../types';

export function createMockLibrary(): jest.Mocked<IPlexLibraryMinimal> {
    return {
        getLibraryItems: jest.fn(),
        getCollectionItems: jest.fn(),
        getShowEpisodes: jest.fn(),
        getPlaylistItems: jest.fn(),
        getItem: jest.fn(),
    };
}

export function createMockItem(overrides: Partial<PlexMediaItemMinimal> = {}): PlexMediaItemMinimal {
    return {
        ratingKey: '1',
        type: 'movie',
        title: 'Test Movie',
        year: 2020,
        durationMs: 7200000,
        thumb: '/thumb/1',
        addedAt: new Date(),
        ...overrides,
    };
}

export function createMockContentSource(libraryId = 'lib1'): LibraryContentSource {
    return {
        type: 'library',
        libraryId,
        libraryType: 'movie',
        includeWatched: true,
    };
}

export function seedDefaultLibrary(mockLibrary: jest.Mocked<IPlexLibraryMinimal>): void {
    mockLibrary.getLibraryItems.mockResolvedValue([
        createMockItem({ ratingKey: '1' }),
        createMockItem({ ratingKey: '2' }),
    ]);
}
