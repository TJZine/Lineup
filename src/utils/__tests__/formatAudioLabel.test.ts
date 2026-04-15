import { formatAudioLabel } from '../formatAudioLabel';
import type { AudioTrack } from '../../modules/player/types';

const makeAudioTrack = (overrides: Partial<AudioTrack> = {}): AudioTrack => ({
    id: 'track-1',
    title: '',
    languageCode: 'und',
    language: '',
    codec: '',
    channels: 0,
    index: 0,
    ...overrides,
});

describe('formatAudioLabel', () => {
    it('uses language when present and appends uppercase codec plus channel count', () => {
        expect(formatAudioLabel(makeAudioTrack({
            language: 'English',
            title: 'Stereo',
            codec: 'aac',
            channels: 2,
        }))).toBe('English (AAC 2ch)');
    });

    it('falls back through title and unknown placeholders when fields are missing', () => {
        expect(formatAudioLabel(makeAudioTrack({
            language: '',
            title: 'Commentary',
            codec: '',
            channels: 0,
        }))).toBe('Commentary (Unknown)');
        expect(formatAudioLabel(makeAudioTrack({
            language: '',
            title: '',
            codec: '',
            channels: 0,
        }))).toBe('Unknown (Unknown)');
    });
});
