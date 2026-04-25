/**
 * @fileoverview Planner-local strategy builders for channel setup candidates.
 * @module core/channel-setup/planning/ChannelSetupStrategyBuilders
 */

import type {
    ChannelSetupConfig,
    ChannelSetupEstimates,
    SetupStrategyKey,
} from '../types';
import type {
    PlexCollection,
    PlexLibrarySection,
    PlexPlaylist,
    PlexTagDirectoryItem,
} from '../../../modules/plex/library';
import type { ChannelConfig } from '../../../modules/scheduler/channel-manager';
import { buildChannelSetupTagFilter } from './ChannelSetupTagFilters';
import type { PendingChannel } from './ChannelSetupPlanner';

type StrategyBuckets = Record<SetupStrategyKey, PendingChannel[]>;

type CategoryCandidate = {
    strategy: SetupStrategyKey;
    categoryKey: string;
    categoryLabel: string;
    baseSource: ChannelConfig['contentSource'];
    sourceLibraryId?: string;
    sourceLibraryName?: string;
    itemCount?: number;
};

interface ChannelSetupStrategyBuildersInput {
    config: ChannelSetupConfig;
    selectedLibraries: PlexLibrarySection[];
    playlists: PlexPlaylist[];
    collectionsByLibraryId: Map<string, PlexCollection[]>;
    genresByLibraryId: Map<string, PlexTagDirectoryItem[]>;
    directorsByLibraryId: Map<string, PlexTagDirectoryItem[]>;
    yearsByLibraryId: Map<string, PlexTagDirectoryItem[]>;
    actorsByLibraryId: Map<string, PlexTagDirectoryItem[]>;
    studiosByLibraryId: Map<string, PlexTagDirectoryItem[]>;
    minItems: number;
    seedFor: (value: string) => number;
}

export interface ChannelSetupStrategyBuildResult {
    strategyBuckets: StrategyBuckets;
    candidatesBeforeMinItems: ChannelSetupEstimates;
    candidatesAfterMinItems: ChannelSetupEstimates;
    skipped: number;
}

const emptyEstimates = (): ChannelSetupEstimates => ({
    total: 0,
    collections: 0,
    playlists: 0,
    genres: 0,
    directors: 0,
    decades: 0,
    recentlyAdded: 0,
    studios: 0,
    actors: 0,
});

const addEstimateCount = (estimates: ChannelSetupEstimates, strategy: SetupStrategyKey, amount: number = 1): void => {
    if (amount <= 0) {
        return;
    }
    estimates.total += amount;
    estimates[strategy] += amount;
};

const getLibraryMediaType = (library: PlexLibrarySection): 'movie' | 'show' => (
    library.type === 'movie' ? 'movie' : 'show'
);

const sortPlaylistsByCountThenTitle = (playlists: PlexPlaylist[]): PlexPlaylist[] => (
    [...playlists].sort((a, b) => {
        const countDiff = b.leafCount - a.leafCount;
        if (countDiff !== 0) return countDiff;
        const titleDiff = a.title.localeCompare(b.title);
        if (titleDiff !== 0) return titleDiff;
        return a.ratingKey.localeCompare(b.ratingKey);
    })
);

const sortTagsByCountThenTitle = (tags: PlexTagDirectoryItem[]): PlexTagDirectoryItem[] => (
    [...tags].sort((a, b) => {
        const countDiff = (b.count ?? 0) - (a.count ?? 0);
        if (countDiff !== 0) return countDiff;
        const titleDiff = a.title.localeCompare(b.title);
        if (titleDiff !== 0) return titleDiff;
        return a.key.localeCompare(b.key);
    })
);

const sortCategoryCandidates = (candidates: CategoryCandidate[]): CategoryCandidate[] => {
    const compare = (a: string, b: string): number => {
        if (a === b) return 0;
        return a < b ? -1 : 1;
    };
    return [...candidates].sort((a, b) => {
        const countDiff = (b.itemCount ?? 0) - (a.itemCount ?? 0);
        if (countDiff !== 0) return countDiff;
        const aLabel = a.categoryLabel.toLowerCase();
        const bLabel = b.categoryLabel.toLowerCase();
        const labelDiff = compare(aLabel, bLabel);
        if (labelDiff !== 0) return labelDiff;
        return compare(a.categoryKey, b.categoryKey);
    });
};

