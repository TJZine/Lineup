import type { EPGCellRenderer, EPGRenderedCellData } from './cells/EPGCellRenderer';
import { positionCell } from './EPGProgramCellPosition';
import type {
    EPGConfig,
    ScheduledProgram,
    ScheduleWindow,
    VirtualizedGridState,
} from '../types';

type VirtualizedCellRenderData = EPGRenderedCellData;

export type ScheduledRowRenderContext = {
    visibleWindowStartMinutes: number;
    visibleWindowEndMinutes: number;
    stageCell: (
        cellData: VirtualizedCellRenderData,
        isFocusedCell: boolean,
        overlapsVisibleWindow: boolean
    ) => void;
};

export type AddPlaceholderCell = (
    channelId: string,
    rowIndex: number,
    startMinutes: number,
    endMinutes: number,
    label: string,
    focusedCellKey: string | undefined,
    stageCell: ScheduledRowRenderContext['stageCell']
) => void;

export interface CollectScheduledRowCellsArgs {
    channelId: string;
    rowIndex: number;
    schedule: ScheduleWindow;
    range: VirtualizedGridState;
    context: ScheduledRowRenderContext;
    focusedCellKey: string | undefined;
    nowMs: number;
    config: EPGConfig;
    gridAnchorTime: number;
    cellRenderer: EPGCellRenderer;
    addPlaceholderCell: AddPlaceholderCell;
}

type ScheduledProgramRenderData = {
    cellData: VirtualizedCellRenderData;
    overlapsVisibleWindow: boolean;
    scheduledStartTime: number;
    scheduledEndTime: number;
};

export function collectScheduledRowCells(args: CollectScheduledRowCellsArgs): void {
    let hadVisibleOverlap = false;
    const visibleWindowStartMs = args.gridAnchorTime + (Math.max(0, args.context.visibleWindowStartMinutes) * 60000);
    const visibleWindowEndMs = args.gridAnchorTime + (Math.max(0, args.context.visibleWindowEndMinutes) * 60000);
    let lastCoveredTimeMs = visibleWindowStartMs;

    for (const program of args.schedule.programs) {
        if (!overlapsTimeRange(program, args.range.visibleTimeRange, args.gridAnchorTime)) {
            continue;
        }

        const renderData = buildProgramRenderData(args, program, visibleWindowStartMs, visibleWindowEndMs);
        if (renderData.overlapsVisibleWindow) {
            hadVisibleOverlap = true;
        }

        args.context.stageCell(
            renderData.cellData,
            renderData.cellData.isFocused,
            renderData.overlapsVisibleWindow
        );
        lastCoveredTimeMs = stageGapBeforeProgram(args, renderData, lastCoveredTimeMs, visibleWindowEndMs);
    }

    stageTrailingPlaceholder(args, hadVisibleOverlap, lastCoveredTimeMs, visibleWindowEndMs);
}

function overlapsTimeRange(
    program: ScheduledProgram,
    timeRange: { start: number; end: number },
    gridAnchorTime: number
): boolean {
    const programStartMinutes = (program.scheduledStartTime - gridAnchorTime) / 60000;
    const programEndMinutes = (program.scheduledEndTime - gridAnchorTime) / 60000;

    return programEndMinutes > timeRange.start && programStartMinutes < timeRange.end;
}

function buildProgramRenderData(
    args: CollectScheduledRowCellsArgs,
    program: ScheduledProgram,
    visibleWindowStartMs: number,
    visibleWindowEndMs: number
): ScheduledProgramRenderData {
    const cellKey = `${args.channelId}-${program.scheduledStartTime}`;
    const overlapsVisibleWindow = program.scheduledEndTime > visibleWindowStartMs &&
        program.scheduledStartTime < visibleWindowEndMs;
    const cell = positionCell(program, args.gridAnchorTime, args.config.pixelsPerMinute, args.nowMs);
    const rawLeft = cell.left;
    let left = rawLeft;
    let width = cell.width;
    if (rawLeft < 0) {
        width = Math.max(20, width + left);
        left = 0;
    }

    const programStartMinutes = (program.scheduledStartTime - args.gridAnchorTime) / 60000;
    const programEndMinutes = (program.scheduledEndTime - args.gridAnchorTime) / 60000;
    const textMetrics = args.cellRenderer.computeVisibleTextMetrics({
        rawLeftPx: rawLeft,
        clippedLeftPx: left,
        clippedWidthPx: width,
        visibleWindowStartMinutes: args.context.visibleWindowStartMinutes,
        visibleWindowEndMinutes: args.context.visibleWindowEndMinutes,
        pixelsPerMinute: args.config.pixelsPerMinute,
    });

    return {
        cellData: {
            kind: 'program',
            key: cellKey,
            channelId: args.channelId,
            rowIndex: args.rowIndex,
            program,
            left,
            width,
            isPartial: programStartMinutes < args.context.visibleWindowStartMinutes ||
                programEndMinutes > args.context.visibleWindowEndMinutes,
            isCurrent: cell.isCurrent,
            isPast: args.nowMs >= program.scheduledEndTime,
            isFocused: args.focusedCellKey === cellKey,
            isBufferOnly: !overlapsVisibleWindow,
            textShiftPx: textMetrics.safeTextShiftPx,
            cellElement: null,
            visibleWidthPx: textMetrics.visibleWidthPx,
        },
        overlapsVisibleWindow,
        scheduledStartTime: program.scheduledStartTime,
        scheduledEndTime: program.scheduledEndTime,
    };
}

function stageGapBeforeProgram(
    args: CollectScheduledRowCellsArgs,
    programData: ScheduledProgramRenderData,
    lastCoveredTimeMs: number,
    visibleWindowEndMs: number
): number {
    if (!programData.overlapsVisibleWindow) {
        return lastCoveredTimeMs;
    }

    if (programData.scheduledStartTime > lastCoveredTimeMs) {
        const gapEndMs = Math.min(programData.scheduledStartTime, visibleWindowEndMs);
        if (gapEndMs > lastCoveredTimeMs) {
            args.addPlaceholderCell(
                args.channelId,
                args.rowIndex,
                (lastCoveredTimeMs - args.gridAnchorTime) / 60000,
                (gapEndMs - args.gridAnchorTime) / 60000,
                'No Program',
                args.focusedCellKey,
                args.context.stageCell
            );
        }
    }

    return Math.max(lastCoveredTimeMs, programData.scheduledEndTime);
}

function stageTrailingPlaceholder(
    args: CollectScheduledRowCellsArgs,
    hadVisibleOverlap: boolean,
    lastCoveredTimeMs: number,
    visibleWindowEndMs: number
): void {
    if (!hadVisibleOverlap) {
        args.addPlaceholderCell(
            args.channelId,
            args.rowIndex,
            Math.max(0, args.context.visibleWindowStartMinutes),
            Math.max(0, args.context.visibleWindowEndMinutes),
            'No Program',
            args.focusedCellKey,
            args.context.stageCell
        );
    } else if (lastCoveredTimeMs < visibleWindowEndMs) {
        args.addPlaceholderCell(
            args.channelId,
            args.rowIndex,
            (lastCoveredTimeMs - args.gridAnchorTime) / 60000,
            Math.max(0, args.context.visibleWindowEndMinutes),
            'No Program',
            args.focusedCellKey,
            args.context.stageCell
        );
    }
}
