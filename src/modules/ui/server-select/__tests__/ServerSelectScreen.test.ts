/**
 * @jest-environment jsdom
 */

import {
    ServerSelectScreen,
    type ServerSelectScreenPorts,
    type ServerSelectScreenState,
} from '../ServerSelectScreen';
import type { ServerSelectScreenNavigationPort } from '../../../navigation';
import type { PlexServer } from '../../../plex/discovery/types';
import { createBodyAppendedTestContainer, createDeferred } from '../../../../__tests__/helpers';

type NavigationStub = ServerSelectScreenNavigationPort & {
    registerFocusable: jest.Mock;
    unregisterFocusable: jest.Mock;
    setFocus: jest.Mock;
    restoreFocusForCurrentScreen: jest.Mock;
    getCurrentScreen: jest.Mock;
    replaceScreen: jest.Mock;
};

type ServerSelectScreenHarness = jest.Mocked<ServerSelectScreenPorts> & {
    navigation: NavigationStub;
};

const createNavigationStub = (): NavigationStub => ({
    registerFocusable: jest.fn(),
    unregisterFocusable: jest.fn(),
    setFocus: jest.fn(),
    restoreFocusForCurrentScreen: jest.fn().mockReturnValue(false),
    getCurrentScreen: jest.fn().mockReturnValue('server-select'),
    replaceScreen: jest.fn(),
});

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

const makeSelectedServerResult = (): Extract<
    Awaited<ReturnType<ServerSelectScreenPorts['selectServer']>>,
    { kind: 'selected' }
> => ({
    kind: 'selected' as const,
});

const makeServerSelectState = (
    overrides: Partial<ServerSelectScreenState> = {}
): ServerSelectScreenState => ({
    selectedServerId: null,
    serverHealth: {},
    ...overrides,
});

const setServerSelectState = (
    orchestrator: ServerSelectScreenHarness,
    state: Partial<ServerSelectScreenState>
): void => {
    orchestrator.getSelectedServerScreenState.mockReturnValue(makeServerSelectState(state));
};

const createOrchestratorStub = (): ServerSelectScreenHarness => {
    const navigation = createNavigationStub();
    const requestChannelSetupRerun = jest.fn();
    return {
        navigation,
        getNavigation: jest.fn(() => navigation),
        discoverServers: jest.fn(),
        selectServer: jest.fn().mockResolvedValue({ kind: 'selection_failed', reason: 'unreachable' }),
        requestChannelSetupRerun,
        clearSelectedServer: jest.fn().mockResolvedValue(undefined),
        getSelectedServerScreenState: jest.fn(() => makeServerSelectState()),
    } as ServerSelectScreenHarness;
};

const settleScreen = async (screen: ServerSelectScreen): Promise<void> => {
    const idle = screen.whenIdle();
    await jest.runAllTimersAsync();
    await idle;
};

