import { PlexLibraryError } from '../PlexLibraryError';
import { parseMediaFiles } from '../mediaFileParser';

describe('mediaFileParser', () => {
    it('normalizes codecs and preserves stream details', () => {
        const files = parseMediaFiles([
            {
                id: '9',
                duration: 1000,
                bitrate: 5000,
                width: 1920,
                height: 1080,
                aspectRatio: 1.78,
                videoCodec: 'HEVC',
                audioCodec: 'TRUEHD',
                audioChannels: 6,
                container: 'MKV',
                videoResolution: '4k',
                Part: [
                    {
                        id: '12',
                        key: '/library/parts/12',
                        duration: 1000,
                        file: '/video.mkv',
                        size: 10,
                        container: 'MKV',
                        Stream: [{ id: '1', streamType: 1, codec: 'hevc' }],
                    },
                ],
            },
        ]);

        expect(files[0]).toMatchObject({
            videoCodec: 'hevc',
            audioCodec: 'truehd',
            container: 'mkv',
        });
        expect(files[0]?.parts[0]?.streams[0]?.codec).toBe('hevc');
    });

    it('throws a typed parse error when a media file entry is malformed', () => {
        expect(() => parseMediaFiles([null])).toThrow(PlexLibraryError);
    });

    it('throws a typed parse error when nested part or stream entries are malformed', () => {
        expect(() =>
            parseMediaFiles([
                {
                    id: '9',
                    Part: [
                        {
                            id: '12',
                            key: '/library/parts/12',
                            Stream: [null],
                        },
                    ],
                },
            ])
        ).toThrow(PlexLibraryError);
    });
});
