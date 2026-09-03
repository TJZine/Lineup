import type {
    IPlexLibrary,
    PlexLibrarySection,
    PlexMediaItem,
    PlexTagDirectoryItem,
} from '../../../modules/plex/library';
import { PLEX_MEDIA_TYPES } from '../../../modules/plex/library';
import type { ChannelConfig } from '../../../modules/scheduler/channel-manager';
import { ChannelSetupPlanningIterationCheckpoint } from './ChannelSetupPlanningCheckpoint';

export const TV_PEOPLE_DISTINCT_SERIES_THRESHOLD = 3;

export type ChannelSetupPeopleFamily = 'actors' | 'directors';

export type ChannelSetupPeopleCountBasis =
    | 'movie-item-count'
    | 'tv-episode-count-plus-distinct-series';

export interface ChannelSetupPeopleSeriesIndexEntry {
    title: string;
    episodeCount: number;
    distinctSeriesCount: number;
}

export interface ChannelSetupPeopleSeriesLibraryIndex {
    libraryId: string;
    libraryName: string;
    actorsByName: ReadonlyMap<string, ChannelSetupPeopleSeriesIndexEntry>;
    directorsByName: ReadonlyMap<string, ChannelSetupPeopleSeriesIndexEntry>;
}

export type ChannelSetupPeopleSeriesIndexByLibraryId =
    ReadonlyMap<string, ChannelSetupPeopleSeriesLibraryIndex>;

export interface ChannelSetupPeopleSample {
    title: string;
    episodeCount: number;
    distinctSeriesCount: number;
}

export interface ChannelSetupPeopleTagEligibility {
    tag: PlexTagDirectoryItem;
    passesEligibility: boolean;
    itemCount: number | undefined;
}

export interface ChannelSetupPeopleTagSourceGroup {
    key: string;
    title: string;
    totalCount: number;
    hasUnknownCount: boolean;
    sources: ChannelConfig['contentSource'][];
}

export interface ChannelSetupPeopleCategoryCandidate {
    strategy: ChannelSetupPeopleFamily;
    categoryKey: string;
    categoryLabel: string;
    baseSource: ChannelConfig['contentSource'];
    sourceLibraryId?: string;
    sourceLibraryName?: string;
    itemCount?: number;
    tag?: PlexTagDirectoryItem;
}

export interface ChannelSetupPeopleBreadthDiagnostic {
    libraryId: string;
    libraryName: string;
    family: ChannelSetupPeopleFamily;
    countBasis: ChannelSetupPeopleCountBasis;
    distinctSeriesThreshold: 3;
    rawTagCount: number;
    episodeIndexedPeopleCount: number;
    episodeCountQualified: number;
    distinctSeriesQualified: number;
    rejectedBelowDistinctSeries: number;
    missingEpisodeIndexCount: number;
    sampleQualified: ChannelSetupPeopleSample[];
    sampleRejectedBelowDistinctSeries: ChannelSetupPeopleSample[];
}

type MutablePeopleEntry = {
    title: string;
    itemCount: number;
    seriesKeys: Set<string> | null;
};

type MutablePeopleIndex = Record<ChannelSetupPeopleFamily, Map<string, MutablePeopleEntry>>;

export async function buildChannelSetupPeopleIndexForLibrary(options: {
    plexLibrary: IPlexLibrary;
    library: PlexLibrarySection;
    signal: AbortSignal;
    checkpoint: () => Promise<void>;
}): Promise<ChannelSetupPeopleSeriesLibraryIndex> {
    const items = await options.plexLibrary.getLibraryItems(options.library.id, {
        filter: {
            type: options.library.type === 'show'
                ? PLEX_MEDIA_TYPES.EPISODE
                : PLEX_MEDIA_TYPES.MOVIE,
        },
        signal: options.signal,
    });

    return createPeopleIndexFromItemsCooperatively(
        options.library,
        items,
        options.checkpoint
    );
}

export function createPeopleSeriesIndexFromEpisodes(
    library: PlexLibrarySection,
    episodes: readonly PlexMediaItem[]
): ChannelSetupPeopleSeriesLibraryIndex {
    return createPeopleIndexFromItems(library, episodes);
}

