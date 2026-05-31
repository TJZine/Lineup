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
        expect(isDtsFamilyAudioCodec('dtshd')).toBe(true);
        expect(isDtsFamilyAudioCodec('dca')).toBe(true);
        expect(isDtsFamilyAudioCodec('dca-ma')).toBe(true);
        expect(isDtsFamilyAudioCodec('dtsbogus')).toBe(false);
        expect(isDtsFamilyAudioCodec('dcajunk')).toBe(false);
        expect(isDtsFamilyAudioCodec('aac')).toBe(false);
    });

    it('matches supported codecs by canonical name or explicit alias', () => {
        expect(isSupportedAudioCodec('aac')).toBe(true);
        expect(isSupportedAudioCodec('eac3-joc')).toBe(true);
        expect(isSupportedAudioCodec('truehd')).toBe(false);
        expect(isSupportedAudioCodec('aac-bogus')).toBe(false);
        expect(isSupportedAudioCodec('mp3junk')).toBe(false);
    });
});
