import { parseStream } from '../parsing/streamParser';
import { AppErrorCode } from '../../../../types/app-errors';
import { PlexLibraryError } from '../PlexLibraryError';
import type { RawStream } from '../types';

describe('streamParser', () => {
    it('normalizes optional boolean fields and invalid stream types', () => {
        const stream = parseStream({
            id: 7,
            streamType: 99,
            codec: 'aac',
            DOVIPresent: 'yes',
            selected: true,
            default: false,
        } as unknown as RawStream);

        expect(stream).toMatchObject({
            id: '7',
            streamType: 1,
            codec: 'aac',
            doviPresent: true,
            selected: true,
            default: false,
        });
    });

    it('preserves unknown string booleans as undefined while still recognizing explicit false strings', () => {
        const unknown = parseStream({
            id: 8,
            streamType: 1,
            codec: 'hevc',
            DOVIPresent: 'maybe',
        } as unknown as RawStream);
        const explicitFalse = parseStream({
            id: 9,
            streamType: 1,
            codec: 'hevc',
            DOVIPresent: 'false',
        } as unknown as RawStream);

        expect(unknown.doviPresent).toBeUndefined();
        expect(explicitFalse.doviPresent).toBe(false);
    });

    it('coerces numeric DOVIPresent values', () => {
        const explicitFalse = parseStream({
            id: 10,
            streamType: 1,
            codec: 'hevc',
            DOVIPresent: 0,
        } as unknown as RawStream);
        const explicitTrue = parseStream({
            id: 11,
            streamType: 1,
            codec: 'hevc',
            DOVIPresent: 1,
        } as unknown as RawStream);

        expect(explicitFalse.doviPresent).toBe(false);
        expect(explicitTrue.doviPresent).toBe(true);
    });

    it('normalizes Plex boolean forms and stringifies finite numeric Dolby Vision profiles', () => {
        const stream = parseStream({
            id: 12,
            streamType: 2,
            codec: 'truehd',
            selected: '1',
            default: 0,
            forced: 'no',
            DOVIProfile: 8.1,
        } as unknown as RawStream);

        expect(stream).toMatchObject({
            id: '12',
            selected: true,
            default: false,
            forced: false,
            doviProfile: '8.1',
        });
    });

    it.each([
        ['id', { streamType: 1, codec: 'hevc' }],
        ['streamType', { id: '12', codec: 'hevc' }],
        ['codec', { id: '12', streamType: 1 }],
    ])('throws a typed parse error when required stream scalar %s is missing', (field, raw) => {
        expect(() => parseStream(raw as unknown as RawStream)).toThrow(
            expect.objectContaining({
                code: AppErrorCode.PARSE_ERROR,
                message: `Invalid stream payload: ${field} is required`,
            })
        );
    });

    it('throws a typed parse error when required stream scalars have the wrong type', () => {
        expect(() =>
            parseStream({
                id: '12',
                streamType: '1',
                codec: 'hevc',
            } as unknown as RawStream)
        ).toThrow(
            expect.objectContaining({
                code: AppErrorCode.PARSE_ERROR,
                message: 'Invalid stream payload: streamType is required',
            })
        );
    });

    it.each([
        ['language', 1, 'a string'],
        ['displayTitle', {}, 'a string'],
        ['format', false, 'a string'],
        ['hdr', 1, 'a string'],
        ['width', '1920', 'a finite number'],
        ['frameRate', Number.NaN, 'a finite number'],
        ['bitDepth', [], 'a finite number'],
        ['selected', 'sometimes', 'a boolean, finite number, or recognized boolean string'],
        ['forced', {}, 'a boolean, finite number, or recognized boolean string'],
        ['DOVIProfile', {}, 'a string or finite number'],
        ['DOVIPresent', [], 'a boolean, finite number, or recognized boolean string'],
    ])('rejects wrong-typed optional stream field %s with a sanitized typed error', (field, value, expected) => {
        expect(() => parseStream({
            id: '12',
            streamType: 1,
            codec: 'hevc',
            [field]: value,
        } as unknown as RawStream)).toThrow(expect.objectContaining({
            code: AppErrorCode.PARSE_ERROR,
            message: `Invalid stream payload: ${field} must be ${expected}`,
        }));
    });

    it('omits null optional fields without throwing or manufacturing values', () => {
        const stream = parseStream({
            id: '12',
            streamType: 1,
            codec: 'hevc',
            language: null,
            width: null,
            selected: null,
            DOVIProfile: null,
            DOVIPresent: null,
        } as unknown as RawStream);

        expect(stream.language).toBeUndefined();
        expect(stream.width).toBeUndefined();
        expect(stream.selected).toBeUndefined();
        expect(stream.doviProfile).toBeUndefined();
        expect(stream.doviPresent).toBeUndefined();
    });

    it('surfaces optional scalar failures as PlexLibraryError rather than raw TypeError', () => {
        expect(() => parseStream({
            id: '12',
            streamType: 1,
            codec: 'hevc',
            title: { private: 'not exposed' },
        } as unknown as RawStream)).toThrow(PlexLibraryError);
    });
});
