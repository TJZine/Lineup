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
    platformVersion: string = '6.0'
): PlexAuthConfig {
    return {
        ...DEFAULT_PLEX_AUTH_METADATA,
        platformVersion,
        clientIdentifier: resolveClientIdentifier(preferredClientIdentifier),
    };
}
