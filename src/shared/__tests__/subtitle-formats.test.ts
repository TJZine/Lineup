import {
    BURN_IN_SUBTITLE_FORMATS,
    isTextSubtitleFormat,
    TEXT_SUBTITLE_FORMATS,
} from '../subtitle-formats';

describe('subtitle format constants', () => {
    it('keeps the expected burn-in and text memberships disjoint', () => {
        expect(BURN_IN_SUBTITLE_FORMATS).toEqual(
            expect.arrayContaining(['pgs', 'vobsub', 'ass'])
        );
        expect(TEXT_SUBTITLE_FORMATS).toEqual(
            expect.arrayContaining(['srt', 'vtt', 'webvtt', 'subrip'])
        );
        expect(BURN_IN_SUBTITLE_FORMATS.some((format) => TEXT_SUBTITLE_FORMATS.includes(format))).toBe(false);
    });

    it('classifies text subtitle format aliases case-insensitively', () => {
        expect(isTextSubtitleFormat('SRT')).toBe(true);
        expect(isTextSubtitleFormat('  SRT  ')).toBe(true);
        expect(isTextSubtitleFormat('subrip')).toBe(true);
        expect(isTextSubtitleFormat('pgs')).toBe(false);
        expect(isTextSubtitleFormat(null)).toBe(false);
    });
});