export function createPeopleIndexFromItems(
    library: PlexLibrarySection,
    items: readonly PlexMediaItem[]
): ChannelSetupPeopleSeriesLibraryIndex {
    const mutable: MutablePeopleIndex = {
        actors: new Map(),
        directors: new Map(),
    };

    for (const item of items) {
        if (library.type === 'show') {
            const seriesKey = getEpisodeSeriesKey(library.id, item);
            if (!seriesKey) {
                continue;
            }
            addItemPeople(mutable.actors, item.actors, seriesKey);
            addItemPeople(mutable.directors, item.directors, seriesKey);
        } else {
            addItemPeople(mutable.actors, item.actors, null);
            addItemPeople(mutable.directors, item.directors, null);
        }
    }

    return {
        libraryId: library.id,
        libraryName: library.title,
        actorsByName: freezeEntryMap(mutable.actors),
        directorsByName: freezeEntryMap(mutable.directors),
    };
}

export async function createPeopleSeriesIndexFromEpisodesCooperatively(
    library: PlexLibrarySection,
    episodes: readonly PlexMediaItem[],
    checkpoint: () => Promise<void>
): Promise<ChannelSetupPeopleSeriesLibraryIndex> {
    return createPeopleIndexFromItemsCooperatively(library, episodes, checkpoint);
}

export async function createPeopleIndexFromItemsCooperatively(
    library: PlexLibrarySection,
    items: readonly PlexMediaItem[],
    checkpoint: () => Promise<void>
): Promise<ChannelSetupPeopleSeriesLibraryIndex> {
    const mutable: MutablePeopleIndex = {
        actors: new Map(),
        directors: new Map(),
    };
    const iterationCheckpoint = new ChannelSetupPlanningIterationCheckpoint(checkpoint);

    for (const item of items) {
        if (library.type === 'show') {
            const seriesKey = getEpisodeSeriesKey(library.id, item);
            if (seriesKey) {
                addItemPeople(mutable.actors, item.actors, seriesKey);
                addItemPeople(mutable.directors, item.directors, seriesKey);
            }
        } else {
            addItemPeople(mutable.actors, item.actors, null);
            addItemPeople(mutable.directors, item.directors, null);
        }
        const pause = iterationCheckpoint.afterIteration();
        if (pause) {
            await pause;
        }
    }

    return {
        libraryId: library.id,
        libraryName: library.title,
        actorsByName: await freezeEntryMapCooperatively(mutable.actors, iterationCheckpoint),
        directorsByName: await freezeEntryMapCooperatively(mutable.directors, iterationCheckpoint),
    };
}

export function normalizePeopleSeriesIndexName(title: string): string {
    return title.trim().toLowerCase();
}

export function getPeopleSeriesIndexEntry(
    indexByLibraryId: ChannelSetupPeopleSeriesIndexByLibraryId | undefined,
    libraryId: string,
    family: ChannelSetupPeopleFamily,
    tag: PlexTagDirectoryItem
): ChannelSetupPeopleSeriesIndexEntry | undefined {
    const libraryIndex = indexByLibraryId?.get(libraryId);
    if (!libraryIndex) {
        return undefined;
    }
    const peopleByName = family === 'actors'
        ? libraryIndex.actorsByName
        : libraryIndex.directorsByName;
    return peopleByName.get(normalizePeopleSeriesIndexName(tag.title));
}

export function tvPeopleTagMeetsBreadth(
    indexByLibraryId: ChannelSetupPeopleSeriesIndexByLibraryId | undefined,
    libraryId: string,
    family: ChannelSetupPeopleFamily,
    tag: PlexTagDirectoryItem,
    minItems: number
): boolean {
    const entry = getPeopleSeriesIndexEntry(indexByLibraryId, libraryId, family, tag);
    return Boolean(
        entry
        && entry.episodeCount >= minItems
        && entry.distinctSeriesCount >= TV_PEOPLE_DISTINCT_SERIES_THRESHOLD
    );
}

