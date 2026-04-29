import type { IShuffleGenerator } from './interfaces';
import type {
    ScheduleConfig,
    ScheduledProgram,
    ScheduleIndex,
    ResolvedContentItem,
    SchedulerPlaybackMode,
} from './types';
import { SCHEDULER_ERROR_MESSAGES } from './constants';
import { applyBlockPlaybackMode } from '../shared/blockPlayback';

function assertNeverPlaybackMode(mode: never): never {
    throw new Error(`Unknown scheduler playback mode: ${String(mode)}`);
}

export function buildScheduleIndex(
    config: ScheduleConfig,
    shuffler: IShuffleGenerator
): ScheduleIndex {
    if (config.content.length === 0) {
        throw new Error(SCHEDULER_ERROR_MESSAGES.EMPTY_CHANNEL);
    }

    const orderedItems = applyPlaybackMode(
        config.content,
        config.playbackMode,
        config.shuffleSeed,
        shuffler,
        config.blockSize
    );

    const itemStartOffsets: number[] = [];
    let cumulativeOffset = 0;

    for (let i = 0; i < orderedItems.length; i++) {
        itemStartOffsets.push(cumulativeOffset);
        const item = orderedItems[i];
        if (item) {
            cumulativeOffset += item.durationMs;
        }
    }

    const totalLoopDurationMs = cumulativeOffset;

    // Prevent division by zero in modulo/time lookups.
    if (totalLoopDurationMs === 0) {
        throw new Error(SCHEDULER_ERROR_MESSAGES.INVALID_SCHEDULE_DURATION);
    }

    return {
        channelId: config.channelId,
        generatedAt: Date.now(),
        totalLoopDurationMs,
        itemStartOffsets,
        orderedItems,
    };
}

export function binarySearchForItem(
    positionInLoop: number,
    itemStartOffsets: number[]
): number {
    let low = 0;
    let high = itemStartOffsets.length - 1;

    while (low < high) {
        const mid = Math.ceil((low + high + 1) / 2);
        const midOffset = itemStartOffsets[mid];
        if (midOffset !== undefined && midOffset <= positionInLoop) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }

    return low;
}

export function calculateProgramAtTime(
    queryTime: number,
    index: ScheduleIndex,
    anchorTime: number
): ScheduledProgram {
    const { totalLoopDurationMs, itemStartOffsets, orderedItems } = index;

    const elapsedSinceAnchor = queryTime - anchorTime;

    const loopNumber = Math.floor(elapsedSinceAnchor / totalLoopDurationMs);

    const positionInLoop =
        ((elapsedSinceAnchor % totalLoopDurationMs) + totalLoopDurationMs) %
        totalLoopDurationMs;

    const itemIndex = binarySearchForItem(positionInLoop, itemStartOffsets);

    const itemStartOffset = itemStartOffsets[itemIndex] ?? 0;
    const offsetInItem = positionInLoop - itemStartOffset;

    const item = orderedItems[itemIndex];
    if (!item) {
        throw new Error('Item not found at index ' + itemIndex);
    }
    const remainingMs = item.durationMs - offsetInItem;

    const loopStartTime = anchorTime + loopNumber * totalLoopDurationMs;
    const absoluteStart = loopStartTime + itemStartOffset;
    const absoluteEnd = absoluteStart + item.durationMs;

    const now = Date.now();
    const isCurrent = now >= absoluteStart && now < absoluteEnd;

    return {
        item,
        scheduledStartTime: absoluteStart,
        scheduledEndTime: absoluteEnd,
        elapsedMs: offsetInItem,
        remainingMs,
        scheduleIndex: itemIndex,
        loopNumber,
        streamDescriptor: null,
        isCurrent,
    };
}

export function calculateNextProgram(
    currentProgram: ScheduledProgram,
    index: ScheduleIndex,
    anchorTime: number
): ScheduledProgram {
    return calculateProgramAtTime(
        currentProgram.scheduledEndTime + 1,
        index,
        anchorTime
    );
}

export function calculatePreviousProgram(
    currentProgram: ScheduledProgram,
    index: ScheduleIndex,
    anchorTime: number
): ScheduledProgram {
    return calculateProgramAtTime(
        currentProgram.scheduledStartTime - 1,
        index,
        anchorTime
    );
}

export function applyPlaybackMode(
    items: ResolvedContentItem[],
    mode: SchedulerPlaybackMode,
    seed: number,
    shuffler: IShuffleGenerator,
    blockSize?: number
): ResolvedContentItem[] {
    switch (mode) {
        case 'sequential':
            return items.map((item, index) => ({
                ...item,
                scheduledIndex: index,
            }));

        case 'shuffle': {
            const shuffled = shuffler.shuffle(items, seed);
            return shuffled.map((item, index) => ({
                ...item,
                scheduledIndex: index,
            }));
        }

        case 'block': {
            const normalizedBlockSize =
                typeof blockSize === 'number' && Number.isFinite(blockSize)
                    ? blockSize
                    : 3;
            const effectiveBlockSize = Math.max(1, Math.floor(normalizedBlockSize));
            const ordered = applyBlockPlaybackMode({
                items,
                seed,
                blockSize: effectiveBlockSize,
                shuffleKeys: (keys, seedValue) => shuffler.shuffle(keys, seedValue),
            });
            return ordered.map((item, index) => ({
                ...item,
                scheduledIndex: index,
            }));
        }

        default:
            return assertNeverPlaybackMode(mode);
    }
}

/**
 * MAX_WINDOW_PROGRAMS is a memory safety guard for EPG window generation.
 * A 24-hour guide at 30-minute programs across 20 visible channels is about
 * 1000 entries, and this cap prevents unbounded edge-case growth.
 */
const MAX_WINDOW_PROGRAMS = 1000;

export function generateScheduleWindow(
    startTime: number,
    endTime: number,
    index: ScheduleIndex,
    anchorTime: number,
    output?: ScheduledProgram[]
): ScheduledProgram[] {
    const programs = output ?? [];
    programs.length = 0;

    if (endTime <= startTime) {
        return programs;
    }

    let currentProgram = calculateProgramAtTime(startTime, index, anchorTime);
    programs.push(currentProgram);

    while (currentProgram.scheduledEndTime < endTime && programs.length < MAX_WINDOW_PROGRAMS) {
        currentProgram = calculateNextProgram(currentProgram, index, anchorTime);
        programs.push(currentProgram);
    }

    return programs;
}
