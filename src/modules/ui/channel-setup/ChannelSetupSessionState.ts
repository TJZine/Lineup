import type {
    ChannelSetupConfig,
    ChannelSetupContext,
    ChannelSetupPreview,
    ChannelSetupRecord,
    ChannelSetupReview,
    ChannelExpansionConfig,
    SeriesOrderingConfig,
    SetupStrategyConfig,
} from '../../../core/channel-setup/types';
import {
    DEFAULT_CHANNEL_SETUP_MAX,
} from '../../scheduler/channel-manager/constants';
import {
    DEFAULT_MIN_ITEMS_PER_CHANNEL,
    DEFAULT_STRATEGY_PRIORITIES,
    MIXED_SCOPE_STRATEGY_KEYS,
    SETUP_STRATEGY_KEYS,
} from '../../../core/channel-setup/constants';
import { normalizeChannelSetupConfig } from '../../../core/channel-setup/normalizeChannelSetupConfig';
import type { PlexLibraryType } from '../../plex/library';
import {
    SERIES_BLOCK_PRESETS,
    type SetupStrategyKey,
    type StrategyCategoryKey,
} from './steps/constants';

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

type SetupStrategyStateItem = Pick<SetupStrategyConfig, 'enabled' | 'scope'>;
export type SetupStrategyState = Record<SetupStrategyKey, SetupStrategyStateItem>;

export type ChannelExpansionState = Pick<
    ChannelExpansionConfig,
    'addAlternateLineups' | 'alternateLineupCopies' | 'variantType' | 'variantBlockSize'
>;

export type SeriesOrderingState = Pick<SeriesOrderingConfig, 'basePlaybackMode' | 'baseBlockSize'>;

export type StrategyStepMutableState = {
    activeStrategyCategory: StrategyCategoryKey;
    strategies: SetupStrategyState;
    strategyOrder: SetupStrategyKey[];
    channelExpansion: ChannelExpansionState;
    seriesOrdering: SeriesOrderingState;
    buildMode: ChannelSetupConfig['buildMode'];
    actorStudioCombineMode: ChannelSetupConfig['actorStudioCombineMode'];
    maxChannels: number;
    minItems: number;
};

export type EstimateKey = keyof ChannelSetupPreview['estimates'];

export type SetupStep = 1 | 2 | 3;

export type ChannelSetupPreviewUiStatus = 'idle' | 'loading' | 'ready' | 'blocked' | 'slow' | 'error';

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

export type ChannelSetupSessionSnapshot = {
    step: SetupStep;
    libraries: PlexLibraryType[];
    selectedLibraryIds: Set<string>;
    loadError: string | null;
    strategies: SetupStrategyState;
    strategyOrder: SetupStrategyKey[];
    channelExpansion: ChannelExpansionState;
    seriesOrdering: SeriesOrderingState;
    buildMode: ChannelSetupConfig['buildMode'];
    actorStudioCombineMode: ChannelSetupConfig['actorStudioCombineMode'];
    maxChannels: number;
    minItems: number;
    isLoading: boolean;
    isBuilding: boolean;
    isPreviewLoading: boolean;
    isReviewLoading: boolean;
    replaceConfirm: boolean;
    preview: ChannelSetupPreview | null;
    previewError: string | null;
    previewStatus: ChannelSetupPreviewUiStatus;
    review: ChannelSetupReview | null;
    reviewError: string | null;
    previewDeltas: Partial<Record<EstimateKey, number>>;
    previewDeltaExpiresAtMs: number;
    recordApplied: boolean;
    setupContext: ChannelSetupContext;
};

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

export class ChannelSetupSessionState {
    step: SetupStep = 1;
    libraries: PlexLibraryType[] = [];
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
            activeStrategyCategory: 'content-sources',
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
            const aPriority = Number.isFinite(normalized.strategyConfig[a]?.priority)
                ? Math.max(1, Math.floor(Number(normalized.strategyConfig[a]?.priority)))
                : DEFAULT_STRATEGY_PRIORITIES[a];
            const bPriority = Number.isFinite(normalized.strategyConfig[b]?.priority)
                ? Math.max(1, Math.floor(Number(normalized.strategyConfig[b]?.priority)))
                : DEFAULT_STRATEGY_PRIORITIES[b];
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
            variantBlockSize: clampSeriesBlockPreset(normalized.channelExpansion?.variantBlockSize),
        };

        this.seriesOrdering = {
            basePlaybackMode: normalized.seriesOrdering?.basePlaybackMode ?? 'shuffle',
            baseBlockSize: clampSeriesBlockPreset(normalized.seriesOrdering?.baseBlockSize),
        };

        this.maxChannels = normalized.maxChannels;
        this.minItems = normalized.minItemsPerChannel;
        this.buildMode = normalized.buildMode;
        this.actorStudioCombineMode = normalized.actorStudioCombineMode;
        this.clearDerivedPlanningState();
    }
}
