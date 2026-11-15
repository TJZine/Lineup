/**
 * @jest-environment jsdom
 */

import { EPGInfoPanelCoordinator, INFO_PANEL_FULL_UPDATE_DEBOUNCE_MS } from '../view/info-panel/EPGInfoPanelCoordinator';
import type { IEPGInfoPanel } from '../interfaces';
import type { ScheduledProgram } from '../types';

describe('EPGInfoPanelCoordinator', () => {
    let isVisible = true;
    let focusedProgram: ScheduledProgram | null = null;
    let infoPanel: jest.Mocked<IEPGInfoPanel>;
    let coordinator: EPGInfoPanelCoordinator;

    const createProgram = (id: string, startMs: number): ScheduledProgram => ({
        item: {
            ratingKey: id,
            type: 'movie',
            title: `Program ${id}`,
            fullTitle: `Program ${id}`,
            durationMs: 3_600_000,
            thumb: `https://example.com/${id}.jpg`,
            summary: `Summary ${id}`,
            year: 2024,
            scheduledIndex: 0,
        },
        scheduledStartTime: startMs,
        scheduledEndTime: startMs + 3_600_000,
        elapsedMs: 0,
        remainingMs: 3_600_000,
        scheduleIndex: 0,
        loopNumber: 0,
        isCurrent: false,
    });

    beforeEach(() => {
        jest.useFakeTimers();
        isVisible = true;
        focusedProgram = null;
        infoPanel = {
            show: jest.fn(),
            hide: jest.fn(),
            update: jest.fn(),
            updateFast: jest.fn(),
            updateFull: jest.fn(),
            isShowing: jest.fn(() => false),
        };
        coordinator = new EPGInfoPanelCoordinator({
            infoPanel,
            isEpgVisible: (): boolean => isVisible,
            getFocusedProgram: (): ScheduledProgram | null => focusedProgram,
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
        coordinator.destroy();
        jest.clearAllTimers();
        jest.useRealTimers();
        document.body.innerHTML = '';
    });

    it('updates fast immediately and defers full updates until debounce completes for the still-focused program', () => {
        const program = createProgram('program-a', 0);
        focusedProgram = program;

        coordinator.syncFocusedProgram(program);

        expect(infoPanel.updateFast).toHaveBeenCalledWith(program);
        expect(infoPanel.updateFull).not.toHaveBeenCalled();

        jest.advanceTimersByTime(INFO_PANEL_FULL_UPDATE_DEBOUNCE_MS - 1);
        expect(infoPanel.updateFull).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);
        expect(infoPanel.updateFull).toHaveBeenCalledTimes(1);
        expect(infoPanel.updateFull).toHaveBeenCalledWith(program);
    });

    it('does not run deferred full updates after clear is called', () => {
        const program = createProgram('program-a', 0);
        focusedProgram = program;

        coordinator.syncFocusedProgram(program);
        coordinator.clear();

        expect(infoPanel.hide).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(250);

        expect(infoPanel.updateFull).not.toHaveBeenCalled();
    });

    it('does not run a stale deferred full update after focus changes to a different program', () => {
        const firstProgram = createProgram('program-a', 0);
        const secondProgram = createProgram('program-b', 3_600_000);

        focusedProgram = firstProgram;
        coordinator.syncFocusedProgram(firstProgram);

        focusedProgram = secondProgram;
        coordinator.syncFocusedProgram(secondProgram);

        jest.advanceTimersByTime(250);

        expect(infoPanel.updateFull).toHaveBeenCalledTimes(1);
        expect(infoPanel.updateFull).toHaveBeenCalledWith(secondProgram);
        expect(infoPanel.updateFull).not.toHaveBeenCalledWith(firstProgram);
    });

    it('destroy clears pending timers without destroying the underlying info panel', () => {
        const program = createProgram('program-a', 0);
        focusedProgram = program;
        coordinator.syncFocusedProgram(program);
        coordinator.destroy();

        expect(infoPanel.hide).toHaveBeenCalledTimes(1);
        expect(coordinator.isDestroyed()).toBe(true);

        jest.advanceTimersByTime(250);

        expect(infoPanel.updateFull).not.toHaveBeenCalled();

        coordinator.syncFocusedProgram(program);
        expect(infoPanel.updateFast).toHaveBeenCalledTimes(1);
        expect(infoPanel.updateFull).not.toHaveBeenCalled();
        expect(() => infoPanel.updateFull(program)).not.toThrow();
    });

    it('clears when syncing a null program', () => {
        coordinator.syncFocusedProgram(null);

        expect(infoPanel.hide).toHaveBeenCalledTimes(1);
        expect(infoPanel.updateFast).not.toHaveBeenCalled();
    });

    it('skips the deferred full update when the EPG is hidden', () => {
        const program = createProgram('program-a', 0);
        focusedProgram = program;

        coordinator.syncFocusedProgram(program);
        isVisible = false;

        jest.advanceTimersByTime(INFO_PANEL_FULL_UPDATE_DEBOUNCE_MS);

        expect(infoPanel.updateFull).not.toHaveBeenCalled();
    });

    it('does not run fast or deferred updates while hidden', () => {
        const program = createProgram('program-a', 0);
        focusedProgram = program;
        isVisible = false;

        coordinator.syncFocusedProgram(program);
        jest.advanceTimersByTime(INFO_PANEL_FULL_UPDATE_DEBOUNCE_MS + 50);

        expect(infoPanel.updateFast).not.toHaveBeenCalled();
        expect(infoPanel.updateFull).not.toHaveBeenCalled();
    });
});
