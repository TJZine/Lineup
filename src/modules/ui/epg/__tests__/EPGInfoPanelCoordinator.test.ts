/**
 * @jest-environment jsdom
 */

import { EPGInfoPanelCoordinator } from '../EPGInfoPanelCoordinator';
import type { IEPGInfoPanel } from '../interfaces';
import type { ScheduledProgram } from '../types';

describe('EPGInfoPanelCoordinator', () => {
    let isVisible = true;
    let focusedProgram: ScheduledProgram | null = null;
    let infoPanel: jest.Mocked<IEPGInfoPanel>;
    let coordinator: EPGInfoPanelCoordinator;

    const createProgram = (index: number): ScheduledProgram => ({
        item: {
            ratingKey: `program-${index}`,
            type: 'movie',
            title: `Program ${index}`,
            fullTitle: `Program ${index}`,
            durationMs: 3_600_000,
            thumb: `https://example.com/poster-${index}.jpg`,
            summary: `Summary ${index}`,
            year: 2020,
            scheduledIndex: index,
        },
        scheduledStartTime: index * 3_600_000,
        scheduledEndTime: (index + 1) * 3_600_000,
        elapsedMs: 0,
        remainingMs: 3_600_000,
        scheduleIndex: index,
        loopNumber: 0,
        streamDescriptor: null,
        isCurrent: index === 0,
    });

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllTimers();
        isVisible = true;
        focusedProgram = null;
        infoPanel = {
            setPresentationMode: jest.fn(),
            getPresentationMode: jest.fn(() => 'classic'),
            show: jest.fn(),
            hide: jest.fn(),
            update: jest.fn(),
            updateFast: jest.fn(),
            updateFull: jest.fn(),
        };
        coordinator = new EPGInfoPanelCoordinator({
            infoPanel,
            getIsVisible: (): boolean => isVisible,
            getFocusedProgram: (): ScheduledProgram | null => focusedProgram,
        });
    });

    afterEach(() => {
        coordinator.destroy();
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('attaches hosts using the last known layout mode', () => {
        const infoPanelElement = document.createElement('div');
        const overlayHost = document.createElement('div');
        const classicHost = document.createElement('div');

        overlayHost.appendChild(infoPanelElement);

        coordinator.setLayoutMode('overlay');
        coordinator.attachHosts({
            infoPanelElement,
            overlayShowcaseElement: overlayHost,
            classicShowcaseInfoElement: classicHost,
        });

        expect(infoPanel.setPresentationMode).toHaveBeenCalledWith('overlay');
        expect(infoPanelElement.parentElement).toBe(overlayHost);

        coordinator.setLayoutMode('classic');
        expect(infoPanelElement.parentElement).toBe(classicHost);
    });

    it('does not throw when attachHosts receives null elements', () => {
        expect(() =>
            coordinator.attachHosts({
                infoPanelElement: null,
                overlayShowcaseElement: null,
                classicShowcaseInfoElement: null,
            })
        ).not.toThrow();

        coordinator.setLayoutMode('overlay');

        expect(infoPanel.setPresentationMode).toHaveBeenCalledWith('overlay');
    });

    it('updates fast immediately and updates full after the debounce when focus is stable', () => {
        const program = createProgram(1);
        focusedProgram = program;

        coordinator.syncFocusedProgram(program);

        expect(infoPanel.updateFast).toHaveBeenCalledWith(program);
        expect(infoPanel.updateFull).not.toHaveBeenCalled();

        jest.advanceTimersByTime(199);
        expect(infoPanel.updateFull).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);
        expect(infoPanel.updateFull).toHaveBeenCalledWith(program);
    });

    it('skips the deferred full update when focus changes before the timer fires', () => {
        const firstProgram = createProgram(1);
        const secondProgram = createProgram(2);

        focusedProgram = firstProgram;
        coordinator.syncFocusedProgram(firstProgram);

        focusedProgram = secondProgram;
        coordinator.syncFocusedProgram(secondProgram);

        jest.advanceTimersByTime(200);

        expect(infoPanel.updateFull).toHaveBeenCalledTimes(1);
        expect(infoPanel.updateFull).toHaveBeenCalledWith(secondProgram);
    });

    it('clears pending work and hides the panel when cleared', () => {
        const program = createProgram(3);
        focusedProgram = program;

        coordinator.syncFocusedProgram(program);
        coordinator.clear();
        focusedProgram = null;

        jest.advanceTimersByTime(200);

        expect(infoPanel.hide).toHaveBeenCalledTimes(1);
        expect(infoPanel.updateFull).not.toHaveBeenCalled();
    });

    it('clears when syncing a null program', () => {
        coordinator.syncFocusedProgram(null);

        expect(infoPanel.hide).toHaveBeenCalledTimes(1);
        expect(infoPanel.updateFast).not.toHaveBeenCalled();
    });

    it('skips the deferred full update when the EPG is hidden', () => {
        const program = createProgram(4);
        focusedProgram = program;

        coordinator.syncFocusedProgram(program);
        isVisible = false;

        jest.advanceTimersByTime(200);

        expect(infoPanel.updateFull).not.toHaveBeenCalled();
    });
});
