/**
 * @fileoverview Safe localStorage helpers.
 * @module utils/storage
 * @version 1.0.0
 *
 * webOS/Chromium and some privacy modes can throw on localStorage access.
 * These helpers treat storage as optional and never throw.
 */

export function safeLocalStorageGet(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

export function safeLocalStorageSet(key: string, value: string): boolean {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

export type SafeLocalStorageSetResult = { ok: true } | { ok: false; reason: 'quota-exceeded' | 'unavailable' };

export function safeLocalStorageSetWithResult(key: string, value: string): SafeLocalStorageSetResult {
    try {
        localStorage.setItem(key, value);
        return { ok: true };
    } catch (error: unknown) {
        return { ok: false, reason: isQuotaExceededError(error) ? 'quota-exceeded' : 'unavailable' };
    }
}

export function safeLocalStorageRemove(key: string): boolean {
    try {
        localStorage.removeItem(key);
        return true;
    } catch {
        return false;
    }
}

/**
 * Remove localStorage keys matching any provided prefix.
 * Returns the list of removed keys. Never throws.
 */
export function safeLocalStorageRemoveByPrefixes(prefixes: readonly string[]): string[] {
    if (prefixes.length === 0) {
        return [];
    }
    try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            if (!prefixes.some((prefix) => key.startsWith(prefix))) continue;
            keysToRemove.push(key);
        }
        for (const key of keysToRemove) {
            localStorage.removeItem(key);
        }
        return keysToRemove;
    } catch {
        return [];
    }
}

/** Parse '1'/'0' string to boolean. Returns null if value is null or unrecognized. */
export function parseStoredBoolean(value: string | null): boolean | null {
    if (value === null) return null;
    if (value === '1') return true;
    if (value === '0') return false;
    return null;
}

/** Read a stored boolean, removing invalid values. Returns null if missing or invalid. */
export function readStoredBooleanMaybeAndClean(key: string): boolean | null {
    const raw = safeLocalStorageGet(key);
    const parsed = parseStoredBoolean(raw);
    if (parsed !== null) return parsed;
    if (raw !== null) {
        safeLocalStorageRemove(key);
    }
    return null;
}

/** Read a stored boolean, removing invalid values and falling back when missing/invalid. */
export function readStoredBooleanAndClean(key: string, defaultValue: boolean): boolean {
    return readStoredBooleanMaybeAndClean(key) ?? defaultValue;
}

export function parseStoredEpgInfoBackgroundMode(value: string | null): 0 | 1 | 2 | null {
    if (value === '0') return 0;
    if (value === '1') return 1;
    if (value === '2') return 2;
    return null;
}

export function isStoredTrue(value: string | null): boolean {
    return value === '1';
}

/** Read a boolean from storage, falling back to defaultValue if missing or invalid. */
export function readStoredBoolean(key: string, defaultValue: boolean): boolean {
    const parsed = parseStoredBoolean(safeLocalStorageGet(key));
    return parsed ?? defaultValue;
}

/**
 * Clear only Lineup-owned keys (prefix-based).
 * Does not call localStorage.clear() to avoid clobbering unrelated app data.
 */
export function safeClearLineupStorage(): void {
    safeLocalStorageRemoveByPrefixes(['lineup_']);
}

function isQuotaExceededError(error: unknown): boolean {
    if (
        typeof DOMException === 'undefined' ||
        !(error instanceof DOMException)
    ) {
        return false;
    }

    return (
        error.code === 22 ||
        error.code === 1014 ||
        error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    );
}
