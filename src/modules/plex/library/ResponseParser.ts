/**
 * @fileoverview Response parsing utilities for Plex API responses.
 * @module modules/plex/library/ResponseParser
 * @version 1.0.0
 */

import type {
    PlexLibrarySection,
    PlexLibrarySectionType,
    PlexMediaItem,
    PlexSeason,
    PlexCollection,
    PlexPlaylist,
    PlexTagDirectoryItem,
} from './types';

import type {
    RawLibrarySection,
    RawMediaItem,
    RawSeason,
    RawCollection,
    RawPlaylist,
    RawDirectoryTag,
} from './types';
import { parseMediaItem } from './mediaItemParser';

export { mapMediaType, parseMediaItem } from './mediaItemParser';
export { parseStream } from './streamParser';

// ============================================
// Library Parsing
// ============================================

/**
 * Parse library sections from Plex API response.
 * @param directories - Raw directory entries from Plex API
 * @returns Parsed library array
 */
export function parseLibrarySections(directories: RawLibrarySection[]): PlexLibrarySection[] {
    return directories.map(parseLibrarySection);
}

/**
 * Parse a single library section.
 * @param data - Raw library section from Plex API
 * @returns Parsed library
 */
function parseLibrarySection(data: RawLibrarySection): PlexLibrarySection {
    return {
        id: data.key,
        uuid: data.uuid,
        title: data.title,
        type: mapLibraryType(data.type),
        agent: data.agent,
        scanner: data.scanner,
        contentCount: null, // Populated when count queries succeed
        lastScannedAt: data.scannedAt ? new Date(data.scannedAt * 1000) : new Date(0),
        art: data.art ?? null,
        thumb: data.thumb ?? null,
    };
}

/**
 * Map Plex library type string to typed enum.
 * @param type - Raw type string from Plex API
 * @returns Mapped library type
 */
export function mapLibraryType(type: string): PlexLibrarySectionType {
    switch (type) {
        case 'movie':
            return 'movie';
        case 'show':
            return 'show';
        case 'artist':
            return 'artist';
        case 'photo':
            return 'photo';
        default:
            return 'movie';
    }
}

// ============================================
// Media Item Parsing
// ============================================

/**
 * Parse media items from Plex API response.
 * @param metadata - Raw metadata entries from Plex API
 * @returns Parsed media item array
 */
export function parseMediaItems(metadata: RawMediaItem[]): PlexMediaItem[] {
    return (metadata || []).map(parseMediaItem);
}

// ============================================
// Directory Tag Parsing
// ============================================

/**
 * Parse tag directory entries (actors/studios) from Plex API response.
 * @param directories - Raw directory entries from Plex API
 * @returns Parsed tag directory array
 */
export function parseDirectoryTags(directories: RawDirectoryTag[]): PlexTagDirectoryItem[] {
    return (directories || []).map((entry) => {
        let count: number | null = null;
        if (typeof entry.count === 'number' && Number.isFinite(entry.count)) {
            count = entry.count;
        } else if (typeof entry.count === 'string') {
            const parsed = Number.parseInt(entry.count, 10);
            count = Number.isFinite(parsed) ? parsed : null;
        }
        const parsed: PlexTagDirectoryItem = {
            key: String(entry.key),
            title: entry.title,
            count,
        };
        if (entry.fastKey !== undefined) {
            parsed.fastKey = entry.fastKey;
        }
        if (entry.thumb !== undefined) {
            parsed.thumb = entry.thumb;
        }
        return parsed;
    });
}

// ============================================
// Media File Parsing
// ============================================


// ============================================
// Season/Collection/Playlist Parsing
// ============================================

/**
 * Parse seasons from Plex API response.
 * @param metadata - Raw metadata entries from Plex API
 * @returns Parsed season array
 */
export function parseSeasons(metadata: RawSeason[]): PlexSeason[] {
    return (metadata || []).map(parseSeason);
}

/**
 * Parse a single season.
 * @param data - Raw season from Plex API
 * @returns Parsed season
 */
function parseSeason(data: RawSeason): PlexSeason {
    return {
        ratingKey: data.ratingKey,
        key: data.key,
        title: data.title,
        index: data.index ?? 0,
        leafCount: data.leafCount ?? 0,
        viewedLeafCount: data.viewedLeafCount ?? 0,
        thumb: data.thumb ?? null,
    };
}

/**
 * Parse collections from Plex API response.
 * @param metadata - Raw metadata entries from Plex API
 * @returns Parsed collection array
 */
export function parseCollections(metadata: RawCollection[]): PlexCollection[] {
    return (metadata || []).map(parseCollection);
}

/**
 * Parse a single collection.
 * @param data - Raw collection from Plex API
 * @returns Parsed collection
 */
function parseCollection(data: RawCollection): PlexCollection {
    return {
        ratingKey: data.ratingKey,
        key: data.key,
        title: data.title,
        thumb: data.thumb ?? null,
        childCount: data.childCount ?? 0,
    };
}

/**
 * Parse playlists from Plex API response.
 * @param metadata - Raw metadata entries from Plex API
 * @returns Parsed playlist array
 */
export function parsePlaylists(metadata: RawPlaylist[]): PlexPlaylist[] {
    return (metadata || []).map(parsePlaylist);
}

/**
 * Parse a single playlist.
 * @param data - Raw playlist from Plex API
 * @returns Parsed playlist
 */
function parsePlaylist(data: RawPlaylist): PlexPlaylist {
    return {
        ratingKey: data.ratingKey,
        key: data.key,
        title: data.title,
        thumb: data.thumb ?? null,
        duration: data.duration ?? 0,
        leafCount: data.leafCount ?? 0,
    };
}
