/**
 * @jest-environment jsdom
 */

import { ServerSelectScreen } from '../ServerSelectScreen';

type NavigationStub = {
    registerFocusable: jest.Mock;
    unregisterFocusable: jest.Mock;
    setFocus: jest.Mock;
    restoreFocusForCurrentScreen: jest.Mock;
    getCurrentScreen: jest.Mock;
    replaceScreen: jest.Mock;
};

const createNavigationStub = (): NavigationStub => ({
    registerFocusable: jest.fn(),
    unregisterFocusable: jest.fn(),
    setFocus: jest.fn(),
    restoreFocusForCurrentScreen: jest.fn().mockReturnValue(false),
    getCurrentScreen: jest.fn().mockReturnValue('server-select'),
    replaceScreen: jest.fn(),
});

type OrchestratorStub = {
    getNavigation: () => NavigationStub;
    discoverServers: jest.Mock;
    selectServer: jest.Mock;
    requestChannelSetupRerun: jest.Mock;
    clearSelectedServer: jest.Mock;
    getSelectedServerStorageKey: () => string;
    getServerHealthStorageKey: () => string;
};

const createOrchestratorStub = (): OrchestratorStub => {
    const navigation = createNavigationStub();
    return {
        getNavigation: () => navigation,
        discoverServers: jest.fn(),
        selectServer: jest.fn().mockResolvedValue(false),
        requestChannelSetupRerun: jest.fn(),
        clearSelectedServer: jest.fn(),
        getSelectedServerStorageKey: () => 'selected-server-id',
        getServerHealthStorageKey: () => 'server-health',
    };
};

