/**
 * @jest-environment jsdom
 */

import { ChannelBuilderGuideTransitionDiagnostics } from '../ChannelBuilderGuideTransitionDiagnostics';

describe('ChannelBuilderGuideTransitionDiagnostics', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
        document.body.innerHTML = '';
    });

    it('bounds privacy-safe relative events and removes media listeners on close', () => {
        let now = 1000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
        const videoContainer = document.createElement('div');
        videoContainer.id = 'video-container';
        const video = document.createElement('video');
        video.id = 'lineup-video-player';
        Object.defineProperties(video, {
            readyState: { configurable: true, value: HTMLMediaElement.HAVE_CURRENT_DATA },
            videoWidth: { configurable: true, value: 1920 },
            videoHeight: { configurable: true, value: 1080 },
            currentTime: { configurable: true, writable: true, value: 4 },
        });
        videoContainer.appendChild(video);
        document.body.appendChild(videoContainer);
        const removeListener = jest.spyOn(video, 'removeEventListener');
        const entries: Array<{ event: string; data: unknown }> = [];
        const diagnostics = new ChannelBuilderGuideTransitionDiagnostics((event, data) => {
            entries.push({ event, data });
        });

        diagnostics.begin();
        now = 1005;
        video.dispatchEvent(new Event('playing'));
        video.currentTime = 5;
        video.dispatchEvent(new Event('timeupdate'));
        for (let index = 0; index < 30; index += 1) {
            diagnostics.record('bounded-event', { index });
        }
        diagnostics.close('failure');

        expect(entries.length).toBeLessThanOrEqual(20);
        expect(entries.map(({ data }) => (data as { elapsedMs: number }).elapsedMs)).toEqual(
            expect.arrayContaining([0, 5])
        );
        expect(JSON.stringify(entries)).not.toMatch(
            /channelId|channelNumber|ratingKey|server|library|title|url|token|header|error/i
        );
        expect(removeListener).toHaveBeenCalledWith('loadeddata', expect.any(Function));
        expect(removeListener).toHaveBeenCalledWith('canplay', expect.any(Function));
        expect(removeListener).toHaveBeenCalledWith('playing', expect.any(Function));
        expect(removeListener).toHaveBeenCalledWith('timeupdate', expect.any(Function));
    });

    it('closes the active attempt before replacing it', () => {
        const events: string[] = [];
        const diagnostics = new ChannelBuilderGuideTransitionDiagnostics((event) => events.push(event));

        diagnostics.begin();
        diagnostics.begin();

        expect(events).toContain('attempt-settled');
        const requests = events.filter((event) => event === 'done-switch-request');
        expect(requests).toHaveLength(2);
        diagnostics.close('canceled');
    });

    it('stays active after Guide show until both playing and advancing time arrive', () => {
        const videoContainer = document.createElement('div');
        videoContainer.id = 'video-container';
        const video = document.createElement('video');
        video.id = 'lineup-video-player';
        Object.defineProperty(video, 'currentTime', { configurable: true, writable: true, value: 1 });
        videoContainer.appendChild(video);
        document.body.appendChild(videoContainer);
        const removeListener = jest.spyOn(video, 'removeEventListener');
        const events: string[] = [];
        const diagnostics = new ChannelBuilderGuideTransitionDiagnostics((event) => events.push(event));

        diagnostics.begin();
        diagnostics.recordGuideShown();
        video.dispatchEvent(new Event('playing'));
        expect(removeListener).not.toHaveBeenCalled();

        video.currentTime = 2;
        video.dispatchEvent(new Event('timeupdate'));

        expect(events).toEqual(expect.arrayContaining(['guide-show', 'first-playing', 'first-advancing-time']));
        expect(removeListener).toHaveBeenCalledWith('playing', expect.any(Function));
        expect(events.at(-1)).toBe('attempt-settled');
    });

    it('rebases after a new stream resets a high current time to zero', () => {
        const videoContainer = document.createElement('div');
        videoContainer.id = 'video-container';
        const video = document.createElement('video');
        video.id = 'lineup-video-player';
        Object.defineProperty(video, 'currentTime', { configurable: true, writable: true, value: 500 });
        videoContainer.appendChild(video);
        document.body.appendChild(videoContainer);
        const events: string[] = [];
        const diagnostics = new ChannelBuilderGuideTransitionDiagnostics((event) => events.push(event));

        diagnostics.begin();
        diagnostics.recordGuideShown();
        video.dispatchEvent(new Event('playing'));
        video.currentTime = 0;
        video.dispatchEvent(new Event('timeupdate'));
        expect(events).not.toContain('first-advancing-time');

        video.currentTime = 1;
        video.dispatchEvent(new Event('timeupdate'));
        expect(events).toContain('first-advancing-time');
        expect(events.at(-1)).toBe('attempt-settled');
    });

    it('detaches diagnostic listeners at the cleanup-only deadline', () => {
        jest.useFakeTimers();
        const video = document.createElement('video');
        video.id = 'lineup-video-player';
        document.body.appendChild(video);
        const removeListener = jest.spyOn(video, 'removeEventListener');
        const events: string[] = [];
        const diagnostics = new ChannelBuilderGuideTransitionDiagnostics((event) => events.push(event));

        diagnostics.begin();
        jest.advanceTimersByTime(30_000);

        expect(events).toContain('diagnostic-cleanup-deadline');
        expect(events.at(-1)).toBe('attempt-settled');
        expect(removeListener).toHaveBeenCalledWith('timeupdate', expect.any(Function));
    });
});
