import type {
    ChannelBuildProgress,
    ChannelSetupConfig,
    ChannelSetupContext,
    ChannelSetupPreview,
    ChannelSetupRecord,
    ChannelSetupReview,
} from '../../../Orchestrator';
import type { AppOrchestrator } from '../../../Orchestrator';
import {
    DEFAULT_CHANNEL_SETUP_MAX,
    MAX_CHANNELS,
} from '../../scheduler/channel-manager/constants';
import {
    DEFAULT_MIN_ITEMS_PER_CHANNEL,
    DEFAULT_STRATEGY_PRIORITIES,
    MIXED_SCOPE_STRATEGY_KEYS,
    SETUP_STRATEGY_KEYS,
} from '../../../core/channel-setup/constants';
import type { PlexLibraryType } from '../../plex/library';
import { isAbortLikeError } from '../../../utils/errors';
import type { EstimateKey, SeriesOrderingState, StrategyStepMutableState } from './steps/types';
import { SERIES_BLOCK_PRESETS, type SetupStrategyKey } from './steps/constants';

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

export type SetupStrategyState = Record<SetupStrategyKey, {
    enabled: boolean;
    scope: 'per-library' | 'cross-library';
}>;

export type ChannelExpansionState = {
    addAlternateLineups: boolean;
    alternateLineupCopies: number;
    variantType: 'none' | 'sequential' | 'block';
    variantBlockSize: number;
};

export type SetupStep = 1 | 2 | 3;

export type ChannelSetupOrchestrator = Pick<
    AppOrchestrator,
    | 'getNavigation'
    | 'getLibrariesForSetup'
    | 'getChannelSetupRecord'
    | 'openServerSelect'
    | 'switchToChannelByNumber'
    | 'openEPG'
    | 'createChannelsFromSetup'
    | 'markSetupComplete'
    | 'getSetupPreview'
    | 'getSetupReview'
    | 'getSetupContextForSelectedServer'
    | 'getSelectedServerStorageKey'
    | 'getServerHealthStorageKey'
    | 'getSelectedServerId'
>;

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
    review: ChannelSetupReview | null;
    reviewError: string | null;
    previewDeltas: Partial<Record<EstimateKey, number>>;
    previewDeltaExpiresAtMs: number;
    recordApplied: boolean;
    setupContext: ChannelSetupContext;
};

export type ChannelSetupBuildOutcome =
    | { kind: 'missing-server' }
    | { kind: 'canceled' }
    | { kind: 'error'; message: string }
    | {
        kind: 'success';
        serverId: string;
        config: ChannelSetupConfig;
        result: Awaited<ReturnType<ChannelSetupOrchestrator['createChannelsFromSetup']>>;
    };

export class ChannelSetupSessionController {
    private readonly _orchestrator: ChannelSetupOrchestrator;
    private readonly _getSelectedServerId: () => string | null;

    private _step: SetupStep = 1;
    private _libraries: PlexLibraryType[] = [];
    private _selectedLibraryIds: Set<string> = new Set();
    private _strategies: SetupStrategyState = createDefaultStrategyState();
    private _strategyOrder: SetupStrategyKey[] = createDefaultStrategyOrder();
    private _channelExpansion: ChannelExpansionState = defaultChannelExpansionState();
    private _seriesOrdering: SeriesOrderingState = defaultSeriesOrderingState();
    private _buildMode: ChannelSetupConfig['buildMode'] = 'replace';
    private _actorStudioCombineMode: ChannelSetupConfig['actorStudioCombineMode'] = 'separate';
    private _maxChannels: number = DEFAULT_CHANNEL_SETUP_MAX;
    private _minItems: number = DEFAULT_MIN_ITEMS_PER_CHANNEL;

    private _buildAbortController: AbortController | null = null;
    private _previewAbortController: AbortController | null = null;
    private _reviewAbortController: AbortController | null = null;
    private _previewTimeoutId: ReturnType<typeof setTimeout> | null = null;

