import type {
    ChannelSetupConfig,
    ChannelSetupEstimates,
    SetupStrategyKey,
} from '../types';
import { DEFAULT_MIN_ITEMS_PER_CHANNEL, DEFAULT_STRATEGY_PRIORITIES, SETUP_STRATEGY_KEYS } from '../constants';
import { DEFAULT_CHANNEL_SETUP_MAX } from '../../../modules/scheduler/channel-manager/constants';
import type {
    PlexLibrarySection,
    PlexCollection,
    PlexPlaylist,
    PlexTagDirectoryItem,
} from '../../../modules/plex/library';
import type { ChannelConfig } from '../../../modules/scheduler/channel-manager';
import {
    buildChannelSetupStrategyBuckets,
    buildChannelSetupStrategyBucketsCooperatively,
} from './ChannelSetupStrategyBuilders';
import {
    createChannelSetupFacetFamilyRecord,
    type ChannelSetupNativeFacetFamily,
} from './ChannelSetupFacetFamilies';
import {
    createEmptyChannelSetupEstimates,
    createChannelIdentityKey,
    toChannelSetupDecadeValue,
    type ChannelSetupFacetMap,
    type ChannelSetupPlannerCountSample,
    type ChannelSetupPlannerDiagnostics,
    type ChannelSetupPlannerFacetCountDiagnostics,
    type ChannelSetupPlannerLibraryCount,
    type PendingChannel,
} from './ChannelSetupPlanningTypes';
import {
    buildPeopleBreadthDiagnostics,
    type ChannelSetupPeopleSeriesIndexByLibraryId,
} from './ChannelSetupPeopleSeriesIndex';
interface ChannelSetupPlanInput {
    config: ChannelSetupConfig;
    libraries: PlexLibrarySection[];
    playlists: readonly PlexPlaylist[];
    collectionsByLibraryId: ChannelSetupFacetMap<PlexCollection>;
    genresByLibraryId: ChannelSetupFacetMap<PlexTagDirectoryItem>;
    directorsByLibraryId: ChannelSetupFacetMap<PlexTagDirectoryItem>;
    yearsByLibraryId: ChannelSetupFacetMap<PlexTagDirectoryItem>;
    actorsByLibraryId: ChannelSetupFacetMap<PlexTagDirectoryItem>;
    studiosByLibraryId: ChannelSetupFacetMap<PlexTagDirectoryItem>;
    peopleSeriesIndexByLibraryId?: ChannelSetupPeopleSeriesIndexByLibraryId;
    warnings: readonly string[];
    seedFor: (value: string) => number;
}
interface ChannelSetupPlan {
    pendingChannels: PendingChannel[];
    estimates: ChannelSetupEstimates;
    warnings: string[];
    skipped: number;
    reachedMaxChannels: boolean;
}

type ChannelSetupPlanningLimits = {
    effectiveMaxChannels: number;
    minItems: number;
};

type TruncatedPendingChannels = {
    pending: PendingChannel[];
    reachedMaxChannels: boolean;
};

type AllocatedPendingChannels = TruncatedPendingChannels & {
    allocationBudgetByStrategy: ChannelSetupEstimates;
    selectedBeforeGlobalCapByStrategy: ChannelSetupEstimates;
    lostToAllocationByStrategy: ChannelSetupEstimates;
};
class ChannelSetupPlannerDiagnosticsRecorder {
    private readonly _diagnostics: ChannelSetupPlannerDiagnostics | undefined;

    constructor(
        collectDiagnostics: boolean,
        selectedLibraries: PlexLibrarySection[],
        tagsByFamily: Record<ChannelSetupNativeFacetFamily, ChannelSetupFacetMap<PlexTagDirectoryItem>>,
        peopleSeriesIndexByLibraryId: ChannelSetupPeopleSeriesIndexByLibraryId,
        effectiveMaxChannels: number,
        minItems: number
    ) {
        this._diagnostics = collectDiagnostics
            ? createPlannerDiagnostics(
                selectedLibraries,
                tagsByFamily,
                peopleSeriesIndexByLibraryId,
                effectiveMaxChannels,
                minItems
            )
            : undefined;
    }

