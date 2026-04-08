/**
 * @fileoverview EPG Virtualizer - DOM element pooling and virtualized rendering
 * @module modules/ui/epg/EPGVirtualizer
 * @version 1.0.0
 *
 * Implements virtualized grid rendering to maintain <200 DOM elements
 * regardless of channel/program count. See ADR-003 for rationale.
 */

import { EPG_CONSTANTS, EPG_CLASSES } from '../constants';
import { formatCellTimeLabel } from '../utils';
import { appendDebugRuntimeLog, isDebugRuntimeEnabled } from '../debugRuntimeGuards';
import type {
    ScheduledProgram,
    ScheduleWindow,
    EPGConfig,
    EPGProgramCell,
    VirtualizedGridState,
    CellRenderData,
} from '../types';

/**
 * Calculates cell position from program timing.
 * Pure function for deterministic positioning.
 *
 * @param program - The scheduled program
 * @param gridAnchorTime - Start time of the grid (Unix ms)
 * @param pixelsPerMinute - Scaling factor for width
 * @param now - Current time (Unix ms), defaults to Date.now()
 * @returns EPGProgramCell with position data
 */
export function positionCell(
    program: ScheduledProgram,
    gridAnchorTime: number,
    pixelsPerMinute: number = EPG_CONSTANTS.PIXELS_PER_MINUTE,
    now: number = Date.now()
): EPGProgramCell {
    const minutesFromStart = (program.scheduledStartTime - gridAnchorTime) / 60000;
    const durationMinutes = (program.scheduledEndTime - program.scheduledStartTime) / 60000;

    return {
        program,
        left: minutesFromStart * pixelsPerMinute,
        width: Math.max(durationMinutes * pixelsPerMinute, 20), // Minimum 20px width
        isPartial: false, // Will be set by caller based on visible range
        isCurrent: now >= program.scheduledStartTime && now < program.scheduledEndTime,
        isFocused: false,
    };
}

const TEXT_GUTTER_PX = 12;
const TEXT_RIGHT_GUTTER_PX = 12;
const FOCUSED_TICKER_MIN_OVERFLOW_PX = 4;
const TIER_WIDE_MIN_PX = 220;
const TIER_MEDIUM_MIN_PX = 140;
const TIER_NARROW_MIN_PX = 88;
const FOCUSED_MOVIE_OVERLAY_CLASS = 'epg-cell-focused-movie-overlay';
const SLIVER_CELL_CLASS = 'epg-cell-sliver';
const SLIVER_VISIBLE_WIDTH_MAX_PX = 56;

type CellWidthTier = 'wide' | 'medium' | 'narrow' | 'tiny';
type FocusedLayoutMode = 'normal' | 'compact';

type VisibleTextMetrics = {
    visibleLeftPx: number;
    visibleRightPx: number;
    visibleWidthPx: number;
    safeTextShiftPx: number;
    isLeftClippedByCell: boolean;
    isLeftClippedByScroll: boolean;
};

type CellChildren = {
    title: HTMLElement | null;
    titleText: HTMLElement | null;
    time: HTMLElement | null;
    meta: HTMLElement | null;
    episode: HTMLElement | null;
    subtitle: HTMLElement | null;
    subtitleText: HTMLElement | null;
    rail: HTMLElement | null;
    liveBadge: HTMLElement | null;
    progressFill: HTMLElement | null;
};

type CellTextLayout = {
    title: string;
    subtitle: string;
    showSubtitle: boolean;
    focusedCompactSubtitle?: string;
    focusedLayoutMode: FocusedLayoutMode;
};

type TickerTarget = {
    viewport: HTMLElement;
    content: HTMLElement;
    readyClass: string;
    runningClass: string;
    distanceVarName: string;
    durationVarName: string;
    supportsClampMeasurement: boolean;
};

type FocusedCellOptions = {
    syncTicker?: boolean;
};

type RenderPassContext = {
    newVisibleCells: Map<string, CellRenderData>;
    channelOffsetChanged: boolean;
    maxDomElements: number;
    visibleWindowStartMinutes: number;
    visibleWindowEndMinutes: number;
    stageCell: (
        cellData: CellRenderData,
        isFocusedCell: boolean,
        overlapsVisibleWindow: boolean
    ) => void;
    finalizeRow: (rowIndex: number) => void;
    finalizeAllRows: () => void;
};

/**
 * EPG Virtualizer class.
 * Manages DOM element pooling and efficient grid rendering.
 */
export class EPGVirtualizer {
    private config: EPGConfig | null = null;
    private gridContainer: HTMLElement | null = null;
    private contentElement: HTMLElement | null = null;
    private gridAnchorTime: number = 0;
    private channelOffset: number = 0;

    /** Pool of recycled DOM elements */
    private elementPool: Map<string, HTMLElement> = new Map();

    /** Currently visible cells */
    private visibleCells: Map<string, CellRenderData> = new Map();

    private cellChildrenCache: WeakMap<HTMLElement, CellChildren> = new WeakMap();
    private poolSequence = 0;
    private focusedVisibleCellKey: string | null = null;
    private focusedTimeMs: number | null = null;

    /** Total channel count */
    private totalChannels: number = 0;
    private _focusedTickerTimer: ReturnType<typeof setTimeout> | null = null;
    private _focusedTickerTargets: TickerTarget[] = [];
    private isDebugEnabled(): boolean {
        return isDebugRuntimeEnabled(this.config?.debugRuntime);
    }

    /**
     * Initialize the virtualizer.
     *
     * @param gridContainer - The grid container element
     * @param config - EPG configuration
     * @param gridAnchorTime - Start time of the schedule day (Unix ms)
     */
    initialize(
        gridContainer: HTMLElement,
        config: EPGConfig,
        gridAnchorTime: number
    ): void {
        this._clearFocusedTickers();
        if (this.contentElement) {
            this.contentElement.remove();
            this.contentElement = null;
        }
        this.gridContainer = gridContainer;
        this.config = config;
        this.gridAnchorTime = gridAnchorTime;
        this.channelOffset = 0;
        this.totalChannels = 0;
        this.focusedVisibleCellKey = null;
        this.focusedTimeMs = null;
        this.elementPool.clear();
        this.visibleCells.clear();
        this.cellChildrenCache = new WeakMap();
        this.contentElement = document.createElement('div');
        this.contentElement.style.position = 'relative';
        this.contentElement.style.width = '100%';
        this.contentElement.style.height = '100%';
        this.gridContainer.appendChild(this.contentElement);
    }

    /**
     * Destroy the virtualizer and clean up resources.
     */
    destroy(): void {
        this._clearFocusedTickers();
        this.forceRecycleAll();
        this.elementPool.clear();
        this.visibleCells.clear();
        this.focusedVisibleCellKey = null;
        this.focusedTimeMs = null;
        if (this.contentElement) {
            this.contentElement.remove();
        }
        this.contentElement = null;
        this.gridContainer = null;
        this.config = null;
    }

    /**
     * Set total channel count for range calculations.
     *
     * @param count - Number of channels
     */
    setChannelCount(count: number): void {
        this.totalChannels = count;
    }

    /**
     * Update the grid anchor time.
     *
     * @param anchorTime - New anchor time (Unix ms)
     */
    setGridAnchorTime(anchorTime: number): void {
        this.gridAnchorTime = anchorTime;
    }

    /**
     * Calculate visible range based on scroll position.
     * Adds buffer rows and time buffer for smooth scrolling.
     *
     * @param scrollPosition - Current scroll position
     * @returns Visible range with row indices and time window
     */
    calculateVisibleRange(scrollPosition: {
        channelOffset: number;
        timeOffset: number;
    }): VirtualizedGridState {
        const config = this.config;
        if (!config) {
            return {
                visibleRows: [],
                channelOffset: 0,
                visibleTimeRange: { start: 0, end: 0 },
                recycledElements: this.elementPool,
            };
        }

        const rowBuffer = EPG_CONSTANTS.ROW_BUFFER;
        const timeBuffer = EPG_CONSTANTS.TIME_BUFFER_MINUTES;

        const clampedOffset = Math.max(
            0,
            Math.min(scrollPosition.channelOffset, Math.max(0, this.totalChannels - 1))
        );
        const startRow = Math.max(0, clampedOffset - rowBuffer);
        const endRow = Math.min(
            this.totalChannels,
            clampedOffset + config.visibleChannels + rowBuffer
        );

        const visibleRows: number[] = [];
        for (let i = startRow; i < endRow; i++) {
            visibleRows.push(i);
        }

        return {
            visibleRows,
            channelOffset: clampedOffset,
            visibleTimeRange: {
                start: scrollPosition.timeOffset - timeBuffer,
                end: scrollPosition.timeOffset + (config.visibleHours * 60) + timeBuffer,
            },
            recycledElements: this.elementPool,
        };
    }

