import { resolveClientIdentifier } from './clientIdentifier';
import type { PlexAuthConfig } from './interfaces';

export const DEFAULT_PLEX_AUTH_METADATA = {
    product: 'Lineup',
    version: '1.0.0',
    platform: 'webOS',
    device: 'LG Smart TV',
    deviceName: 'Living Room TV',
} as const;

export interface PlexIdentityHeaderOptions {
    platformVersion?: string | null;
    deviceName?: string | null;
    model?: string | null;
}

export function createPlexIdentityMetadata(
    clientIdentifier: string,
    platformVersion: string = '6.0'
): PlexAuthConfig {
    return {
        ...DEFAULT_PLEX_AUTH_METADATA,
        platformVersion,
        clientIdentifier,
    };
}

export function createPlexIdentityHeaders(
    metadata: PlexAuthConfig,
    options: PlexIdentityHeaderOptions = {}
): Record<string, string> {
    const headers: Record<string, string> = {
        'X-Plex-Client-Identifier': metadata.clientIdentifier,
        'X-Plex-Product': metadata.product,
        'X-Plex-Version': metadata.version,
        'X-Plex-Platform': metadata.platform,
        'X-Plex-Device': metadata.device,
    };

    if (options.platformVersion) {
        headers['X-Plex-Platform-Version'] = options.platformVersion;
    }
    if (options.deviceName) {
        headers['X-Plex-Device-Name'] = options.deviceName;
    }
    if (options.model) {
        headers['X-Plex-Model'] = options.model;
    }

    return headers;
}

export function createDefaultPlexAuthConfig(
    preferredClientIdentifier?: string,
    platformVersion: string = '6.0',
    resolvePlatformVersion?: () => string
): PlexAuthConfig {
    const config = createPlexIdentityMetadata(
        resolveClientIdentifier(preferredClientIdentifier),
        platformVersion
    );

    if (!resolvePlatformVersion) {
        return config;
    }

    Object.defineProperty(config, 'platformVersion', {
        enumerable: true,
        configurable: true,
        get: () => resolvePlatformVersion(),
    });

    return config;
}
