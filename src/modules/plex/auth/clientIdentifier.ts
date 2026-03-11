import { safeLocalStorageGet, safeLocalStorageSet } from '../../../utils/storage';
import { PLEX_AUTH_CONSTANTS } from './constants';

let inMemoryFallbackClientId: string | null = null;

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
        inMemoryFallbackClientId = preferred;
        tryPersistClientId(preferred);
        return preferred;
    }

    const stored = getStoredClientId();
    if (typeof stored === 'string' && isSaneClientId(stored)) {
        inMemoryFallbackClientId = stored;
        return stored;
    }

    if (typeof inMemoryFallbackClientId === 'string' && isSaneClientId(inMemoryFallbackClientId)) {
        tryPersistClientId(inMemoryFallbackClientId);
        return inMemoryFallbackClientId;
    }

    const generated = generateFallbackClientId();
    inMemoryFallbackClientId = generated;
    tryPersistClientId(generated);
    return generated;
}