    /**
     * Check if a program overlaps with a time range.
     *
     * @param program - The scheduled program
     * @param timeRange - Time range in minutes from anchor
     * @returns true if program overlaps the range
     */
    private overlapsTimeRange(
        program: ScheduledProgram,
        timeRange: { start: number; end: number }
    ): boolean {
        const programStartMinutes = (program.scheduledStartTime - this.gridAnchorTime) / 60000;
        const programEndMinutes = (program.scheduledEndTime - this.gridAnchorTime) / 60000;

        return programEndMinutes > timeRange.start && programStartMinutes < timeRange.end;
    }

    private matchesFocusedPlaceholderWindow(
        channelId: string,
        scheduledStartTime: number,
        scheduledEndTime: number,
        focusedCellKey?: string
    ): boolean {
        if (!focusedCellKey) {
            return false;
        }

        if (this.focusedTimeMs !== null) {
            const existingFocusedCell = this.visibleCells.get(focusedCellKey);
            if (existingFocusedCell?.channelId === channelId) {
                return this.focusedTimeMs >= scheduledStartTime && this.focusedTimeMs < scheduledEndTime;
            }
        }

        const placeholderMatch = focusedCellKey.match(/^(.*)-placeholder-(\d+)$/);
        if (placeholderMatch) {
            const [, focusedChannelId, focusedStartRaw] = placeholderMatch;
            const focusedStartTime = Number(focusedStartRaw);
            return focusedChannelId === channelId &&
                Number.isFinite(focusedStartTime) &&
                focusedStartTime >= scheduledStartTime &&
                focusedStartTime < scheduledEndTime;
        }

        const programMatch = focusedCellKey.match(/^(.*)-(\d+)$/);
        if (!programMatch) {
            return false;
        }

        const [, focusedChannelId, focusedStartRaw] = programMatch;
        const focusedStartTime = Number(focusedStartRaw);
        return focusedChannelId === channelId &&
            Number.isFinite(focusedStartTime) &&
            focusedStartTime >= scheduledStartTime &&
            focusedStartTime < scheduledEndTime;
    }

    private addPlaceholderCell(
        channelId: string,
        rowIndex: number,
        startMinutes: number,
        endMinutes: number,
        label: string,
        focusedCellKey: string | undefined,
        stageCell: (
            cellData: CellRenderData,
            isFocusedCell: boolean,
            overlapsVisibleWindow: boolean
        ) => void
    ): void {
        if (!this.config) return;

        const normalizedStart = Math.max(0, startMinutes);
        const normalizedEnd = Math.max(normalizedStart, endMinutes);
        if (normalizedEnd <= normalizedStart) return;

        const scheduledStartTime = this.gridAnchorTime + (normalizedStart * 60000);
        const scheduledEndTime = this.gridAnchorTime + (normalizedEnd * 60000);
        const cellKey = `${channelId}-placeholder-${scheduledStartTime}`;
        const left = normalizedStart * this.config.pixelsPerMinute;
        const width = Math.max((normalizedEnd - normalizedStart) * this.config.pixelsPerMinute, 20);
        const isFocusedCell =
            cellKey === focusedCellKey ||
            this.matchesFocusedPlaceholderWindow(
                channelId,
                scheduledStartTime,
                scheduledEndTime,
                focusedCellKey
            );
        stageCell({
            kind: 'placeholder',
            key: cellKey,
            channelId,
            rowIndex,
            placeholder: {
                label,
                scheduledStartTime,
                scheduledEndTime,
            },
            left,
            width,
            isPartial: false,
            isCurrent: false,
            isPast: false,
            isFocused: isFocusedCell,
            isBufferOnly: false,
            textShiftPx: 0,
            cellElement: null,
            visibleWidthPx: width,
        } as CellRenderData & { visibleWidthPx: number }, isFocusedCell, true);
    }

    /**
     * Render visible cells with DOM recycling.
     * Main virtualization entry point.
     *
     * @param channelIds - Ordered array of channel IDs
     * @param schedules - Map of channel ID to schedule window
     * @param range - Visible range from calculateVisibleRange
     * @param focusedCellKey - Optional focused key to keep focused cell in DOM
     * @param nowMs - Optional current time snapshot (Unix ms) to keep render pass consistent
     */
    renderVisibleCells(
        channelIds: string[],
        schedules: Map<string, ScheduleWindow>,
        range: VirtualizedGridState,
        focusedCellKey?: string,
        nowMs: number = Date.now()
    ): void {
        if (!this.contentElement || !this.config) return;

        const context = this.createRenderPassContext(range);
        this.collectVisibleCells(channelIds, schedules, range, context, focusedCellKey, nowMs);
        context.finalizeAllRows();
        this.pruneToDomBudget(context.newVisibleCells, context.maxDomElements, focusedCellKey);
        this.reconcileVisibleCells(context.newVisibleCells, context.channelOffsetChanged, nowMs);
        this.finishRenderPass(context.newVisibleCells, focusedCellKey, range);
    }

    private createRenderPassContext(range: VirtualizedGridState): RenderPassContext {
        const previousChannelOffset = this.channelOffset;
        this.channelOffset = range.channelOffset;
        const channelOffsetChanged = previousChannelOffset !== this.channelOffset;
        const newVisibleCells = new Map<string, CellRenderData>();
        const maxDomElements = EPG_CONSTANTS.MAX_DOM_ELEMENTS;
        const visibleRowCount = Math.max(1, range.visibleRows.length);
        const perRowLimit = Math.max(1, Math.ceil(maxDomElements / visibleRowCount));
        const perRowCounts = new Map<number, number>();
        const timeBuffer = EPG_CONSTANTS.TIME_BUFFER_MINUTES;
        const visibleWindowStartMinutes = range.visibleTimeRange.start + timeBuffer;
        const visibleWindowEndMinutes = range.visibleTimeRange.end - timeBuffer;
        const queuedVisibleByRow = new Map<number, CellRenderData[]>();
        const queuedBufferByRow = new Map<number, CellRenderData[]>();

        const tryAddCommittedCell = (cellData: CellRenderData, isFocusedCell: boolean): void => {
            const currentRowCount = perRowCounts.get(cellData.rowIndex) ?? 0;
            if (!isFocusedCell) {
                if (newVisibleCells.size >= maxDomElements) {
                    return;
                }
                if (currentRowCount >= perRowLimit) {
                    return;
                }
            }
            newVisibleCells.set(cellData.key, cellData);
            if (!isFocusedCell) {
                perRowCounts.set(cellData.rowIndex, currentRowCount + 1);
            }
        };

        const stageCell = (
            cellData: CellRenderData,
            isFocusedCell: boolean,
            overlapsVisibleWindow: boolean
        ): void => {
            if (isFocusedCell) {
                tryAddCommittedCell(cellData, true);
                return;
            }

            const target = overlapsVisibleWindow ? queuedVisibleByRow : queuedBufferByRow;
            const queue = target.get(cellData.rowIndex) ?? [];
            queue.push(cellData);
            target.set(cellData.rowIndex, queue);
        };

        const selectVisibleQueueCells = (queue: CellRenderData[]): CellRenderData[] => {
            if (queue.length <= perRowLimit) {
                return queue;
            }

            const selected = new Map<number, CellRenderData>();
            const maxIndex = queue.length - 1;
            const sampleCount = Math.min(perRowLimit, queue.length);
            const seedIndices = [
                0,
                Math.round(maxIndex / 3),
                Math.round((maxIndex * 2) / 3),
                maxIndex,
            ];

            for (const index of seedIndices) {
                if (index >= 0 && index <= maxIndex) {
                    selected.set(index, queue[index]!);
                }
            }

            for (let i = 0; i < sampleCount; i += 1) {
                const index = Math.round((i * maxIndex) / Math.max(1, sampleCount - 1));
                selected.set(index, queue[index]!);
            }

            if (selected.size < sampleCount) {
                for (let index = 0; index < queue.length && selected.size < sampleCount; index += 1) {
                    if (!selected.has(index)) {
                        selected.set(index, queue[index]!);
                    }
                }
            }

            const orderedSelected = Array.from(selected.entries()).sort(([a], [b]) => a - b);

            if (orderedSelected.length <= sampleCount) {
                return orderedSelected.map(([, cell]) => cell);
            }

            if (sampleCount === 1) {
                return [orderedSelected[0]![1]];
            }

            const step = (orderedSelected.length - 1) / (sampleCount - 1);
            const resampled = new Map<number, CellRenderData>();

            for (let i = 0; i < sampleCount; i += 1) {
                const orderedIndex = Math.round(i * step);
                const selectedEntry = orderedSelected[orderedIndex];
                if (!selectedEntry) {
                    continue;
                }
                resampled.set(selectedEntry[0], selectedEntry[1]);
            }

            if (resampled.size < sampleCount) {
                for (const [index, cell] of orderedSelected) {
                    if (resampled.size >= sampleCount) {
                        break;
                    }
                    if (!resampled.has(index)) {
                        resampled.set(index, cell);
                    }
                }
            }

            return Array.from(resampled.entries())
                .sort(([a], [b]) => a - b)
                .map(([, cell]) => cell);
        };

        const flushQueue = (
            rowIndex: number,
            queued: Map<number, CellRenderData[]>,
            isVisibleQueue: boolean
        ): void => {
            const queue = queued.get(rowIndex);
            if (!queue || queue.length === 0) {
                return;
            }

            const cellsToCommit = isVisibleQueue ? selectVisibleQueueCells(queue) : queue;

            for (const cellData of cellsToCommit) {
                tryAddCommittedCell(cellData, false);
            }

            queued.delete(rowIndex);
        };

        const finalizeRow = (rowIndex: number): void => {
            flushQueue(rowIndex, queuedVisibleByRow, true);
            flushQueue(rowIndex, queuedBufferByRow, false);
        };

        const finalizeAllRows = (): void => {
            for (const rowIndex of range.visibleRows) {
                finalizeRow(rowIndex);
            }
        };

        return {
            newVisibleCells,
            channelOffsetChanged,
            maxDomElements,
            visibleWindowStartMinutes,
            visibleWindowEndMinutes,
            stageCell,
            finalizeRow,
            finalizeAllRows,
        };
    }

