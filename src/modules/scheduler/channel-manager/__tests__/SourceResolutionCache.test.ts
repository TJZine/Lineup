import { SourceResolutionCache } from '../SourceResolutionCache';
import type { ChannelContentSource, ResolvedContentItem } from '../types';

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

    it('does not start fresh source resolution when the caller is already aborted', async () => {
        const cache = new SourceResolutionCache();
        const source: ChannelContentSource = { type: 'manual', items: [] };
        const controller = new AbortController();
        controller.abort();
        const resolveUncached = jest.fn<Promise<ResolvedContentItem[]>, [ChannelContentSource, { signal: AbortSignal }]>();

        await expect(cache.resolve(source, resolveUncached, {
            signal: controller.signal,
        })).rejects.toMatchObject({ name: 'AbortError' });

        expect(resolveUncached).not.toHaveBeenCalled();
    });
});
