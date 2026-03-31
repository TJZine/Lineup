/**
 * @jest-environment jsdom
 */

import { ServerSelectScreen, type ServerSelectScreenPorts } from '../ServerSelectScreen';
import type { ServerSelectScreenNavigationPort } from '../../../navigation';
import type { PlexServer } from '../../../plex/discovery/types';
import { flushPromisesAndTimers } from '../../../../__tests__/helpers';

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

const createOrchestratorStub = (): ServerSelectScreenHarness => {
    const navigation = createNavigationStub();
    const requestChannelSetupRerun = jest.fn();
    return {
        navigation,
        getNavigation: jest.fn(() => navigation),
        discoverServers: jest.fn(),
        selectServer: jest.fn().mockResolvedValue(false),
        requestChannelSetupRerun,
        clearSelectedServer: jest.fn(),
        getSelectedServerStorageKey: jest.fn(() => 'selected-server-id'),
        getServerHealthStorageKey: jest.fn(() => 'server-health'),
    } as ServerSelectScreenHarness;
};

describe('ServerSelectScreen', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        localStorage.clear();
        document.body.innerHTML = '';
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it('renders the branded hero glyph above the title', () => {
        const orchestrator = createOrchestratorStub();
        const container = document.createElement('div');
        document.body.appendChild(container);

        new ServerSelectScreen(container, orchestrator);

        const hero = container.querySelector('.server-select-glyph');
        const panel = container.querySelector('.screen-panel') as HTMLElement;
        const orderedClassNames = Array.from(panel.children).map((child) => child.className);

        expect(hero).not.toBeNull();
        expect(hero?.querySelector('svg')).not.toBeNull();
        expect(orderedClassNames[0]).toBe('screen-hero');
        expect(orderedClassNames[1]).toBe('screen-title');
    });

    it('appends latency and applies slow class for ok status', async () => {
        const orchestrator = createOrchestratorStub();
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);

        localStorage.setItem(
            orchestrator.getServerHealthStorageKey(),
            JSON.stringify({
                'srv-1': { status: 'ok', latencyMs: 250, testedAt: Date.now() },
            })
        );

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });

        await flushPromisesAndTimers();

        const pill = container.querySelector('.server-status-pill') as HTMLElement;
        expect(pill.textContent).toContain('Slow • 250ms');
        expect(pill.classList.contains('latency-slow')).toBe(true);
    });

    it('applies very-slow class for >=500ms latency', async () => {
        const orchestrator = createOrchestratorStub();
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);

        localStorage.setItem(
            orchestrator.getServerHealthStorageKey(),
            JSON.stringify({
                'srv-1': { status: 'ok', latencyMs: 500, testedAt: Date.now() },
            })
        );

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });

        await flushPromisesAndTimers();

        const pill = container.querySelector('.server-status-pill') as HTMLElement;
        expect(pill.textContent).toContain('Very Slow • 500ms');
        expect(pill.classList.contains('latency-very-slow')).toBe(true);
    });

    it('ignores malformed persisted health payload when rendering server list', async () => {
        const orchestrator = createOrchestratorStub();
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);

        localStorage.setItem(orchestrator.getServerHealthStorageKey(), '{not-json');

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await flushPromisesAndTimers();

        const pill = container.querySelector('.server-status-pill') as HTMLElement;
        expect(pill.textContent).toContain('Unknown');
        expect(localStorage.getItem(orchestrator.getServerHealthStorageKey())).toBeNull();
    });

    it('renders auth_invalid health state explicitly', async () => {
        const orchestrator = createOrchestratorStub();
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);

        localStorage.setItem(
            orchestrator.getServerHealthStorageKey(),
            JSON.stringify({
                'srv-1': { status: 'auth_invalid', testedAt: Date.now() },
            })
        );

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await flushPromisesAndTimers();

        const pill = container.querySelector('.server-status-pill') as HTMLElement;
        expect(pill.textContent).toContain('Auth Invalid');
        expect(pill.classList.contains('auth-invalid')).toBe(true);
    });

    it('does not mutate persisted selection/health keys during show/refresh when storage is empty', async () => {
        const orchestrator = createOrchestratorStub();
        const container = document.createElement('div');
        document.body.appendChild(container);
        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);

        const setSpy = jest.spyOn(Storage.prototype, 'setItem');
        const removeSpy = jest.spyOn(Storage.prototype, 'removeItem');
        const selectedKey = orchestrator.getSelectedServerStorageKey();
        const healthKey = orchestrator.getServerHealthStorageKey();

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await flushPromisesAndTimers();
        await screen.refresh();
        await flushPromisesAndTimers();

        expect(setSpy).not.toHaveBeenCalledWith(selectedKey, expect.any(String));
        expect(setSpy).not.toHaveBeenCalledWith(healthKey, expect.any(String));
        expect(removeSpy).not.toHaveBeenCalledWith(selectedKey);
        expect(removeSpy).not.toHaveBeenCalledWith(healthKey);

        setSpy.mockRestore();
        removeSpy.mockRestore();
    });

    it('marks saved server row as active and keeps reconnect enabled when healthy', async () => {
        const orchestrator = createOrchestratorStub();
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);

        localStorage.setItem(orchestrator.getSelectedServerStorageKey(), 'srv-1');
        localStorage.setItem(
            orchestrator.getServerHealthStorageKey(),
            JSON.stringify({
                'srv-1': { status: 'ok', latencyMs: 50, testedAt: Date.now() },
            })
        );

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });

        await flushPromisesAndTimers();

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
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([
            makeServer('srv/1', 'Server One'),
            makeServer('srv_1', 'Server Two'),
        ]);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await flushPromisesAndTimers();

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

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.selectServer.mockResolvedValue(true);

        localStorage.setItem(orchestrator.getSelectedServerStorageKey(), 'srv-1');

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show();

        await flushPromisesAndTimers();

        expect(orchestrator.selectServer).not.toHaveBeenCalled();
        const status = container.querySelector('.screen-status') as HTMLElement;
        expect(status.textContent).toContain('Select a server from the list.');
    });

    it('shows auto-connect hint only when explicitly requested', async () => {
        const orchestrator = createOrchestratorStub();
        const container = document.createElement('div');
        document.body.appendChild(container);

        let resolveDiscovery: (servers: PlexServer[]) => void = () => {};
        orchestrator.discoverServers.mockImplementation(
            () => new Promise<PlexServer[]>((resolve) => {
                resolveDiscovery = resolve;
            })
        );
        orchestrator.selectServer.mockResolvedValue(false);
        localStorage.setItem(orchestrator.getSelectedServerStorageKey(), 'srv-1');

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: true });

        const hint = container.querySelector('.server-autoconnect-hint') as HTMLElement | null;
        const status = container.querySelector('.screen-status') as HTMLElement | null;
        expect(hint).not.toBeNull();
        expect(hint?.classList.contains('visible')).toBe(true);
        expect(status?.textContent).toContain('Reconnecting to saved server');

        resolveDiscovery([makeServer('srv-1', 'Server One')]);
        await flushPromisesAndTimers();

        expect(hint?.classList.contains('visible')).toBe(false);
    });

    it('keeps reconnect enabled when saved server auto-select fails', async () => {
        const orchestrator = createOrchestratorStub();
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.selectServer.mockResolvedValue(false);

        localStorage.setItem(orchestrator.getSelectedServerStorageKey(), 'srv-1');
        localStorage.setItem(
            orchestrator.getServerHealthStorageKey(),
            JSON.stringify({
                'srv-1': { status: 'ok', latencyMs: 50, testedAt: Date.now() },
            })
        );

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: true });

        await flushPromisesAndTimers();

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

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-2', 'Server Two')]);
        localStorage.setItem(orchestrator.getSelectedServerStorageKey(), 'srv-1');

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: true });

        await flushPromisesAndTimers();

        const status = container.querySelector('.screen-status') as HTMLElement;
        expect(orchestrator.selectServer).not.toHaveBeenCalled();
        expect(status.textContent).toContain('Saved server unavailable.');
    });

    it('renders empty state and removes down neighbors when list is empty', async () => {
        const orchestrator = createOrchestratorStub();
        const nav = orchestrator.navigation;
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([]);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });

        await flushPromisesAndTimers();

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
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([
            makeServer('srv-1', 'Server One'),
            makeServer('srv-2', 'Server Two'),
        ]);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });

        await flushPromisesAndTimers();

        const unregisteredIds = nav.unregisterFocusable.mock.calls.map((call) => call[0] as string | undefined);
        expect(unregisteredIds).not.toContain('btn-server-refresh');
        expect(unregisteredIds).not.toContain('btn-server-setup');
        expect(unregisteredIds).not.toContain('btn-server-switch-profile');
        expect(unregisteredIds).not.toContain('btn-server-forget');
    });

    it('unregisters stale server focusables before rendering refreshed server list', async () => {
        const orchestrator = createOrchestratorStub();
        const nav = orchestrator.navigation;
        const container = document.createElement('div');
        document.body.appendChild(container);

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
        await flushPromisesAndTimers();

        await screen.refresh();
        await flushPromisesAndTimers();

        const unregisteredIds = nav.unregisterFocusable.mock.calls.map((call) => call[0] as string | undefined);
        expect(unregisteredIds).toContain('btn-server-select-srv-1');
        expect(unregisteredIds).toContain('btn-server-select-srv-2');
    });

    it('restores focus to refresh after clearing saved server', async () => {
        const orchestrator = createOrchestratorStub();
        const nav = orchestrator.navigation;
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await flushPromisesAndTimers();

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
    });

    it('uses navigation restore entrypoint before refresh-button fallback', async () => {
        const orchestrator = createOrchestratorStub();
        const nav = orchestrator.navigation;
        nav.restoreFocusForCurrentScreen.mockReturnValue(true);
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await flushPromisesAndTimers();

        nav.setFocus.mockClear();
        nav.restoreFocusForCurrentScreen.mockClear();

        const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement | null;
        clearBtn?.click();

        jest.advanceTimersByTime(60);
        expect(nav.restoreFocusForCurrentScreen).toHaveBeenCalledTimes(1);
        expect(nav.setFocus).not.toHaveBeenCalledWith('btn-server-refresh');
    });
});
