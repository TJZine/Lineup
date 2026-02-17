/**
 * @fileoverview Channel setup wizard screen.
 * @module modules/ui/channel-setup/ChannelSetupScreen
 * @version 1.0.0
 */

import {
    type ChannelSetupConfig,
    type ChannelSetupContext,
    type ChannelBuildProgress,
    type ChannelSetupPreview,
    type ChannelSetupReview,
    type ChannelSetupRecord,
} from '../../../Orchestrator';
import type { AppOrchestrator } from '../../../Orchestrator';
import type { PlexLibraryType } from '../../plex/library';
import type { FocusableElement, KeyEvent } from '../../navigation';
import { safeLocalStorageGet } from '../../../utils/storage';
import { isAbortLikeError, summarizeErrorForLog } from '../../../utils/errors';
import { DEFAULT_CHANNEL_SETUP_MAX, MAX_CHANNELS } from '../../scheduler/channel-manager/constants';
import {
    DEFAULT_MIN_ITEMS_PER_CHANNEL,
    DEFAULT_STRATEGY_PRIORITIES,
    MIXED_SCOPE_STRATEGY_KEYS,
    SETUP_STRATEGY_KEYS,
} from '../../../core/channel-setup/constants';
import { createScreenShell } from '../common/ScreenShell';
import { ChannelSetupFocusCoordinator } from './focus/ChannelSetupFocusCoordinator';
import { LibraryStepController } from './steps/LibraryStepController';
import { StrategyStepController } from './steps/StrategyStepController';
import { BuildReviewStepController } from './steps/BuildReviewStepController';
import { BuildProgressStepController } from './steps/BuildProgressStepController';
import type { BuildReviewStateSnapshot, StrategyStepMutableState } from './steps/types';
import {
    ADVANCED_STRATEGY_KEYS,
    CONTENT_STRATEGY_KEYS,
    STEP2_CONTROL_IDS,
    STRATEGY_CATEGORIES,
    type SetupStrategyKey,
    type StrategyCategoryKey,
} from './steps/constants';
import { scrollToNearest } from './focus/scrollToNearest';

const CHANNEL_LIMIT_PRESETS = [50, 100, 150, 200, 300, 400, 500];

type SetupStrategyState = Record<SetupStrategyKey, {
    enabled: boolean;
    priority: number;
    scope: 'per-library' | 'cross-library';
}>;

type ChannelExpansionState = {
    addAlternateLineups: boolean;
    alternateLineupCopies: number;
    addSequentialVariants: boolean;
};

const strategySupportsMixedScope = (key: SetupStrategyKey): boolean =>
    MIXED_SCOPE_STRATEGY_KEYS.has(key);

const createDefaultStrategyState = (): SetupStrategyState => ({
    collections: { enabled: true, priority: DEFAULT_STRATEGY_PRIORITIES.collections, scope: 'per-library' },
    playlists: { enabled: true, priority: DEFAULT_STRATEGY_PRIORITIES.playlists, scope: 'per-library' },
    genres: { enabled: true, priority: DEFAULT_STRATEGY_PRIORITIES.genres, scope: 'per-library' },
    directors: { enabled: true, priority: DEFAULT_STRATEGY_PRIORITIES.directors, scope: 'per-library' },
    decades: { enabled: true, priority: DEFAULT_STRATEGY_PRIORITIES.decades, scope: 'per-library' },
    recentlyAdded: { enabled: true, priority: DEFAULT_STRATEGY_PRIORITIES.recentlyAdded, scope: 'per-library' },
    studios: { enabled: true, priority: DEFAULT_STRATEGY_PRIORITIES.studios, scope: 'per-library' },
    actors: { enabled: true, priority: DEFAULT_STRATEGY_PRIORITIES.actors, scope: 'per-library' },
});

const defaultChannelExpansionState = (): ChannelExpansionState => ({
    addAlternateLineups: false,
    alternateLineupCopies: 1,
    addSequentialVariants: false,
});

type SetupStep = 1 | 2 | 3;
type EstimateKey = keyof ChannelSetupPreview['estimates'];

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
    | 'getSelectedServerId'
>;

const MOVIE_SVG = `
<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" aria-hidden="true">
  <rect x="3" y="5" width="18" height="14" rx="2"></rect>
  <path d="M8 3v4"></path>
  <path d="M16 3v4"></path>
  <path d="M8 19v2"></path>
  <path d="M16 19v2"></path>
</svg>
`;

const SHOW_SVG = `
<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" aria-hidden="true">
  <rect x="2" y="3" width="20" height="14" rx="2"></rect>
  <path d="M8 21h8"></path>
  <path d="M12 17v4"></path>
  <path d="M6 7h12"></path>
</svg>
`;

export class ChannelSetupScreen {
    private _container: HTMLElement;
    private _orchestrator: ChannelSetupOrchestrator;
    private readonly _focus: ChannelSetupFocusCoordinator;
    private _destroyScreenShell: (() => void) | null = null;
    private readonly _libraryStep = new LibraryStepController();
    private readonly _strategyStep = new StrategyStepController();
    private readonly _buildReviewStep = new BuildReviewStepController();
    private readonly _buildProgressStep = new BuildProgressStepController();
    private _stepEl: HTMLElement;
    private _statusEl: HTMLElement;
    private _detailEl: HTMLElement;
    private _errorEl: HTMLElement;
    private _contentEl: HTMLElement;

