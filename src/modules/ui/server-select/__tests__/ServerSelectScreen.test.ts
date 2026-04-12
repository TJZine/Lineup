/**
 * @jest-environment jsdom
 */

import { ServerSelectScreen, type ServerSelectScreenPorts } from '../ServerSelectScreen';
import type { ServerSelectScreenNavigationPort } from '../../../navigation';
import type { PlexServer } from '../../../plex/discovery/types';
import { createDeferred, flushPromisesAndTimers } from '../../../../__tests__/helpers';

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
        selectServer: jest.fn().mockResolvedValue({ kind: 'selection_failed', reason: 'unreachable' }),
        requestChannelSetupRerun,
        clearSelectedServer: jest.fn().mockResolvedValue(undefined),
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
        orchestrator.selectServer.mockResolvedValue({ kind: 'selected', readiness: 'ready', persistedSelection: 'updated' });

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
        orchestrator.selectServer.mockResolvedValue({ kind: 'selection_failed', reason: 'unreachable' });
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
        orchestrator.selectServer.mockResolvedValue({ kind: 'selection_failed', reason: 'unreachable' });

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

    it('shows explicit auth-required guidance when selection fails with auth_required', async () => {
        const orchestrator = createOrchestratorStub();
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.selectServer.mockResolvedValue({ kind: 'selection_failed', reason: 'auth_required' });

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await flushPromisesAndTimers();

        const button = container.querySelector('.server-row button') as HTMLButtonElement;
        button.click();
        await flushPromisesAndTimers();

        const error = container.querySelector('.screen-error') as HTMLElement;
        expect(error.textContent ?? '').toContain('Authentication required');
    });

    it('shows explicit auth-invalid guidance when selection fails with auth_invalid', async () => {
        const orchestrator = createOrchestratorStub();
        const container = document.createElement('div');
        document.body.appendChild(container);

        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.selectServer.mockResolvedValue({ kind: 'selection_failed', reason: 'auth_invalid' });

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await flushPromisesAndTimers();

        const button = container.querySelector('.server-row button') as HTMLButtonElement;
        button.click();
        await flushPromisesAndTimers();

        const error = container.querySelector('.screen-error') as HTMLElement;
        expect(error.textContent ?? '').toContain('credentials are invalid');
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
        await flushPromisesAndTimers();

        expect(container.querySelectorAll('.server-row')).toHaveLength(1);
        expect(container.querySelector('.server-empty-state')).toBeNull();
        const status = container.querySelector('.screen-status') as HTMLElement | null;
        const detail = container.querySelector('.screen-detail') as HTMLElement | null;
        expect(status?.textContent).toBe('Selection cleared.');
        expect(detail?.textContent).toBe('Pick a server to continue.');

        jest.advanceTimersByTime(60);
        expect(nav.setFocus).toHaveBeenCalledWith('btn-server-refresh');
    });

    it('shows an error and keeps the server list when clearing saved server fails', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

        try {
            const orchestrator = createOrchestratorStub();
            const container = document.createElement('div');
            document.body.appendChild(container);

            orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
            orchestrator.clearSelectedServer.mockRejectedValueOnce(new Error('store failed'));

            const screen = new ServerSelectScreen(container, orchestrator);
            screen.show({ allowAutoConnect: false });
            await flushPromisesAndTimers();

            const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement | null;
            expect(clearBtn).not.toBeNull();

            clearBtn?.click();
            await flushPromisesAndTimers();

            expect(orchestrator.clearSelectedServer).toHaveBeenCalledTimes(1);
            expect(container.querySelectorAll('.server-row')).toHaveLength(1);

            const status = container.querySelector('.screen-status') as HTMLElement | null;
            const detail = container.querySelector('.screen-detail') as HTMLElement | null;
            const error = container.querySelector('.screen-error') as HTMLElement | null;

            expect(status?.textContent).toBe('Selection not cleared.');
            expect(detail?.textContent).toBe('Try again.');
            expect(error?.textContent).toBe('store failed');
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[ServerSelect] Clear saved server failed:',
                expect.objectContaining({
                    name: 'Error',
                    message: 'store failed',
                })
            );
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });

    it('ignores concurrent clear saved server requests while one is in flight', async () => {
        const orchestrator = createOrchestratorStub();
        const container = document.createElement('div');
        document.body.appendChild(container);

        const deferred = createDeferred<void>();
        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.clearSelectedServer.mockReturnValue(deferred.promise);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await flushPromisesAndTimers();

        const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement | null;
        expect(clearBtn).not.toBeNull();

        clearBtn?.click();
        clearBtn?.click();

        expect(orchestrator.clearSelectedServer).toHaveBeenCalledTimes(1);

        deferred.resolve();
        await flushPromisesAndTimers();

        expect(container.querySelector('.screen-status')?.textContent).toBe('Selection cleared.');
    });

    it('disables the clear saved server button while clear is in flight and reenables it after success', async () => {
        const orchestrator = createOrchestratorStub();
        const container = document.createElement('div');
        document.body.appendChild(container);

        const clearDeferred = createDeferred<void>();
        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.clearSelectedServer.mockReturnValue(clearDeferred.promise);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await flushPromisesAndTimers();

        const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement | null;
        expect(clearBtn).not.toBeNull();
        expect(clearBtn?.disabled).toBe(false);

        clearBtn?.click();

        expect(orchestrator.clearSelectedServer).toHaveBeenCalledTimes(1);
        expect(clearBtn?.disabled).toBe(true);

        clearDeferred.resolve();
        await flushPromisesAndTimers();

        expect(clearBtn?.disabled).toBe(false);
        expect(container.querySelector('.screen-status')?.textContent).toBe('Selection cleared.');
    });

    it('reenables the clear saved server button after a visible clear failure', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

        try {
            const orchestrator = createOrchestratorStub();
            const container = document.createElement('div');
            document.body.appendChild(container);

            const clearDeferred = createDeferred<void>();
            orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
            orchestrator.clearSelectedServer.mockReturnValue(clearDeferred.promise);

            const screen = new ServerSelectScreen(container, orchestrator);
            screen.show({ allowAutoConnect: false });
            await flushPromisesAndTimers();

            const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement | null;
            expect(clearBtn).not.toBeNull();
            expect(clearBtn?.disabled).toBe(false);

            clearBtn?.click();

            expect(orchestrator.clearSelectedServer).toHaveBeenCalledTimes(1);
            expect(clearBtn?.disabled).toBe(true);

            clearDeferred.reject(new Error('store failed'));
            await flushPromisesAndTimers();

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
        const container = document.createElement('div');
        document.body.appendChild(container);

        const clearDeferred = createDeferred<void>();
        const secondDiscovery = createDeferred<PlexServer[]>();

        orchestrator.discoverServers
            .mockResolvedValueOnce([makeServer('srv-1', 'Server One')])
            .mockReturnValueOnce(secondDiscovery.promise);
        orchestrator.clearSelectedServer.mockReturnValue(clearDeferred.promise);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await flushPromisesAndTimers();

        const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement | null;
        expect(clearBtn).not.toBeNull();
        expect(clearBtn?.disabled).toBe(false);

        clearBtn?.click();

        expect(clearBtn?.disabled).toBe(true);

        screen.hide();
        screen.show({ allowAutoConnect: false });
        await flushPromisesAndTimers();

        expect(orchestrator.discoverServers).toHaveBeenCalledTimes(2);
        expect(clearBtn?.disabled).toBe(true);

        clearDeferred.resolve();
        await flushPromisesAndTimers();

        expect(clearBtn?.disabled).toBe(true);

        secondDiscovery.resolve([makeServer('srv-2', 'Second Server')]);
        await flushPromisesAndTimers();

        expect(clearBtn?.disabled).toBe(false);

        const serverRows = Array.from(container.querySelectorAll('.server-row'));
        expect(serverRows).toHaveLength(1);
        expect(serverRows[0]?.textContent).toContain('Second Server');
    });

    it('keeps clear disabled when current discovery finishes before a stale clear settles', async () => {
        const orchestrator = createOrchestratorStub();
        const container = document.createElement('div');
        document.body.appendChild(container);

        const clearDeferred = createDeferred<void>();
        const secondDiscovery = createDeferred<PlexServer[]>();

        orchestrator.discoverServers
            .mockResolvedValueOnce([makeServer('srv-1', 'Server One')])
            .mockReturnValueOnce(secondDiscovery.promise);
        orchestrator.clearSelectedServer.mockReturnValue(clearDeferred.promise);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await flushPromisesAndTimers();

        const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement | null;
        expect(clearBtn).not.toBeNull();
        expect(clearBtn?.disabled).toBe(false);

        clearBtn?.click();

        expect(orchestrator.clearSelectedServer).toHaveBeenCalledTimes(1);
        expect(clearBtn?.disabled).toBe(true);

        screen.hide();
        screen.show({ allowAutoConnect: false });
        await flushPromisesAndTimers();

        expect(orchestrator.discoverServers).toHaveBeenCalledTimes(2);

        secondDiscovery.resolve([makeServer('srv-2', 'Second Server')]);
        await flushPromisesAndTimers();

        expect(clearBtn?.disabled).toBe(true);

        clearBtn?.click();
        expect(orchestrator.clearSelectedServer).toHaveBeenCalledTimes(1);

        clearDeferred.resolve();
        await flushPromisesAndTimers();

        expect(clearBtn?.disabled).toBe(false);
    });

    it('does not update hidden UI or re-register focusables when clear completes after hide', async () => {
        const orchestrator = createOrchestratorStub();
        const nav = orchestrator.navigation;
        const container = document.createElement('div');
        document.body.appendChild(container);

        const deferred = createDeferred<void>();
        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.clearSelectedServer.mockReturnValue(deferred.promise);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await flushPromisesAndTimers();

        const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement | null;
        expect(clearBtn).not.toBeNull();

        nav.registerFocusable.mockClear();
        nav.setFocus.mockClear();

        clearBtn?.click();
        screen.hide();

        deferred.resolve();
        await flushPromisesAndTimers();
        jest.advanceTimersByTime(60);

        expect(container.querySelector('.screen-status')?.textContent).not.toBe('Selection cleared.');
        expect(nav.registerFocusable).not.toHaveBeenCalled();
        expect(nav.setFocus).not.toHaveBeenCalled();
    });

    it('logs clear failures after hide without updating hidden UI', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

        try {
            const orchestrator = createOrchestratorStub();
            const container = document.createElement('div');
            document.body.appendChild(container);

            const deferred = createDeferred<void>();
            orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
            orchestrator.clearSelectedServer.mockReturnValue(deferred.promise);

            const screen = new ServerSelectScreen(container, orchestrator);
            screen.show({ allowAutoConnect: false });
            await flushPromisesAndTimers();

            const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement | null;
            expect(clearBtn).not.toBeNull();

            clearBtn?.click();
            screen.hide();

            deferred.reject(new Error('store failed'));
            await flushPromisesAndTimers();

            expect(container.querySelector('.screen-status')?.textContent).not.toBe('Selection not cleared.');
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[ServerSelect] Clear saved server failed:',
                expect.objectContaining({
                    name: 'Error',
                    message: 'store failed',
                })
            );
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });

    it('does not update hidden UI or restore focus when discovery resolves after hide', async () => {
        const orchestrator = createOrchestratorStub();
        const nav = orchestrator.navigation;
        const container = document.createElement('div');
        document.body.appendChild(container);

        const deferred = createDeferred<PlexServer[]>();
        orchestrator.discoverServers.mockReturnValue(deferred.promise);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await flushPromisesAndTimers();

        nav.registerFocusable.mockClear();
        nav.setFocus.mockClear();

        screen.hide();

        deferred.resolve([makeServer('srv-1', 'Server One')]);
        await flushPromisesAndTimers();
        jest.advanceTimersByTime(60);

        expect(container.querySelectorAll('.server-row')).toHaveLength(0);
        expect(nav.registerFocusable).not.toHaveBeenCalled();
        expect(nav.setFocus).not.toHaveBeenCalled();
    });

    it('ignores stale discovery results from a previous visibility session after hide and show', async () => {
        const orchestrator = createOrchestratorStub();
        const nav = orchestrator.navigation;
        const container = document.createElement('div');
        document.body.appendChild(container);

        const firstDiscovery = createDeferred<PlexServer[]>();
        const secondServer = makeServer('srv-2', 'Second Server');
        orchestrator.discoverServers
            .mockReturnValueOnce(firstDiscovery.promise)
            .mockResolvedValueOnce([secondServer]);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await flushPromisesAndTimers();

        screen.hide();
        screen.show({ allowAutoConnect: false });
        await flushPromisesAndTimers();

        expect(orchestrator.discoverServers).toHaveBeenCalledTimes(2);

        firstDiscovery.resolve([makeServer('srv-1', 'Stale Server')]);
        await flushPromisesAndTimers();
        jest.advanceTimersByTime(60);

        const serverRows = Array.from(container.querySelectorAll('.server-row'));
        expect(serverRows).toHaveLength(1);
        expect(serverRows[0]?.textContent).toContain('Second Server');
        expect(serverRows[0]?.textContent).not.toContain('Stale Server');
        expect(nav.setFocus).toHaveBeenCalledWith('btn-server-refresh');
    });

    it('logs discovery failures after hide without updating hidden UI', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

        try {
            const orchestrator = createOrchestratorStub();
            const container = document.createElement('div');
            document.body.appendChild(container);

            const deferred = createDeferred<PlexServer[]>();
            orchestrator.discoverServers.mockReturnValue(deferred.promise);

            const screen = new ServerSelectScreen(container, orchestrator);
            screen.show({ allowAutoConnect: false });
            await flushPromisesAndTimers();

            screen.hide();

            deferred.reject(new Error('discovery failed'));
            await flushPromisesAndTimers();

            expect(container.querySelector('.screen-status')?.textContent).not.toBe('Discovery failed.');
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[ServerSelect] Discovery failed after screen was hidden:',
                expect.objectContaining({
                    name: 'Error',
                    message: 'discovery failed',
                })
            );
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });

    it('ignores stale clear results from a previous visibility session after hide and show', async () => {
        const orchestrator = createOrchestratorStub();
        const container = document.createElement('div');
        document.body.appendChild(container);

        const clearDeferred = createDeferred<void>();
        orchestrator.discoverServers.mockResolvedValue([makeServer('srv-1', 'Server One')]);
        orchestrator.clearSelectedServer.mockReturnValue(clearDeferred.promise);

        const screen = new ServerSelectScreen(container, orchestrator);
        screen.show({ allowAutoConnect: false });
        await flushPromisesAndTimers();

        const clearBtn = container.querySelector('#btn-server-forget') as HTMLButtonElement | null;
        expect(clearBtn).not.toBeNull();

        clearBtn?.click();
        screen.hide();
        screen.show({ allowAutoConnect: false });
        await flushPromisesAndTimers();

        expect(container.querySelector('.screen-status')?.textContent).toBe('Select a server from the list.');

        clearDeferred.resolve();
        await flushPromisesAndTimers();
        jest.advanceTimersByTime(60);

        expect(container.querySelector('.screen-status')?.textContent).toBe('Select a server from the list.');
        expect(container.querySelectorAll('.server-row')).toHaveLength(1);
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