    get diagnostics(): ChannelSetupPlannerDiagnostics | undefined {
        return this._diagnostics;
    }

    recordCandidateFiltering(strategyBuild: {
        candidatesBeforeMinItems: ChannelSetupEstimates;
        candidatesAfterMinItems: ChannelSetupEstimates;
    }): void {
        if (!this._diagnostics) {
            return;
        }
        this._diagnostics.candidatesBeforeMinItems = strategyBuild.candidatesBeforeMinItems;
        this._diagnostics.candidatesAfterMinItems = strategyBuild.candidatesAfterMinItems;
    }

    recordStrategyBucketSizes(channels: PendingChannel[]): void {
        if (!this._diagnostics) {
            return;
        }
        this._diagnostics.strategyBucketSizes = countChannelsByStrategy(channels);
    }

    recordAfterAlternateLineups(channels: PendingChannel[]): void {
        if (!this._diagnostics) {
            return;
        }
        this._diagnostics.afterAlternateLineups = countChannelsByStrategy(channels);
    }

    recordAfterVariants(channels: PendingChannel[]): void {
        if (!this._diagnostics) {
            return;
        }
        this._diagnostics.afterVariants = countChannelsByStrategy(channels);
    }

    recordAllocation(allocation: AllocatedPendingChannels): void {
        if (!this._diagnostics) {
            return;
        }
        this._diagnostics.allocationBudgetByStrategy = { ...allocation.allocationBudgetByStrategy };
        this._diagnostics.selectedBeforeGlobalCapByStrategy = { ...allocation.selectedBeforeGlobalCapByStrategy };
        this._diagnostics.lostToAllocationByStrategy = { ...allocation.lostToAllocationByStrategy };
    }

    recordAfterMaxChannels(estimates: ChannelSetupEstimates): void {
        if (!this._diagnostics) {
            return;
        }
        this._diagnostics.afterMaxChannels = { ...estimates };
        this._diagnostics.lostToMaxChannels = subtractEstimates(
            this._diagnostics.afterVariants,
            this._diagnostics.afterMaxChannels
        );
    }
}
const sortTagValuesByCountThenTitle = <T extends { title: string; count: number }>(values: readonly T[]): T[] => (
    [...values].sort((a, b) => {
        const countDiff = b.count - a.count;
        if (countDiff !== 0) return countDiff;
        return a.title.localeCompare(b.title);
    })
);
const sortTagTitles = (titles: string[]): string[] => [...titles].sort((a, b) => a.localeCompare(b));
const toCountSamples = (values: ReadonlyArray<{ title: string; count: number }>, limit: number = 5): ChannelSetupPlannerCountSample[] =>
    sortTagValuesByCountThenTitle(values).slice(0, limit).map((value) => ({
        title: value.title,
        count: value.count,
    }));
