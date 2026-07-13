/**
 * @fileoverview Unit tests for SubtitleManager.
 * @module modules/player/__tests__/SubtitleManager.test
 * @jest-environment jsdom
 */

import { SubtitleManager } from '../../subtitles/SubtitleManager';
import type { SubtitleTrack } from '../../core/types';
import type { PlatformSubtitleService } from '../../../../platform';
import { DeveloperSettingsStore } from '../../../settings/DeveloperSettingsStore';
import { flushPromisesAndMacrotask } from '../../../../__tests__/helpers';
import { installMockTextTracks } from './text-track-test-helpers';

// ============================================
// Test Helpers
// ============================================

function createMockVideoElement(): HTMLVideoElement {
    const video = document.createElement('video');

    // Create a minimal mock for textTracks
    const mockTextTracks = {
        length: 0,
        getTrackById: jest.fn().mockReturnValue(null),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        onchange: null,
        onaddtrack: null,
        onremovetrack: null,
        item: jest.fn().mockReturnValue(null),
    };

    Object.defineProperty(video, 'textTracks', {
        get: (): TextTrackList => mockTextTracks as unknown as TextTrackList,
        configurable: true,
    });

    return video;
}

function getTrackElement(video: HTMLVideoElement, trackId: string): HTMLTrackElement | null {
    return video.querySelector(`track#${trackId}`);
}

function createMockSubtitleTrack(
    overrides: Partial<SubtitleTrack> = {}
): SubtitleTrack {
    return {
        id: 'sub-1',
        label: 'English (SRT)',
        languageCode: 'en',
        language: 'English',
        codec: 'srt',
        format: 'srt',
        key: '/library/streams/1',
        default: false,
        forced: false,
        isTextCandidate: true,
        fetchableViaKey: true,
        ...overrides,
    };
}

function installFetchAndBlobMocks(): { fetchMock: jest.Mock; restore: () => void } {
    const originalFetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
    const originalCreateObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const originalRevokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');

    const fetchMock = jest.fn();
    Object.defineProperty(globalThis, 'fetch', {
        value: fetchMock,
        writable: true,
        configurable: true,
    });
    Object.defineProperty(URL, 'createObjectURL', {
        value: jest.fn().mockReturnValue('blob:mock'),
        writable: true,
        configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
        value: jest.fn(),
        writable: true,
        configurable: true,
    });

    const restore = (): void => {
        if (originalFetchDescriptor) {
            Object.defineProperty(globalThis, 'fetch', originalFetchDescriptor);
        } else {
            Reflect.deleteProperty(globalThis, 'fetch');
        }
        if (originalCreateObjectUrlDescriptor) {
            Object.defineProperty(URL, 'createObjectURL', originalCreateObjectUrlDescriptor);
        } else {
            Reflect.deleteProperty(URL, 'createObjectURL');
        }
        if (originalRevokeObjectUrlDescriptor) {
            Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectUrlDescriptor);
        } else {
            Reflect.deleteProperty(URL, 'revokeObjectURL');
        }
    };

    return { fetchMock, restore };
}

const flushSubtitleAsync = (): Promise<void> => flushPromisesAndMacrotask(5);
const flushSubtitleMicrotasks = async (count = 12): Promise<void> => {
    for (let i = 0; i < count; i++) {
        await Promise.resolve();
    }
};

const developerSettingsStore = new DeveloperSettingsStore();

function enableSubtitleDebugLogging(): void {
    developerSettingsStore.writeSubtitleDebugLoggingEnabled(true);
}

function clearSubtitleDebugLogging(): void {
    developerSettingsStore.clearSubtitleDebugLoggingEnabled();
}

// ============================================
// SubtitleManager Tests
// ============================================