    private _isLoading = false;
    private _isBuilding = false;
    private _isPreviewLoading = false;
    private _isReviewLoading = false;
    private _replaceConfirm = false;

    private _preview: ChannelSetupPreview | null = null;
    private _previewError: string | null = null;
    private _review: ChannelSetupReview | null = null;
    private _reviewError: string | null = null;

    private _lastPreviewKey: string | null = null;
    private _pendingPreviewKey: string | null = null;
    private _previewDeltas: Partial<Record<EstimateKey, number>> = {};
    private _previewDeltaTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private _previewDeltaExpiresAtMs = 0;

    private _recordApplied = false;
    private _setupContext: ChannelSetupContext = 'unknown';
    private _sessionToken = 0;

    constructor(deps: {
        orchestrator: ChannelSetupOrchestrator;
        getSelectedServerId: () => string | null;
    }) {
        this._orchestrator = deps.orchestrator;
        this._getSelectedServerId = deps.getSelectedServerId;
    }

    getSnapshot(): ChannelSetupSessionSnapshot {
        return {
            step: this._step,
            libraries: this._libraries,
            selectedLibraryIds: this._selectedLibraryIds,
            strategies: this._strategies,
            strategyOrder: this._strategyOrder,
            channelExpansion: this._channelExpansion,
            seriesOrdering: this._seriesOrdering,
            buildMode: this._buildMode,
            actorStudioCombineMode: this._actorStudioCombineMode,
            maxChannels: this._maxChannels,
            minItems: this._minItems,
            isLoading: this._isLoading,
            isBuilding: this._isBuilding,
            isPreviewLoading: this._isPreviewLoading,
            isReviewLoading: this._isReviewLoading,
            replaceConfirm: this._replaceConfirm,
            preview: this._preview,
            previewError: this._previewError,
            review: this._review,
            reviewError: this._reviewError,
            previewDeltas: this._previewDeltas,
            previewDeltaExpiresAtMs: this._previewDeltaExpiresAtMs,
            recordApplied: this._recordApplied,
            setupContext: this._setupContext,
        };
    }

    beginSession(): void {
        this._sessionToken += 1;
        this._resetState();
    }

    endSession(): void {
        this._sessionToken += 1;
        this._cleanupStep2AsyncState();
        this._buildAbortController?.abort();
        this._buildAbortController = null;
        this._isBuilding = false;
    }

    async loadLibraries(): Promise<void> {
        const token = this._sessionToken;
        if (this._isLoading) {
            return;
        }
        this._isLoading = true;

        try {
            this._libraries = await this._orchestrator.getLibrariesForSetup();
            const serverId = this._getSelectedServerId();
            const record = serverId ? this._orchestrator.getChannelSetupRecord(serverId) : null;
            if (record) {
                this._applySetupRecord(record);
            } else {
                this._selectedLibraryIds = new Set(this._libraries.map((lib) => lib.id));
            }
            this._recordApplied = true;
            if (token !== this._sessionToken) {
                return;
            }
        } catch {
            if (token !== this._sessionToken) {
                return;
            }
            this._libraries = [];
            this._selectedLibraryIds = new Set();
            this._recordApplied = false;
        } finally {
            this._isLoading = false;
        }
    }

    syncSetupContext(): void {
        try {
            const context = this._orchestrator.getSetupContextForSelectedServer();
            if (context === 'first-time' || context === 'existing' || context === 'unknown') {
                this._setupContext = context;
                return;
            }
        } catch {
            // Ignore and fall back to unknown.
        }
        this._setupContext = 'unknown';
    }

    setStep(step: SetupStep): void {
        this._step = step;
        if (step !== 2) {
            this._cleanupStep2AsyncState();
        }
    }

    selectAllLibraries(): void {
        this._selectedLibraryIds = new Set(this._libraries.map((library) => library.id));
        this.clearReviewForEdits();
    }

    clearAllLibraries(): void {
        this._selectedLibraryIds = new Set();
        this.clearReviewForEdits();
    }