const formatDecadeLabel = (decade: number): string => `${decade}s`;
const sortLibrariesByTitle = (libraries: PlexLibrarySection[]): PlexLibrarySection[] => (
    [...libraries].sort((a, b) => {
        const titleDiff = a.title.localeCompare(b.title);
        if (titleDiff !== 0) return titleDiff;
        return a.id.localeCompare(b.id);
    })
);
const sanitizeBlockSize = (raw: unknown, fallback: number): number => {
    const numeric = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(numeric)) return fallback;
    const value = Math.floor(numeric);
    if (value < 1) return fallback;
    return value;
};
const isTvOnlySource = (source: ChannelConfig['contentSource']): boolean => {
    switch (source.type) {
        case 'library':
            return source.libraryType === 'show';
        case 'show':
            return true;
        case 'mixed':
            return source.sources.every(isTvOnlySource);
        default:
            return false;
    }
};
const isSeriesDerivedChannel = (
    channel: PendingChannel,
    showLibraryIds: Set<string>
): boolean => {
    if (typeof channel.sourceLibraryId === 'string' && showLibraryIds.has(channel.sourceLibraryId)) {
        return true;
    }
    return isTvOnlySource(channel.contentSource);
};
export function buildChannelSetupPlan(input: ChannelSetupPlanInput): ChannelSetupPlan {
    return buildChannelSetupPlanInternal(input).plan;
}
export async function buildChannelSetupPlanCooperatively(
    input: ChannelSetupPlanInput,
    checkpoint: () => Promise<void>
): Promise<ChannelSetupPlan> {
    const {
        config,
        libraries,
        playlists,
        collectionsByLibraryId,
        genresByLibraryId,
        directorsByLibraryId,
        yearsByLibraryId,
        actorsByLibraryId,
        studiosByLibraryId,
        peopleSeriesIndexByLibraryId = new Map(),
        warnings,
        seedFor,
    } = input;
    const { effectiveMaxChannels, minItems } = resolvePlanningLimits(config);
    const selectedLibraries = selectConfiguredLibraries(libraries, config);

    const strategyBuild = await buildChannelSetupStrategyBucketsCooperatively({
        config,
        selectedLibraries,
        playlists,
        collectionsByLibraryId,
        genresByLibraryId,
        directorsByLibraryId,
        yearsByLibraryId,
        actorsByLibraryId,
        studiosByLibraryId,
        peopleSeriesIndexByLibraryId,
        minItems,
        seedFor,
    }, checkpoint);
    const showLibraryIds = new Set(
        selectedLibraries
            .filter((library) => library.type === 'show')
            .map((library) => library.id)
    );

    await checkpoint();
    const baseOrderedUnadjusted = orderStrategyChannels(
        strategyBuild.strategyBuckets,
        createStrategyPriorityResolver(config)
    );
    const baseOrdered = normalizeSeriesPlayback(baseOrderedUnadjusted, showLibraryIds, config);
    await checkpoint();
    const withAlternateLineups = expandAlternateLineups(baseOrdered, config, seedFor);
    await checkpoint();
    const withVariants = expandPlaybackVariants(withAlternateLineups, showLibraryIds, config, seedFor);
    await checkpoint();
    const { pending, reachedMaxChannels } = allocatePendingChannels(
        withVariants,
        effectiveMaxChannels,
        createStrategyPriorityResolver(config)
    );
    const estimates = estimatePendingChannels(pending);
    await checkpoint();

    return {
        pendingChannels: pending,
        estimates,
        warnings: [...warnings],
        skipped: strategyBuild.skipped,
        reachedMaxChannels,
    };
}
export function buildChannelSetupPlanDiagnostics(input: ChannelSetupPlanInput): ChannelSetupPlannerDiagnostics {
    return buildChannelSetupPlanInternal(input, true).diagnostics!;
}
function buildChannelSetupPlanInternal(
    input: ChannelSetupPlanInput,
    collectDiagnostics: boolean = false
): { plan: ChannelSetupPlan; diagnostics?: ChannelSetupPlannerDiagnostics } {
    const {
        config,
        libraries,
        playlists,
        collectionsByLibraryId,
        genresByLibraryId,
        directorsByLibraryId,
        yearsByLibraryId,
        actorsByLibraryId,
        studiosByLibraryId,
        peopleSeriesIndexByLibraryId = new Map(),
        warnings,
        seedFor,
    } = input;

    const { effectiveMaxChannels, minItems } = resolvePlanningLimits(config);
    const selectedLibraries = selectConfiguredLibraries(libraries, config);
    const tagsByStateKey = {
        genresByLibraryId,
        directorsByLibraryId,
        yearsByLibraryId,
        actorsByLibraryId,
        studiosByLibraryId,
    };

    const diagnosticsRecorder = new ChannelSetupPlannerDiagnosticsRecorder(
        collectDiagnostics,
        selectedLibraries,
        createChannelSetupFacetFamilyRecord((descriptor) => tagsByStateKey[descriptor.stateKey]),
        peopleSeriesIndexByLibraryId,
        effectiveMaxChannels,
        minItems
    );

    const strategyBuild = buildChannelSetupStrategyBuckets({
        config,
        selectedLibraries,
        playlists,
        collectionsByLibraryId,
        genresByLibraryId,
        directorsByLibraryId,
        yearsByLibraryId,
        actorsByLibraryId,
        studiosByLibraryId,
        peopleSeriesIndexByLibraryId,
        minItems,
        seedFor,
    });
    const { strategyBuckets, skipped } = strategyBuild;

    diagnosticsRecorder.recordCandidateFiltering(strategyBuild);

    const showLibraryIds = new Set(
        selectedLibraries
            .filter((library) => library.type === 'show')
            .map((library) => library.id)
    );

    const baseOrderedUnadjusted = orderStrategyChannels(
        strategyBuckets,
        createStrategyPriorityResolver(config)
    );

    diagnosticsRecorder.recordStrategyBucketSizes(baseOrderedUnadjusted);

    const baseOrdered = normalizeSeriesPlayback(baseOrderedUnadjusted, showLibraryIds, config);
    const withAlternateLineups = expandAlternateLineups(baseOrdered, config, seedFor);

    diagnosticsRecorder.recordAfterAlternateLineups(withAlternateLineups);

    const withVariants = expandPlaybackVariants(withAlternateLineups, showLibraryIds, config, seedFor);

    diagnosticsRecorder.recordAfterVariants(withVariants);

    const allocation = allocatePendingChannels(
        withVariants,
        effectiveMaxChannels,
        createStrategyPriorityResolver(config)
    );
    const { pending, reachedMaxChannels } = allocation;
    const estimates = estimatePendingChannels(pending);

    diagnosticsRecorder.recordAllocation(allocation);
    diagnosticsRecorder.recordAfterMaxChannels(estimates);
    const diagnostics = diagnosticsRecorder.diagnostics;

    return {
        plan: {
            pendingChannels: pending,
            estimates,
            warnings: [...warnings],
            skipped,
            reachedMaxChannels,
        },
        ...(diagnostics ? { diagnostics } : {}),
    };
}
function resolvePlanningLimits(config: ChannelSetupConfig): ChannelSetupPlanningLimits {
    const requestedMax = Number.isFinite(config.maxChannels) ? config.maxChannels : DEFAULT_CHANNEL_SETUP_MAX;
    const requestedMinItems = Number.isFinite(config.minItemsPerChannel)
        ? config.minItemsPerChannel
        : DEFAULT_MIN_ITEMS_PER_CHANNEL;
    return {
        effectiveMaxChannels: Math.max(1, Math.floor(requestedMax)),
        minItems: Math.max(1, Math.floor(requestedMinItems)),
    };
}
function selectConfiguredLibraries(
    libraries: PlexLibrarySection[],
    config: ChannelSetupConfig
): PlexLibrarySection[] {
    return sortLibrariesByTitle(
        libraries.filter((lib) => config.selectedLibraryIds.includes(lib.id))
    );
}
function createStrategyPriorityResolver(
    config: ChannelSetupConfig
): (strategy: SetupStrategyKey) => number {
    return (strategy: SetupStrategyKey): number => {
        const configured = config.strategyConfig[strategy]?.priority;
        if (Number.isFinite(configured)) {
            return Math.max(1, Math.floor(Number(configured)));
        }
        return DEFAULT_STRATEGY_PRIORITIES[strategy];
    };
}
function orderStrategyChannels(
    strategyBuckets: Record<SetupStrategyKey, PendingChannel[]>,
    getStrategyPriority: (strategy: SetupStrategyKey) => number
): PendingChannel[] {
    const orderedStrategies = (Object.keys(strategyBuckets) as SetupStrategyKey[]).sort((a, b) => {
        const priorityDiff = getStrategyPriority(a) - getStrategyPriority(b);
        if (priorityDiff !== 0) return priorityDiff;
        return a.localeCompare(b);
    });

    return orderedStrategies.flatMap((strategy) => strategyBuckets[strategy]);
}
function normalizeSeriesPlayback(
    channels: PendingChannel[],
    showLibraryIds: Set<string>,
    config: ChannelSetupConfig
): PendingChannel[] {
    const baseSeriesModeRaw = config.seriesOrdering?.basePlaybackMode;
    const baseSeriesMode =
        baseSeriesModeRaw === 'sequential' || baseSeriesModeRaw === 'block'
            ? baseSeriesModeRaw
            : 'shuffle';
    const baseSeriesBlockSize = sanitizeBlockSize(config.seriesOrdering?.baseBlockSize, 3);

    return channels.map((channel) => {
        const isSeriesDerived = isSeriesDerivedChannel(channel, showLibraryIds);
        if (baseSeriesMode === 'shuffle' || !isSeriesDerived || channel.playbackMode !== 'shuffle') {
            return channel;
        }
        const updated: PendingChannel = {
            ...channel,
            playbackMode: baseSeriesMode,
        };
        if (baseSeriesMode === 'block') {
            updated.blockSize = baseSeriesBlockSize;
        } else {
            delete updated.blockSize;
        }
        return updated;
    });
}
function resolveAlternateLineupCopies(config: ChannelSetupConfig): number {
    if (!config.channelExpansion?.addAlternateLineups) {
        return 0;
    }
    const raw = config.channelExpansion?.alternateLineupCopies;
    const copies = Number.isFinite(raw) ? Math.floor(Number(raw)) : 1;
    return Math.min(3, Math.max(1, copies));
}
function expandAlternateLineups(
    channels: PendingChannel[],
    config: ChannelSetupConfig,
    seedFor: (value: string) => number
): PendingChannel[] {
    const alternateCopies = resolveAlternateLineupCopies(config);
    const withAlternateLineups: PendingChannel[] = [];
    for (const channel of channels) {
        const baseChannel: PendingChannel = {
            ...channel,
            lineupReplicaIndex: channel.lineupReplicaIndex ?? 0,
            isPlaybackModeVariant: false,
        };
        withAlternateLineups.push(baseChannel);

        if (
            alternateCopies <= 0
            || baseChannel.playbackMode === 'sequential'
            || baseChannel.buildStrategy === 'actors'
            || baseChannel.buildStrategy === 'directors'
        ) {
            continue;
        }
        for (let replicaIndex = 1; replicaIndex <= alternateCopies; replicaIndex++) {
            withAlternateLineups.push({
                ...baseChannel,
                name: `${baseChannel.name} (${replicaIndex + 1})`,
                shuffleSeed: seedFor(`${createChannelIdentityKey(baseChannel)}:replica:${replicaIndex}`),
                lineupReplicaIndex: replicaIndex,
                isPlaybackModeVariant: false,
            });
        }
    }
    return withAlternateLineups;
}
function expandPlaybackVariants(
    channels: PendingChannel[],
    showLibraryIds: Set<string>,
    config: ChannelSetupConfig,
    seedFor: (value: string) => number
): PendingChannel[] {
    const variantTypeRaw = config.channelExpansion?.variantType;
    const variantType =
        variantTypeRaw === 'sequential' || variantTypeRaw === 'block'
            ? variantTypeRaw
            : 'none';
    if (variantType === 'none') {
        return [...channels];
    }

    const variantBlockSize = sanitizeBlockSize(config.channelExpansion?.variantBlockSize, 3);
    const variantLabel = variantType === 'sequential' ? 'Sequential' : 'Block';
    const withVariants: PendingChannel[] = [...channels];
    for (const channel of channels) {
        if (
            (channel.lineupReplicaIndex ?? 0) > 0
            || channel.buildStrategy === 'actors'
            || channel.buildStrategy === 'directors'
        ) {
            continue;
        }
        const isSeriesDerived = isSeriesDerivedChannel(channel, showLibraryIds);
        if (!isSeriesDerived) {
            continue;
        }
        const sameMode = channel.playbackMode === variantType;
        const sameBlockSize =
            variantType !== 'block' || channel.blockSize === variantBlockSize;
        if (sameMode && sameBlockSize) {
            // Series-derived base channels may already match the requested variant;
            // skip them so setup does not emit duplicate playback-mode variants.
            continue;
        }
        const variant: PendingChannel = {
            ...channel,
            name: `${channel.name} • ${variantLabel}`,
            playbackMode: variantType,
            // Marks this as a setup-generated playback-mode variant (sequential/block) for identity/diffing.
            isPlaybackModeVariant: true,
            shuffleSeed: seedFor(`${createChannelIdentityKey(channel)}:variant:${variantType}`),
        };
        if (variantType === 'block') {
            variant.blockSize = variantBlockSize;
        } else {
            delete variant.blockSize;
        }
        withVariants.push(variant);
    }
    return withVariants;
}
function allocatePendingChannels(
    channels: PendingChannel[],
    effectiveMaxChannels: number,
    getStrategyPriority: (strategy: SetupStrategyKey) => number
): AllocatedPendingChannels {
    const pending = selectBalancedStrategyChannels(channels, effectiveMaxChannels, getStrategyPriority);
    const selectedEstimates = countChannelsByStrategy(pending);
    const sourceEstimates = countChannelsByStrategy(channels);

    return {
        pending,
        reachedMaxChannels: channels.length > effectiveMaxChannels,
        allocationBudgetByStrategy: selectedEstimates,
        selectedBeforeGlobalCapByStrategy: selectedEstimates,
        lostToAllocationByStrategy: subtractEstimates(sourceEstimates, selectedEstimates),
    };
}
function selectBalancedStrategyChannels(
    channels: PendingChannel[],
    effectiveMaxChannels: number,
    getStrategyPriority: (strategy: SetupStrategyKey) => number
): PendingChannel[] {
    if (channels.length <= effectiveMaxChannels) {
        return [...channels];
    }

    const channelsByStrategy = createEmptyStrategyChannelBuckets();
    for (const channel of channels) {
        const strategyKey = channel.buildStrategy as SetupStrategyKey | undefined;
        if (!strategyKey || !(strategyKey in channelsByStrategy)) {
            continue;
        }
        channelsByStrategy[strategyKey].push(channel);
    }

    const orderedStrategies = SETUP_STRATEGY_KEYS
        .filter((strategy) => channelsByStrategy[strategy].length > 0)
        .sort((a, b) => {
            const priorityDiff = getStrategyPriority(a) - getStrategyPriority(b);
            if (priorityDiff !== 0) return priorityDiff;
            return a.localeCompare(b);
        });
    const selected: PendingChannel[] = [];
    const cursors = new Map<SetupStrategyKey, number>();

    while (selected.length < effectiveMaxChannels) {
        let selectedThisPass = false;
        for (const strategy of orderedStrategies) {
            const cursor = cursors.get(strategy) ?? 0;
            const channel = channelsByStrategy[strategy][cursor];
            if (!channel) {
                continue;
            }
            selected.push(channel);
            cursors.set(strategy, cursor + 1);
            selectedThisPass = true;
            if (selected.length >= effectiveMaxChannels) {
                break;
            }
        }
        if (!selectedThisPass) {
            break;
        }
    }

    return selected;
}
function createEmptyStrategyChannelBuckets(): Record<SetupStrategyKey, PendingChannel[]> {
    return SETUP_STRATEGY_KEYS.reduce<Record<SetupStrategyKey, PendingChannel[]>>((acc, strategy) => {
        acc[strategy] = [];
        return acc;
    }, {} as Record<SetupStrategyKey, PendingChannel[]>);
}
function estimatePendingChannels(pending: PendingChannel[]): ChannelSetupEstimates {
    const estimates = createEmptyChannelSetupEstimates();
    for (const channel of pending) {
        estimates.total += 1;
        const strategyKey = channel.buildStrategy as keyof ChannelSetupEstimates | undefined;
        if (!strategyKey || strategyKey === 'total') {
            continue;
        }
        if (strategyKey in estimates) {
            estimates[strategyKey] += 1;
        }
    }
    return estimates;
}
function buildFacetCountDiagnostics(
    library: PlexLibrarySection,
    tags: readonly PlexTagDirectoryItem[],
    minItems: number
): ChannelSetupPlannerFacetCountDiagnostics {
    const knownCounts = sortTagValuesByCountThenTitle(
        tags
            .filter((tag): tag is PlexTagDirectoryItem & { count: number } => tag.count !== null)
            .map((tag) => ({ title: tag.title, count: tag.count }))
    );
    const unknownCountTitles = sortTagTitles(
        tags
            .filter((tag) => tag.count === null)
            .map((tag) => tag.title)
    );
    const belowMinItems = knownCounts.filter((tag) => tag.count < minItems);

    return {
        libraryId: library.id,
        libraryName: library.title,
        rawTagCount: tags.length,
        effectiveCandidateCount: tags.length,
        candidatesWithKnownCount: knownCounts.length,
        candidatesWithUnknownCount: unknownCountTitles.length,
        candidatesBelowMinItems: belowMinItems.length,
        minKnownCount: knownCounts.length > 0 ? knownCounts[knownCounts.length - 1]?.count ?? null : null,
        maxKnownCount: knownCounts.length > 0 ? knownCounts[0]?.count ?? null : null,
        sampleKnownCounts: toCountSamples(knownCounts),
        sampleUnknownCountTitles: unknownCountTitles.slice(0, 5),
        sampleBelowMinItems: toCountSamples(belowMinItems),
    };
}
function buildDecadeFacetCountDiagnostics(
    library: PlexLibrarySection,
    yearTags: readonly PlexTagDirectoryItem[],
    minItems: number
): ChannelSetupPlannerFacetCountDiagnostics {
    const decades = new Map<number, { totalCount: number; hasUnknownCount: boolean }>();

    for (const yearTag of yearTags) {
        const decade = toChannelSetupDecadeValue(yearTag.title);
        if (decade === null) {
            continue;
        }
        const entry = decades.get(decade) ?? { totalCount: 0, hasUnknownCount: false };
        if (yearTag.count === null) {
            entry.hasUnknownCount = true;
        } else {
            entry.totalCount += yearTag.count;
        }
        decades.set(decade, entry);
    }

    const knownCounts = sortTagValuesByCountThenTitle(
        Array.from(decades.entries())
            .filter(([, entry]) => entry.hasUnknownCount === false)
            .map(([decade, entry]) => ({ title: formatDecadeLabel(decade), count: entry.totalCount }))
    );
    const unknownCountTitles = sortTagTitles(
        Array.from(decades.entries())
            .filter(([, entry]) => entry.hasUnknownCount === true)
            .map(([decade]) => formatDecadeLabel(decade))
    );
    const belowMinItems = knownCounts.filter((tag) => tag.count < minItems);

    return {
        libraryId: library.id,
        libraryName: library.title,
        rawTagCount: yearTags.length,
        effectiveCandidateCount: decades.size,
        candidatesWithKnownCount: knownCounts.length,
        candidatesWithUnknownCount: unknownCountTitles.length,
        candidatesBelowMinItems: belowMinItems.length,
        minKnownCount: knownCounts.length > 0 ? knownCounts[knownCounts.length - 1]?.count ?? null : null,
        maxKnownCount: knownCounts.length > 0 ? knownCounts[0]?.count ?? null : null,
        sampleKnownCounts: toCountSamples(knownCounts),
        sampleUnknownCountTitles: unknownCountTitles.slice(0, 5),
        sampleBelowMinItems: toCountSamples(belowMinItems),
    };
}
function createPlannerDiagnostics(
    selectedLibraries: PlexLibrarySection[],
    tagsByFamily: Record<ChannelSetupNativeFacetFamily, ChannelSetupFacetMap<PlexTagDirectoryItem>>,
    peopleSeriesIndexByLibraryId: ChannelSetupPeopleSeriesIndexByLibraryId,
    effectiveMaxChannels: number,
    minItems: number
): ChannelSetupPlannerDiagnostics {
    const toCounts = (
        valuesByLibraryId: ChannelSetupFacetMap<PlexTagDirectoryItem>
    ): ChannelSetupPlannerLibraryCount[] => selectedLibraries.map((library) => ({
        libraryId: library.id,
        libraryName: library.title,
        count: valuesByLibraryId.get(library.id)?.length ?? 0,
    }));
    const toFacetCountDiagnostics = (
        valuesByLibraryId: ChannelSetupFacetMap<PlexTagDirectoryItem>
    ): ChannelSetupPlannerFacetCountDiagnostics[] => selectedLibraries.map((library) =>
        buildFacetCountDiagnostics(library, valuesByLibraryId.get(library.id) ?? [], minItems)
    );
    const toDecadeFacetCountDiagnostics = (): ChannelSetupPlannerFacetCountDiagnostics[] => selectedLibraries.map((library) =>
        buildDecadeFacetCountDiagnostics(library, tagsByFamily.decades.get(library.id) ?? [], minItems)
    );

    return {
        effectiveMaxChannels,
        minItems,
        allocationMode: 'priority-balanced-round-robin',
        fetchedTagsByFamily: createChannelSetupFacetFamilyRecord((descriptor) =>
            toCounts(tagsByFamily[descriptor.family])
        ),
        tagCountDiagnosticsByFamily: createChannelSetupFacetFamilyRecord((descriptor) =>
            descriptor.family === 'decades'
                ? toDecadeFacetCountDiagnostics()
                : toFacetCountDiagnostics(tagsByFamily[descriptor.family])
        ),
        peopleBreadthDiagnostics: buildPeopleBreadthDiagnostics({
            libraries: selectedLibraries,
            actorsByLibraryId: tagsByFamily.actors,
            directorsByLibraryId: tagsByFamily.directors,
            peopleSeriesIndexByLibraryId,
            minItems,
        }),
        candidatesBeforeMinItems: createEmptyChannelSetupEstimates(),
        candidatesAfterMinItems: createEmptyChannelSetupEstimates(),
        strategyBucketSizes: createEmptyChannelSetupEstimates(),
        afterAlternateLineups: createEmptyChannelSetupEstimates(),
        afterVariants: createEmptyChannelSetupEstimates(),
        allocationBudgetByStrategy: createEmptyChannelSetupEstimates(),
        selectedBeforeGlobalCapByStrategy: createEmptyChannelSetupEstimates(),
        lostToAllocationByStrategy: createEmptyChannelSetupEstimates(),
        afterMaxChannels: createEmptyChannelSetupEstimates(),
        lostToMaxChannels: createEmptyChannelSetupEstimates(),
    };
}
function countChannelsByStrategy(channels: PendingChannel[]): ChannelSetupEstimates {
    const estimates = createEmptyChannelSetupEstimates();
    for (const channel of channels) {
        estimates.total += 1;
        const strategyKey = channel.buildStrategy as SetupStrategyKey | undefined;
        if (!strategyKey) {
            continue;
        }
        estimates[strategyKey] += 1;
    }
    return estimates;
}
function subtractEstimates(
    source: ChannelSetupEstimates,
    removed: ChannelSetupEstimates
): ChannelSetupEstimates {
    return {
        total: Math.max(0, source.total - removed.total),
        collections: Math.max(0, source.collections - removed.collections),
        playlists: Math.max(0, source.playlists - removed.playlists),
        genres: Math.max(0, source.genres - removed.genres),
        directors: Math.max(0, source.directors - removed.directors),
        decades: Math.max(0, source.decades - removed.decades),
        recentlyAdded: Math.max(0, source.recentlyAdded - removed.recentlyAdded),
        studios: Math.max(0, source.studios - removed.studios),
        actors: Math.max(0, source.actors - removed.actors),
    };
}
