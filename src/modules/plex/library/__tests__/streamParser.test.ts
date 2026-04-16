import { parseStream } from '../streamParser';
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
});
