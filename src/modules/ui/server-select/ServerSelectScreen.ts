/**
 * @fileoverview Minimal server selection screen for Plex discovery.
 * @module modules/ui/server-select/ServerSelectScreen
 * @version 1.0.0
 */

import type { PlexServer } from '../../plex/discovery/types';
import { PlexApiError } from '../../plex/auth';
import type { OrchestratorServerSelectionResult } from '../../../core/server-selection/ServerSelectionTypes';
import type {
    FocusableElement,
    ServerSelectScreenNavigationPort,
} from '../../navigation';
import { ServerSelectionStore, type ServerHealthMap } from '../../plex/discovery/ServerSelectionStore';
import { summarizeErrorForLog } from '../../../utils/errors';
import { buildDeterministicButtonIds } from '../../../utils/domIds';
import { createScreenShell } from '../common/ScreenShell';
import { createLineupBrandGlyph } from '../common/brandGlyph';
import type { ScreenStatus, ScreenTone } from '../types/screen-shell';

const FOCUS_RESTORE_DELAY_MS = 50;

export interface ServerSelectScreenPorts {
    discoverServers(forceRefresh?: boolean): Promise<PlexServer[]>;
    selectServer(serverId: string): Promise<OrchestratorServerSelectionResult>;
    clearSelectedServer(): Promise<void>;
    getSelectedServerStorageKey(): string;
    getServerHealthStorageKey(): string;
    requestChannelSetupRerun(): void;
    getNavigation(): ServerSelectScreenNavigationPort | null;
}

export class ServerSelectScreen {
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
    private _isLoading: boolean = false;
    private _restoreFocusTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private _registeredServerButtonIds: string[] = [];
    private _lastDiscoveredServers: PlexServer[] = [];
    private _serverSelectionStore: ServerSelectionStore;

