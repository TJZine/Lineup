import { summarizeChannelSetupPlannerDiagnostics } from '../diagnostics/AppDiagnosticsChannelSetupSummary';

describe('summarizeChannelSetupPlannerDiagnostics', () => {
    it('returns bounded overview and capped family samples', () => {
        const summary = summarizeChannelSetupPlannerDiagnostics({
            status: 'ready',
            warnings: ['warn-1', 'warn-2', 'warn-3', 'warn-4'],
            reachedMaxChannels: true,
            diagnostics: {
                effectiveMaxChannels: 500,
                minItems: 5,
                fetchedTagsByFamily: {
                    genres: [
                        { libraryId: 'lib-1', libraryName: 'Shows', count: 4 },
                        { libraryId: 'lib-2', libraryName: 'Movies', count: 3 },
                    ],
                    directors: [],
                    decades: [],
                    studios: [],
                    actors: [
                        { libraryId: 'lib-1', libraryName: 'Shows', count: 9 },
                        { libraryId: 'lib-2', libraryName: 'Movies', count: 4 },
                    ],
                },
                tagCountDiagnosticsByFamily: {
                    genres: [{
                        libraryId: 'lib-1',
                        libraryName: 'Shows',
                        rawTagCount: 4,
                        effectiveCandidateCount: 4,
                        candidatesWithKnownCount: 4,
                        candidatesWithUnknownCount: 0,
                        candidatesBelowMinItems: 1,
                        minKnownCount: 2,
                        maxKnownCount: 22,
                        sampleKnownCounts: [
                            { title: 'Comedy', count: 22 },
                            { title: 'Drama', count: 11 },
                            { title: 'Mystery', count: 7 },
                            { title: 'Thriller', count: 6 },
                        ],
                        sampleUnknownCountTitles: [],
                        sampleBelowMinItems: [
                            { title: 'Mystery', count: 2 },
                            { title: 'Noir', count: 1 },
                        ],
                    }],
                    directors: [],
                    decades: [],
                    studios: [],
                    actors: [{
                        libraryId: 'lib-1',
                        libraryName: 'Shows',
                        rawTagCount: 9,
                        effectiveCandidateCount: 9,
                        candidatesWithKnownCount: 7,
                        candidatesWithUnknownCount: 2,
                        candidatesBelowMinItems: 2,
                        minKnownCount: 1,
                        maxKnownCount: 30,
                        sampleKnownCounts: [
                            { title: 'Lead Actor', count: 30 },
                            { title: 'Guest Actor', count: 20 },
                            { title: 'Recurring Actor', count: 15 },
                            { title: 'Fourth Actor', count: 8 },
                        ],
                        sampleUnknownCountTitles: ['Mystery Guest', 'Unknown Star', 'Lost Credit', 'Unlisted'],
                        sampleBelowMinItems: [
                            { title: 'Bit Part', count: 1 },
                            { title: 'Cameo', count: 2 },
                            { title: 'Walk On', count: 4 },
                            { title: 'One Scene', count: 3 },
                        ],
                    }, {
                        libraryId: 'lib-2',
                        libraryName: 'Movies',
                        rawTagCount: 4,
                        effectiveCandidateCount: 4,
                        candidatesWithKnownCount: 3,
                        candidatesWithUnknownCount: 1,
                        candidatesBelowMinItems: 1,
                        minKnownCount: 3,
                        maxKnownCount: 12,
                        sampleKnownCounts: [
                            { title: 'Movie Lead', count: 12 },
                            { title: 'Movie Support', count: 9 },
                        ],
                        sampleUnknownCountTitles: ['Unbilled'],
                        sampleBelowMinItems: [
                            { title: 'Tiny Role', count: 3 },
                        ],
                    }],
                },
                candidatesBeforeMinItems: {
                    total: 16,
                    collections: 0,
                    playlists: 0,
                    genres: 4,
                    directors: 0,
                    decades: 0,
                    recentlyAdded: 0,
                    studios: 0,
                    actors: 12,
                },
                candidatesAfterMinItems: {
                    total: 12,
                    collections: 0,
                    playlists: 0,
                    genres: 3,
                    directors: 0,
                    decades: 0,
                    recentlyAdded: 0,
                    studios: 0,
                    actors: 9,
                },
                strategyBucketSizes: {
                    total: 12,
                    collections: 0,
                    playlists: 0,
                    genres: 3,
                    directors: 0,
                    decades: 0,
                    recentlyAdded: 0,
                    studios: 0,
                    actors: 9,
                },
                afterAlternateLineups: {
                    total: 12,
                    collections: 0,
                    playlists: 0,
                    genres: 3,
                    directors: 0,
                    decades: 0,
                    recentlyAdded: 0,
                    studios: 0,
                    actors: 9,
                },
                afterVariants: {
                    total: 12,
                    collections: 0,
                    playlists: 0,
                    genres: 3,
                    directors: 0,
                    decades: 0,
                    recentlyAdded: 0,
                    studios: 0,
                    actors: 9,
                },
                afterMaxChannels: {
                    total: 10,
                    collections: 0,
                    playlists: 0,
                    genres: 3,
                    directors: 0,
                    decades: 0,
                    recentlyAdded: 0,
                    studios: 0,
                    actors: 7,
                },
                lostToMaxChannels: {
                    total: 2,
                    collections: 0,
                    playlists: 0,
                    genres: 0,
                    directors: 0,
                    decades: 0,
                    recentlyAdded: 0,
                    studios: 0,
                    actors: 2,
                },
            },
        });

        expect(summary.overview).toEqual({
            status: 'ready',
            reachedMaxChannels: true,
            warningCount: 4,
            effectiveMaxChannels: 500,
            minItems: 5,
            candidatesBeforeMinItems: 16,
            candidatesAfterMinItems: 12,
            afterMaxChannels: 10,
            lostToMaxChannels: 2,
        });
        expect(summary.warnings).toEqual(['warn-1', 'warn-2', 'warn-3', '+1 more warning']);
        expect(summary.familySummaries).toEqual([
            {
                family: 'actors',
                fetchedLibraryCount: 2,
                diagnosticLibraryCount: 2,
                fetchedTagCount: 13,
                rawTagCount: 13,
                effectiveCandidateCount: 13,
                candidatesWithUnknownCount: 3,
                candidatesBelowMinItems: 3,
                knownCountRange: '1-30',
                sampleKnownCounts: ['Lead Actor (30)', 'Guest Actor (20)', 'Recurring Actor (15)', '+3 more known-count samples'],
                sampleUnknownCountTitles: ['Lost Credit', 'Mystery Guest', 'Unbilled', '+2 more unknown-count titles'],
                sampleBelowMinItems: ['Walk On (4)', 'One Scene (3)', 'Tiny Role (3)', '+2 more below-min samples'],
            },
            {
                family: 'genres',
                fetchedLibraryCount: 2,
                diagnosticLibraryCount: 1,
                fetchedTagCount: 7,
                rawTagCount: 4,
                effectiveCandidateCount: 4,
                candidatesWithUnknownCount: 0,
                candidatesBelowMinItems: 1,
                knownCountRange: '2-22',
                sampleKnownCounts: ['Comedy (22)', 'Drama (11)', 'Mystery (7)', '+1 more known-count sample'],
                sampleUnknownCountTitles: [],
                sampleBelowMinItems: ['Mystery (2)', 'Noir (1)'],
            },
        ]);
    });

    it('stays compact when planner diagnostics are unavailable', () => {
        const summary = summarizeChannelSetupPlannerDiagnostics({
            status: 'slow',
            warnings: [],
            reachedMaxChannels: false,
            diagnostics: null,
            message: 'Still loading diagnostics',
        });

        expect(summary.overview).toEqual({
            status: 'slow',
            reachedMaxChannels: false,
            warningCount: 0,
            effectiveMaxChannels: null,
            minItems: null,
            candidatesBeforeMinItems: null,
            candidatesAfterMinItems: null,
            afterMaxChannels: null,
            lostToMaxChannels: null,
        });
        expect(summary.warnings).toEqual([]);
        expect(summary.familySummaries).toEqual([]);
        expect(summary.notes).toEqual(['Still loading diagnostics']);
    });
});