export function getPeopleTagItemCount(options: {
    indexByLibraryId: ChannelSetupPeopleSeriesIndexByLibraryId | undefined;
    library: PlexLibrarySection;
    family: ChannelSetupPeopleFamily;
    tag: PlexTagDirectoryItem;
}): number | undefined {
    const libraryIndex = options.indexByLibraryId?.get(options.library.id);
    if (options.library.type !== 'show' && options.tag.count !== null) {
        return options.tag.count;
    }
    if (!libraryIndex) {
        return getTagItemCount(options.tag);
    }
    return getPeopleSeriesIndexEntry(
        options.indexByLibraryId,
        options.library.id,
        options.family,
        options.tag
    )?.episodeCount ?? 0;
}

export function peopleTagMeetsEligibility(options: {
    indexByLibraryId: ChannelSetupPeopleSeriesIndexByLibraryId | undefined;
    library: PlexLibrarySection;
    family: ChannelSetupPeopleFamily;
    tag: PlexTagDirectoryItem;
    minItems: number;
}): boolean {
    if (options.library.type !== 'show') {
        const count = getPeopleTagItemCount(options);
        return count !== undefined && count >= options.minItems;
    }
    return tvPeopleTagMeetsBreadth(
        options.indexByLibraryId,
        options.library.id,
        options.family,
        options.tag,
        options.minItems
    );
}

export function collectPeopleTagEligibility(options: {
    indexByLibraryId: ChannelSetupPeopleSeriesIndexByLibraryId | undefined;
    library: PlexLibrarySection;
    family: ChannelSetupPeopleFamily;
    tags: readonly PlexTagDirectoryItem[];
    minItems: number;
}): ChannelSetupPeopleTagEligibility[] {
    return sortTagsByCountThenTitle(options.tags).map((tag) => ({
        tag,
        passesEligibility: peopleTagMeetsEligibility({ ...options, tag }),
        itemCount: getPeopleTagItemCount({ ...options, tag }),
    }));
}

export async function collectPeopleTagEligibilityCooperatively(
    options: {
        indexByLibraryId: ChannelSetupPeopleSeriesIndexByLibraryId | undefined;
        library: PlexLibrarySection;
        family: ChannelSetupPeopleFamily;
        tags: readonly PlexTagDirectoryItem[];
        minItems: number;
    },
    iterationCheckpoint: ChannelSetupPlanningIterationCheckpoint
): Promise<ChannelSetupPeopleTagEligibility[]> {
    const eligibility: ChannelSetupPeopleTagEligibility[] = [];
    for (const tag of sortTagsByCountThenTitle(options.tags)) {
        eligibility.push({
            tag,
            passesEligibility: peopleTagMeetsEligibility({ ...options, tag }),
            itemCount: getPeopleTagItemCount({ ...options, tag }),
        });
        const pause = iterationCheckpoint.afterIteration();
        if (pause) {
            await pause;
        }
    }
    return eligibility;
}

export function buildCrossLibraryPeopleSourceGroups(options: {
    libraries: readonly PlexLibrarySection[];
    tagsByLibraryId: ReadonlyMap<string, readonly PlexTagDirectoryItem[]>;
    indexByLibraryId: ChannelSetupPeopleSeriesIndexByLibraryId | undefined;
    family: ChannelSetupPeopleFamily;
    minItems: number;
    createSource: (library: PlexLibrarySection, tag: PlexTagDirectoryItem) => ChannelConfig['contentSource'];
}): ChannelSetupPeopleTagSourceGroup[] {
    const grouped = new Map<string, ChannelSetupPeopleTagSourceGroup>();

    for (const library of options.libraries) {
        for (const tag of sortTagsByCountThenTitle(options.tagsByLibraryId.get(library.id) ?? [])) {
            const key = normalizePeopleSeriesIndexName(tag.title);
            const itemCount = getPeopleTagItemCount({ ...options, library, tag });
            const ineligibleSource = library.type === 'show'
                ? !tvPeopleTagMeetsBreadth(
                    options.indexByLibraryId,
                    library.id,
                    options.family,
                    tag,
                    options.minItems
                )
                : itemCount === undefined || itemCount === 0;
            if (!key || ineligibleSource) {
                continue;
            }
            const group = grouped.get(key) ?? {
                key,
                title: tag.title,
                totalCount: 0,
                hasUnknownCount: false,
                sources: [],
            };
            applyPeopleGroupCount(group, itemCount);
            group.sources.push(options.createSource(library, tag));
            grouped.set(key, group);
        }
    }

    return sortPeopleTagSourceGroups([...grouped.values()]);
}

