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
});