const tagMeetsMinItems = (tag: PlexTagDirectoryItem, minItems: number): boolean => (
    tag.count === null || tag.count >= minItems
);

const getTagItemCount = (tag: PlexTagDirectoryItem): number | undefined => (
    tag.count === null ? undefined : tag.count
);

const withOptionalItemCount = (
    candidate: Omit<CategoryCandidate, 'itemCount'>,
    itemCount: number | undefined
): CategoryCandidate => {
    if (itemCount === undefined) {
        return candidate;
    }
    return {
        ...candidate,
        itemCount,
    };
};

const createLibrarySource = (
    library: PlexLibrarySection,
    libraryFilter?: Record<string, string | number>
): ChannelConfig['contentSource'] => ({
    type: 'library',
    libraryId: library.id,
    libraryType: getLibraryMediaType(library),
    includeWatched: true,
    ...(libraryFilter ? { libraryFilter } : {}),
});

const toDecadeValue = (tag: PlexTagDirectoryItem): number | null => {
    const year = Number.parseInt(tag.title, 10);
    if (!Number.isFinite(year)) {
        return null;
    }
    return Math.floor(year / 10) * 10;
};

const buildCrossLibraryFacetCandidates = (
    libraries: PlexLibrarySection[],
    tagsByLibraryId: Map<string, PlexTagDirectoryItem[]>,
    minItems: number,
    strategy: SetupStrategyKey,
    buildLibraryFilter: (tag: PlexTagDirectoryItem) => Record<string, string | number>
): CategoryCandidate[] => {
    const grouped = new Map<
        string,
        { label: string; totalCount: number; hasUnknownCount: boolean; sources: ChannelConfig['contentSource'][] }
    >();

    for (const library of libraries) {
        const tags = sortTagsByCountThenTitle(tagsByLibraryId.get(library.id) ?? []);
        for (const tag of tags) {
            const key = tag.title.trim().toLowerCase();
            if (!key) continue;
            const entry = grouped.get(key) ?? {
                label: tag.title,
                totalCount: 0,
                hasUnknownCount: false,
                sources: [] as ChannelConfig['contentSource'][],
            };
            if (tag.count === null) {
                entry.hasUnknownCount = true;
            } else {
                entry.totalCount += tag.count;
            }
            entry.sources.push(createLibrarySource(library, buildLibraryFilter(tag)));
            grouped.set(key, entry);
        }
    }

    const candidates: CategoryCandidate[] = [];
    for (const [categoryKey, entry] of grouped.entries()) {
        const passesMinItems = entry.hasUnknownCount || entry.totalCount >= minItems;
        if (!passesMinItems) continue;
        const baseSource: ChannelConfig['contentSource'] = entry.sources.length > 1
            ? { type: 'mixed', mixMode: 'interleave', sources: entry.sources }
            : entry.sources[0] ?? { type: 'manual', items: [] };
        candidates.push(withOptionalItemCount({
            strategy,
            categoryKey,
            categoryLabel: entry.label,
            baseSource,
        }, entry.totalCount > 0 ? entry.totalCount : undefined));
    }

    return sortCategoryCandidates(candidates);
};

