import type { PlexMediaFile, PlexMediaType } from '../shared/types';

export type PlexLibrarySectionType = 'movie' | 'show' | 'artist' | 'photo';

export interface PlexLibrarySection {
    id: string;
    uuid: string;
    title: string;
    type: PlexLibrarySectionType;
    agent: string;
    scanner: string;
    contentCount: number | null;
    episodeCount?: number;
    lastScannedAt: Date;
    art: string | null;
    thumb: string | null;
}

export interface PlexMediaItem {
    ratingKey: string;
    key: string;
    type: PlexMediaType;
    title: string;
    originalTitle?: string;
    sortTitle: string;
    summary: string;
    year: number;
    durationMs: number;
    addedAt: Date;
    updatedAt: Date;
    thumb: string | null;
    art: string | null;
    banner?: string | null;
    /** Transparent title logo from Plex metadata (Image[type=clearLogo]) */
    clearLogo?: string | null;
    rating?: number;
    audienceRating?: number;
    contentRating?: string;
    genres?: string[];
    directors?: string[];
    actors?: string[];
    studios?: string[];
    actorRoles?: PlexMediaRole[];
    grandparentTitle?: string;
    parentTitle?: string;
    grandparentThumb?: string | null;
    parentThumb?: string | null;
    seasonNumber?: number;
    episodeNumber?: number;
    viewOffset?: number;
    viewCount?: number;
    lastViewedAt?: Date;
    grandparentRatingKey?: string;
    parentRatingKey?: string;
    media: PlexMediaFile[];
}

/**
 * Shared media file/part/stream types.
 */
export type { PlexMediaFile, PlexMediaPart, PlexStream, PlexMediaType } from '../shared/types';

export interface PlexSeason {
    ratingKey: string;
    key: string;
    title: string;
    index: number;
    leafCount: number;
    viewedLeafCount: number;
    thumb: string | null;
}

export interface PlexCollection {
    ratingKey: string;
    key: string;
    title: string;
    thumb: string | null;
    childCount: number;
}

export interface PlexPlaylist {
    ratingKey: string;
    key: string;
    title: string;
    thumb: string | null;
    duration: number;
    leafCount: number;
}

/**
 * Parsed Plex tag directory entry (actors/studios).
 */
export interface PlexTagDirectoryItem {
    key: string;
    title: string;
    count: number | null;
    fastKey?: string;
    thumb?: string;
}

export interface LibraryQueryOptions {
    sort?: string;
    filter?: Record<string, string | number>;
    offset?: number;
    limit?: number;
    includeCollections?: boolean;
    signal?: AbortSignal | null;
}

export interface SearchOptions {
    types?: PlexMediaType[];
    libraryId?: string;
    limit?: number;
    signal?: AbortSignal | null;
}


/**
 * Internal state for PlexLibrary instance.
 */
export interface PlexLibraryState {
    libraryCache: Map<string, LibraryCacheEntry>;
    isRefreshing: boolean;
    /**
     * Cache scope derived from the active server URI + account token hash.
     * When the scope changes, in-memory caches must be cleared to avoid cross-server/profile contamination.
     */
    cacheScope: string | null;
}

/**
 * Cache entry for a library.
 */
interface LibraryCacheEntry {
    library: PlexLibrarySection;
    cachedAt: number;
}

/**
 * Event map for PlexLibrary EventEmitter.
 */
export interface PlexLibraryEvents {
    /** Emitted when authentication expires (401 response) */
    authExpired: undefined;
    libraryRefreshed: { libraryId: string };
}

/**
 * Plex API response container structure.
 */
export interface PlexMediaContainer<T> {
    MediaContainer: {
        size?: number;
        totalSize?: number;
        offset?: number;
        Directory?: T[];
        Metadata?: T[];
        Hub?: PlexSearchHub[];
    };
}

/**
 * Plex search hub structure.
 */
interface PlexSearchHub {
    type: string;
    hubIdentifier: string;
    size: number;
    title: string;
    Metadata?: RawMediaItem[];
}

/**
 * Raw library section from Plex API.
 */