    private _libraries: PlexLibraryType[] = [];
    private _selectedLibraryIds: Set<string> = new Set();
    private _strategies: SetupStrategyState = createDefaultStrategyState();
    private _channelExpansion: ChannelExpansionState = defaultChannelExpansionState();
    private _activeStrategyCategory: StrategyCategoryKey = 'content-sources';
    private _rememberedDetailFocusByCategory: Partial<Record<StrategyCategoryKey, string>> = {};
    private _buildMode: ChannelSetupConfig['buildMode'] = 'replace';
    private _actorStudioCombineMode: ChannelSetupConfig['actorStudioCombineMode'] = 'separate';
    private _maxChannels: number = DEFAULT_CHANNEL_SETUP_MAX;
    private _minItems: number = DEFAULT_MIN_ITEMS_PER_CHANNEL;
    private _channelLimitOptions: number[] = CHANNEL_LIMIT_PRESETS.filter((value) => value <= MAX_CHANNELS);
    private _minItemsOptions: number[] = [1, 5, 10, 20, 50];
    private _buildAbortController: AbortController | null = null;
    private _previewAbortController: AbortController | null = null;
    private _reviewAbortController: AbortController | null = null;
    private _previewTimeoutId: number | null = null;
    private _step: SetupStep = 1;
    private _preferredFocusId: string | null = null;
    private _isLoading: boolean = false;
    private _isBuilding: boolean = false;
    private _isPreviewLoading: boolean = false;
    private _isReviewLoading: boolean = false;
    private _replaceConfirm: boolean = false;
    private _visibilityToken = 0;
    private _navKeyHandler: ((event: KeyEvent) => void) | null = null;
    private _preview: ChannelSetupPreview | null = null;
    private _previewError: string | null = null;
    private _review: ChannelSetupReview | null = null;
    private _reviewError: string | null = null;
    private _lastPreviewKey: string | null = null;
    private _pendingPreviewKey: string | null = null;
    private _previewDeltas: Partial<Record<EstimateKey, number>> = {};
    private _previewDeltaTimeoutId: number | null = null;
    private _previewDeltaExpiresAtMs: number = 0;
    private _previewPanelId = 'setup-preview-panel';
    private _maxPreviewWarnings = 5;
    private _recordApplied = false;
    private _setupContext: ChannelSetupContext = 'unknown';

    private _getNearestOptionIndex(options: number[], current: number): number {
        const first = options[0];
        if (first === undefined) return -1;
        let nearestIndex = 0;
        let smallestDiff = Math.abs(first - current);
        for (let i = 1; i < options.length; i++) {
            const option = options[i];
            if (option === undefined) continue;
            const diff = Math.abs(option - current);
            if (diff < smallestDiff) {
                smallestDiff = diff;
                nearestIndex = i;
            }
        }
        return nearestIndex;
    }

    private _stepPreset(
        options: number[],
        current: number,
        dir: 'left' | 'right',
        mode: 'clamp' | 'wrap'
    ): number {
        if (options.length === 0) return current;
        const currentIndex = options.indexOf(current);
        const baseIndex = currentIndex >= 0 ? currentIndex : this._getNearestOptionIndex(options, current);
        if (baseIndex < 0) return current;
        const lastIndex = options.length - 1;
        const nextIndex = mode === 'wrap'
            ? dir === 'left'
                ? (baseIndex - 1 + options.length) % options.length
                : (baseIndex + 1) % options.length
            : dir === 'left'
                ? Math.max(0, baseIndex - 1)
                : Math.min(lastIndex, baseIndex + 1);
        return options[nextIndex] ?? current;
    }

