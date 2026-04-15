import { BURN_IN_SUBTITLE_FORMATS, TEXT_SUBTITLE_FORMATS } from '../subtitle-formats';

describe('subtitle format constants', () => {
    it('keeps the expected burn-in and text memberships disjoint', () => {
        expect(BURN_IN_SUBTITLE_FORMATS).toEqual(
            expect.arrayContaining(['pgs', 'vobsub', 'ass'])
        );
        expect(TEXT_SUBTITLE_FORMATS).toEqual(
            expect.arrayContaining(['srt', 'vtt', 'webvtt'])
        );
        expect(BURN_IN_SUBTITLE_FORMATS.some((format) => TEXT_SUBTITLE_FORMATS.includes(format))).toBe(false);
    });
});
