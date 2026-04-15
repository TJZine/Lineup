/** Channel setup wizard screen. */

import {
    type ChannelBuildProgress,
    type ChannelSetupConfig,
} from '../../../core/channel-setup/types';
import type { FocusableElement, KeyEvent } from '../../navigation';
import { ServerSelectionStore } from '../../plex/discovery/ServerSelectionStore';
import { isAbortLikeError, summarizeErrorForLog } from '../../../utils/errors';
import { DEFAULT_CHANNEL_SETUP_MAX, MAX_CHANNELS } from '../../scheduler/channel-manager/constants';
import {
    SETUP_STRATEGY_KEYS,
} from '../../../core/channel-setup/constants';
import { createDropdownPopover } from '../common/CreateDropdownPopover';
import { createScreenShell } from '../common/ScreenShell';
import { renderCappedWarnings } from '../common/render/renderCappedWarnings';
import { ChannelSetupFocusCoordinator } from './focus/ChannelSetupFocusCoordinator';
import { LibraryStepController } from './steps/LibraryStepController';
import { StrategyStepController } from './steps/StrategyStepController';
import { BuildReviewStepController } from './steps/BuildReviewStepController';
import { BuildProgressStepController } from './steps/BuildProgressStepController';
import type { BuildReviewStateSnapshot } from './steps/types';
import {
    ADVANCED_STRATEGY_KEYS,
    ALTERNATE_LINEUP_COPY_OPTIONS,
    BUILD_MODE_OPTIONS,
    COMBINE_MODE_OPTIONS,
    CONTENT_STRATEGY_KEYS,
    SERIES_BASE_MODE_OPTIONS,
    SERIES_BLOCK_PRESETS,
    SERIES_VARIANT_TYPE_OPTIONS,
    STEP2_CONTROL_IDS,
    STRATEGY_CATEGORIES,
    type SetupStrategyKey,
    type StrategyCategoryKey,
} from './steps/constants';
import { scrollToNearest } from './focus/scrollToNearest';
import {
    ChannelSetupSessionController,
    type EstimateKey,
    type StrategyStepMutableState,
    strategySupportsMixedScope,
} from './ChannelSetupSessionController';
import type { ChannelSetupWorkflowPort } from '../../../core/channel-setup/ChannelSetupWorkflowPort';
import type { ChannelSetupScreenPorts } from './ChannelSetupScreenPorts';

const CHANNEL_LIMIT_PRESETS = [50, 100, 150, 200, 300, 400, 500];

