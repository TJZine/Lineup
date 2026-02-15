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

const CHANNEL_LIMIT_PRESETS = [50, 100, 150, 200, 300, 400, 500];

type SetupStrategyKey = (typeof SETUP_STRATEGY_KEYS)[number];

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

const CONTENT_STRATEGY_KEYS = [
    'collections',
    'playlists',
    'recentlyAdded',
] as const satisfies readonly SetupStrategyKey[];

const ADVANCED_STRATEGY_KEYS = [
    'genres',
    'directors',
    'decades',
    'studios',
    'actors',
] as const satisfies readonly SetupStrategyKey[];

const isContentStrategyKey = (key: SetupStrategyKey): key is (typeof CONTENT_STRATEGY_KEYS)[number] =>
    (CONTENT_STRATEGY_KEYS as readonly SetupStrategyKey[]).includes(key);

const isAdvancedStrategyKey = (key: SetupStrategyKey): key is (typeof ADVANCED_STRATEGY_KEYS)[number] =>
    (ADVANCED_STRATEGY_KEYS as readonly SetupStrategyKey[]).includes(key);

const STRATEGY_CATEGORIES = [
    'content-sources',
    'advanced-sources',
    'build-options',
    'limits',
] as const;

const STEP2_CONTROL_IDS = {
    buildMode: 'setup-build-mode',
    combineMode: 'setup-combine-mode',
    addAlternateLineups: 'setup-expansion-alternate-lineups',
    alternateLineupCopies: 'setup-expansion-copies',
    addSequentialVariants: 'setup-expansion-sequential',
    expandLineup: 'setup-expand-lineup',
    maxChannels: 'setup-max-channels',
    minItems: 'setup-min-items',
} as const;

