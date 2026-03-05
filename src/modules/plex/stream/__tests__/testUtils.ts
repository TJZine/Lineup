import type { PlexStreamResolverConfig } from '../interfaces';
import type { PlexMediaItem, PlexMediaFile, PlexStream } from '../types';

export function createMockConfig(
    overrides: Partial<PlexStreamResolverConfig> = {}
): PlexStreamResolverConfig {
    return {
        getAuthHeaders: () => ({
            'X-Plex-Token': 'mock-token',
            Accept: 'application/json',
        }),
        getServerUri: () => 'http://192.168.1.100:32400',
        getHttpsConnection: () => null,
        getRelayConnection: () => null,
        debugOverridesStore: {
            readTranscodeProfileName: () => null,
        },
        getItem: jest.fn().mockResolvedValue(null),
        clientIdentifier: 'test-client-id',
        ...overrides,
    };
}

export function createMockMediaItem(
    overrides: Partial<{
        container: string;
        videoCodec: string;
        audioCodec: string;
        width: number;
        height: number;
        aspectRatio: number;
        bitrate: number;
        durationMs: number;
    }> = {},
    options: Partial<{
        extraStreams: PlexStream[];
        partKey: string;
    }> = {}
): PlexMediaItem {
    const defaults = {
        container: 'mp4',
        videoCodec: 'h264',
        audioCodec: 'aac',
        width: 1920,
        height: 1080,
        aspectRatio: 1.78,
        bitrate: 8000,
        durationMs: 7200000,
    };
    const merged = { ...defaults, ...overrides };

    const videoStream: PlexStream = {
        id: 'video-1',
        streamType: 1,
        codec: merged.videoCodec,
        width: merged.width,
        height: merged.height,
    };

    const audioStream: PlexStream = {
        id: 'audio-1',
        streamType: 2,
        codec: merged.audioCodec,
        language: 'English',
        languageCode: 'en',
        channels: 2,
        default: true,
    };
    const extraStreams = options.extraStreams ?? [];

    const media: PlexMediaFile = {
        id: 'media-1',
        duration: merged.durationMs,
        bitrate: merged.bitrate,
        width: merged.width,
        height: merged.height,
        aspectRatio: merged.aspectRatio,
        videoCodec: merged.videoCodec,
        audioCodec: merged.audioCodec,
        audioChannels: 2,
        container: merged.container,
        videoResolution: '1080',
        parts: [
            {
                id: 'part-1',
                key: options.partKey ?? '/library/parts/12345/file.mp4',
                duration: merged.durationMs,
                file: '/path/to/file.mp4',
                size: 1000000000,
                container: merged.container,
                streams: [videoStream, audioStream, ...extraStreams],
            },
        ],
    };

    return {
        ratingKey: '12345',
        key: '/library/metadata/12345',
        type: 'movie',
        title: 'Test Movie',
        sortTitle: 'Test Movie',
        summary: 'A test movie',
        year: 2024,
        durationMs: merged.durationMs,
        addedAt: new Date(),
        updatedAt: new Date(),
        thumb: '/library/metadata/12345/thumb',
        art: null,
        media: [media],
    };
}
