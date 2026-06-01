import { AppErrorCode } from '../../../types/app-errors';
import { PlexApiError } from '../auth/plexAuthTransport';
import type { PlexApiConnection, PlexApiResource } from './types';
import { redactSensitiveTokens } from '../../../utils/redact';
import { fetchDiscoveryResponse } from './PlexDiscoveryRequestExecutor';
import { redactDiscoveryUrl } from './PlexDiscoveryResponsePolicy';

const MIN_PORT = 1;
const MAX_PORT = 65535;

export async function discoverPlexResourcesWithRequestPolicy(
    headers: Record<string, string>,
    options?: { signal?: AbortSignal | null }
): Promise<PlexApiResource[]> {
    let lastUrl = '';
    try {
        const response = await fetchDiscoveryResponse(headers, (url) => {
            lastUrl = url;
        }, options);
        return await parseResourcesResponse(response);
    } catch (error) {
        if (error instanceof PlexApiError) {
            throw error;
        }
        const message = redactSensitiveTokens(error instanceof Error ? error.message : String(error));
        throw new PlexApiError(
            AppErrorCode.SERVER_UNREACHABLE,
            `Failed to discover servers: ${message} (last url: ${redactDiscoveryUrl(lastUrl) || 'unknown'})`,
            undefined,
            true,
            error
        );
    }
}

async function parseResourcesResponse(response: Response): Promise<PlexApiResource[]> {
    const { contentType, text } = await readDiscoveryResponseBody(response);
    if (!text) {
        return [];
    }

    const jsonResources = parseJsonResourceArray(text, response.status);
    if (jsonResources) {
        return jsonResources;
    }

    if (!isXmlResourceResponse(text, contentType)) {
        throw new PlexApiError(
            AppErrorCode.PARSE_ERROR,
            'Failed to parse server discovery response',
            response.status,
            false
        );
    }

    return parseXmlResourceArray(text, response.status);
}

async function readDiscoveryResponseBody(response: Response): Promise<{
    contentType: string;
    text: string;
}> {
    const contentType = getResponseContentType(response);
    if (typeof response.text !== 'function') {
        throw new PlexApiError(
            AppErrorCode.PARSE_ERROR,
            'Expected Response with text method for server discovery response',
            response.status,
            false,
            response
        );
    }

    try {
        return {
            contentType,
            text: await response.text(),
        };
    } catch (error) {
        throw new PlexApiError(
            AppErrorCode.PARSE_ERROR,
            `Failed to read server discovery response body (content type: ${contentType || 'unknown'})`,
            response.status,
            false,
            error
        );
    }
}

function getResponseContentType(response: Response): string {
    return response.headers && typeof response.headers.get === 'function'
        ? response.headers.get('Content-Type') || ''
        : '';
}

function parseJsonResourceArray(text: string, status: number): PlexApiResource[] | null {
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
            return parsed.map((resource) => normalizeJsonResource(resource, status));
        }
    } catch (error) {
        if (error instanceof PlexApiError) {
            throw error;
        }
        // Fall through to XML parsing.
    }
    return null;
}

function isXmlResourceResponse(text: string, contentType: string): boolean {
    return contentType.toLowerCase().includes('xml') || text.trim().startsWith('<');
}

function normalizeJsonResource(resource: unknown, status: number): PlexApiResource {
    if (!isJsonObject(resource)) {
        throwInvalidJsonResource(status);
    }

    return {
        clientIdentifier: readJsonString(resource['clientIdentifier']),
        name: readJsonString(resource['name']),
        sourceTitle: readJsonString(resource['sourceTitle']),
        ownerId: readJsonString(resource['ownerId']),
        owned: readJsonBoolean(resource['owned']),
        provides: readJsonString(resource['provides']),
        connections: readJsonConnections(resource['connections'], status),
    };
}

function readJsonConnections(connections: unknown, status: number): PlexApiConnection[] {
    if (!Array.isArray(connections)) {
        throwInvalidJsonResource(status);
    }
    return connections.map((connection) => normalizeJsonConnection(connection, status));
}

function normalizeJsonConnection(connection: unknown, status: number): PlexApiConnection {
    if (!isJsonObject(connection)) {
        throw new PlexApiError(
            AppErrorCode.PARSE_ERROR,
            'Invalid JSON server discovery connection',
            status,
            false
        );
    }

    return {
        uri: readJsonString(connection['uri']),
        protocol: readJsonString(connection['protocol']),
        address: readJsonString(connection['address']),
        port: normalizePort(connection['port']),
        local: readJsonBoolean(connection['local']),
        relay: readJsonBoolean(connection['relay']),
    };
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJsonString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function readJsonBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === '1' || normalized === 'true';
    }
    if (typeof value === 'number') {
        return value === 1;
    }
    return false;
}

function normalizePort(value: unknown): number {
    const numberValue = typeof value === 'number'
        ? value
        : (typeof value === 'string' && value.trim().length > 0 ? Number(value.trim()) : 0);

    return Number.isInteger(numberValue) && numberValue >= MIN_PORT && numberValue <= MAX_PORT
        ? numberValue
        : 0;
}

function throwInvalidJsonResource(status: number): never {
    throw new PlexApiError(
        AppErrorCode.PARSE_ERROR,
        'Invalid JSON server discovery resource',
        status,
        false
    );
}

function parseXmlResourceArray(text: string, status: number): PlexApiResource[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
        throw new PlexApiError(
            AppErrorCode.PARSE_ERROR,
            'Invalid XML response from server discovery',
            status,
            false
        );
    }

    return Array.from(doc.getElementsByTagName('Device')).map(mapXmlDeviceToResource);
}

function mapXmlDeviceToResource(device: Element): PlexApiResource {
    const provides = device.getAttribute('provides') || '';
    const connections = Array.from(device.getElementsByTagName('Connection')).map(mapXmlConnection);

    return {
        clientIdentifier: device.getAttribute('clientIdentifier') || '',
        name: device.getAttribute('name') || '',
        sourceTitle: device.getAttribute('sourceTitle') || '',
        ownerId: device.getAttribute('ownerId') || '',
        owned: parseXmlBoolean(device.getAttribute('owned')),
        provides,
        connections,
    };
}

function mapXmlConnection(conn: Element): PlexApiConnection {
    return {
        uri: conn.getAttribute('uri') || '',
        protocol: conn.getAttribute('protocol') || '',
        address: conn.getAttribute('address') || '',
        port: normalizePort(conn.getAttribute('port')),
        local: parseXmlBoolean(conn.getAttribute('local')),
        relay: parseXmlBoolean(conn.getAttribute('relay')),
    };
}

function parseXmlBoolean(value: string | null): boolean {
    if (!value) return false;
    return value === '1';
}