    toggleLibrary(libraryId: string): boolean {
        const wasSelected = this._selectedLibraryIds.has(libraryId);
        if (wasSelected) {
            this._selectedLibraryIds.delete(libraryId);
        } else {
            this._selectedLibraryIds.add(libraryId);
        }
        this.clearReviewForEdits();
        return !wasSelected;
    }

    updateStrategyState(mutate: (draft: StrategyStepMutableState) => void): void {
        const strategies = SETUP_STRATEGY_KEYS.reduce<SetupStrategyState>((acc, key) => {
            const current = this._strategies[key];
            acc[key] = current ? { ...current } : { enabled: true, scope: 'per-library' };
            return acc;
        }, {} as SetupStrategyState);
        const strategyOrder = [...this._strategyOrder];
        const channelExpansion: ChannelExpansionState = { ...this._channelExpansion };
        const seriesOrdering: SeriesOrderingState = { ...this._seriesOrdering };
        const draft: StrategyStepMutableState = {
            activeStrategyCategory: 'content-sources',
            strategies,
            strategyOrder,
            channelExpansion,
            seriesOrdering,
            buildMode: this._buildMode,
            actorStudioCombineMode: this._actorStudioCombineMode,
            maxChannels: this._maxChannels,
            minItems: this._minItems,
        };
        mutate(draft);
        this._strategies = draft.strategies;
        this._strategyOrder = draft.strategyOrder;
        this._channelExpansion = draft.channelExpansion;
        this._seriesOrdering = draft.seriesOrdering;
        this._buildMode = draft.buildMode;
        this._actorStudioCombineMode = draft.actorStudioCombineMode;
        this._maxChannels = draft.maxChannels;
        this._minItems = draft.minItems;
        this.clearReviewForEdits();
    }

    clearReviewForEdits(): void {
        this._review = null;
        this._reviewError = null;
        this._replaceConfirm = false;
    }

    clearReviewAndReturnToStep2(): void {
        this._reviewAbortController?.abort();
        this._review = null;
        this._reviewError = null;
        this._replaceConfirm = false;
        this._step = 2;
    }

    toggleReplaceConfirm(): void {
        this._replaceConfirm = !this._replaceConfirm;
    }

    buildConfig(serverId: string): ChannelSetupConfig {
        const strategyConfig = SETUP_STRATEGY_KEYS.reduce<ChannelSetupConfig['strategyConfig']>((acc, key) => {
            const priorityIndex = this._strategyOrder.indexOf(key);
            acc[key] = {
                enabled: this._strategies[key].enabled,
                priority: priorityIndex >= 0 ? priorityIndex + 1 : DEFAULT_STRATEGY_PRIORITIES[key],
                scope: this._strategies[key].scope,
            };
            return acc;
        }, {} as ChannelSetupConfig['strategyConfig']);

        return {
            serverId,
            selectedLibraryIds: Array.from(this._selectedLibraryIds),
            maxChannels: this._maxChannels,
            buildMode: this._buildMode,
            strategyConfig,
            channelExpansion: {
                addAlternateLineups: this._channelExpansion.addAlternateLineups,
                alternateLineupCopies: this._channelExpansion.alternateLineupCopies,
                variantType: this._channelExpansion.variantType,
                variantBlockSize: this._channelExpansion.variantBlockSize,
            },
            seriesOrdering: {
                basePlaybackMode: this._seriesOrdering.basePlaybackMode,
                baseBlockSize: this._seriesOrdering.baseBlockSize,
            },
            actorStudioCombineMode: this._actorStudioCombineMode,
            minItemsPerChannel: this._minItems,
        };
    }

    buildPreviewKey(config: ChannelSetupConfig): string {
        const previewConfig = { ...config, buildMode: undefined };
        return JSON.stringify(previewConfig);
    }

