export const PLEX_LIBRARY_CONSTANTS = {
    DEFAULT_PAGE_SIZE: 100,

    /** Cache TTL in milliseconds (5 minutes) */
    CACHE_TTL_MS: 300000,

    /** Request timeout in milliseconds */
    REQUEST_TIMEOUT_MS: 10000,

    /** Maximum retry attempts for network timeouts */
    MAX_TIMEOUT_RETRIES: 3,

    /** Retry delays for network timeouts in milliseconds (exponential backoff) */
    TIMEOUT_RETRY_DELAYS: [1000, 2000, 4000] as readonly number[],

    /** Single retry delay for 500+ server errors (spec: retry once after 2s) */
    SERVER_ERROR_RETRY_DELAY: 2000,

    /** Default rate limit delay when Retry-After header is missing (seconds) */
    DEFAULT_RATE_LIMIT_DELAY: 5,

    /** Maximum server-directed rate limit delay in milliseconds */
    MAX_RATE_LIMIT_DELAY_MS: 30000,

    /** Maximum successful JSON response body size in bytes */
    MAX_RESPONSE_BODY_BYTES: 16 * 1024 * 1024,

    /** Page size for fetching all leaves (episodes) of a show */
    ALL_LEAVES_PAGE_SIZE: 5000,

    /** Max iterations for any pagination loop to prevent infinite loops */
    MAX_PAGINATION_ITERATIONS: 1000,
} as const;

export const PLEX_ENDPOINTS = {
    LIBRARY_SECTIONS: '/library/sections',

    LIBRARY_SECTION_ALL: (id: string) => `/library/sections/${id}/all`,

    LIBRARY_SECTION_COLLECTIONS: (id: string) => `/library/sections/${id}/collections`,

    LIBRARY_SECTION_ACTORS: (id: string) => `/library/sections/${id}/actor`,

    LIBRARY_SECTION_STUDIOS: (id: string) => `/library/sections/${id}/studio`,

    LIBRARY_SECTION_GENRES: (id: string) => `/library/sections/${id}/genre`,

    LIBRARY_SECTION_DIRECTORS: (id: string) => `/library/sections/${id}/director`,

    LIBRARY_SECTION_YEARS: (id: string) => `/library/sections/${id}/year`,

    LIBRARY_METADATA: (key: string) => `/library/metadata/${key}`,

    LIBRARY_METADATA_CHILDREN: (key: string) => `/library/metadata/${key}/children`,

    LIBRARY_METADATA_ALL_LEAVES: (key: string) => `/library/metadata/${key}/allLeaves`,

    COLLECTION_CHILDREN: (key: string) => `/library/collections/${key}/children`,

    PLAYLISTS: '/playlists',

    PLAYLIST_ITEMS: (key: string) => `/playlists/${key}/items`,

    SEARCH: '/hubs/search',

    PHOTO_TRANSCODE: '/photo/:/transcode',
} as const;

export const PLEX_MEDIA_TYPES = {
    MOVIE: 1,
    SHOW: 2,
    SEASON: 3,
    EPISODE: 4,
    ARTIST: 8,
    ALBUM: 9,
    TRACK: 10,
    COLLECTION: 18,
} as const;