export async function buildCrossLibraryPeopleSourceGroupsCooperatively(
    options: {
        libraries: readonly PlexLibrarySection[];
        tagsByLibraryId: ReadonlyMap<string, readonly PlexTagDirectoryItem[]>;
        indexByLibraryId: ChannelSetupPeopleSeriesIndexByLibraryId | undefined;
        family: ChannelSetupPeopleFamily;
        minItems: number;
        createSource: (library: PlexLibrarySection, tag: PlexTagDirectoryItem) => ChannelConfig['contentSource'];
    },
    iterationCheckpoint: ChannelSetupPlanningIterationCheckpoint
): Promise<ChannelSetupPeopleTagSourceGroup[]> {
    const grouped = new Map<string, ChannelSetupPeopleTagSourceGroup>();
    for (const library of options.libraries) {
        for (const tag of sortTagsByCountThenTitle(options.tagsByLibraryId.get(library.id) ?? [])) {
            const key = normalizePeopleSeriesIndexName(tag.title);
            const itemCount = getPeopleTagItemCount({ ...options, library, tag });
            const ineligibleSource = library.type === 'show'
                ? !tvPeopleTagMeetsBreadth(
                    options.indexByLibraryId,
                    library.id,
                    options.family,
                    tag,
                    options.minItems
                )
                : itemCount === undefined || itemCount === 0;
            if (key && !ineligibleSource) {
                const group = grouped.get(key) ?? {
                    key,
                    title: tag.title,
                    totalCount: 0,
                    hasUnknownCount: false,
                    sources: [],
                };
                applyPeopleGroupCount(group, itemCount);
                group.sources.push(options.createSource(library, tag));
                grouped.set(key, group);
            }
            const pause = iterationCheckpoint.afterIteration();
            if (pause) {
                await pause;
            }
        }
    }
    return sortPeopleTagSourceGroups([...grouped.values()]);
}

export function buildPerLibraryPeopleCandidates(options: {
    indexByLibraryId: ChannelSetupPeopleSeriesIndexByLibraryId | undefined;
    library: PlexLibrarySection;
    family: ChannelSetupPeopleFamily;
    tags: readonly PlexTagDirectoryItem[];
    minItems: number;
    categoryKey: (library: PlexLibrarySection, tag: PlexTagDirectoryItem) => string;
    baseSource: (library: PlexLibrarySection, tag: PlexTagDirectoryItem) => ChannelConfig['contentSource'];
    recordEligibility: (passesEligibility: boolean) => void;
}): ChannelSetupPeopleCategoryCandidate[] {
    const candidates: ChannelSetupPeopleCategoryCandidate[] = [];
    for (const entry of collectPeopleTagEligibility(options)) {
        options.recordEligibility(entry.passesEligibility);
        if (!entry.passesEligibility) {
            continue;
        }
        candidates.push(withOptionalPeopleItemCount({
            strategy: options.family,
            categoryKey: options.categoryKey(options.library, entry.tag),
            categoryLabel: entry.tag.title,
            baseSource: options.baseSource(options.library, entry.tag),
            sourceLibraryId: options.library.id,
            sourceLibraryName: options.library.title,
            tag: entry.tag,
        }, entry.itemCount));
    }
    return candidates;
}

