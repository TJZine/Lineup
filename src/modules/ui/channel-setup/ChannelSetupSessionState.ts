import type {
    ChannelExpansionConfig,
    ChannelSetupConfig,
    ChannelSetupContext,
    ChannelSetupPreview,
    ChannelSetupRecord,
    ChannelSetupReview,
    SeriesOrderingConfig,
    SetupStrategyConfig,
} from '../../../core/channel-setup/types';
import {
    DEFAULT_CHANNEL_SETUP_MAX,
    MAX_CHANNELS,
} from '../../scheduler/channel-manager/constants';
import type {
    ChannelExpansionState,
    ChannelSetupPreviewUiStatus,
    ChannelSetupSessionSnapshot,
    EstimateKey,
    SeriesOrderingState,
    SetupStep,
    SetupStrategyState,
    StrategyStepMutableState,
} from './ChannelSetupSessionContracts';
import {
    ALTERNATE_LINEUP_COPY_OPTIONS,
    DEFAULT_MIN_ITEMS_PER_CHANNEL,
    DEFAULT_STRATEGY_PRIORITIES,
    MIXED_SCOPE_STRATEGY_KEYS,
    SERIES_BLOCK_PRESETS,
    SETUP_STRATEGY_KEYS,
    type SetupStrategyKey,
} from './steps/constants';
import type { PlexLibrarySection } from '../../plex/library';

const ALTERNATE_LINEUP_COPY_MIN = ALTERNATE_LINEUP_COPY_OPTIONS.length > 0
    ? Math.min(...ALTERNATE_LINEUP_COPY_OPTIONS)
    : 1;
const ALTERNATE_LINEUP_COPY_MAX = ALTERNATE_LINEUP_COPY_OPTIONS.length > 0
    ? Math.max(...ALTERNATE_LINEUP_COPY_OPTIONS)
    : 3;
const SERIES_BLOCK_PRESET_MIN = SERIES_BLOCK_PRESETS.length > 0
    ? Math.min(...SERIES_BLOCK_PRESETS)
    : 2;
const SERIES_BLOCK_PRESET_MAX = SERIES_BLOCK_PRESETS.length > 0
    ? Math.max(...SERIES_BLOCK_PRESETS)
    : 5;
const DEFAULT_SERIES_BLOCK_PRESET = SERIES_BLOCK_PRESETS.includes(3)
    ? 3
    : SERIES_BLOCK_PRESETS[0] ?? 3;

export const clampSeriesBlockPreset = (raw: unknown): number => {
    const numeric = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(numeric)) return DEFAULT_SERIES_BLOCK_PRESET;
    const value = Math.floor(numeric);
    return Math.min(SERIES_BLOCK_PRESET_MAX, Math.max(SERIES_BLOCK_PRESET_MIN, value));
};

export const strategySupportsMixedScope = (key: SetupStrategyKey): boolean =>
    MIXED_SCOPE_STRATEGY_KEYS.has(key);

export const createDefaultStrategyState = (): SetupStrategyState => ({
    collections: { enabled: true, scope: 'per-library' },
    playlists: { enabled: true, scope: 'per-library' },
    genres: { enabled: true, scope: 'per-library' },
    directors: { enabled: true, scope: 'per-library' },
    decades: { enabled: true, scope: 'per-library' },
    recentlyAdded: { enabled: true, scope: 'per-library' },
    studios: { enabled: true, scope: 'per-library' },
    actors: { enabled: true, scope: 'per-library' },
});

const compareSetupStrategyKeys = (a: SetupStrategyKey, b: SetupStrategyKey): number => {
    const diff = DEFAULT_STRATEGY_PRIORITIES[a] - DEFAULT_STRATEGY_PRIORITIES[b];
    if (diff !== 0) return diff;
    return a < b ? -1 : a > b ? 1 : 0;
};

export const createDefaultStrategyOrder = (): SetupStrategyKey[] =>
    [...SETUP_STRATEGY_KEYS].sort(compareSetupStrategyKeys);

