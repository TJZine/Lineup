import {
    isDtsFamilyAudioCodec,
    isSupportedAudioCodec,
    normalizeAudioCodec,
} from '../audioCodecSupport';

describe('audioCodecSupport', () => {
    it('normalizes codec strings before evaluation', () => {
        expect(normalizeAudioCodec('  AAC ')).toBe('aac');
    });

    it('detects DTS-family codecs', () => {
        expect(isDtsFamilyAudioCodec('dts')).toBe(true);
        expect(isDtsFamilyAudioCodec('dts-hd')).toBe(true);
        expect(isDtsFamilyAudioCodec('dca')).toBe(true);
        expect(isDtsFamilyAudioCodec('dca-ma')).toBe(true);
        expect(isDtsFamilyAudioCodec('aac')).toBe(false);
    });

    it('matches supported codecs by canonical name or prefix', () => {
        expect(isSupportedAudioCodec('aac')).toBe(true);
        expect(isSupportedAudioCodec('eac3-joc')).toBe(true);
        expect(isSupportedAudioCodec('truehd')).toBe(false);
    });
});