describe('SubtitleManager', () => {
    let manager: SubtitleManager;
    let videoElement: HTMLVideoElement;

    beforeEach(() => {
        clearSubtitleDebugLogging();
        manager = new SubtitleManager();
        videoElement = createMockVideoElement();
        manager.initialize(videoElement);
    });

    afterEach(() => {
        clearSubtitleDebugLogging();
        manager.destroy();
    });

    // ========================================
    // loadTracks
    // ========================================

        describe('loadTracks', () => {
        it('emits redacted subtitle debug output when subtitle debug logging is enabled', () => {
            enableSubtitleDebugLogging();
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            const tracks: SubtitleTrack[] = [
                createMockSubtitleTrack({ id: 'en', format: 'vtt', codec: 'vtt' }),
            ];

            try {
                manager.loadTracks(tracks, {
                    serverUri: 'http://example.com',
                    authHeaders: { 'X-Plex-Token': 'sensitive-token' },
                    resolvedBaseUrl: 'http://example.com',
                });

                expect(warnSpy).toHaveBeenCalledWith(
                    'subtitle_debug',
                    'SubtitleManager',
                    'subtitle_tracks_discovered',
                    expect.stringContaining('"count":1')
                );
                expect(
                    warnSpy.mock.calls.some((call) => call.some((arg) => String(arg).includes('sensitive-token')))
                ).toBe(false);
            } finally {
                warnSpy.mockRestore();
            }
        });

        it('should create track elements for text-based formats', () => {
            const tracks: SubtitleTrack[] = [
                createMockSubtitleTrack({ id: 'en', format: 'srt' }),
                createMockSubtitleTrack({ id: 'es', format: 'vtt', languageCode: 'es' }),
            ];

            const burnInRequired = manager.loadTracks(tracks, {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
            });

            // Should not require burn-in for SRT/VTT
            expect(burnInRequired).toHaveLength(0);

            // Should have loaded tracks
            expect(manager.getTracks()).toHaveLength(2);
        });

        it('should return burn-in required for PGS format', () => {
            const tracks: SubtitleTrack[] = [
                createMockSubtitleTrack({ id: 'pgs-en', format: 'pgs' }),
            ];

            const burnInRequired = manager.loadTracks(tracks, {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
            });

            expect(burnInRequired).toContain('pgs-en');
        });

        it('should return burn-in required for ASS format', () => {
            const tracks: SubtitleTrack[] = [
                createMockSubtitleTrack({ id: 'ass-en', format: 'ass' }),
            ];

            const burnInRequired = manager.loadTracks(tracks, {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
            });

            expect(burnInRequired).toContain('ass-en');
        });

        it('should unload existing tracks before loading new ones', () => {
            const tracks1: SubtitleTrack[] = [
                createMockSubtitleTrack({ id: 'en-1' }),
            ];
            const tracks2: SubtitleTrack[] = [
                createMockSubtitleTrack({ id: 'en-2' }),
            ];

            manager.loadTracks(tracks1, {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
            });
            expect(manager.getTracks()).toHaveLength(1);
            expect(manager.getTracks()[0]?.id).toBe('en-1');

            manager.loadTracks(tracks2, {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
            });
            expect(manager.getTracks()).toHaveLength(1);
            expect(manager.getTracks()[0]?.id).toBe('en-2');
        });

        it('normalizes same-origin absolute subtitle keys and falls back for foreign absolute keys', () => {
            const normalizedTrack = createMockSubtitleTrack({
                id: 'sub-absolute',
                key: 'http://example.com/library/streams/sub-absolute',
                format: 'vtt',
                codec: 'vtt',
            });
            const foreignTrack = createMockSubtitleTrack({
                id: 'sub-foreign',
                key: 'https://malicious.example/library/streams/sub-foreign',
                format: 'vtt',
                codec: 'vtt',
            });

            manager.loadTracks([normalizedTrack, foreignTrack], {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
            });

            expect(getTrackElement(videoElement, 'sub-absolute')?.src).toContain(
                'http://example.com/library/streams/sub-absolute'
            );
            expect(getTrackElement(videoElement, 'sub-absolute')?.src).toContain('X-Plex-Token=token');
            expect(getTrackElement(videoElement, 'sub-foreign')?.src).toContain(
                'http://example.com/library/streams/sub-foreign'
            );
            expect(getTrackElement(videoElement, 'sub-foreign')?.src).toContain('X-Plex-Token=token');
            expect(getTrackElement(videoElement, 'sub-foreign')?.src).not.toContain('malicious.example');
        });

        it('prefers the resolved playback base url for direct subtitle urls', () => {
            const normalizedTrack = createMockSubtitleTrack({
                id: 'sub-absolute',
                key: 'http://example.com/library/streams/sub-absolute',
                format: 'vtt',
                codec: 'vtt',
            });

            manager.loadTracks([normalizedTrack], {
                serverUri: 'http://example.com',
                resolvedBaseUrl: 'https://secure.plex.direct:32400',
                authHeaders: { 'X-Plex-Token': 'token' },
            });

            expect(getTrackElement(videoElement, 'sub-absolute')?.src).toContain(
                'https://secure.plex.direct:32400/library/streams/sub-absolute'
            );
            expect(getTrackElement(videoElement, 'sub-absolute')?.src).toContain('X-Plex-Token=token');
        });
    });

    // ========================================
    // setActiveTrack
    // ========================================

    describe('setActiveTrack', () => {
        it('should update active track ID', () => {
            const tracks: SubtitleTrack[] = [
                // Use a VTT track here to avoid triggering the SRT fallback fetch path.
                createMockSubtitleTrack({ id: 'en', codec: 'vtt', format: 'vtt' }),
            ];
            manager.loadTracks(tracks, {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
            });

            manager.setActiveTrack('en');
            expect(manager.getActiveTrackId()).toBe('en');

            manager.setActiveTrack(null);
            expect(manager.getActiveTrackId()).toBeNull();
        });

        it('logs the native text-track debug snapshot without token-bearing fields', () => {
            enableSubtitleDebugLogging();
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            installMockTextTracks(videoElement, [
                {
                    id: 'en',
                    kind: 'subtitles',
                    label: 'English',
                    language: 'en',
                    mode: 'showing',
                    cuesLength: 3,
                    activeCuesLength: 1,
                },
            ]);

            try {
                manager.setActiveTrack(null);

                const payload = warnSpy.mock.calls.find(
                    (call) => call[1] === 'SubtitleManager' && call[2] === 'setActiveTrack'
                )?.[3];

                expect(JSON.parse(String(payload))).toEqual({
                    activeTrackId: null,
                    nativeTextTracks: [
                        {
                            id: 'en',
                            kind: 'subtitles',
                            label: 'English',
                            language: 'en',
                            mode: 'hidden',
                            cuesLength: 3,
                            activeCuesLength: 1,
                        },
                    ],
                });
                expect(String(payload)).not.toContain('X-Plex-Token');
                expect(String(payload)).not.toContain('http://');
            } finally {
                warnSpy.mockRestore();
            }
        });

        it('does not classify keyless text tracks as burn-in and attempts extraction on selection', async () => {
            const { fetchMock, restore } = installFetchAndBlobMocks();
            try {
                const onDeactivate = jest.fn(() => true);
                const embeddedTrack = createMockSubtitleTrack({
                    id: 'embedded-srt',
                    codec: 'srt',
                    format: 'srt',
                    fetchableViaKey: false,
                });
                delete (embeddedTrack as { key?: string }).key;
                const tracks: SubtitleTrack[] = [
                    embeddedTrack,
                ];

                fetchMock.mockResolvedValue({
                    ok: true,
                    status: 200,
                    headers: { get: (): null => null },
                    text: async () => `1
00:00:00,000 --> 00:00:01,000
Hello`,
                });

                const burnInRequired = manager.loadTracks(tracks, {
                    serverUri: 'http://example.com',
                    authHeaders: { 'X-Plex-Token': 'token' },
                    onDeactivate,
                });
                expect(burnInRequired).toHaveLength(0);

                manager.setActiveTrack('embedded-srt');

                expect(manager.getActiveTrackId()).toBe('embedded-srt');
                expect(onDeactivate).not.toHaveBeenCalled();

                await flushSubtitleAsync();
                expect(fetchMock).toHaveBeenCalled();
            } finally {
                restore();
            }
        });

        it('does not surface unavailable when handled subtitle deactivation recovery succeeds', async () => {
            const { fetchMock, restore } = installFetchAndBlobMocks();

            try {
                const onDeactivate = jest.fn(() => true);
                const onDeactivateRecovery = jest.fn().mockResolvedValue('handled');
                const onUnavailable = jest.fn();
                const embeddedTrack = createMockSubtitleTrack({
                    id: 'embedded-srt',
                    codec: 'srt',
                    format: 'srt',
                    fetchableViaKey: false,
                });
                delete (embeddedTrack as { key?: string }).key;
                fetchMock.mockResolvedValue({
                    ok: false,
                    status: 404,
                    headers: { get: (): null => null },
                    text: async (): Promise<string> => 'Not found',
                });

                manager.loadTracks([embeddedTrack], {
                    serverUri: 'http://example.com',
                    authHeaders: { 'X-Plex-Token': 'token' },
                    onDeactivate,
                    onDeactivateRecovery,
                    onUnavailable,
                });

                manager.setActiveTrack('embedded-srt');
                await flushSubtitleAsync();

                expect(onDeactivate).toHaveBeenCalledWith({
                    trackId: 'embedded-srt',
                    reason: 'subtitle_text_unsupported',
                });
                expect(onDeactivateRecovery).toHaveBeenCalledWith({
                    trackId: 'embedded-srt',
                    reason: 'subtitle_text_unsupported',
                });
                expect(onUnavailable).not.toHaveBeenCalled();
            } finally {
                restore();
            }
        });

        it('surfaces unavailable when handled subtitle deactivation recovery fails', async () => {
            const { fetchMock, restore } = installFetchAndBlobMocks();

            try {
                const onDeactivate = jest.fn(() => true);
                const onDeactivateRecovery = jest.fn().mockResolvedValue('failed');
                const onUnavailable = jest.fn();
                const embeddedTrack = createMockSubtitleTrack({
                    id: 'embedded-srt',
                    codec: 'srt',
                    format: 'srt',
                    fetchableViaKey: false,
                });
                delete (embeddedTrack as { key?: string }).key;
                fetchMock.mockResolvedValue({
                    ok: false,
                    status: 404,
                    headers: { get: (): null => null },
                    text: async (): Promise<string> => 'Not found',
                });

                manager.loadTracks([embeddedTrack], {
                    serverUri: 'http://example.com',
                    authHeaders: { 'X-Plex-Token': 'token' },
                    onDeactivate,
                    onDeactivateRecovery,
                    onUnavailable,
                });

                manager.setActiveTrack('embedded-srt');
                await flushSubtitleAsync();

                expect(onDeactivateRecovery).toHaveBeenCalledWith({
                    trackId: 'embedded-srt',
                    reason: 'subtitle_text_unsupported',
                });
                expect(onUnavailable).toHaveBeenCalled();
            } finally {
                restore();
            }
        });

        it('surfaces unavailable when handled subtitle deactivation recovery throws synchronously', async () => {
            const { fetchMock, restore } = installFetchAndBlobMocks();

            try {
                const onDeactivate = jest.fn(() => true);
                const onDeactivateRecovery = jest.fn(() => {
                    throw new Error('sync recovery failure');
                });
                const onUnavailable = jest.fn();
                const embeddedTrack = createMockSubtitleTrack({
                    id: 'embedded-srt',
                    codec: 'srt',
                    format: 'srt',
                    fetchableViaKey: false,
                });
                delete (embeddedTrack as { key?: string }).key;
                fetchMock.mockResolvedValue({
                    ok: false,
                    status: 404,
                    headers: { get: (): null => null },
                    text: async (): Promise<string> => 'Not found',
                });

                manager.loadTracks([embeddedTrack], {
                    serverUri: 'http://example.com',
                    authHeaders: { 'X-Plex-Token': 'token' },
                    onDeactivate,
                    onDeactivateRecovery,
                    onUnavailable,
                });

                manager.setActiveTrack('embedded-srt');
                await flushSubtitleAsync();

                expect(onDeactivateRecovery).toHaveBeenCalledWith({
                    trackId: 'embedded-srt',
                    reason: 'subtitle_text_unsupported',
                });
                expect(onUnavailable).toHaveBeenCalledTimes(1);
            } finally {
                restore();
            }
        });

        it('passes auth-specific deactivation reasons through recovery callbacks', async () => {
            const { fetchMock, restore } = installFetchAndBlobMocks();

            try {
                const onDeactivate = jest.fn(() => true);
                const onDeactivateRecovery = jest.fn().mockResolvedValue('handled');
                const embeddedTrack = createMockSubtitleTrack({
                    id: 'embedded-srt',
                    codec: 'srt',
                    format: 'srt',
                    fetchableViaKey: false,
                });
                delete (embeddedTrack as { key?: string }).key;
                fetchMock.mockResolvedValue({
                    ok: false,
                    status: 403,
                    headers: { get: (): null => null },
                    text: async (): Promise<string> => 'Forbidden',
                });

                manager.loadTracks([embeddedTrack], {
                    serverUri: 'http://example.com',
                    authHeaders: { 'X-Plex-Token': 'token' },
                    onDeactivate,
                    onDeactivateRecovery,
                });

                manager.setActiveTrack('embedded-srt');
                await flushSubtitleAsync();

                expect(onDeactivate).toHaveBeenCalledWith({
                    trackId: 'embedded-srt',
                    reason: 'subtitle_text_auth_failed',
                });
                expect(onDeactivateRecovery).toHaveBeenCalledWith({
                    trackId: 'embedded-srt',
                    reason: 'subtitle_text_auth_failed',
                });
            } finally {
                restore();
            }
        });

        it('notifies the initiating subtitle context when recovery settles after tracks reload', async () => {
            const { fetchMock, restore } = installFetchAndBlobMocks();

            try {
                const onDeactivate = jest.fn(() => true);
                const recoveryDeferred: {
                    resolve: (result: 'handled' | 'failed') => void;
                } = {
                    resolve: () => {
                        throw new Error('Recovery promise was not initialized');
                    },
                };
                const onDeactivateRecovery = jest.fn().mockImplementation(
                    () => new Promise<'handled' | 'failed'>((resolve) => {
                        recoveryDeferred.resolve = resolve;
                    })
                );
                const originalUnavailable = jest.fn();
                const replacementUnavailable = jest.fn();
                const originalTrack = createMockSubtitleTrack({
                    id: 'embedded-srt',
                    codec: 'srt',
                    format: 'srt',
                    fetchableViaKey: false,
                });
                const replacementTrack = createMockSubtitleTrack({
                    id: 'replacement-srt',
                    codec: 'vtt',
                    format: 'vtt',
                    fetchableViaKey: true,
                    key: '/library/streams/2',
                });
                delete (originalTrack as { key?: string }).key;
                fetchMock.mockResolvedValue({
                    ok: false,
                    status: 404,
                    headers: { get: (): null => null },
                    text: async (): Promise<string> => 'Not found',
                });

                manager.loadTracks([originalTrack], {
                    serverUri: 'http://example.com',
                    authHeaders: { 'X-Plex-Token': 'token' },
                    onDeactivate,
                    onDeactivateRecovery,
                    onUnavailable: originalUnavailable,
                });

                manager.setActiveTrack('embedded-srt');
                await flushSubtitleAsync();

                manager.loadTracks([replacementTrack], {
                    serverUri: 'http://example.com',
                    authHeaders: { 'X-Plex-Token': 'token' },
                    onUnavailable: replacementUnavailable,
                });

                recoveryDeferred.resolve('failed');
                await flushSubtitleAsync();

                expect(originalUnavailable).toHaveBeenCalledTimes(1);
                expect(replacementUnavailable).not.toHaveBeenCalled();
            } finally {
                restore();
            }
        });

        it('skips extraction attempts when the active track is burned into the stream', () => {
            const { fetchMock, restore } = installFetchAndBlobMocks();

            try {
                const track = createMockSubtitleTrack({
                    id: 'burned-text',
                    codec: 'srt',
                    format: 'srt',
                    fetchableViaKey: false,
                });
                delete (track as { key?: string }).key;
                manager.loadTracks([track], {
                    serverUri: 'http://example.com',
                    authHeaders: { 'X-Plex-Token': 'token' },
                    confirmedBurnedInSubtitleTrackId: 'burned-text',
                });

                manager.setActiveTrack('burned-text');

                expect(manager.getActiveTrackId()).toBe('burned-text');
                expect(fetchMock).not.toHaveBeenCalled();
            } finally {
                restore();
            }
        });

        it('suppresses text fallback when server burn-in was requested but not confirmed', async () => {
            const { fetchMock, restore } = installFetchAndBlobMocks();

            try {
                const track = createMockSubtitleTrack({
                    id: 'unconfirmed-text',
                    codec: 'srt',
                    format: 'srt',
                    key: '/library/streams/1',
                    fetchableViaKey: true,
                });
                manager.loadTracks([track], {
                    serverUri: 'http://example.com',
                    authHeaders: { 'X-Plex-Token': 'token' },
                    confirmedBurnedInSubtitleTrackId: null,
                    localExtractionSuppression: {
                        trackId: 'unconfirmed-text',
                        reason: 'server_burn_in_requested',
                        confirmation: 'unconfirmed',
                    },
                });

                manager.setActiveTrack('unconfirmed-text');
                await flushSubtitleAsync();

                expect(manager.getActiveTrackId()).toBe('unconfirmed-text');
                expect(fetchMock).not.toHaveBeenCalled();
            } finally {
                restore();
            }
        });

        it('still attempts text fallback for ordinary unconfirmed text tracks', async () => {
            const { fetchMock, restore } = installFetchAndBlobMocks();

            try {
                const track = createMockSubtitleTrack({
                    id: 'ordinary-text',
                    codec: 'srt',
                    format: 'srt',
                    key: '/library/streams/1',
                    fetchableViaKey: true,
                });
                manager.loadTracks([track], {
                    serverUri: 'http://example.com',
                    authHeaders: { 'X-Plex-Token': 'token' },
                    confirmedBurnedInSubtitleTrackId: null,
                });

                manager.setActiveTrack('ordinary-text');
                await flushSubtitleAsync();

                expect(fetchMock).toHaveBeenCalled();
            } finally {
                restore();
            }
        });
        it('uses the injected subtitle service but does not retry token-bearing fallback over LAN http', async () => {
            const { fetchMock, restore } = installFetchAndBlobMocks();

            const subtitleService: PlatformSubtitleService = {
                deriveLanHttpSubtitleUrl: jest.fn((original) => new URL(`http://10.0.0.1:32400${original.pathname}${original.search}`)),
            };
            const injectedManager = new SubtitleManager(subtitleService);
            injectedManager.initialize(createMockVideoElement());

            try {
                const track = createMockSubtitleTrack({
                    id: 'srt-1',
                    codec: 'srt',
                    format: 'srt',
                    key: '/library/streams/1',
                    fetchableViaKey: true,
                });

                fetchMock
                    .mockResolvedValueOnce({
                        ok: false,
                        status: 500,
                        headers: { get: (): null => null },
                        text: async (): Promise<string> => 'Primary failed',
                    })
                    .mockResolvedValueOnce({
                        ok: true,
                        status: 200,
                        headers: { get: (): null => null },
                        text: async (): Promise<string> => `1
00:00:00,000 --> 00:00:01,000
Hello`,
                    });

                injectedManager.loadTracks([track], {
                    serverUri: 'https://ignored.example',
                    authHeaders: { 'X-Plex-Token': 'token' },
                });

                injectedManager.setActiveTrack('srt-1');
                await flushSubtitleAsync();

                expect(subtitleService.deriveLanHttpSubtitleUrl).toHaveBeenCalledTimes(2);
                expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
                    'https://ignored.example/library/streams/1?X-Plex-Token=token',
                    'https://ignored.example/library/streams/1',
                ]);
                expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual({
                    Accept: 'text/vtt, text/plain, */*',
                    'X-Plex-Token': 'token',
                });
            } finally {
                injectedManager.destroy();
                restore();
            }
        });

    });

    // ========================================
    // unloadTracks
    // ========================================

    describe('unloadTracks', () => {
        it('should clear all tracks', () => {
            const tracks: SubtitleTrack[] = [
                createMockSubtitleTrack({ id: 'en' }),
                createMockSubtitleTrack({ id: 'es' }),
            ];
            manager.loadTracks(tracks, {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
            });

            expect(manager.getTracks()).toHaveLength(2);

            manager.unloadTracks();

            expect(manager.getTracks()).toHaveLength(0);
            expect(manager.getActiveTrackId()).toBeNull();
        });

        it('revokes fallback blob urls via public unload behavior', async () => {
            const { fetchMock, restore } = installFetchAndBlobMocks();
            const revokeSpy = jest.spyOn(URL, 'revokeObjectURL');

            try {
                const track = createMockSubtitleTrack({
                    id: 'embedded-srt',
                    codec: 'srt',
                    format: 'srt',
                    fetchableViaKey: false,
                });
                delete (track as { key?: string }).key;

                fetchMock.mockResolvedValue({
                    ok: true,
                    status: 200,
                    headers: { get: (): null => null },
                    text: async (): Promise<string> => `1
00:00:00,000 --> 00:00:01,000
Hello`,
                });

                manager.loadTracks([track], {
                    serverUri: 'http://example.com',
                    authHeaders: { 'X-Plex-Token': 'token' },
                });
                manager.setActiveTrack('embedded-srt');
                await flushSubtitleAsync();

                manager.unloadTracks();

                expect(revokeSpy).toHaveBeenCalledWith('blob:mock');
                expect(manager.getTracks()).toHaveLength(0);
                expect(manager.getActiveTrackId()).toBeNull();
            } finally {
                revokeSpy.mockRestore();
                restore();
            }
        });
    });

    // ========================================
    // requiresBurnIn
    // ========================================

    describe('requiresBurnIn', () => {
        it('should return true for PGS', () => {
            expect(manager.requiresBurnIn('pgs')).toBe(true);
            expect(manager.requiresBurnIn('PGS')).toBe(true);
        });

        it('should return true for ASS', () => {
            expect(manager.requiresBurnIn('ass')).toBe(true);
            expect(manager.requiresBurnIn('ASS')).toBe(true);
        });

        it('should return true for SSA', () => {
            expect(manager.requiresBurnIn('ssa')).toBe(true);
        });

        it('should return true for VOBSUB', () => {
            expect(manager.requiresBurnIn('vobsub')).toBe(true);
        });

        it('should return false for SRT', () => {
            expect(manager.requiresBurnIn('srt')).toBe(false);
        });

        it('should return false for VTT', () => {
            expect(manager.requiresBurnIn('vtt')).toBe(false);
        });
    });

    // ========================================
    // destroy
    // ========================================

    describe('destroy', () => {
        it('should cleanup on destroy', () => {
            const tracks: SubtitleTrack[] = [
                // Use VTT here to avoid triggering the async SRT fallback fetch during this unit test.
                createMockSubtitleTrack({ id: 'en', codec: 'vtt', format: 'vtt' }),
            ];
            manager.loadTracks(tracks, {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
            });
            manager.setActiveTrack('en');

            manager.destroy();

            expect(manager.getTracks()).toHaveLength(0);
            expect(manager.getActiveTrackId()).toBeNull();
        });
    });

    // ========================================
    // fallback + logging
    // ========================================

    describe('fallback behavior', () => {
        let originalFetch: typeof fetch | undefined;
        let originalCreateObjectUrl: typeof URL.createObjectURL | undefined;
        let originalRevokeObjectUrl: typeof URL.revokeObjectURL | undefined;

        beforeEach(() => {
            jest.useFakeTimers();
            originalFetch = global.fetch;
            originalCreateObjectUrl = global.URL.createObjectURL;
            originalRevokeObjectUrl = global.URL.revokeObjectURL;
            (global as { fetch?: unknown }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                text: async () => '1\n00:00:01,000 --> 00:00:02,000\nHello\n',
            });
            global.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock');
            global.URL.revokeObjectURL = jest.fn();
        });

        afterEach(() => {
            jest.useRealTimers();
            jest.restoreAllMocks();
            clearSubtitleDebugLogging();
            if (originalFetch) {
                global.fetch = originalFetch;
            } else {
                delete (global as { fetch?: unknown }).fetch;
            }
            if (originalCreateObjectUrl) {
                global.URL.createObjectURL = originalCreateObjectUrl;
            } else {
                delete (global.URL as { createObjectURL?: unknown }).createObjectURL;
            }
            if (originalRevokeObjectUrl) {
                global.URL.revokeObjectURL = originalRevokeObjectUrl;
            } else {
                delete (global.URL as { revokeObjectURL?: unknown }).revokeObjectURL;
            }
        });

        it('triggers fallback when textTracks length is unchanged', async () => {
            const tracks: SubtitleTrack[] = [
                createMockSubtitleTrack({ id: 'en' }),
            ];

            manager.loadTracks(tracks, {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
            });

            jest.advanceTimersByTime(2000);
            await Promise.resolve();

            // With the current behavior, we do not eagerly fetch+convert every subtitle track.
            // Fallback work starts when the user selects a track.
            expect(global.fetch).not.toHaveBeenCalled();

            manager.setActiveTrack('en');
            await Promise.resolve();
            expect(global.fetch).toHaveBeenCalled();
        });

        it('redacts tokenized URLs in debug logs', () => {
            enableSubtitleDebugLogging();
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

            const tracks: SubtitleTrack[] = [
                createMockSubtitleTrack({ id: 'en' }),
            ];

            manager.loadTracks(tracks, {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'secret-token' },
            });

            const logs = warnSpy.mock.calls.map((call) => String(call[0]));
            expect(logs.join(' ')).not.toContain('secret-token');
        });

        it('allows a selected track to retry fallback after a transient fallback failure', async () => {
            const fetchMock = global.fetch as jest.Mock;
            fetchMock.mockResolvedValue({
                ok: false,
                status: 500,
                headers: { get: (): null => null },
                text: async () => 'Server error',
            });
            const tracks: SubtitleTrack[] = [
                createMockSubtitleTrack({ id: 'en' }),
            ];
            manager.loadTracks(tracks, {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
            });

            manager.setActiveTrack('en');
            await flushSubtitleMicrotasks();
            expect(global.URL.createObjectURL).not.toHaveBeenCalled();

            fetchMock.mockResolvedValue({
                ok: true,
                status: 200,
                headers: { get: (): null => null },
                text: async () => '1\n00:00:01,000 --> 00:00:02,000\nHello\n',
            });

            manager.setActiveTrack('en');
            await flushSubtitleMicrotasks();

            expect(global.URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
        });

        it('terminates an explicit reselection after two transport failures without another fetch', async () => {
            enableSubtitleDebugLogging();
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            const onDeactivate = jest.fn(() => true);
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                status: 500,
                headers: { get: (): null => null },
                text: async () => 'Server error',
            });
            manager.loadTracks([createMockSubtitleTrack({ id: 'transport' })], {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
                onDeactivate,
            });

            manager.setActiveTrack('transport');
            await flushSubtitleMicrotasks(100);
            expect(onDeactivate).toHaveBeenCalledTimes(1);
            manager.setActiveTrack('transport');
            await flushSubtitleMicrotasks(100);
            expect(onDeactivate).toHaveBeenCalledTimes(2);
            const fetchCountAfterTwoAttempts = (global.fetch as jest.Mock).mock.calls.length;

            manager.setActiveTrack('transport');
            await flushSubtitleMicrotasks();

            expect(global.fetch).toHaveBeenCalledTimes(fetchCountAfterTwoAttempts);
            expect(onDeactivate).toHaveBeenLastCalledWith({
                trackId: 'transport',
                reason: 'subtitle_text_attempt_exhausted',
            });
            expect(warnSpy.mock.calls.filter(
                (call) => call[1] === 'SubtitleManager' && call[2] === 'subtitle_fallback_exhausted'
            )).toHaveLength(1);
        });

        it.each([
            ['cue-less', 'WEBVTT\n\n'],
            ['malformed', 'this is not a subtitle cue'],
        ])('bounds repeated %s fallback attachments to two attempts', async (_label, payload) => {
            enableSubtitleDebugLogging();
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            const onDeactivate = jest.fn(() => true);
            const onDeactivateRecovery = jest.fn().mockResolvedValue('handled');
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                status: 200,
                text: async () => payload,
            });
            manager.loadTracks([createMockSubtitleTrack({ id: 'bounded' })], {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'secret-token' },
                onDeactivate,
                onDeactivateRecovery,
            });

            manager.setActiveTrack('bounded');
            await flushSubtitleMicrotasks();
            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);

            jest.advanceTimersByTime(2000);
            await flushSubtitleMicrotasks();
            expect(global.fetch).toHaveBeenCalledTimes(1);

            jest.advanceTimersByTime(1000);
            await flushSubtitleMicrotasks();
            expect(global.fetch).toHaveBeenCalledTimes(2);
            expect(global.URL.createObjectURL).toHaveBeenCalledTimes(2);
            expect(videoElement.querySelectorAll('track#bounded')).toHaveLength(1);

            jest.advanceTimersByTime(3000);
            await flushSubtitleMicrotasks();

            expect(global.fetch).toHaveBeenCalledTimes(2);
            expect(global.URL.createObjectURL).toHaveBeenCalledTimes(2);
            expect(global.URL.revokeObjectURL).toHaveBeenCalledTimes(2);
            expect(videoElement.querySelectorAll('track#bounded')).toHaveLength(0);
            expect(jest.getTimerCount()).toBe(0);
            expect(onDeactivate).toHaveBeenCalledTimes(1);
            expect(onDeactivate).toHaveBeenCalledWith({
                trackId: 'bounded',
                reason: 'subtitle_text_unusable_cues',
            });
            expect(onDeactivateRecovery).toHaveBeenCalledTimes(1);
            const exhaustionLogs = warnSpy.mock.calls.filter(
                (call) => call[1] === 'SubtitleManager' && call[2] === 'subtitle_fallback_exhausted'
            );
            expect(exhaustionLogs).toHaveLength(1);
            expect(String(exhaustionLogs[0]?.[3])).not.toContain('secret-token');

            const diagnosticCount = warnSpy.mock.calls.length;
            manager.setActiveTrack('bounded');
            manager.setActiveTrack('bounded');
            await flushSubtitleMicrotasks();
            expect(global.fetch).toHaveBeenCalledTimes(2);
            expect(warnSpy).toHaveBeenCalledTimes(diagnosticCount);
        });

        it('keeps the full blob cue window and accepts delayed cues without refetching', async () => {
            const onDeactivate = jest.fn(() => true);
            manager.loadTracks([createMockSubtitleTrack({ id: 'delayed' })], {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
                onDeactivate,
            });
            manager.setActiveTrack('delayed');
            await flushSubtitleMicrotasks();
            const trackElement = getTrackElement(videoElement, 'delayed');
            const cues = { length: 0 };
            Object.defineProperty(trackElement, 'track', {
                configurable: true,
                value: { cues, mode: 'hidden' },
            });

            jest.advanceTimersByTime(2000);
            await flushSubtitleMicrotasks();
            expect(global.fetch).toHaveBeenCalledTimes(1);

            cues.length = 1;
            jest.advanceTimersByTime(1000);
            await flushSubtitleMicrotasks();

            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(onDeactivate).not.toHaveBeenCalled();
            expect(getTrackElement(videoElement, 'delayed')).toBe(trackElement);
            expect(jest.getTimerCount()).toBe(0);
        });

        it('resets the attempt budget for a new load with the same track id', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                status: 200,
                text: async () => 'WEBVTT\n\n',
            });
            const track = createMockSubtitleTrack({ id: 'same-id' });
            const context = {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
                onDeactivate: jest.fn(() => true),
            };
            manager.loadTracks([track], context);
            manager.setActiveTrack('same-id');
            await flushSubtitleMicrotasks();
            jest.advanceTimersByTime(6000);
            await flushSubtitleMicrotasks();
            expect(global.fetch).toHaveBeenCalledTimes(2);

            manager.loadTracks([track], context);
            manager.setActiveTrack('same-id');
            await flushSubtitleMicrotasks();

            expect(global.fetch).toHaveBeenCalledTimes(3);
            manager.unloadTracks();
            expect(jest.getTimerCount()).toBe(0);
        });

        it('aborts an in-flight fallback and leaves no timers or elements on destroy', async () => {
            let capturedSignal: AbortSignal | undefined;
            (global.fetch as jest.Mock).mockImplementation(
                (_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
                    capturedSignal = init?.signal ?? undefined;
                    capturedSignal?.addEventListener('abort', () => {
                        reject(new DOMException('Aborted', 'AbortError'));
                    });
                })
            );
            manager.loadTracks([createMockSubtitleTrack({ id: 'in-flight' })], {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
            });
            manager.setActiveTrack('in-flight');
            await flushSubtitleMicrotasks();

            manager.destroy();
            await flushSubtitleMicrotasks();

            expect(capturedSignal?.aborted).toBe(true);
            expect(videoElement.querySelectorAll('track')).toHaveLength(0);
            expect(jest.getTimerCount()).toBe(0);
        });

        it('keeps newer same-id fallback ownership when an aborted prior load settles late', async () => {
            const signals: AbortSignal[] = [];
            const rejectFetches: Array<(reason: unknown) => void> = [];
            (global.fetch as jest.Mock).mockImplementation(
                (_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
                    const signal = init?.signal;
                    if (signal) signals.push(signal);
                    rejectFetches.push(reject);
                })
            );
            const track = createMockSubtitleTrack({ id: 'same-id-deferred' });
            const context = {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
            };

            manager.loadTracks([track], context);
            manager.setActiveTrack(track.id);
            await flushSubtitleMicrotasks();
            expect(global.fetch).toHaveBeenCalledTimes(1);

            manager.loadTracks([track], context);
            expect(signals[0]?.aborted).toBe(true);
            manager.setActiveTrack(track.id);
            await flushSubtitleMicrotasks();
            expect(global.fetch).toHaveBeenCalledTimes(2);

            rejectFetches[0]?.(new DOMException('Late abort', 'AbortError'));
            await flushSubtitleMicrotasks(30);
            manager.setActiveTrack(track.id);
            manager.setActiveTrack(track.id);
            await flushSubtitleMicrotasks();

            expect(global.fetch).toHaveBeenCalledTimes(2);
            manager.destroy();
            expect(signals[1]?.aborted).toBe(true);
            rejectFetches[1]?.(new DOMException('Destroyed', 'AbortError'));
            await flushSubtitleMicrotasks(30);
            expect(videoElement.querySelectorAll('track')).toHaveLength(0);
            expect(jest.getTimerCount()).toBe(0);
        });
    });
});
