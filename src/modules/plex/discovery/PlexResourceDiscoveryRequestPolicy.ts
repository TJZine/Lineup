import { AppErrorCode } from '../../lifecycle/types';
import { PlexApiError } from '../auth/plexAuthTransport';
import {
    applyXPlexTokenQueryParamIfTrusted,
    PLEX_CLOUD_TRUSTED_ORIGINS,
} from '../shared/plexUrl';
import { PLEX_DISCOVERY_CONSTANTS } from './constants';
import type { PlexApiConnection, PlexApiResource } from './types';
import { redactSensitiveTokens, redactUrlForLog } from '../../../utils/redact';

interface DiscoveryFetchVariant {
    url: string;
    headers?: Record<string, string>;
}

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

function buildDiscoveryFetchVariants(headers: Record<string, string>): DiscoveryFetchVariant[] {
    const baseUrl = new URL(
        PLEX_DISCOVERY_CONSTANTS.PLEX_TV_BASE_URL + PLEX_DISCOVERY_CONSTANTS.RESOURCES_ENDPOINT
    );
    baseUrl.search = `?${PLEX_DISCOVERY_CONSTANTS.RESOURCES_PARAMS}`;

    const token = headers['X-Plex-Token'];
    const baseUrlString = baseUrl.toString();
    const variants: DiscoveryFetchVariant[] = [
        { url: baseUrlString, headers },
    ];

    if (!token) {
        return variants;
    }

    const urlWithToken = new URL(baseUrlString);
    applyXPlexTokenQueryParamIfTrusted(urlWithToken, token, PLEX_CLOUD_TRUSTED_ORIGINS);
    variants.push({ url: urlWithToken.toString(), headers });

    const clientsBaseUrl = new URL('https://clients.plex.tv/api/v2/resources');
    clientsBaseUrl.search = `?${PLEX_DISCOVERY_CONSTANTS.RESOURCES_PARAMS}`;
    applyXPlexTokenQueryParamIfTrusted(clientsBaseUrl, token, PLEX_CLOUD_TRUSTED_ORIGINS);
    variants.push({ url: clientsBaseUrl.toString(), headers });

    return variants;
}

async function fetchDiscoveryResponse(
    headers: Record<string, string>,
    onAttemptUrl: (url: string) => void
): Promise<Response> {
    const variants = buildDiscoveryFetchVariants(headers);
    const maxAttempts = PLEX_DISCOVERY_CONSTANTS.MAX_DISCOVERY_ATTEMPTS;
    let response: Response | null = null;
    let lastError: unknown = null;
    let lastNonOkResponse: Response | null = null;
    let lastUrl = '';

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        let retryScheduled = false;
        for (const variant of variants) {
            const controller = new AbortController();
            const timeoutId = setTimeout(
                () => controller.abort(),
                PLEX_DISCOVERY_CONSTANTS.DISCOVERY_TIMEOUT_MS
            );
            try {
                lastUrl = variant.url;
                onAttemptUrl(lastUrl);
                const init: RequestInit = {
                    method: 'GET',
                    signal: controller.signal,
                };
                if (variant.headers) {
                    init.headers = variant.headers;
                }
                response = await fetch(variant.url, init);
            } catch (error) {
                lastError = error;
                continue;
            } finally {
                clearTimeout(timeoutId);
            }

            if (response.status === 429 && attempt < maxAttempts - 1) {
                const retryAfter = response.headers.get('Retry-After');
                const parsed = retryAfter ? parseInt(retryAfter, 10) : NaN;
                const delayMs = Number.isFinite(parsed) && parsed > 0
                    ? parsed * 1000
                    : PLEX_DISCOVERY_CONSTANTS.RATE_LIMIT_DEFAULT_DELAY_MS;
                await new Promise((resolve) => setTimeout(resolve, delayMs));
                response = null;
                retryScheduled = true;
                break;
            }

            if (response.status >= 500 && response.status <= 599) {
                lastNonOkResponse = response;
                lastError = new Error(`Request failed with status ${response.status}`);
                response = null;
                continue;
            }

            break;
        }

        if (response) {
            break;
        }
        if (retryScheduled) {
            continue;
        }
        if (lastNonOkResponse && attempt < maxAttempts - 1) {
            await new Promise((resolve) => {
                setTimeout(resolve, PLEX_DISCOVERY_CONSTANTS.DISCOVERY_RETRY_BACKOFF_MS);
            });
        }
    }

    if (!response) {
        if (lastNonOkResponse) {
            handleResponseError(lastNonOkResponse);
        }
        const message = redactSensitiveTokens(
            lastError instanceof Error
                ? lastError.message
                : 'unknown error'
        );
        throw new PlexApiError(
            AppErrorCode.SERVER_UNREACHABLE,
            `Failed to discover servers: ${message} (last url: ${redactDiscoveryUrl(lastUrl) || 'unknown'})`,
            undefined,
            true,
            lastError
        );
    }
    if (!response.ok) {
        handleResponseError(response);
    }

    return response;
}

async function parseResourcesResponse(response: Response): Promise<PlexApiResource[]> {
    const contentType =
        response.headers && typeof response.headers.get === 'function'
            ? response.headers.get('Content-Type') || ''
            : '';
    if (typeof response.text !== 'function') {
        if (typeof response.json === 'function') {
            const parsed = await response.json();
            return Array.isArray(parsed) ? (parsed as PlexApiResource[]) : [];
        }
        return [];
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

function handleResponseError(response: Response): never {
    if (response.status === 401) {
        throw new PlexApiError(
            AppErrorCode.AUTH_REQUIRED,
            'Unauthorized: authentication required',
            401,
            false
        );
    }
    if (response.status === 403) {
        throw new PlexApiError(
            AppErrorCode.AUTH_INVALID,
            'Forbidden: access denied',
            403,
            false
        );
    }
    if (response.status === 429) {
        throw new PlexApiError(
            AppErrorCode.RATE_LIMITED,
            'Request failed with status 429',
            429,
            true
        );
    }
    if (response.status >= 500) {
        throw new PlexApiError(
            AppErrorCode.SERVER_UNREACHABLE,
            'Server error: ' + String(response.status),
            response.status,
            true
        );
    }
    if (response.status >= 400 && response.status < 500) {
        throw new PlexApiError(
            AppErrorCode.SERVER_UNREACHABLE,
            'Client error during server discovery: ' + String(response.status),
            response.status,
            false
        );
    }
    throw new PlexApiError(
        AppErrorCode.SERVER_UNREACHABLE,
        'Unknown error during server discovery',
        response.status,
        true
    );
}

function redactDiscoveryUrl(url: string | undefined): string {
    if (!url) return '';
    return redactUrlForLog(url);
}
