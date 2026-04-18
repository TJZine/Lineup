import type { PlexLibrarySection, PlexLibrarySectionType, RawLibrarySection } from './types';

export function parseLibrarySections(directories: RawLibrarySection[]): PlexLibrarySection[] {
    return directories.map(parseLibrarySection);
}

function parseLibrarySection(data: RawLibrarySection): PlexLibrarySection {
    return {
        id: data.key,
        uuid: data.uuid,
        title: data.title,
        type: mapLibraryType(data.type),
        agent: data.agent,
        scanner: data.scanner,
        contentCount: null,
        lastScannedAt: data.scannedAt ? new Date(data.scannedAt * 1000) : new Date(0),
        art: data.art ?? null,
        thumb: data.thumb ?? null,
    };
}

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
