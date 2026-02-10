/**
 * @fileoverview Subtitle mode helpers.
 * @module shared/subtitle-mode
 * @version 1.0.0
 */

import { RETUNE_STORAGE_KEYS } from '../config/storageKeys';
import { safeLocalStorageGet, safeLocalStorageSet } from '../utils/storage';

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

/**
 * Read the effective subtitle mode.
 */
export function getSubtitleMode(): SubtitleMode {
    const raw = safeLocalStorageGet(RETUNE_STORAGE_KEYS.SUBTITLE_MODE);
    const normalized = normalizeSubtitleMode(raw);
    if (normalized) return normalized;

    return 'full';
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