export async function buildPerLibraryPeopleCandidatesCooperatively(
    options: {
        indexByLibraryId: ChannelSetupPeopleSeriesIndexByLibraryId | undefined;
        library: PlexLibrarySection;
        family: ChannelSetupPeopleFamily;
        tags: readonly PlexTagDirectoryItem[];
        minItems: number;
        categoryKey: (library: PlexLibrarySection, tag: PlexTagDirectoryItem) => string;
        baseSource: (library: PlexLibrarySection, tag: PlexTagDirectoryItem) => ChannelConfig['contentSource'];
        recordEligibility: (passesEligibility: boolean) => void;
    },
    iterationCheckpoint: ChannelSetupPlanningIterationCheckpoint
): Promise<ChannelSetupPeopleCategoryCandidate[]> {
    const candidates: ChannelSetupPeopleCategoryCandidate[] = [];
    const eligibility = await collectPeopleTagEligibilityCooperatively(options, iterationCheckpoint);
    for (const entry of eligibility) {
        options.recordEligibility(entry.passesEligibility);
        if (entry.passesEligibility) {
            candidates.push(withOptionalPeopleItemCount({
                strategy: options.family,
                categoryKey: options.categoryKey(options.library, entry.tag),
                categoryLabel: entry.tag.title,
                baseSource: options.baseSource(options.library, entry.tag),
                sourceLibraryId: options.library.id,
                sourceLibraryName: options.library.title,
                tag: entry.tag,
            }, entry.itemCount));
        }
        const pause = iterationCheckpoint.afterIteration();
        if (pause) {
            await pause;
        }
    }
    return candidates;
}

export function buildCrossLibraryPeopleCandidates(options: {
    libraries: readonly PlexLibrarySection[];
    tagsByLibraryId: ReadonlyMap<string, readonly PlexTagDirectoryItem[]>;
    indexByLibraryId: ChannelSetupPeopleSeriesIndexByLibraryId | undefined;
    family: ChannelSetupPeopleFamily;
    minItems: number;
    createSource: (library: PlexLibrarySection, tag: PlexTagDirectoryItem) => ChannelConfig['contentSource'];
}): ChannelSetupPeopleCategoryCandidate[] {
    return buildCrossLibraryPeopleSourceGroups(options).filter((entry) => entry.hasUnknownCount || entry.totalCount >= options.minItems).map((entry) => withOptionalPeopleItemCount({
            strategy: options.family,
            categoryKey: entry.key,
            categoryLabel: entry.title,
            baseSource: entry.sources.length > 1
                ? { type: 'mixed', mixMode: 'interleave', sources: entry.sources }
                : entry.sources[0] ?? { type: 'manual', items: [] },
        }, entry.totalCount > 0 ? entry.totalCount : undefined));
}

export function buildPeopleBreadthDiagnostics(options: {
    libraries: PlexLibrarySection[];
    actorsByLibraryId: ReadonlyMap<string, readonly PlexTagDirectoryItem[]>;
    directorsByLibraryId: ReadonlyMap<string, readonly PlexTagDirectoryItem[]>;
    peopleSeriesIndexByLibraryId?: ChannelSetupPeopleSeriesIndexByLibraryId;
    minItems: number;
}): ChannelSetupPeopleBreadthDiagnostic[] {
    const diagnostics: ChannelSetupPeopleBreadthDiagnostic[] = [];
    for (const library of options.libraries) {
        diagnostics.push(buildPeopleBreadthDiagnostic({
            library,
            family: 'actors',
            tags: options.actorsByLibraryId.get(library.id) ?? [],
            indexByLibraryId: options.peopleSeriesIndexByLibraryId,
            minItems: options.minItems,
        }));
        diagnostics.push(buildPeopleBreadthDiagnostic({
            library,
            family: 'directors',
            tags: options.directorsByLibraryId.get(library.id) ?? [],
            indexByLibraryId: options.peopleSeriesIndexByLibraryId,
            minItems: options.minItems,
        }));
    }
    return diagnostics;
}