    private collectVisibleCells(
        channelIds: string[],
        schedules: Map<string, ScheduleWindow>,
        range: VirtualizedGridState,
        context: RenderPassContext,
        focusedCellKey: string | undefined,
        nowMs: number
    ): void {
        for (const rowIndex of range.visibleRows) {
            if (rowIndex >= channelIds.length) continue;
            const channelId = channelIds[rowIndex];
            if (channelId === undefined) continue;
            const schedule = schedules.get(channelId);
            if (!schedule) {
                this.addPlaceholderCell(
                    channelId,
                    rowIndex,
                    Math.max(0, context.visibleWindowStartMinutes),
                    Math.max(0, context.visibleWindowEndMinutes),
                    'Loading...',
                    focusedCellKey,
                    context.stageCell
                );
                context.finalizeRow(rowIndex);
                continue;
            }
            this.collectCellsForScheduledRow(channelId, rowIndex, schedule, range, context, focusedCellKey, nowMs);
            context.finalizeRow(rowIndex);
        }
    }

    private collectCellsForScheduledRow(
        channelId: string,
        rowIndex: number,
        schedule: ScheduleWindow,
        range: VirtualizedGridState,
        context: RenderPassContext,
        focusedCellKey: string | undefined,
        nowMs: number
    ): void {
        const config = this.config;
        if (!config) return;

        let hadVisibleOverlap = false;
        const visibleWindowStartMs = this.gridAnchorTime + (Math.max(0, context.visibleWindowStartMinutes) * 60000);
        const visibleWindowEndMs = this.gridAnchorTime + (Math.max(0, context.visibleWindowEndMinutes) * 60000);
        let lastCoveredTimeMs = visibleWindowStartMs;

        for (const program of schedule.programs) {
            if (!this.overlapsTimeRange(program, range.visibleTimeRange)) {
                continue;
            }

            const cellKey = `${channelId}-${program.scheduledStartTime}`;
            const isFocusedCell = focusedCellKey === cellKey;
            const overlapsVisibleWindow = program.scheduledEndTime > visibleWindowStartMs &&
                program.scheduledStartTime < visibleWindowEndMs;
            if (overlapsVisibleWindow) {
                hadVisibleOverlap = true;
            }

            const cell = positionCell(program, this.gridAnchorTime, config.pixelsPerMinute, nowMs);
            const isCurrent = cell.isCurrent;
            const isPast = nowMs >= program.scheduledEndTime;
            const rawLeft = cell.left;
            let left = rawLeft;
            let width = cell.width;
            if (rawLeft < 0) {
                width = Math.max(20, width + left);
                left = 0;
            }

            const programStartMinutes = (program.scheduledStartTime - this.gridAnchorTime) / 60000;
            const programEndMinutes = (program.scheduledEndTime - this.gridAnchorTime) / 60000;
            const isPartial =
                programStartMinutes < context.visibleWindowStartMinutes ||
                programEndMinutes > context.visibleWindowEndMinutes;
            const textMetrics = this.computeVisibleTextMetrics({
                rawLeftPx: rawLeft,
                clippedLeftPx: left,
                clippedWidthPx: width,
                visibleWindowStartMinutes: context.visibleWindowStartMinutes,
                visibleWindowEndMinutes: context.visibleWindowEndMinutes,
            });
            const textShiftPx = textMetrics.safeTextShiftPx;

            context.stageCell({
                kind: 'program',
                key: cellKey,
                channelId,
                rowIndex,
                program,
                left,
                width,
                isPartial,
                isCurrent,
                isPast,
                isFocused: isFocusedCell,
                isBufferOnly: !overlapsVisibleWindow,
                textShiftPx,
                cellElement: null,
                visibleWidthPx: textMetrics.visibleWidthPx,
            } as CellRenderData & { visibleWidthPx: number }, isFocusedCell, overlapsVisibleWindow);

            if (overlapsVisibleWindow && program.scheduledStartTime > lastCoveredTimeMs) {
                const gapEndMs = Math.min(program.scheduledStartTime, visibleWindowEndMs);
                if (gapEndMs > lastCoveredTimeMs) {
                    this.addPlaceholderCell(
                        channelId,
                        rowIndex,
                        (lastCoveredTimeMs - this.gridAnchorTime) / 60000,
                        (gapEndMs - this.gridAnchorTime) / 60000,
                        'No Program',
                        focusedCellKey,
                        context.stageCell
                    );
                }
            }

            if (overlapsVisibleWindow) {
                lastCoveredTimeMs = Math.max(lastCoveredTimeMs, program.scheduledEndTime);
            }
        }

        if (!hadVisibleOverlap) {
            this.addPlaceholderCell(
                channelId,
                rowIndex,
                Math.max(0, context.visibleWindowStartMinutes),
                Math.max(0, context.visibleWindowEndMinutes),
                'No Program',
                focusedCellKey,
                context.stageCell
            );
        } else if (lastCoveredTimeMs < visibleWindowEndMs) {
            this.addPlaceholderCell(
                channelId,
                rowIndex,
                (lastCoveredTimeMs - this.gridAnchorTime) / 60000,
                Math.max(0, context.visibleWindowEndMinutes),
                'No Program',
                focusedCellKey,
                context.stageCell
            );
        }
    }

    private pruneToDomBudget(
        newVisibleCells: Map<string, CellRenderData>,
        maxDomElements: number,
        focusedCellKey?: string
    ): void {
        const removeUntilWithinBudget = (entries: Array<[string, CellRenderData]>): void => {
            for (const [key] of entries) {
                if (newVisibleCells.size <= maxDomElements) {
                    return;
                }
                if (key === focusedCellKey) {
                    continue;
                }
                newVisibleCells.delete(key);
            }
        };

        removeUntilWithinBudget(
            Array.from(newVisibleCells.entries()).filter(([key, cell]) => key !== focusedCellKey && cell.isBufferOnly)
        );
        removeUntilWithinBudget(
            Array.from(newVisibleCells.entries()).reverse().filter(([key]) => key !== focusedCellKey)
        );
    }

