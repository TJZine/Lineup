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
        streamDescriptor: null,
        isCurrent: false,
    });

    const createHosts = (): {
        infoPanelElement: HTMLElement;
        overlayShowcaseElement: HTMLElement;
        classicShowcaseInfoElement: HTMLElement;
    } => {
        const infoPanelElement = document.createElement('div');
        const overlayShowcaseElement = document.createElement('div');
        const classicShowcaseInfoElement = document.createElement('div');

        overlayShowcaseElement.appendChild(infoPanelElement);
        document.body.appendChild(overlayShowcaseElement);
        document.body.appendChild(classicShowcaseInfoElement);

        return { infoPanelElement, overlayShowcaseElement, classicShowcaseInfoElement };
    };

    beforeEach(() => {
        jest.useFakeTimers();
        isVisible = true;
        focusedProgram = null;
        infoPanel = {
            setPresentationMode: jest.fn(),
            getPresentationMode: jest.fn(() => 'overlay'),
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
        jest.clearAllMocks();
        coordinator.destroy();
        jest.clearAllTimers();
        jest.useRealTimers();
        document.body.innerHTML = '';
    });

    it('moves the info panel element between overlay and classic hosts when layout mode changes', () => {
        const { infoPanelElement, overlayShowcaseElement, classicShowcaseInfoElement } = createHosts();

        coordinator.attachHosts({
            infoPanelElement,
            overlayShowcaseElement,
            classicShowcaseInfoElement,
        });

        coordinator.setLayoutMode('classic');
        expect(infoPanel.setPresentationMode).toHaveBeenCalledWith('classic');
        expect(infoPanelElement.parentElement).toBe(classicShowcaseInfoElement);

        coordinator.setLayoutMode('overlay');
        expect(infoPanel.setPresentationMode).toHaveBeenLastCalledWith('overlay');
        expect(infoPanelElement.parentElement).toBe(overlayShowcaseElement);
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

    it('updates fast immediately and defers full updates until debounce completes for the still-focused program', () => {
        const program = createProgram('program-a', 0);
        focusedProgram = program;

        coordinator.syncFocusedProgram(program);

        expect(infoPanel.updateFast).toHaveBeenCalledWith(program);
        expect(infoPanel.updateFull).not.toHaveBeenCalled();

        jest.advanceTimersByTime(199);
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
        const { infoPanelElement, overlayShowcaseElement, classicShowcaseInfoElement } = createHosts();
        const program = createProgram('program-a', 0);
        focusedProgram = program;

        coordinator.attachHosts({
            infoPanelElement,
            overlayShowcaseElement,
            classicShowcaseInfoElement,
        });
        coordinator.setLayoutMode('overlay');
        coordinator.syncFocusedProgram(program);
        coordinator.destroy();

        expect(infoPanel.hide).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(250);

        expect(infoPanel.updateFull).not.toHaveBeenCalled();

        coordinator.setLayoutMode('classic');
        expect(infoPanelElement.parentElement).toBe(overlayShowcaseElement);
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

        jest.advanceTimersByTime(200);

        expect(infoPanel.updateFull).not.toHaveBeenCalled();
    });
});