    private _toDomId(raw: string): string {
        return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    private _strategyButtonId(strategy: SetupStrategyKey): string {
        return `setup-strategy-${this._toDomId(String(strategy))}`;
    }

    private _priorityButtonId(strategy: SetupStrategyKey): string {
        return `setup-priority-${this._toDomId(String(strategy))}`;
    }

    private _scopeButtonId(strategy: SetupStrategyKey): string {
        return `setup-scope-${this._toDomId(String(strategy))}`;
    }

    private _formatCount(value: number): string {
        try {
            return new Intl.NumberFormat().format(value);
        } catch {
            return String(value);
        }
    }

    constructor(container: HTMLElement, orchestrator: ChannelSetupOrchestrator) {
        this._container = container;
        this._orchestrator = orchestrator;
        this._focus = new ChannelSetupFocusCoordinator({
            getNavigation: (): ReturnType<ChannelSetupOrchestrator['getNavigation']> => this._orchestrator.getNavigation(),
        });

        if (!this._channelLimitOptions.includes(DEFAULT_CHANNEL_SETUP_MAX)) {
            this._channelLimitOptions.push(DEFAULT_CHANNEL_SETUP_MAX);
            this._channelLimitOptions.sort((a, b) => a - b);
        }

        this._container.classList.add('screen');
        this._container.style.position = 'absolute';
        this._container.style.inset = '0';
        this._container.style.display = 'none';
        this._container.style.alignItems = 'center';
        this._container.style.justifyContent = 'center';

        const shell = createScreenShell(this._container, {
            title: 'Channel Setup',
            subtitle: 'Build a clean, remote-first channel lineup for this server.',
            status: {
                title: '',
                tone: 'neutral',
            },
            error: null,
            actions: [],
        });
        this._destroyScreenShell = shell.destroy;
        shell.panelEl.classList.add('setup-panel');

        const stepEl = document.createElement('div');
        stepEl.className = 'setup-step';
        shell.contentEl.insertBefore(stepEl, shell.statusEl);
        this._stepEl = stepEl;

        this._statusEl = shell.statusEl;
        this._detailEl = shell.detailEl;
        this._errorEl = shell.errorEl;

        const content = document.createElement('div');
        content.className = 'setup-body';
        shell.contentEl.appendChild(content);
        this._contentEl = content;
    }

    destroy(): void {
        this.hide();
        this._destroyScreenShell?.();
        this._destroyScreenShell = null;
    }

    show(): void {
        this._visibilityToken += 1;
        this._container.style.display = 'flex';
        this._container.classList.add('visible');
        const nav = this._orchestrator.getNavigation();
        if (nav && !this._navKeyHandler) {
            this._navKeyHandler = (event: KeyEvent): void => {
                if (event.handled || this._step !== 2) return;
                const focusedId = nav.getFocusedElement()?.id ?? null;
                const direction = event.button === 'left'
                    ? 'left'
                    : event.button === 'right'
                        ? 'right'
                        : null;
                if (!direction || !focusedId) return;

                const activeCategoryButtonId = this._categoryButtonId(this._activeStrategyCategory);
                const activeDetailIds = this._getDetailControlIdsForCategory(this._activeStrategyCategory);
                const focusedCategory = this._categoryFromButtonId(focusedId);

                if (focusedCategory && direction === 'right') {
                    if (focusedCategory !== this._activeStrategyCategory) {
                        this._activeStrategyCategory = focusedCategory;
                    }
                    const detailIds = this._getDetailControlIdsForCategory(focusedCategory);
                    const target = this._resolveDetailFocusTarget(focusedCategory, detailIds);
                    if (target) {
                        event.handled = true;
                        this._preferredFocusId = target;
                        this._rememberedDetailFocusByCategory[focusedCategory] = target;
                        this._renderStep();
                    }
                    return;
                }

                const isPriorityControl = focusedId.startsWith('setup-priority-');
                const isAdjustableControl = focusedId === STEP2_CONTROL_IDS.maxChannels
                    || focusedId === STEP2_CONTROL_IDS.minItems
                    || focusedId === STEP2_CONTROL_IDS.alternateLineupCopies
                    || isPriorityControl;
                if (isAdjustableControl) {
                    let previousValue = 0;
                    let nextValue = 0;

                    if (focusedId === STEP2_CONTROL_IDS.maxChannels) {
                        previousValue = this._maxChannels;
                        nextValue = this._stepPreset(this._channelLimitOptions, this._maxChannels, direction, 'clamp');
                        this._maxChannels = nextValue;
                    } else if (focusedId === STEP2_CONTROL_IDS.minItems) {
                        previousValue = this._minItems;
                        nextValue = this._stepPreset(this._minItemsOptions, this._minItems, direction, 'clamp');
                        this._minItems = nextValue;
                    } else if (focusedId === STEP2_CONTROL_IDS.alternateLineupCopies) {
                        if (!this._channelExpansion.addAlternateLineups) {
                            return;
                        }
                        previousValue = this._channelExpansion.alternateLineupCopies;
                        nextValue = this._stepPreset([1, 2, 3], previousValue, direction, 'clamp');
                        this._channelExpansion.alternateLineupCopies = nextValue;
                    } else {
                        const strategy = this._strategyKeyFromControlId(focusedId, 'setup-priority-');
                        if (!strategy) {
                            return;
                        }
                        previousValue = this._strategies[strategy].priority;
                        const maxPriority = SETUP_STRATEGY_KEYS.length;
                        nextValue = direction === 'left'
                            ? Math.max(1, previousValue - 1)
                            : Math.min(maxPriority, previousValue + 1);
                        this._strategies[strategy].priority = nextValue;
                    }

                    event.handled = true;
                    if (direction === 'left' && nextValue === previousValue) {
                        this._preferredFocusId = activeCategoryButtonId;
                        nav.setFocus(activeCategoryButtonId);
                        return;
                    }
                    if (nextValue !== previousValue) {
                        this._preferredFocusId = focusedId;
                        this._rememberActiveDetailFocus(focusedId);
                        this._review = null;
                        this._reviewError = null;
                        this._schedulePreview();
                        this._renderStep();
                    }
                    return;
                }

                if (direction === 'left' && activeDetailIds.includes(focusedId)) {
                    event.handled = true;
                    this._preferredFocusId = activeCategoryButtonId;
                    nav.setFocus(activeCategoryButtonId);
                }
            };
            nav.on('keyPress', this._navKeyHandler);
        }
        this._resetState();
        this._loadLibraries().catch((error: unknown) => {
            if (isAbortLikeError(error)) return;
            console.error('[ChannelSetup] Load libraries failed:', summarizeErrorForLog(error));
        });
    }

    hide(): void {
        this._visibilityToken += 1;
        this._buildAbortController?.abort();
        this._previewAbortController?.abort();
        this._reviewAbortController?.abort();
        if (this._previewTimeoutId !== null) {
            window.clearTimeout(this._previewTimeoutId);
            this._previewTimeoutId = null;
        }
        if (this._navKeyHandler) {
            const nav = this._orchestrator.getNavigation();
            nav?.off('keyPress', this._navKeyHandler);
            this._navKeyHandler = null;
        }
        this._clearPreviewDeltas();
        this._unregisterFocusables();
        this._container.style.display = 'none';
        this._container.classList.remove('visible');
    }

    private _resetState(): void {
        this._buildAbortController?.abort();
        this._previewAbortController?.abort();
        this._reviewAbortController?.abort();
        if (this._previewTimeoutId !== null) {
            window.clearTimeout(this._previewTimeoutId);
            this._previewTimeoutId = null;
        }
        this._buildAbortController = null;
        this._previewAbortController = null;
        this._reviewAbortController = null;
        this._clearPreviewDeltas();
        this._step = 1;
        this._isLoading = false;
        this._isBuilding = false;
        this._isPreviewLoading = false;
        this._isReviewLoading = false;
        this._replaceConfirm = false;
        this._maxChannels = DEFAULT_CHANNEL_SETUP_MAX;
        this._minItems = DEFAULT_MIN_ITEMS_PER_CHANNEL;
        this._strategies = createDefaultStrategyState();
        this._channelExpansion = defaultChannelExpansionState();
        this._buildMode = 'replace';
        this._actorStudioCombineMode = 'separate';
        this._activeStrategyCategory = 'content-sources';
        this._rememberedDetailFocusByCategory = {};
        this._preview = null;
        this._previewError = null;
        this._review = null;
        this._reviewError = null;
        this._lastPreviewKey = null;
        this._pendingPreviewKey = null;
        this._recordApplied = false;
        this._setupContext = 'unknown';
        this._errorEl.textContent = '';
    }

    private async _loadLibraries(): Promise<void> {
        const token = this._visibilityToken;
        if (this._isLoading) {
            return;
        }
        this._isLoading = true;
        this._statusEl.textContent = 'Loading libraries...';
        this._detailEl.textContent = '';
        this._errorEl.textContent = '';

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
            if (token !== this._visibilityToken) {
                return;
            }
            this._renderStep();
        } catch (error) {
            if (token !== this._visibilityToken) {
                return;
            }
            const message = error instanceof Error ? error.message : 'Unable to load libraries.';
            this._errorEl.textContent = message;
            this._statusEl.textContent = 'Library load failed.';
        } finally {
            this._isLoading = false;
        }
    }

