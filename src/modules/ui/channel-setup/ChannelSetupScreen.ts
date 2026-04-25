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
import { StrategyStepInteractionController } from './steps/StrategyStepInteractionController';
import { BuildReviewStepController } from './steps/BuildReviewStepController';
import { BuildProgressStepController } from './steps/BuildProgressStepController';
import type { BuildReviewStateSnapshot, StrategyStepDropdownConfig } from './steps/types';
import type { SetupStrategyKey } from './steps/constants';
import { scrollToNearest } from './focus/scrollToNearest';
import { ChannelSetupSessionController } from './ChannelSetupSessionController';
import { strategySupportsMixedScope } from './ChannelSetupSessionState';
import type {
    ChannelSetupSessionSnapshot,
    EstimateKey,
    StrategyStepMutableState,
} from './ChannelSetupSessionContracts';
import type { ChannelSetupWorkflowPort } from '../../../core/channel-setup/workflow/ChannelSetupWorkflowPort';
import type { ChannelSetupScreenPorts } from './ChannelSetupScreenPorts';

const CHANNEL_LIMIT_PRESETS = [50, 100, 150, 200, 300, 400, 500];

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
    private readonly _strategyInteraction: StrategyStepInteractionController;
    private _channelLimitOptions: number[] = CHANNEL_LIMIT_PRESETS.filter((value) => value <= MAX_CHANNELS);
    private _minItemsOptions: number[] = [1, 5, 10, 20, 50];
    private _preferredFocusId: string | null = null;
    private _visibilityToken = 0;
    private _navKeyHandler: ((event: KeyEvent) => void) | null = null;
    private _activeDropdown: { destroy: () => void; dismiss: () => void } | null = null;
    private _pendingDropdownDeferredRender = false;
    private _previewPanelId = 'setup-preview-panel';
    private _maxPreviewWarnings = 5;

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

    private _setPriorityRowGrabbedVisual(strategy: SetupStrategyKey | null, grabbed: boolean): void {
        if (!strategy) return;
        const el = document.getElementById(this._strategyInteraction.priorityRowId(strategy));
        el?.classList.toggle('setup-priority-row--grabbed', grabbed);
        el?.setAttribute('aria-grabbed', grabbed ? 'true' : 'false');
    }

    private _clearStrategyStepTransientState(): void {
        this._strategyInteraction.clearTransientState((strategy, grabbed) => {
            this._setPriorityRowGrabbedVisual(strategy, grabbed);
        });
    }

    private _resetStepUi(statusText: string): void {
        this._closeDropdown();
        this._clearStrategyStepTransientState();
        this._pendingDropdownDeferredRender = false;
        this._preferredFocusId = null;
        this._contentEl.replaceChildren();
        this._stepEl.textContent = '';
        this._statusEl.textContent = statusText;
        this._detailEl.textContent = '';
        this._errorEl.textContent = '';
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
        this._strategyInteraction = new StrategyStepInteractionController({
            strategySupportsMixedScope,
            toDomId: (raw): string => this._toDomId(raw),
        });

        if (!this._channelLimitOptions.includes(DEFAULT_CHANNEL_SETUP_MAX)) {
            this._channelLimitOptions.push(DEFAULT_CHANNEL_SETUP_MAX);
            this._channelLimitOptions.sort((a, b) => a - b);
        }

        this._container.classList.add('screen');

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
        this._resetStepUi('Loading libraries...');
        this._container.style.display = 'flex';
        this._container.classList.add('visible');
        const nav = this._screenPorts.getNavigation();
        if (nav && !this._navKeyHandler) {
            this._navKeyHandler = (event: KeyEvent): void => {
                const session = this._session.getSnapshot();
                if (event.handled || session.step !== 2) return;
                this._strategyInteraction.handleKeyPress(event, nav, this._createStrategyInteractionAdapters());
            };
            nav.on('keyPress', this._navKeyHandler);
        }
        this._session.beginSession();
        this._strategyInteraction.reset();
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
        this._resetStepUi('');
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

    private _createStrategyInteractionAdapters(): Parameters<StrategyStepInteractionController['handleKeyPress']>[2] {
        return {
            channelLimitOptions: this._channelLimitOptions,
            deferDropdownRender: (): void => {
                this._pendingDropdownDeferredRender = true;
            },
            dismissDropdown: (): void => {
                this._dismissDropdown();
            },
            getPreferredFocusId: (): string | null => this._preferredFocusId,
            getSessionSnapshot: (): ChannelSetupSessionSnapshot => this._session.getSnapshot(),
            hasActiveDropdown: (): boolean => this._activeDropdown !== null,
            minItemsOptions: this._minItemsOptions,
            openDropdown: (config: StrategyStepDropdownConfig): void => {
                this._openStep2Dropdown(config);
            },
            registerStep2: (
                categoryButtons: HTMLButtonElement[],
                detailButtons: HTMLButtonElement[],
                footerButtons: [HTMLButtonElement, HTMLButtonElement],
                activeCategoryButtonId: string,
                detailFocusTarget: string | null,
                preferredFocusId: string | null,
                rememberDetailFocus: (id: string) => void
            ): boolean => this._focus.registerStep2(
                categoryButtons,
                detailButtons,
                footerButtons,
                activeCategoryButtonId,
                detailFocusTarget,
                preferredFocusId,
                rememberDetailFocus
            ),
            renderStep: (): void => {
                this._renderStep();
            },
            schedulePreview: (): void => {
                this._session.schedulePreview(() => this._renderStep());
            },
            setPreferredFocusId: (focusId: string | null): void => {
                this._preferredFocusId = focusId;
            },
            setPriorityRowGrabbedVisual: (strategy: SetupStrategyKey | null, grabbed: boolean): void => {
                this._setPriorityRowGrabbedVisual(strategy, grabbed);
            },
            stepPreset: (
                options: number[],
                current: number,
                dir: 'left' | 'right',
                mode: 'clamp' | 'wrap'
            ): number => this._stepPreset(options, current, dir, mode),
            updatePriorityRowState: (rowId: string, enabled: boolean): boolean =>
                this._strategyStep.updatePriorityRowState(this._contentEl, rowId, enabled) !== null,
            updateStrategyState: (mutate: (draft: StrategyStepMutableState) => void): void => {
                this._session.updateStrategyState(mutate);
            },
        };
    }

    private _renderStrategyStep(): void {
        this._session.syncSetupContext();
        const session = this._session.getSnapshot();
        const strategyInteraction = this._createStrategyInteractionAdapters();
        this._strategyStep.render({
            contentEl: this._contentEl,
            stepEl: this._stepEl,
            statusEl: this._statusEl,
            detailEl: this._detailEl,
            errorEl: this._errorEl,
        }, {
            state: {
                activeStrategyCategory: this._strategyInteraction.getActiveStrategyCategory(),
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
            strategyKeys: SETUP_STRATEGY_KEYS,
            categoryButtonId: (category) => this._strategyInteraction.categoryButtonId(category),
            strategyButtonId: (strategy) => this._strategyInteraction.strategyButtonId(strategy),
            priorityRowId: (strategy) => this._strategyInteraction.priorityRowId(strategy),
            lastReorder: this._strategyInteraction.getLastReorder(),
            scopeButtonId: (strategy) => this._strategyInteraction.scopeButtonId(strategy),
            strategySupportsMixedScope,
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
                this._strategyInteraction.applyCategoryChange(category, focusId, strategyInteraction);
            },
            applySettingChange: (focusId, mutate) => {
                this._strategyInteraction.applySettingChange(focusId, mutate, strategyInteraction);
            },
            openAdjustableControl: (controlId) => {
                this._strategyInteraction.openAdjustableControl(controlId, strategyInteraction);
            },
            onBack: () => {
                this._clearStrategyStepTransientState();
                this._session.setStep(1);
                this._renderStep();
            },
            onNext: () => {
                this._clearStrategyStepTransientState();
                this._session.setStep(3);
                this._renderStep();
            },
            registerStep2Focusables: (categoryButtons, detailButtons, backButton, nextButton) => {
                this._strategyInteraction.registerStep2Focusables(
                    categoryButtons,
                    detailButtons,
                    backButton,
                    nextButton,
                    strategyInteraction
                );
            },
            detailText: session.strategies.genres.enabled || session.strategies.directors.enabled
                ? 'Performance warning: may be slow on large libraries.'
                : '',
            schedulePreview: () => strategyInteraction.schedulePreview(),
        });
        this._setPriorityRowGrabbedVisual(this._strategyInteraction.getGrabbedPriorityKey(), true);
    }

    private _openStep2Dropdown(config: StrategyStepDropdownConfig): void {
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
