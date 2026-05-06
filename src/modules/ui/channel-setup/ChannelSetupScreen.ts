/** Channel setup wizard screen. */

import {
    type ChannelSetupConfig,
} from '../../../core/channel-setup/types';
import type { FocusableElement, KeyEvent } from '../../navigation';
import { isAbortLikeError, summarizeErrorForLog } from '../../../utils/errors';
import { createScreenShell } from '../common/ScreenShell';
import { ChannelSetupFocusCoordinator } from './focus/ChannelSetupFocusCoordinator';
import { ChannelSetupDropdownController } from './ChannelSetupDropdownController';
import { LibraryStepController } from './steps/LibraryStepController';
import { scrollToNearest } from './focus/scrollToNearest';
import { ChannelSetupSessionController } from './ChannelSetupSessionController';
import type { ChannelSetupScreenPorts, ChannelSetupScreenWorkflowPort } from './ChannelSetupScreenPorts';
import { ChannelSetupWorkflowPresenter } from './ChannelSetupWorkflowPresenter';

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
    private readonly _focus: ChannelSetupFocusCoordinator;
    private _destroyScreenShell: (() => void) | null = null;
    private readonly _libraryStep = new LibraryStepController();
    private readonly _dropdown = new ChannelSetupDropdownController();
    private _stepEl: HTMLElement;
    private _statusEl: HTMLElement;
    private _detailEl: HTMLElement;
    private _errorEl: HTMLElement;
    private _contentEl: HTMLElement;
    private readonly _session: ChannelSetupSessionController;
    private readonly _workflowPresenter: ChannelSetupWorkflowPresenter;
    private _preferredFocusId: string | null = null;
    private _visibilityToken = 0;
    private _navKeyHandler: ((event: KeyEvent) => void) | null = null;
    private _previewPanelId = 'setup-preview-panel';

    private _toDomId(raw: string): string {
        return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    private _resetStepUi(statusText: string): void {
        this._dropdown.reset();
        this._workflowPresenter.clearStrategyStepTransientState();
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
        deps: { workflowPort: ChannelSetupScreenWorkflowPort; screenPorts: ChannelSetupScreenPorts }
    ) {
        this._container = container;
        this._screenPorts = deps.screenPorts;
        this._focus = new ChannelSetupFocusCoordinator({
            getNavigation: (): ReturnType<ChannelSetupScreenPorts['getNavigation']> => this._screenPorts.getNavigation(),
        });
        this._session = new ChannelSetupSessionController({
            workflowPort: deps.workflowPort,
            getSelectedServerId: (): string | null => this._getSelectedServerId(),
        });

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

        this._workflowPresenter = new ChannelSetupWorkflowPresenter({
            session: this._session,
            focus: this._focus,
            dropdown: this._dropdown,
            screenPorts: this._screenPorts,
            contentEl: this._contentEl,
            previewPanelId: this._previewPanelId,
            getPreferredFocusId: (): string | null => this._preferredFocusId,
            setPreferredFocusId: (focusId): void => {
                this._preferredFocusId = focusId;
            },
            getVisibilityToken: (): number => this._visibilityToken,
            renderStep: (): void => {
                this._renderStep();
            },
            toDomId: (raw): string => this._toDomId(raw),
        });
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
                this._workflowPresenter.handleStrategyKeyPress(event, nav);
            };
            nav.on('keyPress', this._navKeyHandler);
        }
        this._session.beginSession();
        this._workflowPresenter.resetStrategyInteraction();
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
        if (this._dropdown.hasActiveDropdown()) {
            this._dropdown.deferRender();
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
        this._workflowPresenter.renderStrategyStep({
            contentEl: this._contentEl,
            stepEl: this._stepEl,
            statusEl: this._statusEl,
            detailEl: this._detailEl,
            errorEl: this._errorEl,
        });
    }

    private _renderBuildStep(): void {
        this._workflowPresenter.renderBuildStep({
            contentEl: this._contentEl,
            stepEl: this._stepEl,
            statusEl: this._statusEl,
            detailEl: this._detailEl,
            errorEl: this._errorEl,
        });
    }

    private _getSelectedServerId(): string | null {
        return this._screenPorts.getSelectedServerId();
    }
}
