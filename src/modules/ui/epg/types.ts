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


/**
 * EPG component configuration
 */
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
    /** Show current time indicator */
    showCurrentTimeIndicator: boolean;
    /** Auto-scroll to current time on open */
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
    /** Optional callback to fetch current channel + program info */
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
    channelEnd: number;
    timeStartMs: number;
    timeEndMs: number;
}

/**
 * EPG component state (externally visible)
 */
export interface EPGState {
    /** Is EPG visible */
    isVisible: boolean;
    focusedCell: EPGFocusPosition | null;
    scrollPosition: {
        /** First visible channel index */
        channelOffset: number;
        /** Minutes from schedule start */
        timeOffset: number;
    };
    /** Visible window bounds */
    viewWindow: {
        startTime: number;
        endTime: number;
        startChannelIndex: number;
        endChannelIndex: number;
    };
    currentTime: number;
}

/**
 * EPG focus position
 */
export type EPGFocusPosition =
    | {
        kind: 'program';
        /** Channel row index */
        channelIndex: number;
        /** Program index within channel */
        programIndex: number;
        program: ScheduledProgram;
        /** Focus time used for navigation reconciliation */
        focusTimeMs: number;
        cellElement: HTMLElement | null;
    }
    | {
        kind: 'placeholder';
        /** Channel row index */
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

/**
 * EPG channel row data
 */
export interface EPGChannelRow {
    /** Channel config */
    channel: ChannelConfig;
    /** Programs to display */
    programs: EPGProgramCell[];
}

/**
 * EPG program cell data
 */
export interface EPGProgramCell {
    program: ScheduledProgram;
    left: number;
    /** Cell width in pixels */
    width: number;
    /** Extends beyond visible area */
    isPartial: boolean;
    /** Currently airing */
    isCurrent: boolean;
    isFocused: boolean;
}

/**
 * Virtualized grid state for EPG
 */
export interface VirtualizedGridState {
    /** Currently rendered channel indices */
    visibleRows: number[];
    channelOffset: number;
    /** Visible time window */
    visibleTimeRange: { start: number; end: number };
    recycledElements: Map<string, HTMLElement>;
}

/**
 * EPG events
 */
export interface EPGEventMap {
    open: void;
    close: void;
    focusChange: EPGFocusPosition;
    channelSelected: { channel: ChannelConfig; program: ScheduledProgram };
    programSelected: ScheduledProgram;
    libraryFilterChanged: { libraryId: string | null };
    timeScroll: { direction: 'left' | 'right'; newOffset: number };
    channelScroll: { direction: 'up' | 'down'; newOffset: number };
    /** Index signature for EventEmitter compatibility */
    [key: string]: unknown;
}


/**
 * Internal state for EPG component.
 */
export interface EPGInternalState {
    /** Whether EPG is initialized */
    isInitialized: boolean;
    /** Whether EPG is visible */
    isVisible: boolean;
    channels: ChannelConfig[];
    /** Schedule windows by channel ID */
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
    /** Last render timestamp for throttling */
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

/**
 * Cell render data for virtualization.
 */
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
        /** Placeholders are never past */
        isPast: boolean;
        isFocused: boolean;
        /** Placeholders are visible-window cells, not buffer-only entries */
        isBufferOnly: boolean;
        /** See `program.textShiftPx` (placeholders usually 0). */
        textShiftPx: number;
        cellElement: HTMLElement | null;
    };

/**
 * Time header slot data.
 */
export interface TimeSlot {
    /** Slot time (Unix ms) */
    time: number;
    /** Display label (e.g., "12:30 PM") */
    label: string;
    left: number;
}
