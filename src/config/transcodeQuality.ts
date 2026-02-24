/**
 * @fileoverview Transcode quality tiers exposed to users.
 * Used to map a single Settings selection onto Plex transcoder query params.
 * @module config/transcodeQuality
 */

export type TranscodeQualityOption = Readonly<{
    /** Stored in localStorage under LINEUP_STORAGE_KEYS.TRANSCODE_QUALITY */
    storageValue: string;
    /** User-visible label */
    label: string;
    /** Plex transcoder max video bitrate (kbps). When omitted, no override is applied. */
    maxVideoBitrateKbps?: number;
    /** Optional Plex video resolution cap (e.g. "1280x720") */
    videoResolution?: string;
}>;

/**
 * Plex-style quality tiers (kbps) commonly used by official clients.
 * Keep this list small and TV-appropriate; it is user-facing.
 */
export const TRANSCODE_QUALITY_OPTIONS: readonly TranscodeQualityOption[] = [
    // Empty storageValue means "no override" (use existing app defaults).
    { storageValue: '', label: 'Default (Recommended)' },

    { storageValue: '12000-1080p', label: '12 Mbps (1080p)', maxVideoBitrateKbps: 12_000, videoResolution: '1920x1080' },
    { storageValue: '8000-1080p', label: '8 Mbps (1080p)', maxVideoBitrateKbps: 8_000, videoResolution: '1920x1080' },
    { storageValue: '4000-720p', label: '4 Mbps (720p)', maxVideoBitrateKbps: 4_000, videoResolution: '1280x720' },
    { storageValue: '2000-720p', label: '2 Mbps (720p)', maxVideoBitrateKbps: 2_000, videoResolution: '1280x720' },
    { storageValue: '1500-480p', label: '1.5 Mbps (480p)', maxVideoBitrateKbps: 1_500, videoResolution: '854x480' },
] as const;

export function getTranscodeQualityOption(storageValue: string | null): TranscodeQualityOption | null {
    if (!storageValue) {
        return TRANSCODE_QUALITY_OPTIONS[0] ?? null;
    }
    return TRANSCODE_QUALITY_OPTIONS.find((option) => option.storageValue === storageValue) ?? null;
}
