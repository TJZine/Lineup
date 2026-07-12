import type { EpgLayoutMode } from '../../settings/EpgPreferencesStore';
import type { AppErrorCode } from '../../../types/app-errors';
import type {
    EpgChannel,
    EpgItemDetails,
    EpgScheduleWindow,
    EpgScheduledProgram,
} from './model/domainTypes';
import type { IEPGDebugRuntime } from './debug/EPGDebugRuntime';
import type { EpgUiStatus } from './coordinator/EPGCoordinatorContracts';

// Re-export EPG-owned aliases for UI contracts.
export type ScheduledProgram = EpgScheduledProgram;
export type ScheduleWindow = EpgScheduleWindow;
export type ChannelConfig = EpgChannel;
export type EPGUiStatus = EpgUiStatus;


export interface EPGConfig {
    containerId: string;
    visibleChannels: number;
    /** Grid time slot granularity (minutes) */
    timeSlotMinutes: number;
    visibleHours: number;
    /** Total hours in schedule (typically 24) */
    totalHours: number;
    /** Pixels per minute (width scaling) */
    pixelsPerMinute: number;
    /** Auto-fit pixels per minute to available width */
    autoFitPixelsPerMinute?: boolean;
    /** Minimum auto-fit pixels per minute */
    minPixelsPerMinute?: number;
    /** Maximum auto-fit pixels per minute */
    maxPixelsPerMinute?: number;
    rowHeight: number;
    showCurrentTimeIndicator: boolean;
    autoScrollToNow: boolean;
    onVisibleRangeChange?: (range: EpgVisibleRange) => void;
    /** Optional callback to resolve relative Plex thumb paths to absolute URLs, with optional size hints. */
    resolveThumbUrl?: (pathOrUrl: string | null, width?: number, height?: number) => string | null;
    /** Optional callback to fetch Plex item details for focused programs (used for HDR/DV badges). */
    fetchItemDetails?: (
        ratingKey: string,
        options?: { signal?: AbortSignal | null }
    ) => Promise<EpgItemDetails | null>;
    isVideoPlaying?: () => boolean;
    layoutMode?: EpgLayoutMode;
    showNowWatchingBanner?: boolean;
    getCurrentChannelInfo?: () => {
        channelNumber: number;
        channelName: string;
        programTitle: string;
        timeLabel: string;
    } | null;
    onLayoutModeChange?: (mode: EpgLayoutMode) => void;
    /** Optional explicit debug runtime shared by EPG UI and runtime collaborators. */
    debugRuntime?: IEPGDebugRuntime | null;
    /**
     * Debug render log rate limit (ms). When debug is enabled we avoid writing to storage on every RAF.
     * Set to 0 to log every render (not recommended).
     */
    debugRenderGridLogIntervalMs?: number;
}

export interface EpgVisibleRange {
    channelStart: number;
    channelEndExclusive: number;
    timeStartMs: number;
    timeEndMs: number;
}

export interface EPGState {
    isVisible: boolean;
    focusedCell: EPGFocusPosition | null;
    scrollPosition: {
        channelOffset: number;
        timeOffset: number;
    };
    viewWindow: {
        startTime: number;
        endTime: number;
        startChannelIndex: number;
        endChannelIndexExclusive: number;
    };
    currentTime: number;
}

export type EPGFocusPosition =
    | {
        kind: 'program';
        channelIndex: number;
        programIndex: number;
        program: ScheduledProgram;
        /** Focus time used for navigation reconciliation */
        focusTimeMs: number;
        cellElement: HTMLElement | null;
    }
    | {
        kind: 'placeholder';
        channelIndex: number;
        /** Placeholder entries are not tied to a program index */
        programIndex: -1;
        placeholder: {
            label: string;
            scheduledStartTime: number;
            scheduledEndTime: number;
        };
        /** Focus time used for navigation reconciliation */
        focusTimeMs: number;
        cellElement: HTMLElement | null;
    };

export interface EPGChannelRow {
    channel: ChannelConfig;
    programs: EPGProgramCell[];
}

export interface EPGProgramCell {
    program: ScheduledProgram;
    left: number;
    width: number;
    isPartial: boolean;
    isCurrent: boolean;
    isFocused: boolean;
}

export interface VirtualizedGridState {
    visibleRows: number[];
    channelOffset: number;
    visibleTimeRange: { start: number; end: number };
    recycledElements: Map<string, HTMLElement>;
}

export interface EPGEventMap {
    open: void;
    close: void;
    focusChange: EPGFocusPosition;
    channelSelected: { channel: ChannelConfig; program: ScheduledProgram };
    programSelected: ScheduledProgram;
    libraryFilterChanged: { libraryId: string | null };
    timeScroll: { direction: 'left' | 'right'; newOffset: number };
    channelScroll: { direction: 'up' | 'down'; newOffset: number };
}


/**
 * Internal state for EPG component.
 */
export interface EPGInternalState {
    isInitialized: boolean;
    isVisible: boolean;
    channels: ChannelConfig[];
    schedules: Map<string, ScheduleWindow>;
    scheduleLoadTimes: Map<string, number>;
    focusedCell: EPGFocusPosition | null;
    /** Last requested focus time (used when schedules are missing) */
    focusTimeMs: number;
    scrollPosition: {
        channelOffset: number;
        timeOffset: number;
    };
    currentTime: number;
    /** Grid anchor time (start of schedule day) */
    gridAnchorTime: number;
    lastRenderTime: number;
}

/**
 * EPG error types for error boundary handling.
 */
export type EPGErrorType = Extract<
    AppErrorCode,
    | AppErrorCode.RENDER_ERROR
    | AppErrorCode.SCROLL_TIMEOUT
    | AppErrorCode.POOL_EXHAUSTED
    | AppErrorCode.EMPTY_CHANNEL
    | AppErrorCode.NAV_BOUNDARY
    | AppErrorCode.PARSE_ERROR
>;

export type CellRenderData =
    | {
        kind: 'program';
        key: string;
        channelId: string;
        rowIndex: number;
        program: ScheduledProgram;
        left: number;
        width: number;
        isPartial: boolean;
        isCurrent: boolean;
        isPast: boolean;
        isFocused: boolean;
        /** Whether cell is a buffer-only entry outside the visible window */
        isBufferOnly: boolean;
        /**
         * Horizontal text shift (pixels) applied to title/show/time so labels remain readable
         * when the cell is partially clipped on the left due to time scrolling.
         */
        textShiftPx: number;
        cellElement: HTMLElement | null;
    }
    | {
        kind: 'placeholder';
        key: string;
        channelId: string;
        rowIndex: number;
        placeholder: {
            label: string;
            scheduledStartTime: number;
            scheduledEndTime: number;
        };
        left: number;
        width: number;
        isPartial: boolean;
        isCurrent: boolean;
        isPast: boolean;
        isFocused: boolean;
        isBufferOnly: boolean;
        /** See `program.textShiftPx` (placeholders usually 0). */
        textShiftPx: number;
        cellElement: HTMLElement | null;
    };

export interface TimeSlot {
    time: number;
    label: string;
    left: number;
}
