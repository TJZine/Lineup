import type {
    IPlexLibrary,
    PlexLibrarySection,
    PlexMediaItem,
    PlexTagDirectoryItem,
} from '../../../modules/plex/library';
import { PLEX_MEDIA_TYPES } from '../../../modules/plex/library';
import type { ChannelConfig } from '../../../modules/scheduler/channel-manager';

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
    episodeCount: number;
    seriesKeys: Set<string>;
};

type MutablePeopleIndex = Record<ChannelSetupPeopleFamily, Map<string, MutablePeopleEntry>>;

export async function buildChannelSetupPeopleSeriesIndexForLibrary(options: {
    plexLibrary: IPlexLibrary;
    library: PlexLibrarySection;
    signal: AbortSignal;
}): Promise<ChannelSetupPeopleSeriesLibraryIndex> {
    const episodes = await options.plexLibrary.getLibraryItems(options.library.id, {
        filter: { type: PLEX_MEDIA_TYPES.EPISODE },
        signal: options.signal,
    });

    return createPeopleSeriesIndexFromEpisodes(options.library, episodes);
}

export function createPeopleSeriesIndexFromEpisodes(
    library: PlexLibrarySection,
    episodes: readonly PlexMediaItem[]
): ChannelSetupPeopleSeriesLibraryIndex {
    const mutable: MutablePeopleIndex = {
        actors: new Map(),
        directors: new Map(),
    };

    for (const episode of episodes) {
        const seriesKey = getEpisodeSeriesKey(library.id, episode);
        if (!seriesKey) {
            continue;
        }
        addEpisodePeople(mutable.actors, episode.actors, seriesKey);
        addEpisodePeople(mutable.directors, episode.directors, seriesKey);
    }

    return {
        libraryId: library.id,
        libraryName: library.title,
        actorsByName: freezeEntryMap(mutable.actors),
        directorsByName: freezeEntryMap(mutable.directors),
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
    if (options.library.type !== 'show') {
        return getTagItemCount(options.tag);
    }
    return getPeopleSeriesIndexEntry(
        options.indexByLibraryId,
        options.library.id,
        options.family,
        options.tag
    )?.episodeCount;
}

export function peopleTagMeetsEligibility(options: {
    indexByLibraryId: ChannelSetupPeopleSeriesIndexByLibraryId | undefined;
    library: PlexLibrarySection;
    family: ChannelSetupPeopleFamily;
    tag: PlexTagDirectoryItem;
    minItems: number;
}): boolean {
    if (options.library.type !== 'show') {
        return tagMeetsMinItems(options.tag, options.minItems);
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
            const thinTvSource = library.type === 'show' && !tvPeopleTagMeetsBreadth(
                options.indexByLibraryId,
                library.id,
                options.family,
                tag,
                options.minItems
            );
            if (!key || thinTvSource) {
                continue;
            }
            const group = grouped.get(key) ?? {
                key,
                title: tag.title,
                totalCount: 0,
                hasUnknownCount: false,
                sources: [],
            };
            applyPeopleGroupCount(group, getPeopleTagItemCount({ ...options, library, tag }));
            group.sources.push(options.createSource(library, tag));
            grouped.set(key, group);
        }
    }

    return sortPeopleTagSourceGroups([...grouped.values()].filter((group) => group.hasUnknownCount || group.totalCount >= options.minItems));
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

export function buildCrossLibraryPeopleCandidates(options: {
    libraries: readonly PlexLibrarySection[];
    tagsByLibraryId: ReadonlyMap<string, readonly PlexTagDirectoryItem[]>;
    indexByLibraryId: ChannelSetupPeopleSeriesIndexByLibraryId | undefined;
    family: ChannelSetupPeopleFamily;
    minItems: number;
    createSource: (library: PlexLibrarySection, tag: PlexTagDirectoryItem) => ChannelConfig['contentSource'];
}): ChannelSetupPeopleCategoryCandidate[] {
    return buildCrossLibraryPeopleSourceGroups(options).map((entry) => withOptionalPeopleItemCount({
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
        const qualified = options.tags.filter((tag) => tag.count === null || tag.count >= options.minItems);
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
                episodeCount: tag.count ?? 0,
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

function addEpisodePeople(
    peopleByName: Map<string, MutablePeopleEntry>,
    people: readonly string[] | undefined,
    seriesKey: string
): void {
    const uniquePeople = new Set((people ?? []).map(normalizePeopleSeriesIndexName).filter(Boolean));
    for (const normalizedName of uniquePeople) {
        const title = people?.find((person) => normalizePeopleSeriesIndexName(person) === normalizedName)?.trim() ?? normalizedName;
        const entry = peopleByName.get(normalizedName) ?? {
            title,
            episodeCount: 0,
            seriesKeys: new Set<string>(),
        };
        entry.episodeCount += 1;
        entry.seriesKeys.add(seriesKey);
        peopleByName.set(normalizedName, entry);
    }
}

function getTagItemCount(tag: PlexTagDirectoryItem): number | undefined {
    return tag.count === null ? undefined : tag.count;
}

function tagMeetsMinItems(tag: PlexTagDirectoryItem, minItems: number): boolean {
    return tag.count === null || tag.count >= minItems;
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
            episodeCount: entry.episodeCount,
            distinctSeriesCount: entry.seriesKeys.size,
        }));
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
