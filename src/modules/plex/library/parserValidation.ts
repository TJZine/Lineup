import { PlexLibraryError } from './PlexLibraryError';
import { PlexLibraryErrorCode } from './types';

export function parseRequiredObject<T>(value: unknown, context: string): T {
    if (typeof value !== 'object' || value === null) {
        throw new PlexLibraryError(
            PlexLibraryErrorCode.PARSE_ERROR,
            `Invalid ${context} payload: expected an object`
        );
    }

    return value as T;
}

export function parseArrayOrEmpty<T>(value: unknown, context: string): T[] {
    if (value === undefined || value === null) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new PlexLibraryError(
            PlexLibraryErrorCode.PARSE_ERROR,
            `Invalid ${context} payload: expected an array`
        );
    }
    return value as T[];
}

export function parseRequiredArray<T>(value: unknown, context: string): T[] {
    if (!Array.isArray(value)) {
        throw new PlexLibraryError(
            PlexLibraryErrorCode.PARSE_ERROR,
            `Invalid ${context} payload: expected an array`
        );
    }
    return value as T[];
}
