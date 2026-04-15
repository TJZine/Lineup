import { safeLocalStorageGet, safeLocalStorageSet } from '../../../utils/storage';
import { PLEX_AUTH_CONSTANTS } from './constants';

function isSaneClientId(value: string): boolean {
    return value.length > 0 && value.length <= 128 && /^[a-zA-Z0-9._-]+$/.test(value);
}

function generateFallbackClientId(): string {
    if (
        typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function'
    ) {
        try {
            return `lineup-${crypto.randomUUID()}`;
        } catch {
            // Fall through to Math.random fallback.
        }
    }

    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'lineup-';
    for (let i = 0; i < 16; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function tryPersistClientId(clientId: string): void {
    safeLocalStorageSet(PLEX_AUTH_CONSTANTS.CLIENT_ID_KEY, clientId);
}

function getStoredClientId(): string | null {
    return safeLocalStorageGet(PLEX_AUTH_CONSTANTS.CLIENT_ID_KEY);
}

export function resolveClientIdentifier(preferred?: string): string {
    if (typeof preferred === 'string' && isSaneClientId(preferred)) {
        tryPersistClientId(preferred);
        return preferred;
    }

    const stored = getStoredClientId();
    if (typeof stored === 'string' && isSaneClientId(stored)) {
        return stored;
    }

    const generated = generateFallbackClientId();
    tryPersistClientId(generated);
    return generated;
}