describe('ServerSelectScreen', () => {
    afterEach(() => {
        localStorage.clear();
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    it('appends latency and applies slow class for ok status', async () => {
        const orchestrator = createOrchestratorStub();
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([
            { id: 'srv-1', name: 'Server One', owned: true },
        ]);

        localStorage.setItem(
            orchestrator.getServerHealthStorageKey(),
            JSON.stringify({
                'srv-1': { status: 'ok', latencyMs: 250, testedAt: Date.now() },
            })
        );

        const screen = new ServerSelectScreen(container, orchestrator as never);
        screen.show({ allowAutoConnect: false });

        await new Promise((resolve) => setTimeout(resolve, 0));

        const pill = container.querySelector('.server-status-pill') as HTMLElement;
        expect(pill.textContent).toContain('Slow • 250ms');
        expect(pill.classList.contains('latency-slow')).toBe(true);
    });

    it('applies very-slow class for >=500ms latency', async () => {
        const orchestrator = createOrchestratorStub();
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([
            { id: 'srv-1', name: 'Server One', owned: true },
        ]);

        localStorage.setItem(
            orchestrator.getServerHealthStorageKey(),
            JSON.stringify({
                'srv-1': { status: 'ok', latencyMs: 500, testedAt: Date.now() },
            })
        );

        const screen = new ServerSelectScreen(container, orchestrator as never);
        screen.show({ allowAutoConnect: false });

        await new Promise((resolve) => setTimeout(resolve, 0));

        const pill = container.querySelector('.server-status-pill') as HTMLElement;
        expect(pill.textContent).toContain('Very Slow • 500ms');
        expect(pill.classList.contains('latency-very-slow')).toBe(true);
    });

    it('marks saved server row as active and keeps reconnect enabled when healthy', async () => {
        const orchestrator = createOrchestratorStub();
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([
            { id: 'srv-1', name: 'Server One', owned: true },
        ]);

        localStorage.setItem(orchestrator.getSelectedServerStorageKey(), 'srv-1');
        localStorage.setItem(
            orchestrator.getServerHealthStorageKey(),
            JSON.stringify({
                'srv-1': { status: 'ok', latencyMs: 50, testedAt: Date.now() },
            })
        );

        const screen = new ServerSelectScreen(container, orchestrator as never);
        screen.show({ allowAutoConnect: false });

        await new Promise((resolve) => setTimeout(resolve, 0));

        const activeRow = container.querySelector('.server-row.active') as HTMLElement;
        expect(activeRow).toBeTruthy();
        const button = activeRow.querySelector('button') as HTMLButtonElement;
        expect(button.textContent).toBe('Connected');
        expect(button.disabled).toBe(false);

        const registeredIds = orchestrator.getNavigation().registerFocusable.mock.calls
            .map((call) => (call[0] as { id?: string })?.id)
            .filter((id): id is string => typeof id === 'string');
        expect(registeredIds).toContain('btn-server-select-srv-1');

        const findLastNeighbors = (id: string): { down?: string } | undefined => {
            const calls = orchestrator.getNavigation().registerFocusable.mock.calls.filter((call) => call[0]?.id === id);
            return calls.length ? (calls[calls.length - 1][0].neighbors as { down?: string }) : undefined;
        };
        expect(findLastNeighbors('btn-server-refresh')?.down).toBe('btn-server-select-srv-1');
    });

    it('disambiguates colliding sanitized server ids with deterministic suffixes', async () => {
        const orchestrator = createOrchestratorStub();
        const nav = orchestrator.getNavigation();
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([
            { id: 'srv/1', name: 'Server One', owned: true },
            { id: 'srv_1', name: 'Server Two', owned: true },
        ]);

        const screen = new ServerSelectScreen(container, orchestrator as never);
        screen.show({ allowAutoConnect: false });
        await new Promise((resolve) => setTimeout(resolve, 0));

        const serverIds = nav.registerFocusable.mock.calls
            .map((call) => (call[0] as { id?: string })?.id)
            .filter((id): id is string => typeof id === 'string' && id.startsWith('btn-server-select-srv_1'));

        expect(serverIds).toContain('btn-server-select-srv_1');
        expect(serverIds.some((id) => /^btn-server-select-srv_1-[0-9a-f]{8}$/.test(id))).toBe(true);
        expect(new Set(serverIds).size).toBe(serverIds.length);
    });

    it('does not auto-connect saved server by default', async () => {
        const orchestrator = createOrchestratorStub();
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([
            { id: 'srv-1', name: 'Server One', owned: true },
        ]);
        orchestrator.selectServer.mockResolvedValue(true);

        localStorage.setItem(orchestrator.getSelectedServerStorageKey(), 'srv-1');

        const screen = new ServerSelectScreen(container, orchestrator as never);
        screen.show();

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(orchestrator.selectServer).not.toHaveBeenCalled();
        const status = container.querySelector('.screen-status') as HTMLElement;
        expect(status.textContent).toContain('Select a server from the list.');
    });

    it('shows auto-connect hint only when explicitly requested', async () => {
        const orchestrator = createOrchestratorStub();
        const container = document.createElement('div');
        document.body.appendChild(container);

        let resolveDiscovery: (servers: Array<{ id: string; name: string; owned: boolean }>) => void = () => {};
        orchestrator.discoverServers.mockImplementation(
            () => new Promise<Array<{ id: string; name: string; owned: boolean }>>((resolve) => {
                resolveDiscovery = resolve;
            })
        );
        orchestrator.selectServer.mockResolvedValue(false);
        localStorage.setItem(orchestrator.getSelectedServerStorageKey(), 'srv-1');

        const screen = new ServerSelectScreen(container, orchestrator as never);
        screen.show({ allowAutoConnect: true });

        const hint = container.querySelector('.server-autoconnect-hint') as HTMLElement | null;
        const status = container.querySelector('.screen-status') as HTMLElement | null;
        expect(hint).not.toBeNull();
        expect(hint?.classList.contains('visible')).toBe(true);
        expect(status?.textContent).toContain('Reconnecting to saved server');

        resolveDiscovery([{ id: 'srv-1', name: 'Server One', owned: true }]);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(hint?.classList.contains('visible')).toBe(false);
    });

    it('keeps reconnect enabled when saved server auto-select fails', async () => {
        const orchestrator = createOrchestratorStub();
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([
            { id: 'srv-1', name: 'Server One', owned: true },
        ]);
        orchestrator.selectServer.mockResolvedValue(false);

        localStorage.setItem(orchestrator.getSelectedServerStorageKey(), 'srv-1');
        localStorage.setItem(
            orchestrator.getServerHealthStorageKey(),
            JSON.stringify({
                'srv-1': { status: 'ok', latencyMs: 50, testedAt: Date.now() },
            })
        );

        const screen = new ServerSelectScreen(container, orchestrator as never);
        screen.show({ allowAutoConnect: true });

        await new Promise((resolve) => setTimeout(resolve, 0));

        const activeRow = container.querySelector('.server-row.active') as HTMLElement;
        const button = activeRow.querySelector('button') as HTMLButtonElement;
        const status = container.querySelector('.screen-status') as HTMLElement;
        expect(button.textContent).toBe('Reconnect');
        expect(button.disabled).toBe(false);
        expect(status.textContent).toContain('Saved server unavailable.');
    });

    it('shows saved server unavailable state when saved server is missing from discovery results', async () => {
        const orchestrator = createOrchestratorStub();
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([
            { id: 'srv-2', name: 'Server Two', owned: true },
        ]);
        localStorage.setItem(orchestrator.getSelectedServerStorageKey(), 'srv-1');

        const screen = new ServerSelectScreen(container, orchestrator as never);
        screen.show({ allowAutoConnect: true });

        await new Promise((resolve) => setTimeout(resolve, 0));

        const status = container.querySelector('.screen-status') as HTMLElement;
        expect(orchestrator.selectServer).not.toHaveBeenCalled();
        expect(status.textContent).toContain('Saved server unavailable.');
    });

    it('renders empty state and removes down neighbors when list is empty', async () => {
        const orchestrator = createOrchestratorStub();
        const nav = orchestrator.getNavigation();
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([]);

        const screen = new ServerSelectScreen(container, orchestrator as never);
        screen.show({ allowAutoConnect: false });

        await new Promise((resolve) => setTimeout(resolve, 0));

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
        const nav = orchestrator.getNavigation();
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([
            { id: 'srv-1', name: 'Server One', owned: true },
            { id: 'srv-2', name: 'Server Two', owned: true },
        ]);

        const screen = new ServerSelectScreen(container, orchestrator as never);
        screen.show({ allowAutoConnect: false });

        await new Promise((resolve) => setTimeout(resolve, 0));

        const unregisteredIds = nav.unregisterFocusable.mock.calls.map((call) => call[0] as string | undefined);
        expect(unregisteredIds).not.toContain('btn-server-refresh');
        expect(unregisteredIds).not.toContain('btn-server-setup');
        expect(unregisteredIds).not.toContain('btn-server-switch-profile');
        expect(unregisteredIds).not.toContain('btn-server-forget');
    });

    it('unregisters stale server focusables before rendering refreshed server list', async () => {
        const orchestrator = createOrchestratorStub();
        const nav = orchestrator.getNavigation();
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers
            .mockResolvedValueOnce([
                { id: 'srv-1', name: 'Server One', owned: true },
                { id: 'srv-2', name: 'Server Two', owned: true },
            ])
            .mockResolvedValueOnce([
                { id: 'srv-1', name: 'Server One', owned: true },
            ]);

        const screen = new ServerSelectScreen(container, orchestrator as never);
        screen.show({ allowAutoConnect: false });
        await new Promise((resolve) => setTimeout(resolve, 0));

        await screen.refresh();
        await new Promise((resolve) => setTimeout(resolve, 0));

        const unregisteredIds = nav.unregisterFocusable.mock.calls.map((call) => call[0] as string | undefined);
        expect(unregisteredIds).toContain('btn-server-select-srv-1');
        expect(unregisteredIds).toContain('btn-server-select-srv-2');
    });

    it('restores focus to refresh after clearing saved server', async () => {
        const orchestrator = createOrchestratorStub();
        const nav = orchestrator.getNavigation();
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([
            { id: 'srv-1', name: 'Server One', owned: true },
        ]);

        const screen = new ServerSelectScreen(container, orchestrator as never);
        screen.show({ allowAutoConnect: false });
        await new Promise((resolve) => setTimeout(resolve, 0));

        jest.useFakeTimers();
        nav.setFocus.mockClear();

        const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement | null;
        expect(clearBtn).not.toBeNull();
        clearBtn?.click();

        expect(container.querySelectorAll('.server-row')).toHaveLength(1);
        expect(container.querySelector('.server-empty-state')).toBeNull();
        const status = container.querySelector('.screen-status') as HTMLElement | null;
        const detail = container.querySelector('.screen-detail') as HTMLElement | null;
        expect(status?.textContent).toBe('Selection cleared.');
        expect(detail?.textContent).toBe('Pick a server to continue.');

        jest.advanceTimersByTime(60);
        expect(nav.setFocus).toHaveBeenCalledWith('btn-server-refresh');
        jest.useRealTimers();
    });

    it('uses navigation restore entrypoint before refresh-button fallback', async () => {
        const orchestrator = createOrchestratorStub();
        const nav = orchestrator.getNavigation();
        nav.restoreFocusForCurrentScreen.mockReturnValue(true);
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([
            { id: 'srv-1', name: 'Server One', owned: true },
        ]);

        const screen = new ServerSelectScreen(container, orchestrator as never);
        screen.show({ allowAutoConnect: false });
        await new Promise((resolve) => setTimeout(resolve, 0));

        jest.useFakeTimers();
        nav.setFocus.mockClear();
        nav.restoreFocusForCurrentScreen.mockClear();

        const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement | null;
        clearBtn?.click();

        jest.advanceTimersByTime(60);
        expect(nav.restoreFocusForCurrentScreen).toHaveBeenCalledTimes(1);
        expect(nav.setFocus).not.toHaveBeenCalledWith('btn-server-refresh');
        jest.useRealTimers();
    });
});