function buildPeopleBreadthDiagnostic(options: {
    library: PlexLibrarySection;
    family: ChannelSetupPeopleFamily;
    tags: readonly PlexTagDirectoryItem[];
    indexByLibraryId: ChannelSetupPeopleSeriesIndexByLibraryId | undefined;
    minItems: number;
}): ChannelSetupPeopleBreadthDiagnostic {
    if (options.library.type !== 'show') {
        const qualified = options.tags.filter((tag) => peopleTagMeetsEligibility({
            ...options,
            tag,
        }));
        return {
            libraryId: options.library.id,
            libraryName: options.library.title,
            family: options.family,
            countBasis: 'movie-item-count',
            distinctSeriesThreshold: TV_PEOPLE_DISTINCT_SERIES_THRESHOLD,
            rawTagCount: options.tags.length,
            episodeIndexedPeopleCount: 0,
            episodeCountQualified: 0,
            distinctSeriesQualified: qualified.length,
            rejectedBelowDistinctSeries: 0,
            missingEpisodeIndexCount: 0,
            sampleQualified: qualified.slice(0, 5).map((tag) => ({
                title: tag.title,
                episodeCount: getPeopleTagItemCount({ ...options, tag }) ?? 0,
                distinctSeriesCount: 0,
            })),
            sampleRejectedBelowDistinctSeries: [],
        };
    }

    const libraryIndex = options.indexByLibraryId?.get(options.library.id);
    const peopleByName = options.family === 'actors'
        ? libraryIndex?.actorsByName
        : libraryIndex?.directorsByName;
    const indexedPeople = peopleByName ?? new Map<string, ChannelSetupPeopleSeriesIndexEntry>();
    const indexedTags = options.tags
        .map((tag) => getPeopleSeriesIndexEntry(options.indexByLibraryId, options.library.id, options.family, tag))
        .filter((entry): entry is ChannelSetupPeopleSeriesIndexEntry => Boolean(entry));
    const episodeCountQualified = indexedTags.filter((entry) => entry.episodeCount >= options.minItems);
    const qualified = episodeCountQualified.filter(
        (entry) => entry.distinctSeriesCount >= TV_PEOPLE_DISTINCT_SERIES_THRESHOLD
    );
    const rejectedBelowDistinctSeries = episodeCountQualified.filter(
        (entry) => entry.distinctSeriesCount < TV_PEOPLE_DISTINCT_SERIES_THRESHOLD
    );

    return {
        libraryId: options.library.id,
        libraryName: options.library.title,
        family: options.family,
        countBasis: 'tv-episode-count-plus-distinct-series',
        distinctSeriesThreshold: TV_PEOPLE_DISTINCT_SERIES_THRESHOLD,
        rawTagCount: options.tags.length,
        episodeIndexedPeopleCount: indexedPeople.size,
        episodeCountQualified: episodeCountQualified.length,
        distinctSeriesQualified: qualified.length,
        rejectedBelowDistinctSeries: rejectedBelowDistinctSeries.length,
        missingEpisodeIndexCount: options.tags.length - indexedTags.length,
        sampleQualified: toPeopleSamples(qualified),
        sampleRejectedBelowDistinctSeries: toPeopleSamples(rejectedBelowDistinctSeries),
    };
}

function addItemPeople(
    peopleByName: Map<string, MutablePeopleEntry>,
    people: readonly string[] | undefined,
    seriesKey: string | null
): void {
    const uniquePeople = new Map<string, string>();
    for (const person of people ?? []) {
        if (typeof person !== 'string') {
            continue;
        }
        const normalizedName = normalizePeopleSeriesIndexName(person);
        if (normalizedName && !uniquePeople.has(normalizedName)) {
            uniquePeople.set(normalizedName, person.trim());
        }
    }
    for (const [normalizedName, title] of uniquePeople) {
        const entry = peopleByName.get(normalizedName) ?? {
            title,
            itemCount: 0,
            seriesKeys: seriesKey === null ? null : new Set<string>(),
        };
        entry.itemCount += 1;
        if (seriesKey !== null) {
            entry.seriesKeys?.add(seriesKey);
        }
        peopleByName.set(normalizedName, entry);
    }
}

function getTagItemCount(tag: PlexTagDirectoryItem): number | undefined {
    return tag.count === null ? undefined : tag.count;
}