    private _renderStep(): void {
        const token = this._visibilityToken;
        const nav = this._orchestrator.getNavigation();
        const focusedId = nav?.getFocusedElement()?.id ?? null;
        if (focusedId && this._preferredFocusId === null) {
            this._preferredFocusId = focusedId;
        }
        this._unregisterFocusables();
        if (token !== this._visibilityToken) {
            return;
        }
        this._contentEl.innerHTML = '';

        if (this._step === 1) {
            this._renderLibraryStep();
        } else if (this._step === 2) {
            this._renderStrategyStep();
        } else {
            this._renderBuildStep();
        }
    }

    private _renderLibraryStep(): void {
        this._libraryStep.render({
            contentEl: this._contentEl,
            stepEl: this._stepEl,
            statusEl: this._statusEl,
            detailEl: this._detailEl,
            errorEl: this._errorEl,
        }, {
            libraries: this._libraries,
            selectedLibraryIds: this._selectedLibraryIds,
            formatCount: (value) => this._formatCount(value),
            movieSvg: MOVIE_SVG,
            showSvg: SHOW_SVG,
            toDomId: (raw) => this._toDomId(raw),
            onToggleLibrary: (libraryId, focusId) => {
                this._preferredFocusId = focusId;
                if (this._selectedLibraryIds.has(libraryId)) {
                    this._selectedLibraryIds.delete(libraryId);
                } else {
                    this._selectedLibraryIds.add(libraryId);
                }
                this._review = null;
                this._reviewError = null;
                this._replaceConfirm = false;
                this._renderStep();
            },
            onSelectAll: (focusId) => {
                this._selectedLibraryIds = new Set(this._libraries.map((library) => library.id));
                this._preferredFocusId = focusId;
                this._review = null;
                this._reviewError = null;
                this._replaceConfirm = false;
                this._renderStep();
            },
            onClearAll: (focusId) => {
                this._selectedLibraryIds = new Set();
                this._preferredFocusId = focusId;
                this._review = null;
                this._reviewError = null;
                this._replaceConfirm = false;
                this._renderStep();
            },
            onBack: () => {
                this._orchestrator.openServerSelect();
            },
            onNext: () => {
                this._step = 2;
                this._renderStep();
            },
            registerFocusables: (buttons, mode) => {
                this._registerFocusables(buttons, mode);
            },
            registerBulkActionNeighbors: (selectAllButton, clearAllButton, listButtons) => {
                this._registerBulkActionNeighbors(selectAllButton, clearAllButton, listButtons);
            },
        });
    }

    private _registerBulkActionNeighbors(
        selectAllButton: HTMLButtonElement,
        clearAllButton: HTMLButtonElement,
        listButtons: HTMLButtonElement[]
    ): void {
        const nav = this._orchestrator.getNavigation();
        if (!nav) {
            return;
        }
        const downNeighbor = listButtons[0]?.id;

        if (!selectAllButton.disabled) {
            const selectAllNeighbors: FocusableElement['neighbors'] = {};
            if (!clearAllButton.disabled) {
                selectAllNeighbors.right = clearAllButton.id;
            }
            if (downNeighbor) {
                selectAllNeighbors.down = downNeighbor;
            }
            nav.registerFocusable({
                id: selectAllButton.id,
                element: selectAllButton,
                neighbors: selectAllNeighbors,
                onFocus: () => {
                    scrollToNearest(selectAllButton);
                },
            });
        }

        if (!clearAllButton.disabled) {
            const clearAllNeighbors: FocusableElement['neighbors'] = {};
            if (!selectAllButton.disabled) {
                clearAllNeighbors.left = selectAllButton.id;
            }
            if (downNeighbor) {
                clearAllNeighbors.down = downNeighbor;
            }
            nav.registerFocusable({
                id: clearAllButton.id,
                element: clearAllButton,
                neighbors: clearAllNeighbors,
                onFocus: () => {
                    scrollToNearest(clearAllButton);
                },
            });
        }
    }