    schedulePreview(onStateChange: () => void): void {
        if (this._step !== 2) {
            return;
        }
        const serverId = this._getSelectedServerId();
        if (!serverId) {
            this._previewError = 'No server selected.';
            onStateChange();
            return;
        }

        const key = this.buildPreviewKey(this.buildConfig(serverId));
        if (key === this._lastPreviewKey && this._preview && !this._isPreviewLoading) {
            return;
        }
        if (this._isPreviewLoading && key === this._pendingPreviewKey) {
            return;
        }

        this._pendingPreviewKey = key;
        if (this._previewTimeoutId !== null) {
            clearTimeout(this._previewTimeoutId);
        }
        this._previewTimeoutId = setTimeout(() => {
            void this._refreshPreview(onStateChange);
        }, 400);
    }

    async ensureReviewLoaded(onStateChange: () => void): Promise<void> {
        const token = this._sessionToken;
        const serverId = this._getSelectedServerId();
        if (!serverId) {
            this._reviewError = 'No server selected.';
            onStateChange();
            return;
        }
        if (this._isReviewLoading) {
            return;
        }
        if (this._review) {
            return;
        }

        this._reviewAbortController?.abort();
        this._reviewAbortController = new AbortController();
        this._isReviewLoading = true;
        this._reviewError = null;
        onStateChange();

        try {
            const review = await this._orchestrator.getSetupReview(this.buildConfig(serverId), {
                signal: this._reviewAbortController.signal,
            });
            if (token !== this._sessionToken) return;
            this._review = review;
        } catch (error) {
            if (token !== this._sessionToken) return;
            if (isAbortLikeError(error, this._reviewAbortController?.signal)) {
                return;
            }
            this._reviewError = error instanceof Error ? error.message : 'Unable to load review.';
            this._review = null;
        } finally {
            this._isReviewLoading = false;
            if (token === this._sessionToken) {
                onStateChange();
            }
        }
    }

    async beginBuild(
        options: {
            onProgress: (progress: ChannelBuildProgress) => void;
            onStateChange: () => void;
        }
    ): Promise<ChannelSetupBuildOutcome> {
        if (this._buildAbortController) {
            return { kind: 'canceled' };
        }

        const token = this._sessionToken;
        const serverId = this._getSelectedServerId();
        if (!serverId) {
            return { kind: 'missing-server' };
        }

        this._isBuilding = true;
        this._buildAbortController = new AbortController();
        options.onStateChange();

        const config = this.buildConfig(serverId);

        try {
            const result = await this._orchestrator.createChannelsFromSetup(config, {
                signal: this._buildAbortController.signal,
                onProgress: options.onProgress,
            });

            if (token !== this._sessionToken) {
                return { kind: 'canceled' };
            }

            if (result.canceled) {
                return { kind: 'canceled' };
            }

            this._orchestrator.markSetupComplete(serverId, config);
            return {
                kind: 'success',
                serverId,
                config,
                result,
            };
        } catch (error) {
            if (isAbortLikeError(error, this._buildAbortController?.signal)) {
                return { kind: 'canceled' };
            }
            const message = error instanceof Error ? error.message : 'Build failed.';
            return { kind: 'error', message };
        } finally {
            this._isBuilding = false;
            this._buildAbortController = null;
            if (token === this._sessionToken) {
                options.onStateChange();
            }
        }
    }

    cancelBuild(): boolean {
        if (!this._buildAbortController) {
            return false;
        }
        this._buildAbortController.abort();
        return true;
    }

