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
    const contentType =
        response.headers && typeof response.headers.get === 'function'
            ? response.headers.get('Content-Type') || ''
            : '';
    if (typeof response.text !== 'function') {
        throw new PlexApiError(
            AppErrorCode.PARSE_ERROR,
            'Expected Response with text method for server discovery response',
            response.status,
            false,
            response
        );
    }

    const text = await response.text();
    if (!text) {
        return [];
    }

    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
            return parsed as PlexApiResource[];
        }
    } catch {
        // Fall through to XML parsing.
    }

    if (!contentType.includes('xml') && !text.trim().startsWith('<')) {
        throw new PlexApiError(
            AppErrorCode.PARSE_ERROR,
            'Failed to parse server discovery response',
            response.status,
            false
        );
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
        throw new PlexApiError(
            AppErrorCode.PARSE_ERROR,
            'Invalid XML response from server discovery',
            response.status,
            false
        );
    }

    const devices = Array.from(doc.getElementsByTagName('Device'));
    const resources: PlexApiResource[] = [];
    for (const device of devices) {
        const provides = device.getAttribute('provides') || '';
        const connections: PlexApiConnection[] = [];
        const connectionNodes = Array.from(device.getElementsByTagName('Connection'));
        for (const conn of connectionNodes) {
            const portRaw = conn.getAttribute('port');
            const port = portRaw ? Number(portRaw) : 0;
            connections.push({
                uri: conn.getAttribute('uri') || '',
                protocol: conn.getAttribute('protocol') || '',
                address: conn.getAttribute('address') || '',
                port: Number.isFinite(port) ? port : 0,
                local: parseXmlBoolean(conn.getAttribute('local')),
                relay: parseXmlBoolean(conn.getAttribute('relay')),
            });
        }

        resources.push({
            clientIdentifier: device.getAttribute('clientIdentifier') || '',
            name: device.getAttribute('name') || '',
            sourceTitle: device.getAttribute('sourceTitle') || '',
            ownerId: device.getAttribute('ownerId') || '',
            owned: parseXmlBoolean(device.getAttribute('owned')),
            provides,
            connections,
        });
    }

    return resources;
}

function parseXmlBoolean(value: string | null): boolean {
    if (!value) return false;
    return value === '1';
}