    private _renderStrategyStep(): void {
        this._refreshSetupContextForStep2();
        this._strategyStep.render({
            contentEl: this._contentEl,
            stepEl: this._stepEl,
            statusEl: this._statusEl,
            detailEl: this._detailEl,
            errorEl: this._errorEl,
        }, {
            state: {
                activeStrategyCategory: this._activeStrategyCategory,
                strategies: this._strategies,
                channelExpansion: this._channelExpansion,
                buildMode: this._buildMode,
                actorStudioCombineMode: this._actorStudioCombineMode,
                maxChannels: this._maxChannels,
                minItems: this._minItems,
                setupContext: this._setupContext,
                previewPanelId: this._previewPanelId,
                preview: this._preview,
                previewError: this._previewError,
                isPreviewLoading: this._isPreviewLoading,
            },
            stepPreset: (options, current, dir, mode) => this._stepPreset(options, current, dir, mode),
            channelLimitOptions: this._channelLimitOptions,
            minItemsOptions: this._minItemsOptions,
            strategyKeys: SETUP_STRATEGY_KEYS,
            categoryButtonId: (category) => this._categoryButtonId(category),
            strategyButtonId: (strategy) => this._strategyButtonId(strategy),
            priorityButtonId: (strategy) => this._priorityButtonId(strategy),
            scopeButtonId: (strategy) => this._scopeButtonId(strategy),
            strategySupportsMixedScope: (strategy) => strategySupportsMixedScope(strategy),
            rememberDetailFocus: (controlId) => this._rememberActiveDetailFocus(controlId),
            buildPreviewRow: (label, value, key) => this._buildPreviewRow(label, value, key),
            renderCappedWarnings: (warnings, container) => this._renderCappedWarnings(warnings, container),
            applyCategoryChange: (category, focusId) => {
                this._activeStrategyCategory = category;
                this._preferredFocusId = focusId;
                this._renderStep();
            },
            applySettingChange: (focusId, mutate) => {
                const strategies = SETUP_STRATEGY_KEYS.reduce<SetupStrategyState>((acc, key) => {
                    const current = this._strategies[key];
                    acc[key] = current ? { ...current } : { enabled: true, priority: 1, scope: 'per-library' };
                    return acc;
                }, {} as SetupStrategyState);
                const channelExpansion: ChannelExpansionState = { ...this._channelExpansion };
                const draft: StrategyStepMutableState = {
                    activeStrategyCategory: this._activeStrategyCategory,
                    strategies,
                    channelExpansion,
                    buildMode: this._buildMode,
                    actorStudioCombineMode: this._actorStudioCombineMode,
                    maxChannels: this._maxChannels,
                    minItems: this._minItems,
                };
                this._preferredFocusId = focusId;
                this._rememberActiveDetailFocus(focusId);
                mutate(draft);
                this._activeStrategyCategory = draft.activeStrategyCategory;
                this._strategies = draft.strategies;
                this._channelExpansion = draft.channelExpansion;
                this._buildMode = draft.buildMode;
                this._actorStudioCombineMode = draft.actorStudioCombineMode;
                this._maxChannels = draft.maxChannels;
                this._minItems = draft.minItems;
                this._review = null;
                this._reviewError = null;
                this._replaceConfirm = false;
                this._schedulePreview();
                this._renderStep();
            },
            onBack: () => {
                this._step = 1;
                this._renderStep();
            },
            onNext: () => {
                this._cleanupStep2AsyncState();
                this._isBuilding = this._setupContext === 'first-time';
                this._step = 3;
                this._renderStep();
            },
            registerStep2Focusables: (categoryButtons, detailButtons, backButton, nextButton) => {
                this._registerStep2Focusables(categoryButtons, detailButtons, backButton, nextButton);
            },
            detailText: this._strategies.genres.enabled || this._strategies.directors.enabled
                ? 'Performance warning: may be slow on large libraries.'
                : '',
            schedulePreview: () => this._schedulePreview(),
        });
    }

    private _categoryButtonId(category: StrategyCategoryKey): string {
        return `setup-category-${category}`;
    }

    private _categoryFromButtonId(buttonId: string): StrategyCategoryKey | null {
        const match = STRATEGY_CATEGORIES.find((category) => this._categoryButtonId(category) === buttonId);
        return match ?? null;
    }

