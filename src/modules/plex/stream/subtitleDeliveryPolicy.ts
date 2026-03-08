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
    _isTranscoding: boolean
): SubtitleDelivery {
    if (!subtitle) {
        return 'none';
    }

    // NOTE: Lineup can deliver text subtitles as a sidecar track even when video is transcoding,
    // because subtitle extraction/fetching is handled out-of-band (see docs/development/subtitles.md).
    // `isTranscoding` is retained as a parameter for API stability but does not currently change the
    // delivery classification on its own.
    const format = (subtitle.format || '').toLowerCase();
    const formatOrCodec = ((subtitle.format ?? subtitle.codec) || '').toLowerCase();

    // Image-based subtitles must be burned in.
    if (BURN_IN_SUBTITLE_FORMATS.includes(formatOrCodec)) {
        return 'burn';
    }

    // Text-based subtitles can be delivered as a sidecar track.
    if (TEXT_SUBTITLE_FORMATS.includes(format)) {
        return 'sidecar';
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