function combineTagSources(
    libraries: PlexLibrarySection[],
    tagsByLibraryId: Map<string, PlexTagDirectoryItem[]>,
    type: 'actor' | 'studio'
): Array<{ key: string; title: string; totalCount: number; hasUnknownCount: boolean; sources: ChannelConfig['contentSource'][] }> {
    const grouped = new Map<
        string,
        { title: string; totalCount: number; hasUnknownCount: boolean; sources: ChannelConfig['contentSource'][] }
    >();

    for (const library of libraries) {
        const tags = sortTagsByCountThenTitle(tagsByLibraryId.get(library.id) ?? []);
        for (const tag of tags) {
            const groupKey = tag.title.trim().toLowerCase();
            if (!groupKey) continue;
            const entry = grouped.get(groupKey) ?? { title: tag.title, totalCount: 0, hasUnknownCount: false, sources: [] };
            if (tag.count === null) {
                entry.hasUnknownCount = true;
            } else {
                entry.totalCount += tag.count;
            }
            entry.sources.push({
                ...createLibrarySource(library, buildChannelSetupTagFilter(tag, type)),
            });
            grouped.set(groupKey, entry);
        }
    }

    return Array.from(grouped.entries())
        .map(([key, entry]) => ({
            key,
            title: entry.title,
            totalCount: entry.totalCount,
            hasUnknownCount: entry.hasUnknownCount,
            sources: entry.sources,
        }))
        .sort((a, b) => {
            const countDiff = b.totalCount - a.totalCount;
            if (countDiff !== 0) return countDiff;
            const titleDiff = a.title.localeCompare(b.title);
            if (titleDiff !== 0) return titleDiff;
            return a.key.localeCompare(b.key);
        });
}

const countUniqueTagTitles = (
    libraries: PlexLibrarySection[],
    tagsByLibraryId: Map<string, PlexTagDirectoryItem[]>
): number => Array.from(
    new Set(
        libraries.flatMap((library) =>
            (tagsByLibraryId.get(library.id) ?? [])
                .map((tag) => tag.title.trim().toLowerCase())
                .filter((title) => title.length > 0)
        )
    )
).length;

