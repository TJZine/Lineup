import type { PlexStream } from '../contracts/types';
import { BURN_IN_SUBTITLE_FORMATS, isTextSubtitleFormat } from './constants';

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
    const formatOrCodec = ((subtitle.format ?? subtitle.codec) || '').toLowerCase();

    // Image-based subtitles must be burned in.
    if (BURN_IN_SUBTITLE_FORMATS.includes(formatOrCodec)) {
        return 'burn';
    }

    // Text-based subtitles can be delivered as a sidecar track.
    if (isTextSubtitleFormat(formatOrCodec)) {
        return 'sidecar';
    }

    // Legacy contract value for a native-or-unknown/unhandled subtitle category:
    // the selected subtitle is neither Lineup-renderable text nor known burn-in-required.
    // This does not prove webOS or the HTML video element will render it.
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
