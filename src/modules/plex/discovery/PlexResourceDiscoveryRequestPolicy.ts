import { AppErrorCode } from '../../lifecycle/types';
import { PlexApiError } from '../auth/plexAuthTransport';
import type { PlexApiConnection, PlexApiResource } from './types';
import { redactSensitiveTokens } from '../../../utils/redact';
import { fetchDiscoveryResponse } from './PlexDiscoveryRequestExecutor';
import { redactDiscoveryUrl } from './PlexDiscoveryResponsePolicy';

export async function discoverPlexResourcesWithRequestPolicy(
    headers: Record<string, string>
): Promise<PlexApiResource[]> {
    let lastUrl = '';
    try {
        const response = await fetchDiscoveryResponse(headers, (url) => {
            lastUrl = url;
        });
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

    const jsonResources = parseJsonResourceArray(text);
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
    if (typeof response.text !== 'function') {
        throw new PlexApiError(
            AppErrorCode.PARSE_ERROR,
            'Expected Response with text method for server discovery response',
            response.status,
            false,
            response
        );
    }

    return {
        contentType: getResponseContentType(response),
        text: await response.text(),
    };
}

function getResponseContentType(response: Response): string {
    return response.headers && typeof response.headers.get === 'function'
        ? response.headers.get('Content-Type') || ''
        : '';
}

function parseJsonResourceArray(text: string): PlexApiResource[] | null {
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
            return parsed as PlexApiResource[];
        }
    } catch {
        // Fall through to XML parsing.
    }
    return null;
}

function isXmlResourceResponse(text: string, contentType: string): boolean {
    return contentType.includes('xml') || text.trim().startsWith('<');
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
    const portRaw = conn.getAttribute('port');
    const port = portRaw ? Number(portRaw) : 0;
    return {
        uri: conn.getAttribute('uri') || '',
        protocol: conn.getAttribute('protocol') || '',
        address: conn.getAttribute('address') || '',
        port: Number.isFinite(port) ? port : 0,
        local: parseXmlBoolean(conn.getAttribute('local')),
        relay: parseXmlBoolean(conn.getAttribute('relay')),
    };
}

function parseXmlBoolean(value: string | null): boolean {
    if (!value) return false;
    return value === '1';
}
