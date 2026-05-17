// Maintains a bounded DOM pool for large EPG grids. See ADR-003 for rationale.

import { EPG_CONSTANTS, EPG_CLASSES } from '../constants';
import { appendDebugRuntimeLog, isDebugRuntimeEnabled } from '../debug/debugRuntimeGuards';
import { EPGCellRenderer } from './EPGCellRenderer';
import type { EPGRenderedCellData } from './EPGCellRenderer';
import type {
    ScheduledProgram,
    ScheduleWindow,
    EPGConfig,
    EPGProgramCell,
    VirtualizedGridState,
} from '../types';

/**
 * Calculates cell position from program timing.
 * Pure function for deterministic positioning.
 *
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

type FocusedCellOptions = {
    syncTicker?: boolean;
};

type VirtualizedCellRenderData = EPGRenderedCellData;

type RenderPassContext = {
    newVisibleCells: Map<string, VirtualizedCellRenderData>;
    channelOffsetChanged: boolean;
    maxDomElements: number;
    visibleWindowStartMinutes: number;
    visibleWindowEndMinutes: number;
    stageCell: (
        cellData: VirtualizedCellRenderData,
        isFocusedCell: boolean,
        overlapsVisibleWindow: boolean
    ) => void;
    finalizeRow: (rowIndex: number) => void;
    finalizeAllRows: () => void;
};

class RenderPassAccumulator implements RenderPassContext {
    readonly newVisibleCells = new Map<string, VirtualizedCellRenderData>();
    readonly maxDomElements = EPG_CONSTANTS.MAX_DOM_ELEMENTS;
    readonly perRowLimit: number;
    readonly visibleWindowStartMinutes: number;
    readonly visibleWindowEndMinutes: number;
    private readonly rowCommitCounts = new Map<number, number>();
    private readonly visibleQueues = new Map<number, VirtualizedCellRenderData[]>();
    private readonly bufferQueues = new Map<number, VirtualizedCellRenderData[]>();

    constructor(
        readonly channelOffsetChanged: boolean,
        private readonly visibleRows: number[],
        visibleTimeRange: VirtualizedGridState['visibleTimeRange']
    ) {
        const visibleRowCount = Math.max(1, visibleRows.length);
        this.perRowLimit = Math.max(1, Math.ceil(this.maxDomElements / visibleRowCount));
        const timeBuffer = EPG_CONSTANTS.TIME_BUFFER_MINUTES;
        this.visibleWindowStartMinutes = visibleTimeRange.start + timeBuffer;
        this.visibleWindowEndMinutes = visibleTimeRange.end - timeBuffer;
    }

    stageCell = (
        cellData: VirtualizedCellRenderData,
        isFocusedCell: boolean,
        overlapsVisibleWindow: boolean
    ): void => {
        if (isFocusedCell) {
            this.tryCommitCell(cellData, true);
            return;
        }

        const queues = overlapsVisibleWindow ? this.visibleQueues : this.bufferQueues;
        const queue = queues.get(cellData.rowIndex) ?? [];
        queue.push(cellData);
        queues.set(cellData.rowIndex, queue);
    };

    finalizeRow = (rowIndex: number): void => {
        this.flushQueuedCells(rowIndex, this.visibleQueues, true);
        this.flushQueuedCells(rowIndex, this.bufferQueues, false);
    };

    finalizeAllRows = (): void => {
        for (const rowIndex of this.visibleRows) {
            this.finalizeRow(rowIndex);
        }
    };

    private tryCommitCell(cellData: VirtualizedCellRenderData, isFocusedCell: boolean): void {
        const currentRowCount = this.rowCommitCounts.get(cellData.rowIndex) ?? 0;
        if (!isFocusedCell) {
            if (this.newVisibleCells.size >= this.maxDomElements) {
                return;
            }
            if (currentRowCount >= this.perRowLimit) {
                return;
            }
        }
        this.newVisibleCells.set(cellData.key, cellData);
        if (!isFocusedCell) {
            this.rowCommitCounts.set(cellData.rowIndex, currentRowCount + 1);
        }
    }

    private flushQueuedCells(
        rowIndex: number,
        queuedCellsByRow: Map<number, VirtualizedCellRenderData[]>,
        isVisibleQueue: boolean
    ): void {
        const queue = queuedCellsByRow.get(rowIndex);
        if (!queue || queue.length === 0) {
            return;
        }

        const cellsToCommit = isVisibleQueue ? this.selectVisibleQueueCells(queue) : queue;

        for (const cellData of cellsToCommit) {
            this.tryCommitCell(cellData, false);
        }

        queuedCellsByRow.delete(rowIndex);
    }

    private selectVisibleQueueCells(queue: VirtualizedCellRenderData[]): VirtualizedCellRenderData[] {
        if (queue.length <= this.perRowLimit) {
            return queue;
        }

        const selected = new Map<number, VirtualizedCellRenderData>();
        const maxIndex = queue.length - 1;
        const sampleCount = Math.min(this.perRowLimit, queue.length);
        const step = maxIndex / Math.max(1, sampleCount - 1);

        for (let i = 0; i < sampleCount; i += 1) {
            const index = Math.round(i * step);
            selected.set(index, queue[index]!);
        }

        return Array.from(selected.entries())
            .sort(([a], [b]) => a - b)
            .map(([, cell]) => cell);
    }
}

export class EPGVirtualizer {
    private config: EPGConfig | null = null;
    private gridContainer: HTMLElement | null = null;
    private contentElement: HTMLElement | null = null;
    private gridAnchorTime: number = 0;
    private channelOffset: number = 0;

    private elementPool: Map<string, HTMLElement> = new Map();

    private visibleCells: Map<string, VirtualizedCellRenderData> = new Map();

    private cellRenderer = new EPGCellRenderer();
    private poolSequence = 0;
    private focusedVisibleCellKey: string | null = null;
    private focusedTimeMs: number | null = null;

    private totalChannels: number = 0;
    private isDebugEnabled(): boolean {
        return isDebugRuntimeEnabled(this.config?.debugRuntime);
    }

    initialize(
        gridContainer: HTMLElement,
        config: EPGConfig,
        gridAnchorTime: number
    ): void {
        this.cellRenderer.clearFocusedTickers();
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
        this.cellRenderer.resetCache();
        this.contentElement = document.createElement('div');
        this.contentElement.style.position = 'relative';
        this.contentElement.style.width = '100%';
        this.contentElement.style.height = '100%';
        this.gridContainer.appendChild(this.contentElement);
    }

    destroy(): void {
        this.cellRenderer.clearFocusedTickers();
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

    setChannelCount(count: number): void {
        this.totalChannels = count;
    }

    setGridAnchorTime(anchorTime: number): void {
        this.gridAnchorTime = anchorTime;
    }

    /**
     * Calculate visible range based on scroll position.
     * Adds buffer rows and time buffer for smooth scrolling.
     *
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
            cellData: VirtualizedCellRenderData,
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
        }, isFocusedCell, true);
    }

    /**
     * Render visible cells with DOM recycling.
     * Main virtualization entry point.
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
        return new RenderPassAccumulator(
            channelOffsetChanged,
            range.visibleRows,
            range.visibleTimeRange
        );
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
            const textMetrics = this.cellRenderer.computeVisibleTextMetrics({
                rawLeftPx: rawLeft,
                clippedLeftPx: left,
                clippedWidthPx: width,
                visibleWindowStartMinutes: context.visibleWindowStartMinutes,
                visibleWindowEndMinutes: context.visibleWindowEndMinutes,
                pixelsPerMinute: config.pixelsPerMinute,
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
            }, isFocusedCell, overlapsVisibleWindow);

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
        newVisibleCells: Map<string, VirtualizedCellRenderData>,
        maxDomElements: number,
        focusedCellKey?: string
    ): void {
        const removeUntilWithinBudget = (entries: Array<[string, VirtualizedCellRenderData]>): void => {
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
        newVisibleCells: Map<string, VirtualizedCellRenderData>,
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
                    this.cellRenderer.updateCellContent(cellData, nowMs);
                }
            } else {
                this.renderCell(key, cellData, nowMs);
            }
        }
    }

    private finishRenderPass(
        newVisibleCells: Map<string, VirtualizedCellRenderData>,
        focusedCellKey: string | undefined,
        range: VirtualizedGridState
    ): void {
        this.visibleCells = newVisibleCells;
        this.focusedVisibleCellKey = this.resolveFocusedVisibleCellKey(newVisibleCells, focusedCellKey);
        this.syncFocusedTitleTickerForVisibleFocus();

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
        visibleCells: Map<string, VirtualizedCellRenderData>,
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

    private hasCellPositionDelta(previous: VirtualizedCellRenderData, next: VirtualizedCellRenderData): boolean {
        return previous.left !== next.left ||
            previous.width !== next.width ||
            previous.rowIndex !== next.rowIndex ||
            previous.textShiftPx !== next.textShiftPx ||
            previous.isFocused !== next.isFocused ||
            previous.isCurrent !== next.isCurrent ||
            previous.isPast !== next.isPast;
    }

    private hasCellContentDelta(previous: VirtualizedCellRenderData, next: VirtualizedCellRenderData): boolean {
        if (previous.kind !== next.kind) {
            return true;
        }

        if (this.cellRenderer.getCellWidthTier(previous.width) !== this.cellRenderer.getCellWidthTier(next.width)) {
            return true;
        }

        if (this.cellRenderer.getCellVisibleWidthTier(previous) !== this.cellRenderer.getCellVisibleWidthTier(next)) {
            return true;
        }

        if (this.cellRenderer.isSliverCell(previous) !== this.cellRenderer.isSliverCell(next)) {
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

    private getOrCreateElement(): HTMLElement {
        for (const [key, element] of this.elementPool) {
            this.elementPool.delete(key);
            this.cellRenderer.resetElement(element);
            return element;
        }

        return this.cellRenderer.createElement();
    }

    /**
     * Return an element to the pool for later reuse.
     * If pool exceeds MAX_POOL_SIZE, oldest entries are removed.
     */
    private recycleElement(_key: string, cellData: VirtualizedCellRenderData): void {
        const element = cellData.cellElement;
        if (!element) return;

        element.remove();
        element.classList.remove(
            EPG_CLASSES.CELL_FOCUSED,
            EPG_CLASSES.CELL_CURRENT,
            EPG_CLASSES.CELL_PAST,
            EPG_CLASSES.CELL_LOADING
        );

        const poolKey = `pool-${Date.now()}-${this.poolSequence++}`;
        this.elementPool.set(poolKey, element);

        if (this.elementPool.size > EPG_CONSTANTS.MAX_POOL_SIZE) {
            const oldestKey = this.elementPool.keys().next().value;
            if (oldestKey !== undefined) {
                this.elementPool.delete(oldestKey);
            }
        }
    }

    private renderCell(key: string, cellData: VirtualizedCellRenderData, nowMs: number): void {
        if (!this.contentElement || !this.config) return;

        const element = this.getOrCreateElement();
        cellData.cellElement = element;
        this.cellRenderer.updateCellContent(cellData, nowMs);
        this.cellRenderer.updatePositionPresentation(cellData);

        element.style.left = `${cellData.left}px`;
        element.style.width = `${cellData.width}px`;
        element.style.top = `${(cellData.rowIndex - this.channelOffset) * this.config.rowHeight}px`;
        element.setAttribute('data-key', key);

        this.contentElement.appendChild(element);
    }

    private updateCellPosition(cellData: VirtualizedCellRenderData): void {
        const element = cellData.cellElement;
        if (!element || !this.config) return;

        this.cellRenderer.updatePositionPresentation(cellData);
        element.style.left = `${cellData.left}px`;
        element.style.width = `${cellData.width}px`;
        element.style.top = `${(cellData.rowIndex - this.channelOffset) * this.config.rowHeight}px`;
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
                    if (wasCurrent !== isCurrent || wasPast !== isPast) {
                        this.cellRenderer.updateCellContent(cellData, nowMs);
                    }
                    this.cellRenderer.updateTemporalPresentation(cellData, nowMs);
                }
            } else if (element) {
                cellData.isCurrent = false;
                cellData.isPast = false;
                this.cellRenderer.updateTemporalPresentation(cellData, nowMs);
            }
        }
    }

    public clearFocusedTickerState(): void {
        this.cellRenderer.clearFocusedTickers();
    }

    private syncFocusedTitleTickerForVisibleFocus(): void {
        const focusedKey = this.focusedVisibleCellKey;
        const focusedCell = focusedKey ? this.visibleCells.get(focusedKey) : null;
        this.cellRenderer.syncFocusedTicker(focusedCell ?? null);
    }

    forceRecycleAll(): void {
        this.cellRenderer.clearFocusedTickers();
        for (const [key, cellData] of this.visibleCells) {
            this.recycleElement(key, cellData);
        }
        this.visibleCells.clear();

        this.elementPool.clear();
    }

    /**
     * Set focus on a cell element.
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
                    this.cellRenderer.updateCellContent(previousFocused, nowMs);
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
                    this.cellRenderer.updateCellContent(candidate, nowMs);
                }
            }
        }

        if (targetCellData) {
            const focusChanged = !targetCellData.isFocused;
            targetCellData.isFocused = true;
            if (targetCellData.cellElement) {
                targetCellData.cellElement.classList.add(EPG_CLASSES.CELL_FOCUSED);
                if (focusChanged) {
                    this.cellRenderer.updateCellContent(targetCellData, nowMs);
                }
            }
            this.focusedVisibleCellKey = targetCellData.key;
            this.focusedTimeMs = focusTimeMs ?? programStartTime;
        } else {
            this.focusedVisibleCellKey = null;
            this.focusedTimeMs = null;
        }
        if (options?.syncTicker !== false) {
            this.syncFocusedTitleTickerForVisibleFocus();
        }

        if (targetCellData?.cellElement) {
            return targetCellData.cellElement;
        }

        return null;
    }

    getElementCount(): number {
        return this.visibleCells.size;
    }

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
