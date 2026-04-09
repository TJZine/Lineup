import { formatTimecode } from '../formatTimecode';

describe('formatTimecode', () => {
    it('formats finite durations', () => {
        expect(formatTimecode(0)).toBe('0:00');
        expect(formatTimecode(61_000)).toBe('1:01');
        expect(formatTimecode(3_661_000)).toBe('1:01:01');
    });

    it('clamps negative durations to zero', () => {
        expect(formatTimecode(-1_000)).toBe('0:00');
    });

    it('falls back to zero for non-finite inputs', () => {
        expect(formatTimecode(Number.NaN)).toBe('0:00');
        expect(formatTimecode(Number.POSITIVE_INFINITY)).toBe('0:00');
        expect(formatTimecode(Number.NEGATIVE_INFINITY)).toBe('0:00');
    });
});
