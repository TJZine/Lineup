import type { PlexServer } from '../../plex/discovery/types';
import type { ServerSelectScreenPorts } from './types';
import type { ServerSelectRuntimeScreenAdapter } from './ServerSelectRuntimeContracts';
import { ServerSelectStatusPolicy } from './ServerSelectStatusPolicy';

export class ServerSelectRuntimeCoordinator {
    private _ports: ServerSelectScreenPorts;
    private _adapter: ServerSelectRuntimeScreenAdapter;
    private _statusPolicy: ServerSelectStatusPolicy;
    private _isLoading = false;
    private _isClearing = false;
    private _isVisible = false;
    private _isDestroyed = false;
    private _visibilityGeneration = 0;
    private _activeLoadGeneration: number | null = null;
    private _activeClearGeneration: number | null = null;
    private _isSelecting = false;
    private _activeSelectGeneration: number | null = null;
    private _lastDiscoveredServers: PlexServer[] = [];
    private _idlePromise: Promise<void> = Promise.resolve();
    private _resolveIdlePromise: (() => void) | null = null;
    private _hasPendingFocusRestore: (generation: number) => boolean;

    constructor(options: {
        ports: ServerSelectScreenPorts;
        adapter: ServerSelectRuntimeScreenAdapter;
        statusPolicy: ServerSelectStatusPolicy;
        hasPendingFocusRestore: (generation: number) => boolean;
    }) {
        this._ports = options.ports;
        this._adapter = options.adapter;
        this._statusPolicy = options.statusPolicy;
        this._hasPendingFocusRestore = options.hasPendingFocusRestore;
    }

    get isSelecting(): boolean {
        return this._isSelecting;
    }

    destroy(): void {
        this._isDestroyed = true;
        this.hide();
        this._adapter.cancelRestoreFocus();
        this._resolveIdleIfSettled();
    }

    async whenIdle(): Promise<void> {
        return this._hasPendingUiWork() ? this._idlePromise : Promise.resolve();
    }

    markFocusRestorePending(): void {
        this._ensureIdlePromise();
    }

    notifyFocusRestoreSettled(): void {
        this._resolveIdleIfSettled();
    }

    show(options?: { allowAutoConnect?: boolean }): void {
        if (this._isDestroyed) {
            return;
        }

        this._isVisible = true;
        this._visibilityGeneration += 1;
        const generation = this._visibilityGeneration;
        this._adapter.showContainer();
        this._adapter.clearError();
        this._adapter.setStatus('', '');
        this._adapter.registerFocusables();
        const allowAutoConnect = options?.allowAutoConnect === true;
        this._runScreenAction(
            () => this._loadServers({ autoSelect: allowAutoConnect, forceRefresh: false }, generation),
            'Failed to discover servers.',
            (error) => this.handleDiscoveryLoadError(error, generation)
        );
    }

    hide(): void {
        this._isVisible = false;
        this._visibilityGeneration += 1;
        this._adapter.unregisterFocusables();
        this._adapter.cancelRestoreFocus();
        this._adapter.hideContainer();
        this._adapter.setServerConnectButtonsDisabled(true);
        this._resolveIdleIfSettled();
    }

    async refresh(): Promise<void> {
        const generation = this._visibilityGeneration;
        if (this._isLoading && this._activeLoadGeneration === generation) {
            return;
        }
        this._adapter.clearError();
        await this._loadServers({ autoSelect: false, forceRefresh: true }, generation);
    }

    handleClearSelection(): void {
        const generation = this._visibilityGeneration;
        if (this._isSelecting || this._isClearing || !this._canUpdateUi(generation)) {
            return;
        }

        this._runScreenAction(
            () => this._handleClearSelectionAsync(generation),
            'Could not clear saved server.',
            (error) => this._handleClearSelectionError(error, generation)
        );
    }

