import { SubtitleStreamDebugProbeCoordinator } from '../SubtitleStreamDebugProbeCoordinator';
import type { PlexStream } from '../types';

describe('SubtitleStreamDebugProbeCoordinator', () => {
    let mockFetch: jest.Mock;
    let realFetch: typeof globalThis.fetch;

    beforeEach(() => {
        jest.useFakeTimers();
        realFetch = globalThis.fetch;
        mockFetch = jest.fn().mockResolvedValue(
            new Response('WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nTest', {
                status: 200,
                headers: { 'content-type': 'text/vtt' },
            })
        );
        globalThis.fetch = mockFetch as typeof globalThis.fetch;
    });

    afterEach(() => {
        globalThis.fetch = realFetch;
        jest.useRealTimers();
        jest.restoreAllMocks();
        jest.resetAllMocks();
    });

    it('logs subtitle discovery and deterministically probes selected text candidates', async () => {
        const subtitleDebugLogPort = {
            isEnabled: jest.fn(() => true),
            log: jest.fn(),
        };
        const coordinator = new SubtitleStreamDebugProbeCoordinator({
            getServerUri: (): string => 'http://192.168.1.100:32400',
            getAuthHeaders: (): Record<string, string> => ({ 'X-Plex-Token': 'mock-token' }),
            subtitleDebugLogPort,
        });

        coordinator.scheduleDebugProbes({
            itemKey: '12345',
            selectedSubtitleStream: null,
            availableSubtitleStreams: [
                {
                    id: 'sub-key-nonpreferred',
                    streamType: 3,
                    codec: 'srt',
                    key: '/library/streams/sub-key-nonpreferred',
                    language: 'Spanish',
                    languageCode: 'es',
                },
                {
                    id: 'sub-key-english',
                    streamType: 3,
                    codec: 'srt',
                    key: '/library/streams/sub-key-english',
                    language: 'English',
                    languageCode: 'en',
                },
                {
                    id: 'sub-keyless-forced',
                    streamType: 3,
                    codec: 'unknown',
                    format: 'vtt',
                    language: 'French',
                    languageCode: 'fr',
                    forced: true,
                },
                {
                    id: 'sub-image',
                    streamType: 3,
                    codec: 'pgs',
                    key: '/library/streams/sub-image',
                },
            ] as PlexStream[],
        });

        await jest.runAllTimersAsync();

        expect(subtitleDebugLogPort.log).toHaveBeenCalledWith(
            'subtitle_tracks_discovered',
            expect.objectContaining({
                count: 4,
                withKeyCount: 3,
                withoutKeyCount: 1,
            })
        );
        expect(subtitleDebugLogPort.log).toHaveBeenCalledWith(
            'subtitle_streams_discovered',
            expect.objectContaining({
                itemKey: '12345',
                subtitlesCount: 4,
                subtitleStreams: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'sub-image',
                        isTextCandidate: false,
                        fetchableViaKey: true,
                    }),
                ]),
            })
        );
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockFetch).toHaveBeenNthCalledWith(
            1,
            'http://192.168.1.100:32400/library/streams/sub-key-english',
            expect.objectContaining({ method: 'GET' })
        );
        expect(mockFetch).toHaveBeenNthCalledWith(
            2,
            'http://192.168.1.100:32400/library/streams/sub-keyless-forced',
            expect.objectContaining({ method: 'GET' })
        );
    });
});
