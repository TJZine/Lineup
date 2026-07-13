import { AppErrorCode } from '../../../../types/app-errors';
import { PlexLibraryError } from '../PlexLibraryError';

export function parseRequiredObject<T>(value: unknown, context: string): T {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new PlexLibraryError(
            AppErrorCode.PARSE_ERROR,
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
            AppErrorCode.PARSE_ERROR,
            `Invalid ${context} payload: expected an array`
        );
    }
    return value as T[];
}

export function parseRequiredArray<T>(value: unknown, context: string): T[] {
    if (!Array.isArray(value)) {
        throw new PlexLibraryError(
            AppErrorCode.PARSE_ERROR,
            `Invalid ${context} payload: expected an array`
        );
    }
    return value as T[];
}

export function parseRequiredString(value: unknown, context: string, field: string): string {
    if (typeof value === 'string') {
        return value;
    }

    throwRequiredScalarError(context, field);
}

export function parseRequiredStringLike(value: unknown, context: string, field: string): string {
    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }

    throwRequiredScalarError(context, field);
}

export function parseRequiredFiniteNumber(value: unknown, context: string, field: string): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    throwRequiredScalarError(context, field);
}

export function parseStringOrDefault(
    value: unknown,
    context: string,
    field: string,
    defaultValue = ''
): string {
    if (value === undefined || value === null) {
        return defaultValue;
    }
    if (typeof value === 'string') {
        return value;
    }

    throwScalarTypeError(context, field, 'a string');
}

export function parseOptionalString(
    value: unknown,
    context: string,
    field: string
): string | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value === 'string') {
        return value;
    }

    throwScalarTypeError(context, field, 'a string');
}

export function parseFiniteNumberOrDefault(
    value: unknown,
    context: string,
    field: string,
    defaultValue = 0
): number {
    if (value === undefined || value === null) {
        return defaultValue;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    throwScalarTypeError(context, field, 'a finite number');
}

export function parseOptionalFiniteNumber(
    value: unknown,
    context: string,
    field: string
): number | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    throwScalarTypeError(context, field, 'a finite number');
}

export function throwScalarTypeError(context: string, field: string, expected: string): never {
    throw new PlexLibraryError(
        AppErrorCode.PARSE_ERROR,
        `Invalid ${context} payload: ${field} must be ${expected}`
    );
}

function throwRequiredScalarError(context: string, field: string): never {
    throw new PlexLibraryError(
        AppErrorCode.PARSE_ERROR,
        `Invalid ${context} payload: ${field} is required`
    );
}
