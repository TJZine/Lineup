import type { PlexServer } from '../../plex/discovery/types';
import type { ServerSelectScreenNavigationPort } from '../../navigation';
import { buildDeterministicButtonIds } from '../../../utils/domIds';
import { createScreenShell } from '../common/ScreenShell';
import { createLineupBrandGlyph } from '../common/brandGlyph';
import type { ScreenStatus, ScreenTone } from '../types/screen-shell';
import {
    renderServerSelectList,
    type ServerSelectEmptyStateReason,
} from './ServerSelectListView';
import {
    ServerSelectFocusCoordinator,
    type ServerSelectStaticButtons,
} from './ServerSelectFocusCoordinator';
import {
    ServerSelectRuntimeCoordinator,
    type ServerSelectRuntimeScreenAdapter,
} from './ServerSelectRuntimeCoordinator';
import { ServerSelectStatusPolicy } from './ServerSelectStatusPolicy';
import type {
    ServerSelectDisplayState,
    ServerSelectScreenPorts,
} from './types';

export type {
    ServerSelectSelectionFailureReason,
    ServerSelectSelectionResult,
} from './types';

export type { ServerSelectScreenPorts } from './types';

export class ServerSelectScreen implements ServerSelectRuntimeScreenAdapter {
    private _container: HTMLElement;
    private _ports: ServerSelectScreenPorts;
    private _destroyScreenShell: (() => void) | null = null;
    private _shellSetStatus: ((status: ScreenStatus | null) => void) | null = null;
    private _autoConnectHintEl: HTMLElement;
    private _statusEl: HTMLElement;
    private _detailEl: HTMLElement;
    private _errorEl: HTMLElement;
    private _listEl: HTMLElement;
    private _refreshButton: HTMLButtonElement;
    private _setupButton: HTMLButtonElement;
    private _switchProfileButton: HTMLButtonElement;
    private _clearButton: HTMLButtonElement;
    private _statusPolicy = new ServerSelectStatusPolicy();
    private _focusCoordinator = new ServerSelectFocusCoordinator();
    private _runtime: ServerSelectRuntimeCoordinator;

    constructor(container: HTMLElement, ports: ServerSelectScreenPorts) {
        this._container = container;
        this._ports = ports;
        this._container.classList.add('screen');

        const heroGlyph = createLineupBrandGlyph({
            variant: 'color',
            className: 'server-select-glyph',
        });

        const shell = createScreenShell(this._container, {
            title: 'Select Plex Server',
            subtitle: 'Choose a server to continue startup.',
            heroSlot: heroGlyph,
            status: {
                title: 'Ready to discover servers.',
                tone: 'neutral',
            },
            error: null,
            actions: [
                {
                    id: 'btn-server-refresh',
                    label: 'Retry discovery',
                    variant: 'primary',
                    onSelect: (): void => {
                        void this.refresh();
                    },
                },
                {
                    id: 'btn-server-setup',
                    label: 'Re-run Setup',
                    variant: 'secondary',
                    onSelect: (): void => {
                        this.clearError();
                        this._ports.requestChannelSetupRerun();
                    },
                },
                {
                    id: 'btn-server-switch-profile',
                    label: 'Switch Profile',
                    variant: 'secondary',
                    onSelect: (): void => {
                        const nav = this._ports.getNavigation();
                        nav?.replaceScreen('profile-select');
                    },
                },
                {
                    id: 'btn-server-forget',
                    label: 'Clear Saved Server',
                    variant: 'secondary',
                    onSelect: (): void => {
                        this._runtime.handleClearSelection();
                    },
                },
            ],
        });
        this._destroyScreenShell = shell.destroy;
        this._shellSetStatus = shell.setStatus;

        this._statusEl = shell.statusEl;
        this._detailEl = shell.detailEl;
        this._errorEl = shell.errorEl;

        const autoConnectHint = document.createElement('div');
        autoConnectHint.className = 'server-autoconnect-hint';
        autoConnectHint.setAttribute('aria-live', 'polite');
        autoConnectHint.setAttribute('hidden', 'true');

        const autoConnectBadge = document.createElement('span');
        autoConnectBadge.className = 'server-autoconnect-badge';
        autoConnectBadge.textContent = 'AUTO-CONNECT';
        autoConnectHint.appendChild(autoConnectBadge);

        const autoConnectText = document.createElement('span');
        autoConnectText.className = 'server-autoconnect-text';
        autoConnectText.textContent = 'Trying your saved server first.';
        autoConnectHint.appendChild(autoConnectText);

        shell.contentEl.insertBefore(autoConnectHint, this._statusEl);
        this._autoConnectHintEl = autoConnectHint;

        const refreshButton = shell.actionsEl.querySelector('#btn-server-refresh');
        const setupButton = shell.actionsEl.querySelector('#btn-server-setup');
        const switchProfileButton = shell.actionsEl.querySelector('#btn-server-switch-profile');
        const clearButton = shell.actionsEl.querySelector('#btn-server-forget');
        if (
            !(refreshButton instanceof HTMLButtonElement)
            || !(setupButton instanceof HTMLButtonElement)
            || !(switchProfileButton instanceof HTMLButtonElement)
            || !(clearButton instanceof HTMLButtonElement)
        ) {
            throw new Error('ServerSelectScreen shell actions unavailable');
        }
        this._refreshButton = refreshButton;
        this._setupButton = setupButton;
        this._switchProfileButton = switchProfileButton;
        this._clearButton = clearButton;

        const list = document.createElement('div');
        list.className = 'server-list';
        shell.panelEl.appendChild(list);
        this._listEl = list;

        this._runtime = new ServerSelectRuntimeCoordinator({
            ports,
            adapter: this,
            statusPolicy: this._statusPolicy,
            hasPendingFocusRestore: (generation: number): boolean => this._focusCoordinator.hasPendingRestoreFocus(generation),
        });
    }