    constructor(container: HTMLElement, ports: ServerSelectScreenPorts) {
        this._container = container;
        this._ports = ports;
        this._serverSelectionStore = new ServerSelectionStore(() => ({
            selectedServerKey: this._ports.getSelectedServerStorageKey(),
            serverHealthKey: this._ports.getServerHealthStorageKey(),
        }));
        this._container.classList.add('screen');
        this._container.style.position = 'absolute';
        this._container.style.inset = '0';
        this._container.style.display = 'none';
        this._container.style.alignItems = 'center';
        this._container.style.justifyContent = 'center';

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
                        this.refresh().catch((error: unknown) => {
                            console.error('[ServerSelect] Refresh failed:', summarizeErrorForLog(error));
                        });
                    },
                },
                {
                    id: 'btn-server-setup',
                    label: 'Re-run Setup',
                    variant: 'secondary',
                    onSelect: (): void => {
                        this._clearError();
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
                        this._handleClearSelection();
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

        // Note: We cache action button references. If ScreenShell actions are ever re-rendered via shell.setActions(),
        // these references must be re-queried.
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
    }

    destroy(): void {
        this.hide();
        if (this._restoreFocusTimeoutId !== null) {
            clearTimeout(this._restoreFocusTimeoutId);
            this._restoreFocusTimeoutId = null;
        }
        this._destroyScreenShell?.();
        this._destroyScreenShell = null;
    }

    show(options?: { allowAutoConnect?: boolean }): void {
        this._container.style.display = 'flex';
        this._container.classList.add('visible');
        this._clearError();
        this._setStatus('', '');
        this._registerFocusables();
        // Manual server-select entry should not reconnect implicitly unless explicitly requested.
        const allowAutoConnect = options?.allowAutoConnect === true;
        this._loadServers({ autoSelect: allowAutoConnect, forceRefresh: false }).catch((error: unknown) => {
            console.error('[ServerSelect] Load servers failed:', summarizeErrorForLog(error));
        });
    }

    private async _loadServers(options: { autoSelect: boolean; forceRefresh: boolean }): Promise<void> {
        if (this._isLoading) return;
        this._isLoading = true;
        this._unregisterServerListFocusables();
        this._listEl.replaceChildren();
        const savedId = this._serverSelectionStore.readSelectedServerId();
        const isAutoConnectAttempt = options.autoSelect && Boolean(savedId);
        this._setAutoConnectHintVisible(isAutoConnectAttempt);
        this._setStatus(
            isAutoConnectAttempt ? 'Reconnecting to saved server…' : 'Discovering servers…',
            isAutoConnectAttempt ? 'If that fails, choose any server below.' : '',
            'loading'
        );
        this._statusEl.classList.add('panel-spinner');

        // Disable controls
        this._refreshButton.disabled = true;
        this._setupButton.disabled = true;
        this._switchProfileButton.disabled = true;
        this._clearButton.disabled = true;

        try {
            const servers = await this._ports.discoverServers(options.forceRefresh);
            this._lastDiscoveredServers = servers.slice();
            this._statusEl.classList.remove('panel-spinner');
            let autoSelectError: unknown | null = null;
            let savedServerUnavailable = false;

            if (options.autoSelect) {
                if (savedId && servers.some(s => s.id === savedId)) {
                    try {
                        const result = await this._ports.selectServer(savedId);
                        if (result.kind === 'selected') {
                            this._setStatus('Connected…', 'Continuing startup…', 'success');
                            return;
                        }
                        savedServerUnavailable = true;
                        autoSelectError = new Error(this._selectionFailureMessage(result.reason));
                    } catch (error) {
                        savedServerUnavailable = true;
                        autoSelectError = error;
                    }
                } else if (savedId) {
                    savedServerUnavailable = true;
                    autoSelectError = new Error('Saved server was not found during discovery.');
                }
            }

            // Fallback to rendering list
            this._renderServers(servers, savedId, { savedServerUnavailable, emptyStateReason: 'no_servers' });
            if (servers.length === 0) {
                this._setStatus('No servers found.', 'Ensure your Plex server is reachable.', 'warning');
            } else if (savedServerUnavailable) {
                this._handleError(autoSelectError, 'Unable to use the saved server.');
                this._setStatus('Saved server unavailable.', 'Select a server from the list.', 'warning');
            } else {
                this._setStatus('Select a server from the list.', '', 'neutral');
            }
            this._setAutoConnectHintVisible(false);
        } catch (error) {
            this._lastDiscoveredServers = [];
            this._statusEl.classList.remove('panel-spinner');
            this._handleError(error, 'Failed to discover servers.');
            this._setStatus('Discovery failed.', '', 'error');
            this._renderServers([], null, { emptyStateReason: 'discovery_failed' });
            this._setAutoConnectHintVisible(false);
        } finally {
            this._isLoading = false;
            this._statusEl.classList.remove('panel-spinner');
            this._refreshButton.disabled = false;
            this._setupButton.disabled = false;
            this._switchProfileButton.disabled = false;
            this._clearButton.disabled = false;
            this._restoreFocus();
        }
    }

    private _restoreFocus(): void {
        const nav = this._ports.getNavigation();
        if (nav) {
            if (this._restoreFocusTimeoutId !== null) {
                clearTimeout(this._restoreFocusTimeoutId);
                this._restoreFocusTimeoutId = null;
            }
            this._restoreFocusTimeoutId = setTimeout(() => {
                this._restoreFocusTimeoutId = null;
                if (!this._container.classList.contains('visible')) return;
                if (nav.restoreFocusForCurrentScreen()) {
                    return;
                }
                nav.setFocus('btn-server-refresh');
            }, FOCUS_RESTORE_DELAY_MS);
        }
    }

    hide(): void {
        this._unregisterFocusables();
        if (this._restoreFocusTimeoutId !== null) {
            clearTimeout(this._restoreFocusTimeoutId);
            this._restoreFocusTimeoutId = null;
        }
        this._container.style.display = 'none';
        this._container.classList.remove('visible');
    }

    async refresh(): Promise<void> {
        if (this._isLoading) {
            return;
        }
        this._clearError();
        await this._loadServers({ autoSelect: false, forceRefresh: true });
    }

    private _handleClearSelection(): void {
        void this._handleClearSelectionAsync();
    }

    private async _handleClearSelectionAsync(): Promise<void> {
        this._clearError();
        try {
            await this._ports.clearSelectedServer();
            this._setAutoConnectHintVisible(false);
            this._setStatus('Selection cleared.', 'Pick a server to continue.', 'success');
            this._renderServers(this._lastDiscoveredServers, null, { emptyStateReason: 'no_servers' });
            this._restoreFocus();
        } catch (error) {
            this._handleError(error, 'Could not clear saved server.');
            this._setStatus('Selection not cleared.', 'Try again.', 'error');
            console.error('[ServerSelect] Clear saved server failed:', summarizeErrorForLog(error));
        }
    }

    private _setAutoConnectHintVisible(visible: boolean): void {
        if (visible) {
            this._autoConnectHintEl.classList.add('visible');
            this._autoConnectHintEl.removeAttribute('hidden');
            return;
        }
        this._autoConnectHintEl.classList.remove('visible');
        this._autoConnectHintEl.setAttribute('hidden', 'true');
    }

    private _renderServers(
        servers: PlexServer[],
        savedId: string | null,
        options?: { savedServerUnavailable?: boolean; emptyStateReason?: 'no_servers' | 'discovery_failed' }
    ): void {
        const savedServerUnavailable = options?.savedServerUnavailable === true;
        const emptyStateReason = options?.emptyStateReason ?? 'no_servers';
        const healthMap: ServerHealthMap = this._serverSelectionStore.readServerHealthMap();

        this._unregisterServerListFocusables();
        this._listEl.replaceChildren();

        if (servers.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'server-empty-state';
            const icon = document.createElement('div');
            icon.className = 'server-empty-icon';
            icon.setAttribute('aria-hidden', 'true');

            const svgNs = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(svgNs, 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('width', '64');
            svg.setAttribute('height', '64');
            svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke-width', '2');

            const p1 = document.createElementNS(svgNs, 'path');
            p1.setAttribute('d', 'M4 17h16');
            const p2 = document.createElementNS(svgNs, 'path');
            p2.setAttribute('d', 'M6 17a6 6 0 0 1 12 0');
            const p3 = document.createElementNS(svgNs, 'path');
            p3.setAttribute('d', 'M12 7v4');
            const p4 = document.createElementNS(svgNs, 'path');
            p4.setAttribute('d', 'M10 9h4');
            svg.append(p1, p2, p3, p4);
            icon.appendChild(svg);

            const title = document.createElement('div');
            title.className = 'server-empty-title';
            title.textContent = 'No servers found';

            const description = document.createElement('div');
            description.className = 'server-empty-description';
            description.textContent = emptyStateReason === 'discovery_failed'
                ? 'Server discovery failed. Check network, then select "Retry discovery" to try again.'
                : 'Ensure your Plex Media Server is running and reachable on your network. Select "Retry discovery" to scan again.';

            empty.replaceChildren(icon, title, description);
            this._listEl.appendChild(empty);
            this._updateStaticButtonNeighbors(null);
            return;
        }

        const enabledServerButtons: HTMLButtonElement[] = [];
        const buttonIds = this._buildServerButtonIds(servers.map((server) => server?.id ?? 'unknown'));

        for (let i = 0; i < servers.length; i++) {
            const server = servers[i];
            if (!server) continue;

            const row = document.createElement('div');
            row.className = 'server-row';

            const main = document.createElement('div');
            main.className = 'server-main';

            const name = document.createElement('div');
            name.className = 'server-name';
            name.textContent = server.name;
            main.appendChild(name);

            const meta = document.createElement('div');
            meta.className = 'server-meta';
            meta.textContent = this._buildServerMeta(server, healthMap);
            main.appendChild(meta);

            row.appendChild(main);

            const actions = document.createElement('div');
            actions.className = 'server-actions';

            const selectButton = document.createElement('button');
            selectButton.id = buttonIds[i] ?? 'btn-server-select-unknown';
            selectButton.className = 'screen-button secondary';
            selectButton.textContent = 'Connect';
            selectButton.addEventListener('click', () => {
                this._selectServer(server).catch((error: unknown) => {
                    console.error('[ServerSelect] Select server failed:', summarizeErrorForLog(error));
                });
            });
            actions.appendChild(selectButton);
            row.appendChild(actions);

            // Add health pill
            const health = healthMap[server.id];
            const pill = document.createElement('div');
            const normalizedStatus =
                health?.status === 'ok'
                || health?.status === 'unreachable'
                || health?.status === 'auth_required'
                || health?.status === 'auth_invalid'
                    ? health.status
                    : 'unknown';
            const statusClass =
                normalizedStatus === 'auth_required'
                    ? 'auth-required'
                    : normalizedStatus === 'auth_invalid'
                        ? 'auth-invalid'
                        : normalizedStatus;
            pill.className = `server-status-pill ${statusClass}`;

            let statusText = 'Unknown';
            if (normalizedStatus === 'ok') statusText = 'OK';
            else if (normalizedStatus === 'unreachable') statusText = 'Unreachable';
            else if (normalizedStatus === 'auth_required') statusText = 'Auth Required';
            else if (normalizedStatus === 'auth_invalid') statusText = 'Auth Invalid';

            if (normalizedStatus === 'ok' && typeof health?.latencyMs === 'number' && Number.isFinite(health.latencyMs)) {
                const ms = Math.round(health.latencyMs);
                let label = 'OK';
                if (ms >= 500) {
                    label = 'Very Slow';
                    pill.classList.add('latency-very-slow');
                } else if (ms >= 100) {
                    label = 'Slow';
                    pill.classList.add('latency-slow');
                }
                pill.textContent = `${label} • ${ms}ms`;
            } else {
                pill.textContent = statusText;
            }
            main.appendChild(pill);

            if (savedId && server.id === savedId) {
                row.classList.add('active');
                // Keep reconnect available even for the currently saved server so users
                // can re-test connectivity without first clearing selection.
                selectButton.textContent =
                    normalizedStatus === 'ok' && !savedServerUnavailable
                        ? 'Connected'
                        : 'Reconnect';
            }

            this._listEl.appendChild(row);
            if (!selectButton.disabled) {
                enabledServerButtons.push(selectButton);
            }
        }

        const navForButtons = this._ports.getNavigation();
        if (navForButtons) {
            for (let i = 0; i < enabledServerButtons.length; i++) {
                const button = enabledServerButtons[i];
                if (!button) continue;
                const neighbors: FocusableElement['neighbors'] = {};
                const upButtonId = i === 0 ? 'btn-server-refresh' : enabledServerButtons[i - 1]?.id;
                const downButtonId = enabledServerButtons[i + 1]?.id;
                if (upButtonId) {
                    neighbors.up = upButtonId;
                }
                if (downButtonId) {
                    neighbors.down = downButtonId;
                }
                navForButtons.registerFocusable({
                    id: button.id,
                    element: button,
                    neighbors,
                    restoreGroup: 'server-select-list',
                    restorePriority: 1000 - i,
                    onFocus: () => {
                        try {
                            button.scrollIntoView({ block: 'nearest' });
                        } catch {
                            button.scrollIntoView();
                        }
                    },
                });
            }
        }
        this._registeredServerButtonIds = enabledServerButtons.map((button) => button.id);

        // Update neighbors for static buttons now that list is populated.
        this._updateStaticButtonNeighbors(enabledServerButtons[0]?.id ?? null);

    }

    private _unregisterServerListFocusables(): void {
        if (this._registeredServerButtonIds.length === 0) {
            return;
        }
        const nav = this._ports.getNavigation();
        if (nav) {
            for (const id of this._registeredServerButtonIds) {
                nav.unregisterFocusable(id);
            }
        }
        this._registeredServerButtonIds = [];
    }

    private async _selectServer(server: PlexServer): Promise<void> {
        this._clearError();
        this._setStatus(`Connecting to ${server.name}…`, '', 'loading');
        this._detailEl.textContent = '';

        try {
            const result = await this._ports.selectServer(server.id);
            if (result.kind === 'selected') {
                this._setStatus(`Connected to ${server.name}.`, 'Continuing startup…', 'success');
                return;
            }
            this._setStatus('Connection failed.', '', 'error');
            this._detailEl.textContent = '';
            this._errorEl.textContent = this._selectionFailureMessage(result.reason);
        } catch (error) {
            this._clearError();
            this._setStatus('Connection failed.', '', 'error');
            this._detailEl.textContent = '';
            this._handleError(error, 'Unable to use the selected server.');
            console.error('[ServerSelect] Failed to select server:', summarizeErrorForLog(error));
        }
    }

    private _selectionFailureMessage(
        reason: 'server_not_found' | 'unreachable' | 'auth_required' | 'auth_invalid'
    ): string {
        switch (reason) {
            case 'server_not_found':
                return 'Selected server is no longer available.';
            case 'auth_required':
                return 'Authentication required. Sign in to Plex and try again.';
            case 'auth_invalid':
                return 'Stored Plex credentials are invalid. Sign in again.';
            case 'unreachable':
                return 'Selected server is unreachable right now.';
        }
    }

    private _buildServerMeta(
        server: PlexServer,
        healthMap: Record<string, { status?: string; type?: string; latencyMs?: number; testedAt?: number } | undefined>
    ): string {
        const ownership = server.owned ? 'Owned' : `Shared by ${server.sourceTitle}`;
        const health = healthMap[server.id];

        let lastInfo: string;
        if (typeof health?.testedAt !== 'number') {
            lastInfo = 'Last: —';
        } else if (health?.status === 'ok') {
            lastInfo = `Last connected: ${this._formatRelativeTime(health.testedAt)}`;
        } else {
            lastInfo = `Last checked: ${this._formatRelativeTime(health.testedAt)}`;
        }

        return `${ownership} • ${lastInfo}`;
    }

    private _formatRelativeTime(timestamp: number): string {
        const deltaMs = Math.max(0, Date.now() - timestamp);
        const seconds = Math.floor(deltaMs / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return minutes === 1 ? '1 min ago' : `${minutes} mins ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
        const days = Math.floor(hours / 24);
        return days === 1 ? '1 day ago' : `${days} days ago`;
    }

    private _buildServerButtonIds(serverIds: string[]): string[] {
        return buildDeterministicButtonIds('btn-server-select-', serverIds);
    }

    private _setStatus(status: string, detail: string, tone: ScreenTone = 'neutral'): void {
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

    private _clearError(): void {
        this._errorEl.textContent = '';
    }

    private _handleError(error: unknown, fallback: string): void {
        if (error instanceof PlexApiError) {
            this._errorEl.textContent = `${error.code}: ${error.message}`;
            return;
        }
        const message = error instanceof Error ? error.message : fallback;
        this._errorEl.textContent = message;
    }

    private _registerFocusables(): void {
        const nav = this._ports.getNavigation();
        if (!nav) return;

        this._registerStaticButtons(null);

        // Set initial focus
        nav.setFocus('btn-server-refresh', { persist: false });
    }

    private _unregisterFocusables(): void {
        const nav = this._ports.getNavigation();
        if (!nav) return;

        nav.unregisterFocusable('btn-server-refresh');
        nav.unregisterFocusable('btn-server-setup');
        nav.unregisterFocusable('btn-server-switch-profile');
        nav.unregisterFocusable('btn-server-forget');

        this._unregisterServerListFocusables();
    }

    private _updateStaticButtonNeighbors(firstListFocusableId: string | null): void {
        const nav = this._ports.getNavigation();
        if (!nav) return;

        this._registerStaticButtons(firstListFocusableId);
    }

    private _registerStaticButtons(firstListFocusableId: string | null): void {
        const nav = this._ports.getNavigation();
        if (!nav) return;

        const staticButtons: Array<{
            id: string;
            element: HTMLButtonElement;
            left?: string;
            right?: string;
        }> = [
            {
                id: 'btn-server-refresh',
                element: this._refreshButton,
                right: 'btn-server-setup',
            },
            {
                id: 'btn-server-setup',
                element: this._setupButton,
                left: 'btn-server-refresh',
                right: 'btn-server-switch-profile',
            },
            {
                id: 'btn-server-switch-profile',
                element: this._switchProfileButton,
                left: 'btn-server-setup',
                right: 'btn-server-forget',
            },
            {
                id: 'btn-server-forget',
                element: this._clearButton,
                left: 'btn-server-switch-profile',
            },
        ];

        for (const button of staticButtons) {
            const neighbors: FocusableElement['neighbors'] = {};
            if (button.left) {
                neighbors.left = button.left;
            }
            if (button.right) {
                neighbors.right = button.right;
            }
            if (firstListFocusableId) {
                neighbors.down = firstListFocusableId;
            }
            nav.registerFocusable({
                id: button.id,
                element: button.element,
                neighbors,
            });
        }
    }
}