    private async _refreshPreview(onStateChange: () => void): Promise<void> {
        if (this._step !== 2) return;

        const token = this._sessionToken;
        const serverId = this._getSelectedServerId();
        if (!serverId) {
            this._previewError = 'No server selected.';
            this._preview = null;
            this._clearPreviewDeltas();
            this._isPreviewLoading = false;
            this._pendingPreviewKey = null;
            onStateChange();
            return;
        }

        const config = this.buildConfig(serverId);
        const key = this.buildPreviewKey(config);
        if (key === this._lastPreviewKey && this._preview && !this._isPreviewLoading) {
            return;
        }
        if (this._pendingPreviewKey === key) {
            this._pendingPreviewKey = null;
        }

        this._previewAbortController?.abort();
        this._previewAbortController = new AbortController();
        this._isPreviewLoading = true;
        this._previewError = null;
        onStateChange();

        try {
            const preview = await this._orchestrator.getSetupPreview(config, {
                signal: this._previewAbortController.signal,
            });
            if (token !== this._sessionToken) return;
            const prevEstimates = this._preview?.estimates ?? null;
            this._preview = preview;
            this._lastPreviewKey = key;
            if (prevEstimates) {
                this._setPreviewDeltas(prevEstimates, preview.estimates, onStateChange);
            } else {
                this._clearPreviewDeltas();
            }
        } catch (error) {
            if (token !== this._sessionToken) return;
            if (isAbortLikeError(error, this._previewAbortController?.signal)) {
                return;
            }
            this._previewError = error instanceof Error ? error.message : 'Unable to estimate channels.';
            this._preview = null;
            this._clearPreviewDeltas();
        } finally {
            if (token === this._sessionToken) {
                this._isPreviewLoading = false;
                if (this._step === 2) {
                    onStateChange();
                }
            }
        }
    }

    private _resetState(): void {
        this._buildAbortController?.abort();
        this._previewAbortController?.abort();
        this._reviewAbortController?.abort();
        this._buildAbortController = null;
        this._previewAbortController = null;
        this._reviewAbortController = null;
        if (this._previewTimeoutId !== null) {
            clearTimeout(this._previewTimeoutId);
            this._previewTimeoutId = null;
        }

        this._clearPreviewDeltas();
        this._step = 1;
        this._isLoading = false;
        this._isBuilding = false;
        this._isPreviewLoading = false;
        this._isReviewLoading = false;
        this._replaceConfirm = false;

        this._libraries = [];
        this._selectedLibraryIds = new Set();
        this._maxChannels = DEFAULT_CHANNEL_SETUP_MAX;
        this._minItems = DEFAULT_MIN_ITEMS_PER_CHANNEL;
        this._strategies = createDefaultStrategyState();
        this._strategyOrder = createDefaultStrategyOrder();
        this._channelExpansion = defaultChannelExpansionState();
        this._seriesOrdering = defaultSeriesOrderingState();
        this._buildMode = 'replace';
        this._actorStudioCombineMode = 'separate';

        this._preview = null;
        this._previewError = null;
        this._review = null;
        this._reviewError = null;
        this._lastPreviewKey = null;
        this._pendingPreviewKey = null;
        this._recordApplied = false;
        this._setupContext = 'unknown';
    }

    private _cleanupStep2AsyncState(): void {
        this._previewAbortController?.abort();
        this._reviewAbortController?.abort();
        this._previewAbortController = null;
        this._reviewAbortController = null;
        if (this._previewTimeoutId !== null) {
            clearTimeout(this._previewTimeoutId);
            this._previewTimeoutId = null;
        }
        this._pendingPreviewKey = null;
        this._isPreviewLoading = false;
        this._isReviewLoading = false;
        this._clearPreviewDeltas();
    }

    private _clearPreviewDeltas(): void {
        if (this._previewDeltaTimeoutId !== null) {
            clearTimeout(this._previewDeltaTimeoutId);
            this._previewDeltaTimeoutId = null;
        }
        this._previewDeltas = {};
        this._previewDeltaExpiresAtMs = 0;
    }

