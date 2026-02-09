/**
 * @fileoverview Default webOS platform services implementation.
 * @module platform/webosPlatformServices
 */

import type {
    PlatformServices,
    PlatformRemoteButton,
} from './services';

type KeyMapEntry = readonly [number, PlatformRemoteButton];

const WEBOS_KEY_MAP_ENTRIES: readonly KeyMapEntry[] = [
    // Navigation
    [13, 'ok'],
    [461, 'back'],
    [8, 'back'],
    [27, 'back'],
    [38, 'up'],
    [40, 'down'],
    [37, 'left'],
    [39, 'right'],

    // Playback
    [415, 'play'],
    [19, 'pause'],
    [413, 'stop'],
    [412, 'rewind'],
    [417, 'fastforward'],

    // Channel
    [33, 'channelUp'],
    [34, 'channelDown'],

    // Color buttons
    [403, 'red'],
    [404, 'green'],
    [405, 'yellow'],
    [406, 'blue'],
    [112, 'red'],
    [113, 'green'],
    [114, 'yellow'],
    [115, 'blue'],

    // Numbers 0-9
    [48, 'num0'],
    [49, 'num1'],
    [50, 'num2'],
    [51, 'num3'],
    [52, 'num4'],
    [53, 'num5'],
    [54, 'num6'],
    [55, 'num7'],
    [56, 'num8'],
    [57, 'num9'],

    // Info/Guide
    [457, 'info'],
    [458, 'guide'],
    [73, 'info'],
    [71, 'guide'],
];

function createReadonlyKeyMap(
    entries: readonly KeyMapEntry[]
): ReadonlyMap<number, PlatformRemoteButton> {
    const internal = new Map<number, PlatformRemoteButton>(entries);
    const readonlyMap: ReadonlyMap<number, PlatformRemoteButton> = {
        get size(): number {
            return internal.size;
        },
        has: (key: number): boolean => internal.has(key),
        get: (key: number): PlatformRemoteButton | undefined => internal.get(key),
        forEach: (
            callbackfn: (
                value: PlatformRemoteButton,
                key: number,
                map: ReadonlyMap<number, PlatformRemoteButton>
            ) => void,
            thisArg?: unknown
        ): void => {
            internal.forEach((value, key) => {
                callbackfn.call(thisArg, value, key, readonlyMap);
            });
        },
        entries: (): IterableIterator<[number, PlatformRemoteButton]> => internal.entries(),
        keys: (): IterableIterator<number> => internal.keys(),
        values: (): IterableIterator<PlatformRemoteButton> => internal.values(),
        [Symbol.iterator]: (): IterableIterator<[number, PlatformRemoteButton]> =>
            internal[Symbol.iterator](),
    };
    return Object.freeze(readonlyMap);
}

const WEBOS_KEY_MAP: ReadonlyMap<number, PlatformRemoteButton> =
    createReadonlyKeyMap(WEBOS_KEY_MAP_ENTRIES);

function getChromeMajor(): number | null {
    try {
        if (typeof navigator === 'undefined') return null;
        const ua = navigator.userAgent || '';
        const chromeMatch = ua.match(/Chrome\/(\d+)/);
        if (!chromeMatch) return null;
        const parsed = Number(chromeMatch[1]);
        return Number.isFinite(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function isWebOs(): boolean {
    try {
        if (typeof navigator === 'undefined') return false;
        return /Web0S|webOS/i.test(navigator.userAgent || '');
    } catch {
        return false;
    }
}

function detectPlatformVersion(): string {
    try {
        if (typeof window !== 'undefined') {
            const webOSTV = (window as { webOSTV?: { platform?: { version?: string } } }).webOSTV;
            if (webOSTV?.platform?.version) {
                return webOSTV.platform.version;
            }
        }

        const chromeMajor = getChromeMajor();
        if (chromeMajor !== null) {
            // Heuristic fallback for environments where `webOSTV.platform.version` is unavailable.
            // Keep this mapping updated as new webOS Chromium baselines are validated.
            if (chromeMajor >= 120) return '25.0';
            if (chromeMajor >= 108) return '24.0';
            if (chromeMajor >= 94) return '23.0';
            if (chromeMajor >= 87) return '22.0';
        }

        return '6.0';
    } catch {
        return '6.0';
    }
}

function getDefaultPlexIdentity(clientIdentifier: string): Readonly<Record<string, string>> {
    return {
        'X-Plex-Client-Identifier': clientIdentifier,
        'X-Plex-Platform': 'webOS',
        'X-Plex-Product': 'Retune',
        'X-Plex-Version': '1.0.0',
        'X-Plex-Device': 'LG Smart TV',
        'X-Plex-Device-Name': 'Retune',
        'X-Plex-Platform-Version': detectPlatformVersion(),
        'X-Plex-Model': 'LGTV',
    };
}

function bindRelaunch(handler: (event: Event) => void): () => void {
    if (typeof document === 'undefined') {
        return () => undefined;
    }
    document.addEventListener('webOSRelaunch', handler);
    return () => {
        document.removeEventListener('webOSRelaunch', handler);
    };
}

function applyStreamSource(
    videoElement: HTMLVideoElement,
    stream: { protocol: 'hls' | 'dash' | 'direct'; url: string }
): void {
    videoElement.src = stream.url;
}

function deriveLanHttpSubtitleUrl(original: URL): URL | null {
    try {
        const hostname = original.hostname ?? '';
        if (!hostname.endsWith('.plex.direct')) return null;

        const firstLabel = hostname.split('.')[0] ?? '';
        if (!firstLabel.includes('-')) return null;
        const ip = firstLabel.split('-').join('.');
        const octets = ip.split('.');
        if (octets.length !== 4) return null;
        for (const octet of octets) {
            const n = Number(octet);
            if (!Number.isInteger(n) || n < 0 || n > 255) return null;
        }

        const url = new URL(original.toString());
        url.protocol = 'http:';
        url.hostname = ip;
        return url;
    } catch {
        return null;
    }
}

export function createWebOsPlatformServices(): PlatformServices {
    return {
        identity: {
            isWebOs,
            detectPlatformVersion,
            getDefaultPlexIdentity,
        },
        input: {
            getKeyMap: (): ReadonlyMap<number, PlatformRemoteButton> => WEBOS_KEY_MAP,
        },
        lifecycle: {
            bindRelaunch,
        },
        playback: {
            applyStreamSource,
        },
        subtitle: {
            deriveLanHttpSubtitleUrl,
        },
    };
}

export const webosPlatformServices: PlatformServices = createWebOsPlatformServices();
