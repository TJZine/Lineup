/**
 * @jest-environment jsdom
 */

import {
    getCellTimeLabelPresentation,
    getCellWidthPresentation,
    getCellWidthTier,
    getEffectiveTickerClientWidth,
    getProgramCellTextLayout,
    getRenderedVisibleWidthPx,
    getRenderedVisibleWidthTier,
    getVisibleTextMetrics,
    isSliverCell,
    measureReadyStateTickerOverflow,
    shouldShowCellTimeForWidth,
    shouldShowEpisodeTagForCell,
    shouldUseCellTitleFullRowLayout,
} from '../EPGCellPresentation';
import type { CellRenderData, ScheduledProgram } from '../../../types';

const START_MS = new Date('2026-01-07T12:00:00Z').getTime();
type ProgramCellRenderData = Extract<CellRenderData, { kind: 'program' }>;
type RenderedProgramCell = ProgramCellRenderData & { visibleWidthPx: number };

const makeProgram = (
    item: Partial<ScheduledProgram['item']> = {}
): ScheduledProgram => ({
    item: {
        ratingKey: 'program-1',
        type: 'episode',
        title: 'S01E02 - Episode Title',
        fullTitle: 'Show Title - S01E02 - Episode Title',
        durationMs: 60 * 60_000,
        thumb: null,
        year: 2026,
        scheduledIndex: 0,
        seasonNumber: 1,
        episodeNumber: 2,
        ...item,
    },
    scheduledStartTime: START_MS,
    scheduledEndTime: START_MS + 60 * 60_000,
    elapsedMs: 0,
    remainingMs: 60 * 60_000,
    scheduleIndex: 0,
    loopNumber: 0,
    isCurrent: false,
});

const makeCell = (overrides: Partial<RenderedProgramCell> = {}): RenderedProgramCell => ({
    kind: 'program',
    key: 'program-cell',
    channelId: 'channel-1',
    rowIndex: 0,
    program: makeProgram(),
    left: 0,
    width: 240,
    visibleWidthPx: 240,
    isPartial: false,
    isCurrent: false,
    isPast: false,
    isFocused: false,
    isBufferOnly: false,
    textShiftPx: 0,
    cellElement: null,
    ...overrides,
});

describe('EPGCellPresentation', () => {
    it('classifies width tiers and sliver state from rendered visible width', () => {
        expect(getCellWidthTier(220)).toBe('wide');
        expect(getCellWidthTier(140)).toBe('medium');
        expect(getCellWidthTier(88)).toBe('narrow');
        expect(getCellWidthTier(87)).toBe('tiny');

        const clippedCell = makeCell({ width: 180, visibleWidthPx: 40 });

        expect(getRenderedVisibleWidthPx(clippedCell)).toBe(40);
        expect(getRenderedVisibleWidthTier(clippedCell)).toBe('tiny');
        expect(isSliverCell(clippedCell)).toBe(true);
    });

    it('derives text, time, and focused width policy without DOM rendering', () => {
        const focusedEpisode = makeCell({ isFocused: true });
        const textLayout = getProgramCellTextLayout(focusedEpisode, true);

        expect(textLayout).toMatchObject({
            title: 'Show Title',
            subtitle: 'Episode Title',
            showSubtitle: true,
            episodeTag: 'S01E02',
            focusedLayoutMode: 'compact',
        });
        expect(shouldShowCellTimeForWidth(focusedEpisode, textLayout)).toBe(false);
        expect(shouldShowEpisodeTagForCell(focusedEpisode, textLayout)).toBe(true);
        expect(getCellWidthPresentation(focusedEpisode, textLayout)).toEqual({
            usesFocusedCompactLayout: true,
            usesFocusedMovieOverlay: false,
            usesSliverPresentation: false,
        });
    });

    it('keeps non-focused full-row episode policy behind wide cells with visible time', () => {
        const wideEpisode = makeCell({ width: 260, visibleWidthPx: 260 });
        const mediumEpisode = makeCell({ width: 180, visibleWidthPx: 180 });
        const wideLayout = getProgramCellTextLayout(wideEpisode, false);
        const mediumLayout = getProgramCellTextLayout(mediumEpisode, false);

        expect(shouldUseCellTitleFullRowLayout(wideEpisode, wideLayout)).toBe(true);
        expect(shouldShowCellTimeForWidth(mediumEpisode, mediumLayout)).toBe(false);
        expect(shouldUseCellTitleFullRowLayout(mediumEpisode, mediumLayout)).toBe(false);

        const timeLabel = getCellTimeLabelPresentation(
            getRenderedVisibleWidthTier(wideEpisode),
            wideEpisode,
            START_MS,
            START_MS + 60 * 60_000
        );
        expect(timeLabel.isCompact).toBe(false);
        expect(timeLabel.text).toContain('7:00');
    });

    it('computes visible text shift and ticker overflow from stable inputs', () => {
        expect(getVisibleTextMetrics({
            rawLeftPx: -20,
            clippedLeftPx: 0,
            clippedWidthPx: 60,
            visibleWindowStartMinutes: 10,
            visibleWindowEndMinutes: 20,
            pixelsPerMinute: 4,
        })).toMatchObject({
            visibleWidthPx: 20,
            safeTextShiftPx: 36,
            isLeftClippedByCell: true,
            isLeftClippedByScroll: true,
        });

        const viewport = document.createElement('div');
        const content = document.createElement('span');
        viewport.append(content);
        Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 100 });
        Object.defineProperty(viewport, 'scrollWidth', { configurable: true, value: 140 });
        Object.defineProperty(content, 'scrollWidth', { configurable: true, value: 150 });

        const target = {
            viewport,
            content,
            readyClass: 'ready',
            runningClass: 'running',
            distanceVarName: '--distance',
            durationVarName: '--duration',
            supportsClampMeasurement: false,
        };

        expect(getEffectiveTickerClientWidth(target, 200, 90, 10)).toBe(90);
        expect(measureReadyStateTickerOverflow(target, 200, 90, 10)).toBe(60);
        expect(viewport.classList.contains('ready')).toBe(true);
    });
});
