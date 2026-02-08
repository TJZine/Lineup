/**
 * @fileoverview Minimal server selection screen for Plex discovery.
 * @module modules/ui/server-select/ServerSelectScreen
 * @version 1.0.0
 */

import { AppOrchestrator } from '../../../Orchestrator';
import type { PlexServer } from '../../plex/discovery/types';
import { PlexApiError } from '../../plex/auth';
import type { FocusableElement } from '../../navigation';
import { safeLocalStorageGet } from '../../../utils/storage';

const FOCUS_RESTORE_DELAY_MS = 50;

export class ServerSelectScreen {
    private _container: HTMLElement;
    private _orchestrator: AppOrchestrator;
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

    constructor(container: HTMLElement, orchestrator: AppOrchestrator) {
        this._container = container;
        this._orchestrator = orchestrator;
        this._container.classList.add('screen');
        this._container.style.position = 'absolute';
        this._container.style.inset = '0';
        this._container.style.display = 'none';
        this._container.style.alignItems = 'center';
        this._container.style.justifyContent = 'center';

        const panel = document.createElement('div');
        panel.className = 'screen-panel';

        const title = document.createElement('h1');
        title.className = 'screen-title';
        title.textContent = 'Select Plex Server';
        panel.appendChild(title);

        const subtitle = document.createElement('p');
        subtitle.className = 'screen-subtitle';
        subtitle.textContent = 'Choose a server to continue startup.';
        panel.appendChild(subtitle);

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

        panel.appendChild(autoConnectHint);
        this._autoConnectHintEl = autoConnectHint;

        const status = document.createElement('div');
        status.className = 'screen-status';
        status.textContent = 'Ready to discover servers.';
        panel.appendChild(status);
        this._statusEl = status;

        const detail = document.createElement('div');
        detail.className = 'screen-detail';
        detail.textContent = '';
        panel.appendChild(detail);
        this._detailEl = detail;

        const error = document.createElement('div');
        error.className = 'screen-error';
        error.textContent = '';
        panel.appendChild(error);
        this._errorEl = error;

        const buttonRow = document.createElement('div');
        buttonRow.className = 'button-row';

        const refreshButton = document.createElement('button');
        refreshButton.id = 'btn-server-refresh';
        refreshButton.className = 'screen-button';
        refreshButton.textContent = 'Retry discovery';
        refreshButton.addEventListener('click', () => {
            this.refresh().catch(console.error);
        });
        buttonRow.appendChild(refreshButton);
        this._refreshButton = refreshButton;

        const setupButton = document.createElement('button');
        setupButton.id = 'btn-server-setup';
        setupButton.className = 'screen-button secondary';
        setupButton.textContent = 'Re-run Setup';
        setupButton.addEventListener('click', () => {
            this._clearError();
            this._orchestrator.requestChannelSetupRerun();
        });
        buttonRow.appendChild(setupButton);
        this._setupButton = setupButton;

        const switchProfileButton = document.createElement('button');
        switchProfileButton.id = 'btn-server-switch-profile';
        switchProfileButton.className = 'screen-button secondary';
        switchProfileButton.textContent = 'Switch Profile';
        switchProfileButton.addEventListener('click', () => {
            const nav = this._orchestrator.getNavigation();
            nav?.replaceScreen('profile-select');
        });
        buttonRow.appendChild(switchProfileButton);
        this._switchProfileButton = switchProfileButton;

        const clearButton = document.createElement('button');
        clearButton.id = 'btn-server-forget';
        clearButton.className = 'screen-button secondary';
        clearButton.textContent = 'Clear Saved Server';
        clearButton.addEventListener('click', () => {
            this._handleClearSelection();
        });
        buttonRow.appendChild(clearButton);
        this._clearButton = clearButton;


        panel.appendChild(buttonRow);

        const list = document.createElement('div');
        list.className = 'server-list';
        panel.appendChild(list);
        this._listEl = list;

        this._container.appendChild(panel);
    }

