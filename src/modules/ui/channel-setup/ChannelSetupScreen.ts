/** Channel setup wizard screen. */

import {
    type ChannelSetupConfig,
} from '../../../core/channel-setup/types';
import type { KeyEvent } from '../../navigation';
import { isAbortLikeError, summarizeErrorForLog } from '../../../utils/errors';
import { createScreenShell } from '../common/ScreenShell';
import { ChannelSetupFocusCoordinator } from './focus/ChannelSetupFocusCoordinator';
import { ChannelSetupDropdownController } from './ChannelSetupDropdownController';
import { LibraryStepPresenter } from './steps/LibraryStepPresenter';
import { ChannelSetupSessionController } from './ChannelSetupSessionController';
import type { ChannelSetupScreenPorts, ChannelSetupScreenWorkflowPort } from './ChannelSetupScreenPorts';
import { ChannelSetupWorkflowPresenter } from './ChannelSetupWorkflowPresenter';
import type { StepRenderContext } from './stepContracts';

export class ChannelSetupScreen {
    private _container: HTMLElement;
    private _screenPorts: ChannelSetupScreenPorts;
    private readonly _focus: ChannelSetupFocusCoordinator;
    private _destroyScreenShell: (() => void) | null = null;
    private readonly _libraryStepPresenter: LibraryStepPresenter;
    private readonly _dropdown = new ChannelSetupDropdownController();
    private _stepEl: HTMLElement;
    private _statusEl: HTMLElement;
    private _detailEl: HTMLElement;
    private _errorEl: HTMLElement;
    private _contentEl: HTMLElement;
    private _panelEl: HTMLElement;
    private readonly _session: ChannelSetupSessionController;
    private readonly _workflowPresenter: ChannelSetupWorkflowPresenter;
    private _preferredFocusId: string | null = null;
    private _visibilityToken = 0;
    private _navKeyHandler: ((event: KeyEvent) => void) | null = null;
    private _previewPanelId = 'setup-preview-panel';

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
        this._panelEl = shell.panelEl;

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
            resetStep2Scroll: (): void => {
                this._resetStep2ScrollContainers();
            },
            toDomId: (raw): string => raw.replace(/[^a-zA-Z0-9_-]/g, '_'),
        });
        this._libraryStepPresenter = new LibraryStepPresenter({
            session: this._session,
            focus: this._focus,
            screenPorts: this._screenPorts,
            contentEl: this._contentEl,
            getPreferredFocusId: (): string | null => this._preferredFocusId,
            setPreferredFocusId: (focusId): void => {
                this._preferredFocusId = focusId;
            },
            renderStep: (): void => {
                this._renderStep();
            },
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
        this._libraryStepPresenter.render(this._buildStepRenderContext());
    }

    private _renderStrategyStep(): void {
        this._workflowPresenter.renderStrategyStep(this._buildStepRenderContext());
    }

    private _resetStep2ScrollContainers(): void {
        this._panelEl.scrollTop = 0;
        this._panelEl.scrollLeft = 0;

        for (const selector of ['.setup-detail-scroll', '.setup-category-rail']) {
            const scrollContainer = this._contentEl.querySelector<HTMLElement>(selector);
            if (!scrollContainer) continue;
            scrollContainer.scrollTop = 0;
            scrollContainer.scrollLeft = 0;
        }
    }

    private _renderBuildStep(): void {
        this._workflowPresenter.renderBuildStep(this._buildStepRenderContext());
    }

    private _buildStepRenderContext(): StepRenderContext {
        return {
            contentEl: this._contentEl,
            stepEl: this._stepEl,
            statusEl: this._statusEl,
            detailEl: this._detailEl,
            errorEl: this._errorEl,
        };
    }

    private _getSelectedServerId(): string | null {
        return this._screenPorts.getSelectedServerId();
    }
}
