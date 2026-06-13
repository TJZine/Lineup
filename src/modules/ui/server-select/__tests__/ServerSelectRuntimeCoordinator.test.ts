import type { PlexServer } from '../../../plex/discovery/types';
import { createDeferred } from '../../../../__tests__/helpers';
import { ServerSelectRuntimeCoordinator } from '../ServerSelectRuntimeCoordinator';
import type { ServerSelectRuntimeScreenAdapter } from '../ServerSelectRuntimeContracts';
import { ServerSelectStatusPolicy } from '../ServerSelectStatusPolicy';
import type {
    ServerSelectDisplayState,
    ServerSelectScreenPorts,
    ServerSelectSelectionResult,
} from '../types';

type RuntimeAdapter = jest.Mocked<ServerSelectRuntimeScreenAdapter>;
type RuntimePorts = jest.Mocked<ServerSelectScreenPorts>;

const makeServer = (id: string, name: string, owned = true): PlexServer => ({
    id,
    name,
    sourceTitle: 'Plex',
    ownerId: 'owner-id',
    owned,
    connections: [],
    capabilities: [],
    preferredConnection: null,
});

const makeScreenState = (
    overrides: Partial<ServerSelectDisplayState> = {}
): ServerSelectDisplayState => ({
    selectedServerId: null,
    serverHealth: {},
    ...overrides,
});

const selectedResult = (
    overrides: Partial<Extract<ServerSelectSelectionResult, { kind: 'selected' }>> = {}
): ServerSelectSelectionResult => ({
    kind: 'selected',
    readiness: 'startup_pending',
    persistedSelection: 'updated',
    startupResume: {
        startup: 'completed',
        epgRefresh: { kind: 'succeeded' },
    },
    ...overrides,
});

const createAdapter = (): RuntimeAdapter => ({
    showContainer: jest.fn(),
    hideContainer: jest.fn(),
    isContainerVisible: jest.fn(() => true),
    registerFocusables: jest.fn(),
    unregisterFocusables: jest.fn(),
    restoreFocus: jest.fn(),
    cancelRestoreFocus: jest.fn(),
    unregisterServerListFocusables: jest.fn(),
    replaceServerListChildren: jest.fn(),
    renderServers: jest.fn(),
    setServerConnectButtonsDisabled: jest.fn(),
    setControlsDisabled: jest.fn(),
    setClearButtonDisabled: jest.fn(),
    setAutoConnectHintVisible: jest.fn(),
    setStatus: jest.fn(),
    clearError: jest.fn(),
    setError: jest.fn(),
    setDetail: jest.fn(),
    addStatusSpinner: jest.fn(),
    removeStatusSpinner: jest.fn(),
});

const createPorts = (
    overrides: Partial<RuntimePorts> = {}
): RuntimePorts => ({
    discoverServers: jest.fn().mockResolvedValue([]),
    selectServer: jest.fn().mockResolvedValue({ kind: 'selection_failed', reason: 'unreachable' }),
    clearSelectedServer: jest.fn().mockResolvedValue(undefined),
    getSelectedServerScreenState: jest.fn(() => makeScreenState()),
    requestChannelSetupRerun: jest.fn(),
    getNavigation: jest.fn(() => null),
    ...overrides,
} as RuntimePorts);

const createRuntime = (options: {
    ports?: RuntimePorts;
    adapter?: RuntimeAdapter;
    hasPendingFocusRestore?: (generation: number) => boolean;
} = {}): {
    runtime: ServerSelectRuntimeCoordinator;
    ports: RuntimePorts;
    adapter: RuntimeAdapter;
} => {
    const ports = options.ports ?? createPorts();
    const adapter = options.adapter ?? createAdapter();
    const runtime = new ServerSelectRuntimeCoordinator({
        ports,
        adapter,
        statusPolicy: new ServerSelectStatusPolicy(),
        hasPendingFocusRestore: options.hasPendingFocusRestore ?? ((): boolean => false),
    });

    return { runtime, ports, adapter };
};

const clearAdapterMocks = (adapter: RuntimeAdapter): void => {
    for (const mock of Object.values(adapter)) {
        mock.mockClear();
    }
};

