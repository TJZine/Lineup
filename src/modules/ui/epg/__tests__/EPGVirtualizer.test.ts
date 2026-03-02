/**
 * @jest-environment jsdom
 */
/**
 * @fileoverview EPG Virtualizer unit tests
 * @module modules/ui/epg/__tests__/EPGVirtualizer.test
 */

import { EPGVirtualizer, positionCell } from '../EPGVirtualizer';
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

        it('keeps time hidden when tiny cell is focused', () => {
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
            expect(timeLine.style.display).toBe('none');
        });

        it('keeps time hidden and compact semantics after setFocusedCell without rerender', () => {
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
            expect(timeLine.style.display).toBe('none');
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