    selectServer(server: PlexServer): void {
        this._runScreenAction(
            () => this._selectServer(server),
            'Unable to use the selected server.',
            (error) => this._handleSelectionDispatchError(error, this._visibilityGeneration)
        );
    }

    private async _loadServers(
        options: { autoSelect: boolean; forceRefresh: boolean },
        generation = this._visibilityGeneration
    ): Promise<void> {
        if ((this._isLoading && this._activeLoadGeneration === generation) || !this._canUpdateUi(generation)) {
            return;
        }
        this._ensureIdlePromise();
        this._isLoading = true;
        this._activeLoadGeneration = generation;

        try {
            this._adapter.unregisterServerListFocusables();
            this._adapter.replaceServerListChildren();
            const screenState = this._ports.getSelectedServerScreenState();
            const savedId = screenState.selectedServerId;
            const isAutoConnectAttempt = options.autoSelect && Boolean(screenState.selectedServerId);
            this._adapter.setAutoConnectHintVisible(isAutoConnectAttempt);
            this._adapter.setStatus(
                isAutoConnectAttempt ? 'Reconnecting to saved server…' : 'Discovering servers…',
                isAutoConnectAttempt ? 'If that fails, choose any server below.' : '',
                'loading'
            );
            this._adapter.addStatusSpinner();
            this._adapter.setControlsDisabled(true);

            const servers = await this._ports.discoverServers(options.forceRefresh);

            if (!this._canUpdateUi(generation)) {
                return;
            }

            this._lastDiscoveredServers = servers.slice();
            this._adapter.removeStatusSpinner();
            let autoSelectError: unknown | null = null;
            let savedServerUnavailable = false;

            if (isAutoConnectAttempt && this._isSelecting) {
                this._adapter.renderServers(servers, screenState, { emptyStateReason: 'no_servers' });
                this._setServerListStatus(servers);
                this._adapter.setAutoConnectHintVisible(false);
                return;
            }

            if (options.autoSelect) {
                if (savedId && servers.some(s => s.id === savedId)) {
                    try {
                        const result = await this._ports.selectServer(savedId);

                        if (!this._canUpdateUi(generation)) {
                            return;
                        }

                        this._adapter.setAutoConnectHintVisible(false);

                        if (result.kind === 'selected') {
                            this._adapter.setStatus('Connected…', 'Continuing startup…', 'success');
                            return;
                        }
                        savedServerUnavailable = true;
                        autoSelectError = new Error(this._statusPolicy.selectionFailureMessage(result.reason));
                    } catch (error) {
                        savedServerUnavailable = true;
                        autoSelectError = error;
                    }
                } else if (savedId) {
                    savedServerUnavailable = true;
                    autoSelectError = new Error('Saved server was not found during discovery.');
                }
            }

            if (!this._canUpdateUi(generation)) {
                return;
            }

            this._adapter.renderServers(
                servers,
                this._ports.getSelectedServerScreenState(),
                { savedServerUnavailable, emptyStateReason: 'no_servers' }
            );
            this._setServerListStatus(servers, { savedServerUnavailable, autoSelectError });
            this._adapter.setAutoConnectHintVisible(false);
        } catch (error) {
            if (!this._canUpdateUi(generation)) {
                return;
            }

            this._lastDiscoveredServers = [];
            this._adapter.removeStatusSpinner();
            this._statusPolicy.handleError(this._adapter, error, 'Failed to discover servers.');
            this._adapter.setStatus('Discovery failed.', '', 'error');
            this._adapter.renderServers([], { selectedServerId: null, serverHealth: {} }, { emptyStateReason: 'discovery_failed' });
            this._adapter.setAutoConnectHintVisible(false);
        } finally {
            if (this._activeLoadGeneration === generation) {
                this._isLoading = false;
                this._activeLoadGeneration = null;
            }

            if (this._canUpdateUi(generation)) {
                this._adapter.removeStatusSpinner();
                this._adapter.setControlsDisabled(false);
                this._adapter.setClearButtonDisabled(this._isClearing || this._isSelecting);
                this._restoreFocus(generation);
            }

            this._resolveIdleIfSettled();
        }
    }