export const defaultChannelExpansionState = (): ChannelExpansionState => ({
    addAlternateLineups: false,
    alternateLineupCopies: 1,
    variantType: 'none',
    variantBlockSize: DEFAULT_SERIES_BLOCK_PRESET,
});

export const defaultSeriesOrderingState = (): SeriesOrderingState => ({
    basePlaybackMode: 'shuffle',
    baseBlockSize: DEFAULT_SERIES_BLOCK_PRESET,
});

const cloneStrategies = (strategies: SetupStrategyState): SetupStrategyState =>
    SETUP_STRATEGY_KEYS.reduce<SetupStrategyState>((acc, key) => {
        acc[key] = { ...strategies[key] };
        return acc;
    }, {} as SetupStrategyState);

const clonePreview = (preview: ChannelSetupPreview | null): ChannelSetupPreview | null => {
    if (!preview) {
        return null;
    }

    return {
        estimates: { ...preview.estimates },
        warnings: [...preview.warnings],
        reachedMaxChannels: preview.reachedMaxChannels,
        ...(preview.status ? { status: preview.status } : {}),
        ...(preview.message ? { message: preview.message } : {}),
        ...(preview.failureReason ? { failureReason: preview.failureReason } : {}),
    };
};

const cloneReview = (review: ChannelSetupReview | null): ChannelSetupReview | null => {
    if (!review) {
        return null;
    }

    const preview = clonePreview(review.preview);
    if (!preview) {
        return null;
    }

    return {
        preview,
        diff: {
            summary: { ...review.diff.summary },
            samples: {
                created: [...review.diff.samples.created],
                removed: [...review.diff.samples.removed],
                unchanged: [...review.diff.samples.unchanged],
            },
        },
    };
};

const normalizeChannelExpansion = (expansion: ChannelExpansionConfig | undefined): ChannelExpansionConfig => ({
    addAlternateLineups: expansion?.addAlternateLineups === true,
    alternateLineupCopies: Number.isFinite(expansion?.alternateLineupCopies)
        ? Math.min(
            ALTERNATE_LINEUP_COPY_MAX,
            Math.max(ALTERNATE_LINEUP_COPY_MIN, Math.floor(Number(expansion?.alternateLineupCopies)))
        )
        : ALTERNATE_LINEUP_COPY_MIN,
    variantType:
        expansion?.variantType === 'sequential' || expansion?.variantType === 'block'
            ? expansion.variantType
            : 'none',
    variantBlockSize: clampSeriesBlockPreset(expansion?.variantBlockSize),
});

const normalizeSeriesOrdering = (value: SeriesOrderingConfig | undefined): SeriesOrderingConfig => ({
    basePlaybackMode:
        value?.basePlaybackMode === 'sequential' || value?.basePlaybackMode === 'block'
            ? value.basePlaybackMode
            : 'shuffle',
    baseBlockSize: clampSeriesBlockPreset(value?.baseBlockSize),
});

