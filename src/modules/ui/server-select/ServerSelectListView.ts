import type { PlexServer } from '../../plex/discovery/types';
import type { ServerSelectDisplayState, ServerSelectEmptyStateReason } from './types';

export type ServerSelectRenderOptions = {
    savedServerUnavailable?: boolean | undefined;
    emptyStateReason?: ServerSelectEmptyStateReason | undefined;
    isSelecting: boolean;
    buildServerMeta: (server: PlexServer, healthMap: ServerSelectDisplayState['serverHealth']) => string;
    buildServerButtonIds: (serverIds: string[]) => string[];
    onSelectServer: (server: PlexServer) => void;
};

export type ServerSelectRenderResult = {
    enabledServerButtons: HTMLButtonElement[];
    hasServerRows: boolean;
};

export function renderServerSelectList(
    listEl: HTMLElement,
    servers: PlexServer[],
    screenState: ServerSelectDisplayState,
    options: ServerSelectRenderOptions
): ServerSelectRenderResult {
    const savedId = screenState.selectedServerId;
    const savedServerUnavailable = options.savedServerUnavailable === true;
    const emptyStateReason = options.emptyStateReason ?? 'no_servers';
    const healthMap = screenState.serverHealth;

    listEl.replaceChildren();

    if (servers.length === 0) {
        listEl.appendChild(createEmptyState(emptyStateReason));
        return {
            enabledServerButtons: [],
            hasServerRows: false,
        };
    }

    const enabledServerButtons: HTMLButtonElement[] = [];
    const buttonIds = options.buildServerButtonIds(servers.map((server) => server?.id ?? 'unknown'));
    let hasServerRows = false;

    for (let i = 0; i < servers.length; i++) {
        const server = servers[i];
        if (!server) continue;

        const { row, selectButton } = createServerRow({
            server,
            healthMap,
            buttonId: buttonIds[i] ?? 'btn-server-select-unknown',
            isSelecting: options.isSelecting,
            savedId,
            savedServerUnavailable,
            buildServerMeta: options.buildServerMeta,
            onSelectServer: options.onSelectServer,
        });

        listEl.appendChild(row);
        hasServerRows = true;
        if (!selectButton.disabled) {
            enabledServerButtons.push(selectButton);
        }
    }

    return {
        enabledServerButtons,
        hasServerRows,
    };
}

function createEmptyState(emptyStateReason: ServerSelectEmptyStateReason): HTMLElement {
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
    return empty;
}

function createServerRow(options: {
    server: PlexServer;
    healthMap: ServerSelectDisplayState['serverHealth'];
    buttonId: string;
    isSelecting: boolean;
    savedId: string | null;
    savedServerUnavailable: boolean;
    buildServerMeta: (server: PlexServer, healthMap: ServerSelectDisplayState['serverHealth']) => string;
    onSelectServer: (server: PlexServer) => void;
}): { row: HTMLElement; selectButton: HTMLButtonElement } {
    const { server, healthMap } = options;

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
    meta.textContent = options.buildServerMeta(server, healthMap);
    main.appendChild(meta);

    row.appendChild(main);

    const actions = document.createElement('div');
    actions.className = 'server-actions';

    const selectButton = document.createElement('button');
    selectButton.id = options.buttonId;
    selectButton.className = 'screen-button secondary';
    selectButton.textContent = 'Connect';
    selectButton.disabled = options.isSelecting;
    selectButton.addEventListener('click', () => {
        options.onSelectServer(server);
    });
    actions.appendChild(selectButton);
    row.appendChild(actions);

    const health = healthMap[server.id];
    const { normalizedStatus, pill } = createHealthPill(health);
    main.appendChild(pill);

    if (options.savedId && server.id === options.savedId) {
        row.classList.add('active');
        // Keep reconnect available even for the currently saved server so users
        // can re-test connectivity without first clearing selection.
        selectButton.textContent =
            normalizedStatus === 'ok' && !options.savedServerUnavailable
                ? 'Connected'
                : 'Reconnect';
    }

    return { row, selectButton };
}

function createHealthPill(
    health: ServerSelectDisplayState['serverHealth'][string]
): { normalizedStatus: 'ok' | 'unreachable' | 'auth_required' | 'access_denied' | 'unknown'; pill: HTMLElement } {
    const pill = document.createElement('div');
    const normalizedStatus =
        health?.status === 'ok'
        || health?.status === 'unreachable'
        || health?.status === 'auth_required'
        || health?.status === 'access_denied'
            ? health.status
            : 'unknown';
    const statusClass =
        normalizedStatus === 'auth_required'
            ? 'auth-required'
            : normalizedStatus === 'access_denied'
                ? 'access-denied'
                : normalizedStatus;
    pill.className = `server-status-pill ${statusClass}`;

    let statusText = 'Unknown';
    if (normalizedStatus === 'ok') statusText = 'OK';
    else if (normalizedStatus === 'unreachable') statusText = 'Unreachable';
    else if (normalizedStatus === 'auth_required') statusText = 'Auth Required';
    else if (normalizedStatus === 'access_denied') statusText = 'Access Denied';

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

    return { normalizedStatus, pill };
}
