import { ContentSelectionPolicy } from '../ContentSelectionPolicy';
import type { ContentFilter, ResolvedContentItem } from '../types';
import { shuffleWithSeed } from '../../shared/prng';

describe('ContentSelectionPolicy', () => {
    const policy = new ContentSelectionPolicy();
    const items: ResolvedContentItem[] = [
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

    it('uses the supplied seed for random playback ordering', () => {
        const first = policy.applyPlaybackMode(items, 'random', 12_345);
        const second = policy.applyPlaybackMode(items, 'random', 12_345);
        const expected = shuffleWithSeed(items, 12_345).map((item) => item.ratingKey);

        expect(first.map((item) => item.ratingKey)).toEqual(second.map((item) => item.ratingKey));
        expect(first.map((item) => item.ratingKey)).toEqual(expected);
        expect(first.map((item) => item.scheduledIndex)).toEqual([0, 1, 2]);
    });

    it('fails closed for malformed runtime filters', () => {
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
        const optionalMetadataFilters: ContentFilter[] = [
            { field: 'rating', operator: 'gte', value: 4 },
            { field: 'watched', operator: 'eq', value: true },
        ];

        for (const filter of optionalMetadataFilters) {
            expect(policy.applyFilters(items, [filter])).toHaveLength(0);
        }
    });
});