const normalizeChannelSetupConfig = (config: ChannelSetupConfig): ChannelSetupConfig => {
    const selectedLibraryIds = Array.isArray(config.selectedLibraryIds)
        ? config.selectedLibraryIds.filter((id): id is string => typeof id === 'string')
        : [];
    const maxChannels = Number.isFinite(config.maxChannels)
        ? Math.min(Math.max(Math.floor(config.maxChannels), 1), MAX_CHANNELS)
        : DEFAULT_CHANNEL_SETUP_MAX;
    const minItemsPerChannel = Number.isFinite(config.minItemsPerChannel)
        ? Math.max(1, Math.floor(config.minItemsPerChannel))
        : DEFAULT_MIN_ITEMS_PER_CHANNEL;
    const buildMode =
        config.buildMode === 'append' || config.buildMode === 'merge' || config.buildMode === 'replace'
            ? config.buildMode
            : 'replace';
    const actorStudioCombineMode =
        config.actorStudioCombineMode === 'combined' || config.actorStudioCombineMode === 'separate'
            ? config.actorStudioCombineMode
            : 'separate';
    const strategySource = (config.strategyConfig ?? {}) as Partial<Record<SetupStrategyKey, SetupStrategyConfig>>;
    const strategyConfig = SETUP_STRATEGY_KEYS.reduce<ChannelSetupConfig['strategyConfig']>((acc, key) => {
        const candidate = strategySource[key];
        const enabled = typeof candidate?.enabled === 'boolean' ? candidate.enabled : true;
        const rawPriority = candidate?.priority;
        const priority = Number.isFinite(rawPriority)
            ? Math.max(1, Math.floor(Number(rawPriority)))
            : DEFAULT_STRATEGY_PRIORITIES[key];
        const scope = MIXED_SCOPE_STRATEGY_KEYS.has(key) && candidate?.scope === 'cross-library'
            ? 'cross-library'
            : 'per-library';
        acc[key] = { enabled, priority, scope };
        return acc;
    }, {} as ChannelSetupConfig['strategyConfig']);

    return {
        ...config,
        selectedLibraryIds,
        maxChannels,
        minItemsPerChannel,
        buildMode,
        actorStudioCombineMode,
        strategyConfig,
        channelExpansion: normalizeChannelExpansion(config.channelExpansion),
        seriesOrdering: normalizeSeriesOrdering(config.seriesOrdering),
    };
};

export class ChannelSetupSessionState {
    step: SetupStep = 1;
    libraries: PlexLibrarySection[] = [];
    selectedLibraryIds: Set<string> = new Set();
    loadError: string | null = null;
    strategies: SetupStrategyState = createDefaultStrategyState();
    strategyOrder: SetupStrategyKey[] = createDefaultStrategyOrder();
    channelExpansion: ChannelExpansionState = defaultChannelExpansionState();
    seriesOrdering: SeriesOrderingState = defaultSeriesOrderingState();
    buildMode: ChannelSetupConfig['buildMode'] = 'replace';
    actorStudioCombineMode: ChannelSetupConfig['actorStudioCombineMode'] = 'separate';
    maxChannels = DEFAULT_CHANNEL_SETUP_MAX;
    minItems = DEFAULT_MIN_ITEMS_PER_CHANNEL;
    isLoading = false;
    isBuilding = false;
    isPreviewLoading = false;
    isReviewLoading = false;
    replaceConfirm = false;
    preview: ChannelSetupPreview | null = null;
    previewError: string | null = null;
    previewStatus: ChannelSetupPreviewUiStatus = 'idle';
    review: ChannelSetupReview | null = null;
    reviewError: string | null = null;
    lastPreviewKey: string | null = null;
    pendingPreviewKey: string | null = null;
    previewDeltas: Partial<Record<EstimateKey, number>> = {};
    previewDeltaExpiresAtMs = 0;
    recordApplied = false;
    setupContext: ChannelSetupContext = 'unknown';
    sessionToken = 0;

    getSnapshot(): ChannelSetupSessionSnapshot {
        return {
            step: this.step,
            libraries: [...this.libraries],
            selectedLibraryIds: new Set(this.selectedLibraryIds),
            loadError: this.loadError,
            strategies: cloneStrategies(this.strategies),
            strategyOrder: [...this.strategyOrder],
            channelExpansion: { ...this.channelExpansion },
            seriesOrdering: { ...this.seriesOrdering },
            buildMode: this.buildMode,
            actorStudioCombineMode: this.actorStudioCombineMode,
            maxChannels: this.maxChannels,
            minItems: this.minItems,
            isLoading: this.isLoading,
            isBuilding: this.isBuilding,
            isPreviewLoading: this.isPreviewLoading,
            isReviewLoading: this.isReviewLoading,
            replaceConfirm: this.replaceConfirm,
            preview: clonePreview(this.preview),
            previewError: this.previewError,
            previewStatus: this.previewStatus,
            review: cloneReview(this.review),
            reviewError: this.reviewError,
            previewDeltas: { ...this.previewDeltas },
            previewDeltaExpiresAtMs: this.previewDeltaExpiresAtMs,
            recordApplied: this.recordApplied,
            setupContext: this.setupContext,
        };
    }

