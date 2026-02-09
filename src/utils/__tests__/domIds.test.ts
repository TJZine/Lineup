import { buildDeterministicButtonIds, sanitizeDomIdToken } from '../domIds';
import { fnv1a32Hex } from '../hash';

describe('domIds', () => {
    it('sanitizes DOM id tokens', () => {
        expect(sanitizeDomIdToken('a b')).toBe('a_b');
        expect(sanitizeDomIdToken('')).toBe('unknown');
        expect(sanitizeDomIdToken('abc-123_DEF')).toBe('abc-123_DEF');
    });

    it('builds stable deterministic ids with dedupe hashing', () => {
        const prefix = 'btn-test-';
        const ids = buildDeterministicButtonIds(prefix, ['a b', 'a@b', 'a@b']);

        expect(ids).toHaveLength(3);
        expect(ids[0]).toBe('btn-test-a_b');
        expect(ids[1]).toBe(`btn-test-a_b-${fnv1a32Hex('a@b')}`);
        expect(ids[2]).toBe(`btn-test-a_b-${fnv1a32Hex('a@b')}-2`);
    });
});

