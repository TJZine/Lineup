import type { IPlexLibraryMinimal, PlexMediaItemMinimal } from '../contracts/interfaces';
import type { ChannelConfig, LibraryContentSource } from '../contracts/types';

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

export function createBaseChannel(overrides: Partial<ChannelConfig> = {}): ChannelConfig {
    return {
        id: 'base',
        number: 1,
        name: 'Base Channel',
        contentSource: createMockContentSource(),
        playbackMode: 'shuffle',
        shuffleSeed: 1,
        phaseSeed: 1,
        startTimeAnchor: 0,
        skipIntros: false,
        skipCredits: false,
        createdAt: 0,
        updatedAt: 0,
        lastContentRefresh: 0,
        itemCount: 0,
        totalDurationMs: 0,
        ...overrides,
    };
}

export function seedDefaultLibrary(mockLibrary: jest.Mocked<IPlexLibraryMinimal>): void {
    mockLibrary.getLibraryItems.mockResolvedValue([
        createMockItem({ ratingKey: '1' }),
        createMockItem({ ratingKey: '2' }),
    ]);
}