    updateStrategyState(mutate: (draft: StrategyStepMutableState) => void): void {
        const strategies = SETUP_STRATEGY_KEYS.reduce<SetupStrategyState>((acc, key) => {
            const current = this.strategies[key];
            acc[key] = current ? { ...current } : { enabled: true, scope: 'per-library' };
            return acc;
        }, {} as SetupStrategyState);
        const strategyOrder = [...this.strategyOrder];
        const channelExpansion: ChannelExpansionState = { ...this.channelExpansion };
        const seriesOrdering: SeriesOrderingState = { ...this.seriesOrdering };
        const draft: StrategyStepMutableState = {
            strategies,
            strategyOrder,
            channelExpansion,
            seriesOrdering,
            buildMode: this.buildMode,
            actorStudioCombineMode: this.actorStudioCombineMode,
            maxChannels: this.maxChannels,
            minItems: this.minItems,
        };
        mutate(draft);
        this.strategies = draft.strategies;
        this.strategyOrder = draft.strategyOrder;
        this.channelExpansion = draft.channelExpansion;
        this.seriesOrdering = draft.seriesOrdering;
        this.buildMode = draft.buildMode;
        this.actorStudioCombineMode = draft.actorStudioCombineMode;
        this.maxChannels = draft.maxChannels;
        this.minItems = draft.minItems;
    }

    selectAllLibraries(): void {
        this.selectedLibraryIds = new Set(this.libraries.map((library) => library.id));
    }

    clearAllLibraries(): void {
        this.selectedLibraryIds = new Set();
    }

    toggleLibrarySelection(libraryId: string): boolean {
        const wasSelected = this.selectedLibraryIds.has(libraryId);
        if (wasSelected) {
            this.selectedLibraryIds.delete(libraryId);
        } else {
            this.selectedLibraryIds.add(libraryId);
        }
        return !wasSelected;
    }

    clearReviewForEdits(): void {
        this.review = null;
        this.reviewError = null;
        this.replaceConfirm = false;
    }

    clearPreviewDeltas(): void {
        this.previewDeltas = {};
        this.previewDeltaExpiresAtMs = 0;
    }

    clearDerivedPlanningState(): void {
        this.clearReviewForEdits();
        this.preview = null;
        this.previewError = null;
        this.previewStatus = 'idle';
        this.lastPreviewKey = null;
        this.pendingPreviewKey = null;
        this.clearPreviewDeltas();
    }

    buildConfig(serverId: string): ChannelSetupConfig {
        const strategyConfig = SETUP_STRATEGY_KEYS.reduce<ChannelSetupConfig['strategyConfig']>((acc, key) => {
            const priorityIndex = this.strategyOrder.indexOf(key);
            acc[key] = {
                enabled: this.strategies[key].enabled,
                priority: priorityIndex >= 0 ? priorityIndex + 1 : DEFAULT_STRATEGY_PRIORITIES[key],
                scope: this.strategies[key].scope,
            };
            return acc;
        }, {} as ChannelSetupConfig['strategyConfig']);

        return {
            serverId,
            selectedLibraryIds: Array.from(this.selectedLibraryIds),
            maxChannels: this.maxChannels,
            buildMode: this.buildMode,
            strategyConfig,
            channelExpansion: {
                addAlternateLineups: this.channelExpansion.addAlternateLineups,
                alternateLineupCopies: this.channelExpansion.alternateLineupCopies,
                variantType: this.channelExpansion.variantType,
                variantBlockSize: this.channelExpansion.variantBlockSize,
            },
            seriesOrdering: {
                basePlaybackMode: this.seriesOrdering.basePlaybackMode,
                baseBlockSize: this.seriesOrdering.baseBlockSize,
            },
            actorStudioCombineMode: this.actorStudioCombineMode,
            minItemsPerChannel: this.minItems,
        };
    }

