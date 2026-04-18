import type { PlexLibraryConfig } from '../interfaces';

export const mockConfig: PlexLibraryConfig = {
    getAuthHeaders: () => ({
        Accept: 'application/json',
        'X-Plex-Token': 'mock-token',
        'X-Plex-Client-Identifier': 'mock-client-id',
    }),
    getServerUri: () => 'http://192.168.1.100:32400',
    getAuthToken: () => 'mock-token',
};

export const mockLibrarySectionsResponse = {
    MediaContainer: {
        Directory: [
            {
                key: '1',
                uuid: 'lib-1',
                title: 'Movies',
                type: 'movie',
                agent: 'com.plexapp.agents.imdb',
                scanner: 'Plex Movie Scanner',
                art: '/library/sections/1/art',
                thumb: '/library/sections/1/thumb',
                scannedAt: 1704067200,
            },
            {
                key: '2',
                uuid: 'lib-2',
                title: 'TV Shows',
                type: 'show',
                agent: 'com.plexapp.agents.thetvdb',
                scanner: 'Plex TV Series',
            },
            {
                key: '3',
                uuid: 'lib-3',
                title: 'Music',
                type: 'artist',
                agent: 'com.plexapp.agents.lastfm',
                scanner: 'Plex Music Scanner',
            },
            {
                key: '4',
                uuid: 'lib-4',
                title: 'Photos',
                type: 'photo',
                agent: 'com.plexapp.agents.none',
                scanner: 'Plex Photo Scanner',
            },
        ],
    },
};

export const mockMediaItemResponse = {
    MediaContainer: {
        Metadata: [
            {
                ratingKey: '12345',
                key: '/library/metadata/12345',
                type: 'movie',
                title: 'Test Movie',
                titleSort: 'Test Movie',
                summary: 'A test movie summary',
                year: 2023,
                duration: 7200000,
                addedAt: 1704067200,
                updatedAt: 1704153600,
                thumb: '/library/metadata/12345/thumb',
                art: '/library/metadata/12345/art',
                rating: 8.5,
                audienceRating: 9.0,
                contentRating: 'PG-13',
                Media: [
                    {
                        id: 'm1',
                        duration: 7200000,
                        bitrate: 10000,
                        width: 1920,
                        height: 1080,
                        aspectRatio: 1.78,
                        videoCodec: 'h264',
                        audioCodec: 'aac',
                        audioChannels: 6,
                        container: 'mp4',
                        videoResolution: '1080',
                        Part: [
                            {
                                id: 'p1',
                                key: '/library/parts/p1',
                                duration: 7200000,
                                file: '/movies/test.mp4',
                                size: 5000000000,
                                container: 'mp4',
                                Stream: [
                                    {
                                        id: 's1',
                                        streamType: 1,
                                        codec: 'h264',
                                        width: 1920,
                                        height: 1080,
                                    },
                                    {
                                        id: 's2',
                                        streamType: 2,
                                        codec: 'aac',
                                        language: 'English',
                                        languageCode: 'en',
                                        channels: 6,
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

export const mockCollectionsResponse = {
    MediaContainer: {
        Metadata: [
            { ratingKey: 'c1', key: '/library/collections/c1', title: 'Marvel', thumb: '/c1/thumb', childCount: 25 },
            { ratingKey: 'c2', key: '/library/collections/c2', title: 'Star Wars', childCount: 12 },
        ],
    },
};

export const mockPlaylistsResponse = {
    MediaContainer: {
        Metadata: [
            { ratingKey: 'pl1', key: '/playlists/pl1', title: 'Favorites', thumb: '/pl1/thumb', duration: 36000000, leafCount: 10 },
        ],
    },
};

export const mockTagDirectoryResponse = {
    MediaContainer: {
        Directory: [
            { key: 't1', title: 'Tag One', count: 12, fastKey: '/library/sections/1/actor?type=1&actor=Tag%20One', thumb: '/t1/thumb' },
            { key: 't2', title: 'Tag Two', count: 3 },
        ],
    },
};

export const mockSearchResponse = {
    MediaContainer: {
        Hub: [
            {
                type: 'movie',
                hubIdentifier: 'movie',
                size: 2,
                title: 'Movies',
                Metadata: [
                    { ratingKey: 's1', key: '/library/metadata/s1', type: 'movie', title: 'Search Result 1', year: 2023, duration: 7200000 },
                    { ratingKey: 's2', key: '/library/metadata/s2', type: 'movie', title: 'Search Result 2', year: 2022, duration: 6600000 },
                ],
            },
        ],
    },
};

export function mockFetchJson(json: unknown, status: number = 200): void {
    (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        headers: { get: () => null },
        json: async () => json,
        text: async () => JSON.stringify(json),
    });
}

export function mockFetchSequence(responses: Array<{ json: unknown; status?: number }>): void {
    let callIndex = 0;
    (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockImplementation(() => {
        const response = responses[callIndex] || responses[responses.length - 1];
        callIndex++;
        return Promise.resolve({
            ok: (response?.status ?? 200) >= 200 && (response?.status ?? 200) < 300,
            status: response?.status ?? 200,
            headers: { get: () => null },
            json: async () => response?.json,
            text: async () => JSON.stringify(response?.json),
        });
    });
}

export function mockFetchTextResponse(text: string, status: number = 200): void {
    (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        headers: { get: () => null },
        text: async () => text,
    });
}
