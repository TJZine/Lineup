import {
    hasHdr10BaseLayer,
    inferHdr10BaseLayer,
    isLetterboxAspectRatio,
    parseDolbyVisionProfileString,
    shouldApplyHdr10Fallback,
} from '../dvHdr10Fallback';

describe('dvHdr10Fallback', () => {
    describe('hasHdr10BaseLayer', () => {
        it('returns true for profile 7', () => {
            expect(hasHdr10BaseLayer(7, null, '7')).toBe(true);
        });

        it('returns true for profile 8.1 via levelId', () => {
            expect(hasHdr10BaseLayer(8, 1, null)).toBe(true);
        });

        it('returns true for profile 8.1 via raw string', () => {
            expect(hasHdr10BaseLayer(8, null, '8.1')).toBe(true);
        });

        it('returns true for profile 8.1 via codec string', () => {
            expect(hasHdr10BaseLayer(8, 1, 'dvhe.08.01')).toBe(true);
        });

        it('returns false for profile 8.2', () => {
            expect(hasHdr10BaseLayer(8, 2, '8.2')).toBe(false);
        });

        it('returns false for profile 8.4', () => {
            expect(hasHdr10BaseLayer(8, 4, '8.4')).toBe(false);
        });

        it('returns false for profile 5', () => {
            expect(hasHdr10BaseLayer(5, null, '5')).toBe(false);
        });

        it('returns false for unknown profile', () => {
            expect(hasHdr10BaseLayer(null, null, null)).toBe(false);
        });
    });

    describe('isLetterboxAspectRatio', () => {
        it('returns true for boundaries of scope', () => {
            expect(isLetterboxAspectRatio(2.35)).toBe(true);
            expect(isLetterboxAspectRatio(2.45)).toBe(true);
        });

        it('returns false for outside boundaries of scope', () => {
            expect(isLetterboxAspectRatio(2.34)).toBe(false);
            expect(isLetterboxAspectRatio(2.46)).toBe(false);
        });

        it('returns true for flat boundaries', () => {
            expect(isLetterboxAspectRatio(1.82)).toBe(true);
            expect(isLetterboxAspectRatio(1.88)).toBe(true);
        });

        it('returns false for outside flat boundaries', () => {
            expect(isLetterboxAspectRatio(1.81)).toBe(false);
            expect(isLetterboxAspectRatio(1.89)).toBe(false);
        });
    });

    describe('inferHdr10BaseLayer', () => {
        it('treats profile 8 with PQ (smpte2084) as HDR10 base layer', () => {
            const result = inferHdr10BaseLayer({
                doviProfile: '8',
                colorTrc: 'smpte2084',
            });
            expect(result.hasHdr10BaseLayer).toBe(true);
            expect(result.isKnownNoHdr10BaseLayer).toBe(false);
        });

        it('treats profile 8 with HLG as not HDR10 base layer', () => {
            const result = inferHdr10BaseLayer({
                doviProfile: '8',
                colorTrc: 'arib-std-b67',
            });
            expect(result.hasHdr10BaseLayer).toBe(false);
            expect(result.isKnownNoHdr10BaseLayer).toBe(true);
        });

        it('treats profile 5 as not HDR10 base layer', () => {
            const result = inferHdr10BaseLayer({
                doviProfile: '5',
                colorTrc: 'smpte2084',
            });
            expect(result.hasHdr10BaseLayer).toBe(false);
            expect(result.isKnownNoHdr10BaseLayer).toBe(true);
        });

        it('treats profile 8.2 as known without HDR10 base layer', () => {
            const result = inferHdr10BaseLayer({
                doviProfile: '8.2',
            });
            expect(result.hasHdr10BaseLayer).toBe(false);
            expect(result.isKnownNoHdr10BaseLayer).toBe(true);
        });

        it('uses HDR10 title hints for profile 8 when available', () => {
            const result = inferHdr10BaseLayer({
                doviProfile: '8',
                displayTitle: 'HDR10',
            });
            expect(result.hasHdr10BaseLayer).toBe(true);
            expect(result.isKnownNoHdr10BaseLayer).toBe(false);
        });

        it('does not override HLG with HDR10 title hints', () => {
            const result = inferHdr10BaseLayer({
                doviProfile: '8',
                colorTrc: 'arib-std-b67',
                hdr: 'HDR10',
            });
            expect(result.hasHdr10BaseLayer).toBe(false);
            expect(result.isKnownNoHdr10BaseLayer).toBe(true);
        });
    });

    describe('shouldApplyHdr10Fallback', () => {
        it('applies for MKV + DV + letterbox when smart mode', () => {
            const result = shouldApplyHdr10Fallback({
                mode: 'smart',
                container: 'mkv',
                isDolbyVision: true,
                doviProfile: '7',
                aspectRatio: 2.39,
            });
            expect(result.apply).toBe(true);
            expect(result.reason).toBe('smart');
        });

        it('does not apply for MKV + DV + 16:9 when smart mode', () => {
            const result = shouldApplyHdr10Fallback({
                mode: 'smart',
                container: 'mkv',
                isDolbyVision: true,
                doviProfile: '7',
                aspectRatio: 1.78,
            });
            expect(result.apply).toBe(false);
        });

        it('applies for MKV + DV when force mode', () => {
            const result = shouldApplyHdr10Fallback({
                mode: 'force',
                container: 'mkv',
                isDolbyVision: true,
                doviProfile: '8.1',
            });
            expect(result.apply).toBe(true);
            expect(result.reason).toBe('force');
        });

        it('does not apply for MP4 even when force mode', () => {
            const result = shouldApplyHdr10Fallback({
                mode: 'force',
                container: 'mp4',
                isDolbyVision: true,
                doviProfile: '7',
            });
            expect(result.apply).toBe(false);
        });

        it('does not apply for profile 5 even when force mode', () => {
            const result = shouldApplyHdr10Fallback({
                mode: 'force',
                container: 'mkv',
                isDolbyVision: true,
                doviProfile: '5',
            });
            expect(result.apply).toBe(false);
        });

        it('falls back to width/height when aspectRatio is missing', () => {
            const result = shouldApplyHdr10Fallback({
                mode: 'smart',
                container: 'mkv',
                isDolbyVision: true,
                doviProfile: '7',
                width: 3840,
                height: 1607,
            });
            expect(result.apply).toBe(true);
        });
    });

    describe('parseDolbyVisionProfileString', () => {
        it('parses dvhe codec string', () => {
            const parsed = parseDolbyVisionProfileString(null, 'dvhe.08.06');
            expect(parsed.profileId).toBe(8);
            expect(parsed.levelId).toBe(6);
            expect(parsed.hasHdr10BaseLayer).toBe(false);
        });

        it('parses dvh1 codec string', () => {
            const parsed = parseDolbyVisionProfileString(null, 'dvh1.08.06');
            expect(parsed.profileId).toBe(8);
            expect(parsed.levelId).toBe(6);
            expect(parsed.hasHdr10BaseLayer).toBe(false);
        });

        it('parses raw profile string', () => {
            const parsed = parseDolbyVisionProfileString('8.1');
            expect(parsed.profileId).toBe(8);
            expect(parsed.levelId).toBe(1);
            expect(parsed.hasHdr10BaseLayer).toBe(true);
        });

        it('parses raw "7.6" as profile 7 level 6', () => {
            const parsed = parseDolbyVisionProfileString('7.6');
            expect(parsed.profileId).toBe(7);
            expect(parsed.levelId).toBe(6);
            expect(parsed.hasHdr10BaseLayer).toBe(true);
        });

        // Edge case: when both doviProfile and codecProfileString are provided,
        // codecProfileString takes precedence. Verify hasHdr10BaseLayer is correct.
        it('prefers codecProfileString over doviProfile when both present', () => {
            const parsed = parseDolbyVisionProfileString('8.2', 'dvhe.08.06');
            expect(parsed.profileId).toBe(8);
            expect(parsed.levelId).toBe(6);
            expect(parsed.raw).toBe('dvhe.08.06'); // codec string wins
            expect(parsed.hasHdr10BaseLayer).toBe(false); // correctly false for codec format
        });

        it('falls back to doviProfile when codecProfileString is empty', () => {
            const parsed = parseDolbyVisionProfileString('8.2', '');
            expect(parsed.profileId).toBe(8);
            expect(parsed.levelId).toBe(2);
            expect(parsed.raw).toBe('8.2');
            expect(parsed.hasHdr10BaseLayer).toBe(false);
        });

        it('correctly identifies 8.1 from doviProfile when no codec string', () => {
            const parsed = parseDolbyVisionProfileString('8.1', null);
            expect(parsed.profileId).toBe(8);
            expect(parsed.hasHdr10BaseLayer).toBe(true);
        });

        it('correctly identifies 8.4 (HLG) has no HDR10 base layer', () => {
            const parsed = parseDolbyVisionProfileString('8.4');
            expect(parsed.profileId).toBe(8);
            expect(parsed.hasHdr10BaseLayer).toBe(false);
        });
    });

});
