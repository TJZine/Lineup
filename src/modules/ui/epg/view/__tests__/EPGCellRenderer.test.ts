/**
 * @jest-environment jsdom
 */

import { EPG_CLASSES } from '../../constants';
import type { ScheduledProgram } from '../../types';
import { EPGCellRenderer, type EPGRenderedCellData } from '../EPGCellRenderer';

type ProgramCellData = Extract<EPGRenderedCellData, { kind: 'program' }>;
type PlaceholderCellData = Extract<EPGRenderedCellData, { kind: 'placeholder' }>;

const TEST_START_MS = new Date('2026-01-07T12:00:00').getTime();
const FOCUSED_MOVIE_OVERLAY_CLASS = 'epg-cell-focused-movie-overlay';

const query = (element: HTMLElement, className: string): HTMLElement => {
    const match = element.querySelector(`.${className}`);
    if (!(match instanceof HTMLElement)) {
        throw new Error(`Expected .${className} in cell`);
    }
    return match;
};

const makeProgram = (options: {
    item?: Partial<ScheduledProgram['item']>;
    startTimeMs?: number;
    endTimeMs?: number;
} = {}): ScheduledProgram => {
    const startTimeMs = options.startTimeMs ?? TEST_START_MS;
    const endTimeMs = options.endTimeMs ?? startTimeMs + 60 * 60_000;
    const item: ScheduledProgram['item'] = {
        ratingKey: 'program-1',
        type: 'movie',
        title: 'Test Movie',
        fullTitle: 'Test Movie',
        durationMs: endTimeMs - startTimeMs,
        thumb: null,
        year: 2026,
        scheduledIndex: 0,
        ...options.item,
    };

    return {
        item,
        scheduledStartTime: startTimeMs,
        scheduledEndTime: endTimeMs,
        elapsedMs: 0,
        remainingMs: endTimeMs - startTimeMs,
        scheduleIndex: 0,
        loopNumber: 0,
        streamDescriptor: null,
        isCurrent: false,
    };
};

const makeProgramCell = (
    cellElement: HTMLElement,
    options: {
        key?: string;
        width?: number;
        visibleWidthPx?: number;
        isCurrent?: boolean;
        isPast?: boolean;
        isFocused?: boolean;
        textShiftPx?: number;
        program?: ScheduledProgram;
    } = {}
): ProgramCellData => {
    const width = options.width ?? 240;
    return {
        kind: 'program',
        key: options.key ?? 'program-cell',
        channelId: 'channel-1',
        rowIndex: 0,
        program: options.program ?? makeProgram(),
        left: 0,
        width,
        visibleWidthPx: options.visibleWidthPx ?? width,
        isPartial: false,
        isCurrent: options.isCurrent ?? false,
        isPast: options.isPast ?? false,
        isFocused: options.isFocused ?? false,
        isBufferOnly: false,
        textShiftPx: options.textShiftPx ?? 0,
        cellElement,
    };
};

const makePlaceholderCell = (
    cellElement: HTMLElement,
    options: {
        width?: number;
        visibleWidthPx?: number;
        isFocused?: boolean;
        textShiftPx?: number;
    } = {}
): PlaceholderCellData => {
    const width = options.width ?? 180;
    return {
        kind: 'placeholder',
        key: 'placeholder-cell',
        channelId: 'channel-1',
        rowIndex: 0,
        placeholder: {
            label: 'Loading schedule',
            scheduledStartTime: TEST_START_MS,
            scheduledEndTime: TEST_START_MS + 30 * 60_000,
        },
        left: 0,
        width,
        visibleWidthPx: options.visibleWidthPx ?? width,
        isPartial: false,
        isCurrent: false,
        isPast: false,
        isFocused: options.isFocused ?? false,
        isBufferOnly: false,
        textShiftPx: options.textShiftPx ?? 0,
        cellElement,
    };
};

const stubDimension = (element: HTMLElement, property: keyof HTMLElement, value: number): void => {
    Object.defineProperty(element, property, {
        configurable: true,
        get: () => value,
    });
};