    private reconcileVisibleCells(
        newVisibleCells: Map<string, CellRenderData>,
        channelOffsetChanged: boolean,
        nowMs: number
    ): void {
        for (const [key, cellData] of this.visibleCells) {
            if (!newVisibleCells.has(key)) {
                this.recycleElement(key, cellData);
            }
        }

        for (const [key, cellData] of newVisibleCells) {
            const existing = this.visibleCells.get(key);
            if (existing && existing.cellElement) {
                cellData.cellElement = existing.cellElement;
                if (channelOffsetChanged || this.hasCellPositionDelta(existing, cellData)) {
                    this.updateCellPosition(cellData);
                }
                if (this.hasCellContentDelta(existing, cellData)) {
                    this.updateCellContent(cellData, nowMs);
                }
            } else {
                this.renderCell(key, cellData, nowMs);
            }
        }
    }

    private finishRenderPass(
        newVisibleCells: Map<string, CellRenderData>,
        focusedCellKey: string | undefined,
        range: VirtualizedGridState
    ): void {
        this.visibleCells = newVisibleCells;
        this.focusedVisibleCellKey = this.resolveFocusedVisibleCellKey(newVisibleCells, focusedCellKey);
        this._syncFocusedTitleTickerForVisibleFocus();

        if (this.isDebugEnabled()) {
            let placeholderCount = 0;
            for (const key of newVisibleCells.keys()) {
                if (key.includes('-placeholder-')) {
                    placeholderCount += 1;
                }
            }
            const payload = {
                renderedCells: newVisibleCells.size,
                placeholders: placeholderCount,
                visibleRows: range.visibleRows.length,
                timeOffset: range.visibleTimeRange.start + EPG_CONSTANTS.TIME_BUFFER_MINUTES,
            };
            appendDebugRuntimeLog(this.config?.debugRuntime, 'EPGVirtualizer.render', payload);
        }
    }

    private resolveFocusedVisibleCellKey(
        visibleCells: Map<string, CellRenderData>,
        preferredKey?: string
    ): string | null {
        if (preferredKey && visibleCells.has(preferredKey)) {
            return preferredKey;
        }
        for (const [key, cell] of visibleCells) {
            if (cell.isFocused) {
                return key;
            }
        }
        return null;
    }

    private hasCellPositionDelta(previous: CellRenderData, next: CellRenderData): boolean {
        return previous.left !== next.left ||
            previous.width !== next.width ||
            previous.rowIndex !== next.rowIndex ||
            previous.textShiftPx !== next.textShiftPx ||
            previous.isFocused !== next.isFocused ||
            previous.isCurrent !== next.isCurrent ||
            previous.isPast !== next.isPast;
    }

    private hasCellContentDelta(previous: CellRenderData, next: CellRenderData): boolean {
        if (previous.kind !== next.kind) {
            return true;
        }

        if (this.getCellWidthTier(previous.width) !== this.getCellWidthTier(next.width)) {
            return true;
        }

        if (this.isSliverCell(previous) !== this.isSliverCell(next)) {
            return true;
        }

        if (previous.isFocused !== next.isFocused || previous.isCurrent !== next.isCurrent) {
            return true;
        }

        if (next.kind === 'program' && previous.kind === 'program') {
            return previous.program.item.title !== next.program.item.title ||
                previous.program.item.fullTitle !== next.program.item.fullTitle ||
                previous.program.item.showTitle !== next.program.item.showTitle ||
                previous.program.item.type !== next.program.item.type ||
                previous.program.item.seasonNumber !== next.program.item.seasonNumber ||
                previous.program.item.episodeNumber !== next.program.item.episodeNumber ||
                previous.program.scheduledStartTime !== next.program.scheduledStartTime ||
                previous.program.scheduledEndTime !== next.program.scheduledEndTime;
        }

        if (next.kind === 'placeholder' && previous.kind === 'placeholder') {
            return previous.placeholder.label !== next.placeholder.label ||
                previous.placeholder.scheduledStartTime !== next.placeholder.scheduledStartTime ||
                previous.placeholder.scheduledEndTime !== next.placeholder.scheduledEndTime;
        }

        return false;
    }

    /**
     * Get an element from the pool or create a new one.
     * Pool elements are cleaned before reuse.
     *
     * @returns A DOM element ready for use
     */
    private getOrCreateElement(): HTMLElement {
        // Check pool for reusable element
        for (const [key, element] of this.elementPool) {
            this.elementPool.delete(key);
            this.resetElement(element);
            return element;
        }

        // Create new element if pool is empty
        const element = document.createElement('div');
        element.className = EPG_CLASSES.CELL;
        const content = document.createElement('div');
        content.className = EPG_CLASSES.CELL_CONTENT;
        element.appendChild(content);

        const meta = document.createElement('div');
        meta.className = EPG_CLASSES.CELL_META;
        content.appendChild(meta);

        const episode = document.createElement('span');
        episode.className = EPG_CLASSES.CELL_EPISODE;
        meta.appendChild(episode);

        const title = document.createElement('div');
        title.className = EPG_CLASSES.CELL_TITLE;
        const titleText = document.createElement('span');
        titleText.className = EPG_CLASSES.CELL_TITLE_TEXT;
        title.appendChild(titleText);
        content.appendChild(title);

        const subtitle = document.createElement('div');
        subtitle.className = EPG_CLASSES.CELL_SUBTITLE;
        const subtitleText = document.createElement('span');
        subtitleText.className = EPG_CLASSES.CELL_SUBTITLE_TEXT;
        subtitle.appendChild(subtitleText);
        content.appendChild(subtitle);

        const rail = document.createElement('div');
        rail.className = EPG_CLASSES.CELL_RAIL;
        element.appendChild(rail);

        const liveBadge = document.createElement('span');
        liveBadge.className = EPG_CLASSES.LIVE_BADGE;
        liveBadge.hidden = true;
        liveBadge.setAttribute('aria-label', 'Currently playing');
        rail.appendChild(liveBadge);

        const time = document.createElement('div');
        time.className = EPG_CLASSES.CELL_TIME;
        rail.appendChild(time);

        const progress = document.createElement('div');
        progress.className = EPG_CLASSES.CELL_PROGRESS;
        element.appendChild(progress);

        const progressFill = document.createElement('div');
        progressFill.className = EPG_CLASSES.CELL_PROGRESS_FILL;
        progress.appendChild(progressFill);
        // Prime cache for stable cell structure to avoid repeated DOM queries in hot paths.
        void this.getCellChildren(element);
        return element;
    }

    /**
     * Return an element to the pool for later reuse.
     * If pool exceeds MAX_POOL_SIZE, oldest entries are removed.
     *
     * @param _key - Cell key being recycled (unused, for debugging)
     * @param cellData - Cell data with element reference
     */
    private recycleElement(_key: string, cellData: CellRenderData): void {
        const element = cellData.cellElement;
        if (!element) return;

        // Remove from DOM but don't destroy
        element.remove();
        element.classList.remove(
            EPG_CLASSES.CELL_FOCUSED,
            EPG_CLASSES.CELL_CURRENT,
            EPG_CLASSES.CELL_PAST,
            EPG_CLASSES.CELL_LOADING
        );

        // Add to pool with unique key
        const poolKey = `pool-${Date.now()}-${this.poolSequence++}`;
        this.elementPool.set(poolKey, element);

        // Prevent pool from growing unbounded
        if (this.elementPool.size > EPG_CONSTANTS.MAX_POOL_SIZE) {
            const oldestKey = this.elementPool.keys().next().value;
            if (oldestKey !== undefined) {
                this.elementPool.delete(oldestKey);
            }
        }
    }

