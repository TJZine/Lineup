
/**
 * Normalize a Plex `contentRating` string for compact badge display.
 *
 * Notes:
 * - Plex contentRating values are effectively free-form and can include region/system prefixes
 *   (e.g., "GB/12A", "CA/14A", "AU/MA15+").
 * - We keep normalization conservative to avoid incorrect transformations.
 * - This function is display-only and should not be used to mutate stored metadata.
 */
export function formatContentRatingBadge(raw: string | null | undefined): string | null {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;

    // Collapse internal whitespace for stability (e.g., "FSK   16" -> "FSK 16").
    const compact = trimmed.replace(/\s+/g, ' ');

    // Conservative prefix stripping: "GB/12A" -> "12A", "CA:14A" -> "14A".
    // Only when the suffix is short and contains no spaces (to avoid munging "DE/FSK 16").
    const match = compact.match(/^([A-Z]{2,3})[/:]([^\s]+)$/);
    if (match) {
        const suffix = match[2] ?? '';
        if (suffix.length > 0 && suffix.length <= 10) {
            return suffix;
        }
    }

    return compact;
}

