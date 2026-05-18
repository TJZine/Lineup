import { DEFAULT_CONFIG } from './constants';

const DEFAULT_SEEK_INCREMENT_SECONDS = DEFAULT_CONFIG.seekIncrementSec;

export function isValidSeekIncrementSeconds(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function normalizeSeekIncrementSeconds(
    value: unknown,
    fallback: number = DEFAULT_SEEK_INCREMENT_SECONDS
): number {
    if (isValidSeekIncrementSeconds(value)) {
        return value;
    }

    return isValidSeekIncrementSeconds(fallback) ? fallback : DEFAULT_SEEK_INCREMENT_SECONDS;
}
