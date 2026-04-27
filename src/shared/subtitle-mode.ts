export const SUBTITLE_MODES = ['off', 'direct', 'standard', 'full'] as const;

export type SubtitleMode = (typeof SUBTITLE_MODES)[number];

export const DEFAULT_SUBTITLE_MODE: SubtitleMode = 'full';

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
    fallback: SubtitleMode = DEFAULT_SUBTITLE_MODE
): SubtitleMode {
    return parseSubtitleMode(value) ?? fallback;
}

export function subtitleModeAllowsBurnIn(mode: SubtitleMode): boolean {
    return mode === 'full';
}

export function subtitleModeIsDirectOnly(mode: SubtitleMode): boolean {
    return mode === 'direct';
}
