import { PlexLibraryError } from './PlexLibraryError';
import { PlexLibraryErrorCode } from './types';
import type {
    PlexMediaContainer,
    RawMediaItem,
    RawDirectoryTag,
    RawLibrarySection,
    RawCollection,
    RawPlaylist,
    RawSeason,
} from './types';

type SearchHubPayload = {
    type: string;
    Metadata?: RawMediaItem[];
};

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function extractMediaContainer<T>(
    response: PlexMediaContainer<T>,
    context: string
): PlexMediaContainer<T>['MediaContainer'] {
    const mediaContainer = response.MediaContainer;

    if (!isObject(mediaContainer)) {
        throw new PlexLibraryError(
            PlexLibraryErrorCode.PARSE_ERROR,
            `Invalid ${context} payload: missing MediaContainer object`
        );
    }

    return mediaContainer as PlexMediaContainer<T>['MediaContainer'];
}

export function extractLibrarySectionDirectories(
    response: PlexMediaContainer<RawLibrarySection>,
    context: string
): RawLibrarySection[] {
    return extractDirectoryArray<RawLibrarySection>(response, context);
}

export function extractMetadataArray<T>(
    response: PlexMediaContainer<T>,
    context: string
): T[] {
    const mediaContainer = extractMediaContainer(response, context);
    const metadata = (mediaContainer as { Metadata?: unknown }).Metadata;

    if (!Array.isArray(metadata)) {
        throw new PlexLibraryError(
            PlexLibraryErrorCode.PARSE_ERROR,
            `Invalid ${context} payload: Metadata must be an array`
        );
    }

    return metadata as T[];
}

export function extractDirectoryArray<T>(
    response: PlexMediaContainer<T>,
    context: string
): T[] {
    const mediaContainer = extractMediaContainer(response, context);
    const directory = (mediaContainer as { Directory?: unknown }).Directory;

    if (!Array.isArray(directory)) {
        throw new PlexLibraryError(
            PlexLibraryErrorCode.PARSE_ERROR,
            `Invalid ${context} payload: Directory must be an array`
        );
    }

    return directory as T[];
}

export function extractSearchHubs(
    response: PlexMediaContainer<RawMediaItem>,
    context: string
): SearchHubPayload[] {
    const mediaContainer = extractMediaContainer(response, context);
    const hubs = (mediaContainer as { Hub?: unknown }).Hub;

    if (!Array.isArray(hubs)) {
        throw new PlexLibraryError(
            PlexLibraryErrorCode.PARSE_ERROR,
            `Invalid ${context} payload: Hub must be an array`
        );
    }

    return hubs as SearchHubPayload[];
}

export type {
    RawCollection,
    RawDirectoryTag,
    RawLibrarySection,
    RawPlaylist,
    RawSeason,
};