    buildPreviewKey(config: ChannelSetupConfig): string {
        const previewConfig = { ...config, buildMode: undefined };
        return JSON.stringify(previewConfig);
    }

    hasSettledPreviewForKey(key: string): boolean {
        if (key !== this.lastPreviewKey || this.isPreviewLoading) {
            return false;
        }
        return this.preview !== null
            || this.previewStatus === 'blocked'
            || this.previewStatus === 'slow'
            || this.previewStatus === 'error';
    }

    resetForNewSession(): void {
        this.step = 1;
        this.isLoading = false;
        this.isBuilding = false;
        this.isPreviewLoading = false;
        this.isReviewLoading = false;
        this.replaceConfirm = false;
        this.libraries = [];
        this.selectedLibraryIds = new Set();
        this.loadError = null;
        this.maxChannels = DEFAULT_CHANNEL_SETUP_MAX;
        this.minItems = DEFAULT_MIN_ITEMS_PER_CHANNEL;
        this.strategies = createDefaultStrategyState();
        this.strategyOrder = createDefaultStrategyOrder();
        this.channelExpansion = defaultChannelExpansionState();
        this.seriesOrdering = defaultSeriesOrderingState();
        this.buildMode = 'replace';
        this.actorStudioCombineMode = 'separate';
        this.clearDerivedPlanningState();
        this.recordApplied = false;
        this.setupContext = 'unknown';
    }

    applySetupRecord(record: ChannelSetupRecord): void {
        const normalized = normalizeChannelSetupConfig(record);
        const availableIds = new Set(this.libraries.map((lib) => lib.id));
        const selected = normalized.selectedLibraryIds.filter((id) => availableIds.has(id));
        this.selectedLibraryIds = new Set(selected.length > 0 ? selected : this.libraries.map((lib) => lib.id));

        const defaults = createDefaultStrategyState();
        this.strategies = SETUP_STRATEGY_KEYS.reduce<SetupStrategyState>((acc, key) => {
            const configured = normalized.strategyConfig[key];
            acc[key] = {
                enabled: configured?.enabled ?? defaults[key].enabled,
                scope: strategySupportsMixedScope(key) && configured?.scope === 'cross-library' ? 'cross-library' : 'per-library',
            };
            return acc;
        }, createDefaultStrategyState());

        const sortedByPriority = [...SETUP_STRATEGY_KEYS].sort((a, b) => {
            const aPriority = normalized.strategyConfig[a].priority;
            const bPriority = normalized.strategyConfig[b].priority;
            const diff = aPriority - bPriority;
            if (diff !== 0) {
                return diff;
            }
            return compareSetupStrategyKeys(a, b);
        });
        this.strategyOrder = sortedByPriority;

        this.channelExpansion = {
            addAlternateLineups: normalized.channelExpansion?.addAlternateLineups === true,
            alternateLineupCopies: normalized.channelExpansion?.alternateLineupCopies ?? 1,
            variantType: normalized.channelExpansion?.variantType ?? 'none',
            variantBlockSize: normalized.channelExpansion?.variantBlockSize ?? DEFAULT_SERIES_BLOCK_PRESET,
        };

        this.seriesOrdering = {
            basePlaybackMode: normalized.seriesOrdering?.basePlaybackMode ?? 'shuffle',
            baseBlockSize: normalized.seriesOrdering?.baseBlockSize ?? DEFAULT_SERIES_BLOCK_PRESET,
        };

        this.maxChannels = normalized.maxChannels;
        this.minItems = normalized.minItemsPerChannel;
        this.buildMode = normalized.buildMode;
        this.actorStudioCombineMode = normalized.actorStudioCombineMode;
        this.clearDerivedPlanningState();
    }
}