    private _refreshSetupContextForStep2(): void {
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

    private _getDetailControlIdsForCategory(category: StrategyCategoryKey): string[] {
        if (category === 'content-sources') {
            return CONTENT_STRATEGY_KEYS.flatMap((key) => {
                const ids = [this._strategyButtonId(key), this._priorityButtonId(key)];
                if (strategySupportsMixedScope(key)) {
                    ids.push(this._scopeButtonId(key));
                }
                return ids;
            });
        }
        if (category === 'advanced-sources') {
            return ADVANCED_STRATEGY_KEYS.flatMap((key) => {
                const ids = [this._strategyButtonId(key), this._priorityButtonId(key)];
                if (strategySupportsMixedScope(key)) {
                    ids.push(this._scopeButtonId(key));
                }
                return ids;
            });
        }
        if (category === 'build-options') {
            return [
                STEP2_CONTROL_IDS.buildMode,
                STEP2_CONTROL_IDS.combineMode,
                STEP2_CONTROL_IDS.addAlternateLineups,
                STEP2_CONTROL_IDS.alternateLineupCopies,
                STEP2_CONTROL_IDS.addSequentialVariants,
            ];
        }
        return [STEP2_CONTROL_IDS.maxChannels, STEP2_CONTROL_IDS.minItems, STEP2_CONTROL_IDS.expandLineup];
    }

    private _resolveDetailFocusTarget(category: StrategyCategoryKey, availableIds: string[]): string | null {
        if (availableIds.length === 0) return null;
        const remembered = this._rememberedDetailFocusByCategory[category];
        if (remembered && availableIds.includes(remembered)) {
            return remembered;
        }
        return availableIds[0] ?? null;
    }

    private _strategyKeyFromControlId(controlId: string, prefix: string): SetupStrategyKey | null {
        if (!controlId.startsWith(prefix)) {
            return null;
        }
        const raw = controlId.slice(prefix.length).toLowerCase();
        const match = SETUP_STRATEGY_KEYS.find((strategy) => strategy.toLowerCase() === raw);
        return match ?? null;
    }

    private _rememberActiveDetailFocus(controlId: string): void {
        const activeIds = this._getDetailControlIdsForCategory(this._activeStrategyCategory);
        if (!activeIds.includes(controlId)) {
            return;
        }
        this._rememberedDetailFocusByCategory[this._activeStrategyCategory] = controlId;
    }

    private _cleanupStep2AsyncState(): void {
        this._previewAbortController?.abort();
        this._reviewAbortController?.abort();
        this._previewAbortController = null;
        this._reviewAbortController = null;
        if (this._previewTimeoutId !== null) {
            window.clearTimeout(this._previewTimeoutId);
            this._previewTimeoutId = null;
        }
        this._pendingPreviewKey = null;
        this._isPreviewLoading = false;
        this._isReviewLoading = false;
    }

    private _registerStep2Focusables(
        categoryButtons: HTMLButtonElement[],
        detailButtons: HTMLButtonElement[],
        backButton: HTMLButtonElement,
        nextButton: HTMLButtonElement
    ): void {
        const activeCategoryButtonId = this._categoryButtonId(this._activeStrategyCategory);
        const detailIds = detailButtons.filter((button) => !button.disabled).map((button) => button.id);
        const detailFocusTarget = this._resolveDetailFocusTarget(this._activeStrategyCategory, detailIds);
        const preferredApplied = this._focus.registerStep2(
            categoryButtons,
            detailButtons,
            [backButton, nextButton],
            activeCategoryButtonId,
            detailFocusTarget,
            this._preferredFocusId,
            (id) => this._rememberActiveDetailFocus(id)
        );
        if (preferredApplied) {
            this._preferredFocusId = null;
        }
    }

    private _renderBuildStep(): void {
        if (this._isBuilding) {
            this._renderBuildProgress();
        } else {
            this._renderBuildReview();
        }
    }

    private _renderBuildReview(): void {
        const getReviewState = (): BuildReviewStateSnapshot => ({
            buildMode: this._buildMode,
            review: this._review,
            reviewError: this._reviewError,
            isReviewLoading: this._isReviewLoading,
            replaceConfirm: this._replaceConfirm,
            isBuilding: this._isBuilding,
            recordApplied: this._recordApplied,
        });

        this._buildReviewStep.render({
            contentEl: this._contentEl,
            stepEl: this._stepEl,
            statusEl: this._statusEl,
            detailEl: this._detailEl,
            errorEl: this._errorEl,
        }, {
            state: getReviewState(),
            getState: getReviewState,
            loadReview: () => this._loadReview(),
            onBackToStrategy: () => {
                this._reviewAbortController?.abort();
                this._review = null;
                this._reviewError = null;
                this._replaceConfirm = false;
                this._step = 2;
                this._renderStep();
            },
            onConfirmBuild: () => {
                this._isBuilding = true;
                this._renderStep();
            },
            onToggleReplaceConfirm: (focusId) => {
                this._preferredFocusId = focusId;
                this._replaceConfirm = !this._replaceConfirm;
                this._renderStep();
            },
            buildPreviewRow: (label, value, key) => this._buildPreviewRow(label, value, key),
            renderCappedWarnings: (warnings, container) => this._renderCappedWarnings(warnings, container),
            registerFocusables: (buttons, mode) => this._registerFocusables(buttons, mode),
            renderBuildReviewLoading: (container) => this._renderBuildReviewLoading(container),
            getVisibilityToken: () => this._visibilityToken,
        });
    }

    private _renderBuildReviewLoading(container: HTMLElement = this._contentEl): void {
        const loading = document.createElement('div');
        loading.className = 'setup-preview-loading';
        loading.classList.add('panel-spinner');
        loading.textContent = 'Preparing your review...';
        container.appendChild(loading);
    }

    private _renderBuildProgress(): void {
        this._buildProgressStep.render({
            contentEl: this._contentEl,
            stepEl: this._stepEl,
            statusEl: this._statusEl,
            detailEl: this._detailEl,
            errorEl: this._errorEl,
        }, {
            state: { isBuilding: this._isBuilding },
            registerFocusables: (buttons, mode) => this._registerFocusables(buttons, mode),
            onCancelOrBack: (button) => {
                if (this._buildAbortController) {
                    this._buildAbortController.abort();
                    button.disabled = true;
                    button.textContent = 'Canceling...';
                    return;
                }
                this._step = 2;
                this._renderStep();
            },
            onDone: () => {
                const nav = this._orchestrator.getNavigation();
                if (nav) {
                    nav.replaceScreen('player');
                }
                this._orchestrator.switchToChannelByNumber(1)
                    .then(() => this._orchestrator.openEPG())
                    .catch((error: unknown) => {
                        if (isAbortLikeError(error)) return;
                        console.error('[ChannelSetup] Switch to channel 1 failed:', summarizeErrorForLog(error));
                    });
            },
            startBuild: async (ui) => {
                await this._startBuild(ui.cancelButton, ui.doneButton, ui.barFill, ui.taskLabel, ui.detailLabel);
            },
        });
    }

    private _applyBuildCanceledUI(
        cancelButton: HTMLButtonElement,
        doneButton: HTMLButtonElement,
        barFill: HTMLElement,
        taskLabel: HTMLElement,
        detailLabel: HTMLElement,
        options?: { disableDone?: boolean }
    ): void {
        this._statusEl.textContent = 'Canceled.';
        this._detailEl.textContent = 'No changes were applied.';
        taskLabel.textContent = 'Canceled';
        detailLabel.textContent = '';
        barFill.style.width = '0%';
        barFill.classList.remove('indeterminate');

        cancelButton.disabled = false;
        cancelButton.textContent = 'Back';
        if (options?.disableDone) {
            doneButton.disabled = true;
        }
        cancelButton.focus();
    }

    private async _startBuild(
        cancelButton: HTMLButtonElement,
        doneButton: HTMLButtonElement,
        barFill: HTMLElement,
        taskLabel: HTMLElement,
        detailLabel: HTMLElement
    ): Promise<void> {
        const token = this._visibilityToken;
        if (this._buildAbortController) return;

        const serverId = this._getSelectedServerId();
        if (!serverId) {
            this._errorEl.textContent = 'No server selected.';
            this._statusEl.textContent = 'Error';
            taskLabel.textContent = 'Select a server';
            detailLabel.textContent = '';
            barFill.style.width = '0%';
            barFill.classList.remove('indeterminate');
            cancelButton.disabled = false;
            cancelButton.textContent = 'Back';
            doneButton.disabled = true;
            return;
        }

        this._isBuilding = true;
        this._buildAbortController = new AbortController();

        const config = this._buildConfig(serverId);

        const updateUI = (p: ChannelBuildProgress): void => {
            if (token !== this._visibilityToken) return;
            taskLabel.textContent = p.label;
            detailLabel.textContent = p.detail;

            if (p.total !== null && p.total > 0) {
                const percent = Math.min(100, (p.current / p.total) * 100);
                barFill.style.width = `${percent}%`;
                barFill.classList.remove('indeterminate');
            } else {
                // Indeterminate
                barFill.style.width = '';
                barFill.classList.add('indeterminate');
            }
        };

        try {
            const result = await this._orchestrator.createChannelsFromSetup(config, {
                signal: this._buildAbortController.signal,
                onProgress: updateUI
            });

            if (token !== this._visibilityToken) return;

            if (result.canceled) {
                this._applyBuildCanceledUI(cancelButton, doneButton, barFill, taskLabel, detailLabel);
            } else {
                this._orchestrator.markSetupComplete(serverId, config);
                this._statusEl.textContent = 'Channels ready.';
                taskLabel.textContent = 'Complete';
                detailLabel.textContent = `Created ${result.created} channels. Skipped ${result.skipped}.`;
                barFill.style.width = '100%';
                barFill.classList.remove('indeterminate');

                cancelButton.disabled = false;
                doneButton.disabled = result.created === 0;
                cancelButton.textContent = 'Back'; // Allow going back to modify?
                // Usually Done is the way forward.

                if (result.created === 0) {
                    this._detailEl.textContent = 'No channels created.';
                }
                this._unregisterFocusables();
                this._registerFocusables([doneButton, cancelButton]); // Done is primary

                const nav = this._orchestrator.getNavigation();
                if (nav && !doneButton.disabled) {
                    nav.setFocus(doneButton.id);
                } else {
                    nav?.setFocus(cancelButton.id);
                }
            }

        } catch (error) {
            if (token !== this._visibilityToken) return;
            if (isAbortLikeError(error, this._buildAbortController?.signal)) {
                this._applyBuildCanceledUI(cancelButton, doneButton, barFill, taskLabel, detailLabel, { disableDone: true });
                return;
            }
            const message = error instanceof Error ? error.message : 'Build failed.';
            this._errorEl.textContent = message;
            this._statusEl.textContent = 'Error';
            taskLabel.textContent = 'Error';
            detailLabel.textContent = '';
            barFill.style.width = '0%';
            barFill.classList.remove('indeterminate');
            cancelButton.disabled = false;
            cancelButton.textContent = 'Back';
        } finally {
            this._isBuilding = false;
            this._buildAbortController = null;
        }
    }

    private _clearPreviewDeltas(): void {
        if (this._previewDeltaTimeoutId !== null) {
            window.clearTimeout(this._previewDeltaTimeoutId);
            this._previewDeltaTimeoutId = null;
        }
        this._previewDeltas = {};
        this._previewDeltaExpiresAtMs = 0;
    }

    private _setPreviewDeltas(
        prev: ChannelSetupPreview['estimates'],
        next: ChannelSetupPreview['estimates']
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
            window.clearTimeout(this._previewDeltaTimeoutId);
            this._previewDeltaTimeoutId = null;
        }

        if (Object.keys(deltas).length > 0) {
            this._previewDeltaTimeoutId = window.setTimeout(() => {
                this._clearPreviewDeltas();
                if (this._step === 2) {
                    this._renderStep();
                }
            }, 3000);
        }
    }

