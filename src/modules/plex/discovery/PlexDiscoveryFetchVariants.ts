import {
    applyXPlexTokenQueryParamIfTrusted,
    PLEX_CLOUD_TRUSTED_ORIGINS,
    readXPlexTokenFromHeaders,
} from '../shared/plexUrl';
import { PLEX_DISCOVERY_CONSTANTS } from './constants';

export interface DiscoveryFetchVariant {
    url: string;
    headers?: Record<string, string>;
}

export function buildDiscoveryFetchVariants(headers: Record<string, string>): DiscoveryFetchVariant[] {
    const baseUrl = buildDiscoveryResourcesUrl(PLEX_DISCOVERY_CONSTANTS.PLEX_TV_BASE_URL);
    const token = readXPlexTokenFromHeaders(headers);
    const baseUrlString = baseUrl.toString();
    const variants: DiscoveryFetchVariant[] = [
        { url: baseUrlString, headers },
    ];

    if (!token) {
        return variants;
    }

    pushTrustedTokenVariant(variants, new URL(baseUrlString), token, headers);
    pushTrustedTokenVariant(
        variants,
        buildDiscoveryResourcesUrl(PLEX_DISCOVERY_CONSTANTS.PLEX_CLIENTS_BASE_URL),
        token,
        headers
    );

    return variants;
}

function buildDiscoveryResourcesUrl(baseUrl: string): URL {
    const url = new URL(baseUrl + PLEX_DISCOVERY_CONSTANTS.RESOURCES_ENDPOINT);
    url.search = `?${PLEX_DISCOVERY_CONSTANTS.RESOURCES_PARAMS}`;
    return url;
}

function pushTrustedTokenVariant(
    variants: DiscoveryFetchVariant[],
    url: URL,
    token: string,
    headers: Record<string, string>
): void {
    applyXPlexTokenQueryParamIfTrusted(url, token, PLEX_CLOUD_TRUSTED_ORIGINS);
    pushVariantWhenTokenWasApplied(variants, url, headers);
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
