import { SourceResolutionCache } from '../SourceResolutionCache';
import type { ResolvedContentItem } from '../types';

function createItem(
    ratingKey: string,
    scheduledIndex?: number | null
): ResolvedContentItem {
    return {
        ratingKey,
        type: 'movie',
        title: `Movie ${ratingKey}`,
        fullTitle: `Movie ${ratingKey}`,
        durationMs: 1000,
        thumb: null,
        year: 2024,
        scheduledIndex: scheduledIndex as number,
    };
}

describe('SourceResolutionCache', () => {
    it('preserves existing scheduledIndex values when cloning item arrays', () => {
        const cache = new SourceResolutionCache();

        const result = cache.cloneItems([
            createItem('a', 10),
            createItem('b', 0),
            createItem('c', null),
            createItem('d'),
        ]);

        expect(result.map((item) => item.scheduledIndex)).toEqual([10, 0, 2, 3]);
    });
});