export function buildChannelSetupStrategyBuckets(
    input: ChannelSetupStrategyBuildersInput
): ChannelSetupStrategyBuildResult {
    const {
        config,
        selectedLibraries,
        playlists,
        collectionsByLibraryId,
        genresByLibraryId,
        directorsByLibraryId,
        yearsByLibraryId,
        actorsByLibraryId,
        studiosByLibraryId,
        minItems,
        seedFor,
    } = input;

    let skipped = 0;
    const candidatesBeforeMinItems = emptyEstimates();
    const candidatesAfterMinItems = emptyEstimates();
    const strategyBuckets: StrategyBuckets = {
        collections: [],
        playlists: [],
        genres: [],
        directors: [],
        decades: [],
        recentlyAdded: [],
        studios: [],
        actors: [],
    };

    const recordCandidate = (strategy: SetupStrategyKey, passesMinItems: boolean, amount: number = 1): void => {
        addEstimateCount(candidatesBeforeMinItems, strategy, amount);
        if (passesMinItems) {
            addEstimateCount(candidatesAfterMinItems, strategy, amount);
        }
    };

    const recordMinItemOutcome = (
        strategy: SetupStrategyKey,
        passesMinItems: boolean,
        amount: number = 1
    ): void => {
        recordCandidate(strategy, passesMinItems, amount);
        if (!passesMinItems && amount > 0) {
            skipped += amount;
        }
    };

    const isStrategyEnabled = (strategy: SetupStrategyKey): boolean => {
        return config.strategyConfig[strategy]?.enabled === true;
    };

    const getStrategyScope = (strategy: SetupStrategyKey): 'per-library' | 'cross-library' => {
        return config.strategyConfig[strategy]?.scope === 'cross-library' ? 'cross-library' : 'per-library';
    };

    const addStrategyChannel = (strategy: SetupStrategyKey, channel: PendingChannel): void => {
        strategyBuckets[strategy].push({
            ...channel,
            buildStrategy: strategy,
            lineupReplicaIndex: channel.lineupReplicaIndex ?? 0,
            isPlaybackModeVariant: channel.isPlaybackModeVariant === true,
        });
    };

    if (isStrategyEnabled('playlists')) {
        const orderedPlaylists = sortPlaylistsByCountThenTitle(playlists);
        for (const pl of orderedPlaylists) {
            const passesMinItems = pl.leafCount >= minItems;
            recordMinItemOutcome('playlists', passesMinItems);
            if (passesMinItems) {
                addStrategyChannel('playlists', {
                    name: pl.title,
                    contentSource: {
                        type: 'playlist',
                        playlistKey: pl.ratingKey,
                        playlistName: pl.title,
                    },
                    playbackMode: 'shuffle',
                    shuffleSeed: seedFor(`playlist:${pl.ratingKey}`),
                    isAutoGenerated: true,
                });
            }
        }
    }

    const actorStudioCombineMode = config.actorStudioCombineMode ?? 'separate';

    for (const library of selectedLibraries) {
        if (isStrategyEnabled('collections')) {
            const collections = collectionsByLibraryId.get(library.id) ?? [];
            const candidates: CategoryCandidate[] = [];
            for (const collection of collections) {
                const passesMinItems = collection.childCount >= minItems;
                recordMinItemOutcome('collections', passesMinItems);
                if (passesMinItems) {
                    candidates.push({
                        strategy: 'collections',
                        categoryKey: collection.ratingKey,
                        categoryLabel: collection.title,
                        itemCount: collection.childCount,
                        baseSource: {
                            type: 'collection',
                            collectionKey: collection.ratingKey,
                            collectionName: collection.title,
                        },
                        sourceLibraryId: library.id,
                        sourceLibraryName: library.title,
                    });
                }
            }
            for (const candidate of sortCategoryCandidates(candidates)) {
                addStrategyChannel('collections', {
                    name: candidate.categoryLabel,
                    contentSource: candidate.baseSource,
                    playbackMode: 'shuffle',
                    shuffleSeed: seedFor(`collection:${candidate.categoryKey}`),
                    isAutoGenerated: true,
                    sourceLibraryId: library.id,
                    sourceLibraryName: library.title,
                });
            }
        }

        if (isStrategyEnabled('recentlyAdded')) {
            recordCandidate('recentlyAdded', true);
            addStrategyChannel('recentlyAdded', {
                name: `${library.title} - Recently Added`,
                contentSource: createLibrarySource(library),
                sortOrder: 'added_desc',
                playbackMode: 'sequential',
                shuffleSeed: seedFor(`recentlyAdded:${library.id}`),
                isAutoGenerated: true,
                sourceLibraryId: library.id,
                sourceLibraryName: library.title,
            });
        }

        if (isStrategyEnabled('genres') || isStrategyEnabled('directors') || isStrategyEnabled('decades')) {
            const genres = sortTagsByCountThenTitle(genresByLibraryId.get(library.id) ?? []);
            const directors = sortTagsByCountThenTitle(directorsByLibraryId.get(library.id) ?? []);
            const years = yearsByLibraryId.get(library.id) ?? [];

            if (isStrategyEnabled('genres') && getStrategyScope('genres') === 'per-library') {
                const candidates: CategoryCandidate[] = [];
                for (const genre of genres) {
                    const passesMinItems = tagMeetsMinItems(genre, minItems);
                    recordMinItemOutcome('genres', passesMinItems);
                    if (!passesMinItems) continue;
                    candidates.push(withOptionalItemCount({
                        strategy: 'genres',
                        categoryKey: `${library.id}:${genre.title.toLowerCase()}`,
                        categoryLabel: genre.title,
                        baseSource: createLibrarySource(library, { genre: genre.title }),
                        sourceLibraryId: library.id,
                        sourceLibraryName: library.title,
                    }, getTagItemCount(genre)));
                }
                for (const candidate of sortCategoryCandidates(candidates)) {
                    addStrategyChannel('genres', {
                        name: `${library.title} - ${candidate.categoryLabel}`,
                        contentSource: candidate.baseSource,
                        playbackMode: 'shuffle',
                        shuffleSeed: seedFor(`genre:${library.id}:${candidate.categoryLabel}`),
                        isAutoGenerated: true,
                        sourceLibraryId: library.id,
                        sourceLibraryName: library.title,
                    });
                }
            }

            if (isStrategyEnabled('directors') && getStrategyScope('directors') === 'per-library') {
                const candidates: CategoryCandidate[] = [];
                for (const director of directors) {
                    const passesMinItems = tagMeetsMinItems(director, minItems);
                    recordMinItemOutcome('directors', passesMinItems);
                    if (!passesMinItems) continue;
                    candidates.push(withOptionalItemCount({
                        strategy: 'directors',
                        categoryKey: `${library.id}:${director.title.toLowerCase()}`,
                        categoryLabel: director.title,
                        baseSource: createLibrarySource(library),
                        sourceLibraryId: library.id,
                        sourceLibraryName: library.title,
                    }, getTagItemCount(director)));
                }
                for (const candidate of sortCategoryCandidates(candidates)) {
                    addStrategyChannel('directors', {
                        name: `${library.title} - ${candidate.categoryLabel}`,
                        contentSource: candidate.baseSource,
                        contentFilters: [{ field: 'director', operator: 'eq', value: candidate.categoryLabel }],
                        playbackMode: 'shuffle',
                        shuffleSeed: seedFor(`director:${library.id}:${candidate.categoryLabel}`),
                        isAutoGenerated: true,
                        sourceLibraryId: library.id,
                        sourceLibraryName: library.title,
                    });
                }
            }

            if (isStrategyEnabled('decades')) {
                const decadeCounts = new Map<number, number>();
                const decadesWithUnknownCounts = new Set<number>();
                for (const yearTag of years) {
                    const decade = toDecadeValue(yearTag);
                    if (decade === null) {
                        continue;
                    }
                    if (yearTag.count === null) {
                        decadesWithUnknownCounts.add(decade);
                        continue;
                    }
                    decadeCounts.set(decade, (decadeCounts.get(decade) || 0) + yearTag.count);
                }
                const sortedDecades = Array.from(new Set([...decadeCounts.keys(), ...decadesWithUnknownCounts.values()]))
                    .sort((a, b) => a - b)
                    .filter((decade) => decadesWithUnknownCounts.has(decade) || (decadeCounts.get(decade) ?? 0) >= minItems);
                const allDecades = new Set<number>([...decadeCounts.keys(), ...decadesWithUnknownCounts.values()]);

                for (const decade of allDecades) {
                    const passesMinItems =
                        decadesWithUnknownCounts.has(decade) ||
                        (decadeCounts.get(decade) ?? 0) >= minItems;
                    recordMinItemOutcome('decades', passesMinItems);
                }

                for (const decade of sortedDecades) {
                    addStrategyChannel('decades', {
                        name: `${library.title} - ${decade}s`,
                        contentSource: createLibrarySource(library),
                        contentFilters: [
                            { field: 'year', operator: 'gte', value: decade },
                            { field: 'year', operator: 'lt', value: decade + 10 },
                        ],
                        playbackMode: 'shuffle',
                        shuffleSeed: seedFor(`decade:${library.id}:${decade}`),
                        isAutoGenerated: true,
                        sourceLibraryId: library.id,
                        sourceLibraryName: library.title,
                    });
                }
            }
        }
    }

    if (isStrategyEnabled('genres') && getStrategyScope('genres') === 'cross-library') {
        const candidates = buildCrossLibraryFacetCandidates(
            selectedLibraries,
            genresByLibraryId,
            minItems,
            'genres',
            (tag) => ({ genre: tag.title })
        );
        for (const candidate of candidates) {
            recordMinItemOutcome('genres', true);
            addStrategyChannel('genres', {
                name: candidate.categoryLabel,
                contentSource: candidate.baseSource,
                playbackMode: 'shuffle',
                shuffleSeed: seedFor(`genre:cross:${candidate.categoryKey}`),
                isAutoGenerated: true,
            });
        }
        const skippedCrossLibraryGenres = countUniqueTagTitles(selectedLibraries, genresByLibraryId) - candidates.length;
        if (skippedCrossLibraryGenres > 0) {
            recordMinItemOutcome('genres', false, skippedCrossLibraryGenres);
        }
    }

    if (isStrategyEnabled('directors') && getStrategyScope('directors') === 'cross-library') {
        const candidates = buildCrossLibraryFacetCandidates(
            selectedLibraries,
            directorsByLibraryId,
            minItems,
            'directors',
            (tag) => ({ director: tag.title })
        );
        for (const candidate of candidates) {
            recordMinItemOutcome('directors', true);
            addStrategyChannel('directors', {
                name: candidate.categoryLabel,
                contentSource: candidate.baseSource,
                playbackMode: 'shuffle',
                shuffleSeed: seedFor(`director:cross:${candidate.categoryKey}`),
                isAutoGenerated: true,
            });
        }
        const skippedCrossLibraryDirectors = countUniqueTagTitles(selectedLibraries, directorsByLibraryId) - candidates.length;
        if (skippedCrossLibraryDirectors > 0) {
            recordMinItemOutcome('directors', false, skippedCrossLibraryDirectors);
        }
    }

    if (isStrategyEnabled('studios')) {
        const studioScope = getStrategyScope('studios');
        if (actorStudioCombineMode === 'combined' || studioScope === 'cross-library') {
            const combined = combineTagSources(selectedLibraries, studiosByLibraryId, 'studio');
            for (const tag of combined) {
                const passesMinItems = tag.hasUnknownCount || tag.totalCount >= minItems;
                recordMinItemOutcome('studios', passesMinItems);
                if (!passesMinItems) continue;
                addStrategyChannel('studios', {
                    name: tag.title,
                    contentSource: {
                        type: 'mixed',
                        mixMode: studioScope === 'cross-library' ? 'interleave' : 'sequential',
                        sources: tag.sources,
                    },
                    playbackMode: 'shuffle',
                    shuffleSeed: seedFor(`studio:${tag.key}`),
                    isAutoGenerated: true,
                });
            }
        } else {
            for (const library of selectedLibraries) {
                const tags = sortTagsByCountThenTitle(studiosByLibraryId.get(library.id) ?? []);
                for (const tag of tags) {
                    const passesMinItems = tagMeetsMinItems(tag, minItems);
                    recordMinItemOutcome('studios', passesMinItems);
                    if (!passesMinItems) continue;
                    addStrategyChannel('studios', {
                        name: `${tag.title} - ${library.type === 'movie' ? 'Movies' : 'TV'}`,
                        contentSource: createLibrarySource(library, buildChannelSetupTagFilter(tag, 'studio')),
                        playbackMode: 'shuffle',
                        shuffleSeed: seedFor(`studio:${library.id}:${tag.key}`),
                        isAutoGenerated: true,
                        sourceLibraryId: library.id,
                        sourceLibraryName: library.title,
                    });
                }
            }
        }
    }

    if (isStrategyEnabled('actors')) {
        const actorScope = getStrategyScope('actors');
        if (actorStudioCombineMode === 'combined' || actorScope === 'cross-library') {
            const combined = combineTagSources(selectedLibraries, actorsByLibraryId, 'actor');
            for (const tag of combined) {
                const passesMinItems = tag.hasUnknownCount || tag.totalCount >= minItems;
                recordMinItemOutcome('actors', passesMinItems);
                if (!passesMinItems) continue;
                addStrategyChannel('actors', {
                    name: tag.title,
                    contentSource: {
                        type: 'mixed',
                        mixMode: actorScope === 'cross-library' ? 'interleave' : 'sequential',
                        sources: tag.sources,
                    },
                    playbackMode: 'shuffle',
                    shuffleSeed: seedFor(`actor:${tag.key}`),
                    isAutoGenerated: true,
                });
            }
        } else {
            for (const library of selectedLibraries) {
                const tags = sortTagsByCountThenTitle(actorsByLibraryId.get(library.id) ?? []);
                for (const tag of tags) {
                    const passesMinItems = tagMeetsMinItems(tag, minItems);
                    recordMinItemOutcome('actors', passesMinItems);
                    if (!passesMinItems) continue;
                    addStrategyChannel('actors', {
                        name: `${tag.title} - ${library.type === 'movie' ? 'Movies' : 'TV'}`,
                        contentSource: createLibrarySource(library, buildChannelSetupTagFilter(tag, 'actor')),
                        playbackMode: 'shuffle',
                        shuffleSeed: seedFor(`actor:${library.id}:${tag.key}`),
                        isAutoGenerated: true,
                        sourceLibraryId: library.id,
                        sourceLibraryName: library.title,
                    });
                }
            }
        }
    }

    return {
        strategyBuckets,
        candidatesBeforeMinItems,
        candidatesAfterMinItems,
        skipped,
    };
}