    private _buildConfig(serverId: string): ChannelSetupConfig {
        const strategyConfig = SETUP_STRATEGY_KEYS.reduce<ChannelSetupConfig['strategyConfig']>((acc, key) => {
            acc[key] = {
                enabled: this._strategies[key].enabled,
                priority: this._strategies[key].priority,
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
                addSequentialVariants: this._channelExpansion.addSequentialVariants,
            },
            actorStudioCombineMode: this._actorStudioCombineMode,
            minItemsPerChannel: this._minItems,
        };
    }

    private _buildPreviewKey(config: ChannelSetupConfig): string {
        const previewConfig = { ...config, buildMode: undefined };
        return JSON.stringify(previewConfig);
    }

    private _schedulePreview(): void {
        if (this._step !== 2) {
            return;
        }
        const serverId = this._getSelectedServerId();
        if (!serverId) {
            this._previewError = 'No server selected.';
            return;
        }
        const key = this._buildPreviewKey(this._buildConfig(serverId));
        if (key === this._lastPreviewKey && this._preview && !this._isPreviewLoading) {
            return;
        }
        if (this._isPreviewLoading && key === this._pendingPreviewKey) {
            return;
        }
        this._pendingPreviewKey = key;
        if (this._previewTimeoutId !== null) {
            window.clearTimeout(this._previewTimeoutId);
        }
        this._previewTimeoutId = window.setTimeout(() => {
            this._refreshPreview().catch((error: unknown) => {
                if (isAbortLikeError(error)) return;
                console.error('[ChannelSetup] Preview refresh failed:', summarizeErrorForLog(error));
            });
        }, 400);
    }

    private async _refreshPreview(): Promise<void> {
        if (this._step !== 2) return;
        const token = this._visibilityToken;
        const serverId = this._getSelectedServerId();
        if (!serverId) {
            this._previewError = 'No server selected.';
            this._preview = null;
            this._clearPreviewDeltas();
            this._isPreviewLoading = false;
            this._pendingPreviewKey = null;
            this._renderStep();
            return;
        }

        const config = this._buildConfig(serverId);
        const key = this._buildPreviewKey(config);
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
        this._renderStep();

        try {
            const preview = await this._orchestrator.getSetupPreview(config, {
                signal: this._previewAbortController.signal,
            });
            if (token !== this._visibilityToken) return;
            const prevEstimates = this._preview?.estimates ?? null;
            this._preview = preview;
            this._lastPreviewKey = key;
            if (prevEstimates) {
                this._setPreviewDeltas(prevEstimates, preview.estimates);
            } else {
                this._clearPreviewDeltas();
            }
        } catch (error) {
            if (token !== this._visibilityToken) return;
            if (error && typeof error === 'object' && 'name' in error && (error as { name?: unknown }).name === 'AbortError') {
                return;
            }
            this._previewError = error instanceof Error ? error.message : 'Unable to estimate channels.';
            this._preview = null;
            this._clearPreviewDeltas();
        } finally {
            if (token === this._visibilityToken) {
                this._isPreviewLoading = false;
                if (this._step === 2) {
                    this._renderStep();
                }
            }
        }
    }

    private async _loadReview(): Promise<void> {
        const token = this._visibilityToken;
        const serverId = this._getSelectedServerId();
        if (!serverId) {
            this._reviewError = 'No server selected.';
            this._renderStep();
            return;
        }
        if (this._isReviewLoading) return;

        this._reviewAbortController?.abort();
        this._reviewAbortController = new AbortController();
        this._isReviewLoading = true;
        this._reviewError = null;
        this._renderStep();

        try {
            const review = await this._orchestrator.getSetupReview(this._buildConfig(serverId), {
                signal: this._reviewAbortController.signal,
            });
            if (token !== this._visibilityToken) return;
            this._review = review;
        } catch (error) {
            if (token !== this._visibilityToken) return;
            if (error && typeof error === 'object' && 'name' in error && (error as { name?: unknown }).name === 'AbortError') {
                return;
            }
            this._reviewError = error instanceof Error ? error.message : 'Unable to load review.';
            this._review = null;
        } finally {
            this._isReviewLoading = false;
            if (token === this._visibilityToken) {
                this._renderStep();
            }
        }
    }

    private _buildPreviewRow(label: string, value: number | string, deltaKey?: EstimateKey): HTMLElement {
        const row = document.createElement('div');
        row.className = 'setup-preview-row';
        const labelEl = document.createElement('span');
        labelEl.className = 'setup-preview-label';
        labelEl.textContent = label;
        const valueEl = document.createElement('span');
        valueEl.className = 'setup-preview-value';
        const main = document.createElement('span');
        main.textContent = String(value);
        valueEl.appendChild(main);

        const now = Date.now();
        const delta = deltaKey ? this._previewDeltas[deltaKey] : undefined;
        if (typeof value === 'number' && typeof delta === 'number' && now <= this._previewDeltaExpiresAtMs) {
            const deltaEl = document.createElement('span');
            deltaEl.className = `setup-preview-delta ${delta > 0 ? 'positive' : 'negative'}`;
            deltaEl.textContent = `(${delta > 0 ? '+' : ''}${delta})`;
            valueEl.appendChild(deltaEl);
        }

        row.appendChild(labelEl);
        row.appendChild(valueEl);
        return row;
    }

    private _renderCappedWarnings(warnings: string[], container: HTMLElement): void {
        const cappedWarnings = warnings.slice(0, this._maxPreviewWarnings);
        for (const warning of cappedWarnings) {
            const item = document.createElement('div');
            item.className = 'setup-preview-warning';
            item.textContent = warning;
            container.appendChild(item);
        }
        const remaining = warnings.length - cappedWarnings.length;
        if (remaining > 0) {
            const item = document.createElement('div');
            item.className = 'setup-preview-warning';
            item.textContent = `And ${remaining} more warning${remaining === 1 ? '' : 's'}…`;
            container.appendChild(item);
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
                enabled: configured.enabled,
                priority: Number.isFinite(configured.priority)
                    ? Math.max(1, Math.floor(Number(configured.priority)))
                    : defaults[key].priority,
                scope: strategySupportsMixedScope(key) && configured?.scope === 'cross-library' ? 'cross-library' : 'per-library',
            };
            return acc;
        }, createDefaultStrategyState());
        this._channelExpansion = {
            addAlternateLineups: record.channelExpansion?.addAlternateLineups === true,
            alternateLineupCopies: Number.isFinite(record.channelExpansion?.alternateLineupCopies)
                ? Math.min(3, Math.max(1, Math.floor(Number(record.channelExpansion?.alternateLineupCopies))))
                : 1,
            addSequentialVariants: record.channelExpansion?.addSequentialVariants === true,
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

    private _getSelectedServerId(): string | null {
        const stored = safeLocalStorageGet(this._orchestrator.getSelectedServerStorageKey());
        if (stored) {
            return stored;
        }
        return this._orchestrator.getSelectedServerId();
    }

    private _registerFocusables(buttons: HTMLElement[], mode: 'linear' | 'spatial' = 'linear'): void {
        const preferredApplied = mode === 'spatial'
            ? this._focus.registerSpatial(buttons, this._preferredFocusId)
            : this._focus.registerLinear(buttons, this._preferredFocusId);
        if (preferredApplied) {
            this._preferredFocusId = null;
        }
    }

    private _unregisterFocusables(): void {
        this._focus.unregisterAll();
    }
}
