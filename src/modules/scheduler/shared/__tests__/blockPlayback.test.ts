import { applyBlockPlaybackMode } from '../blockPlayback';
import type { ResolvedContentItem } from '../../channel-manager/types';

describe('blockPlayback', () => {
    describe('applyBlockPlaybackMode', () => {
        it('throws RangeError when blockSize is 0 (fails fast before grouping)', () => {
            expect(() => {
                applyBlockPlaybackMode({
                    items: [],
                    seed: 0,
                    blockSize: 0,
                    shuffleKeys: (keys) => keys,
                });
            }).toThrow(RangeError);
        });

        it('includes the invalid blockSize value in the error message', () => {
            try {
                applyBlockPlaybackMode({
                    items: [],
                    seed: 0,
                    blockSize: 0,
                    shuffleKeys: (keys) => keys,
                });
                throw new Error('Expected applyBlockPlaybackMode to throw');
            } catch (error) {
                expect(error).toBeInstanceOf(RangeError);
                const message = error instanceof Error ? error.message : String(error);
                expect(message).toContain('blockSize');
                expect(message).toContain('0');
            }
        });

        it('throws RangeError when blockSize is not an integer', () => {
            expect(() => {
                applyBlockPlaybackMode({
                    items: [],
                    seed: 0,
                    blockSize: 1.5,
                    shuffleKeys: (keys) => keys,
                });
            }).toThrow(RangeError);
        });

        it('throws RangeError when blockSize is NaN', () => {
            expect(() => {
                applyBlockPlaybackMode({
                    items: [],
                    seed: 0,
                    blockSize: Number.NaN,
                    shuffleKeys: (keys) => keys,
                });
            }).toThrow(RangeError);
        });

        it('returns empty array for empty items with valid blockSize', () => {
            const result = applyBlockPlaybackMode({
                items: [] as ResolvedContentItem[],
                seed: 0,
                blockSize: 1,
                shuffleKeys: (keys) => keys,
            });
            expect(result).toEqual([]);
        });
    });
});