export interface RawLibrarySection {
    key: string;
    uuid: string;
    title: string;
    type: string;
    agent: string;
    scanner: string;
    art?: string;
    thumb?: string;
    updatedAt?: number;
    scannedAt?: number;
}

/**
 * Raw media item from Plex API.
 */
export interface RawMediaItem {
    ratingKey: string;
    key: string;
    type: string;
    title: string;
    originalTitle?: string;
    titleSort?: string;
    summary?: string;
    year?: number;
    duration?: number;
    addedAt?: number;
    updatedAt?: number;
    thumb?: string;
    art?: string;
    banner?: string;
    rating?: number;
    audienceRating?: number;
    contentRating?: string;
    Genre?: RawTag[];
    Director?: RawTag[];
    Role?: RawRole[];
    Studio?: RawTag[];
    Image?: RawImage[];
    grandparentTitle?: string;
    parentTitle?: string;
    grandparentThumb?: string | null;
    parentThumb?: string | null;
    parentIndex?: number;
    index?: number;
    viewOffset?: number;
    viewCount?: number;
    lastViewedAt?: number;
    grandparentRatingKey?: string;
    parentRatingKey?: string;
    Media?: RawMediaFile[];
}

/**
 * Raw image descriptor from Plex API metadata.
 */
interface RawImage {
    alt?: string;
    type?: string;
    url?: string;
}

/**
 * Raw metadata tag from Plex API.
 */
interface RawTag {
    id?: number;
    tag?: string;
}

/**
 * Raw role tag from Plex API (actors).
 */
interface RawRole {
    id?: number;
    tag?: string;
    role?: string;
    thumb?: string;
}

/**
 * Parsed role/actor entry for media items.
 */
interface PlexMediaRole {
    name: string;
    role?: string | null;
    thumb?: string | null;
}

/**
 * Raw media file from Plex API.
 */
export interface RawMediaFile {
    id: string;
    duration: number;
    bitrate: number;
    width: number;
    height: number;
    aspectRatio: number;
    videoCodec: string;
    audioCodec: string;
    audioChannels: number;
    container: string;
    videoResolution: string;
    Part?: RawMediaPart[];
}

/**
 * Raw media part from Plex API.
 */
export interface RawMediaPart {
    id: string;
    key: string;
    duration: number;
    file: string;
    size: number;
    container: string;
    videoProfile?: string;
    audioProfile?: string;
    Stream?: RawStream[];
}

/**
 * Raw stream from Plex API.
 */
export interface RawStream {
    id: string;
    streamType: number;
    codec: string;
    language?: string;
    languageCode?: string;
    title?: string;
    displayTitle?: string;
    extendedDisplayTitle?: string;
    selected?: boolean;
    default?: boolean;
    forced?: boolean;
    width?: number;
    height?: number;
    bitrate?: number;
    frameRate?: number;
    channels?: number;
    samplingRate?: number;
    format?: string;
    key?: string;
    profile?: string;
    colorTrc?: string;
    colorSpace?: string;
    colorPrimaries?: string;
    bitDepth?: number;
    hdr?: string;
    dynamicRange?: string;
    DOVIProfile?: string;
    DOVIPresent?: boolean | number | string;
}

/**
 * Raw season from Plex API.
 */
export interface RawSeason {
    ratingKey: string;
    key: string;
    title: string;
    index: number;
    leafCount: number;
    viewedLeafCount: number;
    thumb?: string;
}

/**
 * Raw collection from Plex API.
 */
export interface RawCollection {
    ratingKey: string;
    key: string;
    title: string;
    thumb?: string;
    childCount: number;
}

/**
 * Raw playlist from Plex API.
 */
export interface RawPlaylist {
    ratingKey: string;
    key: string;
    title: string;
    thumb?: string;
    duration: number;
    leafCount: number;
}

/**
 * Raw directory tag entry from Plex tag endpoints (actors/studios).
 */
export interface RawDirectoryTag {
    key: string;
    title: string;
    count?: number | string;
    fastKey?: string;
    thumb?: string;
}
