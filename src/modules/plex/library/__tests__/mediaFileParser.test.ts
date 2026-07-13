import { PlexLibraryError } from '../PlexLibraryError';
import { parseMediaFiles } from '../parsing/mediaFileParser';
import { AppErrorCode } from '../../../../types/app-errors';

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

    it('throws a typed parse error when required media file scalars are missing', () => {
        expect(() => parseMediaFiles([{ duration: 1000 }])).toThrow(
            expect.objectContaining({
                code: AppErrorCode.PARSE_ERROR,
                message: 'Invalid media file payload: id is required',
            })
        );
    });

    it('throws a typed parse error when required media part scalars are missing', () => {
        expect(() =>
            parseMediaFiles([
                {
                    id: '9',
                    Part: [{ id: '12' }],
                },
            ])
        ).toThrow(
            expect.objectContaining({
                code: AppErrorCode.PARSE_ERROR,
                message: 'Invalid media part payload: key is required',
            })
        );
    });

    it.each([
        ['media file', 'duration', { id: '9', duration: '1000' }, 'a finite number'],
        ['media file', 'videoCodec', { id: '9', videoCodec: 7 }, 'a string'],
        ['media file', 'videoResolution', { id: '9', videoResolution: false }, 'a string'],
        ['media part', 'size', { id: '9', Part: [{ id: '12', key: '/part', size: '10' }] }, 'a finite number'],
        ['media part', 'file', { id: '9', Part: [{ id: '12', key: '/part', file: 10 }] }, 'a string'],
        ['media part', 'videoProfile', { id: '9', Part: [{ id: '12', key: '/part', videoProfile: {} }] }, 'a string'],
    ])('rejects a wrong-typed %s %s with a sanitized typed error', (context, field, raw, expected) => {
        expect(() => parseMediaFiles([raw])).toThrow(expect.objectContaining({
            code: AppErrorCode.PARSE_ERROR,
            message: `Invalid ${context} payload: ${field} must be ${expected}`,
        }));
    });

    it('keeps missing and null optional/default media values at their existing defaults', () => {
        const [file] = parseMediaFiles([{
            id: 9,
            duration: null,
            videoCodec: null,
            Part: [{
                id: 12,
                key: '/library/parts/12',
                size: null,
                videoProfile: null,
            }],
        }]);

        expect(file).toMatchObject({
            id: '9',
            duration: 0,
            bitrate: 0,
            videoCodec: '',
            parts: [{ id: '12', size: 0, file: '', container: '' }],
        });
        expect(file?.parts[0]?.videoProfile).toBeUndefined();
    });
});