    private _setPreviewDeltas(
        prev: ChannelSetupPreview['estimates'],
        next: ChannelSetupPreview['estimates'],
        onStateChange: () => void
    ): void {
        const keys = Object.keys(next) as EstimateKey[];
        const deltas: Partial<Record<EstimateKey, number>> = {};
        for (const key of keys) {
            const a = prev[key];
            const b = next[key];
            if (typeof a === 'number' && typeof b === 'number') {
                const delta = b - a;
                if (delta !== 0) {
                    deltas[key] = delta;
                }
            }
        }

        this._previewDeltas = deltas;
        this._previewDeltaExpiresAtMs = Date.now() + 3000;
        if (this._previewDeltaTimeoutId !== null) {
            clearTimeout(this._previewDeltaTimeoutId);
            this._previewDeltaTimeoutId = null;
        }

        if (Object.keys(deltas).length > 0) {
            const token = this._sessionToken;
            this._previewDeltaTimeoutId = setTimeout(() => {
                if (token !== this._sessionToken) return;
                this._clearPreviewDeltas();
                if (this._step === 2) {
                    onStateChange();
                }
            }, 3000);
        }
    }

    private _applySetupRecord(record: ChannelSetupRecord): void {
        const availableIds = new Set(this._libraries.map((lib) => lib.id));
        const selected = record.selectedLibraryIds.filter((id) => availableIds.has(id));
        this._selectedLibraryIds = new Set(selected.length > 0 ? selected : this._libraries.map((lib) => lib.id));

        const defaults = createDefaultStrategyState();
        this._strategies = SETUP_STRATEGY_KEYS.reduce<SetupStrategyState>((acc, key) => {
            const configured = record.strategyConfig[key];
            acc[key] = {
                enabled: configured?.enabled ?? defaults[key].enabled,
                scope: strategySupportsMixedScope(key) && configured?.scope === 'cross-library' ? 'cross-library' : 'per-library',
            };
            return acc;
        }, createDefaultStrategyState());

        const sortedByPriority = [...SETUP_STRATEGY_KEYS].sort((a, b) => {
            const aPriority = Number.isFinite(record.strategyConfig[a]?.priority)
                ? Math.max(1, Math.floor(Number(record.strategyConfig[a]?.priority)))
                : DEFAULT_STRATEGY_PRIORITIES[a];
            const bPriority = Number.isFinite(record.strategyConfig[b]?.priority)
                ? Math.max(1, Math.floor(Number(record.strategyConfig[b]?.priority)))
                : DEFAULT_STRATEGY_PRIORITIES[b];
            const diff = aPriority - bPriority;
            if (diff !== 0) {
                return diff;
            }
            return compareSetupStrategyKeys(a, b);
        });
        this._strategyOrder = sortedByPriority;

        this._channelExpansion = {
            addAlternateLineups: record.channelExpansion?.addAlternateLineups === true,
            alternateLineupCopies: Number.isFinite(record.channelExpansion?.alternateLineupCopies)
                ? Math.min(3, Math.max(1, Math.floor(Number(record.channelExpansion?.alternateLineupCopies))))
                : 1,
            variantType:
                record.channelExpansion?.variantType === 'sequential' || record.channelExpansion?.variantType === 'block'
                    ? record.channelExpansion.variantType
                    : 'none',
            variantBlockSize: clampSeriesBlockPreset(record.channelExpansion?.variantBlockSize),
        };

        this._seriesOrdering = {
            basePlaybackMode:
                record.seriesOrdering?.basePlaybackMode === 'sequential' || record.seriesOrdering?.basePlaybackMode === 'block'
                    ? record.seriesOrdering.basePlaybackMode
                    : 'shuffle',
            baseBlockSize: clampSeriesBlockPreset(record.seriesOrdering?.baseBlockSize),
        };

        this._maxChannels = Math.min(Number.isFinite(record.maxChannels) ? record.maxChannels : DEFAULT_CHANNEL_SETUP_MAX, MAX_CHANNELS);
        this._minItems = Math.max(1, Math.floor(record.minItemsPerChannel || DEFAULT_MIN_ITEMS_PER_CHANNEL));
        this._buildMode = record.buildMode ?? 'replace';
        this._actorStudioCombineMode = record.actorStudioCombineMode ?? 'separate';
        this._preview = null;
        this._previewError = null;
        this._lastPreviewKey = null;
        this._pendingPreviewKey = null;
        this._clearPreviewDeltas();
    }
}
