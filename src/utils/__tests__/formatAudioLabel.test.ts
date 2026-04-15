import { formatAudioLabel } from '../formatAudioLabel';

describe('formatAudioLabel', () => {
    it('uses language when present and appends uppercase codec plus channel count', () => {
        expect(
            formatAudioLabel({
                language: 'English',
                title: 'Stereo',
                codec: 'aac',
                channels: 2,
            } as never)
        ).toBe('English (AAC 2ch)');
    });

    it('falls back through title and unknown placeholders when fields are missing', () => {
        expect(
            formatAudioLabel({
                language: '',
                title: 'Commentary',
                codec: '',
                channels: 0,
            } as never)
        ).toBe('Commentary (Unknown)');
        expect(
            formatAudioLabel({
                language: '',
                title: '',
                codec: undefined,
                channels: 0,
            } as never)
        ).toBe('Unknown (Unknown)');
    });
});
