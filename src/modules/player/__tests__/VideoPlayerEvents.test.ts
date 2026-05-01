/**
 * @jest-environment jsdom
 */

import { AppErrorCode } from '../../../types/app-errors';
import type { EventEmitter } from '../../../utils/EventEmitter';
import { SYNTHETIC_MEDIA_ERROR_CODE_KEY } from '../constants';
import { RetryManager } from '../RetryManager';
import type { PlaybackError, PlayerEventMap, StreamDescriptor, VideoPlayerInternalState } from '../types';
import { VideoPlayerEvents } from '../VideoPlayerEvents';

const createState = (): VideoPlayerInternalState => ({
    status: 'idle',
    currentTimeMs: 0,
    durationMs: 0,
    bufferPercent: 0,
    volume: 1,
    isMuted: false,
    playbackRate: 1,
    activeSubtitleId: null,
    activeAudioId: null,
    errorInfo: null,
    currentDescriptor: null,
});

const attachedEvents: VideoPlayerEvents[] = [];

const createRetryDescriptor = (): StreamDescriptor => ({
    url: 'https://example/stream.m3u8',
    protocol: 'hls' as const,
    mimeType: 'application/x-mpegURL',
    startPositionMs: 0,
    mediaMetadata: {
        title: 'Example',
        durationMs: 60_000,
    },
    subtitleTracks: [],
    audioTracks: [],
    durationMs: 60_000,
    isLive: false,
});

const createFixture = (): {
    events: VideoPlayerEvents;
    video: HTMLVideoElement;
    emitter: EventEmitter<PlayerEventMap>;
    callbacks: {
        updateStatus: jest.Mock;
        getState: jest.Mock;
        setState: jest.Mock;
    };
    retryManager: RetryManager;
    state: VideoPlayerInternalState;
} => {
    const events = new VideoPlayerEvents();
    attachedEvents.push(events);
    const video = document.createElement('video');
    const emitter = { emit: jest.fn() } as unknown as EventEmitter<PlayerEventMap>;
    const state = createState();
    const callbacks = {
        updateStatus: jest.fn((status: VideoPlayerInternalState['status']) => {
            state.status = status;
        }),
        getState: jest.fn(() => state),
        setState: jest.fn((update: Partial<VideoPlayerInternalState>) => {
            Object.assign(state, update);
        }),
    };
    const retryManager = {
        handleMediaError: jest.fn(),
    } as unknown as RetryManager;

    events.attach(video, emitter, callbacks, retryManager);
    return { events, video, emitter, callbacks, retryManager, state };
};