describe('ServerSelectRuntimeCoordinator', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('discovers servers, renders the list, restores focus, and settles idle', async () => {
        const servers = [makeServer('srv-1', 'Server One')];
        const state = makeScreenState();
        const ports = createPorts({
            discoverServers: jest.fn().mockResolvedValue(servers),
            getSelectedServerScreenState: jest.fn(() => state),
        } as Partial<RuntimePorts>);
        const { runtime, adapter } = createRuntime({ ports });

        runtime.show({ allowAutoConnect: false });
        await runtime.whenIdle();

        expect(adapter.showContainer).toHaveBeenCalledTimes(1);
        expect(adapter.registerFocusables).toHaveBeenCalledTimes(1);
        expect(ports.discoverServers).toHaveBeenCalledWith({
            forceRefresh: false,
            signal: expect.any(AbortSignal),
        });
        expect(adapter.unregisterServerListFocusables).toHaveBeenCalledTimes(1);
        expect(adapter.replaceServerListChildren).toHaveBeenCalledTimes(1);
        expect(adapter.renderServers).toHaveBeenCalledWith(
            servers,
            state,
            { savedServerUnavailable: false, emptyStateReason: 'no_servers' }
        );
        expect(adapter.removeStatusSpinner).toHaveBeenCalled();
        expect(adapter.setControlsDisabled).toHaveBeenLastCalledWith(false);
        expect(adapter.restoreFocus).toHaveBeenCalledTimes(1);

        await expect(runtime.whenIdle()).resolves.toBeUndefined();
    });

    it('auto-connects a saved server with selected-result detail', async () => {
        const servers = [makeServer('srv-1', 'Server One')];
        const ports = createPorts({
            discoverServers: jest.fn().mockResolvedValue(servers),
            selectServer: jest.fn().mockResolvedValue(selectedResult({
                startupResume: {
                    startup: 'completed',
                    epgRefresh: { kind: 'failed', error: new Error('refresh failed') },
                },
            })),
            getSelectedServerScreenState: jest.fn(() => makeScreenState({ selectedServerId: 'srv-1' })),
        } as Partial<RuntimePorts>);
        const { runtime, adapter } = createRuntime({ ports });

        runtime.show({ allowAutoConnect: true });
        await runtime.whenIdle();

        expect(ports.selectServer).toHaveBeenCalledWith('srv-1', {
            signal: expect.any(AbortSignal),
        });
        expect(adapter.setAutoConnectHintVisible).toHaveBeenCalledWith(true);
        expect(adapter.setAutoConnectHintVisible).toHaveBeenLastCalledWith(false);
        expect(adapter.setStatus).toHaveBeenCalledWith(
            'Connected…',
            'Connected, but guide refresh needs retry.',
            'warning'
        );
        expect(adapter.renderServers).not.toHaveBeenCalled();
    });

    it('renders manual selection state when saved-server auto-connect fails', async () => {
        const servers = [makeServer('srv-1', 'Server One')];
        const ports = createPorts({
            discoverServers: jest.fn().mockResolvedValue(servers),
            selectServer: jest.fn().mockResolvedValue({ kind: 'selection_failed', reason: 'auth_required' }),
            getSelectedServerScreenState: jest.fn(() => makeScreenState({ selectedServerId: 'srv-1' })),
        } as Partial<RuntimePorts>);
        const { runtime, adapter } = createRuntime({ ports });

        runtime.show({ allowAutoConnect: true });
        await runtime.whenIdle();

        expect(adapter.renderServers).toHaveBeenCalledWith(
            servers,
            makeScreenState({ selectedServerId: 'srv-1' }),
            { savedServerUnavailable: true, emptyStateReason: 'no_servers' }
        );
        expect(adapter.setError).toHaveBeenCalledWith('Authentication required. Sign in to Plex and try again.');
        expect(adapter.setStatus).toHaveBeenCalledWith(
            'Saved server unavailable.',
            'Select a server from the list.',
            'warning'
        );
        expect(adapter.setAutoConnectHintVisible).toHaveBeenLastCalledWith(false);
        expect(adapter.setServerConnectButtonsDisabled).not.toHaveBeenCalledWith(true);
    });

    it('surfaces degraded successful selection details instead of generic success', async () => {
        const server = makeServer('srv-1', 'Server One');
        const ports = createPorts({
            discoverServers: jest.fn().mockResolvedValue([server]),
            selectServer: jest.fn().mockResolvedValue(selectedResult({
                persistedSelection: 'skipped_missing_credentials',
            })),
        } as Partial<RuntimePorts>);
        const { runtime, adapter } = createRuntime({ ports });

        runtime.show({ allowAutoConnect: false });
        await runtime.whenIdle();
        runtime.selectServer(server);
        await runtime.whenIdle();

        expect(adapter.setStatus).toHaveBeenLastCalledWith(
            'Connected to Server One.',
            'Connected, but saved-server preference was not updated because credentials are unavailable.',
            'success'
        );
    });

    it('uses warning tone when selection succeeds but guide refresh fails', async () => {
        const server = makeServer('srv-1', 'Server One');
        const ports = createPorts({
            discoverServers: jest.fn().mockResolvedValue([server]),
            selectServer: jest.fn().mockResolvedValue(selectedResult({
                startupResume: {
                    startup: 'completed',
                    epgRefresh: { kind: 'failed', error: new Error('refresh failed') },
                },
            })),
        } as Partial<RuntimePorts>);
        const { runtime, adapter } = createRuntime({ ports });

        runtime.show({ allowAutoConnect: false });
        await runtime.whenIdle();
        runtime.selectServer(server);
        await runtime.whenIdle();

        expect(adapter.setStatus).toHaveBeenLastCalledWith(
            'Connected to Server One.',
            'Connected, but guide refresh needs retry.',
            'warning'
        );
    });

    it('ignores concurrent manual selection and keeps clear disabled until visible work settles', async () => {
        const server = makeServer('srv-1', 'Server One');
        const selection = createDeferred<ServerSelectSelectionResult>();
        const ports = createPorts({
            discoverServers: jest.fn().mockResolvedValue([server]),
            selectServer: jest.fn().mockReturnValue(selection.promise),
        } as Partial<RuntimePorts>);
        const { runtime, adapter } = createRuntime({ ports });

        runtime.show({ allowAutoConnect: false });
        await runtime.whenIdle();
        adapter.setClearButtonDisabled.mockClear();

        runtime.selectServer(server);
        runtime.selectServer(server);

        expect(ports.selectServer).toHaveBeenCalledTimes(1);
        expect(adapter.setServerConnectButtonsDisabled).toHaveBeenCalledWith(true);
        expect(adapter.setClearButtonDisabled).toHaveBeenCalledWith(true);

        runtime.handleClearSelection();
        expect(ports.clearSelectedServer).not.toHaveBeenCalled();

        selection.resolve(selectedResult());
        await runtime.whenIdle();

        expect(adapter.setClearButtonDisabled).toHaveBeenLastCalledWith(false);
        expect(adapter.setServerConnectButtonsDisabled).toHaveBeenLastCalledWith(false);
    });

    it('ignores repeated clear requests while clearing and rerenders from last discovery on success', async () => {
        const servers = [makeServer('srv-1', 'Server One')];
        const clear = createDeferred<void>();
        const ports = createPorts({
            discoverServers: jest.fn().mockResolvedValue(servers),
            clearSelectedServer: jest.fn().mockReturnValue(clear.promise),
            getSelectedServerScreenState: jest.fn(() => makeScreenState({ selectedServerId: 'srv-1' })),
        } as Partial<RuntimePorts>);
        const { runtime, adapter } = createRuntime({ ports });

        runtime.show({ allowAutoConnect: false });
        await runtime.whenIdle();
        adapter.renderServers.mockClear();

        runtime.handleClearSelection();
        runtime.handleClearSelection();

        expect(ports.clearSelectedServer).toHaveBeenCalledTimes(1);
        expect(adapter.setClearButtonDisabled).toHaveBeenLastCalledWith(true);

        ports.getSelectedServerScreenState.mockReturnValue(makeScreenState());
        clear.resolve();
        await runtime.whenIdle();

        expect(adapter.setStatus).toHaveBeenCalledWith('Selection cleared.', 'Pick a server to continue.', 'success');
        expect(adapter.renderServers).toHaveBeenCalledWith(
            servers,
            makeScreenState(),
            { emptyStateReason: 'no_servers' }
        );
        expect(adapter.restoreFocus).toHaveBeenCalled();
        expect(adapter.setClearButtonDisabled).toHaveBeenLastCalledWith(false);
    });

    it('drops late discovery, selection, and clear completions after hide or destroy', async () => {
        const discovery = createDeferred<PlexServer[]>();
        const discoveryPorts = createPorts({
            discoverServers: jest.fn().mockReturnValue(discovery.promise),
        } as Partial<RuntimePorts>);
        const discoveryRuntime = createRuntime({ ports: discoveryPorts });
        discoveryRuntime.runtime.show({ allowAutoConnect: false });
        const discoverySignal = discoveryPorts.discoverServers.mock.calls[0]?.[0]?.signal;
        discoveryRuntime.runtime.hide();
        clearAdapterMocks(discoveryRuntime.adapter);

        expect(discoverySignal?.aborted).toBe(true);
        discovery.resolve([makeServer('srv-1', 'Server One')]);
        await discoveryRuntime.runtime.whenIdle();

        expect(discoveryRuntime.adapter.renderServers).not.toHaveBeenCalled();
        expect(discoveryRuntime.adapter.setStatus).not.toHaveBeenCalled();
        expect(discoveryRuntime.adapter.restoreFocus).not.toHaveBeenCalled();

        const server = makeServer('srv-2', 'Server Two');
        const selection = createDeferred<ServerSelectSelectionResult>();
        const selectionRuntime = createRuntime({
            ports: createPorts({ selectServer: jest.fn().mockReturnValue(selection.promise) } as Partial<RuntimePorts>),
        });
        selectionRuntime.runtime.show({ allowAutoConnect: false });
        await selectionRuntime.runtime.whenIdle();
        selectionRuntime.runtime.selectServer(server);
        const selectionSignal = selectionRuntime.ports.selectServer.mock.calls[0]?.[1]?.signal;
        selectionRuntime.runtime.hide();
        clearAdapterMocks(selectionRuntime.adapter);

        expect(selectionSignal?.aborted).toBe(true);
        selection.resolve(selectedResult());
        await selectionRuntime.runtime.whenIdle();

        expect(selectionRuntime.adapter.setStatus).not.toHaveBeenCalled();
        expect(selectionRuntime.adapter.setError).not.toHaveBeenCalled();
        expect(selectionRuntime.adapter.renderServers).not.toHaveBeenCalled();
        expect(selectionRuntime.adapter.restoreFocus).not.toHaveBeenCalled();

        const autoServer = makeServer('srv-auto', 'Saved Server');
        const autoSelection = createDeferred<ServerSelectSelectionResult>();
        const autoSelectionStarted = createDeferred<void>();
        const autoPorts = createPorts({
            discoverServers: jest.fn().mockResolvedValue([autoServer]),
            selectServer: jest.fn().mockImplementation(() => {
                autoSelectionStarted.resolve();
                return autoSelection.promise;
            }),
            getSelectedServerScreenState: jest.fn(() => makeScreenState({ selectedServerId: autoServer.id })),
        } as Partial<RuntimePorts>);
        const autoRuntime = createRuntime({ ports: autoPorts });
        autoRuntime.runtime.show({ allowAutoConnect: true });
        await autoSelectionStarted.promise;
        const autoSelectSignal = autoPorts.selectServer.mock.calls[0]?.[1]?.signal;
        autoRuntime.runtime.hide();
        clearAdapterMocks(autoRuntime.adapter);

        expect(autoSelectSignal?.aborted).toBe(true);
        autoSelection.resolve(selectedResult());
        await autoRuntime.runtime.whenIdle();

        expect(autoRuntime.adapter.setStatus).not.toHaveBeenCalled();
        expect(autoRuntime.adapter.setError).not.toHaveBeenCalled();
        expect(autoRuntime.adapter.renderServers).not.toHaveBeenCalled();
        expect(autoRuntime.adapter.restoreFocus).not.toHaveBeenCalled();

        const clear = createDeferred<void>();
        const clearRuntime = createRuntime({
            ports: createPorts({
                discoverServers: jest.fn().mockResolvedValue([makeServer('srv-3', 'Server Three')]),
                clearSelectedServer: jest.fn().mockReturnValue(clear.promise),
            } as Partial<RuntimePorts>),
        });
        clearRuntime.runtime.show({ allowAutoConnect: false });
        await clearRuntime.runtime.whenIdle();
        clearRuntime.runtime.handleClearSelection();
        clearRuntime.runtime.destroy();
        clearAdapterMocks(clearRuntime.adapter);

        clear.resolve();
        await clearRuntime.runtime.whenIdle();

        expect(clearRuntime.adapter.setStatus).not.toHaveBeenCalled();
        expect(clearRuntime.adapter.renderServers).not.toHaveBeenCalled();
        expect(clearRuntime.adapter.restoreFocus).not.toHaveBeenCalled();
    });

    it('keeps whenIdle pending for focus restore until focus settles or destroy cancels it', async () => {
        const pendingFocusGenerations = new Set<number>();
        const adapter = createAdapter();
        adapter.restoreFocus.mockImplementation((generation) => {
            pendingFocusGenerations.add(generation);
        });
        const { runtime } = createRuntime({
            adapter,
            ports: createPorts({ discoverServers: jest.fn().mockResolvedValue([makeServer('srv-1', 'Server One')]) } as Partial<RuntimePorts>),
            hasPendingFocusRestore: (generation) => pendingFocusGenerations.has(generation),
        });

        runtime.show({ allowAutoConnect: false });
        await Promise.resolve();

        let idleSettled = false;
        const idle = runtime.whenIdle().then(() => {
            idleSettled = true;
        });
        await Promise.resolve();

        expect(idleSettled).toBe(false);

        pendingFocusGenerations.clear();
        runtime.notifyFocusRestoreSettled();
        await idle;

        expect(idleSettled).toBe(true);

        adapter.restoreFocus.mockImplementation((generation) => {
            pendingFocusGenerations.add(generation);
        });
        runtime.refresh();
        await Promise.resolve();

        let destroySettled = false;
        const destroyIdle = runtime.whenIdle().then(() => {
            destroySettled = true;
        });
        runtime.destroy();
        pendingFocusGenerations.clear();
        await destroyIdle;

        expect(destroySettled).toBe(true);
    });
});