    private async _handleClearSelectionAsync(generation: number): Promise<void> {
        if (this._isSelecting || this._isClearing || !this._canUpdateUi(generation)) {
            return;
        }

        try {
            this._ensureIdlePromise();
            this._isClearing = true;
            this._activeClearGeneration = generation;
            this._adapter.clearError();
            this._adapter.setClearButtonDisabled(true);
            await this._ports.clearSelectedServer();

            if (!this._canUpdateUi(generation)) {
                return;
            }

            this._adapter.setAutoConnectHintVisible(false);
            this._adapter.setStatus('Selection cleared.', 'Pick a server to continue.', 'success');
            this._adapter.renderServers(
                this._lastDiscoveredServers,
                this._ports.getSelectedServerScreenState(),
                { emptyStateReason: 'no_servers' }
            );
            this._restoreFocus(generation);
        } catch (error) {
            if (!this._canUpdateUi(generation)) {
                return;
            }

            this._statusPolicy.handleError(this._adapter, error, 'Could not clear saved server.');
            this._adapter.setStatus('Selection not cleared.', 'Try again.', 'error');
        } finally {
            if (this._activeClearGeneration === generation) {
                this._isClearing = false;
                this._activeClearGeneration = null;
            }

            const currentGeneration = this._visibilityGeneration;
            if (
                !this._isSelecting
                && !this._isClearing
                && this._canUpdateUi(currentGeneration)
                && !this._isLoadingCurrentGeneration(currentGeneration)
            ) {
                this._adapter.setClearButtonDisabled(false);
            }
            this._resolveIdleIfSettled();
        }
    }

    private async _selectServer(server: PlexServer): Promise<void> {
        const generation = this._visibilityGeneration;

        if (this._isSelecting || !this._canUpdateUi(generation)) {
            return;
        }

        try {
            this._ensureIdlePromise();
            this._isSelecting = true;
            this._activeSelectGeneration = generation;
            this._adapter.setServerConnectButtonsDisabled(true);
            this._adapter.setClearButtonDisabled(true);
            this._adapter.clearError();
            this._adapter.setStatus(`Connecting to ${server.name}…`, '', 'loading');
            this._adapter.setDetail('');
            const result = await this._ports.selectServer(server.id);

            if (!this._canUpdateUi(generation) || this._activeSelectGeneration !== generation) {
                return;
            }

            if (result.kind === 'selected') {
                this._adapter.setStatus(`Connected to ${server.name}.`, 'Continuing startup…', 'success');
                return;
            }
            this._adapter.setStatus('Connection failed.', '', 'error');
            this._adapter.setDetail('');
            this._adapter.setError(this._statusPolicy.selectionFailureMessage(result.reason));
        } catch (error) {
            if (!this._canUpdateUi(generation) || this._activeSelectGeneration !== generation) {
                return;
            }

            this._adapter.clearError();
            this._adapter.setStatus('Connection failed.', '', 'error');
            this._adapter.setDetail('');
            this._statusPolicy.handleError(this._adapter, error, 'Unable to use the selected server.');
        } finally {
            if (this._activeSelectGeneration === generation) {
                this._isSelecting = false;
                this._activeSelectGeneration = null;
            }

            const currentGeneration = this._visibilityGeneration;
            if (
                this._canUpdateUi(currentGeneration)
                && !this._isSelecting
                && !this._isLoadingCurrentGeneration(currentGeneration)
                && !this._isClearing
            ) {
                this._adapter.setClearButtonDisabled(false);
                if (currentGeneration === generation) {
                    this._adapter.setServerConnectButtonsDisabled(false);
                } else {
                    this._adapter.renderServers(
                        this._lastDiscoveredServers,
                        this._ports.getSelectedServerScreenState(),
                        { emptyStateReason: 'no_servers' }
                    );
                    this._setServerListStatus(this._lastDiscoveredServers);
                    this._restoreFocus(currentGeneration);
                }
            }
            this._resolveIdleIfSettled();
        }
    }