describe('VideoPlayerEvents', () => {
    afterEach(() => {
        for (const events of attachedEvents) {
            events.detach();
        }
        attachedEvents.length = 0;
        jest.useRealTimers();
        document.body.innerHTML = '';
    });

    it('allows detach before attach without throwing', () => {
        const events = new VideoPlayerEvents();
        expect(() => events.detach()).not.toThrow();
    });

    it('attaches and detaches DOM listeners', () => {
        const video = document.createElement('video');
        const addEventListenerSpy = jest.spyOn(video, 'addEventListener');
        const removeEventListenerSpy = jest.spyOn(video, 'removeEventListener');

        const events = new VideoPlayerEvents();
        const emitter = { emit: jest.fn() } as unknown as EventEmitter<PlayerEventMap>;
        const state = createState();
        const callbacks = {
            updateStatus: jest.fn(),
            getState: jest.fn(() => state),
            setState: jest.fn(),
        };
        const retryManager = { handleMediaError: jest.fn() } as unknown as RetryManager;

        events.attach(video, emitter, callbacks, retryManager);
        expect(addEventListenerSpy).toHaveBeenCalledWith('canplay', expect.any(Function));

        events.detach();
        expect(removeEventListenerSpy).toHaveBeenCalledWith('canplay', expect.any(Function));
    });

    it('waitForCanPlay resolves immediately when readyState is sufficient', async () => {
        const { events, video } = createFixture();
        Object.defineProperty(video, 'readyState', { configurable: true, value: 4 });

        await expect(events.waitForCanPlay()).resolves.toBeUndefined();
    });

    it('waitForCanPlay resolves on canplay', async () => {
        jest.useFakeTimers();

        const { events, video } = createFixture();
        Object.defineProperty(video, 'readyState', { configurable: true, value: 1 });

        const resolvePromise = events.waitForCanPlay(500);
        video.dispatchEvent(new Event('canplay'));
        await expect(resolvePromise).resolves.toBeUndefined();
    });

    it('waitForCanPlay rejects on timeout', async () => {
        jest.useFakeTimers();

        const { events, video } = createFixture();
        Object.defineProperty(video, 'readyState', { configurable: true, value: 1 });

        const timeoutPromise = events.waitForCanPlay(10);
        jest.advanceTimersByTime(11);
        await expect(timeoutPromise).rejects.toThrow('Timeout waiting for media to be ready');
    });

    it('waitForCanPlay rejects when not attached and on media error', async () => {
        const detachedEvents = new VideoPlayerEvents();
        await expect(detachedEvents.waitForCanPlay()).rejects.toThrow('Video element not available');

        const { events, video } = createFixture();
        Object.defineProperty(video, 'readyState', { configurable: true, value: 0 });
        const waitPromise = events.waitForCanPlay(1000);
        video.dispatchEvent(new Event('error'));
        await expect(waitPromise).rejects.toThrow('Error loading media');
    });

    it('updates status to loading on loadstart', () => {
        const { video, callbacks } = createFixture();
        video.dispatchEvent(new Event('loadstart'));
        expect(callbacks.updateStatus).toHaveBeenCalledWith('loading');
    });

    it('updates status to paused on canplay when loading', () => {
        const { video, callbacks, state } = createFixture();
        state.status = 'loading';
        video.dispatchEvent(new Event('canplay'));
        expect(callbacks.updateStatus).toHaveBeenCalledWith('paused');
    });

    it('updates status to paused on pause when playing', () => {
        const { video, callbacks, state } = createFixture();
        state.status = 'playing';
        video.dispatchEvent(new Event('pause'));
        expect(callbacks.updateStatus).toHaveBeenCalledWith('paused');
    });

    it('ignores pause while seeking', () => {
        const { video, callbacks, state } = createFixture();
        state.status = 'seeking';
        video.dispatchEvent(new Event('pause'));
        expect(callbacks.updateStatus).not.toHaveBeenCalled();
    });

    it('restores playing status after seek when video is not paused', () => {
        const { video, callbacks, state } = createFixture();
        state.status = 'playing';
        video.dispatchEvent(new Event('seeking'));
        Object.defineProperty(video, 'paused', { configurable: true, value: false });
        video.dispatchEvent(new Event('seeked'));
        expect(callbacks.updateStatus).toHaveBeenNthCalledWith(1, 'seeking');
        expect(callbacks.updateStatus).toHaveBeenNthCalledWith(2, 'playing');
    });

    it('restores paused status after seek when video is paused', () => {
        const { video, callbacks, state } = createFixture();
        state.status = 'playing';
        video.dispatchEvent(new Event('seeking'));
        Object.defineProperty(video, 'paused', { configurable: true, value: true });
        video.dispatchEvent(new Event('seeked'));
        expect(callbacks.updateStatus).toHaveBeenNthCalledWith(1, 'seeking');
        expect(callbacks.updateStatus).toHaveBeenNthCalledWith(2, 'paused');
    });

    it('restores previous non-playing status after seek when paused', () => {
        const { video, callbacks, state } = createFixture();
        state.status = 'buffering';
        video.dispatchEvent(new Event('seeking'));
        video.dispatchEvent(new Event('seeked'));
        expect(callbacks.updateStatus).toHaveBeenNthCalledWith(1, 'seeking');
        expect(callbacks.updateStatus).toHaveBeenNthCalledWith(2, 'buffering');
    });

    it('updates status to buffering on waiting when playing', () => {
        const { video, callbacks, state } = createFixture();
        state.status = 'playing';
        video.dispatchEvent(new Event('waiting'));
        expect(callbacks.updateStatus).toHaveBeenCalledWith('buffering');
    });

    it('ignores waiting when paused', () => {
        const { video, callbacks, state } = createFixture();
        state.status = 'paused';
        video.dispatchEvent(new Event('waiting'));
        expect(callbacks.updateStatus).not.toHaveBeenCalled();
    });

    it('emits ended only when a descriptor is loaded', () => {
        const { video, emitter, callbacks, state } = createFixture();

        video.dispatchEvent(new Event('ended'));
        expect(emitter.emit).not.toHaveBeenCalledWith('ended', undefined);

        state.currentDescriptor = {
            url: 'https://example/stream.m3u8',
            protocol: 'hls',
            mimeType: 'application/x-mpegURL',
            startPositionMs: 0,
            mediaMetadata: {
                title: 'Example',
                durationMs: 60_000,
            },
            subtitleTracks: [],
            audioTracks: [],
            durationMs: 60_000,
            isLive: false,
        };

        video.dispatchEvent(new Event('ended'));

        expect(callbacks.updateStatus).toHaveBeenCalledWith('ended');
        expect(emitter.emit).toHaveBeenCalledWith('ended', undefined);
    });

    it('handles recoverable and unrecoverable media errors', () => {
        const { video, emitter, callbacks, retryManager } = createFixture();
        const recoverableError: PlaybackError = {
            code: AppErrorCode.NETWORK_TIMEOUT,
            message: 'retrying',
            recoverable: true,
            retryCount: 1,
        };
        const terminalError: PlaybackError = {
            code: AppErrorCode.UNKNOWN,
            message: 'fatal',
            recoverable: false,
            retryCount: 3,
        };

        (retryManager.handleMediaError as jest.Mock).mockReturnValueOnce(recoverableError);
        (video as unknown as Record<string, number>)[SYNTHETIC_MEDIA_ERROR_CODE_KEY] = 2;
        video.dispatchEvent(new Event('error'));
        expect(callbacks.updateStatus).toHaveBeenCalledWith('buffering');
        expect(emitter.emit).not.toHaveBeenCalledWith('error', recoverableError);

        (retryManager.handleMediaError as jest.Mock).mockReturnValueOnce(terminalError);
        Object.defineProperty(video, 'error', { configurable: true, value: { code: 3 } });
        video.dispatchEvent(new Event('error'));
        expect(callbacks.setState).toHaveBeenCalledWith({ errorInfo: terminalError });
        expect(callbacks.updateStatus).toHaveBeenCalledWith('error');
        expect(emitter.emit).toHaveBeenCalledWith('error', terminalError);
    });

    it('ignores media errors when retry manager or media code is unavailable', () => {
        const eventsWithoutRetry = new VideoPlayerEvents();
        attachedEvents.push(eventsWithoutRetry);
        const videoWithoutRetry = document.createElement('video');
        const emitter = { emit: jest.fn() } as unknown as EventEmitter<PlayerEventMap>;
        const state = createState();
        const callbacks = {
            updateStatus: jest.fn((status: VideoPlayerInternalState['status']) => {
                state.status = status;
            }),
            getState: jest.fn(() => state),
            setState: jest.fn((update: Partial<VideoPlayerInternalState>) => {
                Object.assign(state, update);
            }),
        };

        eventsWithoutRetry.attach(videoWithoutRetry, emitter, callbacks, null as unknown as RetryManager);
        Object.defineProperty(videoWithoutRetry, 'error', { configurable: true, value: { code: 4 } });
        videoWithoutRetry.dispatchEvent(new Event('error'));
        expect(callbacks.updateStatus).not.toHaveBeenCalledWith('error');

        const { video, retryManager } = createFixture();
        video.dispatchEvent(new Event('error'));
        expect(retryManager.handleMediaError).not.toHaveBeenCalled();
    });

    it('emits time, buffer, and mediaLoaded updates', () => {
        const { video, emitter, callbacks, state } = createFixture();

        state.currentDescriptor = {
            url: 'https://example/stream.m3u8',
            protocol: 'hls',
            mimeType: 'application/x-mpegURL',
            startPositionMs: 0,
            mediaMetadata: {
                title: 'Example',
                durationMs: 90_000,
            },
            subtitleTracks: [
                {
                    id: 'sub-1',
                    label: 'English',
                    languageCode: 'en',
                    language: 'English',
                    codec: 'srt',
                    format: 'srt',
                    isTextCandidate: true,
                    fetchableViaKey: true,
                },
            ],
            audioTracks: [
                {
                    id: 'aud-1',
                    title: 'English',
                    languageCode: 'en',
                    language: 'English',
                    codec: 'aac',
                    channels: 2,
                    index: 0,
                },
            ],
            durationMs: 90_000,
            isLive: false,
        };

        Object.defineProperty(video, 'currentTime', { configurable: true, value: 12.345 });
        Object.defineProperty(video, 'duration', { configurable: true, value: 120 });
        Object.defineProperty(video, 'buffered', {
            configurable: true,
            value: {
                length: 1,
                start: (i: number) => [0][i],
                end: (i: number) => [50][i],
            },
        });

        video.dispatchEvent(new Event('timeupdate'));
        video.dispatchEvent(new Event('progress'));
        video.dispatchEvent(new Event('loadedmetadata'));

        expect(callbacks.setState).toHaveBeenCalledWith({ currentTimeMs: 12345, durationMs: 120000 });
        expect(emitter.emit).toHaveBeenCalledWith('timeUpdate', {
            currentTimeMs: 12345,
            durationMs: 120000,
        });
        expect(emitter.emit).toHaveBeenCalledWith('bufferUpdate', {
            percent: 42,
            bufferedRanges: [{ startMs: 0, endMs: 50000 }],
        });
        expect(emitter.emit).toHaveBeenCalledWith('mediaLoaded', {
            durationMs: 120000,
            tracks: {
                audio: state.currentDescriptor.audioTracks,
                subtitle: state.currentDescriptor.subtitleTracks,
            },
        });
    });

    it('updates metadata duration without emitting mediaLoaded when descriptor is absent', () => {
        const { video, emitter, callbacks } = createFixture();
        Object.defineProperty(video, 'duration', { configurable: true, value: Number.NaN });

        video.dispatchEvent(new Event('loadedmetadata'));

        expect(callbacks.setState).toHaveBeenCalledWith({ durationMs: 0 });
        expect(emitter.emit).not.toHaveBeenCalledWith('mediaLoaded', expect.anything());
    });
});