type SetupStep = 1 | 2 | 3;
type StrategyCategoryKey = (typeof STRATEGY_CATEGORIES)[number];
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
    private _destroyScreenShell: (() => void) | null = null;
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
    private _focusableIds: string[] = [];
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
        this._stepEl.textContent = 'Step 1 of 3';
        this._statusEl.textContent = 'Select the libraries to include.';
        this._detailEl.textContent = '';

        const scroll = document.createElement('div');
        scroll.className = 'setup-scroll';

        const bulkActions = document.createElement('div');
        bulkActions.className = 'setup-bulk-actions';

        const firstLibraryId = this._libraries[0] ? `setup-lib-${this._toDomId(this._libraries[0].id)}` : null;

        const selectAllButton = document.createElement('button');
        selectAllButton.id = 'setup-select-all';
        selectAllButton.className = 'screen-button secondary';
        selectAllButton.textContent = 'Select All';
        selectAllButton.disabled = this._libraries.length === 0;
        selectAllButton.addEventListener('click', () => {
            this._selectedLibraryIds = new Set(this._libraries.map((library) => library.id));
            this._preferredFocusId = firstLibraryId ?? selectAllButton.id;
            this._review = null;
            this._reviewError = null;
            this._replaceConfirm = false;
            this._renderStep();
        });
        bulkActions.appendChild(selectAllButton);

        const clearAllButton = document.createElement('button');
        clearAllButton.id = 'setup-clear-all';
        clearAllButton.className = 'screen-button secondary';
        clearAllButton.textContent = 'Clear All';
        clearAllButton.disabled = this._libraries.length === 0;
        clearAllButton.addEventListener('click', () => {
            this._selectedLibraryIds = new Set();
            this._preferredFocusId = firstLibraryId ?? clearAllButton.id;
            this._review = null;
            this._reviewError = null;
            this._replaceConfirm = false;
            this._renderStep();
        });
        bulkActions.appendChild(clearAllButton);

        scroll.appendChild(bulkActions);

        const list = document.createElement('div');
        list.className = 'setup-grid-2col';

        if (this._libraries.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'setup-empty';
            empty.textContent = 'No movie or show libraries found. Select "Back" to choose a different server.';
            list.appendChild(empty);
        }

        for (const library of this._libraries) {
            const isSelected = this._selectedLibraryIds.has(library.id);

            const button = document.createElement('button');
            button.id = `setup-lib-${this._toDomId(library.id)}`;
            button.className = `setup-toggle${isSelected ? ' selected' : ''}`;
            button.classList.add('library-toggle');

            const icon = document.createElement('span');
            icon.className = 'setup-toggle-icon';
            icon.setAttribute('aria-hidden', 'true');
            icon.innerHTML = library.type === 'movie' ? MOVIE_SVG : SHOW_SVG;

            const label = document.createElement('span');
            label.className = 'setup-toggle-label';
            label.textContent = library.title;

            const meta = document.createElement('span');
            meta.className = 'setup-toggle-meta';
            const typeLabel = library.type === 'movie' ? 'Movies' : 'Shows';
            const countText = typeof library.contentCount === 'number' && Number.isFinite(library.contentCount)
                ? `${typeLabel} • ${this._formatCount(library.contentCount)} titles`
                : typeLabel;
            meta.textContent = countText;

            const state = document.createElement('span');
            state.className = 'setup-toggle-state';
            if (isSelected) {
                const stateIcon = document.createElement('span');
                stateIcon.className = 'setup-toggle-state-icon';
                stateIcon.setAttribute('aria-hidden', 'true');
                stateIcon.textContent = '✓';

                const srOnly = document.createElement('span');
                srOnly.className = 'sr-only';
                srOnly.textContent = 'Selected';

                state.appendChild(stateIcon);
                state.appendChild(srOnly);
            } else {
                state.textContent = 'Off';
            }

            button.appendChild(icon);
            button.appendChild(label);
            button.appendChild(meta);
            button.appendChild(state);

            button.addEventListener('click', () => {
                this._preferredFocusId = button.id;
                if (this._selectedLibraryIds.has(library.id)) {
                    this._selectedLibraryIds.delete(library.id);
                } else {
                    this._selectedLibraryIds.add(library.id);
                }
                this._review = null;
                this._reviewError = null;
                this._replaceConfirm = false;
                this._renderStep();
            });

            list.appendChild(button);
        }

        scroll.appendChild(list);
        this._contentEl.appendChild(scroll);

        const actions = document.createElement('div');
        actions.className = 'button-row';

        const backButton = document.createElement('button');
        backButton.id = 'setup-back';
        backButton.className = 'screen-button secondary';
        backButton.textContent = 'Back';
        backButton.addEventListener('click', () => {
            this._orchestrator.openServerSelect();
        });
        actions.appendChild(backButton);
        if (this._libraries.length === 0) {
            this._preferredFocusId = backButton.id;
        }

        const nextButton = document.createElement('button');
        nextButton.id = 'setup-next';
        nextButton.className = 'screen-button';
        nextButton.textContent = 'Next';
        nextButton.disabled = this._libraries.length === 0 || this._selectedLibraryIds.size === 0;
        nextButton.addEventListener('click', () => {
            if (this._selectedLibraryIds.size === 0) {
                return;
            }
            this._step = 2;
            this._renderStep();
        });
        actions.appendChild(nextButton);

        this._contentEl.appendChild(actions);

        const listButtons = Array.from(list.querySelectorAll<HTMLButtonElement>('button'));
        const navigationButtons: HTMLElement[] = [selectAllButton, clearAllButton, ...listButtons, backButton, nextButton];
        this._registerFocusables(navigationButtons, 'spatial');
        const nav = this._orchestrator.getNavigation();
        if (nav && !selectAllButton.disabled && !clearAllButton.disabled) {
            const downNeighbor = listButtons[0]?.id;
            const selectAllNeighbors: FocusableElement['neighbors'] = {
                right: clearAllButton.id,
            };
            if (downNeighbor) {
                selectAllNeighbors.down = downNeighbor;
            }
            const clearAllNeighbors: FocusableElement['neighbors'] = {
                left: selectAllButton.id,
            };
            if (downNeighbor) {
                clearAllNeighbors.down = downNeighbor;
            }
            nav.registerFocusable({
                id: selectAllButton.id,
                element: selectAllButton,
                neighbors: selectAllNeighbors,
                onFocus: () => {
                    try {
                        selectAllButton.scrollIntoView({ block: 'nearest' });
                    } catch {
                        selectAllButton.scrollIntoView();
                    }
                },
            });
            nav.registerFocusable({
                id: clearAllButton.id,
                element: clearAllButton,
                neighbors: clearAllNeighbors,
                onFocus: () => {
                    try {
                        clearAllButton.scrollIntoView({ block: 'nearest' });
                    } catch {
                        clearAllButton.scrollIntoView();
                    }
                },
            });
        }

        this._detailEl.textContent = `Selected ${this._selectedLibraryIds.size} of ${this._libraries.length}.`;
    }

    private _renderStrategyStep(): void {
        this._stepEl.textContent = 'Step 2 of 3';
        this._statusEl.textContent = 'Choose channel types to build.';
        this._refreshSetupContextForStep2();

        const split = document.createElement('div');
        split.className = 'setup-split';

        const left = document.createElement('div');
        left.className = 'setup-category-rail setup-focus-safe-scroll';

        const right = document.createElement('div');
        right.className = 'setup-detail-pane';

        const buildModeButton = document.createElement('button');
        buildModeButton.id = STEP2_CONTROL_IDS.buildMode;
        buildModeButton.className = 'setup-toggle';

        const buildModeLabel = document.createElement('span');
        buildModeLabel.className = 'setup-toggle-label';
        buildModeLabel.textContent = 'Build mode';

        const buildModeMeta = document.createElement('span');
        buildModeMeta.className = 'setup-toggle-meta';
        buildModeMeta.textContent = 'Replace, append, or merge with your lineup.';

        const buildModeState = document.createElement('span');
        buildModeState.className = 'setup-toggle-state';
        buildModeState.textContent = this._buildMode.charAt(0).toUpperCase() + this._buildMode.slice(1);

        buildModeButton.appendChild(buildModeLabel);
        buildModeButton.appendChild(buildModeMeta);
        buildModeButton.appendChild(buildModeState);

        buildModeButton.addEventListener('click', () => {
            this._preferredFocusId = buildModeButton.id;
            this._rememberActiveDetailFocus(buildModeButton.id);
            const modes: ChannelSetupConfig['buildMode'][] = ['replace', 'append', 'merge'];
            const currentIndex = modes.indexOf(this._buildMode);
            const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % modes.length : 0;
            this._buildMode = modes[nextIndex] ?? 'replace';
            this._replaceConfirm = false;
            this._review = null;
            this._reviewError = null;
            this._schedulePreview();
            this._renderStep();
        });

        const combineButton = document.createElement('button');
        combineButton.id = STEP2_CONTROL_IDS.combineMode;
        combineButton.className = 'setup-toggle';

        const combineLabel = document.createElement('span');
        combineLabel.className = 'setup-toggle-label';
        combineLabel.textContent = 'Actor/Studio combine';

        const combineMeta = document.createElement('span');
        combineMeta.className = 'setup-toggle-meta';
        combineMeta.textContent = 'Separate movies + TV or combine together.';

        const combineState = document.createElement('span');
        combineState.className = 'setup-toggle-state';
        combineState.textContent = this._actorStudioCombineMode === 'combined' ? 'Combined' : 'Separate';

        combineButton.appendChild(combineLabel);
        combineButton.appendChild(combineMeta);
        combineButton.appendChild(combineState);

        combineButton.addEventListener('click', () => {
            this._preferredFocusId = combineButton.id;
            this._rememberActiveDetailFocus(combineButton.id);
            this._actorStudioCombineMode = this._actorStudioCombineMode === 'combined' ? 'separate' : 'combined';
            this._review = null;
            this._reviewError = null;
            this._schedulePreview();
            this._renderStep();
        });

        const strategyLabels: Array<{ key: SetupStrategyKey; label: string; detail: string }> = [
            { key: 'collections', label: 'Collections', detail: 'One channel per collection.' },
            { key: 'playlists', label: 'Playlists', detail: 'Channels from Plex playlists.' },
            { key: 'recentlyAdded', label: 'Recently added', detail: 'Per library, newest first.' },
            { key: 'genres', label: 'Genres', detail: 'Filter channels by genre (slower on large libraries).' },
            { key: 'directors', label: 'Directors', detail: 'Filter channels by director (slower on large libraries).' },
            { key: 'decades', label: 'Decades', detail: 'Channels by decade (1980s, 1990s...).' },
            { key: 'studios', label: 'Studios', detail: 'Channels by studio (Movies/TV).' },
            { key: 'actors', label: 'Actors', detail: 'Channels by actor (Movies/TV).' },
        ];

        const createStrategyControls = (strategy: typeof strategyLabels[number]): HTMLButtonElement[] => {
            const strategyState = this._strategies[strategy.key];

            const toggleButton = document.createElement('button');
            toggleButton.id = this._strategyButtonId(strategy.key);
            toggleButton.className = `setup-toggle${strategyState.enabled ? ' selected' : ''}`;

            const toggleLabel = document.createElement('span');
            toggleLabel.className = 'setup-toggle-label';
            toggleLabel.textContent = strategy.label;

            const toggleMeta = document.createElement('span');
            toggleMeta.className = 'setup-toggle-meta';
            toggleMeta.textContent = strategy.detail;

            const toggleState = document.createElement('span');
            toggleState.className = 'setup-toggle-state';
            toggleState.textContent = strategyState.enabled ? 'On' : 'Off';

            toggleButton.appendChild(toggleLabel);
            toggleButton.appendChild(toggleMeta);
            toggleButton.appendChild(toggleState);
            toggleButton.addEventListener('click', () => {
                this._preferredFocusId = toggleButton.id;
                this._rememberActiveDetailFocus(toggleButton.id);
                this._strategies[strategy.key].enabled = !this._strategies[strategy.key].enabled;
                this._review = null;
                this._reviewError = null;
                this._schedulePreview();
                this._renderStep();
            });

            const priorityButton = document.createElement('button');
            priorityButton.id = this._priorityButtonId(strategy.key);
            priorityButton.className = 'setup-toggle setup-toggle--adjustable';

            const priorityLabel = document.createElement('span');
            priorityLabel.className = 'setup-toggle-label';
            priorityLabel.textContent = `${strategy.label} priority`;

            const priorityMeta = document.createElement('span');
            priorityMeta.className = 'setup-toggle-meta';
            priorityMeta.textContent = 'Lower numbers are planned earlier.';

            const priorityState = document.createElement('span');
            priorityState.className = 'setup-toggle-state';
            priorityState.textContent = String(strategyState.priority);

            priorityButton.appendChild(priorityLabel);
            priorityButton.appendChild(priorityMeta);
            priorityButton.appendChild(priorityState);
            priorityButton.addEventListener('click', () => {
                this._preferredFocusId = priorityButton.id;
                this._rememberActiveDetailFocus(priorityButton.id);
                const maxPriority = SETUP_STRATEGY_KEYS.length;
                this._strategies[strategy.key].priority = this._strategies[strategy.key].priority >= maxPriority
                    ? 1
                    : this._strategies[strategy.key].priority + 1;
                this._review = null;
                this._reviewError = null;
                this._schedulePreview();
                this._renderStep();
            });

            if (!strategySupportsMixedScope(strategy.key)) {
                return [toggleButton, priorityButton];
            }

            const scopeButton = document.createElement('button');
            scopeButton.id = this._scopeButtonId(strategy.key);
            scopeButton.className = `setup-toggle${strategyState.scope === 'cross-library' ? ' selected' : ''}`;

            const scopeLabel = document.createElement('span');
            scopeLabel.className = 'setup-toggle-label';
            scopeLabel.textContent = `${strategy.label} scope`;

            const scopeMeta = document.createElement('span');
            scopeMeta.className = 'setup-toggle-meta';
            scopeMeta.textContent = 'Per-library by default. Mixed is experimental.';

            const scopeState = document.createElement('span');
            scopeState.className = 'setup-toggle-state';
            scopeState.textContent = strategyState.scope === 'cross-library' ? 'Mixed' : 'Per Library';

            scopeButton.appendChild(scopeLabel);
            scopeButton.appendChild(scopeMeta);
            scopeButton.appendChild(scopeState);
            scopeButton.addEventListener('click', () => {
                this._preferredFocusId = scopeButton.id;
                this._rememberActiveDetailFocus(scopeButton.id);
                this._strategies[strategy.key].scope = this._strategies[strategy.key].scope === 'cross-library'
                    ? 'per-library'
                    : 'cross-library';
                this._review = null;
                this._reviewError = null;
                this._schedulePreview();
                this._renderStep();
            });

            return [toggleButton, priorityButton, scopeButton];
        };

        const contentButtons = strategyLabels
            .filter((strategy) => isContentStrategyKey(strategy.key))
            .flatMap(createStrategyControls);
        const advancedButtons = strategyLabels
            .filter((strategy) => isAdvancedStrategyKey(strategy.key))
            .flatMap(createStrategyControls);

        const addAlternateLineupsButton = document.createElement('button');
        addAlternateLineupsButton.id = STEP2_CONTROL_IDS.addAlternateLineups;
        addAlternateLineupsButton.className = `setup-toggle${this._channelExpansion.addAlternateLineups ? ' selected' : ''}`;

        const addAlternateLineupsLabel = document.createElement('span');
        addAlternateLineupsLabel.className = 'setup-toggle-label';
        addAlternateLineupsLabel.textContent = 'Add Alternate Lineups';

        const addAlternateLineupsMeta = document.createElement('span');
        addAlternateLineupsMeta.className = 'setup-toggle-meta';
        addAlternateLineupsMeta.textContent = 'Create extra channels from the same category with different deterministic shuffle lineups.';

        const addAlternateLineupsState = document.createElement('span');
        addAlternateLineupsState.className = 'setup-toggle-state';
        addAlternateLineupsState.textContent = this._channelExpansion.addAlternateLineups ? 'On' : 'Off';

        addAlternateLineupsButton.appendChild(addAlternateLineupsLabel);
        addAlternateLineupsButton.appendChild(addAlternateLineupsMeta);
        addAlternateLineupsButton.appendChild(addAlternateLineupsState);
        addAlternateLineupsButton.addEventListener('click', () => {
            this._preferredFocusId = addAlternateLineupsButton.id;
            this._rememberActiveDetailFocus(addAlternateLineupsButton.id);
            this._channelExpansion.addAlternateLineups = !this._channelExpansion.addAlternateLineups;
            this._review = null;
            this._reviewError = null;
            this._schedulePreview();
            this._renderStep();
        });

        const alternateCopiesButton = document.createElement('button');
        alternateCopiesButton.id = STEP2_CONTROL_IDS.alternateLineupCopies;
        alternateCopiesButton.className = 'setup-toggle setup-toggle--adjustable';
        alternateCopiesButton.disabled = !this._channelExpansion.addAlternateLineups;

        const alternateCopiesLabel = document.createElement('span');
        alternateCopiesLabel.className = 'setup-toggle-label';
        alternateCopiesLabel.textContent = 'Alternate Lineup Copies';

        const alternateCopiesMeta = document.createElement('span');
        alternateCopiesMeta.className = 'setup-toggle-meta';
        alternateCopiesMeta.textContent = 'How many extra copies per generated channel.';

        const alternateCopiesState = document.createElement('span');
        alternateCopiesState.className = 'setup-toggle-state';
        alternateCopiesState.textContent = String(this._channelExpansion.alternateLineupCopies);

        alternateCopiesButton.appendChild(alternateCopiesLabel);
        alternateCopiesButton.appendChild(alternateCopiesMeta);
        alternateCopiesButton.appendChild(alternateCopiesState);
        alternateCopiesButton.addEventListener('click', () => {
            if (!this._channelExpansion.addAlternateLineups) return;
            this._preferredFocusId = alternateCopiesButton.id;
            this._rememberActiveDetailFocus(alternateCopiesButton.id);
            this._channelExpansion.alternateLineupCopies = this._stepPreset(
                [1, 2, 3],
                this._channelExpansion.alternateLineupCopies,
                'right',
                'wrap'
            );
            this._review = null;
            this._reviewError = null;
            this._schedulePreview();
            this._renderStep();
        });

        const addSequentialVariantsButton = document.createElement('button');
        addSequentialVariantsButton.id = STEP2_CONTROL_IDS.addSequentialVariants;
        addSequentialVariantsButton.className = `setup-toggle${this._channelExpansion.addSequentialVariants ? ' selected' : ''}`;

        const addSequentialLabel = document.createElement('span');
        addSequentialLabel.className = 'setup-toggle-label';
        addSequentialLabel.textContent = 'Add Sequential Channels';

        const addSequentialMeta = document.createElement('span');
        addSequentialMeta.className = 'setup-toggle-meta';
        addSequentialMeta.textContent = 'Also create a sequential version for each generated channel.';

        const addSequentialState = document.createElement('span');
        addSequentialState.className = 'setup-toggle-state';
        addSequentialState.textContent = this._channelExpansion.addSequentialVariants ? 'On' : 'Off';

        addSequentialVariantsButton.appendChild(addSequentialLabel);
        addSequentialVariantsButton.appendChild(addSequentialMeta);
        addSequentialVariantsButton.appendChild(addSequentialState);
        addSequentialVariantsButton.addEventListener('click', () => {
            this._preferredFocusId = addSequentialVariantsButton.id;
            this._rememberActiveDetailFocus(addSequentialVariantsButton.id);
            this._channelExpansion.addSequentialVariants = !this._channelExpansion.addSequentialVariants;
            this._review = null;
            this._reviewError = null;
            this._schedulePreview();
            this._renderStep();
        });

        const maxButton = document.createElement('button');
        maxButton.id = STEP2_CONTROL_IDS.maxChannels;
        maxButton.className = 'setup-toggle setup-toggle--adjustable';

        const maxLabel = document.createElement('span');
        maxLabel.className = 'setup-toggle-label';
        maxLabel.textContent = 'Max channels';

        const maxMeta = document.createElement('span');
        maxMeta.className = 'setup-toggle-meta';
        maxMeta.textContent = `Default ${DEFAULT_CHANNEL_SETUP_MAX}. Limit up to ${MAX_CHANNELS}.`;

        const maxState = document.createElement('span');
        maxState.className = 'setup-toggle-state';
        maxState.textContent = String(this._maxChannels);

        maxButton.appendChild(maxLabel);
        maxButton.appendChild(maxMeta);
        maxButton.appendChild(maxState);

        maxButton.addEventListener('click', () => {
            this._preferredFocusId = maxButton.id;
            this._rememberActiveDetailFocus(maxButton.id);
            this._maxChannels = this._stepPreset(this._channelLimitOptions, this._maxChannels, 'right', 'wrap');
            this._review = null;
            this._reviewError = null;
            this._schedulePreview();
            this._renderStep();
        });

        const minItemsButton = document.createElement('button');
        minItemsButton.id = STEP2_CONTROL_IDS.minItems;
        minItemsButton.className = 'setup-toggle setup-toggle--adjustable';

        const minItemsLabel = document.createElement('span');
        minItemsLabel.className = 'setup-toggle-label';
        minItemsLabel.textContent = 'Min items';

        const minItemsMeta = document.createElement('span');
        minItemsMeta.className = 'setup-toggle-meta';
        minItemsMeta.textContent = 'Minimum content items per channel.';

        const minItemsState = document.createElement('span');
        minItemsState.className = 'setup-toggle-state';
        minItemsState.textContent = String(this._minItems);

        minItemsButton.appendChild(minItemsLabel);
        minItemsButton.appendChild(minItemsMeta);
        minItemsButton.appendChild(minItemsState);

        minItemsButton.addEventListener('click', () => {
            this._preferredFocusId = minItemsButton.id;
            this._rememberActiveDetailFocus(minItemsButton.id);
            this._minItems = this._stepPreset(this._minItemsOptions, this._minItems, 'right', 'wrap');
            this._review = null;
            this._reviewError = null;
            this._schedulePreview();
            this._renderStep();
        });

        const expandLineupButton = document.createElement('button');
        expandLineupButton.id = STEP2_CONTROL_IDS.expandLineup;
        expandLineupButton.className = 'setup-toggle';

        const expandLineupLabel = document.createElement('span');
        expandLineupLabel.className = 'setup-toggle-label';
        expandLineupLabel.textContent = 'Expand Lineup';

        const expandLineupMeta = document.createElement('span');
        expandLineupMeta.className = 'setup-toggle-meta';
        expandLineupMeta.textContent = 'Quick action: set max channels to the cap and min items to 1.';

        const expandLineupState = document.createElement('span');
        expandLineupState.className = 'setup-toggle-state';
        expandLineupState.textContent = 'Apply';

        expandLineupButton.appendChild(expandLineupLabel);
        expandLineupButton.appendChild(expandLineupMeta);
        expandLineupButton.appendChild(expandLineupState);
        expandLineupButton.addEventListener('click', () => {
            this._preferredFocusId = expandLineupButton.id;
            this._rememberActiveDetailFocus(expandLineupButton.id);
            this._maxChannels = MAX_CHANNELS;
            this._minItems = 1;
            this._review = null;
            this._reviewError = null;
            this._schedulePreview();
            this._renderStep();
        });

        const controlsByCategory: Record<StrategyCategoryKey, HTMLButtonElement[]> = {
            'content-sources': contentButtons,
            'advanced-sources': advancedButtons,
            'build-options': [
                buildModeButton,
                combineButton,
                addAlternateLineupsButton,
                alternateCopiesButton,
                addSequentialVariantsButton,
            ],
            'limits': [maxButton, minItemsButton, expandLineupButton],
        };

        const categories: Array<{ key: StrategyCategoryKey; title: string }> = [
            { key: 'content-sources', title: 'Content Sources' },
            { key: 'advanced-sources', title: 'Advanced Sources' },
            { key: 'build-options', title: 'Build Options' },
            { key: 'limits', title: 'Limits' },
        ];

        const categoryButtons = categories.map((category) => {
            const button = document.createElement('button');
            button.id = this._categoryButtonId(category.key);
            button.className = `setup-category-button${this._activeStrategyCategory === category.key ? ' selected' : ''}`;
            button.textContent = category.title;
            button.addEventListener('click', () => {
                this._activeStrategyCategory = category.key;
                this._preferredFocusId = button.id;
                this._renderStep();
            });
            return button;
        });

        for (const button of categoryButtons) {
            left.appendChild(button);
        }

        const detailScroll = document.createElement('div');
        detailScroll.className = 'setup-detail-scroll setup-focus-safe-scroll';

        const detailControls = document.createElement('div');
        detailControls.className = 'setup-list';
        const activeControls = controlsByCategory[this._activeStrategyCategory] ?? [];
        for (const button of activeControls) {
            detailControls.appendChild(button);
        }
        detailScroll.appendChild(detailControls);

        const previewPanel = document.createElement('div');
        previewPanel.id = this._previewPanelId;
        previewPanel.className = 'setup-preview';
        previewPanel.setAttribute('role', 'region');

        const previewTitleId = `${this._previewPanelId}-title`;
        previewPanel.setAttribute('aria-labelledby', previewTitleId);

        const previewTitle = document.createElement('div');
        previewTitle.id = previewTitleId;
        previewTitle.className = 'setup-preview-title';
        previewTitle.textContent = 'Estimate';
        previewPanel.appendChild(previewTitle);

        if (this._previewError) {
            const error = document.createElement('div');
            error.className = 'setup-preview-warning';
            error.textContent = this._previewError;
            previewPanel.appendChild(error);
        } else if (this._preview) {
            // Render existing preview (even while loading new one)
            const { estimates, warnings, reachedMaxChannels } = this._preview;

            const rows = document.createElement('div');
            rows.className = 'setup-preview-rows';
            rows.appendChild(this._buildPreviewRow('Total planned', estimates.total, 'total'));
            rows.appendChild(this._buildPreviewRow('Collections', estimates.collections, 'collections'));
            rows.appendChild(this._buildPreviewRow('Recently added', estimates.recentlyAdded, 'recentlyAdded'));
            rows.appendChild(this._buildPreviewRow('Playlists', estimates.playlists, 'playlists'));
            rows.appendChild(this._buildPreviewRow('Genres', estimates.genres, 'genres'));
            rows.appendChild(this._buildPreviewRow('Directors', estimates.directors, 'directors'));
            rows.appendChild(this._buildPreviewRow('Decades', estimates.decades, 'decades'));
            rows.appendChild(this._buildPreviewRow('Studios', estimates.studios, 'studios'));
            rows.appendChild(this._buildPreviewRow('Actors', estimates.actors, 'actors'));
            previewPanel.appendChild(rows);

            // Show "Updating..." indicator while loading with existing preview
            if (this._isPreviewLoading) {
                const updating = document.createElement('div');
                updating.className = 'setup-preview-updating';
                updating.classList.add('panel-spinner');
                updating.textContent = 'Updating...';
                previewPanel.appendChild(updating);
            }

            if (reachedMaxChannels) {
                const cap = document.createElement('div');
                cap.className = 'setup-preview-warning';
                cap.textContent = 'Reached max channel limit; extra channels will be skipped.';
                previewPanel.appendChild(cap);
            }

            if (warnings.length > 0) {
                const warningList = document.createElement('div');
                warningList.className = 'setup-preview-warnings';
                this._renderCappedWarnings(warnings, warningList);
                previewPanel.appendChild(warningList);
            }
        } else if (this._isPreviewLoading) {
            // First-load case: no previous preview exists
            const loading = document.createElement('div');
            loading.className = 'setup-preview-loading';
            loading.classList.add('panel-spinner');
            loading.textContent = 'Estimating channels...';
            previewPanel.appendChild(loading);
        } else {
            const empty = document.createElement('div');
            empty.className = 'setup-preview-empty';
            empty.textContent = 'Estimates will appear after a short pause.';
            previewPanel.appendChild(empty);
        }

        right.appendChild(detailScroll);
        right.appendChild(previewPanel);
        split.appendChild(left);
        split.appendChild(right);
        this._contentEl.appendChild(split);

        const actions = document.createElement('div');
        actions.className = 'button-row';

        const backButton = document.createElement('button');
        backButton.id = 'setup-back';
        backButton.className = 'screen-button secondary';
        backButton.textContent = 'Back';
        backButton.addEventListener('click', () => {
            this._step = 1;
            this._renderStep();
        });
        actions.appendChild(backButton);

        const nextButton = document.createElement('button');
        nextButton.id = 'setup-next';
        nextButton.className = 'screen-button';
        const shouldFastPath = this._setupContext === 'first-time';
        nextButton.textContent = shouldFastPath ? 'Build Channels' : 'Review';
        nextButton.addEventListener('click', () => {
            this._cleanupStep2AsyncState();
            this._isBuilding = shouldFastPath;
            this._step = 3;
            this._renderStep();
        });
        actions.appendChild(nextButton);

        this._contentEl.appendChild(actions);

        this._registerStep2Focusables(categoryButtons, activeControls, backButton, nextButton);

        if (this._strategies.genres.enabled || this._strategies.directors.enabled) {
            this._detailEl.textContent = 'Performance warning: may be slow on large libraries.';
        } else {
            this._detailEl.textContent = '';
        }

        this._schedulePreview();
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
        const nav = this._orchestrator.getNavigation();
        if (!nav) {
            return;
        }

        const focusableButtons = [...categoryButtons, ...detailButtons, backButton, nextButton]
            .filter((button) => !button.disabled);
        this._focusableIds = focusableButtons.map((button) => button.id);

        const activeCategoryButtonId = this._categoryButtonId(this._activeStrategyCategory);
        const detailIds = detailButtons.filter((button) => !button.disabled).map((button) => button.id);
        const detailFocusTarget = this._resolveDetailFocusTarget(this._activeStrategyCategory, detailIds);

        for (const [index, button] of focusableButtons.entries()) {
            const neighbors: FocusableElement['neighbors'] = {};
            const up = index > 0 ? focusableButtons[index - 1] : undefined;
            if (up) {
                neighbors.up = up.id;
            }
            const down = index < focusableButtons.length - 1 ? focusableButtons[index + 1] : undefined;
            if (down) {
                neighbors.down = down.id;
            }

            if (button.id === activeCategoryButtonId && detailFocusTarget) {
                neighbors.right = detailFocusTarget;
            }

            const isDetailButton = detailIds.includes(button.id);
            const isAdjustable = button.id === STEP2_CONTROL_IDS.maxChannels
                || button.id === STEP2_CONTROL_IDS.minItems
                || button.id === STEP2_CONTROL_IDS.alternateLineupCopies
                || button.id.startsWith('setup-priority-');
            if (isDetailButton && !isAdjustable) {
                neighbors.left = activeCategoryButtonId;
            }

            nav.registerFocusable({
                id: button.id,
                element: button,
                neighbors,
                onFocus: () => {
                    try {
                        button.scrollIntoView({ block: 'nearest' });
                    } catch {
                        button.scrollIntoView();
                    }
                    if (isDetailButton) {
                        this._rememberActiveDetailFocus(button.id);
                    }
                },
            });
        }

        const preferred = this._preferredFocusId;
        if (preferred && focusableButtons.some((button) => button.id === preferred)) {
            nav.setFocus(preferred);
            this._preferredFocusId = null;
            return;
        }

        const first = focusableButtons[0];
        if (first) {
            nav.setFocus(first.id);
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
        this._stepEl.textContent = 'Step 3 of 3';
        this._statusEl.textContent = 'Review changes before building.';
        this._detailEl.textContent = '';
        this._errorEl.textContent = this._reviewError ?? '';

        const scroll = document.createElement('div');
        scroll.className = 'setup-scroll';

        const reviewContainer = document.createElement('div');
        reviewContainer.className = 'setup-review';

        let showLoadingState = false;
        if (!this._recordApplied) {
            showLoadingState = true;
        } else if (!this._review && !this._isReviewLoading && !this._reviewError) {
            // Defer kickoff to avoid re-entrant _renderStep() while this render is still building DOM.
            const token = this._visibilityToken;
            void Promise.resolve()
                .then(() => {
                    if (
                        token !== this._visibilityToken ||
                        this._isBuilding ||
                        this._review ||
                        this._isReviewLoading ||
                        this._reviewError
                    ) {
                        return;
                    }
                    return this._loadReview();
                })
                .catch((error: unknown) => {
                    if (isAbortLikeError(error)) return;
                    console.error('[ChannelSetup] Load review failed:', summarizeErrorForLog(error));
                });
            showLoadingState = true;
        } else if (this._isReviewLoading) {
            showLoadingState = true;
        }

        if (showLoadingState) {
            this._renderBuildReviewLoading(reviewContainer);
        } else if (this._review) {
            const modeLine = document.createElement('div');
            modeLine.className = 'setup-summary';
            modeLine.textContent = `Build mode: ${this._buildMode.charAt(0).toUpperCase()}${this._buildMode.slice(1)}`;
            reviewContainer.appendChild(modeLine);

            const diffSummary = document.createElement('div');
            diffSummary.className = 'setup-summary';
            diffSummary.textContent = `Create ${this._review.diff.summary.created}, remove ${this._review.diff.summary.removed}, unchanged ${this._review.diff.summary.unchanged}.`;
            reviewContainer.appendChild(diffSummary);

            const sampleList = document.createElement('div');
            sampleList.className = 'setup-preview-rows';
            sampleList.appendChild(this._buildPreviewRow('Sample creates', this._review.diff.samples.created.join(', ') || 'None'));
            sampleList.appendChild(this._buildPreviewRow('Sample removes', this._review.diff.samples.removed.join(', ') || 'None'));
            sampleList.appendChild(this._buildPreviewRow('Sample unchanged', this._review.diff.samples.unchanged.join(', ') || 'None'));
            reviewContainer.appendChild(sampleList);

            if (this._review.preview.warnings.length > 0) {
                const warningList = document.createElement('div');
                warningList.className = 'setup-preview-warnings';
                this._renderCappedWarnings(this._review.preview.warnings, warningList);
                reviewContainer.appendChild(warningList);
            }

            if (this._buildMode === 'replace') {
                const warning = document.createElement('div');
                warning.className = 'setup-preview-warning';
                warning.textContent = 'This will replace your current lineup.';
                reviewContainer.appendChild(warning);

                const confirmButton = document.createElement('button');
                confirmButton.id = 'setup-replace-confirm';
                confirmButton.className = `setup-toggle${this._replaceConfirm ? ' selected' : ''}`;
                confirmButton.addEventListener('click', () => {
                    this._preferredFocusId = confirmButton.id;
                    this._replaceConfirm = !this._replaceConfirm;
                    this._renderStep();
                });

                const confirmLabel = document.createElement('span');
                confirmLabel.className = 'setup-toggle-label';
                confirmLabel.textContent = 'Confirm replace';
                const confirmMeta = document.createElement('span');
                confirmMeta.className = 'setup-toggle-meta';
                confirmMeta.textContent = 'Required before replacing channels.';
                const confirmState = document.createElement('span');
                confirmState.className = 'setup-toggle-state';
                confirmState.textContent = this._replaceConfirm ? 'Confirmed' : 'Required';

                confirmButton.appendChild(confirmLabel);
                confirmButton.appendChild(confirmMeta);
                confirmButton.appendChild(confirmState);

                reviewContainer.appendChild(confirmButton);
            }
        }

        scroll.appendChild(reviewContainer);
        this._contentEl.appendChild(scroll);

        const actions = document.createElement('div');
        actions.className = 'button-row';

        const backButton = document.createElement('button');
        backButton.id = 'setup-back';
        backButton.className = 'screen-button secondary';
        backButton.textContent = 'Back';
        backButton.addEventListener('click', () => {
            this._reviewAbortController?.abort();
            this._review = null;
            this._reviewError = null;
            this._replaceConfirm = false;
            this._step = 2;
            this._renderStep();
        });
        actions.appendChild(backButton);

        const confirmButton = document.createElement('button');
        confirmButton.id = 'setup-confirm';
        confirmButton.className = 'screen-button';
        confirmButton.textContent = this._buildMode === 'replace' ? 'Confirm & Replace' : 'Confirm & Build';
        confirmButton.disabled = this._isReviewLoading || !this._review || (this._buildMode === 'replace' && !this._replaceConfirm);
        confirmButton.addEventListener('click', () => {
            if (confirmButton.disabled) {
                return;
            }
            this._isBuilding = true;
            this._renderStep();
        });
        actions.appendChild(confirmButton);

        this._contentEl.appendChild(actions);

        const listButtons = Array.from(reviewContainer.querySelectorAll<HTMLButtonElement>('button'));
        this._registerFocusables([...listButtons, backButton, confirmButton]);
    }

    private _renderBuildReviewLoading(container: HTMLElement = this._contentEl): void {
        const loading = document.createElement('div');
        loading.className = 'setup-preview-loading';
        loading.classList.add('panel-spinner');
        loading.textContent = 'Preparing your review...';
        container.appendChild(loading);
    }

    private _renderBuildProgress(): void {
        this._stepEl.textContent = 'Step 3 of 3';
        this._statusEl.textContent = 'Building channels...';
        this._detailEl.textContent = '';
        this._errorEl.textContent = '';

        const progressContainer = document.createElement('div');
        progressContainer.className = 'setup-progress-container';

        // Progress Bar
        const barContainer = document.createElement('div');
        barContainer.className = 'setup-progress-bar-bg';
        const barFill = document.createElement('div');
        barFill.className = 'setup-progress-bar-fill';
        barContainer.appendChild(barFill);
        progressContainer.appendChild(barContainer);

        // Task Name
        const taskLabel = document.createElement('div');
        taskLabel.className = 'setup-progress-task';
        taskLabel.textContent = 'Initializing...';
        progressContainer.appendChild(taskLabel);

        // Detail
        const detailLabel = document.createElement('div');
        detailLabel.className = 'setup-progress-detail';
        detailLabel.textContent = 'Please wait';
        progressContainer.appendChild(detailLabel);

        this._contentEl.appendChild(progressContainer);

        const actions = document.createElement('div');
        actions.className = 'button-row';

        const backButton = document.createElement('button');
        backButton.id = 'setup-back';
        backButton.className = 'screen-button secondary';
        backButton.textContent = 'Cancel'; // Becomes Cancel during build
        backButton.addEventListener('click', () => {
            if (this._isBuilding) {
                // Cancel Build
                this._buildAbortController?.abort();
                backButton.disabled = true;
                backButton.textContent = 'Canceling...';
                return;
            }
            // If done or error, it acts as Back/Reset
            this._step = 2;
            this._renderStep();
        });
        actions.appendChild(backButton);

        const doneButton = document.createElement('button');
        doneButton.id = 'setup-done';
        doneButton.className = 'screen-button';
        doneButton.textContent = 'Done';
        doneButton.disabled = true;
        doneButton.addEventListener('click', () => {
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
        });
        actions.appendChild(doneButton);

        this._contentEl.appendChild(actions);

        this._registerFocusables([backButton, doneButton]);

        // Start build
        this._startBuild(backButton, doneButton, barFill, taskLabel, detailLabel).catch((error: unknown) => {
            if (isAbortLikeError(error)) return;
            console.error('[ChannelSetup] Build failed:', summarizeErrorForLog(error));
        });
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
                this._statusEl.textContent = 'Canceled.';
                this._detailEl.textContent = 'No changes were applied.';
                taskLabel.textContent = 'Canceled';
                detailLabel.textContent = '';
                barFill.style.width = '0%';
                barFill.classList.remove('indeterminate');

                cancelButton.disabled = false;
                cancelButton.textContent = 'Back';
                cancelButton.focus();
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
        const nav = this._orchestrator.getNavigation();
        if (!nav) {
            return;
        }

        const focusableButtons = buttons.filter(
            (button): button is HTMLButtonElement =>
                button instanceof HTMLButtonElement && !button.disabled
        );

        this._focusableIds = focusableButtons.map((button) => button.id);

        for (const [index, button] of focusableButtons.entries()) {
            const focusable: FocusableElement = {
                id: button.id,
                element: button,
                neighbors: {},
                onFocus: () => {
                    try {
                        button.scrollIntoView({ block: 'nearest' });
                    } catch {
                        button.scrollIntoView();
                    }
                },
            };
            if (mode === 'linear') {
                const up = index > 0 ? focusableButtons[index - 1] : undefined;
                if (up) {
                    focusable.neighbors.up = up.id;
                }
                const down = index < focusableButtons.length - 1 ? focusableButtons[index + 1] : undefined;
                if (down) {
                    focusable.neighbors.down = down.id;
                }
            }
            nav.registerFocusable(focusable);
        }

        const preferred = this._preferredFocusId;
        if (preferred && focusableButtons.some((button) => button.id === preferred)) {
            nav.setFocus(preferred);
            this._preferredFocusId = null;
            return;
        }

        const first = focusableButtons[0];
        if (first) {
            nav.setFocus(first.id);
        }
    }

    private _unregisterFocusables(): void {
        const nav = this._orchestrator.getNavigation();
        if (!nav) {
            return;
        }
        for (const id of this._focusableIds) {
            nav.unregisterFocusable(id);
        }
        this._focusableIds = [];
    }
}
