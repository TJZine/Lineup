/**
 * @jest-environment jsdom
 */
/**
 * @fileoverview EPG Virtualizer unit tests
 * @module modules/ui/epg/__tests__/EPGVirtualizer.test
 */

import { EPGVirtualizer, positionCell } from '../view/EPGVirtualizer';
import { EPG_CONSTANTS, EPG_CLASSES } from '../constants';
import type { ScheduledProgram, ScheduleWindow, EPGConfig } from '../types';

describe('EPGVirtualizer', () => {
    let virtualizer: EPGVirtualizer;
    let container: HTMLElement;
    let config: EPGConfig;
    const gridAnchorTime = new Date('2026-01-07T00:00:00').getTime();

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);

        config = {
            containerId: 'test-container',
            visibleChannels: 5,
            timeSlotMinutes: 30,
            visibleHours: 3,
            totalHours: 24,
            pixelsPerMinute: 4,
            autoFitPixelsPerMinute: false,
            rowHeight: 80,
            showCurrentTimeIndicator: true,
            autoScrollToNow: false,
        };

        virtualizer = new EPGVirtualizer();
        virtualizer.initialize(container, config, gridAnchorTime);
    });

    afterEach(() => {
        virtualizer.destroy();
        container.remove();
        jest.restoreAllMocks();
    });

    describe('positionCell', () => {
        it('computes left/width deterministically from program times', () => {
            const program: ScheduledProgram = {
                item: {
                    ratingKey: '1',
                    type: 'movie',
                    title: 'Test Movie',
                    fullTitle: 'Test Movie',
                    durationMs: 1800000, // 30 minutes
                    thumb: null,
                    year: 2020,
                    scheduledIndex: 0,
                },
                scheduledStartTime: gridAnchorTime + 60000, // 1 minute from anchor
                scheduledEndTime: gridAnchorTime + 120000, // 2 minutes from anchor
                elapsedMs: 0,
                remainingMs: 60000,
                scheduleIndex: 0,
                loopNumber: 0,
                streamDescriptor: null,
                isCurrent: false,
            };

            const cell = positionCell(program, gridAnchorTime);

            expect(cell.left).toBeGreaterThanOrEqual(0);
            expect(cell.width).toBeGreaterThan(0);
            expect(cell.program.item.ratingKey).toBe('1');
        });

        it('calculates correct left position based on start time', () => {
            const program: ScheduledProgram = {
                item: {
                    ratingKey: '2',
                    type: 'movie',
                    title: 'Test',
                    fullTitle: 'Test',
                    durationMs: 3600000,
                    thumb: null,
                    year: 2020,
                    scheduledIndex: 0,
                },
                scheduledStartTime: gridAnchorTime + (60 * 60000), // 60 minutes from anchor
                scheduledEndTime: gridAnchorTime + (120 * 60000), // 120 minutes from anchor
                elapsedMs: 0,
                remainingMs: 3600000,
                scheduleIndex: 0,
                loopNumber: 0,
                streamDescriptor: null,
                isCurrent: false,
            };

            const cell = positionCell(program, gridAnchorTime, 4); // 4 pixels per minute

            // 60 minutes * 4 pixels = 240px left
            expect(cell.left).toBe(240);
            // 60 minutes duration * 4 pixels = 240px width
            expect(cell.width).toBe(240);
        });

        it('enforces minimum width of 20px', () => {
            const program: ScheduledProgram = {
                item: {
                    ratingKey: '3',
                    type: 'clip',
                    title: 'Short Clip',
                    fullTitle: 'Short Clip',
                    durationMs: 10000, // 10 seconds
                    thumb: null,
                    year: 2020,
                    scheduledIndex: 0,
                },
                scheduledStartTime: gridAnchorTime,
                scheduledEndTime: gridAnchorTime + 10000, // 10 seconds later
                elapsedMs: 0,
                remainingMs: 10000,
                scheduleIndex: 0,
                loopNumber: 0,
                streamDescriptor: null,
                isCurrent: false,
            };

            const cell = positionCell(program, gridAnchorTime);

            // Even though duration would give tiny width, minimum is 20px
            expect(cell.width).toBeGreaterThanOrEqual(20);
        });
    });

    describe('calculateVisibleRange', () => {
        it('returns correct visible rows with buffer', () => {
            virtualizer.setChannelCount(50);

            const range = virtualizer.calculateVisibleRange({
                channelOffset: 10,
                timeOffset: 0,
            });

            // Should include buffer rows (ROW_BUFFER = 2)
            expect(range.visibleRows).toContain(8); // 10 - 2
            expect(range.visibleRows).toContain(9);
            expect(range.visibleRows).toContain(10);
            expect(range.visibleRows).toContain(11);
            expect(range.visibleRows).toContain(12);
            // Should include up to visibleChannels + buffer
            expect(range.visibleRows.length).toBe(
                config.visibleChannels + EPG_CONSTANTS.ROW_BUFFER * 2
            );
        });

        it('clamps to valid range at boundaries', () => {
            virtualizer.setChannelCount(50);

            // At top boundary
            const rangeTop = virtualizer.calculateVisibleRange({
                channelOffset: 0,
                timeOffset: 0,
            });
            expect(rangeTop.visibleRows[0]).toBe(0);
            expect(rangeTop.visibleRows).not.toContain(-1);

            // At bottom boundary
            const rangeBottom = virtualizer.calculateVisibleRange({
                channelOffset: 48,
                timeOffset: 0,
            });
            expect(rangeBottom.visibleRows).not.toContain(50);
        });

        it('calculates time buffer correctly', () => {
            virtualizer.setChannelCount(10);

            const range = virtualizer.calculateVisibleRange({
                channelOffset: 0,
                timeOffset: 120, // Start at 2 hours
            });

            // Should include TIME_BUFFER_MINUTES (60) before and after
            expect(range.visibleTimeRange.start).toBe(120 - EPG_CONSTANTS.TIME_BUFFER_MINUTES);
            expect(range.visibleTimeRange.end).toBe(
                120 + (config.visibleHours * 60) + EPG_CONSTANTS.TIME_BUFFER_MINUTES
            );
        });
    });

    describe('DOM element virtualization', () => {
        const getRenderedCell = (key: string): HTMLElement => {
            const cell = container.querySelector(`[data-key="${key}"]`);
            if (!(cell instanceof HTMLElement)) {
                throw new Error(`Expected rendered cell for ${key}`);
            }
            return cell;
        };

        const readCellPresentation = (cell: HTMLElement): {
            title: string;
            time: string;
            className: string;
            left: string;
            width: string;
            top: string;
            textShiftPx: string;
        } => ({
            title: (cell.querySelector(`.${EPG_CLASSES.CELL_TITLE_TEXT}`) as HTMLElement | null)?.textContent ?? '',
            time: (cell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement | null)?.textContent ?? '',
            className: cell.className,
            left: cell.style.left,
            width: cell.style.width,
            top: cell.style.top,
            textShiftPx: cell.style.getPropertyValue('--epg-cell-text-shift-px'),
        });

        it('skips DOM rewrites when rendering the same visible data twice', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-stable';
            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    {
                        item: {
                            ratingKey: 'stable-1',
                            type: 'movie',
                            title: 'Stable Program',
                            fullTitle: 'Stable Program',
                            durationMs: 60 * 60000,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: gridAnchorTime,
                        scheduledEndTime: gridAnchorTime + (60 * 60000),
                        elapsedMs: 0,
                        remainingMs: 0,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };
            const schedules = new Map<string, ScheduleWindow>([[channelId, schedule]]);
            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            const stableKey = `${channelId}-${gridAnchorTime}`;

            virtualizer.renderVisibleCells([channelId], schedules, range, undefined, gridAnchorTime + 5000);
            const firstCell = getRenderedCell(stableKey);
            const firstPresentation = readCellPresentation(firstCell);
            expect(container.querySelectorAll(`[data-key="${stableKey}"]`)).toHaveLength(1);

            virtualizer.renderVisibleCells([channelId], schedules, range, undefined, gridAnchorTime + 5000);
            const secondCell = getRenderedCell(stableKey);

            expect(secondCell).toBe(firstCell);
            expect(container.querySelectorAll(`[data-key="${stableKey}"]`)).toHaveLength(1);
            expect(readCellPresentation(secondCell)).toEqual(firstPresentation);
        });

        it('updates reused cell top positions when channelOffset changes', () => {
            virtualizer.setChannelCount(3);
            const channelIds = ['ch0', 'ch1', 'ch2'];
            const makeSchedule = (ratingKey: string): ScheduleWindow => ({
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    {
                        item: {
                            ratingKey,
                            type: 'movie',
                            title: 'Stable Program',
                            fullTitle: 'Stable Program',
                            durationMs: 60 * 60000,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: gridAnchorTime,
                        scheduledEndTime: gridAnchorTime + (60 * 60000),
                        elapsedMs: 0,
                        remainingMs: 0,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            });
            const schedules = new Map<string, ScheduleWindow>([
                ['ch0', makeSchedule('stable-0')],
                ['ch1', makeSchedule('stable-1')],
                ['ch2', makeSchedule('stable-2')],
            ]);

            const range0 = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells(channelIds, schedules, range0, undefined, gridAnchorTime + 5000);
            const ch1Key = `ch1-${gridAnchorTime}`;
            const cell0 = getRenderedCell(ch1Key);
            const initialPresentation = readCellPresentation(cell0);
            const { top: initialTop, ...initialStableOutput } = initialPresentation;

            const range1 = virtualizer.calculateVisibleRange({ channelOffset: 1, timeOffset: 0 });
            virtualizer.renderVisibleCells(channelIds, schedules, range1, undefined, gridAnchorTime + 5000);
            const cell1 = getRenderedCell(ch1Key);
            const rerenderedPresentation = readCellPresentation(cell1);
            const { top: rerenderedTop, ...rerenderedStableOutput } = rerenderedPresentation;

            expect(cell1).toBe(cell0);
            expect(container.querySelectorAll(`[data-key="${ch1Key}"]`)).toHaveLength(1);
            expect(initialTop).toBe(`${config.rowHeight}px`);
            expect(rerenderedTop).toBe('0px');
            expect(rerenderedTop).not.toBe(initialTop);
            expect(rerenderedStableOutput).toEqual(initialStableOutput);
        });

        it('renders a row at top 0 when channelOffset matches rowIndex', () => {
            const channelIds = Array.from({ length: 15 }, (_, i) => `ch${i}`);
            const schedules = new Map<string, ScheduleWindow>();
            const targetIndex = 10;
            const channelId = channelIds[targetIndex];
            expect(channelId).toBeDefined();
            if (!channelId) {
                throw new Error('Missing channelId for virtualization test.');
            }
            const program: ScheduledProgram = {
                item: {
                    ratingKey: `${channelId}-0`,
                    type: 'movie',
                    title: 'Top Test',
                    fullTitle: 'Top Test',
                    durationMs: 1800000,
                    thumb: null,
                    year: 2020,
                    scheduledIndex: 0,
                },
                scheduledStartTime: gridAnchorTime,
                scheduledEndTime: gridAnchorTime + 1800000,
                elapsedMs: 0,
                remainingMs: 1800000,
                scheduleIndex: 0,
                loopNumber: 0,
                streamDescriptor: null,
                isCurrent: false,
            };
            schedules.set(channelId, {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [program],
            });
            const expectedKey = `${channelId}-${program.scheduledStartTime}`;

            virtualizer.setChannelCount(channelIds.length);
            const range = virtualizer.calculateVisibleRange({
                channelOffset: targetIndex,
                timeOffset: 0,
            });
            virtualizer.renderVisibleCells(channelIds, schedules, range);

            const cell = container.querySelector(`[data-key="${expectedKey}"]`) as HTMLElement;
            expect(cell).not.toBeNull();
            expect(cell.style.top).toBe('0px');
        });

        it('shifts program text into view when the program starts before the visible window', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch0';

            const program: ScheduledProgram = {
                item: {
                    ratingKey: 'p1',
                    type: 'movie',
                    title: 'Program 1',
                    fullTitle: 'Program 1',
                    durationMs: 60 * 60 * 1000, // 60 minutes (01:30 → 02:30)
                    thumb: null,
                    year: 2020,
                    scheduledIndex: 0,
                },
                scheduledStartTime: gridAnchorTime + (90 * 60000), // 01:30
                scheduledEndTime: gridAnchorTime + (150 * 60000),  // 02:30
                elapsedMs: 0,
                remainingMs: 0,
                scheduleIndex: 0,
                loopNumber: 0,
                streamDescriptor: null,
                isCurrent: false,
            };

            const schedules = new Map<string, ScheduleWindow>([
                [channelId, {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + (24 * 60 * 60000),
                    programs: [program],
                }],
            ]);

            const timeOffset = 120; // visible window starts at 02:00
            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset });
            virtualizer.renderVisibleCells([channelId], schedules, range);

            const expectedKey = `${channelId}-${program.scheduledStartTime}`;
            const cell = container.querySelector(`[data-key="${expectedKey}"]`) as HTMLElement;
            expect(cell).not.toBeNull();

            // Hidden-left = (120 - 90) minutes * 4 px/min = 120px
            expect(cell.style.getPropertyValue('--epg-cell-text-shift-px')).toBe('120px');
        });

        it('keeps title gutter stable after forward/back scrubbing and clears stale shift class', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-scrub';
            const program: ScheduledProgram = {
                item: {
                    ratingKey: 'scrub-1',
                    type: 'movie',
                    title: 'Scrub Program',
                    fullTitle: 'Scrub Program',
                    durationMs: 180 * 60 * 1000, // 3h
                    thumb: null,
                    year: 2026,
                    scheduledIndex: 0,
                },
                scheduledStartTime: gridAnchorTime + (30 * 60000), // 00:30
                scheduledEndTime: gridAnchorTime + (210 * 60000), // 03:30
                elapsedMs: 0,
                remainingMs: 0,
                scheduleIndex: 0,
                loopNumber: 0,
                streamDescriptor: null,
                isCurrent: false,
            };

            const schedules = new Map<string, ScheduleWindow>([
                [channelId, {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + (24 * 60 * 60000),
                    programs: [program],
                }],
            ]);

            const key = `${channelId}-${program.scheduledStartTime}`;

            const forwardOffsetMinutes = 120; // 02:00
            const forwardRange = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: forwardOffsetMinutes });
            virtualizer.renderVisibleCells([channelId], schedules, forwardRange);

            const forwardCell = container.querySelector(`[data-key="${key}"]`) as HTMLElement;
            expect(forwardCell).not.toBeNull();
            expect(forwardCell.classList.contains(EPG_CLASSES.CELL_TEXT_SHIFTED)).toBe(true);
            const forwardShift = Number(forwardCell.style.getPropertyValue('--epg-cell-text-shift-px').replace('px', ''));
            const forwardLeft = Number(forwardCell.style.left.replace('px', ''));
            const forwardTitleLeft = forwardLeft + 12 + forwardShift - (forwardOffsetMinutes * config.pixelsPerMinute);
            expect(forwardTitleLeft).toBeGreaterThanOrEqual(12);

            const backRange = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], schedules, backRange);

            const backCell = container.querySelector(`[data-key="${key}"]`) as HTMLElement;
            expect(backCell).not.toBeNull();
            expect(backCell.classList.contains(EPG_CLASSES.CELL_TEXT_SHIFTED)).toBe(false);
            expect(backCell.style.getPropertyValue('--epg-cell-text-shift-px')).toBe('');
            const backTitleLeft = Number(backCell.style.left.replace('px', '')) + 12;
            expect(backTitleLeft).toBeGreaterThanOrEqual(12);
        });

        it('keeps left/right text gutters when a long program is mostly clipped by scroll', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-clamp';
            const program: ScheduledProgram = {
                item: {
                    ratingKey: 'clamp-1',
                    type: 'movie',
                    title: 'Clamp Program',
                    fullTitle: 'Clamp Program',
                    durationMs: 240 * 60 * 1000, // 4h
                    thumb: null,
                    year: 2026,
                    scheduledIndex: 0,
                },
                scheduledStartTime: gridAnchorTime,
                scheduledEndTime: gridAnchorTime + (240 * 60000),
                elapsedMs: 0,
                remainingMs: 0,
                scheduleIndex: 0,
                loopNumber: 0,
                streamDescriptor: null,
                isCurrent: false,
            };
            const schedules = new Map<string, ScheduleWindow>([
                [channelId, {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + (24 * 60 * 60000),
                    programs: [program],
                }],
            ]);

            // Leaves only 40px of the cell visible.
            const timeOffset = 230;
            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset });
            virtualizer.renderVisibleCells([channelId], schedules, range);

            const key = `${channelId}-${program.scheduledStartTime}`;
            const cell = container.querySelector(`[data-key="${key}"]`) as HTMLElement;
            expect(cell).not.toBeNull();
            const shiftPx = Number(cell.style.getPropertyValue('--epg-cell-text-shift-px').replace('px', ''));
            const leftPx = Number(cell.style.left.replace('px', ''));
            const visibleLeft = leftPx - (timeOffset * config.pixelsPerMinute);
            const visibleRight = visibleLeft + Number(cell.style.width.replace('px', ''));
            const titleLeft = visibleLeft + 12 + shiftPx;
            expect(titleLeft).toBeGreaterThanOrEqual(12);
            expect(visibleRight - titleLeft).toBeGreaterThanOrEqual(12);
        });

        it('marks heavily clipped visible programs as slivers without changing their geometry', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-sliver-clipped';
            const program: ScheduledProgram = {
                item: {
                    ratingKey: 'sliver-clipped-1',
                    type: 'movie',
                    title: 'Sliver Clipped Program',
                    fullTitle: 'Sliver Clipped Program',
                    durationMs: 240 * 60 * 1000,
                    thumb: null,
                    year: 2026,
                    scheduledIndex: 0,
                },
                scheduledStartTime: gridAnchorTime,
                scheduledEndTime: gridAnchorTime + (240 * 60000),
                elapsedMs: 0,
                remainingMs: 0,
                scheduleIndex: 0,
                loopNumber: 0,
                streamDescriptor: null,
                isCurrent: false,
            };
            const schedules = new Map<string, ScheduleWindow>([
                [channelId, {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + (24 * 60 * 60000),
                    programs: [program],
                }],
            ]);

            const timeOffset = 226;
            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset });
            virtualizer.renderVisibleCells([channelId], schedules, range);

            const key = `${channelId}-${program.scheduledStartTime}`;
            const cell = container.querySelector(`[data-key="${key}"]`) as HTMLElement;
            expect(cell).not.toBeNull();
            expect(cell.classList.contains(EPG_CLASSES.SLIVER_CELL_CLASS)).toBe(true);
            expect(cell.style.width).toBe('960px');
        });

        it('does not shift text when the cell is already clipped to the left edge', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-left-clipped';

            const program: ScheduledProgram = {
                item: {
                    ratingKey: 'left-clipped-1',
                    type: 'movie',
                    title: 'Left Clipped Program',
                    fullTitle: 'Left Clipped Program',
                    durationMs: 60 * 60 * 1000, // 60 minutes (-00:30 → 00:30)
                    thumb: null,
                    year: 2020,
                    scheduledIndex: 0,
                },
                scheduledStartTime: gridAnchorTime - (30 * 60000), // -00:30
                scheduledEndTime: gridAnchorTime + (30 * 60000),   // 00:30
                elapsedMs: 0,
                remainingMs: 0,
                scheduleIndex: 0,
                loopNumber: 0,
                streamDescriptor: null,
                isCurrent: false,
            };

            const schedules = new Map<string, ScheduleWindow>([
                [channelId, {
                    startTime: gridAnchorTime - (2 * 60 * 60000),
                    endTime: gridAnchorTime + (24 * 60 * 60000),
                    programs: [program],
                }],
            ]);

            // Visible window starts at anchor (00:00), so this program is both
            // partial and left-clipped by layout clipping.
            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], schedules, range);

            const expectedKey = `${channelId}-${program.scheduledStartTime}`;
            const cell = container.querySelector(`[data-key="${expectedKey}"]`) as HTMLElement;
            expect(cell).not.toBeNull();
            expect(cell.classList.contains(EPG_CLASSES.CELL_TEXT_SHIFTED)).toBe(false);
            expect(cell.style.getPropertyValue('--epg-cell-text-shift-px')).toBe('');
        });

        it('marks genuinely short visible program cells as slivers', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-sliver-short';
            const start = gridAnchorTime;
            const end = start + (10 * 60000);

            const schedules = new Map<string, ScheduleWindow>([
                [channelId, {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + (24 * 60 * 60000),
                    programs: [
                        {
                            item: {
                                ratingKey: 'sliver-short-1',
                                type: 'movie',
                                title: 'Short Sliver',
                                fullTitle: 'Short Sliver',
                                durationMs: end - start,
                                thumb: null,
                                year: 2026,
                                scheduledIndex: 0,
                            },
                            scheduledStartTime: start,
                            scheduledEndTime: end,
                            elapsedMs: 0,
                            remainingMs: end - start,
                            scheduleIndex: 0,
                            loopNumber: 0,
                            streamDescriptor: null,
                            isCurrent: false,
                        },
                    ],
                }],
            ]);

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], schedules, range);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            expect(cell).not.toBeNull();
            expect(cell.style.width).toBe('40px');
            expect(cell.classList.contains(EPG_CLASSES.SLIVER_CELL_CLASS)).toBe(true);
        });

        it('keeps focused episodes out of sliver suppression so compact subtitle and ticker behavior remain active', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-focused-episode-sliver';
            const start = gridAnchorTime;
            const end = start + (10 * 60000); // 40px rendered width

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    {
                        item: {
                            ratingKey: 'focused-episode-sliver-1',
                            type: 'episode',
                            title: 'Episode With A Very Long Focused Subtitle',
                            fullTitle: 'Prestige Show - S01E07 - Episode With A Very Long Focused Subtitle',
                            showTitle: 'Prestige Show',
                            seasonNumber: 1,
                            episodeNumber: 7,
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: 0,
                        remainingMs: end - start,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);
            virtualizer.setFocusedCell(channelId, start);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            const title = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE}`) as HTMLElement;
            const subtitle = cell.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE}`) as HTMLElement;
            const time = cell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement;

            Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 180 });
            Object.defineProperty(title, 'clientWidth', { configurable: true, value: 40 });
            Object.defineProperty(subtitle, 'scrollWidth', { configurable: true, value: 200 });
            Object.defineProperty(subtitle, 'clientWidth', { configurable: true, value: 40 });

            virtualizer.setFocusedCell(channelId, start);

            expect(cell.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT)).toBe(true);
            expect(cell.classList.contains(EPG_CLASSES.SLIVER_CELL_CLASS)).toBe(false);
            expect(subtitle.style.display).toBe('block');
            expect(subtitle.textContent).toBe('S01E07 - Episode With A Very Long Focused Subtitle');
            expect(time.style.display).toBe('none');
            expect(title.classList.contains(EPG_CLASSES.CELL_TITLE_TICKER_READY)).toBe(true);
        });

        it('does not duplicate focused episode text in the subtitle lane when no show title or episode tag exists', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-focused-episode-no-show-title';
            const start = gridAnchorTime;
            const end = start + (20 * 60000);

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    {
                        item: {
                            ratingKey: 'focused-episode-no-show-title-1',
                            type: 'episode',
                            title: 'Standalone Episode Title',
                            fullTitle: 'Standalone Episode Title',
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: 0,
                        remainingMs: end - start,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);
            virtualizer.setFocusedCell(channelId, start);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            const titleText = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE_TEXT}`) as HTMLElement;
            const subtitle = cell.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE}`) as HTMLElement;
            const subtitleText = cell.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE_TEXT}`) as HTMLElement;

            expect(cell.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT)).toBe(true);
            expect(titleText.textContent).toBe('Standalone Episode Title');
            expect(subtitle.style.display).toBe('none');
            expect(subtitleText.textContent).toBe('');
        });

        it('shifts text for pre-anchor long programs after scrolling right', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-pre-anchor';

            const program: ScheduledProgram = {
                item: {
                    ratingKey: 'pre-anchor-1',
                    type: 'movie',
                    title: 'Pre Anchor Program',
                    fullTitle: 'Pre Anchor Program',
                    durationMs: 360 * 60000, // 6h
                    thumb: null,
                    year: 2026,
                    scheduledIndex: 0,
                },
                scheduledStartTime: gridAnchorTime - (120 * 60000), // -02:00
                scheduledEndTime: gridAnchorTime + (240 * 60000),   // +04:00
                elapsedMs: 0,
                remainingMs: 0,
                scheduleIndex: 0,
                loopNumber: 0,
                streamDescriptor: null,
                isCurrent: false,
            };

            const schedules = new Map<string, ScheduleWindow>([
                [channelId, {
                    startTime: gridAnchorTime - (4 * 60 * 60000),
                    endTime: gridAnchorTime + (24 * 60 * 60000),
                    programs: [program],
                }],
            ]);

            const timeOffset = 90;
            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset });
            virtualizer.renderVisibleCells([channelId], schedules, range);

            const key = `${channelId}-${program.scheduledStartTime}`;
            const cell = container.querySelector(`[data-key="${key}"]`) as HTMLElement;
            expect(cell).not.toBeNull();
            expect(cell.classList.contains(EPG_CLASSES.CELL_TEXT_SHIFTED)).toBe(true);

            const shiftPx = Number(cell.style.getPropertyValue('--epg-cell-text-shift-px').replace('px', ''));
            expect(shiftPx).toBeGreaterThan(0);

            const leftPx = Number(cell.style.left.replace('px', ''));
            const titleLeft = leftPx + 12 + shiftPx - (timeOffset * config.pixelsPerMinute);
            expect(titleLeft).toBeGreaterThanOrEqual(12);
        });

        it('renders show name in the title line for episode programs', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-episode';
            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + 3600000,
                programs: [
                    {
                        item: {
                            ratingKey: 'ep1',
                            type: 'episode',
                            title: 'Episode One',
                            fullTitle: 'Great Show - S01E01 - Episode One',
                            durationMs: 3600000,
                            thumb: null,
                            year: 2020,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: gridAnchorTime,
                        scheduledEndTime: gridAnchorTime + 3600000,
                        elapsedMs: 0,
                        remainingMs: 3600000,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const titleLine = container.querySelector('.epg-cell-title') as HTMLElement | null;
            expect(titleLine).not.toBeNull();
            expect(titleLine?.textContent).toBe('Great Show');

            const showLine = container.querySelector('.epg-cell-show') as HTMLElement | null;
            expect(showLine).toBeNull();
        });

        it('keeps movie title in the title line and does not render a show line', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-movie';
            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + 3600000,
                programs: [
                    {
                        item: {
                            ratingKey: 'movie1',
                            type: 'movie',
                            title: 'Feature Film',
                            fullTitle: 'Feature Film',
                            durationMs: 1800000,
                            thumb: null,
                            year: 2021,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: gridAnchorTime,
                        scheduledEndTime: gridAnchorTime + 1800000,
                        elapsedMs: 0,
                        remainingMs: 1800000,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const titleLine = container.querySelector('.epg-cell-title') as HTMLElement | null;
            expect(titleLine).not.toBeNull();
            expect(titleLine?.textContent).toBe('Feature Film');

            const showLine = container.querySelector('.epg-cell-show') as HTMLElement | null;
            expect(showLine).toBeNull();
        });

        it('renders episode tag + subtitle line for episode programs', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-episode-tag';
            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + 3600000,
                programs: [
                    {
                        item: {
                            ratingKey: 'ep-tag-1',
                            type: 'episode',
                            title: 'The Heist',
                            fullTitle: 'Great Show - S01E05 - The Heist',
                            showTitle: 'Great Show',
                            seasonNumber: 1,
                            episodeNumber: 5,
                            durationMs: 3600000,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: gridAnchorTime,
                        scheduledEndTime: gridAnchorTime + 3600000,
                        elapsedMs: 0,
                        remainingMs: 0,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const cell = container.querySelector(`[data-key="${channelId}-${gridAnchorTime}"]`) as HTMLElement;
            expect(cell).not.toBeNull();

            const episodeTag = cell.querySelector('.epg-cell-episode') as HTMLElement | null;
            expect(episodeTag).not.toBeNull();
            expect(episodeTag?.textContent).toBe('S01E05');

            const title = cell.querySelector('.epg-cell-title') as HTMLElement | null;
            expect(title).not.toBeNull();
            expect(title?.textContent).toBe('Great Show');

            const subtitle = cell.querySelector('.epg-cell-subtitle') as HTMLElement | null;
            expect(subtitle).not.toBeNull();
            expect(subtitle?.textContent).toBe('The Heist');
        });

        it('hides subtitle when show title is unavailable and subtitle would duplicate title', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-episode-no-showtitle';
            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + 3600000,
                programs: [
                    {
                        item: {
                            ratingKey: 'ep-no-showtitle-1',
                            type: 'episode',
                            title: 'Episode One',
                            fullTitle: 'Episode One',
                            durationMs: 60 * 60000, // 240px => wide tier
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: gridAnchorTime,
                        scheduledEndTime: gridAnchorTime + (60 * 60000),
                        elapsedMs: 0,
                        remainingMs: 0,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const cell = container.querySelector(`[data-key="${channelId}-${gridAnchorTime}"]`) as HTMLElement;
            expect(cell).not.toBeNull();

            const title = cell.querySelector('.epg-cell-title') as HTMLElement | null;
            expect(title).not.toBeNull();
            expect(title?.textContent).toBe('Episode One');

            const subtitle = cell.querySelector('.epg-cell-subtitle') as HTMLElement | null;
            expect(subtitle).not.toBeNull();
            expect((subtitle?.textContent ?? '').trim()).toBe('');
            expect(subtitle?.style.display).toBe('none');
        });

        it('derives episode show title from fullTitle when showTitle is missing', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-episode-fulltitle-fallback';
            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + 3600000,
                programs: [
                    {
                        item: {
                            ratingKey: 'ep-fulltitle-fallback-1',
                            type: 'episode',
                            title: 'Scavengers',
                            fullTitle: 'Scavengers Reign - Scavengers',
                            durationMs: 60 * 60000, // 240px => wide tier
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: gridAnchorTime,
                        scheduledEndTime: gridAnchorTime + (60 * 60000),
                        elapsedMs: 0,
                        remainingMs: 0,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const cell = container.querySelector(`[data-key="${channelId}-${gridAnchorTime}"]`) as HTMLElement;
            expect(cell).not.toBeNull();

            const title = cell.querySelector('.epg-cell-title') as HTMLElement | null;
            expect(title).not.toBeNull();
            expect(title?.textContent).toBe('Scavengers Reign');

            const subtitle = cell.querySelector('.epg-cell-subtitle') as HTMLElement | null;
            expect(subtitle).not.toBeNull();
            expect(subtitle?.textContent).toBe('Scavengers');
            expect(subtitle?.style.display).toBe('block');
        });

        it('keeps time hidden for tiny-width cells', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-tiny';
            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    {
                        item: {
                            ratingKey: 'tiny-1',
                            type: 'movie',
                            title: 'Tiny Program',
                            fullTitle: 'Tiny Program',
                            durationMs: 20 * 60000, // 20 minutes => 80px at 4px/min
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: gridAnchorTime,
                        scheduledEndTime: gridAnchorTime + (20 * 60000),
                        elapsedMs: 0,
                        remainingMs: 0,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const cell = container.querySelector(`[data-key="${channelId}-${gridAnchorTime}"]`) as HTMLElement;
            const timeLine = cell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement;

            expect(cell.classList.contains('epg-cell-tier-tiny')).toBe(true);
            expect(timeLine.style.display).toBe('none');
            expect(timeLine.classList.contains(EPG_CLASSES.CELL_TIME_COMPACT)).toBe(true);
        });

        it('applies deterministic width-tier classes and line visibility at boundaries', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-tier-boundaries';
            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    {
                        item: {
                            ratingKey: 'wide-ep',
                            type: 'episode',
                            title: 'Wide Episode',
                            fullTitle: 'Boundary Show - S01E01 - Wide Episode',
                            durationMs: 55 * 60000, // 220px
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: gridAnchorTime,
                        scheduledEndTime: gridAnchorTime + (55 * 60000),
                        elapsedMs: 0,
                        remainingMs: 0,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                    {
                        item: {
                            ratingKey: 'medium-ep',
                            type: 'episode',
                            title: 'Medium Episode',
                            fullTitle: 'Boundary Show - S01E02 - Medium Episode',
                            durationMs: 35 * 60000, // 140px
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 1,
                        },
                        scheduledStartTime: gridAnchorTime + (55 * 60000),
                        scheduledEndTime: gridAnchorTime + (90 * 60000),
                        elapsedMs: 0,
                        remainingMs: 0,
                        scheduleIndex: 1,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                    {
                        item: {
                            ratingKey: 'narrow-ep',
                            type: 'episode',
                            title: 'Narrow Episode',
                            fullTitle: 'Boundary Show - S01E03 - Narrow Episode',
                            durationMs: 22 * 60000, // 88px
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 2,
                        },
                        scheduledStartTime: gridAnchorTime + (90 * 60000),
                        scheduledEndTime: gridAnchorTime + (112 * 60000),
                        elapsedMs: 0,
                        remainingMs: 0,
                        scheduleIndex: 2,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                    {
                        item: {
                            ratingKey: 'tiny-ep',
                            type: 'episode',
                            title: 'Tiny Episode',
                            fullTitle: 'Boundary Show - S01E04 - Tiny Episode',
                            durationMs: 20 * 60000, // 80px
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 3,
                        },
                        scheduledStartTime: gridAnchorTime + (112 * 60000),
                        scheduledEndTime: gridAnchorTime + (132 * 60000),
                        elapsedMs: 0,
                        remainingMs: 0,
                        scheduleIndex: 3,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const wideCell = container.querySelector(`[data-key="${channelId}-${gridAnchorTime}"]`) as HTMLElement;
            expect(wideCell.classList.contains(EPG_CLASSES.CELL_TIER_WIDE)).toBe(true);
            expect((wideCell.querySelector(`.${EPG_CLASSES.CELL_META}`) as HTMLElement).style.display).toBe('flex');
            expect((wideCell.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE}`) as HTMLElement).style.display).toBe('block');
            expect((wideCell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement).style.display).toBe('block');

            const mediumStart = gridAnchorTime + (55 * 60000);
            const mediumCell = container.querySelector(`[data-key="${channelId}-${mediumStart}"]`) as HTMLElement;
            expect(mediumCell.classList.contains(EPG_CLASSES.CELL_TIER_MEDIUM)).toBe(true);
            expect((mediumCell.querySelector(`.${EPG_CLASSES.CELL_META}`) as HTMLElement).style.display).toBe('none');
            expect((mediumCell.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE}`) as HTMLElement).style.display).toBe('block');
            expect((mediumCell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement).style.display).toBe('block');

            const narrowStart = gridAnchorTime + (90 * 60000);
            const narrowCell = container.querySelector(`[data-key="${channelId}-${narrowStart}"]`) as HTMLElement;
            expect(narrowCell.classList.contains(EPG_CLASSES.CELL_TIER_NARROW)).toBe(true);
            expect((narrowCell.querySelector(`.${EPG_CLASSES.CELL_META}`) as HTMLElement).style.display).toBe('none');
            expect((narrowCell.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE}`) as HTMLElement).style.display).toBe('none');
            expect((narrowCell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement).style.display).toBe('none');
            expect((narrowCell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement).classList.contains(EPG_CLASSES.CELL_TIME_COMPACT)).toBe(true);

            const tinyStart = gridAnchorTime + (112 * 60000);
            const tinyCell = container.querySelector(`[data-key="${channelId}-${tinyStart}"]`) as HTMLElement;
            expect(tinyCell.classList.contains(EPG_CLASSES.CELL_TIER_TINY)).toBe(true);
            expect((tinyCell.querySelector(`.${EPG_CLASSES.CELL_META}`) as HTMLElement).style.display).toBe('none');
            expect((tinyCell.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE}`) as HTMLElement).style.display).toBe('none');
            expect((tinyCell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement).style.display).toBe('none');
            expect((tinyCell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement).classList.contains(EPG_CLASSES.CELL_TIME_COMPACT)).toBe(true);
        });

        it('renders loading placeholders when schedules are missing', () => {
            const channelIds = ['ch0'];
            const schedules = new Map<string, ScheduleWindow>();

            virtualizer.setChannelCount(1);
            const range = virtualizer.calculateVisibleRange({
                channelOffset: 0,
                timeOffset: 0,
            });
            virtualizer.renderVisibleCells(channelIds, schedules, range);

            const title = container.querySelector('.epg-cell-title');
            expect(title?.textContent).toBe('Loading...');
        });

        it('can focus a placeholder cell by time when schedules are missing', () => {
            const channelIds = ['ch0'];
            const schedules = new Map<string, ScheduleWindow>();

            virtualizer.setChannelCount(1);
            const range = virtualizer.calculateVisibleRange({
                channelOffset: 0,
                timeOffset: 0,
            });
            virtualizer.renderVisibleCells(channelIds, schedules, range);

            const focusTimeMs = gridAnchorTime + (30 * 60000);
            const focused = virtualizer.setFocusedCell('ch0', focusTimeMs, focusTimeMs);
            expect(focused).not.toBeNull();
            expect(focused?.classList.contains('focused')).toBe(true);
        });

        it('retains focused placeholder styling after rerendering the same placeholder window', () => {
            const channelIds = ['ch0'];
            const schedules = new Map<string, ScheduleWindow>();

            virtualizer.setChannelCount(1);
            const range = virtualizer.calculateVisibleRange({
                channelOffset: 0,
                timeOffset: 0,
            });

            virtualizer.renderVisibleCells(channelIds, schedules, range);

            const focusTimeMs = gridAnchorTime + (30 * 60000);
            const focusedElement = virtualizer.setFocusedCell('ch0', focusTimeMs, focusTimeMs);
            expect(focusedElement).not.toBeNull();
            expect(focusedElement?.classList.contains(EPG_CLASSES.CELL_FOCUSED)).toBe(true);

            const focusedKey = `ch0-placeholder-${gridAnchorTime}`;
            virtualizer.renderVisibleCells(channelIds, schedules, range, focusedKey);

            const rerenderedCell = container.querySelector(`[data-key="${focusedKey}"]`) as HTMLElement | null;
            expect(rerenderedCell).not.toBeNull();
            expect(rerenderedCell?.classList.contains(EPG_CLASSES.CELL_FOCUSED)).toBe(true);
        });

        it('retains focused placeholder styling when horizontal scroll rebuilds the placeholder key', () => {
            const channelIds = ['ch0'];
            const schedules = new Map<string, ScheduleWindow>();

            virtualizer.setChannelCount(1);

            const initialRange = virtualizer.calculateVisibleRange({
                channelOffset: 0,
                timeOffset: 0,
            });
            virtualizer.renderVisibleCells(channelIds, schedules, initialRange);

            const focusTimeMs = gridAnchorTime + (30 * 60000);
            const focusedElement = virtualizer.setFocusedCell('ch0', focusTimeMs, focusTimeMs);
            expect(focusedElement).not.toBeNull();
            expect(focusedElement?.classList.contains(EPG_CLASSES.CELL_FOCUSED)).toBe(true);

            const shiftedRange = virtualizer.calculateVisibleRange({
                channelOffset: 0,
                timeOffset: 30,
            });
            const originalFocusedKey = `ch0-placeholder-${gridAnchorTime}`;
            virtualizer.renderVisibleCells(channelIds, schedules, shiftedRange, originalFocusedKey);

            const rerenderedFocusedCell = container.querySelector(
                `[data-key="ch0-placeholder-${gridAnchorTime + (30 * 60000)}"]`
            ) as HTMLElement | null;

            expect(rerenderedFocusedCell).not.toBeNull();
            expect(rerenderedFocusedCell?.classList.contains(EPG_CLASSES.CELL_FOCUSED)).toBe(true);
        });

        it('does not keep placeholder focus when a rebuilt placeholder no longer contains the focused time', () => {
            const channelIds = ['ch0'];
            const schedules = new Map<string, ScheduleWindow>();

            virtualizer.setChannelCount(1);

            const initialRange = virtualizer.calculateVisibleRange({
                channelOffset: 0,
                timeOffset: 0,
            });
            virtualizer.renderVisibleCells(channelIds, schedules, initialRange);

            const focusTimeMs = gridAnchorTime;
            const focusedElement = virtualizer.setFocusedCell('ch0', focusTimeMs, focusTimeMs);
            expect(focusedElement).not.toBeNull();
            expect(focusedElement?.classList.contains(EPG_CLASSES.CELL_FOCUSED)).toBe(true);

            const shiftedRange = virtualizer.calculateVisibleRange({
                channelOffset: 0,
                timeOffset: 90,
            });
            const originalFocusedKey = `ch0-placeholder-${gridAnchorTime}`;
            virtualizer.renderVisibleCells(channelIds, schedules, shiftedRange, originalFocusedKey);

            const shiftedPlaceholder = container.querySelector(
                `[data-key="ch0-placeholder-${gridAnchorTime + (90 * 60000)}"]`
            ) as HTMLElement | null;

            expect(shiftedPlaceholder).not.toBeNull();
            expect(shiftedPlaceholder?.classList.contains(EPG_CLASSES.CELL_FOCUSED)).toBe(false);
            expect(container.querySelector(`.${EPG_CLASSES.CELL_FOCUSED}`)).toBeNull();
        });

        it('applies horizontal scroll transform to the content wrapper', () => {
            const channelIds = ['ch0'];
            const schedules = new Map<string, ScheduleWindow>();
            schedules.set('ch0', {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (3 * 60 * 60000),
                programs: [],
            });

            virtualizer.setChannelCount(1);
            const range = virtualizer.calculateVisibleRange({
                channelOffset: 0,
                timeOffset: 30,
            });
            virtualizer.updateScrollPosition(30);
            virtualizer.renderVisibleCells(channelIds, schedules, range);

            const content = container.firstElementChild as HTMLElement;
            expect(content).not.toBeNull();
            expect(content.style.transform).toBe('translateX(-120px)');
        });

        it('renders gap placeholders when schedule has holes in visible window', () => {
            const channelIds = ['ch0'];
            const programs: ScheduledProgram[] = [
                {
                    item: {
                        ratingKey: 'ch0-1',
                        type: 'movie',
                        title: 'Program 1',
                        fullTitle: 'Program 1',
                        durationMs: 1800000,
                        thumb: null,
                        year: 2020,
                        scheduledIndex: 0,
                    },
                    scheduledStartTime: gridAnchorTime + (60 * 60000),
                    scheduledEndTime: gridAnchorTime + (90 * 60000),
                    elapsedMs: 0,
                    remainingMs: 1800000,
                    scheduleIndex: 0,
                    loopNumber: 0,
                    streamDescriptor: null,
                    isCurrent: false,
                },
            ];
            const schedules = new Map<string, ScheduleWindow>([
                ['ch0', {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + (24 * 60 * 60000),
                    programs,
                }],
            ]);

            virtualizer.setChannelCount(1);
            const range = virtualizer.calculateVisibleRange({
                channelOffset: 0,
                timeOffset: 0,
            });
            virtualizer.renderVisibleCells(channelIds, schedules, range);

            const titles = Array.from(container.querySelectorAll('.epg-cell-title'))
                .map((el) => el.textContent);
            expect(titles).toContain('No Program');
        });

        it('prioritizes visible-window cells over buffer-only cells when a row has many short programs', () => {
            const channelId = 'dense-row';
            const channelIds = [channelId];
            const programs: ScheduledProgram[] = [];

            for (let minute = 0; minute < 300; minute += 1) {
                programs.push({
                    item: {
                        ratingKey: `${channelId}-${minute}`,
                        type: 'movie',
                        title: `Program ${minute}`,
                        fullTitle: `Program ${minute}`,
                        durationMs: 60_000,
                        thumb: null,
                        year: 2026,
                        scheduledIndex: minute,
                    },
                    scheduledStartTime: gridAnchorTime + (minute * 60_000),
                    scheduledEndTime: gridAnchorTime + ((minute + 1) * 60_000),
                    elapsedMs: 0,
                    remainingMs: 60_000,
                    scheduleIndex: minute,
                    loopNumber: 0,
                    streamDescriptor: null,
                    isCurrent: false,
                });
            }

            const schedules = new Map<string, ScheduleWindow>([
                [channelId, {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + (24 * 60 * 60_000),
                    programs,
                }],
            ]);

            virtualizer.setChannelCount(1);
            const range = virtualizer.calculateVisibleRange({
                channelOffset: 0,
                timeOffset: 60,
            });

            virtualizer.renderVisibleCells(channelIds, schedules, range);

            const titles = Array.from(container.querySelectorAll('.epg-cell-title'))
                .map((el) => el.textContent);

            expect(titles).toContain('Program 60');
            expect(titles).toContain('Program 180');
            expect(titles).toContain('Program 239');
            expect(titles).toContain('Program 0');
            expect(titles).toContain('Program 19');
            expect(titles).not.toContain('Program 20');
        });

        it('drops buffer-only cells before visible cells when the global DOM budget is exceeded across rows', () => {
            const rowCount = 8;
            const channelIds = Array.from({ length: rowCount }, (_, index) => `row-${index}`);
            const schedules = new Map<string, ScheduleWindow>();

            for (const channelId of channelIds) {
                const programs: ScheduledProgram[] = [];
                for (let minute = 0; minute < 360; minute += 1) {
                    programs.push({
                        item: {
                            ratingKey: `${channelId}-${minute}`,
                            type: 'movie',
                            title: `Program ${minute}`,
                            fullTitle: `Program ${minute}`,
                            durationMs: 60_000,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: minute,
                        },
                        scheduledStartTime: gridAnchorTime + (minute * 60_000),
                        scheduledEndTime: gridAnchorTime + ((minute + 1) * 60_000),
                        elapsedMs: 0,
                        remainingMs: 60_000,
                        scheduleIndex: minute,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    });
                }

                schedules.set(channelId, {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + (24 * 60 * 60_000),
                    programs,
                });
            }

            virtualizer.setChannelCount(channelIds.length);
            const range = virtualizer.calculateVisibleRange({
                channelOffset: 0,
                timeOffset: 120,
            });

            virtualizer.renderVisibleCells(channelIds, schedules, range);

            expect(container.querySelector(`[data-key="row-0-${gridAnchorTime}"]`)).toBeNull();
            expect(container.querySelector(`[data-key="row-0-${gridAnchorTime + (119 * 60_000)}"]`)).toBeNull();
            expect(container.querySelector(`[data-key="row-0-${gridAnchorTime + (120 * 60_000)}"]`)).not.toBeNull();
            expect(container.querySelector(`[data-key="row-0-${gridAnchorTime + (180 * 60_000)}"]`)).not.toBeNull();
            expect(container.querySelector(`[data-key="row-6-${gridAnchorTime + (120 * 60_000)}"]`)).not.toBeNull();
            expect(container.querySelector(`[data-key="row-6-${gridAnchorTime + (180 * 60_000)}"]`)).not.toBeNull();
            expect(container.querySelector(`[data-key="row-6-${gridAnchorTime}"]`)).toBeNull();
        });

        it('caps sampled visible queue cells to the per-row limit when seed indices add extra entries', () => {
            const rowCount = 40;
            const channelIds = Array.from({ length: rowCount }, (_, index) => `row-${index}`);
            const schedules = new Map<string, ScheduleWindow>();
            config = {
                ...config,
                visibleChannels: 38,
            };
            virtualizer.initialize(container, config, gridAnchorTime);

            for (const channelId of channelIds) {
                const programs: ScheduledProgram[] = [];
                for (let minute = 0; minute < 10; minute += 1) {
                    programs.push({
                        item: {
                            ratingKey: `${channelId}-${minute}`,
                            type: 'movie',
                            title: `Program ${minute}`,
                            fullTitle: `Program ${minute}`,
                            durationMs: 60_000,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: minute,
                        },
                        scheduledStartTime: gridAnchorTime + (minute * 60_000),
                        scheduledEndTime: gridAnchorTime + ((minute + 1) * 60_000),
                        elapsedMs: 0,
                        remainingMs: 60_000,
                        scheduleIndex: minute,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    });
                }

                schedules.set(channelId, {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + (24 * 60 * 60_000),
                    programs,
                });
            }

            virtualizer.setChannelCount(channelIds.length);

            const range = virtualizer.calculateVisibleRange({
                channelOffset: 0,
                timeOffset: 0,
            });

            virtualizer.renderVisibleCells(channelIds, schedules, range);

            const rowZeroCells = Array.from(
                container.querySelectorAll('[data-key^="row-0-"]')
            ) as HTMLElement[];

            expect(rowZeroCells).toHaveLength(5);
        });

        it('keeps both queue edges when capped visible sampling overflows the row limit', () => {
            const rowCount = 40;
            const channelIds = Array.from({ length: rowCount }, (_, index) => `row-${index}`);
            const schedules = new Map<string, ScheduleWindow>();

            config = {
                ...config,
                visibleChannels: 38,
                visibleHours: 10 / 60,
            };
            virtualizer.initialize(container, config, gridAnchorTime);

            for (const channelId of channelIds) {
                const programs: ScheduledProgram[] = [];
                for (let minute = 0; minute < 10; minute += 1) {
                    programs.push({
                        item: {
                            ratingKey: `${channelId}-${minute}`,
                            type: 'movie',
                            title: `Program ${minute}`,
                            fullTitle: `Program ${minute}`,
                            durationMs: 60_000,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: minute,
                        },
                        scheduledStartTime: gridAnchorTime + (minute * 60_000),
                        scheduledEndTime: gridAnchorTime + ((minute + 1) * 60_000),
                        elapsedMs: 0,
                        remainingMs: 60_000,
                        scheduleIndex: minute,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    });
                }

                schedules.set(channelId, {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + (24 * 60 * 60_000),
                    programs,
                });
            }

            virtualizer.setChannelCount(channelIds.length);

            const range = virtualizer.calculateVisibleRange({
                channelOffset: 0,
                timeOffset: 0,
            });

            virtualizer.renderVisibleCells(channelIds, schedules, range);

            const rowZeroKeys = Array.from(
                container.querySelectorAll('[data-key^="row-0-"]')
            ).map((node) => (node as HTMLElement).dataset.key);

            expect(rowZeroKeys).toHaveLength(5);
            expect(rowZeroKeys).toContain(`row-0-${gridAnchorTime}`);
            expect(rowZeroKeys).toContain(`row-0-${gridAnchorTime + (9 * 60_000)}`);
        });

        it('should maintain DOM element count under 200 during virtualized render', () => {
            // Load 50 channels with many programs
            const channelIds = Array.from({ length: 50 }, (_, i) => `ch${i}`);
            const schedules = new Map<string, ScheduleWindow>();

            // Create 48 programs per channel (48 half-hour slots in 24 hours)
            for (const channelId of channelIds) {
                const programs: ScheduledProgram[] = [];
                for (let slot = 0; slot < 48; slot++) {
                    programs.push({
                        item: {
                            ratingKey: `${channelId}-${slot}`,
                            type: 'movie',
                            title: `Program ${slot}`,
                            fullTitle: `Program ${slot}`,
                            durationMs: 1800000,
                            thumb: null,
                            year: 2020,
                            scheduledIndex: slot,
                        },
                        scheduledStartTime: gridAnchorTime + (slot * 30 * 60000),
                        scheduledEndTime: gridAnchorTime + ((slot + 1) * 30 * 60000),
                        elapsedMs: 0,
                        remainingMs: 1800000,
                        scheduleIndex: slot,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    });
                }
                schedules.set(channelId, {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + (24 * 60 * 60000),
                    programs,
                });
            }

            virtualizer.setChannelCount(50);

            const range = virtualizer.calculateVisibleRange({
                channelOffset: 0,
                timeOffset: 0,
            });

            virtualizer.renderVisibleCells(channelIds, schedules, range);

            // Count DOM elements
            const cellCount = container.querySelectorAll('.epg-cell').length;
            expect(cellCount).toBeLessThanOrEqual(EPG_CONSTANTS.MAX_DOM_ELEMENTS);
            expect(cellCount).toBeGreaterThan(0);
        });

        it('should recycle elements when scrolling', () => {
            const channelIds = Array.from({ length: 20 }, (_, i) => `ch${i}`);
            const schedules = new Map<string, ScheduleWindow>();

            for (const channelId of channelIds) {
                const programs: ScheduledProgram[] = [];
                for (let slot = 0; slot < 24; slot++) {
                    programs.push({
                        item: {
                            ratingKey: `${channelId}-${slot}`,
                            type: 'movie',
                            title: `Program ${slot}`,
                            fullTitle: `Program ${slot}`,
                            durationMs: 3600000,
                            thumb: null,
                            year: 2020,
                            scheduledIndex: slot,
                        },
                        scheduledStartTime: gridAnchorTime + (slot * 60 * 60000),
                        scheduledEndTime: gridAnchorTime + ((slot + 1) * 60 * 60000),
                        elapsedMs: 0,
                        remainingMs: 3600000,
                        scheduleIndex: slot,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    });
                }
                schedules.set(channelId, {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + (24 * 60 * 60000),
                    programs,
                });
            }

            virtualizer.setChannelCount(20);

            // Initial render
            const initialRange = virtualizer.calculateVisibleRange({
                channelOffset: 0,
                timeOffset: 0,
            });
            virtualizer.renderVisibleCells(channelIds, schedules, initialRange);
            const initialCount = container.querySelectorAll('.epg-cell').length;

            // Scroll and re-render
            const scrolledRange = virtualizer.calculateVisibleRange({
                channelOffset: 10,
                timeOffset: 180, // 3 hours later
            });
            virtualizer.renderVisibleCells(channelIds, schedules, scrolledRange);
            const afterScrollCount = container.querySelectorAll('.epg-cell').length;

            // Element count should stay stable due to recycling
            expect(afterScrollCount).toBeLessThanOrEqual(EPG_CONSTANTS.MAX_DOM_ELEMENTS);
            // Should be roughly similar to initial count (allowing some variance for buffer)
            expect(Math.abs(afterScrollCount - initialCount)).toBeLessThan(50);
        });

        it('renders fixed content + right-rail structure for program cells', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-rail';
            const start = gridAnchorTime;
            const end = gridAnchorTime + 30 * 60 * 1000;
            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                programs: [{
                    item: {
                        ratingKey: 'rail-1',
                        type: 'episode',
                        title: 'Pilot',
                        fullTitle: 'Great Show - S01E01 - Pilot',
                        showTitle: 'Great Show',
                        seasonNumber: 1,
                        episodeNumber: 1,
                        durationMs: end - start,
                        thumb: null,
                        year: 2026,
                        scheduledIndex: 0,
                    },
                    scheduledStartTime: start,
                    scheduledEndTime: end,
                    elapsedMs: 0,
                    remainingMs: end - start,
                    scheduleIndex: 0,
                    loopNumber: 0,
                    streamDescriptor: null,
                    isCurrent: false,
                }],
            };
            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            expect(cell.querySelector('.epg-cell-content')).not.toBeNull();
            expect(cell.querySelector('.epg-cell-rail')).not.toBeNull();
            expect(cell.querySelector('.epg-cell-content .epg-cell-title')).not.toBeNull();
            expect(cell.querySelector('.epg-cell-content .epg-cell-subtitle')).not.toBeNull();
            expect(cell.querySelector('.epg-cell-rail .epg-cell-time')).not.toBeNull();
            expect(cell.querySelector('.epg-cell-rail .epg-live-badge')).not.toBeNull();
        });

        it('does not apply extra top padding on current cells', () => {
            const now = gridAnchorTime + 15 * 60 * 1000;
            jest.spyOn(Date, 'now').mockReturnValue(now);
            virtualizer.setChannelCount(1);
            const channelId = 'ch-current';
            const start = gridAnchorTime;
            const end = gridAnchorTime + 30 * 60 * 1000;
            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                programs: [{
                    item: {
                        ratingKey: 'current-1',
                        type: 'movie',
                        title: 'Current Program',
                        fullTitle: 'Current Program',
                        durationMs: end - start,
                        thumb: null,
                        year: 2026,
                        scheduledIndex: 0,
                    },
                    scheduledStartTime: start,
                    scheduledEndTime: end,
                    elapsedMs: 0,
                    remainingMs: end - now,
                    scheduleIndex: 0,
                    loopNumber: 0,
                    streamDescriptor: null,
                    // NOTE: EPGVirtualizer recomputes "current" from Date.now(); this fixture field is ignored here.
                    isCurrent: false,
                }],
            };
            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            expect(cell.classList.contains('current')).toBe(true);
            expect(cell.style.paddingTop).toBe('');
        });

        it('hides subtitle and time in narrow and tiny tiers', () => {
            const channelId = 'ch-subtitle';
            const start = gridAnchorTime;
            const narrowEnd = start + 30 * 60 * 1000; // 120px @ 4px/min
            const tinyStart = narrowEnd;
            const tinyEnd = tinyStart + 20 * 60 * 1000; // 80px @ 4px/min

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                programs: [
                    {
                        item: {
                            ratingKey: 'ep-subtitle-1',
                            type: 'episode',
                            title: 'The Heist',
                            fullTitle: 'Great Show - S01E05 - The Heist',
                            showTitle: 'Great Show',
                            seasonNumber: 1,
                            episodeNumber: 5,
                            durationMs: narrowEnd - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: narrowEnd,
                        elapsedMs: 0,
                        remainingMs: narrowEnd - start,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                    {
                        item: {
                            ratingKey: 'ep-subtitle-2',
                            type: 'episode',
                            title: 'The Heist',
                            fullTitle: 'Great Show - S01E05 - The Heist',
                            showTitle: 'Great Show',
                            seasonNumber: 1,
                            episodeNumber: 5,
                            durationMs: tinyEnd - tinyStart,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 1,
                        },
                        scheduledStartTime: tinyStart,
                        scheduledEndTime: tinyEnd,
                        elapsedMs: 0,
                        remainingMs: tinyEnd - tinyStart,
                        scheduleIndex: 1,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };

            virtualizer.setChannelCount(1);
            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const narrowCell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            const narrowSubtitle = narrowCell.querySelector('.epg-cell-subtitle') as HTMLElement;
            const narrowTime = narrowCell.querySelector('.epg-cell-time') as HTMLElement;
            expect(narrowSubtitle.style.display).toBe('none');
            expect(narrowTime.style.display).toBe('none');

            const tinyCell = container.querySelector(`[data-key="${channelId}-${tinyStart}"]`) as HTMLElement;
            const tinySubtitle = tinyCell.querySelector('.epg-cell-subtitle') as HTMLElement;
            const tinyTime = tinyCell.querySelector('.epg-cell-time') as HTMLElement;
            expect(tinySubtitle.style.display).toBe('none');
            expect(tinyTime.style.display).toBe('none');
        });

        it('keeps show title and episode subtitle split in the focused tiny-tier text lanes', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-focused-episode-tiny';
            const start = gridAnchorTime;
            const end = start + (20 * 60000); // tiny tier at 4px/min => 80px

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    {
                        item: {
                            ratingKey: 'ep-focused-1',
                            type: 'episode',
                            title: 'The Edge Of Recovery',
                            fullTitle: 'Great Show - S01E09 - The Edge Of Recovery',
                            showTitle: 'Great Show',
                            seasonNumber: 1,
                            episodeNumber: 9,
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: 0,
                        remainingMs: end - start,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);
            virtualizer.setFocusedCell(channelId, start);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            expect(cell.classList.contains(EPG_CLASSES.CELL_TIER_TINY)).toBe(true);
            expect(cell.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT)).toBe(true);

            const title = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE}`) as HTMLElement;
            const subtitle = cell.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE}`) as HTMLElement;
            const time = cell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement;
            expect(title.textContent).toBe('Great Show');
            expect(subtitle.textContent).toBe('S01E09 - The Edge Of Recovery');
            expect(subtitle.style.display).toBe('block');
            expect(time.style.display).toBe('none');
        });

        it('keeps focused episodes in compact mode even when they do not expose split lanes before focus', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-focused-episode-no-split';
            const start = gridAnchorTime;
            const end = start + (20 * 60000); // tiny tier at 4px/min => 80px

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    {
                        item: {
                            ratingKey: 'ep-focused-no-split-1',
                            type: 'episode',
                            title: 'Episode Without Split Lanes',
                            fullTitle: 'Episode Without Split Lanes',
                            showTitle: '',
                            seasonNumber: 1,
                            episodeNumber: 2,
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: 0,
                        remainingMs: end - start,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            const title = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE}`) as HTMLElement;
            const subtitle = cell.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE}`) as HTMLElement;
            const time = cell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement;
            Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 320 });
            Object.defineProperty(title, 'clientWidth', { configurable: true, value: 80 });
            Object.defineProperty(title, 'scrollHeight', { configurable: true, value: 40 });
            Object.defineProperty(title, 'clientHeight', { configurable: true, value: 40 });

            virtualizer.setFocusedCell(channelId, start);

            expect(cell.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT)).toBe(true);
            expect(subtitle.textContent).toBe('S01E02 - Episode Without Split Lanes');
            expect(subtitle.style.display).toBe('block');
            expect(time.style.display).toBe('none');
            expect(title.classList.contains(EPG_CLASSES.CELL_TITLE_TICKER_READY)).toBe(true);
        });

        it('uses full non-episode title text in the focused title node when fullTitle differs', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-focused-movie-fulltitle';
            const start = gridAnchorTime;
            const end = start + (20 * 60000); // tiny tier at 4px/min => 80px
            const fullTitle = 'The Square (2017)';

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    {
                        item: {
                            ratingKey: 'movie-focused-1',
                            type: 'movie',
                            title: 'The Square',
                            fullTitle,
                            durationMs: end - start,
                            thumb: null,
                            year: 2017,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: 0,
                        remainingMs: end - start,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);
            virtualizer.setFocusedCell(channelId, start);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            expect(cell.classList.contains(EPG_CLASSES.CELL_TIER_TINY)).toBe(true);

            const title = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE}`) as HTMLElement;
            expect(title.textContent).toBe(fullTitle);
        });

        it('starts one-shot ticker only after 900ms for focused truncated titles', () => {
            jest.useFakeTimers();
            try {
                const channelId = 'ch-ticker-delay';
                const start = gridAnchorTime;
                const end = start + 20 * 60 * 1000; // tiny width

                const schedule: ScheduleWindow = {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                    programs: [{
                        item: {
                            ratingKey: 'ticker-1',
                            type: 'movie',
                            title: 'An Extremely Long Program Title That Must Overflow',
                            fullTitle: 'An Extremely Long Program Title That Must Overflow',
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: 0,
                        remainingMs: end - start,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    }],
                };

                virtualizer.setChannelCount(1);
                const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
                virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

                const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
                const title = cell.querySelector('.epg-cell-title') as HTMLElement;

                Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 300 });
                Object.defineProperty(title, 'clientWidth', { configurable: true, value: 80 });

                virtualizer.setFocusedCell(channelId, start);

                expect(title.classList.contains('epg-cell-title-ticker-running')).toBe(false);
                jest.advanceTimersByTime(899);
                expect(title.classList.contains('epg-cell-title-ticker-running')).toBe(false);
                jest.advanceTimersByTime(1);
                expect(title.classList.contains('epg-cell-title-ticker-running')).toBe(true);
            } finally {
                jest.useRealTimers();
            }
        });

        it('does not arm focused ticker when ticker sync is disabled for focus updates', () => {
            jest.useFakeTimers();
            try {
                const channelId = 'ch-ticker-disabled';
                const start = gridAnchorTime;
                const end = start + 20 * 60 * 1000;

                const schedule: ScheduleWindow = {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                    programs: [{
                        item: {
                            ratingKey: 'ticker-disabled-1',
                            type: 'movie',
                            title: 'A Focused Title That Would Normally Overflow',
                            fullTitle: 'A Focused Title That Would Normally Overflow',
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: 0,
                        remainingMs: end - start,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    }],
                };

                virtualizer.setChannelCount(1);
                const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
                virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

                const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
                const title = cell.querySelector('.epg-cell-title') as HTMLElement;

                Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 300 });
                Object.defineProperty(title, 'clientWidth', { configurable: true, value: 80 });

                virtualizer.setFocusedCell(channelId, start, undefined, { syncTicker: false });

                expect(title.classList.contains('epg-cell-title-ticker-ready')).toBe(false);
                jest.advanceTimersByTime(900);
                expect(title.classList.contains('epg-cell-title-ticker-running')).toBe(false);
            } finally {
                jest.useRealTimers();
            }
        });

        it('recomputes visible overflow using text-shift width for focused cells', () => {
            jest.useFakeTimers();
            try {
                const channelId = 'ch-ticker-text-shift';
                const start = gridAnchorTime;
                const end = start + 20 * 60 * 1000;

                const schedule: ScheduleWindow = {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                    programs: [{
                        item: {
                            ratingKey: 'ticker-text-shift-1',
                            type: 'movie',
                            title: 'Long Title That Requires Text Shift To Overflow',
                            fullTitle: 'Long Title That Requires Text Shift To Overflow',
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: 0,
                        remainingMs: end - start,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    }],
                };

                virtualizer.setChannelCount(1);
                const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
                virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

                const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
                const title = cell.querySelector('.epg-cell-title') as HTMLElement;

                Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 110 });
                Object.defineProperty(title, 'clientWidth', { configurable: true, value: 100 });

                const visibleCells = virtualizer as unknown as {
                    visibleCells: Map<string, { textShiftPx: number }>;
                };
                const key = `${channelId}-${start}`;
                const focusedCellData = visibleCells.visibleCells.get(key);
                expect(focusedCellData).toBeDefined();
                focusedCellData!.textShiftPx = 40;

                virtualizer.setFocusedCell(channelId, start);

                expect(title.classList.contains('epg-cell-title-ticker-running')).toBe(false);
                jest.advanceTimersByTime(900);
                expect(title.classList.contains('epg-cell-title-ticker-running')).toBe(true);
            } finally {
                jest.useRealTimers();
            }
        });

        it('keeps ticker-ready class applied for focused tiny overflowing title before run delay', () => {
            jest.useFakeTimers();
            try {
                const channelId = 'ch-ticker-ready-tiny';
                const start = gridAnchorTime;
                const end = start + 20 * 60 * 1000;

                const schedule: ScheduleWindow = {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                    programs: [{
                        item: {
                            ratingKey: 'ticker-ready-1',
                            type: 'movie',
                            title: 'A Very Long Title That Must Scroll In Tiny Tier',
                            fullTitle: 'A Very Long Title That Must Scroll In Tiny Tier',
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: 0,
                        remainingMs: end - start,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    }],
                };

                virtualizer.setChannelCount(1);
                const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
                virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

                const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
                const title = cell.querySelector('.epg-cell-title') as HTMLElement;
                Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 320 });
                Object.defineProperty(title, 'clientWidth', { configurable: true, value: 80 });

                virtualizer.setFocusedCell(channelId, start);

                expect(title.classList.contains('epg-cell-title-ticker-ready')).toBe(true);
                expect(title.classList.contains('epg-cell-title-ticker-running')).toBe(false);
                jest.advanceTimersByTime(899);
                expect(title.classList.contains('epg-cell-title-ticker-running')).toBe(false);
            } finally {
                jest.useRealTimers();
            }
        });

        it('starts focused ticker when tiny-tier title is hidden by line clamp without horizontal overflow', () => {
            jest.useFakeTimers();
            try {
                const channelId = 'ch-ticker-clamp-only';
                const start = gridAnchorTime;
                const end = start + 20 * 60 * 1000;

                const schedule: ScheduleWindow = {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                    programs: [{
                        item: {
                            ratingKey: 'ticker-clamp-only-1',
                            type: 'movie',
                            title: 'Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda',
                            fullTitle: 'Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda',
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: 0,
                        remainingMs: end - start,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    }],
                };

                virtualizer.setChannelCount(1);
                const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
                virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

                const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
                expect(cell.classList.contains(EPG_CLASSES.CELL_TIER_TINY)).toBe(true);

                const title = cell.querySelector('.epg-cell-title') as HTMLElement;
                Object.defineProperty(title, 'scrollWidth', {
                    configurable: true,
                    get: () => title.classList.contains(EPG_CLASSES.CELL_TITLE_TICKER_READY) ? 220 : 80,
                });
                Object.defineProperty(title, 'clientWidth', { configurable: true, value: 80 });
                Object.defineProperty(title, 'scrollHeight', { configurable: true, value: 60 });
                Object.defineProperty(title, 'clientHeight', { configurable: true, value: 40 });

                virtualizer.setFocusedCell(channelId, start);

                expect(title.classList.contains('epg-cell-title-ticker-ready')).toBe(true);
                expect(title.classList.contains('epg-cell-title-ticker-running')).toBe(false);
                expect(title.style.getPropertyValue('--epg-title-ticker-distance-px')).toBe('140px');

                jest.advanceTimersByTime(900);
                expect(title.classList.contains('epg-cell-title-ticker-running')).toBe(true);
            } finally {
                jest.useRealTimers();
            }
        });

        it('starts ticker for both focused episode text lanes when the show and episode titles overflow', () => {
            jest.useFakeTimers();
            try {
                const channelId = 'ch-focused-episode-ticker';
                const start = gridAnchorTime;
                const mid = start + 20 * 60 * 1000;
                const end = mid + 20 * 60 * 1000;
                const showTitle = 'A Very Long Prestige Drama Title That Still Needs To Scroll';
                const episodeTitle = 'An Even Longer Episode Title That Also Needs Full Marquee Travel';

                const schedule: ScheduleWindow = {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                    programs: [{
                        item: {
                            ratingKey: 'ep-focused-ticker-1',
                            type: 'episode',
                            title: episodeTitle,
                            fullTitle: `${showTitle} - S01E09 - ${episodeTitle}`,
                            showTitle,
                            seasonNumber: 1,
                            episodeNumber: 9,
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: mid,
                        elapsedMs: 0,
                        remainingMs: mid - start,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    }, {
                        item: {
                            ratingKey: 'ep-focused-ticker-2',
                            type: 'movie',
                            title: 'Second Focus Target',
                            fullTitle: 'Second Focus Target',
                            durationMs: end - mid,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 1,
                        },
                        scheduledStartTime: mid,
                        scheduledEndTime: end,
                        elapsedMs: 0,
                        remainingMs: end - mid,
                        scheduleIndex: 1,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    }],
                };

                virtualizer.setChannelCount(1);
                const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
                virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

                const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
                const title = cell.querySelector('.epg-cell-title') as HTMLElement;
                const subtitle = cell.querySelector('.epg-cell-subtitle') as HTMLElement;
                Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 320 });
                Object.defineProperty(title, 'clientWidth', { configurable: true, value: 80 });
                Object.defineProperty(subtitle, 'scrollWidth', { configurable: true, value: 360 });
                Object.defineProperty(subtitle, 'clientWidth', { configurable: true, value: 80 });

                virtualizer.setFocusedCell(channelId, start);

                expect(title.textContent).toBe(showTitle);
                expect(subtitle.textContent).toBe(`S01E09 - ${episodeTitle}`);
                expect(title.classList.contains('epg-cell-title-ticker-ready')).toBe(true);
                expect(subtitle.classList.contains('epg-cell-subtitle-ticker-ready')).toBe(true);
                expect(subtitle.style.getPropertyValue('--epg-subtitle-ticker-distance-px')).toBe('280px');

                jest.advanceTimersByTime(900);
                expect(title.classList.contains('epg-cell-title-ticker-running')).toBe(true);
                expect(subtitle.classList.contains('epg-cell-subtitle-ticker-running')).toBe(true);

                virtualizer.setFocusedCell(channelId, mid);
                expect(subtitle.classList.contains('epg-cell-subtitle-ticker-ready')).toBe(false);
                expect(subtitle.classList.contains('epg-cell-subtitle-ticker-running')).toBe(false);
                expect(subtitle.style.getPropertyValue('--epg-subtitle-ticker-distance-px')).toBe('');

                jest.advanceTimersByTime(900);
                expect(subtitle.classList.contains('epg-cell-subtitle-ticker-running')).toBe(false);
            } finally {
                jest.useRealTimers();
            }
        });

        it('keeps the in-cell time on focused medium-width movie cells', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-focused-movie-medium-time-hidden';
            const start = gridAnchorTime;
            const end = start + (40 * 60000); // medium tier at 4px/min => 160px

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    {
                        item: {
                            ratingKey: 'movie-medium-1',
                            type: 'movie',
                            title: 'Medium Focus Movie',
                            fullTitle: 'Medium Focus Movie',
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: 0,
                        remainingMs: end - start,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);
            virtualizer.setFocusedCell(channelId, start);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            expect(cell.classList.contains(EPG_CLASSES.CELL_TIER_MEDIUM)).toBe(true);
            expect(cell.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT)).toBe(false);

            const time = cell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement;
            expect(time.style.display).toBe('block');
        });

        it('uses compact LIVE dot for focused current medium movie overlay cells', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-focused-movie-medium-live-dot';
            const start = gridAnchorTime + (10 * 60000);
            const end = start + (40 * 60000); // medium tier at 4px/min => 160px
            const beforeCurrent = start - (5 * 60000);
            jest.spyOn(Date, 'now').mockReturnValue(beforeCurrent);

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    {
                        item: {
                            ratingKey: 'movie-medium-live-dot-1',
                            type: 'movie',
                            title: 'Focused Medium Live Dot',
                            fullTitle: 'Focused Medium Live Dot',
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: 0,
                        remainingMs: end - beforeCurrent,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);
            virtualizer.setFocusedCell(channelId, start, beforeCurrent);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            const liveBadge = cell.querySelector(`.${EPG_CLASSES.LIVE_BADGE}`) as HTMLElement;
            expect(cell.classList.contains(EPG_CLASSES.CELL_TIER_MEDIUM)).toBe(true);
            expect(cell.classList.contains('epg-cell-focused-movie-overlay')).toBe(true);
            expect(liveBadge.hidden).toBe(true);

            virtualizer.updateTemporalClasses(start + (2 * 60000));

            expect(liveBadge.hidden).toBe(false);
            expect(liveBadge.classList.contains(EPG_CLASSES.CELL_LIVE_COMPACT)).toBe(true);
            expect(liveBadge.textContent).toBe('');
        });

        it('uses compact LIVE badge for current sliver cells even when they are not narrow or focused-compact', () => {
            const now = gridAnchorTime + 227 * 60 * 1000;
            jest.spyOn(Date, 'now').mockReturnValue(now);

            virtualizer.setChannelCount(1);
            const channelId = 'ch-sliver-live';
            const start = gridAnchorTime;
            const end = gridAnchorTime + (240 * 60 * 1000);

            const schedules = new Map<string, ScheduleWindow>([
                [channelId, {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + (24 * 60 * 60000),
                    programs: [{
                        item: {
                            ratingKey: 'sliver-live-1',
                            type: 'movie',
                            title: 'Current Sliver Program',
                            fullTitle: 'Current Sliver Program',
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: now - start,
                        remainingMs: end - now,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    }],
                }],
            ]);

            const timeOffset = 226;
            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset });
            virtualizer.renderVisibleCells([channelId], schedules, range);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            const badge = cell.querySelector(`.${EPG_CLASSES.LIVE_BADGE}`) as HTMLElement;

            expect(cell.classList.contains(EPG_CLASSES.SLIVER_CELL_CLASS)).toBe(true);
            expect(cell.classList.contains(EPG_CLASSES.CELL_TIER_NARROW)).toBe(false);
            expect(cell.classList.contains(EPG_CLASSES.CELL_TIER_TINY)).toBe(false);
            expect(badge.hidden).toBe(false);
            expect(badge.classList.contains(EPG_CLASSES.CELL_LIVE_COMPACT)).toBe(true);
            expect(badge.textContent).toBe('');
        });

        it('keeps focused wide episode cells in compact mode with full-width title and subtitle lanes', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-focused-episode-wide-time-visible';
            const start = gridAnchorTime;
            const end = start + (60 * 60000); // wide tier at 4px/min => 240px

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    {
                        item: {
                            ratingKey: 'episode-wide-1',
                            type: 'episode',
                            title: 'A Day At The Shore',
                            fullTitle: 'Great Show - S01E03 - A Day At The Shore',
                            showTitle: 'Great Show',
                            seasonNumber: 1,
                            episodeNumber: 3,
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: 0,
                        remainingMs: end - start,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);
            virtualizer.setFocusedCell(channelId, start);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            const title = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE}`) as HTMLElement;
            const meta = cell.querySelector(`.${EPG_CLASSES.CELL_META}`) as HTMLElement;
            expect(cell.classList.contains(EPG_CLASSES.CELL_TIER_WIDE)).toBe(true);
            expect(cell.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT)).toBe(true);

            const time = cell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement;
            const subtitle = cell.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE}`) as HTMLElement;
            expect(title.textContent).toBe('Great Show');
            expect(subtitle.textContent).toBe('S01E03 - A Day At The Shore');
            expect(meta.style.display).toBe('none');
            expect(subtitle.style.display).toBe('block');
            expect(time.style.display).toBe('none');
        });

        it('starts ticker when focused title overflow is small but still visible', () => {
            jest.useFakeTimers();
            try {
                const channelId = 'ch-ticker-small-overflow';
                const start = gridAnchorTime;
                const end = start + 20 * 60 * 1000;

                const schedule: ScheduleWindow = {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                    programs: [{
                        item: {
                            ratingKey: 'ticker-small-overflow-1',
                            type: 'movie',
                            title: 'Borderline Overflow Title',
                            fullTitle: 'Borderline Overflow Title',
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: 0,
                        remainingMs: end - start,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    }],
                };

                virtualizer.setChannelCount(1);
                const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
                virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

                const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
                const title = cell.querySelector('.epg-cell-title') as HTMLElement;
                Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 88 });
                Object.defineProperty(title, 'clientWidth', { configurable: true, value: 80 });

                virtualizer.setFocusedCell(channelId, start);

                expect(title.classList.contains('epg-cell-title-ticker-ready')).toBe(true);
                jest.advanceTimersByTime(900);
                expect(title.classList.contains('epg-cell-title-ticker-running')).toBe(true);
            } finally {
                jest.useRealTimers();
            }
        });

        it('does not arm a focused ticker for focused cells with no visible width', () => {
            jest.useFakeTimers();
            try {
                const channelId = 'ch-zero-width-focused-ticker';
                const start = gridAnchorTime;
                const end = start + 20 * 60 * 1000;

                const schedule: ScheduleWindow = {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                    programs: [{
                        item: {
                            ratingKey: 'zero-width-focused-ticker-1',
                            type: 'movie',
                            title: 'Zero Width Focused Ticker Title',
                            fullTitle: 'Zero Width Focused Ticker Title',
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: 0,
                        remainingMs: end - start,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    }],
                };

                virtualizer.setChannelCount(1);
                const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
                virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

                const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
                const title = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE}`) as HTMLElement;

                Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 300 });
                Object.defineProperty(title, 'clientWidth', { configurable: true, value: 80 });

                const visibleCells = (virtualizer as unknown as {
                    visibleCells: Map<string, { visibleWidthPx: number }>;
                }).visibleCells;
                const focusedCell = visibleCells.get(`${channelId}-${start}`);
                if (!focusedCell) {
                    throw new Error('Expected focused cell to exist in visibleCells');
                }
                focusedCell.visibleWidthPx = 0;

                virtualizer.setFocusedCell(channelId, start);

                expect(title.classList.contains('epg-cell-title-ticker-ready')).toBe(false);
                expect(title.classList.contains('epg-cell-title-ticker-running')).toBe(false);

                jest.advanceTimersByTime(900);

                expect(title.classList.contains('epg-cell-title-ticker-ready')).toBe(false);
                expect(title.classList.contains('epg-cell-title-ticker-running')).toBe(false);
            } finally {
                jest.useRealTimers();
            }
        });

        it('arms a focused ticker when right clipping reduces visible width below the title width', () => {
            jest.useFakeTimers();
            try {
                const channelId = 'ch-right-clip-focused-ticker';
                const start = gridAnchorTime;
                const end = start + 25 * 60 * 1000;

                const schedule: ScheduleWindow = {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                    programs: [{
                        item: {
                            ratingKey: 'right-clip-focused-ticker-1',
                            type: 'movie',
                            title: 'Right Clip Ticker Title',
                            fullTitle: 'Right Clip Ticker Title',
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: 0,
                        remainingMs: end - start,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    }],
                };

                virtualizer.setChannelCount(1);
                const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
                virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

                const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
                const title = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE}`) as HTMLElement;

                Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 75 });
                Object.defineProperty(title, 'clientWidth', { configurable: true, value: 80 });

                const visibleCells = (virtualizer as unknown as {
                    visibleCells: Map<string, { visibleWidthPx: number }>;
                }).visibleCells;
                const focusedCell = visibleCells.get(`${channelId}-${start}`);
                if (!focusedCell) {
                    throw new Error('Expected focused cell to exist in visibleCells');
                }
                focusedCell.visibleWidthPx = 70;

                virtualizer.setFocusedCell(channelId, start);

                expect(title.classList.contains(EPG_CLASSES.CELL_TITLE_TICKER_READY)).toBe(true);
                expect(title.classList.contains(EPG_CLASSES.CELL_TITLE_TICKER_RUNNING)).toBe(false);

                jest.advanceTimersByTime(900);

                expect(title.classList.contains(EPG_CLASSES.CELL_TITLE_TICKER_RUNNING)).toBe(true);
            } finally {
                jest.useRealTimers();
            }
        });

        it('derives show title from fullTitle when episode title includes a leading episode code', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-episode-normalized-show-title';
            const start = gridAnchorTime;
            const end = start + 20 * 60 * 1000;

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                programs: [{
                    item: {
                        ratingKey: 'ep-normalized-show-title-1',
                        type: 'episode',
                        title: 'S01E09 - The Edge Of Recovery',
                        fullTitle: 'Great Show - The Edge Of Recovery',
                        showTitle: '',
                        seasonNumber: 1,
                        episodeNumber: 9,
                        durationMs: end - start,
                        thumb: null,
                        year: 2026,
                        scheduledIndex: 0,
                    },
                    scheduledStartTime: start,
                    scheduledEndTime: end,
                    elapsedMs: 0,
                    remainingMs: end - start,
                    scheduleIndex: 0,
                    loopNumber: 0,
                    streamDescriptor: null,
                    isCurrent: false,
                }],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const cell = container.querySelector(`[data-key=\"${channelId}-${start}\"]`) as HTMLElement;
            const title = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE}`) as HTMLElement;
            const subtitle = cell.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE}`) as HTMLElement;

            expect(title.textContent).toBe('Great Show');
            expect(subtitle.textContent).toBe('The Edge Of Recovery');
        });

        it('suppresses focused ticker when prefers-reduced-motion is enabled', () => {
            jest.useFakeTimers();
            const realMatchMedia = globalThis.matchMedia;
            Object.defineProperty(globalThis, 'matchMedia', {
                configurable: true,
                writable: true,
                value: (query: string): MediaQueryList =>
                    ({
                        matches: query === '(prefers-reduced-motion: reduce)',
                    }) as unknown as MediaQueryList,
            });
            try {
                const channelId = 'ch-ticker-reduced-motion';
                const start = gridAnchorTime;
                const end = start + 20 * 60 * 1000; // tiny width

                const schedule: ScheduleWindow = {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                    programs: [{
                        item: {
                            ratingKey: 'ticker-reduce-1',
                            type: 'movie',
                            title: 'An Extremely Long Program Title That Must Overflow',
                            fullTitle: 'An Extremely Long Program Title That Must Overflow',
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: 0,
                        remainingMs: end - start,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    }],
                };

                virtualizer.setChannelCount(1);
                const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
                virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

                const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
                const title = cell.querySelector('.epg-cell-title') as HTMLElement;

                Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 300 });
                Object.defineProperty(title, 'clientWidth', { configurable: true, value: 80 });

                virtualizer.setFocusedCell(channelId, start);

                expect(title.classList.contains('epg-cell-title-ticker-ready')).toBe(false);
                expect(title.classList.contains('epg-cell-title-ticker-running')).toBe(false);

                jest.advanceTimersByTime(900);
                expect(title.classList.contains('epg-cell-title-ticker-ready')).toBe(false);
                expect(title.classList.contains('epg-cell-title-ticker-running')).toBe(false);
            } finally {
                Object.defineProperty(globalThis, 'matchMedia', {
                    configurable: true,
                    writable: true,
                    value: realMatchMedia,
                });
                jest.useRealTimers();
            }
        });

        it('resets ticker immediately when focus moves away', () => {
            jest.useFakeTimers();
            try {
                const channelId = 'ch-ticker-reset';
                const start = gridAnchorTime;
                const mid = start + 20 * 60 * 1000;
                const end = mid + 20 * 60 * 1000;

                const schedule: ScheduleWindow = {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                    programs: [
                        {
                            item: {
                                ratingKey: 'ticker-a',
                                type: 'movie',
                                title: 'Overflow A Overflow A Overflow A',
                                fullTitle: 'Overflow A Overflow A Overflow A',
                                durationMs: mid - start,
                                thumb: null,
                                year: 2026,
                                scheduledIndex: 0,
                            },
                            scheduledStartTime: start,
                            scheduledEndTime: mid,
                            elapsedMs: 0,
                            remainingMs: mid - start,
                            scheduleIndex: 0,
                            loopNumber: 0,
                            streamDescriptor: null,
                            isCurrent: false,
                        },
                        {
                            item: {
                                ratingKey: 'ticker-b',
                                type: 'movie',
                                title: 'Second Program',
                                fullTitle: 'Second Program',
                                durationMs: end - mid,
                                thumb: null,
                                year: 2026,
                                scheduledIndex: 1,
                            },
                            scheduledStartTime: mid,
                            scheduledEndTime: end,
                            elapsedMs: 0,
                            remainingMs: end - mid,
                            scheduleIndex: 1,
                            loopNumber: 0,
                            streamDescriptor: null,
                            isCurrent: false,
                        },
                    ],
                };

                virtualizer.setChannelCount(1);
                const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
                virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

                const firstCell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
                const firstTitle = firstCell.querySelector('.epg-cell-title') as HTMLElement;
                Object.defineProperty(firstTitle, 'scrollWidth', { configurable: true, value: 260 });
                Object.defineProperty(firstTitle, 'clientWidth', { configurable: true, value: 80 });

                virtualizer.setFocusedCell(channelId, start);
                jest.advanceTimersByTime(900);
                expect(firstTitle.classList.contains('epg-cell-title-ticker-running')).toBe(true);

                virtualizer.setFocusedCell(channelId, mid);
                expect(firstTitle.classList.contains('epg-cell-title-ticker-running')).toBe(false);
                expect(firstTitle.style.transform).toBe('');
            } finally {
                jest.useRealTimers();
            }
        });

        it('compacts LIVE badge to dot for current narrow/tiny cells when not focused', () => {
            const now = gridAnchorTime + 5 * 60 * 1000;
            jest.spyOn(Date, 'now').mockReturnValue(now);
            const channelId = 'ch-live-dot';
            const start = gridAnchorTime;
            const end = gridAnchorTime + 20 * 60 * 1000;
            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                programs: [{
                    item: {
                        ratingKey: 'live-compact-1',
                        type: 'movie',
                        title: 'Live Program',
                        fullTitle: 'Live Program',
                        durationMs: end - start,
                        thumb: null,
                        year: 2026,
                        scheduledIndex: 0,
                    },
                    scheduledStartTime: start,
                    scheduledEndTime: end,
                    elapsedMs: 0,
                    remainingMs: end - now,
                    scheduleIndex: 0,
                    loopNumber: 0,
                    streamDescriptor: null,
                    // NOTE: EPGVirtualizer recomputes "current" from Date.now(); this fixture field is ignored here.
                    isCurrent: false,
                }],
            };
            virtualizer.setChannelCount(1);
            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);
            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            const badge = cell.querySelector('.epg-live-badge') as HTMLElement;
            expect(badge.classList.contains('epg-live-badge-compact')).toBe(true);
            expect(badge.hidden).toBe(false);
            expect(badge.textContent).toBe('');
        });

        it('renders progress width for current program cells', () => {
            const channelId = 'ch-progress-current';
            const start = gridAnchorTime;
            const end = gridAnchorTime + 20 * 60 * 1000;
            jest.spyOn(Date, 'now').mockReturnValue(start + 5 * 60_000);

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60 * 1000),
                programs: [{
                    item: {
                        ratingKey: 'progress-current-1',
                        type: 'movie',
                        title: 'Current Program',
                        fullTitle: 'Current Program',
                        durationMs: end - start,
                        thumb: null,
                        year: 2026,
                        scheduledIndex: 0,
                    },
                    scheduledStartTime: start,
                    scheduledEndTime: end,
                    elapsedMs: 0,
                    remainingMs: end - (start + 5 * 60_000),
                    scheduleIndex: 0,
                    loopNumber: 0,
                    streamDescriptor: null,
                    isCurrent: false,
                }],
            };

            virtualizer.setChannelCount(1);
            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            const fill = cell.querySelector('.epg-cell-progress-fill') as HTMLElement;
            expect(fill).not.toBeNull();
            expect(fill.style.width).toBe('25%');
        });

        it('uses provided nowMs snapshot for current/progress calculations', () => {
            const channelId = 'ch-progress-now-snapshot';
            const start = gridAnchorTime;
            const end = gridAnchorTime + 20 * 60 * 1000;
            // If renderVisibleCells accidentally reads Date.now() internally, it will treat this as non-current.
            jest.spyOn(Date, 'now').mockReturnValue(start - 5 * 60_000);

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60 * 1000),
                programs: [{
                    item: {
                        ratingKey: 'progress-now-snapshot-1',
                        type: 'movie',
                        title: 'Snapshot Program',
                        fullTitle: 'Snapshot Program',
                        durationMs: end - start,
                        thumb: null,
                        year: 2026,
                        scheduledIndex: 0,
                    },
                    scheduledStartTime: start,
                    scheduledEndTime: end,
                    elapsedMs: 0,
                    remainingMs: end - (start + 5 * 60_000),
                    scheduleIndex: 0,
                    loopNumber: 0,
                    streamDescriptor: null,
                    isCurrent: false,
                }],
            };

            virtualizer.setChannelCount(1);
            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells(
                [channelId],
                new Map([[channelId, schedule]]),
                range,
                undefined,
                start + 5 * 60_000
            );

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            const fill = cell.querySelector('.epg-cell-progress-fill') as HTMLElement;
            expect(fill).not.toBeNull();
            expect(fill.style.width).toBe('25%');
        });

        it('updates progress width when a cell becomes current via temporal refresh', () => {
            const channelId = 'ch-progress-update';
            const start = gridAnchorTime + 10 * 60 * 1000;
            const end = start + 20 * 60 * 1000;
            const beforeCurrent = start - 5 * 60 * 1000;
            jest.spyOn(Date, 'now').mockReturnValue(beforeCurrent);

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60 * 1000),
                programs: [{
                    item: {
                        ratingKey: 'progress-update-1',
                        type: 'movie',
                        title: 'Temporal Progress Program',
                        fullTitle: 'Temporal Progress Program',
                        durationMs: end - start,
                        thumb: null,
                        year: 2026,
                        scheduledIndex: 0,
                    },
                    scheduledStartTime: start,
                    scheduledEndTime: end,
                    elapsedMs: 0,
                    remainingMs: end - beforeCurrent,
                    scheduleIndex: 0,
                    loopNumber: 0,
                    streamDescriptor: null,
                    isCurrent: false,
                }],
            };

            virtualizer.setChannelCount(1);
            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            virtualizer.updateTemporalClasses(start + 10 * 60_000);
            const fill = cell.querySelector('.epg-cell-progress-fill') as HTMLElement;
            expect(fill.style.width).toBe('50%');
        });

        it('resets progress width when a current program becomes past', () => {
            const channelId = 'ch-progress-reset';
            const start = gridAnchorTime + 10 * 60 * 1000;
            const end = start + 20 * 60 * 1000;
            const beforeCurrent = start - 5 * 60 * 1000;
            jest.spyOn(Date, 'now').mockReturnValue(beforeCurrent);

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60 * 1000),
                programs: [{
                    item: {
                        ratingKey: 'progress-reset-1',
                        type: 'movie',
                        title: 'Temporal Progress Reset Program',
                        fullTitle: 'Temporal Progress Reset Program',
                        durationMs: end - start,
                        thumb: null,
                        year: 2026,
                        scheduledIndex: 0,
                    },
                    scheduledStartTime: start,
                    scheduledEndTime: end,
                    elapsedMs: 0,
                    remainingMs: end - beforeCurrent,
                    scheduleIndex: 0,
                    loopNumber: 0,
                    streamDescriptor: null,
                    isCurrent: false,
                }],
            };

            virtualizer.setChannelCount(1);
            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            const fill = cell.querySelector('.epg-cell-progress-fill') as HTMLElement;

            virtualizer.updateTemporalClasses(start + 10 * 60_000);
            expect(fill.style.width).toBe('50%');

            virtualizer.updateTemporalClasses(end + 1);
            expect(fill.style.width).toBe('0%');
        });

        it('keeps compact LIVE dot when narrow/tiny cell is focused', () => {
            const now = gridAnchorTime + 5 * 60 * 1000;
            jest.spyOn(Date, 'now').mockReturnValue(now);
            const channelId = 'ch-live-focused';
            const start = gridAnchorTime;
            const end = gridAnchorTime + 20 * 60 * 1000;
            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                programs: [{
                    item: {
                        ratingKey: 'live-focused-1',
                        type: 'movie',
                        title: 'Focused Live Program',
                        fullTitle: 'Focused Live Program',
                        durationMs: end - start,
                        thumb: null,
                        year: 2026,
                        scheduledIndex: 0,
                    },
                    scheduledStartTime: start,
                    scheduledEndTime: end,
                    elapsedMs: 0,
                    remainingMs: end - now,
                    scheduleIndex: 0,
                    loopNumber: 0,
                    streamDescriptor: null,
                    // NOTE: EPGVirtualizer recomputes "current" from Date.now(); this fixture field is ignored here.
                    isCurrent: false,
                }],
            };
            virtualizer.setChannelCount(1);
            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range, `${channelId}-${start}`);
            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            const badge = cell.querySelector('.epg-live-badge') as HTMLElement;
            expect(badge.classList.contains('epg-live-badge-compact')).toBe(true);
            expect(badge.hidden).toBe(false);
            expect(badge.textContent).toBe('');
        });

        it('keeps time visible when a tiny movie cell is focused', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-time-focused';
            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    {
                        item: {
                            ratingKey: 'tiny-time-focused',
                            type: 'movie',
                            title: 'Tiny Movie Focus',
                            fullTitle: 'Tiny Movie Focus',
                            durationMs: 20 * 60000,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: gridAnchorTime,
                        scheduledEndTime: gridAnchorTime + (20 * 60000),
                        elapsedMs: 0,
                        remainingMs: 0,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range, `${channelId}-${gridAnchorTime}`);

            const cell = container.querySelector(`[data-key="${channelId}-${gridAnchorTime}"]`) as HTMLElement;
            const timeLine = cell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement;

            expect(cell.classList.contains('epg-cell-tier-tiny')).toBe(true);
            expect(cell.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT)).toBe(false);
            expect(timeLine.style.display).toBe('block');
        });

        it('keeps compact time styling but restores the time line for focused tiny movie cells', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-focus-update';
            const start = gridAnchorTime;
            const end = gridAnchorTime + (20 * 60000); // tiny tier at 4px/min => 80px
            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    {
                        item: {
                            ratingKey: 'focus-update-1',
                            type: 'movie',
                            title: 'Focus Update Program',
                            fullTitle: 'Focus Update Program',
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: 0,
                        remainingMs: end - start,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            const timeLine = cell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement;
            expect(timeLine.classList.contains(EPG_CLASSES.CELL_TIME_COMPACT)).toBe(true);
            expect(timeLine.style.display).toBe('none');

            const focused = virtualizer.setFocusedCell(channelId, start, start + 5 * 60000);
            expect(focused).not.toBeNull();
            expect(timeLine.classList.contains(EPG_CLASSES.CELL_TIME_COMPACT)).toBe(true);
            expect(timeLine.style.display).toBe('block');
        });

        it('keeps time hidden and compact when tiny cell becomes current via temporal refresh', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-current-update';
            const start = gridAnchorTime + (10 * 60000);
            const end = start + (20 * 60000); // tiny tier at 4px/min => 80px
            const beforeCurrent = start - (5 * 60000);
            jest.spyOn(Date, 'now').mockReturnValue(beforeCurrent);

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    {
                        item: {
                            ratingKey: 'current-update-1',
                            type: 'movie',
                            title: 'Temporal Update Program',
                            fullTitle: 'Temporal Update Program',
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: 0,
                        remainingMs: end - beforeCurrent,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            const timeLine = cell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement;
            const liveBadge = cell.querySelector(`.${EPG_CLASSES.LIVE_BADGE}`) as HTMLElement;
            expect(timeLine.classList.contains(EPG_CLASSES.CELL_TIME_COMPACT)).toBe(true);
            expect(timeLine.style.display).toBe('none');
            expect(liveBadge.hidden).toBe(true);

            virtualizer.updateTemporalClasses(start + (2 * 60000));

            expect(timeLine.classList.contains(EPG_CLASSES.CELL_TIME_COMPACT)).toBe(true);
            expect(timeLine.style.display).toBe('none');
            expect(liveBadge.hidden).toBe(false);
            expect(liveBadge.classList.contains(EPG_CLASSES.CELL_LIVE_COMPACT)).toBe(true);
            expect(liveBadge.textContent).toBe('');
        });

        it('keeps focused compact ticker distance fixed when current state changes live badge visibility', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-focused-compact-current-ticker';
            const start = gridAnchorTime + (10 * 60000);
            const end = start + (20 * 60000); // tiny tier at 4px/min => 80px
            const beforeCurrent = start - (5 * 60000);
            jest.spyOn(Date, 'now').mockReturnValue(beforeCurrent);

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    {
                        item: {
                            ratingKey: 'focused-compact-current-ticker-1',
                            type: 'episode',
                            title: 'The Episode With A Long Marquee Title',
                            fullTitle: 'Prestige Show - S01E03 - The Episode With A Long Marquee Title',
                            showTitle: 'Prestige Show',
                            seasonNumber: 1,
                            episodeNumber: 3,
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: 0,
                        remainingMs: end - beforeCurrent,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);
            virtualizer.setFocusedCell(channelId, start, beforeCurrent);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            const title = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE}`) as HTMLElement;
            const subtitle = cell.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE}`) as HTMLElement;
            const liveBadge = cell.querySelector(`.${EPG_CLASSES.LIVE_BADGE}`) as HTMLElement;

            expect(cell.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT)).toBe(true);
            expect(liveBadge.hidden).toBe(true);

            Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 160 });
            Object.defineProperty(title, 'clientWidth', {
                configurable: true,
                get: () => (liveBadge.hidden ? 100 : 92),
            });
            Object.defineProperty(subtitle, 'scrollWidth', { configurable: true, value: 40 });
            Object.defineProperty(subtitle, 'clientWidth', { configurable: true, value: 100 });

            virtualizer.setFocusedCell(channelId, start, beforeCurrent);
            expect(title.style.getPropertyValue('--epg-title-ticker-distance-px')).toBe('60px');

            virtualizer.updateTemporalClasses(start + (2 * 60000));

            expect(liveBadge.hidden).toBe(false);
            expect(title.style.getPropertyValue('--epg-title-ticker-distance-px')).toBe('60px');
        });

        it('keeps focused tiny movie time bottom-right while live dot overlays top-right', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-focused-tiny-movie-overlay';
            const start = gridAnchorTime + (10 * 60000);
            const end = start + (20 * 60000); // tiny tier at 4px/min => 80px
            const beforeCurrent = start - (5 * 60000);
            jest.spyOn(Date, 'now').mockReturnValue(beforeCurrent);

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    {
                        item: {
                            ratingKey: 'focused-tiny-movie-overlay-1',
                            type: 'movie',
                            title: 'Focused Tiny Movie Overlay',
                            fullTitle: 'Focused Tiny Movie Overlay',
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: 0,
                        remainingMs: end - beforeCurrent,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);
            virtualizer.setFocusedCell(channelId, start, beforeCurrent);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            const timeLine = cell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement;
            const badge = cell.querySelector(`.${EPG_CLASSES.LIVE_BADGE}`) as HTMLElement;

            expect(cell.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT)).toBe(false);
            expect(cell.classList.contains('epg-cell-focused-movie-overlay')).toBe(true);
            expect(timeLine.style.display).toBe('block');

            virtualizer.updateTemporalClasses(start + (2 * 60000));

            expect(timeLine.style.display).toBe('block');
            expect(badge.hidden).toBe(false);
            expect(badge.classList.contains(EPG_CLASSES.CELL_LIVE_COMPACT)).toBe(true);
            expect(badge.textContent).toBe('');
        });

        it('uses compact LIVE dot for current medium episodes in focused compact mode', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-focused-episode-medium-live-dot';
            const start = gridAnchorTime;
            const end = start + (40 * 60000); // medium tier at 4px/min => 160px
            const now = start + (5 * 60000);
            jest.spyOn(Date, 'now').mockReturnValue(now);

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    {
                        item: {
                            ratingKey: 'focused-episode-medium-live-dot-1',
                            type: 'episode',
                            title: 'The Compact Badge Episode',
                            fullTitle: 'Prestige Show - S01E03 - The Compact Badge Episode',
                            showTitle: 'Prestige Show',
                            seasonNumber: 1,
                            episodeNumber: 3,
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: now - start,
                        remainingMs: end - now,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            virtualizer.setFocusedCell(channelId, start);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            const badge = cell.querySelector(`.${EPG_CLASSES.LIVE_BADGE}`) as HTMLElement;
            const time = cell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement;

            expect(cell.classList.contains(EPG_CLASSES.CELL_TIER_MEDIUM)).toBe(true);
            expect(cell.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT)).toBe(true);
            expect(cell.classList.contains('epg-cell-focused-movie-overlay')).toBe(false);
            expect(time.style.display).toBe('none');
            expect(badge.hidden).toBe(false);
            expect(badge.classList.contains(EPG_CLASSES.CELL_LIVE_COMPACT)).toBe(true);
            expect(badge.textContent).toBe('');
        });

        it('recomputes LIVE badge immediately when focus switches a current medium movie into overlay mode', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-focused-movie-immediate-live-refresh';
            const start = gridAnchorTime;
            const end = start + (40 * 60000); // medium tier
            const now = start + (5 * 60000);
            jest.spyOn(Date, 'now').mockReturnValue(now);

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    {
                        item: {
                            ratingKey: 'focused-movie-immediate-live-refresh-1',
                            type: 'movie',
                            title: 'Immediate Badge Refresh',
                            fullTitle: 'Immediate Badge Refresh',
                            durationMs: end - start,
                            thumb: null,
                            year: 2026,
                            scheduledIndex: 0,
                        },
                        scheduledStartTime: start,
                        scheduledEndTime: end,
                        elapsedMs: now - start,
                        remainingMs: end - now,
                        scheduleIndex: 0,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    },
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            const badge = cell.querySelector(`.${EPG_CLASSES.LIVE_BADGE}`) as HTMLElement;

            expect(cell.classList.contains(EPG_CLASSES.CELL_TIER_MEDIUM)).toBe(true);
            expect(cell.classList.contains('epg-cell-focused-movie-overlay')).toBe(false);
            expect(badge.hidden).toBe(false);
            expect(badge.classList.contains(EPG_CLASSES.CELL_LIVE_COMPACT)).toBe(false);
            expect(badge.textContent).toBe('LIVE');

            virtualizer.setFocusedCell(channelId, start);

            expect(cell.classList.contains('epg-cell-focused-movie-overlay')).toBe(true);
            expect(badge.hidden).toBe(false);
            expect(badge.classList.contains(EPG_CLASSES.CELL_LIVE_COMPACT)).toBe(true);
            expect(badge.textContent).toBe('');
        });

        it('applies focused movie overlay only to movies and keeps split-lane episodes in focused compact mode', () => {
            virtualizer.setChannelCount(3);
            const movieChannelId = 'ch-focused-movie-only';
            const clipChannelId = 'ch-focused-clip-no-movie-overlay';
            const episodeChannelId = 'ch-focused-episode-compact';
            const start = gridAnchorTime + (10 * 60000);
            const end = start + (20 * 60000); // tiny tier at 4px/min => 80px

            const schedules = new Map<string, ScheduleWindow>([
                [movieChannelId, {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + (24 * 60 * 60000),
                    programs: [
                        {
                            item: {
                                ratingKey: 'focused-movie-only-1',
                                type: 'movie',
                                title: 'Movie Overlay Owner',
                                fullTitle: 'Movie Overlay Owner',
                                durationMs: end - start,
                                thumb: null,
                                year: 2026,
                                scheduledIndex: 0,
                            },
                            scheduledStartTime: start,
                            scheduledEndTime: end,
                            elapsedMs: 0,
                            remainingMs: end - start,
                            scheduleIndex: 0,
                            loopNumber: 0,
                            streamDescriptor: null,
                            isCurrent: false,
                        },
                    ],
                }],
                [clipChannelId, {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + (24 * 60 * 60000),
                    programs: [
                        {
                            item: {
                                ratingKey: 'focused-clip-no-movie-overlay-1',
                                type: 'clip',
                                title: 'Clip Should Stay Generic',
                                fullTitle: 'Clip Should Stay Generic',
                                durationMs: end - start,
                                thumb: null,
                                year: 2026,
                                scheduledIndex: 0,
                            },
                            scheduledStartTime: start,
                            scheduledEndTime: end,
                            elapsedMs: 0,
                            remainingMs: end - start,
                            scheduleIndex: 0,
                            loopNumber: 0,
                            streamDescriptor: null,
                            isCurrent: false,
                        },
                    ],
                }],
                [episodeChannelId, {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + (24 * 60 * 60000),
                    programs: [
                        {
                            item: {
                                ratingKey: 'focused-episode-compact-1',
                                type: 'episode',
                                title: 'The Split Lane Episode',
                                fullTitle: 'Prestige Show - S01E03 - The Split Lane Episode',
                                showTitle: 'Prestige Show',
                                seasonNumber: 1,
                                episodeNumber: 3,
                                durationMs: end - start,
                                thumb: null,
                                year: 2026,
                                scheduledIndex: 0,
                            },
                            scheduledStartTime: start,
                            scheduledEndTime: end,
                            elapsedMs: 0,
                            remainingMs: end - start,
                            scheduleIndex: 0,
                            loopNumber: 0,
                            streamDescriptor: null,
                            isCurrent: false,
                        },
                    ],
                }],
            ]);

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([movieChannelId, clipChannelId, episodeChannelId], schedules, range);

            virtualizer.setFocusedCell(movieChannelId, start);
            const movieCell = container.querySelector(`[data-key="${movieChannelId}-${start}"]`) as HTMLElement;
            expect(movieCell.classList.contains('epg-cell-focused-movie-overlay')).toBe(true);
            expect(movieCell.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT)).toBe(false);

            virtualizer.setFocusedCell(clipChannelId, start);
            const clipCell = container.querySelector(`[data-key="${clipChannelId}-${start}"]`) as HTMLElement;
            expect(clipCell.classList.contains('epg-cell-focused-movie-overlay')).toBe(false);
            expect(clipCell.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT)).toBe(false);

            virtualizer.setFocusedCell(episodeChannelId, start);
            const episodeCell = container.querySelector(`[data-key="${episodeChannelId}-${start}"]`) as HTMLElement;
            const episodeTime = episodeCell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement;
            expect(episodeCell.classList.contains('epg-cell-focused-movie-overlay')).toBe(false);
            expect(episodeCell.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT)).toBe(true);
            expect(episodeTime.style.display).toBe('none');
        });
    });

    describe('element pool management', () => {
        it('should reuse elements from pool', () => {
            const channelIds = ['ch1'];
            const schedules = new Map<string, ScheduleWindow>();

            schedules.set('ch1', {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (3 * 60 * 60000),
                programs: [{
                    item: {
                        ratingKey: '1',
                        type: 'movie',
                        title: 'Movie 1',
                        fullTitle: 'Movie 1',
                        durationMs: 7200000,
                        thumb: null,
                        year: 2020,
                        scheduledIndex: 0,
                    },
                    scheduledStartTime: gridAnchorTime,
                    scheduledEndTime: gridAnchorTime + 7200000,
                    elapsedMs: 0,
                    remainingMs: 7200000,
                    scheduleIndex: 0,
                    loopNumber: 0,
                    streamDescriptor: null,
                    isCurrent: false,
                }],
            });

            virtualizer.setChannelCount(1);

            // Render, then force recycle
            const range = virtualizer.calculateVisibleRange({
                channelOffset: 0,
                timeOffset: 0,
            });
            virtualizer.renderVisibleCells(channelIds, schedules, range);

            expect(virtualizer.getElementCount()).toBeGreaterThan(0);

            // Force recycle should move element to pool
            virtualizer.forceRecycleAll();

            expect(virtualizer.getElementCount()).toBe(0);
            expect(virtualizer.getPoolSize()).toBe(0); // forceRecycleAll clears pool
        });

        it('keeps focused cell when exceeding DOM cap', () => {
            const channelIds = Array.from({ length: 10 }, (_, i) => `ch${i}`);
            const schedules = new Map<string, ScheduleWindow>();
            const focusedChannel = channelIds[0];
            const focusedStart = gridAnchorTime + (2 * 30 * 60000);
            const focusedKey = `${focusedChannel}-${focusedStart}`;

            for (const channelId of channelIds) {
                const programs: ScheduledProgram[] = [];
                for (let slot = 0; slot < 60; slot++) {
                    programs.push({
                        item: {
                            ratingKey: `${channelId}-${slot}`,
                            type: 'movie',
                            title: `Program ${slot}`,
                            fullTitle: `Program ${slot}`,
                            durationMs: 1800000,
                            thumb: null,
                            year: 2020,
                            scheduledIndex: slot,
                        },
                        scheduledStartTime: gridAnchorTime + (slot * 30 * 60000),
                        scheduledEndTime: gridAnchorTime + ((slot + 1) * 30 * 60000),
                        elapsedMs: 0,
                        remainingMs: 1800000,
                        scheduleIndex: slot,
                        loopNumber: 0,
                        streamDescriptor: null,
                        isCurrent: false,
                    });
                }
                schedules.set(channelId, {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + (24 * 60 * 60000),
                    programs,
                });
            }

            virtualizer.setChannelCount(channelIds.length);
            const range = virtualizer.calculateVisibleRange({
                channelOffset: 0,
                timeOffset: 0,
            });
            virtualizer.renderVisibleCells(channelIds, schedules, range, focusedKey);

            const focusedCell = container.querySelector(`[data-key="${focusedKey}"]`);
            expect(focusedCell).not.toBeNull();
        });
    });

    describe('temporal class updates', () => {
        it('marks programs as past when end time has passed', () => {
            const channelIds = ['ch0'];
            const channelId = channelIds[0];
            if (!channelId) {
                throw new Error('Missing channelId for temporal class test.');
            }
            const program: ScheduledProgram = {
                item: {
                    ratingKey: 'past-test',
                    type: 'movie',
                    title: 'Past Test',
                    fullTitle: 'Past Test',
                    durationMs: 1800000,
                    thumb: null,
                    year: 2020,
                    scheduledIndex: 0,
                },
                scheduledStartTime: gridAnchorTime,
                scheduledEndTime: gridAnchorTime + (30 * 60000),
                elapsedMs: 0,
                remainingMs: 1800000,
                scheduleIndex: 0,
                loopNumber: 0,
                streamDescriptor: null,
                isCurrent: false,
            };
            const schedules = new Map<string, ScheduleWindow>();
            schedules.set(channelId, {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [program],
            });

            virtualizer.setChannelCount(channelIds.length);
            const range = virtualizer.calculateVisibleRange({
                channelOffset: 0,
                timeOffset: 0,
            });
            virtualizer.renderVisibleCells(channelIds, schedules, range);

            const key = `${channelId}-${program.scheduledStartTime}`;
            const cell = container.querySelector(`[data-key="${key}"]`) as HTMLElement;
            expect(cell).not.toBeNull();

            virtualizer.updateTemporalClasses(gridAnchorTime + (31 * 60000));
            expect(cell.classList.contains(EPG_CLASSES.CELL_PAST)).toBe(true);

            virtualizer.updateTemporalClasses(gridAnchorTime + (10 * 60000));
            expect(cell.classList.contains(EPG_CLASSES.CELL_CURRENT)).toBe(true);
            expect(cell.classList.contains(EPG_CLASSES.CELL_PAST)).toBe(false);
        });
    });
});