    destroy(): void {
        this._runtime.destroy();
        this._focusCoordinator.destroy();
        this._destroyScreenShell?.();
        this._destroyScreenShell = null;
    }

    async whenIdle(): Promise<void> {
        return this._runtime.whenIdle();
    }

    show(options?: { allowAutoConnect?: boolean }): void {
        this._runtime.show(options);
    }

    hide(): void {
        this._runtime.hide();
    }

    async refresh(): Promise<void> {
        await this._runtime.refresh();
    }

    showContainer(): void {
        this._container.style.display = 'flex';
        this._container.classList.add('visible');
    }

    hideContainer(): void {
        this._container.style.display = 'none';
        this._container.classList.remove('visible');
    }

    isContainerVisible(): boolean {
        return this._container.classList.contains('visible');
    }

    getNavigation(): ServerSelectScreenNavigationPort | null {
        return this._ports.getNavigation();
    }

    registerFocusables(): void {
        this._focusCoordinator.registerFocusables(this.getNavigation(), this._getStaticButtons());
    }

    unregisterFocusables(): void {
        this._focusCoordinator.unregisterFocusables(this.getNavigation());
    }

    restoreFocus(generation: number): void {
        this._focusCoordinator.restoreFocus({
            nav: this.getNavigation(),
            generation,
            canUpdateUi: () => this.isContainerVisible(),
            onPending: () => {
                this._runtime.markFocusRestorePending();
            },
            onSettled: () => {
                this._runtime.notifyFocusRestoreSettled();
            },
        });
    }

    cancelRestoreFocus(): void {
        this._focusCoordinator.cancelRestoreFocus();
    }

    unregisterServerListFocusables(): void {
        this._focusCoordinator.unregisterServerListFocusables(this.getNavigation());
    }

    replaceServerListChildren(): void {
        this._listEl.replaceChildren();
    }

    renderServers(
        servers: PlexServer[],
        screenState: ServerSelectDisplayState,
        options?: { savedServerUnavailable?: boolean; emptyStateReason?: ServerSelectEmptyStateReason }
    ): void {
        this.unregisterServerListFocusables();
        const result = renderServerSelectList(this._listEl, servers, screenState, {
            savedServerUnavailable: options?.savedServerUnavailable,
            emptyStateReason: options?.emptyStateReason,
            isSelecting: this._runtime.isSelecting,
            buildServerMeta: (server, healthMap) => this._statusPolicy.buildServerMeta(server, healthMap),
            buildServerButtonIds: (serverIds) => this._buildServerButtonIds(serverIds),
            onSelectServer: (server) => this._runtime.selectServer(server),
        });

        if (!result.hasServerRows) {
            this._focusCoordinator.updateStaticButtonNeighbors(this.getNavigation(), this._getStaticButtons(), null);
            return;
        }

        this._focusCoordinator.registerServerButtonFocusables(
            this.getNavigation(),
            this._getStaticButtons(),
            result.enabledServerButtons
        );
    }

    setServerConnectButtonsDisabled(disabled: boolean): void {
        const buttons = Array.from(this._listEl.querySelectorAll<HTMLButtonElement>('.server-actions button'));
        for (const button of buttons) {
            button.disabled = disabled;
        }

        if (disabled) {
            this.unregisterServerListFocusables();
            if (this.isContainerVisible()) {
                this._focusCoordinator.updateStaticButtonNeighbors(this.getNavigation(), this._getStaticButtons(), null);
            }
            return;
        }

        if (!this.isContainerVisible()) {
            return;
        }

        this._focusCoordinator.registerServerButtonFocusables(
            this.getNavigation(),
            this._getStaticButtons(),
            buttons
        );
    }

    setControlsDisabled(disabled: boolean): void {
        this._refreshButton.disabled = disabled;
        this._setupButton.disabled = disabled;
        this._switchProfileButton.disabled = disabled;
        this._clearButton.disabled = disabled;
    }

    setClearButtonDisabled(disabled: boolean, generation: number): void {
        void generation;
        if (!this.isContainerVisible()) {
            return;
        }

        this._clearButton.disabled = disabled;
    }

    setAutoConnectHintVisible(visible: boolean): void {
        if (visible) {
            this._autoConnectHintEl.classList.add('visible');
            this._autoConnectHintEl.removeAttribute('hidden');
            return;
        }
        this._autoConnectHintEl.classList.remove('visible');
        this._autoConnectHintEl.setAttribute('hidden', 'true');
    }

    setStatus(status: string, detail: string, tone: ScreenTone = 'neutral'): void {
        if (this._shellSetStatus) {
            if (status.length === 0) {
                this._shellSetStatus(null);
                return;
            }
            this._shellSetStatus({ title: status, detail, tone });
            return;
        }
        this._statusEl.textContent = status;
        this._detailEl.textContent = detail;
    }

    clearError(): void {
        this._errorEl.textContent = '';
    }

    setError(message: string): void {
        this._errorEl.textContent = message;
    }

    setDetail(text: string): void {
        this._detailEl.textContent = text;
    }

    addStatusSpinner(): void {
        this._statusEl.classList.add('panel-spinner');
    }

    removeStatusSpinner(): void {
        this._statusEl.classList.remove('panel-spinner');
    }

    private _getStaticButtons(): ServerSelectStaticButtons {
        return {
            refreshButton: this._refreshButton,
            setupButton: this._setupButton,
            switchProfileButton: this._switchProfileButton,
            clearButton: this._clearButton,
        };
    }

    private _buildServerButtonIds(serverIds: string[]): string[] {
        return buildDeterministicButtonIds('btn-server-select-', serverIds);
    }
}