function sortTagsByCountThenTitle(tags: readonly PlexTagDirectoryItem[]): PlexTagDirectoryItem[] {
    return [...tags].sort((a, b) => {
        const countDiff = (b.count ?? 0) - (a.count ?? 0);
        if (countDiff !== 0) return countDiff;
        const titleDiff = a.title.localeCompare(b.title);
        if (titleDiff !== 0) return titleDiff;
        return a.key.localeCompare(b.key);
    });
}

function applyPeopleGroupCount(group: ChannelSetupPeopleTagSourceGroup, itemCount: number | undefined): void {
    if (itemCount === undefined) {
        group.hasUnknownCount = true;
        return;
    }
    group.totalCount += itemCount;
}

function withOptionalPeopleItemCount(
    candidate: Omit<ChannelSetupPeopleCategoryCandidate, 'itemCount'>,
    itemCount: number | undefined
): ChannelSetupPeopleCategoryCandidate {
    if (itemCount === undefined) {
        return candidate;
    }
    return { ...candidate, itemCount };
}

function sortPeopleTagSourceGroups(
    groups: ChannelSetupPeopleTagSourceGroup[]
): ChannelSetupPeopleTagSourceGroup[] {
    return groups.sort((a, b) => {
        const countDiff = b.totalCount - a.totalCount;
        if (countDiff !== 0) return countDiff;
        const titleDiff = a.title.localeCompare(b.title);
        if (titleDiff !== 0) return titleDiff;
        return a.key.localeCompare(b.key);
    });
}

function freezeEntryMap(
    source: Map<string, MutablePeopleEntry>
): ReadonlyMap<string, ChannelSetupPeopleSeriesIndexEntry> {
    const result = new Map<string, ChannelSetupPeopleSeriesIndexEntry>();
    for (const [name, entry] of source.entries()) {
        result.set(name, Object.freeze({
            title: entry.title,
            episodeCount: entry.itemCount,
            distinctSeriesCount: entry.seriesKeys?.size ?? 0,
        }));
    }
    return result;
}

async function freezeEntryMapCooperatively(
    source: Map<string, MutablePeopleEntry>,
    iterationCheckpoint: ChannelSetupPlanningIterationCheckpoint
): Promise<ReadonlyMap<string, ChannelSetupPeopleSeriesIndexEntry>> {
    const result = new Map<string, ChannelSetupPeopleSeriesIndexEntry>();
    for (const [name, entry] of source.entries()) {
        result.set(name, Object.freeze({
            title: entry.title,
            episodeCount: entry.itemCount,
            distinctSeriesCount: entry.seriesKeys?.size ?? 0,
        }));
        const pause = iterationCheckpoint.afterIteration();
        if (pause) {
            await pause;
        }
    }
    return result;
}

function getEpisodeSeriesKey(libraryId: string, episode: PlexMediaItem): string | null {
    if (episode.grandparentRatingKey && episode.grandparentRatingKey.trim().length > 0) {
        return `${libraryId}:key:${episode.grandparentRatingKey.trim()}`;
    }
    if (episode.grandparentTitle && episode.grandparentTitle.trim().length > 0) {
        return `${libraryId}:title:${normalizePeopleSeriesIndexName(episode.grandparentTitle)}`;
    }
    return null;
}

function toPeopleSamples(entries: readonly ChannelSetupPeopleSeriesIndexEntry[]): ChannelSetupPeopleSample[] {
    return [...entries]
        .sort((left, right) => {
            const episodeDiff = right.episodeCount - left.episodeCount;
            if (episodeDiff !== 0) {
                return episodeDiff;
            }
            const seriesDiff = right.distinctSeriesCount - left.distinctSeriesCount;
            if (seriesDiff !== 0) {
                return seriesDiff;
            }
            return left.title.localeCompare(right.title);
        })
        .slice(0, 5)
        .map((entry) => ({
            title: entry.title,
            episodeCount: entry.episodeCount,
            distinctSeriesCount: entry.distinctSeriesCount,
        }));
}
