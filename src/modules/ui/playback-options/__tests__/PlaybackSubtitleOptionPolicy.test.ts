import { classifyPlaybackSubtitleOption } from '../PlaybackSubtitleOptionPolicy';
import type { SubtitleTrack } from '../../../player/types';

const makeTrack = (overrides: Partial<SubtitleTrack> = {}): SubtitleTrack => ({
    id: 'sub-1',
    label: 'English (SRT)',
    languageCode: 'en',
    language: 'English',
    codec: 'srt',
    format: 'srt',
    forced: false,
    default: false,
    isTextCandidate: true,
    fetchableViaKey: false,
    ...overrides,
});

describe('PlaybackSubtitleOptionPolicy', () => {
    it('keeps key-backed text direct in every subtitle mode', () => {
        const track = makeTrack({ fetchableViaKey: true, key: '/library/streams/1' });

        expect(classifyPlaybackSubtitleOption({ track, subtitleMode: 'off', canRequestBurnIn: true })).toBe('direct');
        expect(classifyPlaybackSubtitleOption({ track, subtitleMode: 'direct', canRequestBurnIn: true })).toBe('direct');
        expect(classifyPlaybackSubtitleOption({ track, subtitleMode: 'standard', canRequestBurnIn: true })).toBe('direct');
        expect(classifyPlaybackSubtitleOption({ track, subtitleMode: 'full', canRequestBurnIn: true })).toBe('direct');
    });

    it('classifies keyless text as burn-in only in Full mode', () => {
        const track = makeTrack();

        expect(classifyPlaybackSubtitleOption({ track, subtitleMode: 'off', canRequestBurnIn: true })).toBe('extract');
        expect(classifyPlaybackSubtitleOption({ track, subtitleMode: 'direct', canRequestBurnIn: true })).toBe('hidden');
        expect(classifyPlaybackSubtitleOption({ track, subtitleMode: 'standard', canRequestBurnIn: true })).toBe('extract');
        expect(classifyPlaybackSubtitleOption({ track, subtitleMode: 'full', canRequestBurnIn: true })).toBe('burn_in');
    });

    it('disables Full-mode burn-in options when burn-in requests are unavailable', () => {
        expect(classifyPlaybackSubtitleOption({
            track: makeTrack(),
            subtitleMode: 'full',
            canRequestBurnIn: false,
        })).toBe('disabled');
        expect(classifyPlaybackSubtitleOption({
            track: makeTrack({ id: 'pgs', codec: 'pgs', format: 'pgs', isTextCandidate: false }),
            subtitleMode: 'full',
            canRequestBurnIn: false,
        })).toBe('disabled');
    });
});
