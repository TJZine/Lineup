/**
 * @fileoverview Pure subtitle mode helpers.
 * @module shared/subtitle-mode
 * @version 1.0.0
 */

export type SubtitleMode = 'off' | 'direct' | 'standard' | 'full';

const SUBTITLE_MODES: readonly SubtitleMode[] = ['off', 'direct', 'standard', 'full'] as const;

export function isSubtitleMode(value: unknown): value is SubtitleMode {
    return typeof value === 'string' && (SUBTITLE_MODES as readonly string[]).includes(value);
}

export function parseSubtitleMode(value: string | null | undefined): SubtitleMode | null {
    if (!value) return null;
    const trimmed = value.trim().toLowerCase();
    if (isSubtitleMode(trimmed)) return trimmed;
    return null;
}

export function normalizeSubtitleMode(
    value: string | null | undefined,
    fallback: SubtitleMode = 'full'
): SubtitleMode {
    return parseSubtitleMode(value) ?? fallback;
}

export function subtitleModeAllowsBurnIn(mode: SubtitleMode): boolean {
    return mode === 'full';
}

export function subtitleModeIsDirectOnly(mode: SubtitleMode): boolean {
    return mode === 'direct';
}
