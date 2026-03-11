import { resolveClientIdentifier } from './clientIdentifier';
import type { PlexAuthConfig } from './interfaces';

const DEFAULT_PLEX_AUTH_METADATA = {
    product: 'Lineup',
    version: '1.0.0',
    platform: 'webOS',
    platformVersion: '6.0',
    device: 'LG Smart TV',
    deviceName: 'Living Room TV',
} as const;

export function createDefaultPlexAuthConfig(preferredClientIdentifier?: string): PlexAuthConfig {
    return {
        ...DEFAULT_PLEX_AUTH_METADATA,
        clientIdentifier: resolveClientIdentifier(preferredClientIdentifier),
    };
}
