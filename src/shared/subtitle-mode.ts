/**
 * @fileoverview Subtitle mode helpers and legacy migration.
 * @module shared/subtitle-mode
 * @version 1.0.0
 */

import { RETUNE_STORAGE_KEYS } from '../config/storageKeys';
import { isStoredTrue, safeLocalStorageGet, safeLocalStorageSet } from '../utils/storage';

export type SubtitleMode = 'off' | 'direct' | 'standard' | 'full';

export const SUBTITLE_MODES: readonly SubtitleMode[] = ['off', 'direct', 'standard', 'full'] as const;

export function isSubtitleMode(value: unknown): value is SubtitleMode {
    return typeof value === 'string' && (SUBTITLE_MODES as readonly string[]).includes(value);
}

export function normalizeSubtitleMode(value: string | null): SubtitleMode | null {
    if (!value) return null;
    const trimmed = value.trim().toLowerCase();
    if (isSubtitleMode(trimmed)) return trimmed;
    return null;
}

function deriveSubtitleModeFromLegacyKeys(): SubtitleMode {
    // If a user explicitly turned subtitles off in the old gating model, respect that.
    try {
        const enabled = isStoredTrue(safeLocalStorageGet(RETUNE_STORAGE_KEYS.SUBTITLES_ENABLED));
        if (!enabled) {
            // Note: absence of the key previously meant "disabled by default"; new UX prefers availability,
            // but an explicit off should remain off.
            const raw = safeLocalStorageGet(RETUNE_STORAGE_KEYS.SUBTITLES_ENABLED);
            if (raw !== null) return 'off';
        }
    } catch {
        // ignore
    }

    // Old "external only" maps directly to "direct".
    try {
        if (isStoredTrue(safeLocalStorageGet(RETUNE_STORAGE_KEYS.SUBTITLE_FILTER_EXTERNAL_ONLY))) {
            return 'direct';
        }
    } catch {
        // ignore
    }

    // Default: allow text subtitle extraction (but do not assume burn-in).
    return 'standard';
}

/**
 * Read the effective subtitle mode.
 *
 * If the new key is missing, this will best-effort derive from legacy keys and persist the result
 * so the rest of the app has a stable, single source of truth.
 */
export function getSubtitleMode(): SubtitleMode {
    const raw = safeLocalStorageGet(RETUNE_STORAGE_KEYS.SUBTITLE_MODE);
    const normalized = normalizeSubtitleMode(raw);
    if (normalized) return normalized;

    const derived = deriveSubtitleModeFromLegacyKeys();
    try {
        safeLocalStorageSet(RETUNE_STORAGE_KEYS.SUBTITLE_MODE, derived);
    } catch {
        // ignore
    }
    return derived;
}

export function setSubtitleMode(mode: SubtitleMode): void {
    safeLocalStorageSet(RETUNE_STORAGE_KEYS.SUBTITLE_MODE, mode);
}

export function subtitleModeAllowsBurnIn(mode: SubtitleMode): boolean {
    return mode === 'full';
}

export function subtitleModeIsDirectOnly(mode: SubtitleMode): boolean {
    return mode === 'direct';
}

