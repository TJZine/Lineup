import { PlexLibraryError } from './PlexLibraryError';
import { parseRequiredObject } from './parserValidation';
import { PlexLibraryErrorCode } from './types';
import type { PlexLibrarySection, PlexLibrarySectionType, RawLibrarySection } from './types';

export function parseLibrarySections(directories: RawLibrarySection[]): PlexLibrarySection[] {
    return directories.map((directory, index) =>
        parseLibrarySection(
            parseRequiredObject<RawLibrarySection>(directory, `library sections[${index}]`)
        )
    );
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
        lastScannedAt:
            typeof data.scannedAt === 'number' ? new Date(data.scannedAt * 1000) : new Date(0),
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
            throw new PlexLibraryError(
                PlexLibraryErrorCode.PARSE_ERROR,
                `Invalid library section payload: unknown library type "${type}"`
            );
    }
}
