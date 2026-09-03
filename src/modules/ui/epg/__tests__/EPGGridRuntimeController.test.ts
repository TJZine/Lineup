/**
 * @jest-environment jsdom
 */

import { EPG_CLASSES } from '../constants';
import { EPGGridRuntimeController } from '../runtime/EPGGridRuntimeController';
import type { EPGConfig, EPGInternalState, ScheduleWindow, ScheduledProgram } from '../types';

describe('EPGGridRuntimeController', () => {
    const anchor = new Date('2026-04-30T00:00:00Z').getTime();

    const setupQueuedRaf = (): {
        rafQueue: Array<{ id: number; cb: FrameRequestCallback }>;
        cancelAnimationFrameMock: jest.Mock<void, [handle: number]>;
        restore: () => void;
    } => {
        const originalNodeEnv = process.env.NODE_ENV;
        const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
        const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
        const rafQueue: Array<{ id: number; cb: FrameRequestCallback }> = [];
        let nextId = 1;
        const requestAnimationFrameMock = jest.fn((cb: FrameRequestCallback): number => {
            const id = nextId++;
            rafQueue.push({ id, cb });
            return id;
        });
        const cancelAnimationFrameMock = jest.fn((handle: number): void => {
            const index = rafQueue.findIndex((entry) => entry.id === handle);
            if (index >= 0) {
                rafQueue.splice(index, 1);
            }
        });

        process.env.NODE_ENV = 'production';
        Object.defineProperty(globalThis, 'requestAnimationFrame', {
            configurable: true,
            writable: true,
            value: requestAnimationFrameMock,
        });
        Object.defineProperty(globalThis, 'cancelAnimationFrame', {
            configurable: true,
            writable: true,
            value: cancelAnimationFrameMock,
        });

        return {
            rafQueue,
            cancelAnimationFrameMock,
            restore: (): void => {
                if (originalNodeEnv === undefined) {
                    delete process.env.NODE_ENV;
                } else {
                    process.env.NODE_ENV = originalNodeEnv;
                }
                Object.defineProperty(globalThis, 'requestAnimationFrame', {
                    configurable: true,
                    writable: true,
                    value: originalRequestAnimationFrame,
                });
                Object.defineProperty(globalThis, 'cancelAnimationFrame', {
                    configurable: true,
                    writable: true,
                    value: originalCancelAnimationFrame,
                });
            },
        };
    };

    const createProgram = (): ScheduledProgram => ({
        item: {
            ratingKey: 'program-1',
            type: 'movie',
            title: 'Program 1',
            fullTitle: 'Program 1',
            durationMs: 60 * 60 * 1000,
            thumb: null,
            year: 2026,
            scheduledIndex: 0,
        },
        scheduledStartTime: anchor,
        scheduledEndTime: anchor + 60 * 60 * 1000,
        elapsedMs: 0,
        remainingMs: 60 * 60 * 1000,
        scheduleIndex: 0,
        loopNumber: 0,
        isCurrent: true,
    });

    const createHarness = (): {
        controller: EPGGridRuntimeController;
        config: EPGConfig;
        state: EPGInternalState;
        programArea: HTMLElement;
        virtualizer: {
            updateTemporalClasses: jest.Mock;
            updateScrollPosition: jest.Mock;
            calculateVisibleRange: jest.Mock;
            renderVisibleCells: jest.Mock;
            setFocusedCell: jest.Mock;
            getContentElement: jest.Mock;
            setGridAnchorTime: jest.Mock;
            getElementCount: jest.Mock;
        };
        timeHeader: {
            updateScrollPosition: jest.Mock;
            setGridAnchorTime: jest.Mock;
        };
        updateNowWatchingBanner: jest.Mock;
        syncPeekMode: jest.Mock;
        applyLayoutMode: jest.Mock;
        visibleRanges: unknown[];
    } => {
        const program = createProgram();
        const schedule: ScheduleWindow = {
            startTime: anchor,
            endTime: anchor + 60 * 60 * 1000,
            programs: [program],
        };
        const visibleRanges: unknown[] = [];
        const config: EPGConfig = {
            containerId: 'epg',
            visibleChannels: 2,
            timeSlotMinutes: 30,
            visibleHours: 2,
            totalHours: 24,
            pixelsPerMinute: 4,
            rowHeight: 80,
            autoScrollToNow: false,
            onVisibleRangeChange: (range) => visibleRanges.push(range),
        };
        const state: EPGInternalState = {
            isInitialized: true,
            isVisible: true,
            channels: [{ id: 'ch0', number: 1, name: 'One' }] as EPGInternalState['channels'],
            schedules: new Map([['ch0', schedule]]),
            scheduleLoadTimes: new Map(),
            focusedCell: {
                kind: 'program',
                channelIndex: 0,
                programIndex: 0,
                program,
                focusTimeMs: anchor,
                cellElement: null,
            },
            focusTimeMs: anchor,
            scrollPosition: { channelOffset: 0, timeOffset: 0 },
            currentTime: anchor,
            gridAnchorTime: anchor,
            lastRenderTime: 0,
        };
        const programArea = document.createElement('div');
        const content = document.createElement('div');
        const virtualizer = {
            updateTemporalClasses: jest.fn(),
            updateScrollPosition: jest.fn(),
            calculateVisibleRange: jest.fn(() => ({
                visibleRows: [0],
                visibleTimeRange: { start: anchor, end: anchor + 60 * 60 * 1000 },
            })),
            renderVisibleCells: jest.fn(),
            setFocusedCell: jest.fn(() => document.createElement('button')),
            getContentElement: jest.fn(() => content),
            setGridAnchorTime: jest.fn(),
            getElementCount: jest.fn(() => 1),
        };
        const timeHeader = {
            updateScrollPosition: jest.fn(),
            setGridAnchorTime: jest.fn(),
        };
        const updateNowWatchingBanner = jest.fn();
        const syncPeekMode = jest.fn();
        const applyLayoutMode = jest.fn();

        const controller = new EPGGridRuntimeController({
            getConfig: (): EPGConfig => config,
            getState: (): EPGInternalState => state,
            getProgramAreaElement: (): HTMLElement => programArea,
            getChannelIds: (): string[] => ['ch0'],
            getErrorBoundary: (): never =>
                ({ wrap: (_code: unknown, _context: string, run: () => void): void => run() }) as never,
            getTimeHeader: (): never => timeHeader as never,
            getVirtualizer: (): never => virtualizer as never,
            getFocusKey: (): string => 'ch0-1',
            setHasRenderedOnce: jest.fn(),
            updateNowWatchingBanner,
            syncPeekMode,
            applyLayoutMode,
            appendDebugLog: jest.fn(),
            isDebugEnabled: (): boolean => false,
        });
        controller.configure(config);
        controller.createTimeIndicator();

        return {
            controller,
            config,
            state,
            programArea,
            virtualizer,
            timeHeader,
            updateNowWatchingBanner,
            syncPeekMode,
            applyLayoutMode,
            visibleRanges,
        };
    };

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(anchor);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('creates the current-time indicator under the virtualized content host and refreshes position', () => {
        const { controller, virtualizer } = createHarness();
        const content = virtualizer.getContentElement.mock.results[0]?.value as HTMLElement;

        expect(content.querySelector(`.${EPG_CLASSES.TIME_INDICATOR}`)).not.toBeNull();

        jest.setSystemTime(anchor + 30 * 60 * 1000);
        controller.refreshCurrentTime();

        const indicator = content.querySelector(`.${EPG_CLASSES.TIME_INDICATOR}`) as HTMLElement;
        expect(indicator.style.left).toBe('120px');
        expect(virtualizer.updateTemporalClasses).toHaveBeenCalledWith(anchor + 30 * 60 * 1000);
    });

    it('reuses one current-time indicator across repeated creation and destroy', () => {
        const { controller, virtualizer } = createHarness();
        const content = virtualizer.getContentElement.mock.results[0]?.value as HTMLElement;

        controller.createTimeIndicator();

        expect(content.querySelectorAll(`.${EPG_CLASSES.TIME_INDICATOR}`)).toHaveLength(1);

        controller.destroy();

        expect(content.querySelector(`.${EPG_CLASSES.TIME_INDICATOR}`)).toBeNull();
    });

    it('starts one interval, refreshes runtime collaborators, and stops cleanly', () => {
        const { controller, updateNowWatchingBanner, syncPeekMode, applyLayoutMode } = createHarness();
        const setIntervalSpy = jest.spyOn(global, 'setInterval');
        const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

        controller.startTimeUpdateInterval();
        controller.startTimeUpdateInterval();
        expect(setIntervalSpy).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(60_000);
        expect(updateNowWatchingBanner).toHaveBeenCalled();
        expect(syncPeekMode).toHaveBeenCalled();
        expect(applyLayoutMode).toHaveBeenCalled();

        controller.stopTimeUpdateInterval();
        controller.stopTimeUpdateInterval();
        expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    });

    it('registers and removes the visibilitychange listener', () => {
        const { controller, virtualizer } = createHarness();

        controller.addVisibilityListener();
        document.dispatchEvent(new Event('visibilitychange'));
        expect(virtualizer.updateTemporalClasses).toHaveBeenCalled();

        virtualizer.updateTemporalClasses.mockClear();
        controller.removeVisibilityListener();
        document.dispatchEvent(new Event('visibilitychange'));
        expect(virtualizer.updateTemporalClasses).not.toHaveBeenCalled();
    });

    it('cancels a pending throttled render during destroy', () => {
        const queuedRaf = setupQueuedRaf();
        try {
            const { controller, virtualizer } = createHarness();

            controller.renderGrid();

            expect(queuedRaf.rafQueue).toHaveLength(1);
            const pendingFrame = queuedRaf.rafQueue[0]!;

            controller.destroy();

            expect(queuedRaf.cancelAnimationFrameMock).toHaveBeenCalledWith(1);
            expect(queuedRaf.rafQueue).toHaveLength(0);

            pendingFrame.cb(16);

            expect(virtualizer.renderVisibleCells).not.toHaveBeenCalled();
        } finally {
            queuedRaf.restore();
        }
    });

    it('coordinates render pass ordering and dedupes visible range emissions', () => {
        const { controller, virtualizer, timeHeader, visibleRanges } = createHarness();

        controller.renderGridInternal();
        controller.renderGridInternal();

        expect(timeHeader.updateScrollPosition).toHaveBeenCalledWith(0);
        expect(virtualizer.updateScrollPosition).toHaveBeenCalledWith(0);
        expect(virtualizer.renderVisibleCells).toHaveBeenCalledTimes(2);
        expect(visibleRanges).toHaveLength(1);
        expect(visibleRanges[0]).toEqual({
            channelStart: 0,
            channelEndExclusive: 1,
            timeStartMs: anchor,
            timeEndMs: anchor + (2 * 60 * 60 * 1000),
        });

        controller.resetVisibleRange();
        controller.renderGridInternal();
        expect(visibleRanges).toHaveLength(2);
    });

    it('emits a mid-list half-open range and clamps the terminal endpoint to channel count', () => {
        const { controller, state, visibleRanges } = createHarness();
        state.channels = Array.from({ length: 10 }, (_, index) => ({
            id: `ch${index}`,
            number: index + 1,
            name: `Channel ${index + 1}`,
        })) as EPGInternalState['channels'];
        state.scrollPosition.channelOffset = 4;

        controller.renderGridInternal();
        expect(visibleRanges[0]).toEqual(expect.objectContaining({
            channelStart: 2,
            channelEndExclusive: 8,
        }));

        controller.resetVisibleRange();
        state.scrollPosition.channelOffset = 9;
        controller.renderGridInternal();
        expect(visibleRanges[1]).toEqual(expect.objectContaining({
            channelStart: 7,
            channelEndExclusive: 10,
        }));
    });

    it('updates grid anchor and set-time-to-now through time header and virtualizer collaborators', () => {
        const { controller, state, virtualizer, timeHeader } = createHarness();
        const nextAnchor = anchor + 24 * 60 * 60 * 1000;

        controller.setGridAnchorTime(nextAnchor);
        expect(state.gridAnchorTime).toBe(nextAnchor);
        expect(virtualizer.setGridAnchorTime).toHaveBeenCalledWith(nextAnchor);
        expect(timeHeader.setGridAnchorTime).toHaveBeenCalledWith(nextAnchor);

        jest.setSystemTime(nextAnchor + 4 * 60 * 60 * 1000);
        controller.setTimeOffsetToNow();
        expect(state.scrollPosition.timeOffset).toBe(180);
        expect(timeHeader.updateScrollPosition).toHaveBeenCalledWith(180);
        expect(virtualizer.updateScrollPosition).toHaveBeenCalledWith(180);
    });

    it('clamps set-time-to-now to the configured guide window and refreshes virtualized cells', () => {
        const { config, controller, state, virtualizer, timeHeader } = createHarness();
        const maxOffsetMinutes = (config.totalHours - config.visibleHours) * 60;

        jest.setSystemTime(anchor + (config.totalHours + 2) * 60 * 60 * 1000);
        controller.setTimeOffsetToNow();

        expect(state.scrollPosition.timeOffset).toBe(maxOffsetMinutes);
        expect(state.focusTimeMs).toBe(anchor + (config.totalHours + 2) * 60 * 60 * 1000);
        expect(timeHeader.updateScrollPosition).toHaveBeenCalledWith(maxOffsetMinutes);
        expect(virtualizer.updateScrollPosition).toHaveBeenCalledWith(maxOffsetMinutes);
        expect(virtualizer.renderVisibleCells).toHaveBeenCalled();
    });
});
