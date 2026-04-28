export type PlatformRemoteButton =
    | 'ok' | 'back'
    | 'up' | 'down' | 'left' | 'right'
    | 'play' | 'pause' | 'stop'
    | 'rewind' | 'fastforward'
    | 'channelUp' | 'channelDown'
    | 'red' | 'green' | 'yellow' | 'blue'
    | 'num0' | 'num1' | 'num2' | 'num3' | 'num4'
    | 'num5' | 'num6' | 'num7' | 'num8' | 'num9'
    | 'info' | 'guide';

export interface PlatformIdentityService {
    isWebOs(): boolean;
    detectPlatformVersion(): string;
    getDefaultPlexIdentity(clientIdentifier: string): Readonly<Record<string, string>>;
}

export interface PlatformInputService {
    /**
     * Return a stable, read-only map reference for key mapping.
     * Implementations should avoid allocating a new Map per call.
     */
    getKeyMap(): ReadonlyMap<number, PlatformRemoteButton>;
}

export interface PlatformLifecycleService {
    bindRelaunch(handler: (event: Event) => void): () => void;
}

export interface PlatformPlaybackService {
    applyStreamSource(
        videoElement: HTMLVideoElement,
        stream: { protocol: 'hls' | 'dash' | 'direct'; url: string }
    ): void;
}

export interface PlatformSubtitleService {
    deriveLanHttpSubtitleUrl(original: URL): URL | null;
}

export interface PlatformServices {
    identity: PlatformIdentityService;
    input: PlatformInputService;
    lifecycle: PlatformLifecycleService;
    playback: PlatformPlaybackService;
    subtitle: PlatformSubtitleService;
}
