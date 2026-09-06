/**
 * @jest-environment jsdom
 */
/**
 * @fileoverview EPG Virtualizer unit tests
 * @module modules/ui/epg/__tests__/EPGVirtualizer.test
 */

import { EPGVirtualizer } from '../view/EPGVirtualizer';
import { positionCell } from '../view/EPGProgramCellPosition';
import { EPG_CONSTANTS, EPG_CLASSES } from '../constants';
import type { ScheduledProgram, ScheduleWindow, EPGConfig } from '../types';

describe('EPGVirtualizer', () => {
    let virtualizer: EPGVirtualizer;
    let container: HTMLElement;
    let config: EPGConfig;
    const gridAnchorTime = new Date('2026-01-07T00:00:00').getTime();
    type ProgramOverrides = Omit<Partial<ScheduledProgram>, 'item'> & {
        item?: Partial<ScheduledProgram['item']>;
    };
    const createProgram = (overrides: ProgramOverrides = {}): ScheduledProgram => {
        const scheduledStartTime = overrides.scheduledStartTime ?? gridAnchorTime;
        const scheduledEndTime = overrides.scheduledEndTime ?? scheduledStartTime + (60 * 60_000);
        const title = overrides.item?.title ?? 'Program';

        return {
            scheduledStartTime,
            scheduledEndTime,
            elapsedMs: 0,
            remainingMs: scheduledEndTime - scheduledStartTime,
            scheduleIndex: 0,
            loopNumber: 0,
            isCurrent: false,
            ...overrides,
            item: {
                ratingKey: 'program',
                type: 'movie',
                title,
                fullTitle: title,
                durationMs: scheduledEndTime - scheduledStartTime,
                thumb: null,
                year: 2024,
                scheduledIndex: 0,
                ...overrides.item,
            },
        };
    };
    const stubRenderedWidth = (element: HTMLElement, width: number): void => {
        Object.defineProperty(element, 'getBoundingClientRect', {
            configurable: true,
            value: () => ({ width }),
        });
    };

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
            autoScrollToNow: false,
        };

        virtualizer = new EPGVirtualizer();
        virtualizer.initialize(container, config, gridAnchorTime);
    });

    afterEach(() => {
        virtualizer.destroy();
        container.remove();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('positionCell', () => {
        it('computes left/width deterministically from program times', () => {
            const program = createProgram({
                item: { ratingKey: '1', title: 'Test Movie', durationMs: 1_800_000 },
                scheduledStartTime: gridAnchorTime + 60_000,
                scheduledEndTime: gridAnchorTime + 120_000,
            });

            const cell = positionCell(program, gridAnchorTime);

            expect(cell.left).toBeGreaterThanOrEqual(0);
            expect(cell.width).toBeGreaterThan(0);
            expect(cell.program.item.ratingKey).toBe('1');
        });

        it.each([
            {
                label: 'maps a one-hour offset and duration',
                startOffsetMs: 60 * 60_000,
                durationMs: 60 * 60_000,
                pixelsPerMinute: 4,
                expectedLeft: 240,
                expectedWidth: 240,
            },
            {
                label: 'enforces the minimum width for a ten-second clip',
                startOffsetMs: 0,
                durationMs: 10_000,
                pixelsPerMinute: 1,
                expectedLeft: 0,
                expectedWidth: 20,
            },
        ])('$label', ({ startOffsetMs, durationMs, pixelsPerMinute, expectedLeft, expectedWidth }) => {
            const program = createProgram({
                item: { type: 'clip', durationMs },
                scheduledStartTime: gridAnchorTime + startOffsetMs,
                scheduledEndTime: gridAnchorTime + startOffsetMs + durationMs,
            });

            expect(positionCell(program, gridAnchorTime, pixelsPerMinute)).toMatchObject({
                left: expectedLeft,
                width: expectedWidth,
            });
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
                    createProgram({ item: { ratingKey: 'stable-1', title: 'Stable Program', durationMs: 60 * 60000, year: 2026 }, scheduledStartTime: gridAnchorTime, scheduledEndTime: gridAnchorTime + (60 * 60000), remainingMs: 0 }),
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
                    createProgram({ item: { ratingKey, title: 'Stable Program', durationMs: 60 * 60000, year: 2026 }, scheduledStartTime: gridAnchorTime, scheduledEndTime: gridAnchorTime + (60 * 60000), remainingMs: 0 }),
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
            const program: ScheduledProgram = createProgram({ item: { ratingKey: `${channelId}-0`, title: 'Top Test', durationMs: 1800000 }, scheduledStartTime: gridAnchorTime, scheduledEndTime: gridAnchorTime + 1800000, remainingMs: 1800000 });
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

            const program: ScheduledProgram = createProgram({ item: { ratingKey: 'p1', title: 'Program 1', durationMs: 60 * 60 * 1000 }, scheduledStartTime: gridAnchorTime + (90 * 60000), scheduledEndTime: gridAnchorTime + (150 * 60000), remainingMs: 0 });

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
            const program: ScheduledProgram = createProgram({ item: { ratingKey: 'scrub-1', title: 'Scrub Program', durationMs: 180 * 60 * 1000, year: 2026 }, scheduledStartTime: gridAnchorTime + (30 * 60000), scheduledEndTime: gridAnchorTime + (210 * 60000), remainingMs: 0 });

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
            const program: ScheduledProgram = createProgram({ item: { ratingKey: 'clamp-1', title: 'Clamp Program', durationMs: 240 * 60 * 1000, year: 2026 }, scheduledStartTime: gridAnchorTime, scheduledEndTime: gridAnchorTime + (240 * 60000), remainingMs: 0 });
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
            const program: ScheduledProgram = createProgram({ item: { ratingKey: 'sliver-clipped-1', title: 'Sliver Clipped Program', durationMs: 240 * 60 * 1000, year: 2026 }, scheduledStartTime: gridAnchorTime, scheduledEndTime: gridAnchorTime + (240 * 60000), remainingMs: 0 });
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

        it('preserves full pre-anchor geometry and shifts text into the clipped viewport', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-left-clipped';

            const program: ScheduledProgram = createProgram({ item: { ratingKey: 'left-clipped-1', title: 'Left Clipped Program', durationMs: 60 * 60 * 1000 }, scheduledStartTime: gridAnchorTime - (30 * 60000), scheduledEndTime: gridAnchorTime + (30 * 60000), remainingMs: 0 });

            const schedules = new Map<string, ScheduleWindow>([
                [channelId, {
                    startTime: gridAnchorTime - (2 * 60 * 60000),
                    endTime: gridAnchorTime + (24 * 60 * 60000),
                    programs: [program],
                }],
            ]);

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], schedules, range);

            const expectedKey = `${channelId}-${program.scheduledStartTime}`;
            const cell = container.querySelector(`[data-key="${expectedKey}"]`) as HTMLElement;
            expect(cell).not.toBeNull();
            expect(cell.style.left).toBe('-120px');
            expect(cell.style.width).toBe('240px');
            expect(cell.classList.contains(EPG_CLASSES.CELL_TEXT_SHIFTED)).toBe(true);
            expect(cell.style.getPropertyValue('--epg-cell-text-shift-px')).toBe('120px');
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
                        createProgram({ item: { ratingKey: 'sliver-short-1', title: 'Short Sliver', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start }),
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

        it('keeps focused episodes out of sliver suppression so tag-lane subtitle and ticker behavior remain active', () => {
            jest.useFakeTimers();
            virtualizer.setChannelCount(1);
            const channelId = 'ch-focused-episode-sliver';
            const start = gridAnchorTime;
            const end = start + (10 * 60000); // 40px rendered width

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    createProgram({ item: { ratingKey: 'focused-episode-sliver-1', type: 'episode', title: 'Episode With A Very Long Focused Subtitle', fullTitle: 'Prestige Show - S01E07 - Episode With A Very Long Focused Subtitle', showTitle: 'Prestige Show', seasonNumber: 1, episodeNumber: 7, durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start }),
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);
            virtualizer.setFocusedCell(channelId, start);
            jest.advanceTimersByTime(16);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            const title = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE}`) as HTMLElement;
            const titleText = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE_TEXT}`) as HTMLElement;
            const meta = cell.querySelector(`.${EPG_CLASSES.CELL_META}`) as HTMLElement;
            const episode = cell.querySelector(`.${EPG_CLASSES.CELL_EPISODE}`) as HTMLElement;
            const subtitle = cell.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE}`) as HTMLElement;
            const subtitleText = cell.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE_TEXT}`) as HTMLElement;
            const time = cell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement;

            Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 180 });
            stubRenderedWidth(titleText, 180);
            Object.defineProperty(title, 'clientWidth', { configurable: true, value: 40 });
            Object.defineProperty(subtitle, 'scrollWidth', { configurable: true, value: 200 });
            stubRenderedWidth(subtitleText, 200);
            Object.defineProperty(subtitle, 'clientWidth', { configurable: true, value: 40 });

            virtualizer.setFocusedCell(channelId, start);
            jest.advanceTimersByTime(16);

            expect(cell.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT)).toBe(true);
            expect(cell.classList.contains(EPG_CLASSES.SLIVER_CELL_CLASS)).toBe(false);
            expect(meta.style.display).toBe('flex');
            expect(episode.textContent).toBe('S01E07');
            expect(subtitle.style.display).toBe('block');
            expect(subtitle.textContent).toBe('Episode With A Very Long Focused Subtitle');
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
                    createProgram({ item: { ratingKey: 'focused-episode-no-show-title-1', type: 'episode', title: 'Standalone Episode Title', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start }),
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

            const program: ScheduledProgram = createProgram({ item: { ratingKey: 'pre-anchor-1', title: 'Pre Anchor Program', durationMs: 360 * 60000, year: 2026 }, scheduledStartTime: gridAnchorTime - (120 * 60000), scheduledEndTime: gridAnchorTime + (240 * 60000), remainingMs: 0 });

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
                    createProgram({ item: { ratingKey: 'ep1', type: 'episode', title: 'Episode One', fullTitle: 'Great Show - S01E01 - Episode One', durationMs: 3600000 }, scheduledStartTime: gridAnchorTime, scheduledEndTime: gridAnchorTime + 3600000, remainingMs: 3600000 }),
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
                    createProgram({ item: { ratingKey: 'movie1', title: 'Feature Film', durationMs: 1800000, year: 2021 }, scheduledStartTime: gridAnchorTime, scheduledEndTime: gridAnchorTime + 1800000, remainingMs: 1800000 }),
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
                    createProgram({ item: { ratingKey: 'ep-tag-1', type: 'episode', title: 'The Heist', fullTitle: 'Great Show - S01E05 - The Heist', showTitle: 'Great Show', seasonNumber: 1, episodeNumber: 5, durationMs: 3600000, year: 2026 }, scheduledStartTime: gridAnchorTime, scheduledEndTime: gridAnchorTime + 3600000, remainingMs: 0 }),
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
                    createProgram({ item: { ratingKey: 'ep-no-showtitle-1', type: 'episode', title: 'Episode One', durationMs: 60 * 60000, year: 2026 }, scheduledStartTime: gridAnchorTime, scheduledEndTime: gridAnchorTime + (60 * 60000), remainingMs: 0 }),
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
                    createProgram({ item: { ratingKey: 'ep-fulltitle-fallback-1', type: 'episode', title: 'Scavengers', fullTitle: 'Scavengers Reign - Scavengers', durationMs: 60 * 60000, year: 2026 }, scheduledStartTime: gridAnchorTime, scheduledEndTime: gridAnchorTime + (60 * 60000), remainingMs: 0 }),
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
                    createProgram({ item: { ratingKey: 'tiny-1', title: 'Tiny Program', durationMs: 20 * 60000, year: 2026 }, scheduledStartTime: gridAnchorTime, scheduledEndTime: gridAnchorTime + (20 * 60000), remainingMs: 0 }),
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
                    createProgram({ item: { ratingKey: 'wide-ep', type: 'episode', title: 'Wide Episode', fullTitle: 'Boundary Show - S01E01 - Wide Episode', durationMs: 55 * 60000, year: 2026 }, scheduledStartTime: gridAnchorTime, scheduledEndTime: gridAnchorTime + (55 * 60000), remainingMs: 0 }),
                    createProgram({ item: { ratingKey: 'medium-ep', type: 'episode', title: 'Medium Episode', fullTitle: 'Boundary Show - S01E02 - Medium Episode', durationMs: 35 * 60000, year: 2026, scheduledIndex: 1 }, scheduledStartTime: gridAnchorTime + (55 * 60000), scheduledEndTime: gridAnchorTime + (90 * 60000), remainingMs: 0, scheduleIndex: 1 }),
                    createProgram({ item: { ratingKey: 'narrow-ep', type: 'episode', title: 'Narrow Episode', fullTitle: 'Boundary Show - S01E03 - Narrow Episode', durationMs: 22 * 60000, year: 2026, scheduledIndex: 2 }, scheduledStartTime: gridAnchorTime + (90 * 60000), scheduledEndTime: gridAnchorTime + (112 * 60000), remainingMs: 0, scheduleIndex: 2 }),
                    createProgram({ item: { ratingKey: 'tiny-ep', type: 'episode', title: 'Tiny Episode', fullTitle: 'Boundary Show - S01E04 - Tiny Episode', durationMs: 20 * 60000, year: 2026, scheduledIndex: 3 }, scheduledStartTime: gridAnchorTime + (112 * 60000), scheduledEndTime: gridAnchorTime + (132 * 60000), remainingMs: 0, scheduleIndex: 3 }),
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
            expect((mediumCell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement).style.display).toBe('none');

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

        it('renders retrying placeholders while a manual attempt is active', () => {
            const channelIds = ['ch0'];
            const schedules = new Map<string, ScheduleWindow>();

            virtualizer.setChannelCount(1);
            const range = virtualizer.calculateVisibleRange({
                channelOffset: 0,
                timeOffset: 0,
            });
            virtualizer.renderVisibleCells(channelIds, schedules, range, undefined, Date.now(), new Map([
                ['ch0', { kind: 'retrying', rangeKey: 'day' }],
            ]));

            const title = container.querySelector('.epg-cell-title');
            expect(title?.textContent).toBe('Retrying...');
        });

        it('renders unavailable rows as focusable non-shimmering retry actions', () => {
            const channelIds = ['ch0'];
            const schedules = new Map<string, ScheduleWindow>();

            virtualizer.setChannelCount(1);
            const range = virtualizer.calculateVisibleRange({
                channelOffset: 0,
                timeOffset: 0,
            });
            virtualizer.renderVisibleCells(channelIds, schedules, range, undefined, Date.now(), new Map([
                ['ch0', { kind: 'unavailable', rangeKey: 'day' }],
            ]));

            const cell = container.querySelector('.epg-cell') as HTMLElement | null;
            const title = container.querySelector('.epg-cell-title');
            expect(title?.textContent).toBe('Unavailable — OK to retry');
            expect(cell?.classList.contains(EPG_CLASSES.CELL_UNAVAILABLE)).toBe(true);
            expect(cell?.classList.contains(EPG_CLASSES.CELL_LOADING)).toBe(false);

            const focusTimeMs = gridAnchorTime + (30 * 60000);
            const focused = virtualizer.setFocusedCell('ch0', focusTimeMs, focusTimeMs);
            expect(focused).not.toBeNull();
            expect(focused?.classList.contains('focused')).toBe(true);
        });

        it('renders a ready schedule instead of a stale unavailable lifecycle', () => {
            const channelIds = ['ch0'];
            const schedules = new Map<string, ScheduleWindow>([
                ['ch0', {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + (3 * 60 * 60000),
                    programs: [createProgram()],
                }],
            ]);

            virtualizer.setChannelCount(1);
            const range = virtualizer.calculateVisibleRange({
                channelOffset: 0,
                timeOffset: 0,
            });
            virtualizer.renderVisibleCells(channelIds, schedules, range, undefined, Date.now(), new Map([
                ['ch0', { kind: 'unavailable', rangeKey: 'day' }],
            ]));

            expect(container.querySelector('.epg-cell-title')?.textContent).toBe('Program');
            expect(container.querySelector(`.${EPG_CLASSES.CELL_UNAVAILABLE}`)).toBeNull();
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
                createProgram({ item: { ratingKey: 'ch0-1', title: 'Program 1', durationMs: 1800000 }, scheduledStartTime: gridAnchorTime + (60 * 60000), scheduledEndTime: gridAnchorTime + (90 * 60000), remainingMs: 1800000 }),
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
                programs.push(createProgram({ item: { ratingKey: `${channelId}-${minute}`, title: `Program ${minute}`, durationMs: 60_000, year: 2026, scheduledIndex: minute }, scheduledStartTime: gridAnchorTime + (minute * 60_000), scheduledEndTime: gridAnchorTime + ((minute + 1) * 60_000), remainingMs: 60_000, scheduleIndex: minute }));
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
                    programs.push(createProgram({ item: { ratingKey: `${channelId}-${minute}`, title: `Program ${minute}`, durationMs: 60_000, year: 2026, scheduledIndex: minute }, scheduledStartTime: gridAnchorTime + (minute * 60_000), scheduledEndTime: gridAnchorTime + ((minute + 1) * 60_000), remainingMs: 60_000, scheduleIndex: minute }));
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
            expect(container.querySelector(`[data-key="row-0-${gridAnchorTime + (299 * 60_000)}"]`)).not.toBeNull();
            expect(container.querySelector(`[data-key="row-6-${gridAnchorTime + (120 * 60_000)}"]`)).not.toBeNull();
            expect(container.querySelector(`[data-key="row-6-${gridAnchorTime}"]`)).toBeNull();
        });

        it('caps sampled visible queue cells to the per-row limit', () => {
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
                    programs.push(createProgram({ item: { ratingKey: `${channelId}-${minute}`, title: `Program ${minute}`, durationMs: 60_000, year: 2026, scheduledIndex: minute }, scheduledStartTime: gridAnchorTime + (minute * 60_000), scheduledEndTime: gridAnchorTime + ((minute + 1) * 60_000), remainingMs: 60_000, scheduleIndex: minute }));
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
                    programs.push(createProgram({ item: { ratingKey: `${channelId}-${minute}`, title: `Program ${minute}`, durationMs: 60_000, year: 2026, scheduledIndex: minute }, scheduledStartTime: gridAnchorTime + (minute * 60_000), scheduledEndTime: gridAnchorTime + ((minute + 1) * 60_000), remainingMs: 60_000, scheduleIndex: minute }));
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
                    programs.push(createProgram({ item: { ratingKey: `${channelId}-${slot}`, title: `Program ${slot}`, durationMs: 1800000, scheduledIndex: slot }, scheduledStartTime: gridAnchorTime + (slot * 30 * 60000), scheduledEndTime: gridAnchorTime + ((slot + 1) * 30 * 60000), remainingMs: 1800000, scheduleIndex: slot }));
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
                    programs.push(createProgram({ item: { ratingKey: `${channelId}-${slot}`, title: `Program ${slot}`, durationMs: 3600000, scheduledIndex: slot }, scheduledStartTime: gridAnchorTime + (slot * 60 * 60000), scheduledEndTime: gridAnchorTime + ((slot + 1) * 60 * 60000), remainingMs: 3600000, scheduleIndex: slot }));
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
                programs: [createProgram({ item: { ratingKey: 'rail-1', type: 'episode', title: 'Pilot', fullTitle: 'Great Show - S01E01 - Pilot', showTitle: 'Great Show', seasonNumber: 1, episodeNumber: 1, durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start })],
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
                programs: [createProgram({ item: { ratingKey: 'current-1', title: 'Current Program', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - now })],
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
                    createProgram({ item: { ratingKey: 'ep-subtitle-1', type: 'episode', title: 'The Heist', fullTitle: 'Great Show - S01E05 - The Heist', showTitle: 'Great Show', seasonNumber: 1, episodeNumber: 5, durationMs: narrowEnd - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: narrowEnd, remainingMs: narrowEnd - start }),
                    createProgram({ item: { ratingKey: 'ep-subtitle-2', type: 'episode', title: 'The Heist', fullTitle: 'Great Show - S01E05 - The Heist', showTitle: 'Great Show', seasonNumber: 1, episodeNumber: 5, durationMs: tinyEnd - tinyStart, year: 2026, scheduledIndex: 1 }, scheduledStartTime: tinyStart, scheduledEndTime: tinyEnd, remainingMs: tinyEnd - tinyStart, scheduleIndex: 1 }),
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
                    createProgram({ item: { ratingKey: 'ep-focused-1', type: 'episode', title: 'The Edge Of Recovery', fullTitle: 'Great Show - S01E09 - The Edge Of Recovery', showTitle: 'Great Show', seasonNumber: 1, episodeNumber: 9, durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start }),
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
            const episode = cell.querySelector(`.${EPG_CLASSES.CELL_EPISODE}`) as HTMLElement;
            const meta = cell.querySelector(`.${EPG_CLASSES.CELL_META}`) as HTMLElement;
            expect(episode.textContent).toBe('S01E09');
            expect(meta.style.display).toBe('flex');
            expect(subtitle.textContent).toBe('The Edge Of Recovery');
            expect(subtitle.style.display).toBe('block');
            expect(time.style.display).toBe('none');
        });

        it('keeps focused episodes in compact mode even when they do not expose split lanes before focus', () => {
            jest.useFakeTimers();
            virtualizer.setChannelCount(1);
            const channelId = 'ch-focused-episode-no-split';
            const start = gridAnchorTime;
            const end = start + (20 * 60000); // tiny tier at 4px/min => 80px

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    createProgram({ item: { ratingKey: 'ep-focused-no-split-1', type: 'episode', title: 'Episode Without Split Lanes', showTitle: '', seasonNumber: 1, episodeNumber: 2, durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start }),
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            const title = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE}`) as HTMLElement;
            const titleText = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE_TEXT}`) as HTMLElement;
            const subtitle = cell.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE}`) as HTMLElement;
            const time = cell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement;
            Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 320 });
            stubRenderedWidth(titleText, 320);
            Object.defineProperty(title, 'clientWidth', { configurable: true, value: 80 });
            Object.defineProperty(title, 'scrollHeight', { configurable: true, value: 40 });
            Object.defineProperty(title, 'clientHeight', { configurable: true, value: 40 });

            virtualizer.setFocusedCell(channelId, start);
            jest.advanceTimersByTime(16);

            expect(cell.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT)).toBe(true);
            const meta = cell.querySelector(`.${EPG_CLASSES.CELL_META}`) as HTMLElement;
            const episode = cell.querySelector(`.${EPG_CLASSES.CELL_EPISODE}`) as HTMLElement;
            expect(meta.style.display).toBe('flex');
            expect(episode.textContent).toBe('S01E02');
            expect(subtitle.textContent).toBe('');
            expect(subtitle.style.display).toBe('none');
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
                    createProgram({ item: { ratingKey: 'movie-focused-1', title: 'The Square', fullTitle, durationMs: end - start, year: 2017 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start }),
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
                    programs: [createProgram({ item: { ratingKey: 'ticker-1', title: 'An Extremely Long Program Title That Must Overflow', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start })],
                };

                virtualizer.setChannelCount(1);
                const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
                virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

                const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
                const title = cell.querySelector('.epg-cell-title') as HTMLElement;
                const titleText = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE_TEXT}`) as HTMLElement;

                Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 300 });
                stubRenderedWidth(titleText, 300);
                Object.defineProperty(title, 'clientWidth', { configurable: true, value: 80 });

                virtualizer.setFocusedCell(channelId, start);
                jest.advanceTimersByTime(16);

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
                const start = gridAnchorTime - 20 * 60 * 1000;
                const end = gridAnchorTime + 20 * 60 * 1000;

                const schedule: ScheduleWindow = {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                    programs: [createProgram({ item: { ratingKey: 'ticker-disabled-1', title: 'A Focused Title That Would Normally Overflow', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start })],
                };

                virtualizer.setChannelCount(1);
                const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 10 });
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

        it('keeps fitting focused movie title ticker state idempotent across repeated render and focus sync', () => {
            jest.useFakeTimers();
            try {
                const channelId = 'ch-fitting-movie-ticker';
                const start = gridAnchorTime;
                const end = start + 60 * 60 * 1000;
                const focusedKey = `${channelId}-${start}`;
                const schedule: ScheduleWindow = {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                    programs: [createProgram({ item: { ratingKey: 'fitting-movie-ticker-1', title: 'Fitting Movie', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start })],
                };

                virtualizer.setChannelCount(1);
                const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
                const schedules = new Map([[channelId, schedule]]);
                virtualizer.renderVisibleCells([channelId], schedules, range);

                const cell = container.querySelector(`[data-key="${focusedKey}"]`) as HTMLElement;
                const title = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE}`) as HTMLElement;
                const titleText = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE_TEXT}`) as HTMLElement;
                Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 120 });
                Object.defineProperty(title, 'clientWidth', { configurable: true, value: 200 });
                Object.defineProperty(title, 'scrollHeight', { configurable: true, value: 24 });
                Object.defineProperty(title, 'clientHeight', { configurable: true, value: 24 });
                stubRenderedWidth(titleText, 120);

                virtualizer.setFocusedCell(channelId, start);
                title.classList.add(EPG_CLASSES.CELL_TITLE_TICKER_READY, EPG_CLASSES.CELL_TITLE_TICKER_RUNNING);
                title.style.setProperty('--epg-title-ticker-distance-px', '80px');
                title.style.setProperty('--epg-title-ticker-duration-ms', '2400ms');

                virtualizer.renderVisibleCells([channelId], schedules, range, focusedKey);
                virtualizer.setFocusedCell(channelId, start);
                jest.advanceTimersByTime(900);

                expect(title.classList.contains(EPG_CLASSES.CELL_TITLE_TICKER_READY)).toBe(false);
                expect(title.classList.contains(EPG_CLASSES.CELL_TITLE_TICKER_RUNNING)).toBe(false);
                expect(title.style.getPropertyValue('--epg-title-ticker-distance-px')).toBe('');
                expect(title.style.getPropertyValue('--epg-title-ticker-duration-ms')).toBe('');
            } finally {
                jest.useRealTimers();
            }
        });

        it('keeps fitting focused episode title and subtitle ticker state idempotent across repeated render and focus sync', () => {
            jest.useFakeTimers();
            try {
                const channelId = 'ch-fitting-episode-ticker';
                const start = gridAnchorTime;
                const end = start + 60 * 60 * 1000;
                const focusedKey = `${channelId}-${start}`;
                const schedule: ScheduleWindow = {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                    programs: [createProgram({ item: { ratingKey: 'fitting-episode-ticker-1', type: 'episode', title: 'Readable Episode', fullTitle: 'Readable Show - S01E04 - Readable Episode', showTitle: 'Readable Show', seasonNumber: 1, episodeNumber: 4, durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start })],
                };

                virtualizer.setChannelCount(1);
                const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
                const schedules = new Map([[channelId, schedule]]);
                virtualizer.renderVisibleCells([channelId], schedules, range);

                const cell = container.querySelector(`[data-key="${focusedKey}"]`) as HTMLElement;
                const title = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE}`) as HTMLElement;
                const titleText = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE_TEXT}`) as HTMLElement;
                const subtitle = cell.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE}`) as HTMLElement;
                const subtitleText = cell.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE_TEXT}`) as HTMLElement;
                Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 130 });
                Object.defineProperty(title, 'clientWidth', { configurable: true, value: 200 });
                Object.defineProperty(title, 'scrollHeight', { configurable: true, value: 24 });
                Object.defineProperty(title, 'clientHeight', { configurable: true, value: 24 });
                stubRenderedWidth(titleText, 130);
                Object.defineProperty(subtitle, 'scrollWidth', { configurable: true, value: 150 });
                Object.defineProperty(subtitle, 'clientWidth', { configurable: true, value: 200 });
                stubRenderedWidth(subtitleText, 150);

                virtualizer.setFocusedCell(channelId, start);
                expect(subtitle.textContent).toBe('Readable Episode');
                expect(subtitle.textContent).not.toContain('S01E04');
                title.classList.add(EPG_CLASSES.CELL_TITLE_TICKER_READY, EPG_CLASSES.CELL_TITLE_TICKER_RUNNING);
                subtitle.classList.add(EPG_CLASSES.CELL_SUBTITLE_TICKER_READY, EPG_CLASSES.CELL_SUBTITLE_TICKER_RUNNING);
                title.style.setProperty('--epg-title-ticker-distance-px', '80px');
                subtitle.style.setProperty('--epg-subtitle-ticker-distance-px', '90px');

                virtualizer.renderVisibleCells([channelId], schedules, range, focusedKey);
                virtualizer.setFocusedCell(channelId, start);
                jest.advanceTimersByTime(900);

                expect(title.classList.contains(EPG_CLASSES.CELL_TITLE_TICKER_READY)).toBe(false);
                expect(title.classList.contains(EPG_CLASSES.CELL_TITLE_TICKER_RUNNING)).toBe(false);
                expect(subtitle.classList.contains(EPG_CLASSES.CELL_SUBTITLE_TICKER_READY)).toBe(false);
                expect(subtitle.classList.contains(EPG_CLASSES.CELL_SUBTITLE_TICKER_RUNNING)).toBe(false);
                expect(title.style.getPropertyValue('--epg-title-ticker-distance-px')).toBe('');
                expect(subtitle.style.getPropertyValue('--epg-subtitle-ticker-distance-px')).toBe('');
            } finally {
                jest.useRealTimers();
            }
        });

        it('uses actual content width for shifted focused cells', () => {
            jest.useFakeTimers();
            try {
                const channelId = 'ch-ticker-text-shift';
                const start = gridAnchorTime;
                const end = start + 20 * 60 * 1000;

                const schedule: ScheduleWindow = {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                    programs: [createProgram({ item: { ratingKey: 'ticker-text-shift-1', title: 'Long Title That Requires Text Shift To Overflow', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start })],
                };

                virtualizer.setChannelCount(1);
                const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
                virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

                const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
                const title = cell.querySelector('.epg-cell-title') as HTMLElement;
                const titleText = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE_TEXT}`) as HTMLElement;

                Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 110 });
                stubRenderedWidth(titleText, 110);
                Object.defineProperty(title, 'clientWidth', { configurable: true, value: 100 });

                virtualizer.setFocusedCell(channelId, start);
                jest.advanceTimersByTime(16);

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
                const start = gridAnchorTime - 20 * 60 * 1000;
                const end = gridAnchorTime + 20 * 60 * 1000;

                const schedule: ScheduleWindow = {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                    programs: [createProgram({ item: { ratingKey: 'ticker-ready-1', title: 'A Very Long Title That Must Scroll In Tiny Tier', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start })],
                };

                virtualizer.setChannelCount(1);
                const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
                virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

                const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
                const title = cell.querySelector('.epg-cell-title') as HTMLElement;
                Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 320 });
                Object.defineProperty(title, 'clientWidth', { configurable: true, value: 80 });

                virtualizer.setFocusedCell(channelId, start, undefined, { syncTicker: false });

                const focusedTitle = (container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement)
                    .querySelector('.epg-cell-title') as HTMLElement;
                const focusedTitleText = focusedTitle.querySelector(`.${EPG_CLASSES.CELL_TITLE_TEXT}`) as HTMLElement;
                Object.defineProperty(focusedTitle, 'scrollWidth', { configurable: true, value: 320 });
                stubRenderedWidth(focusedTitleText, 320);
                Object.defineProperty(focusedTitle, 'clientWidth', { configurable: true, value: 80 });
                virtualizer.setFocusedCell(channelId, start);
                jest.advanceTimersByTime(16);

                expect(focusedTitle.classList.contains('epg-cell-title-ticker-ready')).toBe(true);
                expect(focusedTitle.classList.contains('epg-cell-title-ticker-running')).toBe(false);
                jest.advanceTimersByTime(899);
                expect(focusedTitle.classList.contains('epg-cell-title-ticker-running')).toBe(false);
            } finally {
                jest.useRealTimers();
            }
        });

        it('starts focused ticker when tiny-tier title is hidden by line clamp without horizontal overflow', () => {
            jest.useFakeTimers();
            try {
                const channelId = 'ch-ticker-clamp-only';
                const start = gridAnchorTime;
                const end = gridAnchorTime + 20 * 60 * 1000;

                const schedule: ScheduleWindow = {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                    programs: [createProgram({ item: { ratingKey: 'ticker-clamp-only-1', title: 'Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start })],
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

                virtualizer.setFocusedCell(channelId, start, undefined, { syncTicker: false });
                const focusedTitle = (container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement)
                    .querySelector('.epg-cell-title') as HTMLElement;
                Object.defineProperty(focusedTitle, 'scrollWidth', {
                    configurable: true,
                    get: () => focusedTitle.classList.contains(EPG_CLASSES.CELL_TITLE_TICKER_READY) ? 220 : 80,
                });
                Object.defineProperty(focusedTitle, 'clientWidth', { configurable: true, value: 80 });
                Object.defineProperty(focusedTitle, 'scrollHeight', { configurable: true, value: 60 });
                Object.defineProperty(focusedTitle, 'clientHeight', { configurable: true, value: 40 });
                virtualizer.setFocusedCell(channelId, start);
                jest.advanceTimersByTime(16);

                expect(focusedTitle.classList.contains('epg-cell-title-ticker-ready')).toBe(true);
                expect(focusedTitle.classList.contains('epg-cell-title-ticker-running')).toBe(false);
                expect(focusedTitle.style.getPropertyValue('--epg-title-ticker-distance-px')).toBe('140px');

                jest.advanceTimersByTime(900);
                expect(focusedTitle.classList.contains('epg-cell-title-ticker-running')).toBe(true);
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
                    programs: [createProgram({ item: { ratingKey: 'ep-focused-ticker-1', type: 'episode', title: episodeTitle, fullTitle: `${showTitle} - S01E09 - ${episodeTitle}`, showTitle, seasonNumber: 1, episodeNumber: 9, durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: mid, remainingMs: mid - start }), createProgram({ item: { ratingKey: 'ep-focused-ticker-2', title: 'Second Focus Target', durationMs: end - mid, year: 2026, scheduledIndex: 1 }, scheduledStartTime: mid, scheduledEndTime: end, remainingMs: end - mid, scheduleIndex: 1 })],
                };

                virtualizer.setChannelCount(1);
                const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
                virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

                virtualizer.setFocusedCell(channelId, start, undefined, { syncTicker: false });
                const focusedCell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
                const title = focusedCell.querySelector('.epg-cell-title') as HTMLElement;
                const titleText = focusedCell.querySelector(`.${EPG_CLASSES.CELL_TITLE_TEXT}`) as HTMLElement;
                const subtitle = focusedCell.querySelector('.epg-cell-subtitle') as HTMLElement;
                const subtitleText = focusedCell.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE_TEXT}`) as HTMLElement;
                Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 320 });
                stubRenderedWidth(titleText, 320);
                Object.defineProperty(title, 'clientWidth', { configurable: true, value: 80 });
                Object.defineProperty(subtitle, 'scrollWidth', { configurable: true, value: 360 });
                stubRenderedWidth(subtitleText, 360);
                Object.defineProperty(subtitle, 'clientWidth', { configurable: true, value: 80 });
                virtualizer.setFocusedCell(channelId, start);
                jest.advanceTimersByTime(16);

                expect(title.textContent).toBe(showTitle);
                expect(subtitle.textContent).toBe(episodeTitle);
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

        it('hides the in-cell time on focused medium-width movie cells', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-focused-movie-medium-time-hidden';
            const start = gridAnchorTime;
            const end = start + (40 * 60000); // medium tier at 4px/min => 160px

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    createProgram({ item: { ratingKey: 'movie-medium-1', title: 'Medium Focus Movie', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start }),
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);
            virtualizer.setFocusedCell(channelId, start);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            expect(cell.classList.contains(EPG_CLASSES.CELL_TIER_MEDIUM)).toBe(true);
            expect(cell.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT)).toBe(false);

            const time = cell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement;
            expect(time.style.display).toBe('none');
        });

        it('uses compact current dot for focused current medium movie overlay cells', () => {
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
                    createProgram({ item: { ratingKey: 'movie-medium-live-dot-1', title: 'Focused Medium Live Dot', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - beforeCurrent }),
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

        it('uses compact current badge for current sliver cells even when they are not narrow or focused-compact', () => {
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
                    programs: [createProgram({ item: { ratingKey: 'sliver-live-1', title: 'Current Sliver Program', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, elapsedMs: now - start, remainingMs: end - now })],
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

        it('keeps current wide cells on the compact live dot across visible-width changes', () => {
            const now = gridAnchorTime + 5 * 60 * 1000;
            jest.spyOn(Date, 'now').mockReturnValue(now);

            virtualizer.setChannelCount(1);
            const channelId = 'ch-current-wide-partial-live';
            const start = gridAnchorTime;
            const end = start + (60 * 60 * 1000); // wide tier at 4px/min => 240px
            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [createProgram({ item: { ratingKey: 'current-wide-partial-live-1', title: 'Current Wide Partial Live', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, elapsedMs: now - start, remainingMs: end - now })],
            };
            const schedules = new Map<string, ScheduleWindow>([[channelId, schedule]]);
            const key = `${channelId}-${start}`;

            const fullRange = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], schedules, fullRange, undefined, now);

            const firstCell = container.querySelector(`[data-key="${key}"]`) as HTMLElement;
            const badge = firstCell.querySelector(`.${EPG_CLASSES.LIVE_BADGE}`) as HTMLElement;
            expect(firstCell.classList.contains(EPG_CLASSES.CELL_TIER_WIDE)).toBe(true);
            expect(firstCell.classList.contains(EPG_CLASSES.SLIVER_CELL_CLASS)).toBe(false);
            expect(badge.hidden).toBe(false);
            expect(badge.classList.contains(EPG_CLASSES.CELL_LIVE_COMPACT)).toBe(true);
            expect(badge.textContent).toBe('');
            expect(badge.getAttribute('aria-label')).toBe('Currently playing');

            const partialRange = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 44 });
            virtualizer.renderVisibleCells([channelId], schedules, partialRange, undefined, now);

            const secondCell = container.querySelector(`[data-key="${key}"]`) as HTMLElement;
            expect(secondCell).toBe(firstCell);
            expect(secondCell.classList.contains(EPG_CLASSES.CELL_TIER_WIDE)).toBe(true);
            expect(secondCell.classList.contains(EPG_CLASSES.SLIVER_CELL_CLASS)).toBe(false);
            expect(secondCell.style.width).toBe('240px');
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
                    createProgram({ item: { ratingKey: 'episode-wide-1', type: 'episode', title: 'A Day At The Shore', fullTitle: 'Great Show - S01E03 - A Day At The Shore', showTitle: 'Great Show', seasonNumber: 1, episodeNumber: 3, durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start }),
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
            const episode = cell.querySelector(`.${EPG_CLASSES.CELL_EPISODE}`) as HTMLElement;
            expect(title.textContent).toBe('Great Show');
            expect(episode.textContent).toBe('S01E03');
            expect(subtitle.textContent).toBe('A Day At The Shore');
            expect(meta.style.display).toBe('flex');
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
                    programs: [createProgram({ item: { ratingKey: 'ticker-small-overflow-1', title: 'Borderline Overflow Title', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start })],
                };

                virtualizer.setChannelCount(1);
                const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
                virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

                virtualizer.setFocusedCell(channelId, start, undefined, { syncTicker: false });
                const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
                const title = cell.querySelector('.epg-cell-title') as HTMLElement;
                const titleText = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE_TEXT}`) as HTMLElement;
                Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 88 });
                stubRenderedWidth(titleText, 88);
                Object.defineProperty(title, 'clientWidth', { configurable: true, value: 80 });
                virtualizer.setFocusedCell(channelId, start);
                jest.advanceTimersByTime(16);

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
                    programs: [createProgram({ item: { ratingKey: 'zero-width-focused-ticker-1', title: 'Zero Width Focused Ticker Title', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start })],
                };

                virtualizer.setChannelCount(1);
                const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 30 });
                virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

                const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
                const title = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE}`) as HTMLElement;

                Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 300 });
                Object.defineProperty(title, 'clientWidth', { configurable: true, value: 80 });

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
                const start = gridAnchorTime + 100 * 60 * 1000;
                const end = start + 25 * 60 * 1000;

                const schedule: ScheduleWindow = {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                    programs: [createProgram({ item: { ratingKey: 'right-clip-focused-ticker-1', title: 'Right Clip Ticker Title', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start })],
                };

                virtualizer.setChannelCount(1);
                const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
                virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

                const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
                const title = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE}`) as HTMLElement;
                const titleText = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE_TEXT}`) as HTMLElement;

                Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 115 });
                stubRenderedWidth(titleText, 115);
                Object.defineProperty(title, 'clientWidth', { configurable: true, value: 80 });

                virtualizer.setFocusedCell(channelId, start);
                jest.advanceTimersByTime(16);

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
                programs: [createProgram({ item: { ratingKey: 'ep-normalized-show-title-1', type: 'episode', title: 'S01E09 - The Edge Of Recovery', fullTitle: 'Great Show - The Edge Of Recovery', showTitle: '', seasonNumber: 1, episodeNumber: 9, durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start })],
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
                    programs: [createProgram({ item: { ratingKey: 'ticker-reduce-1', title: 'An Extremely Long Program Title That Must Overflow', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start })],
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
                        createProgram({ item: { ratingKey: 'ticker-a', title: 'Overflow A Overflow A Overflow A', durationMs: mid - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: mid, remainingMs: mid - start }),
                        createProgram({ item: { ratingKey: 'ticker-b', title: 'Second Program', durationMs: end - mid, year: 2026, scheduledIndex: 1 }, scheduledStartTime: mid, scheduledEndTime: end, remainingMs: end - mid, scheduleIndex: 1 }),
                    ],
                };

                virtualizer.setChannelCount(1);
                const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
                virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

                const firstCell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
                const firstTitle = firstCell.querySelector('.epg-cell-title') as HTMLElement;
                const firstTitleText = firstCell.querySelector(`.${EPG_CLASSES.CELL_TITLE_TEXT}`) as HTMLElement;
                Object.defineProperty(firstTitle, 'scrollWidth', { configurable: true, value: 260 });
                stubRenderedWidth(firstTitleText, 260);
                Object.defineProperty(firstTitle, 'clientWidth', { configurable: true, value: 80 });

                virtualizer.setFocusedCell(channelId, start);
                jest.advanceTimersByTime(16);
                jest.advanceTimersByTime(900);
                expect(firstTitle.classList.contains('epg-cell-title-ticker-running')).toBe(true);

                virtualizer.setFocusedCell(channelId, mid);
                expect(firstTitle.classList.contains('epg-cell-title-ticker-running')).toBe(false);
                expect(firstTitle.style.transform).toBe('');
            } finally {
                jest.useRealTimers();
            }
        });

        it('compacts current badge to dot for current narrow/tiny cells when not focused', () => {
            const now = gridAnchorTime + 5 * 60 * 1000;
            jest.spyOn(Date, 'now').mockReturnValue(now);
            const channelId = 'ch-live-dot';
            const start = gridAnchorTime;
            const end = gridAnchorTime + 20 * 60 * 1000;
            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                programs: [createProgram({ item: { ratingKey: 'live-compact-1', title: 'Live Program', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - now })],
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

        it('keeps current state without rendering per-cell progress', () => {
            const channelId = 'ch-progress-current';
            const start = gridAnchorTime;
            const end = gridAnchorTime + 20 * 60 * 1000;
            jest.spyOn(Date, 'now').mockReturnValue(start + 5 * 60_000);

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60 * 1000),
                programs: [createProgram({ item: { ratingKey: 'progress-current-1', title: 'Current Program', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - (start + 5 * 60_000) })],
            };

            virtualizer.setChannelCount(1);
            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            expect(cell.classList.contains(EPG_CLASSES.CELL_CURRENT)).toBe(true);
            expect(cell.querySelector('.epg-cell-progress')).toBeNull();
        });

        it('uses provided nowMs snapshot for current-state calculations', () => {
            const channelId = 'ch-progress-now-snapshot';
            const start = gridAnchorTime;
            const end = gridAnchorTime + 20 * 60 * 1000;
            // If renderVisibleCells accidentally reads Date.now() internally, it will treat this as non-current.
            jest.spyOn(Date, 'now').mockReturnValue(start - 5 * 60_000);

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60 * 1000),
                programs: [createProgram({ item: { ratingKey: 'progress-now-snapshot-1', title: 'Snapshot Program', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - (start + 5 * 60_000) })],
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
            expect(cell.classList.contains(EPG_CLASSES.CELL_CURRENT)).toBe(true);
            expect((cell.querySelector(`.${EPG_CLASSES.LIVE_BADGE}`) as HTMLElement).hidden).toBe(false);
        });

        it('updates current state without adding progress via temporal refresh', () => {
            const channelId = 'ch-progress-update';
            const start = gridAnchorTime + 10 * 60 * 1000;
            const end = start + 20 * 60 * 1000;
            const beforeCurrent = start - 5 * 60 * 1000;
            jest.spyOn(Date, 'now').mockReturnValue(beforeCurrent);

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60 * 1000),
                programs: [createProgram({ item: { ratingKey: 'progress-update-1', title: 'Temporal Progress Program', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - beforeCurrent })],
            };

            virtualizer.setChannelCount(1);
            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            virtualizer.updateTemporalClasses(start + 10 * 60_000);
            expect(cell.classList.contains(EPG_CLASSES.CELL_CURRENT)).toBe(true);
            expect(cell.querySelector('.epg-cell-progress')).toBeNull();
        });

        it('keeps row-aware title layout when a wide episode becomes current via temporal refresh', () => {
            const channelId = 'ch-row-aware-current-transition';
            const start = gridAnchorTime + 10 * 60 * 1000;
            const end = start + 80 * 60 * 1000;
            const beforeCurrent = start - 5 * 60 * 1000;
            jest.spyOn(Date, 'now').mockReturnValue(beforeCurrent);

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60 * 1000),
                programs: [createProgram({ item: { ratingKey: 'row-aware-current-transition-1', type: 'episode', title: 'Drive-In', fullTitle: 'That 70s Show - S01E08 - Drive-In', showTitle: 'That 70s Show', seasonNumber: 1, episodeNumber: 8, durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - beforeCurrent })],
            };

            virtualizer.setChannelCount(1);
            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            const badge = cell.querySelector(`.${EPG_CLASSES.LIVE_BADGE}`) as HTMLElement;

            expect(cell.classList.contains(EPG_CLASSES.CELL_TITLE_FULL_ROW)).toBe(true);
            expect(badge.hidden).toBe(true);

            virtualizer.updateTemporalClasses(start + 10 * 60_000);

            expect(cell.classList.contains(EPG_CLASSES.CELL_TITLE_FULL_ROW)).toBe(true);
            expect(cell.classList.contains(EPG_CLASSES.CELL_CURRENT)).toBe(true);
            expect(badge.hidden).toBe(false);
            expect(badge.classList.contains(EPG_CLASSES.CELL_LIVE_COMPACT)).toBe(true);
            expect(badge.textContent).toBe('');
        });

        it('shows current wide episode tags while constrained current tags stay hidden', () => {
            const now = gridAnchorTime + 10 * 60 * 1000;
            jest.spyOn(Date, 'now').mockReturnValue(now);
            virtualizer.setChannelCount(2);

            const wideChannelId = 'ch-current-wide-episode-tag';
            const mediumChannelId = 'ch-current-medium-episode-tag';
            const makeEpisodeProgram = (
                ratingKey: string,
                start: number,
                end: number
            ): ScheduledProgram => (createProgram({ item: { ratingKey, type: 'episode', title: 'Drive-In', fullTitle: 'That 70s Show - S01E08 - Drive-In', showTitle: 'That 70s Show', seasonNumber: 1, episodeNumber: 8, durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, elapsedMs: now - start, remainingMs: end - now }));

            const wideEnd = gridAnchorTime + 80 * 60 * 1000;
            const mediumEnd = gridAnchorTime + 40 * 60 * 1000;
            const schedules = new Map<string, ScheduleWindow>([
                [wideChannelId, {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                    programs: [makeEpisodeProgram('current-wide-episode-tag-1', gridAnchorTime, wideEnd)],
                }],
                [mediumChannelId, {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                    programs: [makeEpisodeProgram('current-medium-episode-tag-1', gridAnchorTime, mediumEnd)],
                }],
            ]);

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([wideChannelId, mediumChannelId], schedules, range, undefined, now);

            const wideCell = container.querySelector(`[data-key="${wideChannelId}-${gridAnchorTime}"]`) as HTMLElement;
            const wideBadge = wideCell.querySelector(`.${EPG_CLASSES.LIVE_BADGE}`) as HTMLElement;
            const wideMeta = wideCell.querySelector(`.${EPG_CLASSES.CELL_META}`) as HTMLElement;
            const wideEpisode = wideCell.querySelector(`.${EPG_CLASSES.CELL_EPISODE}`) as HTMLElement;
            expect(wideCell.classList.contains(EPG_CLASSES.CELL_TIER_WIDE)).toBe(true);
            expect(wideCell.classList.contains(EPG_CLASSES.CELL_TITLE_FULL_ROW)).toBe(true);
            expect(wideBadge.classList.contains(EPG_CLASSES.CELL_LIVE_COMPACT)).toBe(true);
            expect(wideBadge.textContent).toBe('');
            expect(wideMeta.style.display).toBe('flex');
            expect(wideEpisode.textContent).toBe('S01E08');

            const mediumCell = container.querySelector(`[data-key="${mediumChannelId}-${gridAnchorTime}"]`) as HTMLElement;
            const mediumBadge = mediumCell.querySelector(`.${EPG_CLASSES.LIVE_BADGE}`) as HTMLElement;
            const mediumMeta = mediumCell.querySelector(`.${EPG_CLASSES.CELL_META}`) as HTMLElement;
            const mediumEpisode = mediumCell.querySelector(`.${EPG_CLASSES.CELL_EPISODE}`) as HTMLElement;
            expect(mediumCell.classList.contains(EPG_CLASSES.CELL_TIER_MEDIUM)).toBe(true);
            expect(mediumBadge.classList.contains(EPG_CLASSES.CELL_LIVE_COMPACT)).toBe(true);
            expect(mediumBadge.textContent).toBe('');
            expect(mediumMeta.style.display).toBe('none');
            expect(mediumEpisode.textContent).toBe('S01E08');
        });

        it('moves a current program to past without adding progress', () => {
            const channelId = 'ch-progress-reset';
            const start = gridAnchorTime + 10 * 60 * 1000;
            const end = start + 20 * 60 * 1000;
            const beforeCurrent = start - 5 * 60 * 1000;
            jest.spyOn(Date, 'now').mockReturnValue(beforeCurrent);

            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60 * 1000),
                programs: [createProgram({ item: { ratingKey: 'progress-reset-1', title: 'Temporal Progress Reset Program', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - beforeCurrent })],
            };

            virtualizer.setChannelCount(1);
            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            virtualizer.updateTemporalClasses(start + 10 * 60_000);
            expect(cell.classList.contains(EPG_CLASSES.CELL_CURRENT)).toBe(true);

            virtualizer.updateTemporalClasses(end + 1);
            expect(cell.classList.contains(EPG_CLASSES.CELL_CURRENT)).toBe(false);
            expect(cell.classList.contains(EPG_CLASSES.CELL_PAST)).toBe(true);
            expect(cell.querySelector('.epg-cell-progress')).toBeNull();
        });

        it('keeps compact current dot when narrow/tiny cell is focused', () => {
            const now = gridAnchorTime + 5 * 60 * 1000;
            jest.spyOn(Date, 'now').mockReturnValue(now);
            const channelId = 'ch-live-focused';
            const start = gridAnchorTime;
            const end = gridAnchorTime + 20 * 60 * 1000;
            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + 24 * 60 * 60 * 1000,
                programs: [createProgram({ item: { ratingKey: 'live-focused-1', title: 'Focused Live Program', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - now })],
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

        it('keeps time hidden when a tiny movie cell is focused', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-time-focused';
            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    createProgram({ item: { ratingKey: 'tiny-time-focused', title: 'Tiny Movie Focus', durationMs: 20 * 60000, year: 2026 }, scheduledStartTime: gridAnchorTime, scheduledEndTime: gridAnchorTime + (20 * 60000), remainingMs: 0 }),
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range, `${channelId}-${gridAnchorTime}`);

            const cell = container.querySelector(`[data-key="${channelId}-${gridAnchorTime}"]`) as HTMLElement;
            const timeLine = cell.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement;

            expect(cell.classList.contains('epg-cell-tier-tiny')).toBe(true);
            expect(cell.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT)).toBe(false);
            expect(timeLine.style.display).toBe('none');
        });

        it('keeps compact time styling and hides the time line for focused tiny movie cells', () => {
            virtualizer.setChannelCount(1);
            const channelId = 'ch-focus-update';
            const start = gridAnchorTime;
            const end = gridAnchorTime + (20 * 60000); // tiny tier at 4px/min => 80px
            const schedule: ScheduleWindow = {
                startTime: gridAnchorTime,
                endTime: gridAnchorTime + (24 * 60 * 60000),
                programs: [
                    createProgram({ item: { ratingKey: 'focus-update-1', title: 'Focus Update Program', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start }),
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
                    createProgram({ item: { ratingKey: 'current-update-1', title: 'Temporal Update Program', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - beforeCurrent }),
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
            jest.useFakeTimers();
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
                    createProgram({ item: { ratingKey: 'focused-compact-current-ticker-1', type: 'episode', title: 'The Episode With A Long Marquee Title', fullTitle: 'Prestige Show - S01E03 - The Episode With A Long Marquee Title', showTitle: 'Prestige Show', seasonNumber: 1, episodeNumber: 3, durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - beforeCurrent }),
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);
            virtualizer.setFocusedCell(channelId, start, beforeCurrent);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            const title = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE}`) as HTMLElement;
            const titleText = cell.querySelector(`.${EPG_CLASSES.CELL_TITLE_TEXT}`) as HTMLElement;
            const subtitle = cell.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE}`) as HTMLElement;
            const subtitleText = cell.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE_TEXT}`) as HTMLElement;
            const liveBadge = cell.querySelector(`.${EPG_CLASSES.LIVE_BADGE}`) as HTMLElement;

            expect(cell.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT)).toBe(true);
            expect(liveBadge.hidden).toBe(true);

            Object.defineProperty(title, 'scrollWidth', { configurable: true, value: 160 });
            stubRenderedWidth(titleText, 160);
            Object.defineProperty(title, 'clientWidth', {
                configurable: true,
                get: () => (liveBadge.hidden ? 100 : 92),
            });
            Object.defineProperty(subtitle, 'scrollWidth', { configurable: true, value: 40 });
            stubRenderedWidth(subtitleText, 40);
            Object.defineProperty(subtitle, 'clientWidth', { configurable: true, value: 100 });

            virtualizer.setFocusedCell(channelId, start, beforeCurrent);
            jest.advanceTimersByTime(16);
            expect(title.style.getPropertyValue('--epg-title-ticker-distance-px')).toBe('80px');

            virtualizer.updateTemporalClasses(start + (2 * 60000));

            expect(liveBadge.hidden).toBe(false);
            expect(title.style.getPropertyValue('--epg-title-ticker-distance-px')).toBe('80px');
        });

        it('keeps focused tiny movie time hidden while live dot overlays top-right', () => {
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
                    createProgram({ item: { ratingKey: 'focused-tiny-movie-overlay-1', title: 'Focused Tiny Movie Overlay', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - beforeCurrent }),
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
            expect(timeLine.style.display).toBe('none');

            virtualizer.updateTemporalClasses(start + (2 * 60000));

            expect(timeLine.style.display).toBe('none');
            expect(badge.hidden).toBe(false);
            expect(badge.classList.contains(EPG_CLASSES.CELL_LIVE_COMPACT)).toBe(true);
            expect(badge.textContent).toBe('');
        });

        it('uses compact current dot for current medium episodes in focused compact mode', () => {
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
                    createProgram({ item: { ratingKey: 'focused-episode-medium-live-dot-1', type: 'episode', title: 'The Compact Badge Episode', fullTitle: 'Prestige Show - S01E03 - The Compact Badge Episode', showTitle: 'Prestige Show', seasonNumber: 1, episodeNumber: 3, durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, elapsedMs: now - start, remainingMs: end - now }),
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

        it('recomputes current badge immediately when focus switches a current medium movie into overlay mode', () => {
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
                    createProgram({ item: { ratingKey: 'focused-movie-immediate-live-refresh-1', title: 'Immediate Badge Refresh', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, elapsedMs: now - start, remainingMs: end - now }),
                ],
            };

            const range = virtualizer.calculateVisibleRange({ channelOffset: 0, timeOffset: 0 });
            virtualizer.renderVisibleCells([channelId], new Map([[channelId, schedule]]), range);

            const cell = container.querySelector(`[data-key="${channelId}-${start}"]`) as HTMLElement;
            const badge = cell.querySelector(`.${EPG_CLASSES.LIVE_BADGE}`) as HTMLElement;

            expect(cell.classList.contains(EPG_CLASSES.CELL_TIER_MEDIUM)).toBe(true);
            expect(cell.classList.contains('epg-cell-focused-movie-overlay')).toBe(false);
            expect(badge.hidden).toBe(false);
            expect(badge.classList.contains(EPG_CLASSES.CELL_LIVE_COMPACT)).toBe(true);
            expect(badge.textContent).toBe('');

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
                        createProgram({ item: { ratingKey: 'focused-movie-only-1', title: 'Movie Overlay Owner', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start }),
                    ],
                }],
                [clipChannelId, {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + (24 * 60 * 60000),
                    programs: [
                        createProgram({ item: { ratingKey: 'focused-clip-no-movie-overlay-1', type: 'clip', title: 'Clip Should Stay Generic', durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start }),
                    ],
                }],
                [episodeChannelId, {
                    startTime: gridAnchorTime,
                    endTime: gridAnchorTime + (24 * 60 * 60000),
                    programs: [
                        createProgram({ item: { ratingKey: 'focused-episode-compact-1', type: 'episode', title: 'The Split Lane Episode', fullTitle: 'Prestige Show - S01E03 - The Split Lane Episode', showTitle: 'Prestige Show', seasonNumber: 1, episodeNumber: 3, durationMs: end - start, year: 2026 }, scheduledStartTime: start, scheduledEndTime: end, remainingMs: end - start }),
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
                programs: [createProgram({ item: { ratingKey: '1', title: 'Movie 1', durationMs: 7200000 }, scheduledStartTime: gridAnchorTime, scheduledEndTime: gridAnchorTime + 7200000, remainingMs: 7200000 })],
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
                    programs.push(createProgram({ item: { ratingKey: `${channelId}-${slot}`, title: `Program ${slot}`, durationMs: 1800000, scheduledIndex: slot }, scheduledStartTime: gridAnchorTime + (slot * 30 * 60000), scheduledEndTime: gridAnchorTime + ((slot + 1) * 30 * 60000), remainingMs: 1800000, scheduleIndex: slot }));
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
            const program: ScheduledProgram = createProgram({ item: { ratingKey: 'past-test', title: 'Past Test', durationMs: 1800000 }, scheduledStartTime: gridAnchorTime, scheduledEndTime: gridAnchorTime + (30 * 60000), remainingMs: 1800000 });
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