describe('RetryManager retry listener teardown', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    const createRetryFixture = (): {
        retryManager: RetryManager;
        video: HTMLVideoElement;
        playSpy: jest.Mock;
        currentTimeSetter: jest.Mock;
        dispatchEventSpy: jest.SpyInstance;
    } => {
        jest.useFakeTimers();
        const video = document.createElement('video');
        const playSpy = jest.fn().mockResolvedValue(undefined);
        const currentTimeSetter = jest.fn();
        let currentTime = 42;

        video.load = jest.fn();
        video.play = playSpy;
        Object.defineProperty(video, 'currentTime', {
            get: () => currentTime,
            set: (value: number) => {
                currentTime = value;
                currentTimeSetter(value);
            },
            configurable: true,
        });

        const dispatchEventSpy = jest.spyOn(video, 'dispatchEvent');
        const retryManager = new RetryManager();
        retryManager.initialize(video, 3, 10);
        retryManager.setDescriptor(createRetryDescriptor());
        retryManager.handleMediaError(2);
        jest.advanceTimersByTime(10);

        return { retryManager, video, playSpy, currentTimeSetter, dispatchEventSpy };
    };

    it('removes active retry metadata listeners on clear', () => {
        const { retryManager, video, playSpy, currentTimeSetter } = createRetryFixture();

        retryManager.clear();
        video.dispatchEvent(new Event('loadedmetadata'));

        expect(currentTimeSetter).not.toHaveBeenCalled();
        expect(playSpy).not.toHaveBeenCalled();
    });

    it('cancels active retry timeout synthetic errors on destroy', () => {
        const { retryManager, dispatchEventSpy } = createRetryFixture();

        retryManager.destroy();
        jest.advanceTimersByTime(10_000);

        expect(dispatchEventSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    });
});