describe('ServerSelectScreen', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        document.body.innerHTML = '';
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it('renders the branded hero glyph above the title', () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        new ServerSelectScreen(container, orchestrator);

        const hero = container.querySelector('.server-select-glyph');
        const panel = container.querySelector('.screen-panel') as HTMLElement;
        const orderedClassNames = Array.from(panel.children).map((child) => child.className);

        expect(hero).not.toBeNull();
        expect(hero?.querySelector('svg')).not.toBeNull();
        expect(orderedClassNames[0]).toBe('screen-hero');
        expect(orderedClassNames[1]).toBe('screen-title');
    });

    it('relies on shared screen bootstrap while show and hide still own display lifecycle', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);

        const screen = new ServerSelectScreen(container, orchestrator);

        expect(container.style.position).toBe('');
        expect(container.style.inset).toBe('');
        expect(container.style.display).toBe('');
        expect(container.style.alignItems).toBe('');
        expect(container.style.justifyContent).toBe('');

        screen.show({ allowAutoConnect: false });
        await settleScreen(screen);
        expect(container.style.display).toBe('flex');

        screen.hide();
        expect(container.style.display).toBe('none');
    });

    it('appends latency and applies slow class for ok status', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);

        setServerSelectState(orchestrator, {
            serverHealth: {
                'srv-1': { status: 'ok', latencyMs: 250, testedAt: Date.now() },
            },
        });

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });

        await settleScreen(screen);

        const pill = container.querySelector('.server-status-pill') as HTMLElement;
        expect(pill.textContent).toContain('Slow • 250ms');
        expect(pill.classList.contains('latency-slow')).toBe(true);
    });

    it('applies very-slow class for >=500ms latency', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);

        setServerSelectState(orchestrator, {
            serverHealth: {
                'srv-1': { status: 'ok', latencyMs: 500, testedAt: Date.now() },
            },
        });

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });

        await settleScreen(screen);

        const pill = container.querySelector('.server-status-pill') as HTMLElement;
        expect(pill.textContent).toContain('Very Slow • 500ms');
        expect(pill.classList.contains('latency-very-slow')).toBe(true);
    });

    it('renders unknown health when the screen state has no server health record', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await settleScreen(screen);

        const pill = container.querySelector('.server-status-pill') as HTMLElement;
        expect(pill.textContent).toContain('Unknown');
        expect(orchestrator.getSelectedServerScreenState).toHaveBeenCalled();
    });

    it('renders access_denied health state explicitly', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);

        setServerSelectState(orchestrator, {
            serverHealth: {
                'srv-1': { status: 'access_denied', testedAt: Date.now() },
            },
        });

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await settleScreen(screen);

        const pill = container.querySelector('.server-status-pill') as HTMLElement;
        expect(pill.textContent).toContain('Access Denied');
        expect(pill.classList.contains('access-denied')).toBe(true);
    });

    it('reads screen-ready selected-server state without writing storage during show/refresh', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();
        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);

        const setSpy = jest.spyOn(Storage.prototype, 'setItem');
        const removeSpy = jest.spyOn(Storage.prototype, 'removeItem');

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await Promise.resolve();
        await screen.refresh();
        await settleScreen(screen);

        expect(orchestrator.getSelectedServerScreenState).toHaveBeenCalled();
        expect(setSpy).not.toHaveBeenCalled();
        expect(removeSpy).not.toHaveBeenCalled();

        setSpy.mockRestore();
        removeSpy.mockRestore();
    });

    it('marks saved server row as active and keeps reconnect enabled when healthy', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);

        setServerSelectState(orchestrator, {
            selectedServerId: 'srv-1',
            serverHealth: {
                'srv-1': { status: 'ok', latencyMs: 50, testedAt: Date.now() },
            },
        });

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });

        await settleScreen(screen);

        const activeRow = container.querySelector('.server-row.active') as HTMLElement;
        expect(activeRow).toBeTruthy();
        const button = activeRow.querySelector('button') as HTMLButtonElement;
        expect(button.textContent).toBe('Connected');
        expect(button.disabled).toBe(false);

        const nav = orchestrator.navigation;
        const focusableCalls = nav.registerFocusable.mock.calls as Array<[
            { id?: string; neighbors?: { down?: string } }
        ]>;
        const registeredIds = focusableCalls
            .map((call) => call[0]?.id)
            .filter((id): id is string => typeof id === 'string');
        expect(registeredIds).toContain('btn-server-select-srv-1');

        const findLastNeighbors = (id: string): { down?: string } | undefined => {
            const calls = focusableCalls.filter((call) => call[0]?.id === id);
            return calls.length ? (calls[calls.length - 1]![0].neighbors as { down?: string }) : undefined;
        };
        expect(findLastNeighbors('btn-server-refresh')?.down).toBe('btn-server-select-srv-1');
    });

    it('disambiguates colliding sanitized server ids with deterministic suffixes', async () => {
        const orchestrator = createOrchestratorStub();
        const nav = orchestrator.navigation;
        const container = createBodyAppendedTestContainer();

        orchestrator.discoverServers.mockResolvedValue([
            makeServer('srv/1', 'Server One'),
            makeServer('srv_1', 'Server Two'),
        ]);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await settleScreen(screen);

        const serverIds = nav.registerFocusable.mock.calls
            .map((call) => (call[0] as { id?: string })?.id)
            .filter((id): id is string => typeof id === 'string' && id.startsWith('btn-server-select-srv_1'));

        expect(serverIds).toContain('btn-server-select-srv_1');
        expect(serverIds.some((id) => /^btn-server-select-srv_1-[0-9a-f]{8}$/.test(id))).toBe(true);
        expect(new Set(serverIds).size).toBe(serverIds.length);
    });

    it('does not auto-connect saved server by default', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.selectServer.mockResolvedValue(makeSelectedServerResult());

        setServerSelectState(orchestrator, { selectedServerId: 'srv-1' });

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show();

        await settleScreen(screen);

        expect(orchestrator.selectServer).not.toHaveBeenCalled();
        const status = container.querySelector('.screen-status') as HTMLElement;
        expect(status.textContent).toContain('Select a server from the list.');
    });

    it('shows auto-connect hint only when explicitly requested', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        let resolveDiscovery: (servers: PlexServer[]) => void = () => {};
        orchestrator.discoverServers.mockImplementation(
            () => new Promise<PlexServer[]>((resolve) => {
                resolveDiscovery = resolve;
            })
        );
        orchestrator.selectServer.mockResolvedValue({ kind: 'selection_failed', reason: 'unreachable' });
        setServerSelectState(orchestrator, { selectedServerId: 'srv-1' });

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: true });

        const hint = container.querySelector('.server-autoconnect-hint') as HTMLElement | null;
        const status = container.querySelector('.screen-status') as HTMLElement | null;
        expect(hint).not.toBeNull();
        expect(hint?.classList.contains('visible')).toBe(true);
        expect(status?.textContent).toContain('Reconnecting to saved server');

        resolveDiscovery([makeServer('srv-1', 'Server One')]);
        await settleScreen(screen);

        expect(hint?.classList.contains('visible')).toBe(false);
    });

    it('hides auto-connect hint before showing connected state after saved-server auto-select succeeds', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.selectServer.mockResolvedValue(makeSelectedServerResult());

        setServerSelectState(orchestrator, { selectedServerId: 'srv-1' });

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: true });
        await settleScreen(screen);

        const hint = container.querySelector('.server-autoconnect-hint') as HTMLElement | null;
        const status = container.querySelector('.screen-status') as HTMLElement | null;

        expect(orchestrator.selectServer).toHaveBeenCalledWith('srv-1');
        expect(hint?.classList.contains('visible')).toBe(false);
        expect(hint?.hasAttribute('hidden')).toBe(true);
        expect(status?.textContent).toContain('Connected…');
    });

    it('keeps reconnect enabled when saved server auto-select fails', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.selectServer.mockResolvedValue({ kind: 'selection_failed', reason: 'unreachable' });

        setServerSelectState(orchestrator, {
            selectedServerId: 'srv-1',
            serverHealth: {
                'srv-1': { status: 'ok', latencyMs: 50, testedAt: Date.now() },
            },
        });

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: true });

        await settleScreen(screen);

        const activeRow = container.querySelector('.server-row.active') as HTMLElement;
        const button = activeRow.querySelector('button') as HTMLButtonElement;
        const status = container.querySelector('.screen-status') as HTMLElement;
        expect(button.textContent).toBe('Reconnect');
        expect(button.disabled).toBe(false);
        expect(status.textContent).toContain('Saved server unavailable.');
    });

    it('refreshes server health after a saved server auto-select failure updates screen state', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();
        const testedAt = Date.now();

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.selectServer.mockImplementation(async () => {
            setServerSelectState(orchestrator, {
                selectedServerId: 'srv-1',
                serverHealth: {
                    'srv-1': { status: 'auth_required', testedAt: testedAt + 1000 },
                },
            });
            return { kind: 'selection_failed', reason: 'auth_required' };
        });
        setServerSelectState(orchestrator, {
            selectedServerId: 'srv-1',
            serverHealth: {
                'srv-1': { status: 'ok', latencyMs: 50, testedAt },
            },
        });

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: true });
        await settleScreen(screen);

        const activeRow = container.querySelector('.server-row.active') as HTMLElement;
        const pill = activeRow.querySelector('.server-status-pill') as HTMLElement;
        const button = activeRow.querySelector('button') as HTMLButtonElement;

        expect(orchestrator.getSelectedServerScreenState).toHaveBeenCalledTimes(2);
        expect(pill.textContent).toContain('Auth Required');
        expect(button.textContent).toBe('Reconnect');
        expect(container.querySelector('.screen-status')?.textContent).toContain('Saved server unavailable.');
    });

    it('shows explicit auth-required guidance when selection fails with auth_required', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.selectServer.mockResolvedValue({ kind: 'selection_failed', reason: 'auth_required' });

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await settleScreen(screen);

        const button = container.querySelector('.server-row button') as HTMLButtonElement;
        button.click();
        await settleScreen(screen);

        const error = container.querySelector('.screen-error') as HTMLElement;
        expect(error.textContent ?? '').toContain('Authentication required');
    });

    it('shows explicit access-denied guidance when selection fails with access_denied', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.selectServer.mockResolvedValue({ kind: 'selection_failed', reason: 'access_denied' });

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await settleScreen(screen);

        const button = container.querySelector('.server-row button') as HTMLButtonElement;
        button.click();
        await settleScreen(screen);

        const error = container.querySelector('.screen-error') as HTMLElement;
        expect(error.textContent ?? '').toContain('does not have access to that server');
    });

    it('surfaces discovery failures through screen error UI without console logging', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        orchestrator.discoverServers.mockRejectedValueOnce(new Error('discovery failed'));

        try {
            const screen = new ServerSelectScreen(container, orchestrator);
            screen.show({ allowAutoConnect: false });
            await Promise.resolve();

            expect(container.querySelector('.screen-status')?.textContent).toBe('Discovery failed.');
            expect(container.querySelector('.screen-error')?.textContent).toBe('discovery failed');
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });

    it('surfaces screen-state query failures thrown before async discovery starts through screen error UI', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        orchestrator.getSelectedServerScreenState.mockImplementation(() => {
            throw new Error('screen state unavailable');
        });

        try {
            const screen = new ServerSelectScreen(container, orchestrator);
            screen.show({ allowAutoConnect: true });
            await settleScreen(screen);

            expect(container.querySelector('.screen-status')?.textContent).toBe('Discovery failed.');
            expect(container.querySelector('.screen-error')?.textContent).toBe('screen state unavailable');
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });

    it('surfaces thrown selection failures through screen error UI without console logging', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.selectServer.mockRejectedValueOnce(new Error('select failed'));

        try {
            const screen = new ServerSelectScreen(container, orchestrator);
            screen.show({ allowAutoConnect: false });
            await settleScreen(screen);

            const button = container.querySelector('.server-row button') as HTMLButtonElement;
            button.click();
            await settleScreen(screen);

            expect(container.querySelector('.screen-status')?.textContent).toBe('Connection failed.');
            expect(container.querySelector('.screen-error')?.textContent).toBe('select failed');
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });

    it('recovers from a synchronous pre-await selectServer throw without leaving the UI locked', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.selectServer.mockImplementation(() => {
            throw new Error('sync select failed');
        });

        try {
            const screen = new ServerSelectScreen(container, orchestrator);
            screen.show({ allowAutoConnect: false });
            await settleScreen(screen);

            const connectButton = container.querySelector('.server-row button') as HTMLButtonElement;
            const clearButton = container.querySelector('#btn-server-forget') as HTMLButtonElement;

            connectButton.click();
            await settleScreen(screen);

            expect(container.querySelector('.screen-status')?.textContent).toBe('Connection failed.');
            expect(container.querySelector('.screen-error')?.textContent).toBe('sync select failed');
            expect(connectButton.disabled).toBe(false);
            expect(clearButton.disabled).toBe(false);
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });

    it('ignores concurrent manual server selection requests while one is in flight', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        const selectDeferred = createDeferred<Awaited<ReturnType<ServerSelectScreenPorts['selectServer']>>>();
        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.selectServer.mockReturnValue(selectDeferred.promise);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await settleScreen(screen);

        const button = container.querySelector('.server-row button') as HTMLButtonElement;
        expect(button.disabled).toBe(false);

        button.click();
        button.click();

        expect(orchestrator.selectServer).toHaveBeenCalledTimes(1);
        expect(button.disabled).toBe(true);
        expect(container.querySelector('.screen-status')?.textContent).toBe('Connecting to Server One…');

        selectDeferred.resolve(makeSelectedServerResult());
        await settleScreen(screen);

        expect(button.disabled).toBe(false);
        expect(container.querySelector('.screen-status')?.textContent).toBe('Connected to Server One.');
    });

    it('does not update hidden UI when manual server selection completes after hide', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        const selectDeferred = createDeferred<Awaited<ReturnType<ServerSelectScreenPorts['selectServer']>>>();
        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.selectServer.mockReturnValue(selectDeferred.promise);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await settleScreen(screen);

        const button = container.querySelector('.server-row button') as HTMLButtonElement;
        button.click();

        expect(container.querySelector('.screen-status')?.textContent).toBe('Connecting to Server One…');

        screen.hide();
        selectDeferred.resolve(makeSelectedServerResult());
        await settleScreen(screen);

        expect(orchestrator.selectServer).toHaveBeenCalledTimes(1);
        expect(container.querySelector('.screen-status')?.textContent).toBe('Connecting to Server One…');
    });

    it('keeps re-shown server buttons disabled while a previous manual selection is pending and re-enables after it settles', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        const server = makeServer('srv-1', 'Server One');
        const selectDeferred = createDeferred<Awaited<ReturnType<ServerSelectScreenPorts['selectServer']>>>();

        orchestrator.discoverServers.mockResolvedValue([server]);
        orchestrator.selectServer.mockReturnValue(selectDeferred.promise);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await settleScreen(screen);

        const firstButton = container.querySelector('.server-row button') as HTMLButtonElement;
        expect(firstButton.disabled).toBe(false);

        firstButton.click();

        expect(orchestrator.selectServer).toHaveBeenCalledTimes(1);
        expect(firstButton.disabled).toBe(true);
        expect(container.querySelector('.screen-status')?.textContent).toBe('Connecting to Server One…');

        screen.hide();
        screen.show({ allowAutoConnect: false });
        await Promise.resolve();

        const reShownButton = container.querySelector('.server-row button') as HTMLButtonElement;
        expect(reShownButton.disabled).toBe(true);
        expect(container.querySelector('.screen-status')?.textContent).toContain('Selection in progress');

        reShownButton.click();
        expect(orchestrator.selectServer).toHaveBeenCalledTimes(1);

        selectDeferred.resolve(makeSelectedServerResult());
        await settleScreen(screen);

        const enabledButton = container.querySelector('.server-row button') as HTMLButtonElement;
        expect(enabledButton.disabled).toBe(false);
        expect(container.querySelector('.screen-status')?.textContent).toBe('Select a server from the list.');

        enabledButton.click();
        expect(orchestrator.selectServer).toHaveBeenCalledTimes(2);
    });

    it('does not auto-connect a saved server while a previous manual selection is pending', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        const server = makeServer('srv-1', 'Server One');
        const selectDeferred = createDeferred<Awaited<ReturnType<ServerSelectScreenPorts['selectServer']>>>();

        orchestrator.discoverServers.mockResolvedValue([server]);
        orchestrator.selectServer.mockReturnValue(selectDeferred.promise);
        setServerSelectState(orchestrator, { selectedServerId: 'srv-1' });

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await settleScreen(screen);

        const firstButton = container.querySelector('.server-row button') as HTMLButtonElement;
        firstButton.click();

        expect(orchestrator.selectServer).toHaveBeenCalledTimes(1);
        expect(container.querySelector('.screen-status')?.textContent).toBe('Connecting to Server One…');

        screen.hide();
        screen.show({ allowAutoConnect: true });
        await Promise.resolve();

        expect(orchestrator.selectServer).toHaveBeenCalledTimes(1);
        expect(container.querySelector('.screen-status')?.textContent).toContain('Selection in progress');

        const reShownButton = container.querySelector('.server-row button') as HTMLButtonElement;
        expect(reShownButton.disabled).toBe(true);

        selectDeferred.resolve(makeSelectedServerResult());
        await settleScreen(screen);

        const enabledButton = container.querySelector('.server-row button') as HTMLButtonElement;
        expect(enabledButton.disabled).toBe(false);
        expect(container.querySelector('.screen-status')?.textContent).toBe('Select a server from the list.');
    });

    it('does not clear the saved server while server selection is in flight', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        const server = makeServer('srv-1', 'Server One');
        const selectDeferred = createDeferred<Awaited<ReturnType<ServerSelectScreenPorts['selectServer']>>>();

        orchestrator.discoverServers.mockResolvedValue([server]);
        orchestrator.selectServer.mockReturnValue(selectDeferred.promise);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await settleScreen(screen);

        const connectButton = container.querySelector('.server-row button') as HTMLButtonElement;
        const clearButton = container.querySelector('#btn-server-forget') as HTMLButtonElement;

        connectButton.click();

        expect(orchestrator.selectServer).toHaveBeenCalledTimes(1);
        expect(clearButton.disabled).toBe(true);

        clearButton.click();

        expect(orchestrator.clearSelectedServer).not.toHaveBeenCalled();

        selectDeferred.resolve(makeSelectedServerResult());
        await settleScreen(screen);

        expect(clearButton.disabled).toBe(false);
    });

    it('recovers from a synchronous pre-await clearSelectedServer throw without leaving the clear action locked', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.clearSelectedServer.mockImplementation(() => {
            throw new Error('sync clear failed');
        });

        try {
            const screen = new ServerSelectScreen(container, orchestrator);
            screen.show({ allowAutoConnect: false });
            await settleScreen(screen);

            const clearButton = container.querySelector('#btn-server-forget') as HTMLButtonElement;
            clearButton.click();
            await settleScreen(screen);

            expect(container.querySelector('.screen-status')?.textContent).toBe('Selection not cleared.');
            expect(container.querySelector('.screen-error')?.textContent).toBe('sync clear failed');
            expect(clearButton.disabled).toBe(false);
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });

    it('removes disabled connect buttons from the navigation focus graph during selection', async () => {
        const orchestrator = createOrchestratorStub();
        const nav = orchestrator.navigation;
        const container = createBodyAppendedTestContainer();

        const server = makeServer('srv-1', 'Server One');
        const selectDeferred = createDeferred<Awaited<ReturnType<ServerSelectScreenPorts['selectServer']>>>();

        orchestrator.discoverServers.mockResolvedValue([server]);
        orchestrator.selectServer.mockReturnValue(selectDeferred.promise);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await settleScreen(screen);

        const connectButton = container.querySelector('.server-row button') as HTMLButtonElement;

        nav.unregisterFocusable.mockClear();
        nav.registerFocusable.mockClear();

        connectButton.click();

        expect(nav.unregisterFocusable).toHaveBeenCalledWith('btn-server-select-srv-1');

        const latestRefreshRegistration = [...nav.registerFocusable.mock.calls]
            .reverse()
            .find((call) => call[0]?.id === 'btn-server-refresh');

        expect(latestRefreshRegistration?.[0].neighbors.down).toBeUndefined();

        selectDeferred.resolve(makeSelectedServerResult());
        await settleScreen(screen);

        expect(nav.registerFocusable).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'btn-server-select-srv-1',
                restoreGroup: 'server-select-list',
            })
        );
    });

    it('ignores manual selection failures after hide without updating hidden UI or logging', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

        try {
            const orchestrator = createOrchestratorStub();
            const container = createBodyAppendedTestContainer();

            const selectDeferred = createDeferred<Awaited<ReturnType<ServerSelectScreenPorts['selectServer']>>>();
            orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
            orchestrator.selectServer.mockReturnValue(selectDeferred.promise);

            const screen = new ServerSelectScreen(container, orchestrator);
            screen.show({ allowAutoConnect: false });
            await settleScreen(screen);

            const button = container.querySelector('.server-row button') as HTMLButtonElement;
            button.click();
            screen.hide();

            selectDeferred.reject(new Error('select failed'));
            await settleScreen(screen);

            expect(container.querySelector('.screen-status')?.textContent).toBe('Connecting to Server One…');
            expect(container.querySelector('.screen-error')?.textContent).toBe('');
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });

    it('shows saved server unavailable state when saved server is missing from discovery results', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-2', 'Server Two')]);
        setServerSelectState(orchestrator, { selectedServerId: 'srv-1' });

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: true });

        await settleScreen(screen);

        const status = container.querySelector('.screen-status') as HTMLElement;
        expect(orchestrator.selectServer).not.toHaveBeenCalled();
        expect(status.textContent).toContain('Saved server unavailable.');
    });

    it('renders empty state and removes down neighbors when list is empty', async () => {
        const orchestrator = createOrchestratorStub();
        const nav = orchestrator.navigation;
        const container = createBodyAppendedTestContainer();

        orchestrator.discoverServers.mockResolvedValue([]);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });

        await settleScreen(screen);

        const emptyState = container.querySelector('.server-empty-state');
        expect(emptyState).toBeTruthy();

        const findLastNeighbors = (id: string): unknown => {
            const calls = nav.registerFocusable.mock.calls.filter((call) => call[0]?.id === id);
            return calls.length ? calls[calls.length - 1][0].neighbors : undefined;
        };

        const refreshNeighbors = findLastNeighbors('btn-server-refresh') as { down?: string } | undefined;
        const setupNeighbors = findLastNeighbors('btn-server-setup') as { down?: string } | undefined;
        const forgetNeighbors = findLastNeighbors('btn-server-forget') as { down?: string } | undefined;

        expect(refreshNeighbors?.down).toBeUndefined();
        expect(setupNeighbors?.down).toBeUndefined();
        expect(forgetNeighbors?.down).toBeUndefined();
    });

    it('does not unregister static focusables when updating static neighbors', async () => {
        const orchestrator = createOrchestratorStub();
        const nav = orchestrator.navigation;
        const container = createBodyAppendedTestContainer();

        orchestrator.discoverServers.mockResolvedValue([
            makeServer('srv-1', 'Server One'),
            makeServer('srv-2', 'Server Two'),
        ]);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });

        await settleScreen(screen);

        const unregisteredIds = nav.unregisterFocusable.mock.calls.map((call) => call[0] as string | undefined);
        expect(unregisteredIds).not.toContain('btn-server-refresh');
        expect(unregisteredIds).not.toContain('btn-server-setup');
        expect(unregisteredIds).not.toContain('btn-server-switch-profile');
        expect(unregisteredIds).not.toContain('btn-server-forget');
    });

    it('unregisters stale server focusables before rendering refreshed server list', async () => {
        const orchestrator = createOrchestratorStub();
        const nav = orchestrator.navigation;
        const container = createBodyAppendedTestContainer();

        orchestrator.discoverServers
            .mockResolvedValueOnce([
                makeServer('srv-1', 'Server One'),
                makeServer('srv-2', 'Server Two'),
            ])
            .mockResolvedValueOnce([
                makeServer('srv-1', 'Server One'),
            ]);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await settleScreen(screen);

        await screen.refresh();
        await settleScreen(screen);

        const unregisteredIds = nav.unregisterFocusable.mock.calls.map((call) => call[0] as string | undefined);
        expect(unregisteredIds).toContain('btn-server-select-srv-1');
        expect(unregisteredIds).toContain('btn-server-select-srv-2');
    });

    it('restores focus to refresh after clearing saved server', async () => {
        const orchestrator = createOrchestratorStub();
        const nav = orchestrator.navigation;
        const container = createBodyAppendedTestContainer();

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await settleScreen(screen);

        nav.setFocus.mockClear();

        const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement | null;
        expect(clearBtn).not.toBeNull();
        clearBtn?.click();
        await settleScreen(screen);

        expect(container.querySelectorAll('.server-row')).toHaveLength(1);
        expect(container.querySelector('.server-empty-state')).toBeNull();
        const status = container.querySelector('.screen-status') as HTMLElement | null;
        const detail = container.querySelector('.screen-detail') as HTMLElement | null;
        expect(status?.textContent).toBe('Selection cleared.');
        expect(detail?.textContent).toBe('Pick a server to continue.');

        expect(nav.setFocus).toHaveBeenCalledWith('btn-server-refresh');
    });

    it('preserves server health while removing active row state after clearing saved server', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();
        const testedAt = Date.now();

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.clearSelectedServer.mockImplementation(async () => {
            setServerSelectState(orchestrator, {
                selectedServerId: null,
                serverHealth: {
                    'srv-1': { status: 'ok', latencyMs: 50, testedAt },
                },
            });
        });
        setServerSelectState(orchestrator, {
            selectedServerId: 'srv-1',
            serverHealth: {
                'srv-1': { status: 'ok', latencyMs: 50, testedAt },
            },
        });

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await settleScreen(screen);

        const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement;
        clearBtn.click();
        await settleScreen(screen);

        expect(container.querySelector('.server-row.active')).toBeNull();
        const row = container.querySelector('.server-row') as HTMLElement;
        const pill = row.querySelector('.server-status-pill') as HTMLElement;
        const button = row.querySelector('button') as HTMLButtonElement;
        expect(pill.textContent).toContain('OK');
        expect(pill.textContent).toContain('50ms');
        expect(button.textContent).toBe('Connect');
    });

    it('shows an error and keeps the server list when clearing saved server fails without console logging', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

        try {
            const orchestrator = createOrchestratorStub();
            const container = createBodyAppendedTestContainer();

            orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
            orchestrator.clearSelectedServer.mockRejectedValueOnce(new Error('store failed'));

            const screen = new ServerSelectScreen(container, orchestrator);
            screen.show({ allowAutoConnect: false });
            await settleScreen(screen);

            const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement | null;
            expect(clearBtn).not.toBeNull();

            clearBtn?.click();
            await settleScreen(screen);

            expect(orchestrator.clearSelectedServer).toHaveBeenCalledTimes(1);
            expect(container.querySelectorAll('.server-row')).toHaveLength(1);

            const status = container.querySelector('.screen-status') as HTMLElement | null;
            const detail = container.querySelector('.screen-detail') as HTMLElement | null;
            const error = container.querySelector('.screen-error') as HTMLElement | null;

            expect(status?.textContent).toBe('Selection not cleared.');
            expect(detail?.textContent).toBe('Try again.');
            expect(error?.textContent).toBe('store failed');
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });

    it('ignores concurrent clear saved server requests while one is in flight', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        const deferred = createDeferred<void>();
        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.clearSelectedServer.mockReturnValue(deferred.promise);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await settleScreen(screen);

        const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement | null;
        expect(clearBtn).not.toBeNull();

        clearBtn?.click();
        clearBtn?.click();

        expect(orchestrator.clearSelectedServer).toHaveBeenCalledTimes(1);

        deferred.resolve();
        await settleScreen(screen);

        expect(container.querySelector('.screen-status')?.textContent).toBe('Selection cleared.');
    });

    it('disables the clear saved server button while clear is in flight and reenables it after success', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        const clearDeferred = createDeferred<void>();
        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.clearSelectedServer.mockReturnValue(clearDeferred.promise);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await settleScreen(screen);

        const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement | null;
        expect(clearBtn).not.toBeNull();
        expect(clearBtn?.disabled).toBe(false);

        clearBtn?.click();

        expect(orchestrator.clearSelectedServer).toHaveBeenCalledTimes(1);
        expect(clearBtn?.disabled).toBe(true);

        clearDeferred.resolve();
        await settleScreen(screen);

        expect(clearBtn?.disabled).toBe(false);
        expect(container.querySelector('.screen-status')?.textContent).toBe('Selection cleared.');
    });

    it('reenables the clear saved server button after a visible clear failure', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

        try {
            const orchestrator = createOrchestratorStub();
            const container = createBodyAppendedTestContainer();

            const clearDeferred = createDeferred<void>();
            orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
            orchestrator.clearSelectedServer.mockReturnValue(clearDeferred.promise);

            const screen = new ServerSelectScreen(container, orchestrator);
            screen.show({ allowAutoConnect: false });
            await settleScreen(screen);

            const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement | null;
            expect(clearBtn).not.toBeNull();
            expect(clearBtn?.disabled).toBe(false);

            clearBtn?.click();

            expect(orchestrator.clearSelectedServer).toHaveBeenCalledTimes(1);
            expect(clearBtn?.disabled).toBe(true);

            clearDeferred.reject(new Error('store failed'));
            await settleScreen(screen);

            expect(clearBtn?.disabled).toBe(false);
            expect(container.querySelector('.screen-status')?.textContent).toBe('Selection not cleared.');
            expect(container.querySelector('.screen-detail')?.textContent).toBe('Try again.');
            expect(container.querySelector('.screen-error')?.textContent).toBe('store failed');
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });

    it('does not let a stale clear completion reenable clear while the current visibility generation is loading', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        const clearDeferred = createDeferred<void>();
        const secondDiscovery = createDeferred<PlexServer[]>();

        orchestrator.discoverServers
            .mockResolvedValueOnce([makeServer('srv-1', 'Server One')])
            .mockReturnValueOnce(secondDiscovery.promise);
        orchestrator.clearSelectedServer.mockReturnValue(clearDeferred.promise);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await settleScreen(screen);

        const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement | null;
        expect(clearBtn).not.toBeNull();
        expect(clearBtn?.disabled).toBe(false);

        clearBtn?.click();

        expect(clearBtn?.disabled).toBe(true);

        screen.hide();
        screen.show({ allowAutoConnect: false });
        await Promise.resolve();

        expect(orchestrator.discoverServers).toHaveBeenCalledTimes(2);
        expect(clearBtn?.disabled).toBe(true);

        clearDeferred.resolve();
        await Promise.resolve();

        expect(clearBtn?.disabled).toBe(true);

        secondDiscovery.resolve([makeServer('srv-2', 'Second Server')]);
        await settleScreen(screen);

        expect(clearBtn?.disabled).toBe(false);

        const serverRows = Array.from(container.querySelectorAll('.server-row'));
        expect(serverRows).toHaveLength(1);
        expect(serverRows[0]?.textContent).toContain('Second Server');
    });

    it('keeps clear disabled when current discovery finishes before a stale clear settles', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        const clearDeferred = createDeferred<void>();
        const secondDiscovery = createDeferred<PlexServer[]>();

        orchestrator.discoverServers
            .mockResolvedValueOnce([makeServer('srv-1', 'Server One')])
            .mockReturnValueOnce(secondDiscovery.promise);
        orchestrator.clearSelectedServer.mockReturnValue(clearDeferred.promise);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await settleScreen(screen);

        const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement | null;
        expect(clearBtn).not.toBeNull();
        expect(clearBtn?.disabled).toBe(false);

        clearBtn?.click();

        expect(orchestrator.clearSelectedServer).toHaveBeenCalledTimes(1);
        expect(clearBtn?.disabled).toBe(true);

        screen.hide();
        screen.show({ allowAutoConnect: false });
        await Promise.resolve();

        expect(orchestrator.discoverServers).toHaveBeenCalledTimes(2);

        secondDiscovery.resolve([makeServer('srv-2', 'Second Server')]);
        await Promise.resolve();

        expect(clearBtn?.disabled).toBe(true);

        clearBtn?.click();
        expect(orchestrator.clearSelectedServer).toHaveBeenCalledTimes(1);

        clearDeferred.resolve();
        await settleScreen(screen);

        expect(clearBtn?.disabled).toBe(false);
    });

    it('does not update hidden UI or re-register focusables when clear completes after hide', async () => {
        const orchestrator = createOrchestratorStub();
        const nav = orchestrator.navigation;
        const container = createBodyAppendedTestContainer();

        const deferred = createDeferred<void>();
        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.clearSelectedServer.mockReturnValue(deferred.promise);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await settleScreen(screen);

        const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement | null;
        expect(clearBtn).not.toBeNull();

        nav.registerFocusable.mockClear();
        nav.setFocus.mockClear();

        clearBtn?.click();
        screen.hide();

        deferred.resolve();
        await settleScreen(screen);

        expect(container.querySelector('.screen-status')?.textContent).not.toBe('Selection cleared.');
        expect(nav.registerFocusable).not.toHaveBeenCalled();
        expect(nav.setFocus).not.toHaveBeenCalled();
    });

    it('ignores clear failures after hide without updating hidden UI or logging', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

        try {
            const orchestrator = createOrchestratorStub();
            const container = createBodyAppendedTestContainer();

            const deferred = createDeferred<void>();
            orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
            orchestrator.clearSelectedServer.mockReturnValue(deferred.promise);

            const screen = new ServerSelectScreen(container, orchestrator);
            screen.show({ allowAutoConnect: false });
            await settleScreen(screen);

            const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement | null;
            expect(clearBtn).not.toBeNull();

            clearBtn?.click();
            screen.hide();

            deferred.reject(new Error('store failed'));
            await settleScreen(screen);

            expect(container.querySelector('.screen-status')?.textContent).not.toBe('Selection not cleared.');
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });

    it('does not update hidden UI or restore focus when discovery resolves after hide', async () => {
        const orchestrator = createOrchestratorStub();
        const nav = orchestrator.navigation;
        const container = createBodyAppendedTestContainer();

        const deferred = createDeferred<PlexServer[]>();
        orchestrator.discoverServers.mockReturnValue(deferred.promise);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await Promise.resolve();

        nav.registerFocusable.mockClear();
        nav.setFocus.mockClear();

        screen.hide();

        deferred.resolve([makeServer('srv-1', 'Server One')]);
        await settleScreen(screen);

        expect(container.querySelectorAll('.server-row')).toHaveLength(0);
        expect(nav.registerFocusable).not.toHaveBeenCalled();
        expect(nav.setFocus).not.toHaveBeenCalled();
    });

    it('ignores stale discovery results from a previous visibility session after hide and show', async () => {
        const orchestrator = createOrchestratorStub();
        const nav = orchestrator.navigation;
        const container = createBodyAppendedTestContainer();

        const firstDiscovery = createDeferred<PlexServer[]>();
        const secondServer = makeServer('srv-2', 'Second Server');
        orchestrator.discoverServers
            .mockReturnValueOnce(firstDiscovery.promise)
            .mockResolvedValueOnce([secondServer]);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await Promise.resolve();

        screen.hide();
        screen.show({ allowAutoConnect: false });
        await Promise.resolve();

        expect(orchestrator.discoverServers).toHaveBeenCalledTimes(2);

        firstDiscovery.resolve([makeServer('srv-1', 'Stale Server')]);
        await settleScreen(screen);

        const serverRows = Array.from(container.querySelectorAll('.server-row'));
        expect(serverRows).toHaveLength(1);
        expect(serverRows[0]?.textContent).toContain('Second Server');
        expect(serverRows[0]?.textContent).not.toContain('Stale Server');
        expect(nav.setFocus).toHaveBeenCalledWith('btn-server-refresh');
    });

    it('ignores discovery failures after hide without updating hidden UI or logging', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

        try {
            const orchestrator = createOrchestratorStub();
            const container = createBodyAppendedTestContainer();

            const deferred = createDeferred<PlexServer[]>();
            orchestrator.discoverServers.mockReturnValue(deferred.promise);

            const screen = new ServerSelectScreen(container, orchestrator);
            screen.show({ allowAutoConnect: false });
            await Promise.resolve();

            screen.hide();

            deferred.reject(new Error('discovery failed'));
            await settleScreen(screen);

            expect(container.querySelector('.screen-status')?.textContent).not.toBe('Discovery failed.');
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });

    it('ignores stale clear results from a previous visibility session after hide and show', async () => {
        const orchestrator = createOrchestratorStub();
        const container = createBodyAppendedTestContainer();

        const clearDeferred = createDeferred<void>();
        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.clearSelectedServer.mockReturnValue(clearDeferred.promise);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await settleScreen(screen);

        const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement | null;
        expect(clearBtn).not.toBeNull();

        clearBtn?.click();
        screen.hide();
        screen.show({ allowAutoConnect: false });
        await Promise.resolve();

        expect(container.querySelector('.screen-status')?.textContent).toBe('Select a server from the list.');

        clearDeferred.resolve();
        await settleScreen(screen);

        expect(container.querySelector('.screen-status')?.textContent).toBe('Select a server from the list.');
        expect(container.querySelectorAll('.server-row')).toHaveLength(1);
    });

    it('uses navigation restore entrypoint before refresh-button fallback', async () => {
        const orchestrator = createOrchestratorStub();
        const nav = orchestrator.navigation;
        nav.restoreFocusForCurrentScreen.mockReturnValue(true);
        const container = createBodyAppendedTestContainer();

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await settleScreen(screen);

        nav.setFocus.mockClear();
        nav.restoreFocusForCurrentScreen.mockClear();

        const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement | null;
        clearBtn?.click();

        await settleScreen(screen);
        expect(nav.restoreFocusForCurrentScreen).toHaveBeenCalledTimes(1);
        expect(nav.setFocus).not.toHaveBeenCalledWith('btn-server-refresh');
    });
});
