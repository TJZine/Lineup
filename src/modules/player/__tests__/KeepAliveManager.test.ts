/**
 * @jest-environment jsdom
 */

import { KeepAliveManager } from '../KeepAliveManager';
import { KEEP_ALIVE_INTERVAL_MS } from '../constants';

describe('KeepAliveManager', () => {
    let manager: KeepAliveManager;

    beforeEach(() => {
        jest.useFakeTimers();
        manager = new KeepAliveManager();
    });

    afterEach(() => {
        manager.stop();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('schedules keep-alive interval on start', () => {
        const setIntervalSpy = jest.spyOn(globalThis, 'setInterval');

        manager.start();

        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), KEEP_ALIVE_INTERVAL_MS);
    });

    it('dispatches lineup:keepalive only while playing', () => {
        const dispatchSpy = jest.spyOn(document, 'dispatchEvent');
        manager.setIsPlayingCheck(() => true);

        manager.start();
        jest.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS);

        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'lineup:keepalive' })
        );
    });

    it('does not dispatch keep-alive when not playing', () => {
        const dispatchSpy = jest.spyOn(document, 'dispatchEvent');
        manager.setIsPlayingCheck(() => false);

        manager.start();
        jest.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS);

        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('clears keep-alive interval on stop and prevents future dispatches', () => {
        const dispatchSpy = jest.spyOn(document, 'dispatchEvent');
        manager.setIsPlayingCheck(() => true);

        manager.start();
        jest.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS);
        expect(dispatchSpy).toHaveBeenCalledTimes(1);

        dispatchSpy.mockClear();
        manager.stop();
        jest.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS * 2);

        expect(dispatchSpy).not.toHaveBeenCalled();
    });
});
