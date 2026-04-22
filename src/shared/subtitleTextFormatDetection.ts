export type SubtitleTextContentFormat = 'webvtt' | 'srt' | 'unknown';

const WEBVTT_HEADER_PATTERN = /(?:^|\n)\s*WEBVTT(?:[ \t].*)?(?:\n|$)/i;
const SRT_TIMESTAMP_PATTERN =
    /\b\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}\b/;

export function detectSubtitleTextContentFormat(sample: string): SubtitleTextContentFormat {
    const trimmed = sample.replace(/^\uFEFF/, '');

    if (WEBVTT_HEADER_PATTERN.test(trimmed)) {
        return 'webvtt';
    }

    if (SRT_TIMESTAMP_PATTERN.test(trimmed)) {
        return 'srt';
    }

    return 'unknown';
}
