/**
 * @fileoverview Subtitle delivery policy helpers for Plex stream resolution.
 */

import type { PlexStream } from './types';
import { BURN_IN_SUBTITLE_FORMATS, TEXT_SUBTITLE_FORMATS } from './constants';

export type SubtitleDelivery = 'embed' | 'sidecar' | 'burn' | 'none';

/**
 * Determine how subtitles should be delivered for a resolved stream.
 */
export function getSubtitleDelivery(
    subtitle: PlexStream | null,
    isTranscoding: boolean
): SubtitleDelivery {
    if (!subtitle) {
        return 'none';
    }

    const format = (subtitle.format || '').toLowerCase();

    // Image-based subtitles must be burned in.
    if (BURN_IN_SUBTITLE_FORMATS.includes(format)) {
        return 'burn';
    }

    // Text-based subtitles can be sidecar for direct play.
    if (TEXT_SUBTITLE_FORMATS.includes(format) && !isTranscoding) {
        return 'sidecar';
    }

    // For transcoding, server handles embedding.
    if (isTranscoding) {
        return 'burn';
    }

    return 'embed';
}

/**
 * Decide if transcode subtitle burn-in should be requested.
 */
export function shouldRequestBurnInSubtitles(options: {
    requestSubtitleMode?: 'none' | 'burn';
    subtitle?: PlexStream | null;
}): boolean {
    if (!options.subtitle) {
        return false;
    }

    const subtitleFormat = (options.subtitle.format ?? options.subtitle.codec ?? '').toLowerCase();
    return options.requestSubtitleMode === 'burn' ||
        BURN_IN_SUBTITLE_FORMATS.includes(subtitleFormat);
}
