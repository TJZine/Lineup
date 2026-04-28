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
import {
    createEmptyChannelSetupEstimates,
    toChannelSetupDecadeValue,
    type ChannelSetupFacetMap,
    type PendingChannel,
} from './ChannelSetupPlanningTypes';

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
    playlists: readonly PlexPlaylist[];
    collectionsByLibraryId: ChannelSetupFacetMap<PlexCollection>;
    genresByLibraryId: ChannelSetupFacetMap<PlexTagDirectoryItem>;
    directorsByLibraryId: ChannelSetupFacetMap<PlexTagDirectoryItem>;
    yearsByLibraryId: ChannelSetupFacetMap<PlexTagDirectoryItem>;
    actorsByLibraryId: ChannelSetupFacetMap<PlexTagDirectoryItem>;
    studiosByLibraryId: ChannelSetupFacetMap<PlexTagDirectoryItem>;
    minItems: number;
    seedFor: (value: string) => number;
}

export interface ChannelSetupStrategyBuildResult {
    strategyBuckets: StrategyBuckets;
    candidatesBeforeMinItems: ChannelSetupEstimates;
    candidatesAfterMinItems: ChannelSetupEstimates;
    skipped: number;
}

type ChannelSetupStrategyBuildState = {
    input: ChannelSetupStrategyBuildersInput;
    strategyBuckets: StrategyBuckets;
    candidatesBeforeMinItems: ChannelSetupEstimates;
    candidatesAfterMinItems: ChannelSetupEstimates;
    skipped: number;
};

type DecadeCandidateSummary = {
    allDecades: number[];
    sortedDecades: number[];
    decadeCounts: Map<number, number>;
    decadesWithUnknownCounts: Set<number>;
};

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

const sortPlaylistsByCountThenTitle = (playlists: readonly PlexPlaylist[]): PlexPlaylist[] => (
    [...playlists].sort((a, b) => {
        const countDiff = b.leafCount - a.leafCount;
        if (countDiff !== 0) return countDiff;
        const titleDiff = a.title.localeCompare(b.title);
        if (titleDiff !== 0) return titleDiff;
        return a.ratingKey.localeCompare(b.ratingKey);
    })
);

