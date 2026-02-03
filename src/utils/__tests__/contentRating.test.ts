import { formatContentRatingBadge } from '../contentRating';

describe('formatContentRatingBadge', () => {
    it('returns null for empty inputs', () => {
        expect(formatContentRatingBadge(null)).toBeNull();
        expect(formatContentRatingBadge(undefined)).toBeNull();
        expect(formatContentRatingBadge('')).toBeNull();
        expect(formatContentRatingBadge('   ')).toBeNull();
    });

    it('strips conservative region prefixes for compact suffixes', () => {
        expect(formatContentRatingBadge('GB/12A')).toBe('12A');
        expect(formatContentRatingBadge('CA:14A')).toBe('14A');
        expect(formatContentRatingBadge('AU/MA15+')).toBe('MA15+');
    });

    it('does not strip when suffix contains spaces (avoid munging system labels)', () => {
        expect(formatContentRatingBadge('DE/FSK 16')).toBe('DE/FSK 16');
    });

    it('collapses whitespace but otherwise preserves unknown formats', () => {
        expect(formatContentRatingBadge('  FSK   16  ')).toBe('FSK 16');
        expect(formatContentRatingBadge('TV-MA')).toBe('TV-MA');
    });
});