describe('EPGCellRenderer', () => {
    let renderer: EPGCellRenderer;

    beforeEach(() => {
        renderer = new EPGCellRenderer();
        Object.defineProperty(globalThis, 'matchMedia', {
            configurable: true,
            writable: true,
            value: jest.fn().mockReturnValue({ matches: false }),
        });
    });

    afterEach(() => {
        renderer.clearFocusedTickers();
        document.body.innerHTML = '';
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('classifies width tiers at the public tier boundaries', () => {
        expect(renderer.getCellWidthTier(220)).toBe('wide');
        expect(renderer.getCellWidthTier(219)).toBe('medium');
        expect(renderer.getCellWidthTier(140)).toBe('medium');
        expect(renderer.getCellWidthTier(139)).toBe('narrow');
        expect(renderer.getCellWidthTier(88)).toBe('narrow');
        expect(renderer.getCellWidthTier(87)).toBe('tiny');
    });

    it('applies sliver presentation from visible width without changing cell content', () => {
        const element = renderer.createElement();
        const cellData = makeProgramCell(element, {
            width: 180,
            visibleWidthPx: 40,
            program: makeProgram({
                item: {
                    ratingKey: 'sliver-1',
                    title: 'Sliver Program',
                    fullTitle: 'Sliver Program',
                },
            }),
        });

        expect(renderer.isSliverCell(cellData)).toBe(true);

        renderer.updateCellContent(cellData, TEST_START_MS);

        expect(element.classList.contains(EPG_CLASSES.SLIVER_CELL_CLASS)).toBe(true);
        expect(element.classList.contains(EPG_CLASSES.CELL_TIER_MEDIUM)).toBe(true);
        expect(query(element, EPG_CLASSES.CELL_TITLE_TEXT).textContent).toBe('Sliver Program');
        expect(query(element, EPG_CLASSES.CELL_META).style.display).toBe('none');
        expect(query(element, EPG_CLASSES.CELL_SUBTITLE).style.display).toBe('none');
        expect(query(element, EPG_CLASSES.CELL_TIME).style.display).toBe('none');
    });

    it('computes visible text metrics and applies clamped text shift state', () => {
        const metrics = renderer.computeVisibleTextMetrics({
            rawLeftPx: -20,
            clippedLeftPx: 0,
            clippedWidthPx: 60,
            visibleWindowStartMinutes: 10,
            visibleWindowEndMinutes: 20,
            pixelsPerMinute: 4,
        });

        expect(metrics).toEqual({
            visibleLeftPx: 40,
            visibleRightPx: 60,
            visibleWidthPx: 20,
            safeTextShiftPx: 36,
            isLeftClippedByCell: true,
            isLeftClippedByScroll: true,
        });

        const element = renderer.createElement();
        renderer.updatePositionPresentation(makeProgramCell(element, {
            isCurrent: true,
            isPast: false,
            isFocused: true,
            textShiftPx: metrics.safeTextShiftPx,
        }));

        expect(element.classList.contains(EPG_CLASSES.CELL_TEXT_SHIFTED)).toBe(true);
        expect(element.style.getPropertyValue('--epg-cell-text-shift-px')).toBe('36px');
        expect(element.classList.contains(EPG_CLASSES.CELL_FOCUSED)).toBe(true);
        expect(element.classList.contains(EPG_CLASSES.CELL_CURRENT)).toBe(true);

        renderer.updatePositionPresentation(makeProgramCell(element, { textShiftPx: 0 }));

        expect(element.classList.contains(EPG_CLASSES.CELL_TEXT_SHIFTED)).toBe(false);
        expect(element.style.getPropertyValue('--epg-cell-text-shift-px')).toBe('');
        expect(element.classList.contains(EPG_CLASSES.CELL_FOCUSED)).toBe(false);
        expect(element.classList.contains(EPG_CLASSES.CELL_CURRENT)).toBe(false);
    });

    it('uses focused compact split-lane layout for episodes even when visible width is sliver-sized', () => {
        const element = renderer.createElement();
        const cellData = makeProgramCell(element, {
            width: 80,
            visibleWidthPx: 40,
            isFocused: true,
            program: makeProgram({
                item: {
                    ratingKey: 'episode-1',
                    type: 'episode',
                    title: 'The Reveal',
                    fullTitle: 'Prestige Show - S01E07 - The Reveal',
                    showTitle: 'Prestige Show',
                    seasonNumber: 1,
                    episodeNumber: 7,
                },
            }),
        });

        renderer.updateCellContent(cellData, TEST_START_MS);

        expect(element.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT)).toBe(true);
        expect(element.classList.contains(EPG_CLASSES.SLIVER_CELL_CLASS)).toBe(false);
        expect(element.classList.contains(FOCUSED_MOVIE_OVERLAY_CLASS)).toBe(false);
        expect(query(element, EPG_CLASSES.CELL_TITLE_TEXT).textContent).toBe('Prestige Show');
        expect(query(element, EPG_CLASSES.CELL_SUBTITLE_TEXT).textContent).toBe('S01E07 - The Reveal');
        expect(query(element, EPG_CLASSES.CELL_SUBTITLE).style.display).toBe('block');
        expect(query(element, EPG_CLASSES.CELL_META).style.display).toBe('none');
        expect(query(element, EPG_CLASSES.CELL_TIME).style.display).toBe('none');
    });

    it('uses focused movie overlay layout without compact episode presentation', () => {
        const element = renderer.createElement();
        const cellData = makeProgramCell(element, {
            width: 160,
            visibleWidthPx: 160,
            isFocused: true,
            program: makeProgram({
                item: {
                    ratingKey: 'movie-1',
                    type: 'movie',
                    title: 'Short Movie Title',
                    fullTitle: 'Movie Title With More Detail',
                },
            }),
        });

        renderer.updateCellContent(cellData, TEST_START_MS);

        expect(element.classList.contains(FOCUSED_MOVIE_OVERLAY_CLASS)).toBe(true);
        expect(element.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT)).toBe(false);
        expect(element.classList.contains(EPG_CLASSES.CELL_TIER_MEDIUM)).toBe(true);
        expect(query(element, EPG_CLASSES.CELL_TITLE_TEXT).textContent).toBe('Movie Title With More Detail');
        expect(query(element, EPG_CLASSES.CELL_TIME).style.display).toBe('block');
        expect(query(element, EPG_CLASSES.CELL_SUBTITLE).style.display).toBe('none');
    });

    it('updates live badge and progress fill for current cells and resets them when temporal state changes', () => {
        const element = renderer.createElement();
        const startTimeMs = TEST_START_MS;
        const endTimeMs = startTimeMs + 40 * 60_000;
        const currentCell = makeProgramCell(element, {
            width: 240,
            isCurrent: true,
            program: makeProgram({ startTimeMs, endTimeMs }),
        });

        renderer.updateCellContent(currentCell, startTimeMs + 10 * 60_000);

        const liveBadge = query(element, EPG_CLASSES.LIVE_BADGE);
        const progressFill = query(element, EPG_CLASSES.CELL_PROGRESS_FILL);
        expect(liveBadge.hidden).toBe(false);
        expect(liveBadge.textContent).toBe('LIVE');
        expect(liveBadge.classList.contains(EPG_CLASSES.CELL_LIVE_COMPACT)).toBe(false);
        expect(progressFill.style.width).toBe('25%');

        renderer.updateTemporalPresentation(makeProgramCell(element, {
            width: 240,
            isCurrent: false,
            isPast: true,
            program: currentCell.program,
        }), endTimeMs + 1);

        expect(liveBadge.hidden).toBe(true);
        expect(liveBadge.textContent).toBe('');
        expect(progressFill.style.width).toBe('0%');
        expect(element.classList.contains(EPG_CLASSES.CELL_PAST)).toBe(true);
    });

    it('resets program state before rendering loading placeholders', () => {
        const element = renderer.createElement();
        renderer.updateCellContent(makeProgramCell(element, {
            isCurrent: true,
            isFocused: true,
            textShiftPx: 24,
            program: makeProgram({
                item: {
                    ratingKey: 'episode-before-placeholder',
                    type: 'episode',
                    title: 'Episode Before Placeholder',
                    fullTitle: 'Show - S02E03 - Episode Before Placeholder',
                    showTitle: 'Show',
                    seasonNumber: 2,
                    episodeNumber: 3,
                },
            }),
        }), TEST_START_MS + 15 * 60_000);
        renderer.updatePositionPresentation(makeProgramCell(element, {
            isCurrent: true,
            isFocused: true,
            textShiftPx: 24,
        }));
        element.dataset.key = 'old-key';

        renderer.resetElement(element);

        expect(element.classList.contains(EPG_CLASSES.CELL_CURRENT)).toBe(false);
        expect(element.classList.contains(EPG_CLASSES.CELL_FOCUSED)).toBe(false);
        expect(element.classList.contains(EPG_CLASSES.CELL_LOADING)).toBe(false);
        expect(element.style.getPropertyValue('--epg-cell-text-shift-px')).toBe('');
        expect(element.getAttribute('data-key')).toBeNull();
        expect(query(element, EPG_CLASSES.CELL_TITLE_TEXT).textContent).toBe('');
        expect(query(element, EPG_CLASSES.CELL_SUBTITLE).style.display).toBe('none');
        expect(query(element, EPG_CLASSES.LIVE_BADGE).hidden).toBe(true);
        expect(query(element, EPG_CLASSES.CELL_PROGRESS_FILL).style.width).toBe('0%');

        renderer.updateCellContent(makePlaceholderCell(element), TEST_START_MS);

        expect(element.classList.contains(EPG_CLASSES.CELL_LOADING)).toBe(true);
        expect(query(element, EPG_CLASSES.CELL_TITLE_TEXT).textContent).toBe('Loading schedule');
        expect(query(element, EPG_CLASSES.CELL_META).style.display).toBe('none');
        expect(query(element, EPG_CLASSES.CELL_SUBTITLE).style.display).toBe('none');
        expect(query(element, EPG_CLASSES.CELL_PROGRESS_FILL).style.width).toBe('0%');
    });

    it('arms focused ticker after the public delay and clears ticker state by element', () => {
        jest.useFakeTimers();
        const element = renderer.createElement();
        const cellData = makeProgramCell(element, {
            width: 180,
            visibleWidthPx: 180,
            isFocused: true,
            program: makeProgram({
                item: {
                    ratingKey: 'ticker-1',
                    type: 'movie',
                    title: 'Overflowing Focused Movie Title',
                    fullTitle: 'Overflowing Focused Movie Title',
                },
            }),
        });

        renderer.updateCellContent(cellData, TEST_START_MS);

        const title = query(element, EPG_CLASSES.CELL_TITLE);
        const titleText = query(element, EPG_CLASSES.CELL_TITLE_TEXT);
        stubDimension(title, 'clientWidth', 100);
        stubDimension(title, 'scrollWidth', 260);
        stubDimension(title, 'clientHeight', 24);
        stubDimension(title, 'scrollHeight', 24);
        stubDimension(titleText, 'scrollWidth', 260);

        renderer.syncFocusedTicker(cellData);

        expect(title.classList.contains(EPG_CLASSES.CELL_TITLE_TICKER_READY)).toBe(true);
        expect(title.classList.contains(EPG_CLASSES.CELL_TITLE_TICKER_RUNNING)).toBe(false);
        expect(title.style.getPropertyValue('--epg-title-ticker-distance-px')).toBe('160px');
        expect(title.style.getPropertyValue('--epg-title-ticker-duration-ms')).toBe('3200ms');

        jest.advanceTimersByTime(899);
        expect(title.classList.contains(EPG_CLASSES.CELL_TITLE_TICKER_RUNNING)).toBe(false);

        jest.advanceTimersByTime(1);
        expect(title.classList.contains(EPG_CLASSES.CELL_TITLE_TICKER_RUNNING)).toBe(true);

        renderer.clearFocusedTickersForElement(element);

        expect(title.classList.contains(EPG_CLASSES.CELL_TITLE_TICKER_READY)).toBe(false);
        expect(title.classList.contains(EPG_CLASSES.CELL_TITLE_TICKER_RUNNING)).toBe(false);
        expect(title.style.getPropertyValue('--epg-title-ticker-distance-px')).toBe('');
        expect(title.style.getPropertyValue('--epg-title-ticker-duration-ms')).toBe('');
    });
});
