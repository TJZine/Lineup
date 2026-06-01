import { AppErrorCode } from '../../../../types/app-errors';
import { PlexLibraryError } from '../PlexLibraryError';
import type {
    PlexMediaContainer,
    RawDirectoryTag,
} from '../types';
import { extractMediaContainer } from './libraryResponsePayload';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createTagDirectoryPayloadError(context: string, detail: string): PlexLibraryError {
    return new PlexLibraryError(
        AppErrorCode.PARSE_ERROR,
        `Invalid ${context} payload: ${detail}`
    );
}

function readOptionalTagDirectoryString(
    entry: Record<string, unknown>,
    property: 'fastKey' | 'thumb',
    context: string
): string | undefined {
    const value = entry[property];
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== 'string') {
        throw createTagDirectoryPayloadError(context, `${property} must be a string when present`);
    }
    return value;
}

function readOptionalTagDirectoryCount(entry: Record<string, unknown>, context: string): number | undefined {
    const value = entry.count;
    if (value === undefined) {
        return undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    throw createTagDirectoryPayloadError(context, 'count must be a finite number or numeric string when present');
}

function normalizeSingletonTagDirectoryEntry(value: unknown, context: string): RawDirectoryTag {
    if (!isRecord(value)) {
        throw createTagDirectoryPayloadError(context, 'Directory must be an array or tag entry object');
    }

    const key = value.key;
    if (typeof key !== 'string' && !(typeof key === 'number' && Number.isFinite(key))) {
        throw createTagDirectoryPayloadError(context, 'Directory key must be a string or finite number');
    }

    const title = value.title;
    if (typeof title !== 'string' || title.trim() === '') {
        throw createTagDirectoryPayloadError(context, 'Directory title must be a non-empty string');
    }

    const entry: RawDirectoryTag = {
        key: String(key),
        title,
    };
    const count = readOptionalTagDirectoryCount(value, context);
    if (count !== undefined) {
        entry.count = count;
    }
    const fastKey = readOptionalTagDirectoryString(value, 'fastKey', context);
    if (fastKey !== undefined) {
        entry.fastKey = fastKey;
    }
    const thumb = readOptionalTagDirectoryString(value, 'thumb', context);
    if (thumb !== undefined) {
        entry.thumb = thumb;
    }
    return entry;
}

export function extractTagDirectoryEntries(
    response: PlexMediaContainer<RawDirectoryTag>,
    context: string
): RawDirectoryTag[] {
    const mediaContainer = extractMediaContainer(response, context);
    const directory = (mediaContainer as { Directory?: unknown }).Directory;

    if (directory === undefined) {
        return [];
    }

    if (Array.isArray(directory)) {
        return directory.map((entry, index) =>
            normalizeSingletonTagDirectoryEntry(entry, `${context} entry ${index}`)
        );
    }

    return [normalizeSingletonTagDirectoryEntry(directory, context)];
}