    private handleDiscoveryLoadError(
        error: unknown,
        generation = this._visibilityGeneration
    ): void {
        if (!this._canUpdateUi(generation)) {
            return;
        }

        this._lastDiscoveredServers = [];
        this._adapter.removeStatusSpinner();
        this._statusPolicy.handleError(this._adapter, error, 'Failed to discover servers.');
        this._adapter.setStatus('Discovery failed.', '', 'error');
        try {
            this._adapter.renderServers(
                [],
                { selectedServerId: null, serverHealth: {} },
                { emptyStateReason: 'discovery_failed' }
            );
        } catch {
            this._adapter.unregisterServerListFocusables();
            this._adapter.replaceServerListChildren();
        }
        this._adapter.setAutoConnectHintVisible(false);
    }

    private _setServerListStatus(
        servers: PlexServer[],
        options?: { savedServerUnavailable?: boolean; autoSelectError?: unknown | null }
    ): void {
        this._statusPolicy.setServerListStatus(this._adapter, servers, {
            ...options,
            isSelecting: this._isSelecting,
        });
    }

    private _handleClearSelectionError(error: unknown, generation: number): void {
        if (!this._canUpdateUi(generation)) {
            return;
        }

        this._statusPolicy.handleError(this._adapter, error, 'Could not clear saved server.');
        this._adapter.setStatus('Selection not cleared.', 'Try again.', 'error');
    }

    private _handleSelectionDispatchError(
        error: unknown,
        generation: number
    ): void {
        if (!this._canUpdateUi(generation)) {
            return;
        }

        this._adapter.clearError();
        this._adapter.setStatus('Connection failed.', '', 'error');
        this._adapter.setDetail('');
        this._statusPolicy.handleError(this._adapter, error, 'Unable to use the selected server.');
    }

    private _canUpdateUi(generation = this._visibilityGeneration): boolean {
        return generation === this._visibilityGeneration
            && this._isVisible
            && !this._isDestroyed
            && this._adapter.isContainerVisible();
    }

    private _isLoadingCurrentGeneration(generation: number): boolean {
        return this._isLoading && this._activeLoadGeneration === generation;
    }

    private _restoreFocus(generation: number): void {
        this._adapter.restoreFocus(generation, (restoreGeneration) => this._canUpdateUi(restoreGeneration));
    }

    private _hasPendingUiWork(): boolean {
        const generation = this._visibilityGeneration;
        return (this._isLoading && this._activeLoadGeneration === generation)
            || (this._isClearing && this._activeClearGeneration === generation)
            || (this._isSelecting && this._activeSelectGeneration === generation)
            || this._hasPendingFocusRestore(generation);
    }

    private _ensureIdlePromise(): void {
        if (this._resolveIdlePromise) {
            return;
        }

        this._idlePromise = new Promise((resolve) => {
            this._resolveIdlePromise = resolve;
        });
    }

    private _resolveIdleIfSettled(): void {
        if (this._hasPendingUiWork() || !this._resolveIdlePromise) {
            return;
        }

        const resolve = this._resolveIdlePromise;
        this._resolveIdlePromise = null;
        resolve();
    }

    private _runScreenAction(
        action: () => Promise<void>,
        fallbackMessage: string,
        onError?: (error: unknown) => void
    ): void {
        let promise: Promise<void>;
        try {
            promise = action();
        } catch (error) {
            if (onError) {
                onError(error);
                return;
            }
            this._statusPolicy.handleError(this._adapter, error, fallbackMessage);
            return;
        }

        void promise.catch((error: unknown) => {
            if (onError) {
                onError(error);
                return;
            }
            this._statusPolicy.handleError(this._adapter, error, fallbackMessage);
        });
    }
}
