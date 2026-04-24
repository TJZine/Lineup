import {
    DEFAULT_SUBTITLE_MODE,
    SUBTITLE_MODES,
    isSubtitleMode,
    normalizeSubtitleMode,
    parseSubtitleMode,
    subtitleModeAllowsBurnIn,
    subtitleModeIsDirectOnly,
} from '../subtitle-mode';

describe('subtitle mode helpers', () => {
    it('validates and parses supported subtitle modes', () => {
        expect(SUBTITLE_MODES).toEqual(['off', 'direct', 'standard', 'full']);
        expect(isSubtitleMode('direct')).toBe(true);
        expect(isSubtitleMode('weird')).toBe(false);
        expect(parseSubtitleMode(' FULL ')).toBe('full');
        expect(parseSubtitleMode('invalid')).toBeNull();
        expect(parseSubtitleMode(null)).toBeNull();
    });

    it('normalizes with a fallback and exposes burn-in/direct-only policy helpers', () => {
        expect(DEFAULT_SUBTITLE_MODE).toBe('full');
        expect(normalizeSubtitleMode('standard')).toBe('standard');
        expect(normalizeSubtitleMode('bad', 'off')).toBe('off');
        expect(subtitleModeAllowsBurnIn('full')).toBe(true);
        expect(subtitleModeAllowsBurnIn('direct')).toBe(false);
        expect(subtitleModeIsDirectOnly('direct')).toBe(true);
        expect(subtitleModeIsDirectOnly('full')).toBe(false);
    });
});