type AdjustableControl = {
    cyclePrev: () => boolean;
    cycleNext: () => boolean;
    isDisabled: () => boolean;
    openDropdown: () => void;
};

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
    private _screenPorts: ChannelSetupScreenPorts;
    private readonly _serverSelectionStore: ServerSelectionStore;
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
    private readonly _session: ChannelSetupSessionController;

    private _activeStrategyCategory: StrategyCategoryKey = 'content-sources';
    private _rememberedDetailFocusByCategory: Partial<Record<StrategyCategoryKey, string>> = {};
    private _channelLimitOptions: number[] = CHANNEL_LIMIT_PRESETS.filter((value) => value <= MAX_CHANNELS);
    private _minItemsOptions: number[] = [1, 5, 10, 20, 50];
    private _preferredFocusId: string | null = null;
    private _visibilityToken = 0;
    private _navKeyHandler: ((event: KeyEvent) => void) | null = null;
    private _activeDropdown: { destroy: () => void; dismiss: () => void } | null = null;
    private _pendingDropdownDeferredRender = false;
    private _previewPanelId = 'setup-preview-panel';
    private _maxPreviewWarnings = 5;
    private _lastReorder: { key: SetupStrategyKey; dir: 'up' | 'down' } | null = null;
    private _grabbedPriorityKey: SetupStrategyKey | null = null;

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

    private _priorityRowId(strategy: SetupStrategyKey): string {
        return `setup-priority-row-${this._toDomId(String(strategy))}`;
    }

    private _setPriorityRowGrabbedVisual(strategy: SetupStrategyKey | null, grabbed: boolean): void {
        if (!strategy) return;
        const el = document.getElementById(this._priorityRowId(strategy));
        el?.classList.toggle('setup-priority-row--grabbed', grabbed);
        el?.setAttribute('aria-grabbed', grabbed ? 'true' : 'false');
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

    constructor(
        container: HTMLElement,
        deps: { workflowPort: ChannelSetupWorkflowPort; screenPorts: ChannelSetupScreenPorts }
    ) {
        this._container = container;
        this._screenPorts = deps.screenPorts;
        this._serverSelectionStore = new ServerSelectionStore(() => ({
            selectedServerKey: this._screenPorts.getSelectedServerStorageKey(),
            serverHealthKey: this._screenPorts.getServerHealthStorageKey(),
        }));
        this._focus = new ChannelSetupFocusCoordinator({
            getNavigation: (): ReturnType<ChannelSetupScreenPorts['getNavigation']> => this._screenPorts.getNavigation(),
        });
        this._session = new ChannelSetupSessionController({
            workflowPort: deps.workflowPort,
            getSelectedServerId: (): string | null => this._getSelectedServerId(),
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
        const token = this._visibilityToken;
        this._container.style.display = 'flex';
        this._container.classList.add('visible');
        const nav = this._screenPorts.getNavigation();
        if (nav && !this._navKeyHandler) {
            this._navKeyHandler = (event: KeyEvent): void => {
                const session = this._session.getSnapshot();
                if (event.handled || session.step !== 2) return;
                if (this._activeDropdown && event.button === 'back') {
                    event.handled = true;
                    event.originalEvent.preventDefault();
                    this._dismissDropdown();
                    return;
                }
                const focusedId = nav.getFocusedElement()?.id ?? null;
                if (!focusedId) return;

                const activeCategoryButtonId = this._categoryButtonId(this._activeStrategyCategory);
                const adjustableControl = this._getAdjustableStep2Control(focusedId);
                if (adjustableControl && !adjustableControl.isDisabled()) {
                    if (event.button === 'ok') {
                        event.handled = true;
                        event.originalEvent.preventDefault();
                        adjustableControl.openDropdown();
                        return;
                    }
                    if (event.button === 'right') {
                        event.handled = true;
                        event.originalEvent.preventDefault();
                        adjustableControl.cycleNext();
                        return;
                    }
                    if (event.button === 'left') {
                        event.handled = true;
                        event.originalEvent.preventDefault();
                        const changed = adjustableControl.cyclePrev();
                        if (!changed) {
                            this._preferredFocusId = activeCategoryButtonId;
                            nav.setFocus(activeCategoryButtonId);
                        }
                        return;
                    }
                }

                // Grab/drop toggle for priority reorder
                if (
                    this._activeStrategyCategory === 'priority-order'
                    && focusedId.startsWith('setup-priority-row-')
                    && event.button === 'ok'
                ) {
                    event.handled = true;
                    event.originalEvent.preventDefault();
                    const strategy = this._strategyKeyFromControlId(focusedId, 'setup-priority-row-');
                    if (!strategy) return;

                    if (this._grabbedPriorityKey === strategy) {
                        // Drop: exit grab mode
                        this._setPriorityRowGrabbedVisual(strategy, false);
                        this._grabbedPriorityKey = null;
                    } else {
                        // Grab: enter grab mode (release any previous)
                        if (this._grabbedPriorityKey) {
                            this._setPriorityRowGrabbedVisual(this._grabbedPriorityKey, false);
                        }
                        this._grabbedPriorityKey = strategy;
                        this._setPriorityRowGrabbedVisual(strategy, true);
                    }
                    return;
                }

                // D-pad up/down reorder when grabbed
                if (
                    this._activeStrategyCategory === 'priority-order'
                    && focusedId.startsWith('setup-priority-row-')
                    && this._grabbedPriorityKey !== null
                    && (event.button === 'up' || event.button === 'down')
                ) {
                    if (event.isRepeat || event.isLongPress) {
                        event.handled = true;
                        event.originalEvent.preventDefault();
                        return;
                    }
                    const strategy = this._grabbedPriorityKey;
                    const currentIndex = session.strategyOrder.indexOf(strategy);
                    if (currentIndex < 0) {
                        event.handled = true;
                        event.originalEvent.preventDefault();
                        return;
                    }
                    const targetIndex = event.button === 'up' ? currentIndex - 1 : currentIndex + 1;
                    if (targetIndex < 0 || targetIndex >= session.strategyOrder.length) {
                        event.handled = true;
                        event.originalEvent.preventDefault();
                        return;
                    }
                    const targetKey = session.strategyOrder[targetIndex];
                    if (!targetKey) {
                        event.handled = true;
                        event.originalEvent.preventDefault();
                        return;
                    }
                    event.handled = true;
                    event.originalEvent.preventDefault();
                    this._session.updateStrategyState((draft) => {
                        draft.strategyOrder[currentIndex] = targetKey;
                        draft.strategyOrder[targetIndex] = strategy;
                    });
                    this._lastReorder = { key: strategy, dir: event.button === 'up' ? 'up' : 'down' };
                    this._preferredFocusId = this._priorityRowId(strategy);
                    this._rememberedDetailFocusByCategory['priority-order'] = this._preferredFocusId;
                    this._session.schedulePreview(() => this._renderStep());
                    this._renderStep();
                    this._lastReorder = null;
                    // Re-apply grabbed state after render
                    this._setPriorityRowGrabbedVisual(strategy, true);
                    return;
                }

                const direction = event.button === 'left'
                    ? 'left'
                    : event.button === 'right'
                        ? 'right'
                        : null;
                if (!direction) return;

                const activeDetailIds = this._getDetailControlIdsForCategory(this._activeStrategyCategory);
                const focusedCategory = this._categoryFromButtonId(focusedId);

                if (focusedCategory && direction === 'right') {
                    if (focusedCategory !== this._activeStrategyCategory) {
                        if (focusedCategory !== 'priority-order') {
                            this._grabbedPriorityKey = null;
                        }
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

                if (direction === 'left' && activeDetailIds.includes(focusedId)) {
                    event.handled = true;
                    if (this._activeStrategyCategory === 'priority-order' && this._grabbedPriorityKey) {
                        this._setPriorityRowGrabbedVisual(this._grabbedPriorityKey, false);
                        this._grabbedPriorityKey = null;
                    }
                    this._preferredFocusId = activeCategoryButtonId;
                    nav.setFocus(activeCategoryButtonId);
                }
            };
            nav.on('keyPress', this._navKeyHandler);
        }
        this._session.beginSession();
        this._activeStrategyCategory = 'content-sources';
        this._rememberedDetailFocusByCategory = {};
        this._lastReorder = null;
        this._grabbedPriorityKey = null;
        this._statusEl.textContent = 'Loading libraries...';
        this._detailEl.textContent = '';
        this._errorEl.textContent = '';
        this._session.loadLibraries().then(() => {
            if (token !== this._visibilityToken) {
                return;
            }
            const session = this._session.getSnapshot();
            if (session.loadError) {
                this._contentEl.replaceChildren();
                this._stepEl.textContent = '';
                this._statusEl.textContent = 'Library load failed.';
                this._detailEl.textContent = '';
                this._errorEl.textContent = session.loadError;
                return;
            }
            this._renderStep();
        }).catch((error: unknown) => {
            if (token !== this._visibilityToken) {
                return;
            }
            if (isAbortLikeError(error)) return;
            console.warn('Load libraries failed:', summarizeErrorForLog(error));
        });
    }

    hide(): void {
        this._visibilityToken += 1;
        this._closeDropdown();
        this._session.endSession();
        if (this._navKeyHandler) {
            const nav = this._screenPorts.getNavigation();
            nav?.off('keyPress', this._navKeyHandler);
            this._navKeyHandler = null;
        }
        this._focus.unregisterAll();
        this._container.style.display = 'none';
        this._container.classList.remove('visible');
    }

    getPlannerDiagnosticsConfig(): ChannelSetupConfig | null {
        const serverId = this._getSelectedServerId();
        if (!serverId) {
            return null;
        }
        return this._session.buildConfig(serverId);
    }

    private _renderStep(): void {
        const token = this._visibilityToken;
        const nav = this._screenPorts.getNavigation();
        const focusedId = nav?.getFocusedElement()?.id ?? null;
        if (focusedId && this._preferredFocusId === null) {
            this._preferredFocusId = focusedId;
        }
        if (this._activeDropdown) {
            this._pendingDropdownDeferredRender = true;
            return;
        }
        this._focus.unregisterAll();
        if (token !== this._visibilityToken) {
            return;
        }
        this._contentEl.replaceChildren();

        const session = this._session.getSnapshot();
        if (session.step === 1) {
            this._renderLibraryStep();
        } else if (session.step === 2) {
            this._renderStrategyStep();
        } else {
            this._renderBuildStep();
        }
    }

    private _renderLibraryStep(): void {
        const session = this._session.getSnapshot();
        this._libraryStep.render({
            contentEl: this._contentEl,
            stepEl: this._stepEl,
            statusEl: this._statusEl,
            detailEl: this._detailEl,
            errorEl: this._errorEl,
        }, {
            libraries: session.libraries,
            selectedLibraryIds: session.selectedLibraryIds,
            formatCount: (value) => this._formatCount(value),
            movieSvg: MOVIE_SVG,
            showSvg: SHOW_SVG,
            toDomId: (raw) => this._toDomId(raw),
            onToggleLibrary: (libraryId, focusId) => {
                this._preferredFocusId = focusId;
                const nextSelected = this._session.toggleLibrary(libraryId);

                // Surgical update: toggle the single button in-place.
                const updated = this._libraryStep.updateLibraryToggle(
                    this._contentEl,
                    libraryId,
                    nextSelected,
                    (raw) => this._toDomId(raw)
                );
                if (updated) {
                    const updatedSession = this._session.getSnapshot();
                    this._preferredFocusId = null;
                    const count = updatedSession.selectedLibraryIds.size;
                    const total = updatedSession.libraries.length;
                    this._detailEl.textContent = `Selected ${count} of ${total}.`;
                    const nextButton = this._contentEl.querySelector('#setup-next') as HTMLButtonElement | null;
                    if (nextButton) {
                        nextButton.disabled = updatedSession.libraries.length === 0 || updatedSession.selectedLibraryIds.size === 0;
                    }
                } else {
                    this._renderStep();
                }
            },
            onSelectAll: (focusId) => {
                this._session.selectAllLibraries();
                this._preferredFocusId = focusId;
                this._renderStep();
            },
            onClearAll: (focusId) => {
                this._session.clearAllLibraries();
                this._preferredFocusId = focusId;
                this._renderStep();
            },
            onBack: () => {
                this._screenPorts.openServerSelect();
            },
            onNext: () => {
                this._session.setStep(2);
                this._renderStep();
            },
            registerSpatialFocusables: (buttons) => {
                const preferredApplied = this._focus.registerSpatial(buttons, this._preferredFocusId);
                if (preferredApplied) {
                    this._preferredFocusId = null;
                }
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
        const nav = this._screenPorts.getNavigation();
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
        this._session.syncSetupContext();
        const session = this._session.getSnapshot();
        this._strategyStep.render({
            contentEl: this._contentEl,
            stepEl: this._stepEl,
            statusEl: this._statusEl,
            detailEl: this._detailEl,
            errorEl: this._errorEl,
        }, {
            state: {
                activeStrategyCategory: this._activeStrategyCategory,
                strategies: session.strategies,
                strategyOrder: session.strategyOrder,
                channelExpansion: session.channelExpansion,
                seriesOrdering: session.seriesOrdering,
                buildMode: session.buildMode,
                actorStudioCombineMode: session.actorStudioCombineMode,
                maxChannels: session.maxChannels,
                minItems: session.minItems,
                setupContext: session.setupContext,
                previewPanelId: this._previewPanelId,
                preview: session.preview,
                previewError: session.previewError,
                previewStatus: session.previewStatus,
                isPreviewLoading: session.isPreviewLoading,
            },
            stepPreset: (options, current, dir, mode) => this._stepPreset(options, current, dir, mode),
            channelLimitOptions: this._channelLimitOptions,
            minItemsOptions: this._minItemsOptions,
            strategyKeys: SETUP_STRATEGY_KEYS,
            categoryButtonId: (category) => this._categoryButtonId(category),
            strategyButtonId: (strategy) => this._strategyButtonId(strategy),
            priorityRowId: (strategy) => this._priorityRowId(strategy),
            lastReorder: this._lastReorder,
            scopeButtonId: (strategy) => this._scopeButtonId(strategy),
            strategySupportsMixedScope: (strategy) => strategySupportsMixedScope(strategy),
            rememberDetailFocus: (controlId) => this._rememberActiveDetailFocus(controlId),
            buildPreviewRow: (label, value, key) => this._buildPreviewRow(label, value, key),
            renderCappedWarnings: (warnings, container) => {
                renderCappedWarnings({
                    warnings,
                    container,
                    maxItems: this._maxPreviewWarnings,
                    itemClassName: 'setup-preview-warning',
                });
            },
            applyCategoryChange: (category, focusId) => {
                if (category !== 'priority-order') {
                    this._grabbedPriorityKey = null;
                }
                this._activeStrategyCategory = category;
                this._preferredFocusId = focusId;
                this._renderStep();
            },
            applySettingChange: (focusId, mutate) => {
                this._applyStep2SettingChange(focusId, mutate);
            },
            openDropdown: (config) => {
                this._openStep2Dropdown(config);
            },
            onBack: () => {
                this._grabbedPriorityKey = null;
                this._session.setStep(1);
                this._renderStep();
            },
            onNext: () => {
                this._grabbedPriorityKey = null;
                this._session.setStep(3);
                this._renderStep();
            },
            registerStep2Focusables: (categoryButtons, detailButtons, backButton, nextButton) => {
                this._registerStep2Focusables(categoryButtons, detailButtons, backButton, nextButton);
            },
            detailText: session.strategies.genres.enabled || session.strategies.directors.enabled
                ? 'Performance warning: may be slow on large libraries.'
                : '',
            schedulePreview: () => this._session.schedulePreview(() => this._renderStep()),
        });
    }

    private _applyStep2SettingChange(focusId: string, mutate: (state: StrategyStepMutableState) => void): void {
        this._preferredFocusId = focusId;
        this._rememberActiveDetailFocus(focusId);
        this._session.updateStrategyState((draft: StrategyStepMutableState) => {
            draft.activeStrategyCategory = this._activeStrategyCategory;
            mutate(draft);
            this._activeStrategyCategory = draft.activeStrategyCategory;
        });
        this._session.schedulePreview(() => this._renderStep());

        if (focusId.startsWith('setup-priority-row-')) {
            const strategy = this._strategyKeyFromControlId(focusId, 'setup-priority-row-');
            if (strategy) {
                const updatedSession = this._session.getSnapshot();
                const updated = this._strategyStep.updatePriorityRowState(
                    this._contentEl,
                    this._priorityRowId(strategy),
                    updatedSession.strategies[strategy].enabled
                );
                if (updated) {
                    this._preferredFocusId = null;
                    return;
                }
            }
        }

        if (this._activeDropdown) {
            this._pendingDropdownDeferredRender = true;
            return;
        }

        this._renderStep();
    }

    private _openStep2Dropdown(config: {
        anchorId: string;
        options: Array<{ label: string; value: string }>;
        currentValue: string;
        onSelect: (value: string) => void;
    }): void {
        this._closeDropdown();
        const anchor = document.getElementById(config.anchorId);
        if (!(anchor instanceof HTMLElement)) {
            return;
        }
        const nav = this._screenPorts.getNavigation();
        this._activeDropdown = createDropdownPopover({
            anchor,
            container: this._contentEl,
            options: config.options,
            currentValue: config.currentValue,
            onSelect: (value) => {
                try {
                    config.onSelect(value);
                } finally {
                    this._closeDropdown();
                    this._preferredFocusId = config.anchorId;
                    this._flushDeferredDropdownRender();
                }
            },
            onDismiss: () => {
                nav?.setFocus(config.anchorId);
            },
            nav,
            cssClass: 'setup-dropdown',
            optionCssClass: 'setup-dropdown-option',
        });
    }

    private _cycleStep2Option<T extends string | number>(
        options: readonly T[],
        current: T,
        dir: 'left' | 'right'
    ): T {
        if (options.length === 0) {
            return current;
        }
        const currentIndex = options.indexOf(current);
        let baseIndex = currentIndex;
        if (baseIndex < 0) {
            if (typeof current === 'number' && options.every((option) => typeof option === 'number')) {
                baseIndex = this._getNearestOptionIndex(options as unknown as number[], current);
            } else {
                baseIndex = 0;
            }
        }
        const nextIndex = dir === 'left'
            ? Math.max(0, baseIndex - 1)
            : Math.min(options.length - 1, baseIndex + 1);
        return options[nextIndex] ?? current;
    }

    private _getAdjustableStep2Control(controlId: string): AdjustableControl | null {
        const openDropdown = (): void => {
            const control = document.getElementById(controlId);
            if (control instanceof HTMLButtonElement && !control.disabled) {
                control.click();
            }
        };

        if (controlId === STEP2_CONTROL_IDS.buildMode) {
            return {
                cyclePrev: (): boolean => {
                    const session = this._session.getSnapshot();
                    const next = this._cycleStep2Option(BUILD_MODE_OPTIONS, session.buildMode, 'left');
                    if (next === session.buildMode) return false;
                    this._applyStep2SettingChange(controlId, (draft) => {
                        draft.buildMode = next;
                    });
                    return true;
                },
                cycleNext: (): boolean => {
                    const session = this._session.getSnapshot();
                    const next = this._cycleStep2Option(BUILD_MODE_OPTIONS, session.buildMode, 'right');
                    if (next === session.buildMode) return false;
                    this._applyStep2SettingChange(controlId, (draft) => {
                        draft.buildMode = next;
                    });
                    return true;
                },
                isDisabled: () => false,
                openDropdown,
            };
        }

        if (controlId === STEP2_CONTROL_IDS.combineMode) {
            return {
                cyclePrev: (): boolean => {
                    const session = this._session.getSnapshot();
                    const next = this._cycleStep2Option(COMBINE_MODE_OPTIONS, session.actorStudioCombineMode, 'left');
                    if (next === session.actorStudioCombineMode) return false;
                    this._applyStep2SettingChange(controlId, (draft) => {
                        draft.actorStudioCombineMode = next;
                    });
                    return true;
                },
                cycleNext: (): boolean => {
                    const session = this._session.getSnapshot();
                    const next = this._cycleStep2Option(COMBINE_MODE_OPTIONS, session.actorStudioCombineMode, 'right');
                    if (next === session.actorStudioCombineMode) return false;
                    this._applyStep2SettingChange(controlId, (draft) => {
                        draft.actorStudioCombineMode = next;
                    });
                    return true;
                },
                isDisabled: () => false,
                openDropdown,
            };
        }

        if (controlId === STEP2_CONTROL_IDS.alternateLineupCopies) {
            return {
                cyclePrev: (): boolean => {
                    const session = this._session.getSnapshot();
                    if (!session.channelExpansion.addAlternateLineups) return false;
                    const next = this._cycleStep2Option(
                        ALTERNATE_LINEUP_COPY_OPTIONS,
                        session.channelExpansion.alternateLineupCopies,
                        'left'
                    );
                    if (next === session.channelExpansion.alternateLineupCopies) return false;
                    this._applyStep2SettingChange(controlId, (draft) => {
                        draft.channelExpansion.alternateLineupCopies = next;
                    });
                    return true;
                },
                cycleNext: (): boolean => {
                    const session = this._session.getSnapshot();
                    if (!session.channelExpansion.addAlternateLineups) return false;
                    const next = this._cycleStep2Option(
                        ALTERNATE_LINEUP_COPY_OPTIONS,
                        session.channelExpansion.alternateLineupCopies,
                        'right'
                    );
                    if (next === session.channelExpansion.alternateLineupCopies) return false;
                    this._applyStep2SettingChange(controlId, (draft) => {
                        draft.channelExpansion.alternateLineupCopies = next;
                    });
                    return true;
                },
                isDisabled: () => !this._session.getSnapshot().channelExpansion.addAlternateLineups,
                openDropdown,
            };
        }

        if (controlId === STEP2_CONTROL_IDS.seriesBaseMode) {
            return {
                cyclePrev: (): boolean => {
                    const session = this._session.getSnapshot();
                    const next = this._cycleStep2Option(
                        SERIES_BASE_MODE_OPTIONS,
                        session.seriesOrdering.basePlaybackMode,
                        'left'
                    );
                    if (next === session.seriesOrdering.basePlaybackMode) return false;
                    this._applyStep2SettingChange(controlId, (draft) => {
                        draft.seriesOrdering.basePlaybackMode = next;
                    });
                    return true;
                },
                cycleNext: (): boolean => {
                    const session = this._session.getSnapshot();
                    const next = this._cycleStep2Option(
                        SERIES_BASE_MODE_OPTIONS,
                        session.seriesOrdering.basePlaybackMode,
                        'right'
                    );
                    if (next === session.seriesOrdering.basePlaybackMode) return false;
                    this._applyStep2SettingChange(controlId, (draft) => {
                        draft.seriesOrdering.basePlaybackMode = next;
                    });
                    return true;
                },
                isDisabled: () => false,
                openDropdown,
            };
        }

        if (controlId === STEP2_CONTROL_IDS.seriesBaseBlockSize) {
            return {
                cyclePrev: (): boolean => {
                    const session = this._session.getSnapshot();
                    if (session.seriesOrdering.basePlaybackMode !== 'block') return false;
                    const next = this._cycleStep2Option(
                        SERIES_BLOCK_PRESETS,
                        session.seriesOrdering.baseBlockSize,
                        'left'
                    );
                    if (next === session.seriesOrdering.baseBlockSize) return false;
                    this._applyStep2SettingChange(controlId, (draft) => {
                        draft.seriesOrdering.baseBlockSize = next;
                    });
                    return true;
                },
                cycleNext: (): boolean => {
                    const session = this._session.getSnapshot();
                    if (session.seriesOrdering.basePlaybackMode !== 'block') return false;
                    const next = this._cycleStep2Option(
                        SERIES_BLOCK_PRESETS,
                        session.seriesOrdering.baseBlockSize,
                        'right'
                    );
                    if (next === session.seriesOrdering.baseBlockSize) return false;
                    this._applyStep2SettingChange(controlId, (draft) => {
                        draft.seriesOrdering.baseBlockSize = next;
                    });
                    return true;
                },
                isDisabled: () => this._session.getSnapshot().seriesOrdering.basePlaybackMode !== 'block',
                openDropdown,
            };
        }

        if (controlId === STEP2_CONTROL_IDS.seriesVariantType) {
            return {
                cyclePrev: (): boolean => {
                    const session = this._session.getSnapshot();
                    const next = this._cycleStep2Option(
                        SERIES_VARIANT_TYPE_OPTIONS,
                        session.channelExpansion.variantType,
                        'left'
                    );
                    if (next === session.channelExpansion.variantType) return false;
                    this._applyStep2SettingChange(controlId, (draft) => {
                        draft.channelExpansion.variantType = next;
                    });
                    return true;
                },
                cycleNext: (): boolean => {
                    const session = this._session.getSnapshot();
                    const next = this._cycleStep2Option(
                        SERIES_VARIANT_TYPE_OPTIONS,
                        session.channelExpansion.variantType,
                        'right'
                    );
                    if (next === session.channelExpansion.variantType) return false;
                    this._applyStep2SettingChange(controlId, (draft) => {
                        draft.channelExpansion.variantType = next;
                    });
                    return true;
                },
                isDisabled: () => false,
                openDropdown,
            };
        }

        if (controlId === STEP2_CONTROL_IDS.seriesVariantBlockSize) {
            return {
                cyclePrev: (): boolean => {
                    const session = this._session.getSnapshot();
                    if (session.channelExpansion.variantType !== 'block') return false;
                    const next = this._cycleStep2Option(
                        SERIES_BLOCK_PRESETS,
                        session.channelExpansion.variantBlockSize,
                        'left'
                    );
                    if (next === session.channelExpansion.variantBlockSize) return false;
                    this._applyStep2SettingChange(controlId, (draft) => {
                        draft.channelExpansion.variantBlockSize = next;
                    });
                    return true;
                },
                cycleNext: (): boolean => {
                    const session = this._session.getSnapshot();
                    if (session.channelExpansion.variantType !== 'block') return false;
                    const next = this._cycleStep2Option(
                        SERIES_BLOCK_PRESETS,
                        session.channelExpansion.variantBlockSize,
                        'right'
                    );
                    if (next === session.channelExpansion.variantBlockSize) return false;
                    this._applyStep2SettingChange(controlId, (draft) => {
                        draft.channelExpansion.variantBlockSize = next;
                    });
                    return true;
                },
                isDisabled: () => this._session.getSnapshot().channelExpansion.variantType !== 'block',
                openDropdown,
            };
        }

        if (controlId === STEP2_CONTROL_IDS.maxChannels) {
            return {
                cyclePrev: (): boolean => {
                    const session = this._session.getSnapshot();
                    const next = this._stepPreset(this._channelLimitOptions, session.maxChannels, 'left', 'clamp');
                    if (next === session.maxChannels) return false;
                    this._applyStep2SettingChange(controlId, (draft) => {
                        draft.maxChannels = next;
                    });
                    return true;
                },
                cycleNext: (): boolean => {
                    const session = this._session.getSnapshot();
                    const next = this._stepPreset(this._channelLimitOptions, session.maxChannels, 'right', 'clamp');
                    if (next === session.maxChannels) return false;
                    this._applyStep2SettingChange(controlId, (draft) => {
                        draft.maxChannels = next;
                    });
                    return true;
                },
                isDisabled: () => false,
                openDropdown,
            };
        }

        if (controlId === STEP2_CONTROL_IDS.minItems) {
            return {
                cyclePrev: (): boolean => {
                    const session = this._session.getSnapshot();
                    const next = this._stepPreset(this._minItemsOptions, session.minItems, 'left', 'clamp');
                    if (next === session.minItems) return false;
                    this._applyStep2SettingChange(controlId, (draft) => {
                        draft.minItems = next;
                    });
                    return true;
                },
                cycleNext: (): boolean => {
                    const session = this._session.getSnapshot();
                    const next = this._stepPreset(this._minItemsOptions, session.minItems, 'right', 'clamp');
                    if (next === session.minItems) return false;
                    this._applyStep2SettingChange(controlId, (draft) => {
                        draft.minItems = next;
                    });
                    return true;
                },
                isDisabled: () => false,
                openDropdown,
            };
        }

        return null;
    }

    private _closeDropdown(): void {
        if (!this._activeDropdown) {
            return;
        }
        const dropdown = this._activeDropdown;
        this._activeDropdown = null;
        dropdown.destroy();
    }

    private _flushDeferredDropdownRender(): void {
        if (!this._pendingDropdownDeferredRender) {
            return;
        }
        this._pendingDropdownDeferredRender = false;
        this._renderStep();
    }

    private _dismissDropdown(): void {
        if (!this._activeDropdown) {
            return;
        }
        const dropdown = this._activeDropdown;
        try {
            dropdown.dismiss();
        } finally {
            if (this._activeDropdown === dropdown) {
                this._activeDropdown = null;
            }
        }
        this._flushDeferredDropdownRender();
    }

    private _categoryButtonId(category: StrategyCategoryKey): string {
        return `setup-category-${category}`;
    }

    private _categoryFromButtonId(buttonId: string): StrategyCategoryKey | null {
        const match = STRATEGY_CATEGORIES.find((category) => this._categoryButtonId(category) === buttonId);
        return match ?? null;
    }

    private _getDetailControlIdsForCategory(category: StrategyCategoryKey): string[] {
        const session = this._session.getSnapshot();
        if (category === 'content-sources') {
            return CONTENT_STRATEGY_KEYS.flatMap((key) => {
                const ids = [this._strategyButtonId(key)];
                if (strategySupportsMixedScope(key)) {
                    ids.push(this._scopeButtonId(key));
                }
                return ids;
            });
        }
        if (category === 'advanced-sources') {
            return ADVANCED_STRATEGY_KEYS.flatMap((key) => {
                const ids = [this._strategyButtonId(key)];
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
            ];
        }
        if (category === 'series-ordering') {
            return [
                STEP2_CONTROL_IDS.seriesBaseMode,
                STEP2_CONTROL_IDS.seriesBaseBlockSize,
                STEP2_CONTROL_IDS.seriesVariantType,
                STEP2_CONTROL_IDS.seriesVariantBlockSize,
            ];
        }
        if (category === 'priority-order') {
            return session.strategyOrder.map((key) => this._priorityRowId(key));
        }
        return [STEP2_CONTROL_IDS.maxChannels, STEP2_CONTROL_IDS.minItems, STEP2_CONTROL_IDS.expandLineup];
    }

    private _resolveDetailFocusTarget(category: StrategyCategoryKey, availableIds: string[]): string | null {
        if (availableIds.length === 0) return null;
        const enabledIds = availableIds.filter((id) => this._isDetailControlEnabled(category, id));
        if (enabledIds.length === 0) {
            return null;
        }
        const remembered = this._rememberedDetailFocusByCategory[category];
        if (remembered && enabledIds.includes(remembered)) {
            return remembered;
        }
        return enabledIds[0] ?? null;
    }

    private _isDetailControlEnabled(category: StrategyCategoryKey, controlId: string): boolean {
        const session = this._session.getSnapshot();
        if (category === 'build-options' && controlId === STEP2_CONTROL_IDS.alternateLineupCopies) {
            return session.channelExpansion.addAlternateLineups;
        }
        if (category === 'series-ordering') {
            if (controlId === STEP2_CONTROL_IDS.seriesBaseBlockSize) {
                return session.seriesOrdering.basePlaybackMode === 'block';
            }
            if (controlId === STEP2_CONTROL_IDS.seriesVariantBlockSize) {
                return session.channelExpansion.variantType === 'block';
            }
        }
        return true;
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
        const session = this._session.getSnapshot();
        if (session.isBuilding) {
            this._renderBuildProgress();
        } else {
            this._renderBuildReview();
        }
    }

    private _renderBuildReview(): void {
        const getReviewState = (): BuildReviewStateSnapshot => {
            const session = this._session.getSnapshot();
            return {
                buildMode: session.buildMode,
                review: session.review,
                reviewError: session.reviewError,
                isReviewLoading: session.isReviewLoading,
                replaceConfirm: session.replaceConfirm,
                isBuilding: session.isBuilding,
                recordApplied: session.recordApplied,
            };
        };

        this._buildReviewStep.render({
            contentEl: this._contentEl,
            stepEl: this._stepEl,
            statusEl: this._statusEl,
            detailEl: this._detailEl,
            errorEl: this._errorEl,
        }, {
            state: getReviewState(),
            onBackToStrategy: () => {
                this._session.clearReviewAndReturnToStep2();
                this._renderStep();
            },
            onConfirmBuild: () => {
                this._session.beginConfirmedBuild();
                this._renderStep();
            },
            onToggleReplaceConfirm: (focusId) => {
                this._preferredFocusId = focusId;
                this._session.toggleReplaceConfirm();
                this._renderStep();
            },
            buildPreviewRow: (label, value, key) => this._buildPreviewRow(label, value, key),
            renderCappedWarnings: (warnings, container) => {
                renderCappedWarnings({
                    warnings,
                    container,
                    maxItems: this._maxPreviewWarnings,
                    itemClassName: 'setup-preview-warning',
                });
            },
            registerLinearFocusables: (buttons) => {
                const preferredApplied = this._focus.registerLinear(buttons, this._preferredFocusId);
                if (preferredApplied) {
                    this._preferredFocusId = null;
                }
            },
        });

        this._kickOffReviewLoadPostRender();
    }

    private _kickOffReviewLoadPostRender(): void {
        const session = this._session.getSnapshot();
        if (
            session.step !== 3 ||
            !session.recordApplied ||
            session.isBuilding ||
            session.review ||
            session.isReviewLoading ||
            session.reviewError
        ) {
            return;
        }

        const token = this._visibilityToken;
        void Promise.resolve()
            .then(() => {
                const current = this._session.getSnapshot();
                if (
                    token !== this._visibilityToken ||
                    current.step !== 3 ||
                    current.isBuilding ||
                    current.review ||
                    current.isReviewLoading ||
                    current.reviewError
                ) {
                    return;
                }
                return this._session.ensureReviewLoaded(() => this._renderStep());
            })
            .catch((error: unknown) => {
                if (isAbortLikeError(error)) return;
                console.warn('Load review failed:', summarizeErrorForLog(error));
            });
    }

    private _renderBuildProgress(): void {
        const session = this._session.getSnapshot();
        this._buildProgressStep.render({
            contentEl: this._contentEl,
            stepEl: this._stepEl,
            statusEl: this._statusEl,
            detailEl: this._detailEl,
            errorEl: this._errorEl,
        }, {
            state: { isBuilding: session.isBuilding },
            registerLinearFocusables: (buttons) => {
                const preferredApplied = this._focus.registerLinear(buttons, this._preferredFocusId);
                if (preferredApplied) {
                    this._preferredFocusId = null;
                }
            },
            onCancelOrBack: (button) => {
                if (this._session.cancelBuild()) {
                    button.disabled = true;
                    button.textContent = 'Canceling...';
                    return;
                }
                this._session.setStep(2);
                this._renderStep();
            },
            onDone: () => {
                const nav = this._screenPorts.getNavigation();
                if (nav) {
                    nav.replaceScreen('player');
                }
                this._screenPorts.switchToChannelByNumber(1)
                    .then(() => this._screenPorts.openEPG())
                    .catch((error: unknown) => {
                        if (isAbortLikeError(error)) return;
                        console.warn('Switch to channel 1 failed:', summarizeErrorForLog(error));
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

    private _applyBuildBlockedUI(
        cancelButton: HTMLButtonElement,
        doneButton: HTMLButtonElement,
        barFill: HTMLElement,
        taskLabel: HTMLElement,
        detailLabel: HTMLElement,
        message: string
    ): void {
        this._statusEl.textContent = 'Action required';
        this._detailEl.textContent = 'No changes were applied.';
        this._errorEl.textContent = message;
        taskLabel.textContent = 'Plan blocked';
        detailLabel.textContent = 'Review the warning and adjust setup before retrying.';
        barFill.style.width = '0%';
        barFill.classList.remove('indeterminate');

        cancelButton.disabled = false;
        cancelButton.textContent = 'Back';
        doneButton.disabled = true;
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
        const outcome = await this._session.beginBuild({
            onProgress: (p: ChannelBuildProgress): void => {
                if (token !== this._visibilityToken) {
                    return;
                }
                taskLabel.textContent = p.label;
                detailLabel.textContent = p.detail;

                if (p.total !== null && p.total > 0) {
                    const percent = Math.min(100, (p.current / p.total) * 100);
                    barFill.style.width = `${percent}%`;
                    barFill.classList.remove('indeterminate');
                } else {
                    barFill.style.width = '';
                    barFill.classList.add('indeterminate');
                }
            },
            onStateChange: () => {
                // State changes are reflected through subsequent step renders.
            },
        });

        if (token !== this._visibilityToken) {
            return;
        }

        if (outcome.kind === 'missing-server') {
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

        if (outcome.kind === 'blocked') {
            this._applyBuildBlockedUI(cancelButton, doneButton, barFill, taskLabel, detailLabel, outcome.message);
            return;
        }

        if (outcome.kind === 'canceled') {
            this._applyBuildCanceledUI(cancelButton, doneButton, barFill, taskLabel, detailLabel, { disableDone: true });
            return;
        }

        if (outcome.kind === 'error') {
            this._errorEl.textContent = outcome.message;
            this._statusEl.textContent = 'Error';
            taskLabel.textContent = 'Error';
            detailLabel.textContent = '';
            barFill.style.width = '0%';
            barFill.classList.remove('indeterminate');
            cancelButton.disabled = false;
            cancelButton.textContent = 'Back';
            return;
        }

        this._statusEl.textContent = 'Channels ready.';
        taskLabel.textContent = 'Complete';
        detailLabel.textContent = `Created ${outcome.result.created} channels. Skipped ${outcome.result.skipped}.`;
        barFill.style.width = '100%';
        barFill.classList.remove('indeterminate');
        this._errorEl.textContent = outcome.bookkeepingError
            ? `Channels were created, but setup completion could not be saved: ${outcome.bookkeepingError}`
            : '';

        cancelButton.disabled = false;
        doneButton.disabled = outcome.result.created === 0;
        cancelButton.textContent = 'Back';

        if (outcome.result.created === 0) {
            this._detailEl.textContent = 'No channels created.';
        }
        this._focus.unregisterAll();
        const preferredApplied = this._focus.registerLinear([doneButton, cancelButton], this._preferredFocusId);
        if (preferredApplied) {
            this._preferredFocusId = null;
        }

        const nav = this._screenPorts.getNavigation();
        if (nav && !doneButton.disabled) {
            nav.setFocus(doneButton.id);
        } else {
            nav?.setFocus(cancelButton.id);
        }
    }

    private _buildPreviewRow(label: string, value: number | string, deltaKey?: EstimateKey): HTMLElement {
        const session = this._session.getSnapshot();
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
        const delta = deltaKey ? session.previewDeltas[deltaKey] : undefined;
        if (typeof value === 'number' && typeof delta === 'number' && now <= session.previewDeltaExpiresAtMs) {
            const deltaEl = document.createElement('span');
            deltaEl.className = `setup-preview-delta ${delta > 0 ? 'positive' : 'negative'}`;
            deltaEl.textContent = `(${delta > 0 ? '+' : ''}${delta})`;
            valueEl.appendChild(deltaEl);
        }

        row.appendChild(labelEl);
        row.appendChild(valueEl);
        return row;
    }

    private _getSelectedServerId(): string | null {
        const stored = this._serverSelectionStore.readSelectedServerIdAndClean();
        if (stored) {
            return stored;
        }
        return this._screenPorts.getSelectedServerId();
    }
}
