import { ChannelResolutionCache } from '../resolution/ChannelResolutionCache';
import type { ResolvedChannelContent } from '../contracts/types';

const createContent = (): ResolvedChannelContent => ({
    channelId: 'channel-1',
    resolvedAt: Date.now(),
    totalDurationMs: 6000,
    items: [
        {
            ratingKey: 'item-1',
            type: 'movie',
            title: 'Original Item',
            fullTitle: 'Original Item',
            durationMs: 6000,
            thumb: null,
            year: 2026,
            scheduledIndex: 0,
            genres: ['Drama'],
            directors: ['Director A'],
            mediaInfo: { resolution: '1080p' },
        },
    ],
    orderedItems: [
        {
            ratingKey: 'item-1',
            type: 'movie',
            title: 'Original Item',
            fullTitle: 'Original Item',
            durationMs: 6000,
            thumb: null,
            year: 2026,
            scheduledIndex: 0,
            genres: ['Drama'],
            directors: ['Director A'],
            mediaInfo: { resolution: '1080p' },
        },
    ],
});

describe('ChannelResolutionCache', () => {
    it('owns stored content instead of keeping caller object references', () => {
        const cache = new ChannelResolutionCache();
        const content = createContent();

        cache.set(content);
        content.items[0]!.title = 'Mutated Item';
        content.items[0]!.genres?.push('Mutated Genre');
        content.items[0]!.mediaInfo!.resolution = '240p';

        const cached = cache.get('channel-1');

        expect(cached?.items[0]?.title).toBe('Original Item');
        expect(cached?.items[0]?.genres).toEqual(['Drama']);
        expect(cached?.items[0]?.mediaInfo).toEqual({ resolution: '1080p' });
    });

    it('returns cloned content so callers cannot mutate cached entries', () => {
        const cache = new ChannelResolutionCache();
        cache.set(createContent());

        const first = cache.get('channel-1');
        first!.items[0]!.title = 'Mutated Item';
        first!.orderedItems[0]!.directors?.push('Mutated Director');

        const second = cache.get('channel-1');

        expect(second).not.toBe(first);
        expect(second?.items[0]?.title).toBe('Original Item');
        expect(second?.orderedItems[0]?.directors).toEqual(['Director A']);
    });
});
