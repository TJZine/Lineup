/**
 * @jest-environment jsdom
 */

import { ServerSelectScreen } from '../ServerSelectScreen';

type NavigationStub = {
    registerFocusable: jest.Mock;
    unregisterFocusable: jest.Mock;
    setFocus: jest.Mock;
    getCurrentScreen: jest.Mock;
    replaceScreen: jest.Mock;
};

const createNavigationStub = (): NavigationStub => ({
    registerFocusable: jest.fn(),
    unregisterFocusable: jest.fn(),
    setFocus: jest.fn(),
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

    it('marks saved server row as active and disables connect when ok', async () => {
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
        expect(button.disabled).toBe(true);
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
        screen.show();

        await new Promise((resolve) => setTimeout(resolve, 0));

        const activeRow = container.querySelector('.server-row.active') as HTMLElement;
        const button = activeRow.querySelector('button') as HTMLButtonElement;
        const status = container.querySelector('.screen-status') as HTMLElement;
        expect(button.textContent).toBe('Reconnect');
        expect(button.disabled).toBe(false);
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
});
