/**
 * @jest-environment jsdom
 */

import {
    renderServerSelectList,
    type ServerSelectRenderOptions,
} from '../ServerSelectListView';
import type { ServerSelectDisplayState } from '../types';
import type { PlexServer } from '../../../plex/discovery/types';

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

const createOptions = (
    overrides: Partial<ServerSelectRenderOptions> = {}
): ServerSelectRenderOptions => ({
    isSelecting: false,
    buildServerMeta: jest.fn((server: PlexServer) => `Meta for ${server.name}`),
    buildServerButtonIds: jest.fn((serverIds: string[]) => serverIds.map((id) => `btn-${id}`)),
    onSelectServer: jest.fn(),
    ...overrides,
});

describe('renderServerSelectList', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    it('renders no-servers empty state and returns no enabled buttons', () => {
        const listEl = document.createElement('div');
        const options = createOptions({ emptyStateReason: 'no_servers' });

        const result = renderServerSelectList(listEl, [], makeScreenState(), options);

        expect(result).toEqual({
            enabledServerButtons: [],
            hasServerRows: false,
        });
        expect(listEl.querySelector('.server-empty-title')?.textContent).toBe('No servers found');
        expect(listEl.querySelector('.server-empty-description')?.textContent).toContain(
            'Ensure your Plex Media Server is running'
        );
        expect(options.buildServerButtonIds).not.toHaveBeenCalled();
    });

    it('renders discovery-failed empty state copy', () => {
        const listEl = document.createElement('div');

        const result = renderServerSelectList(
            listEl,
            [],
            makeScreenState(),
            createOptions({ emptyStateReason: 'discovery_failed' })
        );

        expect(result.hasServerRows).toBe(false);
        expect(listEl.querySelector('.server-empty-description')?.textContent).toContain(
            'Server discovery failed'
        );
    });

    it('renders health pill labels and classes including latency thresholds', () => {
        const listEl = document.createElement('div');
        const servers = [
            makeServer('ok', 'Fast Server'),
            makeServer('slow', 'Slow Server'),
            makeServer('very-slow', 'Very Slow Server'),
            makeServer('auth', 'Auth Server'),
            makeServer('denied', 'Denied Server'),
            makeServer('down', 'Down Server'),
            makeServer('unknown', 'Unknown Server'),
        ];

        renderServerSelectList(
            listEl,
            servers,
            makeScreenState({
                serverHealth: {
                    ok: { status: 'ok', latencyMs: 99 },
                    slow: { status: 'ok', latencyMs: 100 },
                    'very-slow': { status: 'ok', latencyMs: 500 },
                    auth: { status: 'auth_required' },
                    denied: { status: 'access_denied' },
                    down: { status: 'unreachable' },
                    unknown: { status: 'unexpected' },
                },
            }),
            createOptions()
        );

        const pills = Array.from(listEl.querySelectorAll<HTMLElement>('.server-status-pill'));

        expect(pills.map((pill) => pill.textContent)).toEqual([
            'OK • 99ms',
            'Slow • 100ms',
            'Very Slow • 500ms',
            'Auth Required',
            'Access Denied',
            'Unreachable',
            'Unknown',
        ]);
        expect(pills[0]?.classList.contains('ok')).toBe(true);
        expect(pills[1]?.classList.contains('latency-slow')).toBe(true);
        expect(pills[2]?.classList.contains('latency-very-slow')).toBe(true);
        expect(pills[3]?.classList.contains('auth-required')).toBe(true);
        expect(pills[4]?.classList.contains('access-denied')).toBe(true);
        expect(pills[5]?.classList.contains('unreachable')).toBe(true);
        expect(pills[6]?.classList.contains('unknown')).toBe(true);
    });

    it('marks the saved server active and uses Connected or Reconnect labels from health state', () => {
        const listEl = document.createElement('div');
        const server = makeServer('saved', 'Saved Server');

        renderServerSelectList(
            listEl,
            [server],
            makeScreenState({
                selectedServerId: 'saved',
                serverHealth: {
                    saved: { status: 'ok', latencyMs: 50 },
                },
            }),
            createOptions()
        );

        const activeRow = listEl.querySelector('.server-row.active') as HTMLElement | null;
        expect(activeRow).not.toBeNull();
        expect(activeRow?.querySelector('button')?.textContent).toBe('Connected');

        renderServerSelectList(
            listEl,
            [server],
            makeScreenState({
                selectedServerId: 'saved',
                serverHealth: {
                    saved: { status: 'unreachable' },
                },
            }),
            createOptions()
        );

        expect(listEl.querySelector('.server-row.active button')?.textContent).toBe('Reconnect');

        renderServerSelectList(
            listEl,
            [server],
            makeScreenState({
                selectedServerId: 'saved',
                serverHealth: {
                    saved: { status: 'ok', latencyMs: 50 },
                },
            }),
            createOptions({ savedServerUnavailable: true })
        );

        expect(listEl.querySelector('.server-row.active button')?.textContent).toBe('Reconnect');
    });

    it('returns enabled buttons only when selection is available', () => {
        const listEl = document.createElement('div');
        const servers = [
            makeServer('srv-1', 'Server One'),
            makeServer('srv-2', 'Server Two'),
        ];

        const available = renderServerSelectList(
            listEl,
            servers,
            makeScreenState(),
            createOptions()
        );

        expect(available.hasServerRows).toBe(true);
        expect(available.enabledServerButtons.map((button) => button.id)).toEqual(['btn-srv-1', 'btn-srv-2']);
        expect(available.enabledServerButtons.every((button) => !button.disabled)).toBe(true);

        const selecting = renderServerSelectList(
            listEl,
            servers,
            makeScreenState(),
            createOptions({ isSelecting: true })
        );

        expect(selecting.hasServerRows).toBe(true);
        expect(selecting.enabledServerButtons).toEqual([]);
        expect(Array.from(listEl.querySelectorAll<HTMLButtonElement>('button')).every((button) => button.disabled))
            .toBe(true);
    });

    it('uses stable button ids from the injected id builder', () => {
        const listEl = document.createElement('div');
        const buildServerButtonIds = jest.fn(() => ['custom-first', 'custom-second']);

        const result = renderServerSelectList(
            listEl,
            [makeServer('srv/1', 'Server One'), makeServer('srv_1', 'Server Two')],
            makeScreenState(),
            createOptions({ buildServerButtonIds })
        );

        expect(buildServerButtonIds).toHaveBeenCalledTimes(1);
        expect(buildServerButtonIds).toHaveBeenCalledWith(['srv/1', 'srv_1']);
        expect(result.enabledServerButtons.map((button) => button.id)).toEqual(['custom-first', 'custom-second']);
    });

    it('dispatches click callback with the selected PlexServer', () => {
        const listEl = document.createElement('div');
        const serverOne = makeServer('srv-1', 'Server One');
        const serverTwo = makeServer('srv-2', 'Server Two');
        const onSelectServer = jest.fn();

        renderServerSelectList(
            listEl,
            [serverOne, serverTwo],
            makeScreenState(),
            createOptions({ onSelectServer })
        );

        listEl.querySelectorAll<HTMLButtonElement>('button')[1]?.click();

        expect(onSelectServer).toHaveBeenCalledTimes(1);
        expect(onSelectServer).toHaveBeenCalledWith(serverTwo);
    });
});
