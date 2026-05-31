/**
 * @jest-environment jsdom
 */

import { installMockTextTracks } from './text-track-test-helpers';

describe('installMockTextTracks', () => {
    it('returns null from item() for missing text-track indexes', () => {
        const video = document.createElement('video');

        installMockTextTracks(video, [
            {
                id: 'subtitles-en',
                kind: 'subtitles',
                label: 'English',
                language: 'en',
                mode: 'disabled',
            },
        ]);

        const textTracks = video.textTracks as TextTrackList & {
            item: (index: number) => TextTrack | null;
        };

        expect(textTracks.item(0)?.id).toBe('subtitles-en');
        expect(textTracks.item(1)).toBeNull();
        expect(textTracks.item(-1)).toBeNull();
    });
});
