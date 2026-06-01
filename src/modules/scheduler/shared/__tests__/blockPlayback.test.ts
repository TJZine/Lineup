import { applyBlockPlaybackMode } from '../blockPlayback';
import type { ResolvedContentItem } from '../../channel-manager/contracts/types';

describe('blockPlayback', () => {
    describe('applyBlockPlaybackMode', () => {
        const makeItem = (ratingKey: string, showThumb: string): ResolvedContentItem => ({
            ratingKey,
            type: 'episode',
            title: ratingKey,
            fullTitle: ratingKey,
            showThumb,
            durationMs: 1,
            thumb: null,
            year: 2000,
            scheduledIndex: 0,
        });

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
            const call = (): void => {
                applyBlockPlaybackMode({
                    items: [],
                    seed: 0,
                    blockSize: 0,
                    shuffleKeys: (keys) => keys,
                });
            };
            expect(call).toThrow(RangeError);
            expect(call).toThrow(/blockSize/);
            expect(call).toThrow(/0/);
        });

        it('throws RangeError when blockSize is negative', () => {
            const call = (): void => {
                applyBlockPlaybackMode({
                    items: [],
                    seed: 0,
                    blockSize: -1,
                    shuffleKeys: (keys) => keys,
                });
            };
            expect(call).toThrow(RangeError);
            expect(call).toThrow(/blockSize/);
            expect(call).toThrow(/-1/);
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

        it('emits items in round-robin blocks (blockSize=1)', () => {
            const items = [
                makeItem('a1', 'A'),
                makeItem('b1', 'B'),
                makeItem('a2', 'A'),
                makeItem('b2', 'B'),
            ];
            const result = applyBlockPlaybackMode({
                items,
                seed: 0,
                blockSize: 1,
                shuffleKeys: (keys) => keys,
            });
            expect(result.map((item) => item.ratingKey)).toEqual(['a1', 'b1', 'a2', 'b2']);
        });

        it('emits blocks per group before rotating (blockSize=2)', () => {
            const items = [
                makeItem('a1', 'A'),
                makeItem('b1', 'B'),
                makeItem('a2', 'A'),
                makeItem('b2', 'B'),
                makeItem('a3', 'A'),
            ];
            const result = applyBlockPlaybackMode({
                items,
                seed: 0,
                blockSize: 2,
                shuffleKeys: (keys) => keys,
            });
            expect(result.map((item) => item.ratingKey)).toEqual(['a1', 'a2', 'b1', 'b2', 'a3']);
        });
    });
});