const sortTagsByCountThenTitle = (tags: readonly PlexTagDirectoryItem[]): PlexTagDirectoryItem[] => (
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

const buildCrossLibraryFacetCandidates = (
    libraries: PlexLibrarySection[],
    tagsByLibraryId: ChannelSetupFacetMap<PlexTagDirectoryItem>,
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
    tagsByLibraryId: ChannelSetupFacetMap<PlexTagDirectoryItem>,
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
    tagsByLibraryId: ChannelSetupFacetMap<PlexTagDirectoryItem>
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
    const state = createStrategyBuildState(input);
    buildPlaylistStrategyBuckets(state);
    buildPerLibraryStrategyBuckets(state);
    buildCrossLibraryFacetStrategyBuckets(state);
    buildActorStudioStrategyBuckets(state);
    return toStrategyBuildResult(state);
}

function createStrategyBuildState(input: ChannelSetupStrategyBuildersInput): ChannelSetupStrategyBuildState {
    return {
        input,
        strategyBuckets: {
            collections: [],
            playlists: [],
            genres: [],
            directors: [],
            decades: [],
            recentlyAdded: [],
            studios: [],
            actors: [],
        },
        candidatesBeforeMinItems: createEmptyChannelSetupEstimates(),
        candidatesAfterMinItems: createEmptyChannelSetupEstimates(),
        skipped: 0,
    };
}

function toStrategyBuildResult(state: ChannelSetupStrategyBuildState): ChannelSetupStrategyBuildResult {
    return {
        strategyBuckets: state.strategyBuckets,
        candidatesBeforeMinItems: state.candidatesBeforeMinItems,
        candidatesAfterMinItems: state.candidatesAfterMinItems,
        skipped: state.skipped,
    };
}

function isStrategyEnabled(state: ChannelSetupStrategyBuildState, strategy: SetupStrategyKey): boolean {
    return state.input.config.strategyConfig[strategy]?.enabled === true;
}

function getStrategyScope(
    state: ChannelSetupStrategyBuildState,
    strategy: SetupStrategyKey
): 'per-library' | 'cross-library' {
    return state.input.config.strategyConfig[strategy]?.scope === 'cross-library' ? 'cross-library' : 'per-library';
}

function recordCandidate(
    state: ChannelSetupStrategyBuildState,
    strategy: SetupStrategyKey,
    passesMinItems: boolean,
    amount: number = 1
): void {
    addEstimateCount(state.candidatesBeforeMinItems, strategy, amount);
    if (passesMinItems) {
        addEstimateCount(state.candidatesAfterMinItems, strategy, amount);
    }
}

function recordMinItemOutcome(
    state: ChannelSetupStrategyBuildState,
    strategy: SetupStrategyKey,
    passesMinItems: boolean,
    amount: number = 1
): void {
    recordCandidate(state, strategy, passesMinItems, amount);
    if (!passesMinItems && amount > 0) {
        state.skipped += amount;
    }
}

function addStrategyChannel(
    state: ChannelSetupStrategyBuildState,
    strategy: SetupStrategyKey,
    channel: PendingChannel
): void {
    state.strategyBuckets[strategy].push({
        ...channel,
        buildStrategy: strategy,
        lineupReplicaIndex: channel.lineupReplicaIndex ?? 0,
        isPlaybackModeVariant: channel.isPlaybackModeVariant === true,
    });
}

function buildPlaylistStrategyBuckets(state: ChannelSetupStrategyBuildState): void {
    if (!isStrategyEnabled(state, 'playlists')) {
        return;
    }
    const { playlists, minItems, seedFor } = state.input;
    for (const playlist of sortPlaylistsByCountThenTitle(playlists)) {
        const passesMinItems = playlist.leafCount >= minItems;
        recordMinItemOutcome(state, 'playlists', passesMinItems);
        if (!passesMinItems) {
            continue;
        }
        addStrategyChannel(state, 'playlists', {
            name: playlist.title,
            contentSource: {
                type: 'playlist',
                playlistKey: playlist.ratingKey,
                playlistName: playlist.title,
            },
            playbackMode: 'shuffle',
            shuffleSeed: seedFor(`playlist:${playlist.ratingKey}`),
            isAutoGenerated: true,
        });
    }
}

function buildPerLibraryStrategyBuckets(state: ChannelSetupStrategyBuildState): void {
    for (const library of state.input.selectedLibraries) {
        buildCollectionStrategyBuckets(state, library);
        buildRecentlyAddedStrategyBucket(state, library);
        buildPerLibraryFacetStrategyBuckets(state, library);
    }
}

function buildCollectionStrategyBuckets(
    state: ChannelSetupStrategyBuildState,
    library: PlexLibrarySection
): void {
    if (!isStrategyEnabled(state, 'collections')) {
        return;
    }
    const { collectionsByLibraryId, minItems, seedFor } = state.input;
    const candidates: CategoryCandidate[] = [];
    for (const collection of collectionsByLibraryId.get(library.id) ?? []) {
        const passesMinItems = collection.childCount >= minItems;
        recordMinItemOutcome(state, 'collections', passesMinItems);
        if (!passesMinItems) {
            continue;
        }
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
    for (const candidate of sortCategoryCandidates(candidates)) {
        addStrategyChannel(state, 'collections', {
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

function buildRecentlyAddedStrategyBucket(
    state: ChannelSetupStrategyBuildState,
    library: PlexLibrarySection
): void {
    if (!isStrategyEnabled(state, 'recentlyAdded')) {
        return;
    }
    recordCandidate(state, 'recentlyAdded', true);
    addStrategyChannel(state, 'recentlyAdded', {
        name: `${library.title} - Recently Added`,
        contentSource: createLibrarySource(library),
        sortOrder: 'added_desc',
        playbackMode: 'sequential',
        shuffleSeed: state.input.seedFor(`recentlyAdded:${library.id}`),
        isAutoGenerated: true,
        sourceLibraryId: library.id,
        sourceLibraryName: library.title,
    });
}

function buildPerLibraryFacetStrategyBuckets(
    state: ChannelSetupStrategyBuildState,
    library: PlexLibrarySection
): void {
    buildPerLibraryGenreStrategyBuckets(state, library);
    buildPerLibraryDirectorStrategyBuckets(state, library);
    buildPerLibraryDecadeStrategyBuckets(state, library);
}

function buildPerLibraryGenreStrategyBuckets(
    state: ChannelSetupStrategyBuildState,
    library: PlexLibrarySection
): void {
    if (!isStrategyEnabled(state, 'genres') || getStrategyScope(state, 'genres') !== 'per-library') {
        return;
    }
    const { genresByLibraryId, minItems, seedFor } = state.input;
    const candidates: CategoryCandidate[] = [];
    for (const genre of sortTagsByCountThenTitle(genresByLibraryId.get(library.id) ?? [])) {
        const passesMinItems = tagMeetsMinItems(genre, minItems);
        recordMinItemOutcome(state, 'genres', passesMinItems);
        if (!passesMinItems) {
            continue;
        }
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
        addStrategyChannel(state, 'genres', {
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

function buildPerLibraryDirectorStrategyBuckets(
    state: ChannelSetupStrategyBuildState,
    library: PlexLibrarySection
): void {
    if (!isStrategyEnabled(state, 'directors') || getStrategyScope(state, 'directors') !== 'per-library') {
        return;
    }
    const { directorsByLibraryId, minItems, seedFor } = state.input;
    const candidates: CategoryCandidate[] = [];
    for (const director of sortTagsByCountThenTitle(directorsByLibraryId.get(library.id) ?? [])) {
        const passesMinItems = tagMeetsMinItems(director, minItems);
        recordMinItemOutcome(state, 'directors', passesMinItems);
        if (!passesMinItems) {
            continue;
        }
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
        addStrategyChannel(state, 'directors', {
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

function buildPerLibraryDecadeStrategyBuckets(
    state: ChannelSetupStrategyBuildState,
    library: PlexLibrarySection
): void {
    if (!isStrategyEnabled(state, 'decades')) {
        return;
    }
    const { yearsByLibraryId, minItems, seedFor } = state.input;
    const summary = collectDecadeCandidateSummary(yearsByLibraryId.get(library.id) ?? [], minItems);
    for (const decade of summary.allDecades) {
        recordMinItemOutcome(state, 'decades', decadeMeetsMinItems(summary, decade, minItems));
    }

    for (const decade of summary.sortedDecades) {
        addStrategyChannel(state, 'decades', {
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

function collectDecadeCandidateSummary(
    yearTags: readonly PlexTagDirectoryItem[],
    minItems: number
): DecadeCandidateSummary {
    const decadeCounts = new Map<number, number>();
    const decadesWithUnknownCounts = new Set<number>();
    for (const yearTag of yearTags) {
        const decade = toChannelSetupDecadeValue(yearTag.title);
        if (decade === null) {
            continue;
        }
        if (yearTag.count === null) {
            decadesWithUnknownCounts.add(decade);
            continue;
        }
        decadeCounts.set(decade, (decadeCounts.get(decade) || 0) + yearTag.count);
    }

    const allDecades = Array.from(new Set<number>([...decadeCounts.keys(), ...decadesWithUnknownCounts.values()]));
    const sortedDecades = [...allDecades]
        .sort((a, b) => a - b)
        .filter((decade) => decadeMeetsMinItems({ decadeCounts, decadesWithUnknownCounts }, decade, minItems));
    return { allDecades, sortedDecades, decadeCounts, decadesWithUnknownCounts };
}

function decadeMeetsMinItems(
    summary: Pick<DecadeCandidateSummary, 'decadeCounts' | 'decadesWithUnknownCounts'>,
    decade: number,
    minItems: number
): boolean {
    return summary.decadesWithUnknownCounts.has(decade) || (summary.decadeCounts.get(decade) ?? 0) >= minItems;
}

function buildCrossLibraryFacetStrategyBuckets(state: ChannelSetupStrategyBuildState): void {
    buildCrossLibraryFacetStrategyBucket(state, 'genres', state.input.genresByLibraryId, 'genre', (tag) => ({ genre: tag.title }));
    buildCrossLibraryFacetStrategyBucket(state, 'directors', state.input.directorsByLibraryId, 'director', (tag) => ({ director: tag.title }));
}

function buildCrossLibraryFacetStrategyBucket(
    state: ChannelSetupStrategyBuildState,
    strategy: 'genres' | 'directors',
    tagsByLibraryId: ChannelSetupFacetMap<PlexTagDirectoryItem>,
    seedPrefix: 'genre' | 'director',
    buildLibraryFilter: (tag: PlexTagDirectoryItem) => Record<string, string | number>
): void {
    if (!isStrategyEnabled(state, strategy) || getStrategyScope(state, strategy) !== 'cross-library') {
        return;
    }
    const { selectedLibraries, minItems, seedFor } = state.input;
    const candidates = buildCrossLibraryFacetCandidates(
        selectedLibraries,
        tagsByLibraryId,
        minItems,
        strategy,
        buildLibraryFilter
    );
    for (const candidate of candidates) {
        recordMinItemOutcome(state, strategy, true);
        addStrategyChannel(state, strategy, {
            name: candidate.categoryLabel,
            contentSource: candidate.baseSource,
            playbackMode: 'shuffle',
            shuffleSeed: seedFor(`${seedPrefix}:cross:${candidate.categoryKey}`),
            isAutoGenerated: true,
        });
    }
    const skipped = countUniqueTagTitles(selectedLibraries, tagsByLibraryId) - candidates.length;
    if (skipped > 0) {
        recordMinItemOutcome(state, strategy, false, skipped);
    }
}

function buildActorStudioStrategyBuckets(state: ChannelSetupStrategyBuildState): void {
    buildActorOrStudioStrategyBucket(state, 'studios', 'studio', state.input.studiosByLibraryId);
    buildActorOrStudioStrategyBucket(state, 'actors', 'actor', state.input.actorsByLibraryId);
}

function buildActorOrStudioStrategyBucket(
    state: ChannelSetupStrategyBuildState,
    strategy: 'actors' | 'studios',
    tagType: 'actor' | 'studio',
    tagsByLibraryId: ChannelSetupFacetMap<PlexTagDirectoryItem>
): void {
    if (!isStrategyEnabled(state, strategy)) {
        return;
    }
    const scope = getStrategyScope(state, strategy);
    const combineMode = state.input.config.actorStudioCombineMode ?? 'separate';
    if (combineMode === 'combined' || scope === 'cross-library') {
        buildCombinedActorStudioStrategyBucket(state, strategy, tagType, tagsByLibraryId, scope);
        return;
    }
    buildPerLibraryActorStudioStrategyBucket(state, strategy, tagType, tagsByLibraryId);
}

function buildCombinedActorStudioStrategyBucket(
    state: ChannelSetupStrategyBuildState,
    strategy: 'actors' | 'studios',
    tagType: 'actor' | 'studio',
    tagsByLibraryId: ChannelSetupFacetMap<PlexTagDirectoryItem>,
    scope: 'per-library' | 'cross-library'
): void {
    const { selectedLibraries, minItems, seedFor } = state.input;
    for (const tag of combineTagSources(selectedLibraries, tagsByLibraryId, tagType)) {
        const passesMinItems = tag.hasUnknownCount || tag.totalCount >= minItems;
        recordMinItemOutcome(state, strategy, passesMinItems);
        if (!passesMinItems) {
            continue;
        }
        addStrategyChannel(state, strategy, {
            name: tag.title,
            contentSource: {
                type: 'mixed',
                mixMode: scope === 'cross-library' ? 'interleave' : 'sequential',
                sources: tag.sources,
            },
            playbackMode: 'shuffle',
            shuffleSeed: seedFor(`${tagType}:${tag.key}`),
            isAutoGenerated: true,
        });
    }
}

function buildPerLibraryActorStudioStrategyBucket(
    state: ChannelSetupStrategyBuildState,
    strategy: 'actors' | 'studios',
    tagType: 'actor' | 'studio',
    tagsByLibraryId: ChannelSetupFacetMap<PlexTagDirectoryItem>
): void {
    const { selectedLibraries, minItems, seedFor } = state.input;
    for (const library of selectedLibraries) {
        const tags = sortTagsByCountThenTitle(tagsByLibraryId.get(library.id) ?? []);
        for (const tag of tags) {
            const passesMinItems = tagMeetsMinItems(tag, minItems);
            recordMinItemOutcome(state, strategy, passesMinItems);
            if (!passesMinItems) {
                continue;
            }
            addStrategyChannel(state, strategy, {
                name: `${tag.title} - ${library.type === 'movie' ? 'Movies' : 'TV'}`,
                contentSource: createLibrarySource(library, buildChannelSetupTagFilter(tag, tagType)),
                playbackMode: 'shuffle',
                shuffleSeed: seedFor(`${tagType}:${library.id}:${tag.key}`),
                isAutoGenerated: true,
                sourceLibraryId: library.id,
                sourceLibraryName: library.title,
            });
        }
    }
}
