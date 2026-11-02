import { ContentSelectionPolicy } from '../resolution/ContentSelectionPolicy';
import type { ChannelConfig, ContentFilter, ResolvedContentItem } from '../contracts/types';
import { shuffleWithSeed } from '../../shared/prng';

describe('ContentSelectionPolicy', () => {
    const policy = new ContentSelectionPolicy();
    const createItems = (): ResolvedContentItem[] => [
        {
            ratingKey: '1',
            type: 'movie',
            title: 'A',
            fullTitle: 'A',
            durationMs: 3_600_000,
            thumb: null,
            year: 2018,
            scheduledIndex: 0,
            genres: ['Drama'],
            directors: ['Director A'],
        },
        {
            ratingKey: '2',
            type: 'movie',
            title: 'B',
            fullTitle: 'B',
            durationMs: 7_200_000,
            thumb: null,
            year: 2020,
            scheduledIndex: 1,
            genres: ['Comedy'],
            directors: ['Director B'],
        },
        {
            ratingKey: '3',
            type: 'movie',
            title: 'C',
            fullTitle: 'C',
            durationMs: 5_400_000,
            thumb: null,
            year: 2022,
            scheduledIndex: 2,
            genres: ['Action'],
            directors: ['Director C'],
        },
    ];

    it('selects from the full saved channel config without mutating raw items', () => {
        const items = [...createItems(), { ...createItems()[0]!, ratingKey: 'zero', durationMs: 0 }];
        const channel = { contentFilters: [{ field: 'year', operator: 'gte', value: 2020 }],
            sortOrder: 'duration_desc', minEpisodeRunTimeMs: 6_000_000 } as ChannelConfig;

        expect(policy.selectChannelItems(channel, items).map((item) => item.ratingKey)).toEqual(['2']);
        expect(items.map((item) => item.ratingKey)).toEqual(['1', '2', '3', 'zero']);
    });

    it('excludes only season-zero episodes for block channels with specials disabled', () => {
        const items: ResolvedContentItem[] = [
            { ...createItems()[0]!, type: 'episode', ratingKey: 'special', seasonNumber: 0 },
            { ...createItems()[0]!, type: 'episode', ratingKey: 'regular', seasonNumber: 1 },
            { ...createItems()[0]!, type: 'episode', ratingKey: 'unknown' },
            { ...createItems()[0]!, ratingKey: 'movie', seasonNumber: 0 },
        ];
        const block = { playbackMode: 'block', includeSpecials: false } as ChannelConfig;
        expect(policy.selectChannelItems(block, items).map((item) => item.ratingKey))
            .toEqual(['regular', 'unknown', 'movie']);
        expect(policy.selectChannelItems({ ...block, includeSpecials: true }, items)).toHaveLength(4);
        const legacy = { ...block };
        delete legacy.includeSpecials;
        expect(policy.selectChannelItems(legacy, items)).toHaveLength(4);
        expect(policy.selectChannelItems({ ...block, playbackMode: 'shuffle' }, items)).toHaveLength(4);
    });

    it('uses the supplied seed for random playback ordering', () => {
        const items = createItems();
        const first = policy.applyPlaybackMode(items, 'random', 12_345);
        const second = policy.applyPlaybackMode(items, 'random', 12_345);
        const expected = shuffleWithSeed(items, 12_345).map((item) => item.ratingKey);

        expect(first.map((item) => item.ratingKey)).toEqual(second.map((item) => item.ratingKey));
        expect(first.map((item) => item.ratingKey)).toEqual(expected);
        expect(first.map((item) => item.scheduledIndex)).toEqual([0, 1, 2]);
    });

    it('rejects unknown runtime playback modes', () => {
        expect(() => policy.applyPlaybackMode(
            createItems(),
            'unexpected' as never,
            12_345
        )).toThrow('Unknown content playback mode: unexpected');
    });

    it.each(['shuffle', 'random'] as const)('keeps %s content order stable across Plex response permutations', (mode) => {
        const items = createItems();
        const expected = policy.applyPlaybackMode(items, mode, 73);
        const reversed = [...items].reverse();
        expect(policy.applyPlaybackMode(reversed, mode, 73)).toEqual(expected);
        expect(reversed.map((item) => item.ratingKey)).toEqual(['3', '2', '1']);
        expect(policy.applyPlaybackMode(items, 'sequential', 73).map((item) => item.ratingKey))
            .toEqual(['1', '2', '3']);
        expect(policy.applyPlaybackMode(reversed, 'sequential', 73).map((item) => item.ratingKey))
            .toEqual(['3', '2', '1']);
    });

    it('applies genre and director filters with matching list semantics', () => {
        const items: ResolvedContentItem[] = [
            ...createItems(),
            {
                ratingKey: '4',
                type: 'movie',
                title: 'D',
                fullTitle: 'D',
                durationMs: 3_000_000,
                thumb: null,
                year: 2024,
                scheduledIndex: 3,
                genres: [],
                directors: [],
            },
        ];

        const listFilterCases: Array<{
            field: 'genre' | 'director';
            value: string;
            expectations: Record<'contains' | 'notContains' | 'eq' | 'neq', string[]>;
        }> = [
            {
                field: 'genre',
                value: 'dRaMa',
                expectations: {
                    contains: ['1'],
                    notContains: ['2', '3', '4'],
                    eq: ['1'],
                    neq: ['2', '3', '4'],
                },
            },
            {
                field: 'director',
                value: 'dIrEcToR a',
                expectations: {
                    contains: ['1'],
                    notContains: ['2', '3', '4'],
                    eq: ['1'],
                    neq: ['2', '3', '4'],
                },
            },
        ];

        for (const { field, value, expectations } of listFilterCases) {
            for (const [operator, expectedRatingKeys] of Object.entries(expectations)) {
                const result = policy.applyFilters(items, [
                    { field, operator: operator as ContentFilter['operator'], value },
                ]);

                expect(result.map((item) => item.ratingKey)).toEqual(expectedRatingKeys);
            }
        }
    });

    it('fails closed for unsupported list filter operators', () => {
        const items = createItems();
        const unsupportedListFilters = [
            { field: 'genre', operator: 'gt', value: 'Drama' },
            { field: 'director', operator: 'lte', value: 'Director A' },
        ];

        for (const filter of unsupportedListFilters) {
            expect(policy.applyFilters(items, [filter as ContentFilter])).toHaveLength(0);
        }
    });

    it('fails closed for malformed runtime filters', () => {
        const items = createItems();
        const malformedFilters = [
            { field: 'unknown', operator: 'eq', value: 2020 },
            { field: 'year', operator: 'unknown', value: 2020 },
            { field: 'year', operator: 'gt', value: 'not-a-number' },
            { field: 'genre', operator: 'gt', value: 'Drama' },
            { field: 'director', operator: 'lte', value: 'Director A' },
        ];

        for (const filter of malformedFilters) {
            expect(policy.applyFilters(items, [filter as ContentFilter])).toHaveLength(0);
        }
    });

    it('fails closed when optional metadata fields are missing from runtime items', () => {
        const items = createItems();
        const optionalMetadataFilters: ContentFilter[] = [
            { field: 'rating', operator: 'gte', value: 4 },
            { field: 'watched', operator: 'eq', value: true },
        ];

        for (const filter of optionalMetadataFilters) {
            expect(policy.applyFilters(items, [filter])).toHaveLength(0);
        }
    });
});
