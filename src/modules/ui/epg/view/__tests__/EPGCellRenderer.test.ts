/**
 * @jest-environment jsdom
 */

import { EPG_CLASSES } from '../../constants';
import type { ScheduledProgram } from '../../types';
import { EPGCellRenderer, type EPGRenderedCellData } from '../cells/EPGCellRenderer';

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
            lifecycle: 'loading',
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

const stubRenderedWidth = (element: HTMLElement, width: number): void => {
    Object.defineProperty(element, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ width }),
    });
};

const installQueuedAnimationFrame = (): {
    flushNext: () => void;
    request: jest.SpiedFunction<typeof requestAnimationFrame>;
    cancel: jest.SpiedFunction<typeof cancelAnimationFrame>;
} => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextHandle = 1;
    const request = jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
        const handle = nextHandle++;
        callbacks.set(handle, callback);
        return handle;
    });
    const cancel = jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((handle) => {
        callbacks.delete(handle);
    });

    return {
        flushNext: (): void => {
            const next = callbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
            if (!next) return;
            callbacks.delete(next[0]);
            next[1](0);
        },
        request,
        cancel,
    };
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
            cellLeftPx: -20,
            cellWidthPx: 80,
            visibleWindowStartMinutes: 10,
            visibleWindowEndMinutes: 20,
            pixelsPerMinute: 4,
        });

        expect(metrics).toEqual({
            visibleLeftPx: 40,
            visibleRightPx: 60,
            visibleWidthPx: 20,
            safeTextShiftPx: 56,
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
        expect(element.style.getPropertyValue('--epg-cell-text-shift-px')).toBe('56px');
        expect(element.classList.contains(EPG_CLASSES.CELL_FOCUSED)).toBe(true);
        expect(element.classList.contains(EPG_CLASSES.CELL_CURRENT)).toBe(true);

        renderer.updatePositionPresentation(makeProgramCell(element, { textShiftPx: 0 }));

        expect(element.classList.contains(EPG_CLASSES.CELL_TEXT_SHIFTED)).toBe(false);
        expect(element.style.getPropertyValue('--epg-cell-text-shift-px')).toBe('');
        expect(element.classList.contains(EPG_CLASSES.CELL_FOCUSED)).toBe(false);
        expect(element.classList.contains(EPG_CLASSES.CELL_CURRENT)).toBe(false);
    });

    it('uses focused compact tag-lane layout for episodes even when visible width is sliver-sized', () => {
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
        expect(query(element, EPG_CLASSES.CELL_EPISODE).textContent).toBe('S01E07');
        expect(query(element, EPG_CLASSES.CELL_SUBTITLE_TEXT).textContent).toBe('The Reveal');
        expect(query(element, EPG_CLASSES.CELL_SUBTITLE).style.display).toBe('block');
        expect(query(element, EPG_CLASSES.CELL_META).style.display).toBe('flex');
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
        expect(query(element, EPG_CLASSES.CELL_TIME).style.display).toBe('none');
        expect(query(element, EPG_CLASSES.CELL_SUBTITLE).style.display).toBe('none');
    });

    it.each([
        { width: 220, tierClass: EPG_CLASSES.CELL_TIER_WIDE, focusedMovieTime: 'block', unfocusedMovieTime: 'block' },
        { width: 219, tierClass: EPG_CLASSES.CELL_TIER_MEDIUM, focusedMovieTime: 'none', unfocusedMovieTime: 'none' },
        { width: 140, tierClass: EPG_CLASSES.CELL_TIER_MEDIUM, focusedMovieTime: 'none', unfocusedMovieTime: 'none' },
        { width: 139, tierClass: EPG_CLASSES.CELL_TIER_NARROW, focusedMovieTime: 'none', unfocusedMovieTime: 'none' },
        { width: 88, tierClass: EPG_CLASSES.CELL_TIER_NARROW, focusedMovieTime: 'none', unfocusedMovieTime: 'none' },
        { width: 87, tierClass: EPG_CLASSES.CELL_TIER_TINY, focusedMovieTime: 'none', unfocusedMovieTime: 'none' },
    ])('applies movie time readability policy at $width px', ({ width, tierClass, focusedMovieTime, unfocusedMovieTime }) => {
        const focused = renderer.createElement();
        renderer.updateCellContent(makeProgramCell(focused, {
            width,
            visibleWidthPx: width,
            isFocused: true,
        }), TEST_START_MS);

        expect(focused.classList.contains(tierClass)).toBe(true);
        expect(query(focused, EPG_CLASSES.CELL_TIME).style.display).toBe(focusedMovieTime);

        const unfocused = renderer.createElement();
        renderer.updateCellContent(makeProgramCell(unfocused, {
            width,
            visibleWidthPx: width,
        }), TEST_START_MS);

        expect(unfocused.classList.contains(tierClass)).toBe(true);
        expect(query(unfocused, EPG_CLASSES.CELL_TIME).style.display).toBe(unfocusedMovieTime);
    });

    it.each([
        { width: 220, tierClass: EPG_CLASSES.CELL_TIER_WIDE, meta: 'flex', subtitle: 'block', time: 'none' },
        { width: 219, tierClass: EPG_CLASSES.CELL_TIER_MEDIUM, meta: 'flex', subtitle: 'block', time: 'none' },
        { width: 140, tierClass: EPG_CLASSES.CELL_TIER_MEDIUM, meta: 'flex', subtitle: 'block', time: 'none' },
        { width: 139, tierClass: EPG_CLASSES.CELL_TIER_NARROW, meta: 'flex', subtitle: 'block', time: 'none' },
        { width: 88, tierClass: EPG_CLASSES.CELL_TIER_NARROW, meta: 'flex', subtitle: 'block', time: 'none' },
        { width: 87, tierClass: EPG_CLASSES.CELL_TIER_TINY, meta: 'flex', subtitle: 'block', time: 'none' },
    ])('preserves focused episode tag lane at $width px', ({ width, tierClass, meta, subtitle, time }) => {
        const element = renderer.createElement();
        renderer.updateCellContent(makeProgramCell(element, {
            width,
            visibleWidthPx: width,
            isFocused: true,
            program: makeProgram({
                item: {
                    ratingKey: `episode-${width}`,
                    type: 'episode',
                    title: 'Readable Episode',
                    fullTitle: 'Boundary Show - S01E08 - Readable Episode',
                    showTitle: 'Boundary Show',
                    seasonNumber: 1,
                    episodeNumber: 8,
                },
            }),
        }), TEST_START_MS);

        expect(element.classList.contains(tierClass)).toBe(true);
        expect(query(element, EPG_CLASSES.CELL_EPISODE).textContent).toBe('S01E08');
        expect(query(element, EPG_CLASSES.CELL_SUBTITLE_TEXT).textContent).toBe('Readable Episode');
        expect(query(element, EPG_CLASSES.CELL_SUBTITLE_TEXT).textContent).not.toContain('S01E08');
        expect(query(element, EPG_CLASSES.CELL_META).style.display).toBe(meta);
        expect(query(element, EPG_CLASSES.CELL_SUBTITLE).style.display).toBe(subtitle);
        expect(query(element, EPG_CLASSES.CELL_TIME).style.display).toBe(time);
    });

    it('lets non-current wide episode titles use the full row while subtitle preserves time space', () => {
        const element = renderer.createElement();
        renderer.updateCellContent(makeProgramCell(element, {
            width: 360,
            visibleWidthPx: 360,
            program: makeProgram({
                item: {
                    ratingKey: 'episode-wide-row-aware',
                    type: 'episode',
                    title: 'Jerry',
                    fullTitle: 'Adventure Time: Fionna and Cake - S01E08 - Jerry',
                    showTitle: 'Adventure Time: Fionna and Cake',
                    seasonNumber: 1,
                    episodeNumber: 8,
                },
            }),
        }), TEST_START_MS);

        expect(element.classList.contains(EPG_CLASSES.CELL_TITLE_FULL_ROW)).toBe(true);
        expect(query(element, EPG_CLASSES.CELL_TITLE_TEXT).textContent)
            .toBe('Adventure Time: Fionna and Cake');
        expect(query(element, EPG_CLASSES.CELL_SUBTITLE_TEXT).textContent).toBe('Jerry');
        expect(query(element, EPG_CLASSES.CELL_TIME).style.display).toBe('block');
    });

    it('uses row-aware episode title layout for current wide cells while constrained cells stay compact', () => {
        const makeEpisode = (ratingKey: string): ScheduledProgram => makeProgram({
            item: {
                ratingKey,
                type: 'episode',
                title: 'Jerry',
                fullTitle: 'Adventure Time: Fionna and Cake - S01E08 - Jerry',
                showTitle: 'Adventure Time: Fionna and Cake',
                seasonNumber: 1,
                episodeNumber: 8,
            },
        });

        const current = renderer.createElement();
        renderer.updateCellContent(makeProgramCell(current, {
            width: 360,
            visibleWidthPx: 360,
            isCurrent: true,
            program: makeEpisode('episode-current'),
        }), TEST_START_MS);

        const focused = renderer.createElement();
        renderer.updateCellContent(makeProgramCell(focused, {
            width: 360,
            visibleWidthPx: 360,
            isFocused: true,
            program: makeEpisode('episode-focused'),
        }), TEST_START_MS);

        const constrained = renderer.createElement();
        renderer.updateCellContent(makeProgramCell(constrained, {
            width: 219,
            visibleWidthPx: 219,
            program: makeEpisode('episode-constrained'),
        }), TEST_START_MS);

        expect(current.classList.contains(EPG_CLASSES.CELL_TITLE_FULL_ROW)).toBe(true);
        expect(query(current, EPG_CLASSES.LIVE_BADGE).textContent).toBe('');
        expect(query(current, EPG_CLASSES.LIVE_BADGE).classList.contains(EPG_CLASSES.CELL_LIVE_COMPACT)).toBe(true);
        expect(query(current, EPG_CLASSES.LIVE_BADGE).getAttribute('aria-label')).toBe('Currently playing');
        expect(query(current, EPG_CLASSES.CELL_META).style.display).toBe('flex');
        expect(query(current, EPG_CLASSES.CELL_EPISODE).textContent).toBe('S01E08');
        expect(focused.classList.contains(EPG_CLASSES.CELL_TITLE_FULL_ROW)).toBe(false);
        expect(focused.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT)).toBe(true);
        expect(constrained.classList.contains(EPG_CLASSES.CELL_TITLE_FULL_ROW)).toBe(false);
        expect(query(constrained, EPG_CLASSES.CELL_META).style.display).toBe('none');
        expect(query(constrained, EPG_CLASSES.CELL_EPISODE).textContent).toBe('S01E08');
        expect(query(constrained, EPG_CLASSES.CELL_TIME).style.display).toBe('none');
    });

    it('updates the live badge for current cells without rendering per-cell progress', () => {
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
        expect(liveBadge.hidden).toBe(false);
        expect(liveBadge.textContent).toBe('');
        expect(liveBadge.classList.contains(EPG_CLASSES.CELL_LIVE_COMPACT)).toBe(true);
        expect(liveBadge.getAttribute('aria-label')).toBe('Currently playing');
        expect(element.querySelector('.epg-cell-progress')).toBeNull();

        renderer.updateTemporalPresentation(makeProgramCell(element, {
            width: 240,
            isCurrent: false,
            isPast: true,
            program: currentCell.program,
        }), endTimeMs + 1);

        expect(liveBadge.hidden).toBe(true);
        expect(liveBadge.textContent).toBe('');
        expect(element.classList.contains(EPG_CLASSES.CELL_PAST)).toBe(true);
    });

    it('uses compact live dot for current cells regardless of visible width', () => {
        const element = renderer.createElement();
        const startTimeMs = TEST_START_MS;
        const endTimeMs = startTimeMs + 60 * 60_000;
        const currentCell = makeProgramCell(element, {
            width: 240,
            visibleWidthPx: 64,
            isCurrent: true,
            program: makeProgram({ startTimeMs, endTimeMs }),
        });

        expect(renderer.getCellWidthTier(currentCell.width)).toBe('wide');
        expect(renderer.isSliverCell(currentCell)).toBe(false);

        renderer.updateCellContent(currentCell, startTimeMs + 10 * 60_000);

        const liveBadge = query(element, EPG_CLASSES.LIVE_BADGE);
        expect(liveBadge.hidden).toBe(false);
        expect(liveBadge.classList.contains(EPG_CLASSES.CELL_LIVE_COMPACT)).toBe(true);
        expect(liveBadge.textContent).toBe('');
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
        expect(element.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT)).toBe(false);
        expect(element.classList.contains(EPG_CLASSES.CELL_LOADING)).toBe(false);
        expect(element.style.getPropertyValue('--epg-cell-text-shift-px')).toBe('');
        expect(element.getAttribute('data-key')).toBeNull();
        expect(query(element, EPG_CLASSES.CELL_TITLE_TEXT).textContent).toBe('');
        expect(query(element, EPG_CLASSES.CELL_SUBTITLE).style.display).toBe('none');
        expect(query(element, EPG_CLASSES.LIVE_BADGE).hidden).toBe(true);

        renderer.updateCellContent(makePlaceholderCell(element), TEST_START_MS);

        expect(element.classList.contains(EPG_CLASSES.CELL_LOADING)).toBe(true);
        expect(query(element, EPG_CLASSES.CELL_TITLE_TEXT).textContent).toBe('Loading schedule');
        expect(query(element, EPG_CLASSES.CELL_META).style.display).toBe('none');
        expect(query(element, EPG_CLASSES.CELL_SUBTITLE).style.display).toBe('none');
        expect(query(element, EPG_CLASSES.CELL_SUBTITLE_TEXT).textContent).toBe('');
    });

    it('clears recycled secondary text for placeholder, non-episode, and sliver cells without clearing state classes', () => {
        const element = renderer.createElement();
        const episodeProgram = makeProgram({
            item: {
                ratingKey: 'episode-before-clear',
                type: 'episode',
                title: 'Episode Before Clear',
                fullTitle: 'Show - S02E03 - Episode Before Clear',
                showTitle: 'Show',
                seasonNumber: 2,
                episodeNumber: 3,
            },
        });

        renderer.updateCellContent(makeProgramCell(element, {
            width: 260,
            visibleWidthPx: 260,
            program: episodeProgram,
        }), TEST_START_MS);
        expect(query(element, EPG_CLASSES.CELL_SUBTITLE_TEXT).textContent).toBe('Episode Before Clear');

        renderer.updateCellContent(makePlaceholderCell(element, {
            width: 180,
            visibleWidthPx: 180,
        }), TEST_START_MS);
        expect(query(element, EPG_CLASSES.CELL_SUBTITLE).style.display).toBe('none');
        expect(query(element, EPG_CLASSES.CELL_SUBTITLE_TEXT).textContent).toBe('');

        renderer.updateCellContent(makeProgramCell(element, {
            width: 260,
            visibleWidthPx: 260,
            program: episodeProgram,
        }), TEST_START_MS);
        renderer.updatePositionPresentation(makeProgramCell(element, {
            width: 160,
            visibleWidthPx: 160,
            isCurrent: true,
            isFocused: true,
        }));
        const subtitle = query(element, EPG_CLASSES.CELL_SUBTITLE);
        subtitle.classList.add(EPG_CLASSES.CELL_SUBTITLE_TICKER_READY);

        renderer.updateCellContent(makeProgramCell(element, {
            width: 160,
            visibleWidthPx: 160,
            isCurrent: true,
            isFocused: true,
            program: makeProgram({
                item: {
                    ratingKey: 'movie-after-episode',
                    type: 'movie',
                    title: 'Movie After Episode',
                    fullTitle: 'Movie After Episode Full Title',
                },
            }),
        }), TEST_START_MS);
        expect(query(element, EPG_CLASSES.CELL_SUBTITLE).style.display).toBe('none');
        expect(query(element, EPG_CLASSES.CELL_SUBTITLE_TEXT).textContent).toBe('');
        expect(element.classList.contains(EPG_CLASSES.CELL_FOCUSED)).toBe(true);
        expect(element.classList.contains(EPG_CLASSES.CELL_CURRENT)).toBe(true);
        expect(query(element, EPG_CLASSES.LIVE_BADGE).hidden).toBe(false);
        expect(query(element, EPG_CLASSES.LIVE_BADGE).classList.contains(EPG_CLASSES.CELL_LIVE_COMPACT)).toBe(true);
        expect(subtitle.classList.contains(EPG_CLASSES.CELL_SUBTITLE_TICKER_READY)).toBe(true);

        renderer.updateCellContent(makeProgramCell(element, {
            width: 260,
            visibleWidthPx: 260,
            program: episodeProgram,
        }), TEST_START_MS);
        renderer.updateCellContent(makeProgramCell(element, {
            width: 180,
            visibleWidthPx: 40,
            program: episodeProgram,
        }), TEST_START_MS);
        expect(element.classList.contains(EPG_CLASSES.SLIVER_CELL_CLASS)).toBe(true);
        expect(query(element, EPG_CLASSES.CELL_SUBTITLE).style.display).toBe('none');
        expect(query(element, EPG_CLASSES.CELL_SUBTITLE_TEXT).textContent).toBe('');
    });

    it.each([
        { type: 'movie' as const, textShiftPx: 0, contentWidth: 105, overflows: false },
        { type: 'movie' as const, textShiftPx: 24, contentWidth: 105, overflows: false },
        { type: 'episode' as const, textShiftPx: 0, contentWidth: 105, overflows: false },
        { type: 'episode' as const, textShiftPx: 24, contentWidth: 105, overflows: false },
        { type: 'movie' as const, textShiftPx: 0, contentWidth: 150, overflows: true },
        { type: 'movie' as const, textShiftPx: 24, contentWidth: 150, overflows: true },
        { type: 'episode' as const, textShiftPx: 0, contentWidth: 150, overflows: true },
        { type: 'episode' as const, textShiftPx: 24, contentWidth: 150, overflows: true },
    ])('measures focused $type text with overflow=$overflows at a $textShiftPx px shift', ({
        type,
        textShiftPx,
        contentWidth,
        overflows,
    }) => {
        jest.useFakeTimers();
        const animationFrame = installQueuedAnimationFrame();
        const element = renderer.createElement();
        const cellData = makeProgramCell(element, {
            width: 180,
            visibleWidthPx: 180,
            isFocused: true,
            textShiftPx,
            program: makeProgram({
                item: type === 'episode'
                    ? {
                        ratingKey: `ticker-episode-${textShiftPx}-${contentWidth}`,
                        type,
                        title: 'Focused Episode Title',
                        fullTitle: 'Focused Show Title - S01E02 - Focused Episode Title',
                        showTitle: 'Focused Show Title',
                        seasonNumber: 1,
                        episodeNumber: 2,
                    }
                    : {
                        ratingKey: `ticker-movie-${textShiftPx}-${contentWidth}`,
                        type,
                        title: 'Focused Movie Title',
                        fullTitle: 'Focused Movie Title',
                    },
            }),
        });
        renderer.updateCellContent(cellData, TEST_START_MS);

        const targets = [query(element, EPG_CLASSES.CELL_TITLE)];
        if (type === 'episode') targets.push(query(element, EPG_CLASSES.CELL_SUBTITLE));
        for (const target of targets) {
            const content = target.firstElementChild as HTMLElement;
            stubDimension(target, 'clientWidth', 120);
            stubDimension(target, 'scrollWidth', 1320);
            stubDimension(target, 'clientHeight', 24);
            stubDimension(target, 'scrollHeight', 24);
            stubDimension(content, 'scrollWidth', 0);
            stubRenderedWidth(content, contentWidth);
        }

        renderer.syncFocusedTicker(cellData);
        animationFrame.flushNext();

        for (const target of targets) {
            expect(target.className.includes('ticker-ready')).toBe(overflows);
            if (overflows) {
                expect(target.getAttribute('style')).toContain('ticker-distance-px: 30px');
                expect(target.getAttribute('style')).toContain('ticker-duration');
            } else {
                expect(target.getAttribute('style') ?? '').not.toContain('ticker-distance');
                expect(target.getAttribute('style') ?? '').not.toContain('ticker-duration');
            }
        }
        expect(jest.getTimerCount()).toBe(overflows ? 1 : 0);

        jest.advanceTimersByTime(900);
        for (const target of targets) {
            expect(target.className.includes('ticker-running')).toBe(overflows);
        }
    });

    it('arms focused ticker after the public delay and clears ticker state by element', () => {
        jest.useFakeTimers();
        const animationFrame = installQueuedAnimationFrame();
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
        stubDimension(titleText, 'scrollWidth', 0);
        stubRenderedWidth(titleText, 260);

        renderer.syncFocusedTicker(cellData);
        animationFrame.flushNext();

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

    it('measures only the latest focused cell when focus changes within one frame', () => {
        jest.useFakeTimers();
        const animationFrame = installQueuedAnimationFrame();
        const firstElement = renderer.createElement();
        const secondElement = renderer.createElement();
        const firstCell = makeProgramCell(firstElement, { key: 'first', isFocused: true });
        const secondCell = makeProgramCell(secondElement, { key: 'second', isFocused: true });
        renderer.updateCellContent(firstCell, TEST_START_MS);
        renderer.updateCellContent(secondCell, TEST_START_MS);

        const firstTitle = query(firstElement, EPG_CLASSES.CELL_TITLE);
        const secondTitle = query(secondElement, EPG_CLASSES.CELL_TITLE);
        const firstTitleText = query(firstElement, EPG_CLASSES.CELL_TITLE_TEXT);
        const secondTitleText = query(secondElement, EPG_CLASSES.CELL_TITLE_TEXT);
        const firstWidthRead = jest.fn(() => ({ width: 260 }));
        const secondWidthRead = jest.fn(() => ({ width: 280 }));
        Object.defineProperty(firstTitleText, 'getBoundingClientRect', { configurable: true, value: firstWidthRead });
        Object.defineProperty(secondTitleText, 'getBoundingClientRect', { configurable: true, value: secondWidthRead });
        stubDimension(firstTitle, 'clientWidth', 100);
        stubDimension(secondTitle, 'clientWidth', 100);

        renderer.syncFocusedTicker(firstCell);
        renderer.syncFocusedTicker(secondCell);

        expect(animationFrame.request).toHaveBeenCalledTimes(1);
        animationFrame.flushNext();
        expect(firstWidthRead).not.toHaveBeenCalled();
        expect(secondWidthRead).toHaveBeenCalled();
        expect(firstTitle.classList.contains(EPG_CLASSES.CELL_TITLE_TICKER_READY)).toBe(false);
        expect(secondTitle.classList.contains(EPG_CLASSES.CELL_TITLE_TICKER_READY)).toBe(true);
    });

    it('cancels pending ticker measurement during lifecycle cleanup', () => {
        const animationFrame = installQueuedAnimationFrame();
        const element = renderer.createElement();
        const cellData = makeProgramCell(element, { isFocused: true });
        renderer.updateCellContent(cellData, TEST_START_MS);
        const title = query(element, EPG_CLASSES.CELL_TITLE);
        stubDimension(title, 'scrollWidth', 260);
        stubDimension(title, 'clientWidth', 100);

        renderer.syncFocusedTicker(cellData);
        renderer.clearFocusedTickers();
        animationFrame.flushNext();

        expect(animationFrame.cancel).toHaveBeenCalledTimes(1);
        expect(title.classList.contains(EPG_CLASSES.CELL_TITLE_TICKER_READY)).toBe(false);
    });
});