    show(options?: { allowAutoConnect?: boolean }): void {
        this._container.style.display = 'flex';
        this._container.classList.add('visible');
        this._clearError();
        this._setStatus('', '');
        this._registerFocusables();
        // Manual server-select entry should not reconnect implicitly unless explicitly requested.
        const allowAutoConnect = options?.allowAutoConnect === true;
        this._loadServers({ autoSelect: allowAutoConnect, forceRefresh: false }).catch(console.error);
    }

    private async _loadServers(options: { autoSelect: boolean; forceRefresh: boolean }): Promise<void> {
        if (this._isLoading) return;
        this._isLoading = true;
        this._listEl.innerHTML = '';
        const savedId = safeLocalStorageGet(this._orchestrator.getSelectedServerStorageKey());
        const isAutoConnectAttempt = options.autoSelect && Boolean(savedId);
        this._setAutoConnectHintVisible(isAutoConnectAttempt);
        this._setStatus(
            isAutoConnectAttempt ? 'Reconnecting to saved server…' : 'Discovering servers…',
            isAutoConnectAttempt ? 'If that fails, choose any server below.' : ''
        );
        this._statusEl.classList.add('panel-spinner');

        // Disable controls
        this._refreshButton.disabled = true;
        this._setupButton.disabled = true;
        this._switchProfileButton.disabled = true;
        this._clearButton.disabled = true;

        try {
            const servers = await this._orchestrator.discoverServers(options.forceRefresh);
            let autoSelectError: unknown | null = null;
            let savedServerUnavailable = false;

            if (options.autoSelect) {
                if (savedId && servers.some(s => s.id === savedId)) {
                    try {
                        const success = await this._orchestrator.selectServer(savedId);
                        if (success) {
                            this._setStatus('Connected…', 'Continuing startup…');
                            return;
                        }
                        savedServerUnavailable = true;
                        autoSelectError = new Error('Unable to use the saved server.');
                    } catch (error) {
                        savedServerUnavailable = true;
                        autoSelectError = error;
                    }
                }
            }

            // Fallback to rendering list
            this._renderServers(servers, savedId, { savedServerUnavailable });
            if (servers.length === 0) {
                this._setStatus('No servers found.', 'Ensure your Plex server is reachable.');
            } else if (savedServerUnavailable) {
                this._handleError(autoSelectError, 'Unable to use the saved server.');
                this._setStatus('Saved server unavailable.', 'Select a server from the list.');
            } else {
                this._setStatus('Select a server from the list.', '');
            }
            this._setAutoConnectHintVisible(false);
        } catch (error) {
            this._handleError(error, 'Failed to discover servers.');
            this._setStatus('Discovery failed.', '');
            this._renderServers([], null);
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
        const nav = this._orchestrator.getNavigation();
        if (nav) {
            if (this._restoreFocusTimeoutId !== null) {
                clearTimeout(this._restoreFocusTimeoutId);
                this._restoreFocusTimeoutId = null;
            }
            this._restoreFocusTimeoutId = setTimeout(() => {
                this._restoreFocusTimeoutId = null;
                if (!this._container.classList.contains('visible')) return;
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
        this._clearError();
        this._orchestrator.clearSelectedServer();
        this._setAutoConnectHintVisible(false);
        this._setStatus('Selection cleared.', 'Pick a server to continue.');
        this._renderServers([], null);
        this._restoreFocus();
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
        options?: { savedServerUnavailable?: boolean }
    ): void {
        const savedServerUnavailable = options?.savedServerUnavailable === true;
        const rawHealth = safeLocalStorageGet(this._orchestrator.getServerHealthStorageKey());
        let healthMap: Record<string, { status?: string; type?: string; latencyMs?: number; testedAt?: number } | undefined> = {};
        let parsedHealth: unknown = {};
        if (rawHealth) {
            try {
                parsedHealth = JSON.parse(rawHealth);
            } catch (e) {
                console.warn('[ServerSelect] Failed to parse health data:', e);
                parsedHealth = null;
            }
        }

        if (parsedHealth && typeof parsedHealth === 'object' && !Array.isArray(parsedHealth)) {
            healthMap = parsedHealth as Record<string, { status?: string; type?: string; latencyMs?: number; testedAt?: number } | undefined>;
        } else if (rawHealth) {
            try {
                localStorage.removeItem(this._orchestrator.getServerHealthStorageKey());
            } catch {
                // ignore storage errors
            }
        }

        // Clean up existing focusables to prevent phantom navigation targets
        const nav = this._orchestrator.getNavigation();
        if (nav) {
            const buttons = this._listEl.querySelectorAll('button');
            buttons.forEach(btn => nav.unregisterFocusable(btn.id));
        }

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
            description.textContent =
                'Ensure your Plex Media Server is running and reachable on your network.';

            empty.replaceChildren(icon, title, description);
            this._listEl.appendChild(empty);
            this._updateStaticButtonNeighbors(null);
            return;
        }

        const enabledServerButtons: HTMLButtonElement[] = [];

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
            selectButton.id = `btn-server-select-${i}`;
            selectButton.className = 'screen-button secondary';
            selectButton.textContent = 'Connect';
            selectButton.addEventListener('click', () => {
                this._selectServer(server).catch(console.error);
            });
            actions.appendChild(selectButton);
            row.appendChild(actions);

            // Add health pill
            const health = healthMap[server.id];
            const pill = document.createElement('div');
            const normalizedStatus =
                health?.status === 'ok' || health?.status === 'unreachable' || health?.status === 'auth_required'
                    ? health.status
                    : 'unknown';
            const statusClass = normalizedStatus === 'auth_required' ? 'auth-required' : normalizedStatus;
            pill.className = `server-status-pill ${statusClass}`;

            let statusText = 'Unknown';
            if (normalizedStatus === 'ok') statusText = 'OK';
            else if (normalizedStatus === 'unreachable') statusText = 'Unreachable';
            else if (normalizedStatus === 'auth_required') statusText = 'Auth Required';

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

        const navForButtons = this._orchestrator.getNavigation();
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

        // Update neighbors for static buttons now that list is populated.
        this._updateStaticButtonNeighbors(enabledServerButtons[0]?.id ?? null);

    }

    private async _selectServer(server: PlexServer): Promise<void> {
        this._clearError();
        this._setStatus(`Connecting to ${server.name}…`, '');
        this._detailEl.textContent = '';

        try {
            const success = await this._orchestrator.selectServer(server.id);
            if (success) {
                this._setStatus(`Connected to ${server.name}.`, 'Continuing startup…');
                return;
            }
            this._setStatus('Connection failed.', '');
            this._detailEl.textContent = '';
            this._errorEl.textContent = 'Unable to use the selected server.';
        } catch (error) {
            this._clearError();
            this._setStatus('Connection failed.', '');
            this._detailEl.textContent = '';
            this._handleError(error, 'Unable to use the selected server.');
            console.error('[ServerSelect] Failed to select server:', error);
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

    private _setStatus(status: string, detail: string): void {
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
        const nav = this._orchestrator.getNavigation();
        if (!nav) return;

        this._registerStaticButtons(null);

        // Set initial focus
        nav.setFocus('btn-server-refresh');
    }

    private _unregisterFocusables(): void {
        const nav = this._orchestrator.getNavigation();
        if (!nav) return;

        nav.unregisterFocusable('btn-server-refresh');
        nav.unregisterFocusable('btn-server-setup');
        nav.unregisterFocusable('btn-server-switch-profile');
        nav.unregisterFocusable('btn-server-forget');

        // Clear potential list items
        // In a real app we'd track IDs, but here we can just clear known patterns or rely on page tear-down
        // For now, let's just clear the list HTML which removes listeners at DOM level, 
        // but we should technically unregister from nav manager to keep map clean.
        const buttons = this._listEl.querySelectorAll('button');
        buttons.forEach(btn => nav.unregisterFocusable(btn.id));
    }

    private _updateStaticButtonNeighbors(firstListFocusableId: string | null): void {
        const nav = this._orchestrator.getNavigation();
        if (!nav) return;

        this._registerStaticButtons(firstListFocusableId);
    }

    private _registerStaticButtons(firstListFocusableId: string | null): void {
        const nav = this._orchestrator.getNavigation();
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
