import {
    applyXPlexTokenQueryParamIfTrusted,
    PLEX_CLOUD_TRUSTED_ORIGINS,
} from '../shared/plexUrl';
import { PLEX_DISCOVERY_CONSTANTS } from './constants';

export interface DiscoveryFetchVariant {
    url: string;
    headers?: Record<string, string>;
}

export function buildDiscoveryFetchVariants(headers: Record<string, string>): DiscoveryFetchVariant[] {
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
    pushVariantWhenTokenWasApplied(variants, urlWithToken, headers);

    const clientsBaseUrl = new URL(
        PLEX_DISCOVERY_CONSTANTS.PLEX_CLIENTS_BASE_URL + PLEX_DISCOVERY_CONSTANTS.RESOURCES_ENDPOINT
    );
    clientsBaseUrl.search = `?${PLEX_DISCOVERY_CONSTANTS.RESOURCES_PARAMS}`;
    applyXPlexTokenQueryParamIfTrusted(clientsBaseUrl, token, PLEX_CLOUD_TRUSTED_ORIGINS);
    pushVariantWhenTokenWasApplied(variants, clientsBaseUrl, headers);

    return variants;
}

function pushVariantWhenTokenWasApplied(
    variants: DiscoveryFetchVariant[],
    url: URL,
    headers: Record<string, string>
): void {
    if (url.searchParams.has('X-Plex-Token')) {
        variants.push({ url: url.toString(), headers });
    }
}