    /**
     * Reset element content for reuse.
     * Clears text content and inline styles, keeps structure.
     *
     * @param element - Element to reset
     */
    private resetElement(element: HTMLElement): void {
        const { meta, episode, subtitle, subtitleText, titleText, time, liveBadge, progressFill } = this.getCellChildren(element);
        this._clearFocusedTickersForElement(element);
        if (meta) {
            meta.style.display = 'none';
        }
        if (episode) {
            episode.textContent = '';
        }
        if (subtitle) {
            if (subtitleText) {
                subtitleText.textContent = '';
            }
            subtitle.style.display = 'none';
        }
        if (titleText) titleText.textContent = '';
        if (time) {
            time.textContent = '';
            time.style.display = 'block';
            time.classList.remove(EPG_CLASSES.CELL_TIME_COMPACT);
        }
        if (liveBadge) {
            liveBadge.hidden = true;
            liveBadge.textContent = '';
            liveBadge.classList.remove(EPG_CLASSES.CELL_LIVE_COMPACT);
        }
        if (progressFill) {
            progressFill.style.width = '0%';
        }

        // Reset positioning
        element.style.left = '';
        element.style.width = '';
        element.style.top = '';
        element.style.removeProperty('--epg-cell-text-shift-px');

        // Remove state classes
        element.classList.remove(
            EPG_CLASSES.CELL_FOCUSED,
            EPG_CLASSES.CELL_CURRENT,
            EPG_CLASSES.CELL_PAST,
            EPG_CLASSES.CELL_LOADING,
            EPG_CLASSES.CELL_TEXT_SHIFTED,
            FOCUSED_MOVIE_OVERLAY_CLASS,
            SLIVER_CELL_CLASS,
            EPG_CLASSES.CELL_TIER_WIDE,
            EPG_CLASSES.CELL_TIER_MEDIUM,
            EPG_CLASSES.CELL_TIER_NARROW,
            EPG_CLASSES.CELL_TIER_TINY
        );
        element.removeAttribute('data-key');
    }

    private updateCellTimeLabel(
        timeEl: HTMLElement | null,
        tier: CellWidthTier,
        cellData: CellRenderData,
        startTimeMs: number,
        endTimeMs: number
    ): void {
        if (!timeEl) return;

        const isCompactTime = tier === 'narrow' || tier === 'tiny';
        const forceFull = !isCompactTime && (cellData.isFocused || cellData.isCurrent);
        timeEl.textContent = formatCellTimeLabel(startTimeMs, endTimeMs, { compact: isCompactTime, forceFull });
        timeEl.classList.toggle(EPG_CLASSES.CELL_TIME_COMPACT, isCompactTime && !forceFull);
    }

    private updateCellTimeLabelForCell(cellData: CellRenderData): void {
        const element = cellData.cellElement;
        if (!element) return;

        const children = this.getCellChildren(element);
        const tier = this.getCellWidthTier(cellData.width);
        if (cellData.kind === 'program') {
            this.updateCellTimeLabel(
                children.time,
                tier,
                cellData,
                cellData.program.scheduledStartTime,
                cellData.program.scheduledEndTime
            );
        } else {
            this.updateCellTimeLabel(
                children.time,
                tier,
                cellData,
                cellData.placeholder.scheduledStartTime,
                cellData.placeholder.scheduledEndTime
            );
        }
    }

    private extractShowTitleFromFullTitle(fullTitle: string, episodeTitle?: string): string | null {
        const withEpisodeCode = fullTitle.match(/^(.*?)\s-\sS\d{1,2}E\d{1,2}\s-/i);
        if (withEpisodeCode) {
            const showTitle = withEpisodeCode[1]?.trim() ?? '';
            return showTitle.length > 0 ? showTitle : null;
        }

        const trimmedEpisodeTitle = episodeTitle?.trim() ?? '';
        if (trimmedEpisodeTitle.length > 0) {
            const episodeSuffix = ` - ${trimmedEpisodeTitle}`;
            if (fullTitle.endsWith(episodeSuffix)) {
                const showTitle = fullTitle.slice(0, -episodeSuffix.length).trim();
                return showTitle.length > 0 ? showTitle : null;
            }
        }

        return null;
    }

    private formatEpisodeTag(item: ScheduledProgram['item']): string | null {
        if (item.type !== 'episode') return null;

        const season = item.seasonNumber;
        const episode = item.episodeNumber;
        if (typeof season === 'number' && typeof episode === 'number') {
            const s = String(season).padStart(2, '0');
            const e = String(episode).padStart(2, '0');
            return `S${s}E${e}`;
        }

        const text = `${item.title ?? ''} ${item.fullTitle ?? ''}`;
        const match = text.match(/\bS(\d{1,2})E(\d{1,2})\b/i);
        if (!match) return null;

        const s = match[1]!.padStart(2, '0');
        const e = match[2]!.padStart(2, '0');
        return `S${s}E${e}`;
    }

    private normalizeEpisodeTitleForSubtitle(title: string): string {
        return title.replace(/^\s*S\d{1,2}E\d{1,2}\s*-\s*/i, '').trim();
    }

