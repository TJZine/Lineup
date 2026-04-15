import { formatAudioCodec } from '../mediaFormat';

describe('formatAudioCodec', () => {
    it('maps known codec aliases to the expected display names', () => {
        expect(formatAudioCodec('truehd')).toBe('TRUEHD');
        expect(formatAudioCodec('eac3')).toBe('DD+');
        expect(formatAudioCodec('ac3')).toBe('DD');
        expect(formatAudioCodec('dts-hd')).toBe('DTS-HD');
        expect(formatAudioCodec('dts')).toBe('DTS');
    });

    it('falls back to uppercase normalization for unknown codecs', () => {
        expect(formatAudioCodec(' flac ')).toBe('FLAC');
        expect(formatAudioCodec(undefined)).toBeNull();
    });
});
