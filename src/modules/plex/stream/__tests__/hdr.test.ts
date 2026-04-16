import { detectHdrLabel, extractHdrLabelFromPlexMedia } from '../hdr';

describe('hdr helpers', () => {
    it('prefers Dolby Vision when DOVI flags are present', () => {
        expect(
            detectHdrLabel({
                doviPresent: true,
                displayTitle: 'Dolby Vision',
                hdr: 'hdr10',
            })
        ).toBe('Dolby Vision');
    });

    it('extracts HDR10 labels from Plex media streams', () => {
        expect(
            extractHdrLabelFromPlexMedia({
                media: [{ parts: [{ streams: [{ streamType: 1, hdr: 'HDR10' }] }] }],
            })
        ).toBe('HDR10');
    });
});