    private getCellChildren(element: HTMLElement): CellChildren {
        const cached = this.cellChildrenCache.get(element);
        if (cached) {
            return cached;
        }
        const children = {
            title: element.querySelector(`.${EPG_CLASSES.CELL_TITLE}`) as HTMLElement | null,
            titleText: element.querySelector(`.${EPG_CLASSES.CELL_TITLE_TEXT}`) as HTMLElement | null,
            time: element.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement | null,
            meta: element.querySelector(`.${EPG_CLASSES.CELL_META}`) as HTMLElement | null,
            episode: element.querySelector(`.${EPG_CLASSES.CELL_EPISODE}`) as HTMLElement | null,
            subtitle: element.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE}`) as HTMLElement | null,
            subtitleText: element.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE_TEXT}`) as HTMLElement | null,
            rail: element.querySelector(`.${EPG_CLASSES.CELL_RAIL}`) as HTMLElement | null,
            liveBadge: element.querySelector(`.${EPG_CLASSES.LIVE_BADGE}`) as HTMLElement | null,
            progressFill: element.querySelector(`.${EPG_CLASSES.CELL_PROGRESS_FILL}`) as HTMLElement | null,
        };
        this.cellChildrenCache.set(element, children);
        return children;
    }

    private updateProgressPresentation(children: CellChildren, cellData: CellRenderData, nowMs: number): void {
        if (!children.progressFill) {
            return;
        }
        if (cellData.kind !== 'program' || !cellData.isCurrent) {
            children.progressFill.style.width = '0%';
            return;
        }

        const duration = cellData.program.scheduledEndTime - cellData.program.scheduledStartTime;
        if (duration <= 0) {
            children.progressFill.style.width = '0%';
            return;
        }

        const elapsed = nowMs - cellData.program.scheduledStartTime;
        const progress = Math.max(0, Math.min(100, (elapsed / duration) * 100));
        children.progressFill.style.width = `${progress.toFixed(2)}%`;
    }

    private getProgramCellTextLayout(
        cellData: CellRenderData,
        isFocused: boolean
    ): CellTextLayout {
        if (cellData.kind !== 'program') {
            return {
                title: cellData.placeholder.label,
                subtitle: '',
                showSubtitle: false,
                focusedLayoutMode: 'normal',
            };
        }

        const item = cellData.program.item;
        if (item.type !== 'episode') {
            const focusedFullTitle = item.fullTitle.trim();
            return {
                title: isFocused && focusedFullTitle.length > 0 ? focusedFullTitle : item.title,
                subtitle: '',
                showSubtitle: false,
                focusedCompactSubtitle: '',
                focusedLayoutMode: 'normal',
            };
        }

        const episodeTitle = this.normalizeEpisodeTitleForSubtitle(item.title);
        const showTitle = (item.showTitle ?? '').trim() ||
            this.extractShowTitleFromFullTitle(item.fullTitle, episodeTitle) ||
            '';
        const episodeTag = this.formatEpisodeTag(item);
        const focusedCompactSubtitle =
            episodeTitle.length > 0 && episodeTag ? `${episodeTag} - ${episodeTitle}` : episodeTitle;

        if (isFocused) {
            return {
                title: showTitle || item.title,
                subtitle: episodeTitle,
                showSubtitle: focusedCompactSubtitle.length > 0 || episodeTitle.length > 0,
                focusedCompactSubtitle,
                focusedLayoutMode: 'compact',
            };
        }

        const showSubtitle =
            Boolean(showTitle) || (episodeTitle.length > 0 && episodeTitle !== item.title);
        return {
            title: showTitle || item.title,
            subtitle: showSubtitle ? episodeTitle : '',
            showSubtitle,
            focusedCompactSubtitle,
            focusedLayoutMode: 'normal',
        };
    }

    private updateEpisodePresentation(
        children: CellChildren,
        cellData: CellRenderData,
        textLayout: CellTextLayout
    ): void {
        const { meta, episode, subtitle, subtitleText, titleText } = children;
        if (!meta || !episode) return;

        if (titleText) {
            titleText.textContent = textLayout.title;
        }

        if (cellData.kind !== 'program') {
            episode.textContent = '';
            meta.style.display = 'none';
            if (subtitle) {
                if (subtitleText) {
                    subtitleText.textContent = '';
                }
                subtitle.style.display = 'none';
            }
            return;
        }

        const item = cellData.program.item;
        if (item.type !== 'episode') {
            episode.textContent = '';
            meta.style.display = 'none';
            if (subtitle) {
                if (subtitleText) {
                    subtitleText.textContent = '';
                }
                subtitle.style.display = 'none';
            }
            return;
        }

        const tag = this.formatEpisodeTag(item);
        if (tag) {
            episode.textContent = tag;
            meta.style.display = 'flex';
        } else {
            episode.textContent = '';
            meta.style.display = 'none';
        }

        if (subtitle) {
            const shouldInlineEpisodeTag = textLayout.focusedLayoutMode === 'compact';
            const subtitleValue = shouldInlineEpisodeTag && textLayout.focusedCompactSubtitle
                ? textLayout.focusedCompactSubtitle
                : textLayout.subtitle;
            if (subtitleText) {
                subtitleText.textContent = textLayout.showSubtitle ? subtitleValue : '';
            }
            subtitle.style.display = textLayout.showSubtitle ? 'block' : 'none';
        }
    }

    private getCellWidthTier(width: number): CellWidthTier {
        if (width >= TIER_WIDE_MIN_PX) return 'wide';
        if (width >= TIER_MEDIUM_MIN_PX) return 'medium';
        if (width >= TIER_NARROW_MIN_PX) return 'narrow';
        return 'tiny';
    }

    private applyWidthTierPresentation(
        element: HTMLElement,
        children: CellChildren,
        tier: CellWidthTier,
        cellData: CellRenderData,
        textLayout: CellTextLayout
    ): void {
        element.classList.remove(
            EPG_CLASSES.CELL_TIER_WIDE,
            EPG_CLASSES.CELL_TIER_MEDIUM,
            EPG_CLASSES.CELL_TIER_NARROW,
            EPG_CLASSES.CELL_TIER_TINY
        );

        const { time, meta, subtitle, subtitleText } = children;
        const hasMetaContent = (meta?.textContent ?? '').trim().length > 0;
        const hasSubtitleContent = (subtitleText?.textContent ?? '').trim().length > 0;
        const isFocused = cellData.isFocused;
        const usesFocusedCompactLayout = isFocused && textLayout.focusedLayoutMode === 'compact';
        const usesFocusedMovieOverlay = isFocused &&
            !usesFocusedCompactLayout &&
            cellData.kind === 'program' &&
            cellData.program.item.type === 'movie';
        const usesSliverPresentation = this.isSliverCell(cellData);
        element.classList.toggle(EPG_CLASSES.CELL_FOCUSED_COMPACT, usesFocusedCompactLayout);
        element.classList.toggle(FOCUSED_MOVIE_OVERLAY_CLASS, usesFocusedMovieOverlay);
        element.classList.toggle(SLIVER_CELL_CLASS, usesSliverPresentation);

        if (tier === 'wide') {
            element.classList.add(EPG_CLASSES.CELL_TIER_WIDE);
        } else if (tier === 'medium') {
            element.classList.add(EPG_CLASSES.CELL_TIER_MEDIUM);
        } else if (tier === 'narrow' || tier === 'tiny') {
            element.classList.add(tier === 'narrow' ? EPG_CLASSES.CELL_TIER_NARROW : EPG_CLASSES.CELL_TIER_TINY);
        }

        if (usesSliverPresentation) {
            if (meta) meta.style.display = 'none';
            if (subtitle) subtitle.style.display = 'none';
            if (time) time.style.display = 'none';
            return;
        }

        if (tier === 'wide') {
            if (meta) meta.style.display = hasMetaContent ? 'flex' : 'none';
            if (subtitle) subtitle.style.display = hasSubtitleContent ? 'block' : 'none';
            if (time) time.style.display = usesFocusedCompactLayout ? 'none' : 'block';
        } else if (tier === 'medium') {
            if (meta) meta.style.display = 'none';
            if (subtitle) subtitle.style.display = hasSubtitleContent ? 'block' : 'none';
            if (time) time.style.display = usesFocusedCompactLayout ? 'none' : 'block';
        } else if (tier === 'narrow' || tier === 'tiny') {
            if (meta) meta.style.display = 'none';
            if (subtitle) subtitle.style.display = usesFocusedCompactLayout && hasSubtitleContent ? 'block' : 'none';
            if (time) time.style.display = isFocused && !usesFocusedCompactLayout ? 'block' : 'none';
        }
    }

    private getRenderedVisibleWidthPx(cellData: CellRenderData): number {
        const visibleWidthPx = (cellData as CellRenderData & { visibleWidthPx?: number }).visibleWidthPx;
        if (typeof visibleWidthPx === 'number' && Number.isFinite(visibleWidthPx)) {
            return Math.max(0, Math.min(cellData.width, visibleWidthPx));
        }
        return Math.max(0, cellData.width);
    }

    private isSliverCell(cellData: CellRenderData): boolean {
        const renderedVisibleWidthPx = this.getRenderedVisibleWidthPx(cellData);
        return renderedVisibleWidthPx > 0 && renderedVisibleWidthPx <= SLIVER_VISIBLE_WIDTH_MAX_PX;
    }

    private computeVisibleTextMetrics(input: {
        rawLeftPx: number;
        clippedLeftPx: number;
        clippedWidthPx: number;
        visibleWindowStartMinutes: number;
        visibleWindowEndMinutes: number;
    }): VisibleTextMetrics {
        if (!this.config) {
            return {
                visibleLeftPx: 0,
                visibleRightPx: 0,
                visibleWidthPx: 0,
                safeTextShiftPx: 0,
                isLeftClippedByCell: false,
                isLeftClippedByScroll: false,
            };
        }

        const {
            rawLeftPx,
            clippedLeftPx,
            clippedWidthPx,
            visibleWindowStartMinutes,
            visibleWindowEndMinutes,
        } = input;
        const ppm = this.config.pixelsPerMinute;
        const clippedRightPx = clippedLeftPx + clippedWidthPx;
        const visibleWindowLeftPx = visibleWindowStartMinutes * ppm;
        const visibleWindowRightPx = visibleWindowEndMinutes * ppm;
        const visibleLeftPx = Math.max(clippedLeftPx, visibleWindowLeftPx);
        const visibleRightPx = Math.min(clippedRightPx, visibleWindowRightPx);
        const visibleWidthPx = Math.max(0, visibleRightPx - visibleLeftPx);
        const hiddenLeftPx = Math.max(0, visibleLeftPx - clippedLeftPx);
        const isLeftClippedByCell = rawLeftPx < 0;
        const isLeftClippedByScroll = hiddenLeftPx > 0;

        if (!isLeftClippedByScroll || visibleWidthPx <= 0) {
            return {
                visibleLeftPx,
                visibleRightPx,
                visibleWidthPx,
                safeTextShiftPx: 0,
                isLeftClippedByCell,
                isLeftClippedByScroll,
            };
        }

        const desiredShiftPx = hiddenLeftPx;
        const maxShiftPx = Math.max(0, clippedWidthPx - (TEXT_GUTTER_PX + TEXT_RIGHT_GUTTER_PX));
        const safeTextShiftPx = Math.max(0, Math.min(desiredShiftPx, maxShiftPx));

        return {
            visibleLeftPx,
            visibleRightPx,
            visibleWidthPx,
            safeTextShiftPx,
            isLeftClippedByCell,
            isLeftClippedByScroll,
        };
    }

    /**
     * Render a cell to the DOM using a pooled or new element.
     *
     * @param key - Unique cell key
     * @param cellData - Cell data to render
     */
    private renderCell(key: string, cellData: CellRenderData, nowMs: number): void {
        if (!this.contentElement || !this.config) return;

        const element = this.getOrCreateElement();
        const children = this.getCellChildren(element);
        const tier = this.getCellWidthTier(cellData.width);
        const textLayout = this.getProgramCellTextLayout(cellData, cellData.isFocused);

        // Set content
        if (cellData.kind === 'program') {
            if (children.titleText) {
                children.titleText.textContent = textLayout.title;
            }
            this.updateCellTimeLabel(
                children.time,
                tier,
                cellData,
                cellData.program.scheduledStartTime,
                cellData.program.scheduledEndTime
            );
            element.classList.remove(EPG_CLASSES.CELL_LOADING);
        } else {
            if (children.titleText) children.titleText.textContent = cellData.placeholder.label;
            this.updateCellTimeLabel(
                children.time,
                tier,
                cellData,
                cellData.placeholder.scheduledStartTime,
                cellData.placeholder.scheduledEndTime
            );
            element.classList.add(EPG_CLASSES.CELL_LOADING);
        }
        this.updateEpisodePresentation(children, cellData, textLayout);
        this.applyWidthTierPresentation(element, children, tier, cellData, textLayout);

        if (cellData.textShiftPx > 0) {
            element.classList.add(EPG_CLASSES.CELL_TEXT_SHIFTED);
            element.style.setProperty('--epg-cell-text-shift-px', `${cellData.textShiftPx}px`);
        } else {
            element.classList.remove(EPG_CLASSES.CELL_TEXT_SHIFTED);
            element.style.removeProperty('--epg-cell-text-shift-px');
        }

        // Calculate position
        element.style.left = `${cellData.left}px`;
        element.style.width = `${cellData.width}px`;
        element.style.top = `${(cellData.rowIndex - this.channelOffset) * this.config.rowHeight}px`;
        element.setAttribute('data-key', key);

        element.classList.toggle(EPG_CLASSES.CELL_FOCUSED, cellData.isFocused);

        // Mark current program
        if (cellData.isCurrent) {
            element.classList.add(EPG_CLASSES.CELL_CURRENT);
        }
        if (cellData.isPast) {
            element.classList.add(EPG_CLASSES.CELL_PAST);
        } else {
            element.classList.remove(EPG_CLASSES.CELL_PAST);
        }
        this.updateLiveBadge(element, cellData.isCurrent);
        this.updateProgressPresentation(children, cellData, nowMs);

        // Append to grid
        this.contentElement.appendChild(element);
        cellData.cellElement = element;
    }

    /**
     * Update cell position without recreating.
     *
     * @param cellData - Cell data with updated position
     */
    private updateCellPosition(cellData: CellRenderData): void {
        const element = cellData.cellElement;
        if (!element || !this.config) return;

        if (cellData.textShiftPx > 0) {
            element.classList.add(EPG_CLASSES.CELL_TEXT_SHIFTED);
            element.style.setProperty('--epg-cell-text-shift-px', `${cellData.textShiftPx}px`);
        } else {
            element.classList.remove(EPG_CLASSES.CELL_TEXT_SHIFTED);
            element.style.removeProperty('--epg-cell-text-shift-px');
        }
        element.style.left = `${cellData.left}px`;
        element.style.width = `${cellData.width}px`;
        element.style.top = `${(cellData.rowIndex - this.channelOffset) * this.config.rowHeight}px`;

        element.classList.toggle(EPG_CLASSES.CELL_FOCUSED, cellData.isFocused);
        // Update current state
        if (cellData.isCurrent) {
            element.classList.add(EPG_CLASSES.CELL_CURRENT);
        } else {
            element.classList.remove(EPG_CLASSES.CELL_CURRENT);
        }
        if (cellData.isPast) {
            element.classList.add(EPG_CLASSES.CELL_PAST);
        } else {
            element.classList.remove(EPG_CLASSES.CELL_PAST);
        }
        this.updateLiveBadge(element, cellData.isCurrent);
    }

    updateTemporalClasses(nowMs: number): void {
        for (const cellData of this.visibleCells.values()) {
            const element = cellData.cellElement;
            if (cellData.kind === 'program') {
                const wasCurrent = cellData.isCurrent;
                const wasPast = cellData.isPast;
                const isCurrent = nowMs >= cellData.program.scheduledStartTime &&
                    nowMs < cellData.program.scheduledEndTime;
                const isPast = nowMs >= cellData.program.scheduledEndTime;
                cellData.isCurrent = isCurrent;
                cellData.isPast = isPast;
                if (element) {
                    if (isCurrent) {
                        element.classList.add(EPG_CLASSES.CELL_CURRENT);
                    } else {
                        element.classList.remove(EPG_CLASSES.CELL_CURRENT);
                    }
                    if (isPast) {
                        element.classList.add(EPG_CLASSES.CELL_PAST);
                    } else {
                        element.classList.remove(EPG_CLASSES.CELL_PAST);
                    }
                    if (wasCurrent !== isCurrent || wasPast !== isPast) {
                        // Temporal changes only affect time label + LIVE badge presentation.
                        // Width tier/presentation is stable (cellData.width doesn't change here).
                        this.updateCellTimeLabelForCell(cellData);
                    }
                    this.updateLiveBadge(element, isCurrent);
                    this.updateProgressPresentation(this.getCellChildren(element), cellData, nowMs);
                }
            } else if (element) {
                cellData.isCurrent = false;
                cellData.isPast = false;
                element.classList.remove(EPG_CLASSES.CELL_PAST, EPG_CLASSES.CELL_CURRENT);
                this.updateLiveBadge(element, false);
                this.updateProgressPresentation(this.getCellChildren(element), cellData, nowMs);
            }
        }
    }

    private updateLiveBadge(element: HTMLElement, isCurrent: boolean): void {
        const badge = this.getCellChildren(element).liveBadge;
        if (!badge) return;

        if (!isCurrent) {
            badge.hidden = true;
            badge.textContent = '';
            badge.classList.remove(EPG_CLASSES.CELL_LIVE_COMPACT);
            return;
        }

        badge.hidden = false;
        const isNarrowOrTiny =
            element.classList.contains(EPG_CLASSES.CELL_TIER_NARROW) ||
            element.classList.contains(EPG_CLASSES.CELL_TIER_TINY);
        const shouldCompact =
            isNarrowOrTiny ||
            element.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT) ||
            element.classList.contains(FOCUSED_MOVIE_OVERLAY_CLASS);

        badge.classList.toggle(EPG_CLASSES.CELL_LIVE_COMPACT, shouldCompact);
        badge.textContent = shouldCompact ? '' : 'LIVE';
    }

    private _clearFocusedTickers(): void {
        if (this._focusedTickerTimer) {
            clearTimeout(this._focusedTickerTimer);
            this._focusedTickerTimer = null;
        }
        for (const target of this._focusedTickerTargets) {
            target.viewport.classList.remove(target.readyClass, target.runningClass);
            target.viewport.style.removeProperty(target.durationVarName);
            target.viewport.style.removeProperty(target.distanceVarName);
        }
        this._focusedTickerTargets = [];
    }

    public clearFocusedTickerState(): void {
        this._clearFocusedTickers();
    }

    private _clearFocusedTickersForElement(element: HTMLElement): void {
        if (this._focusedTickerTargets.some((target) => element.contains(target.viewport))) {
            this._clearFocusedTickers();
        }
    }

    private _prefersReducedMotion(): boolean {
        return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    }

    private measureReadyStateTickerOverflow(target: TickerTarget, textShiftPx: number): number {
        target.viewport.classList.add(target.readyClass);
        void target.viewport.offsetWidth;
        const effectiveClientWidth = Math.max(0, target.viewport.clientWidth - textShiftPx);
        const contentWidth = Math.max(target.content.scrollWidth, target.viewport.scrollWidth);
        return Math.max(0, contentWidth - effectiveClientWidth);
    }

    private buildTickerTarget(
        viewport: HTMLElement | null,
        content: HTMLElement | null,
        options: Omit<TickerTarget, 'viewport' | 'content'>
    ): TickerTarget | null {
        if (!viewport || !content) {
            return null;
        }

        const text = content.textContent?.trim() ?? '';
        if (text.length === 0) {
            return null;
        }

        return {
            viewport,
            content,
            ...options,
        };
    }

    private _syncFocusedTitleTickerForVisibleFocus(): void {
        this._clearFocusedTickers();
        if (this._prefersReducedMotion()) return;

        const focusedKey = this.focusedVisibleCellKey;
        const focusedCell = focusedKey ? this.visibleCells.get(focusedKey) : null;
        if (!focusedCell?.cellElement) return;
        if (focusedCell.cellElement.classList.contains(SLIVER_CELL_CLASS)) return;

        const children = this.getCellChildren(focusedCell.cellElement);
        const targets = [
            this.buildTickerTarget(children.title, children.titleText, {
                readyClass: EPG_CLASSES.CELL_TITLE_TICKER_READY,
                runningClass: EPG_CLASSES.CELL_TITLE_TICKER_RUNNING,
                distanceVarName: '--epg-title-ticker-distance-px',
                durationVarName: '--epg-title-ticker-duration-ms',
                supportsClampMeasurement: true,
            }),
            this.buildTickerTarget(children.subtitle, children.subtitleText, {
                readyClass: EPG_CLASSES.CELL_SUBTITLE_TICKER_READY,
                runningClass: EPG_CLASSES.CELL_SUBTITLE_TICKER_RUNNING,
                distanceVarName: '--epg-subtitle-ticker-distance-px',
                durationVarName: '--epg-subtitle-ticker-duration-ms',
                supportsClampMeasurement: false,
            }),
        ].filter((target): target is TickerTarget => target !== null);
        if (targets.length === 0) return;

        const textShiftPx = Math.max(0, focusedCell.textShiftPx);
        const tier = this.getCellWidthTier(focusedCell.width);
        const activeTargets: TickerTarget[] = [];

        for (const target of targets) {
            const effectiveClientWidth = Math.max(0, target.viewport.clientWidth - textShiftPx);
            const contentWidth = Math.max(target.content.scrollWidth, target.viewport.scrollWidth);
            const overflowPx = contentWidth - effectiveClientWidth;
            const clampHiddenPx = target.viewport.scrollHeight - target.viewport.clientHeight;
            const hasClampHiddenText =
                target.supportsClampMeasurement &&
                tier === 'tiny' &&
                clampHiddenPx > 2;

            if (overflowPx <= FOCUSED_TICKER_MIN_OVERFLOW_PX && !hasClampHiddenText) {
                continue;
            }

            const travelPx = hasClampHiddenText
                ? this.measureReadyStateTickerOverflow(target, textShiftPx)
                : Math.max(overflowPx, 0);
            if (travelPx <= FOCUSED_TICKER_MIN_OVERFLOW_PX) {
                target.viewport.classList.remove(target.readyClass);
                continue;
            }

            const durationMs = Math.max(1600, Math.min(3200, travelPx * 30));
            target.viewport.classList.add(target.readyClass);
            target.viewport.style.setProperty(target.durationVarName, `${durationMs}ms`);
            target.viewport.style.setProperty(target.distanceVarName, `${travelPx}px`);
            activeTargets.push(target);
        }

        if (activeTargets.length === 0) {
            return;
        }

        this._focusedTickerTargets = activeTargets;
        this._focusedTickerTimer = setTimeout(() => {
            for (const target of this._focusedTickerTargets) {
                target.viewport.classList.add(target.runningClass);
            }
        }, 900);
    }

    /**
     * Update cell content (title and time).
     * Called on reused cells to ensure fresh data after schedule updates.
     *
     * @param cellData - Cell data with program info
     */
    private updateCellContent(cellData: CellRenderData, nowMs: number): void {
        const element = cellData.cellElement;
        if (!element) return;

        const children = this.getCellChildren(element);
        const tier = this.getCellWidthTier(cellData.width);
        const textLayout = this.getProgramCellTextLayout(cellData, cellData.isFocused);
        if (cellData.kind === 'program') {
            if (children.titleText) {
                children.titleText.textContent = textLayout.title;
            }
            this.updateCellTimeLabel(
                children.time,
                tier,
                cellData,
                cellData.program.scheduledStartTime,
                cellData.program.scheduledEndTime
            );
            element.classList.remove(EPG_CLASSES.CELL_LOADING);
        } else {
            if (children.titleText) children.titleText.textContent = cellData.placeholder.label;
            this.updateCellTimeLabel(
                children.time,
                tier,
                cellData,
                cellData.placeholder.scheduledStartTime,
                cellData.placeholder.scheduledEndTime
            );
            element.classList.add(EPG_CLASSES.CELL_LOADING);
        }
        this.updateEpisodePresentation(children, cellData, textLayout);
        this.applyWidthTierPresentation(element, children, tier, cellData, textLayout);
        this.updateLiveBadge(element, cellData.isCurrent);
        this.updateProgressPresentation(children, cellData, nowMs);
    }

    /**
     * Force recycle all elements when memory pressure detected.
     */
    forceRecycleAll(): void {
        this._clearFocusedTickers();
        for (const [key, cellData] of this.visibleCells) {
            this.recycleElement(key, cellData);
        }
        this.visibleCells.clear();

        // Clear pool completely to free memory
        this.elementPool.clear();
    }

    /**
     * Set focus on a cell element.
     *
     * @param channelId - Channel ID
     * @param programStartTime - Program start time (Unix ms)
     * @returns The focused element or null
     */
    setFocusedCell(
        channelId: string,
        programStartTime: number,
        focusTimeMs?: number,
        options?: FocusedCellOptions
    ): HTMLElement | null {
        const key = `${channelId}-${programStartTime}`;
        const nowMs = Date.now();

        // Resolve target first so we can synchronize data + visual focus state in one pass.
        let targetCellData = this.visibleCells.get(key);
        if (!targetCellData) {
            const placeholderKey = `${channelId}-placeholder-${programStartTime}`;
            targetCellData = this.visibleCells.get(placeholderKey);
        }

        if (!targetCellData && focusTimeMs !== undefined) {
            for (const candidate of this.visibleCells.values()) {
                if (candidate.channelId !== channelId) {
                    continue;
                }
                const start = candidate.kind === 'program'
                    ? candidate.program.scheduledStartTime
                    : candidate.placeholder.scheduledStartTime;
                const end = candidate.kind === 'program'
                    ? candidate.program.scheduledEndTime
                    : candidate.placeholder.scheduledEndTime;
                if (focusTimeMs >= start && focusTimeMs < end) {
                    targetCellData = candidate;
                    break;
                }
            }
        }

        const previousFocusedKey = this.focusedVisibleCellKey;
        if (previousFocusedKey) {
            const previousFocused = this.visibleCells.get(previousFocusedKey);
            if (previousFocused && previousFocused !== targetCellData) {
                previousFocused.isFocused = false;
                if (previousFocused.cellElement) {
                    previousFocused.cellElement.classList.remove(EPG_CLASSES.CELL_FOCUSED);
                    this.updateCellContent(previousFocused, nowMs);
                }
            }
        } else {
            for (const candidate of this.visibleCells.values()) {
                if (!candidate.isFocused || candidate === targetCellData) {
                    continue;
                }
                candidate.isFocused = false;
                if (candidate.cellElement) {
                    candidate.cellElement.classList.remove(EPG_CLASSES.CELL_FOCUSED);
                    this.updateCellContent(candidate, nowMs);
                }
            }
        }

        if (targetCellData) {
            const focusChanged = !targetCellData.isFocused;
            targetCellData.isFocused = true;
            if (targetCellData.cellElement) {
                targetCellData.cellElement.classList.add(EPG_CLASSES.CELL_FOCUSED);
                if (focusChanged) {
                    this.updateCellContent(targetCellData, nowMs);
                }
            }
            this.focusedVisibleCellKey = targetCellData.key;
            this.focusedTimeMs = focusTimeMs ?? programStartTime;
        } else {
            this.focusedVisibleCellKey = null;
            this.focusedTimeMs = null;
        }
        if (options?.syncTicker !== false) {
            this._syncFocusedTitleTickerForVisibleFocus();
        }

        if (targetCellData?.cellElement) {
            return targetCellData.cellElement;
        }

        return null;
    }

    /**
     * Get the DOM element count (for testing).
     *
     * @returns Number of visible cell elements
     */
    getElementCount(): number {
        return this.visibleCells.size;
    }

    /**
     * Get pool size (for testing).
     *
     * @returns Number of elements in pool
     */
    getPoolSize(): number {
        return this.elementPool.size;
    }

    /**
     * Get the root content element that is translated for time scrolling.
     * Used for attaching overlays that should move with the grid (e.g. the "Now" line).
     */
    getContentElement(): HTMLElement | null {
        return this.contentElement;
    }

    updateScrollPosition(timeOffset: number): void {
        if (!this.contentElement || !this.config) return;
        const translateX = -(timeOffset * this.config.pixelsPerMinute);
        this.contentElement.style.transform = `translateX(${translateX}px)`;
    }
}
