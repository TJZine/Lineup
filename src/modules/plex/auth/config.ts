import { resolveClientIdentifier } from './clientIdentifier';
import type { PlexAuthConfig } from './interfaces';

const DEFAULT_PLEX_AUTH_METADATA = {
    product: 'Lineup',
    version: '1.0.0',
    platform: 'webOS',
    device: 'LG Smart TV',
    deviceName: 'Living Room TV',
} as const;

export function createDefaultPlexAuthConfig(
    preferredClientIdentifier?: string,
    platformVersion: string = '6.0',
    resolvePlatformVersion?: () => string
): PlexAuthConfig {
    const config: PlexAuthConfig = {
        ...DEFAULT_PLEX_AUTH_METADATA,
        platformVersion,
        clientIdentifier: resolveClientIdentifier(preferredClientIdentifier),
    };

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
