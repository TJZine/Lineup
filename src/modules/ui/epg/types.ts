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

export type EpgRowLifecycleKind = 'loading' | 'retrying' | 'unavailable';

export interface EpgRowLifecycleState {
    kind: EpgRowLifecycleKind;
    rangeKey: string;
}

/**
 * Metadata captured when a schedule is materialized into the EPG component.
 * The channel snapshot is intentionally opaque to the component; runtime
 * callers use it only to prove that a held schedule belongs to the same
 * channel/source revision before reusing it.
 */
export interface EpgScheduleLoadMetadata {
    loadedAt: number;
    channelSnapshot: ChannelConfig;
}

export interface EpgHeldScheduleSnapshot extends EpgScheduleLoadMetadata {
    schedule: ScheduleWindow;
}

type EpgScheduleIdentityValue =
    | null
    | boolean
    | number
    | string
    | EpgScheduleIdentityValue[]
    | { [key: string]: EpgScheduleIdentityValue };

function canonicalizeEpgScheduleIdentityValue(
    value: unknown,
    activeObjects: Set<object>
): EpgScheduleIdentityValue | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : String(value);
    }
    if (Array.isArray(value)) {
        if (activeObjects.has(value)) {
            return undefined;
        }
        activeObjects.add(value);
        const canonical = value
            .map((item) => canonicalizeEpgScheduleIdentityValue(item, activeObjects) ?? null);
        activeObjects.delete(value);
        return canonical;
    }
    if (typeof value === 'object') {
        if (activeObjects.has(value)) {
            return undefined;
        }
        activeObjects.add(value);
        const canonical: { [key: string]: EpgScheduleIdentityValue } = {};
        for (const key of Object.keys(value).sort()) {
            const normalized = canonicalizeEpgScheduleIdentityValue(
                (value as Record<string, unknown>)[key],
                activeObjects
            );
            if (normalized !== undefined) {
                canonical[key] = normalized;
            }
        }
        activeObjects.delete(value);
        return canonical;
    }
    return String(value);
}

/**
 * Return the compact identity for the inputs that can change a channel's
 * materialized schedule. Object keys are sorted recursively while array order
 * is retained, so equivalent source snapshots do not depend on insertion
 * order and every schedule-affecting field participates in the comparison.
 */
export function getEpgScheduleChannelIdentity(channel: ChannelConfig): string {
    const scheduleInputs = {
        id: channel.id,
        number: channel.number,
        updatedAt: channel.updatedAt,
        sourceLibraryId: channel.sourceLibraryId,
        buildStrategy: channel.buildStrategy,
        lineupReplicaIndex: channel.lineupReplicaIndex,
        isPlaybackModeVariant: channel.isPlaybackModeVariant,
        contentSource: channel.contentSource,
        playbackMode: channel.playbackMode,
        shuffleSeed: channel.shuffleSeed,
        blockSize: channel.blockSize,
        phaseSeed: channel.phaseSeed,
        startTimeAnchor: channel.startTimeAnchor,
        contentFilters: channel.contentFilters,
        sortOrder: channel.sortOrder,
        skipIntros: channel.skipIntros,
        skipCredits: channel.skipCredits,
        maxEpisodeRunTimeMs: channel.maxEpisodeRunTimeMs,
        minEpisodeRunTimeMs: channel.minEpisodeRunTimeMs,
    };
    const canonical = canonicalizeEpgScheduleIdentityValue(scheduleInputs, new Set<object>());
    return canonical === undefined ? '' : JSON.stringify(canonical);
}

/**
 * Compare the channel/source identity carried by a schedule owner snapshot.
 * Keep this shared by the component and refresh runtime so held-schedule reuse
 * and in-flight adoption apply the same authority contract.
 */
export function isMatchingEpgChannelSnapshot(a: ChannelConfig, b: ChannelConfig): boolean {
    const aIdentity = getEpgScheduleChannelIdentity(a);
    const bIdentity = getEpgScheduleChannelIdentity(b);
    return aIdentity !== '' && aIdentity === bIdentity;
}

export const EPG_ROW_LOADING_LABEL = 'Loading...' as const;
export const EPG_ROW_RETRYING_LABEL = 'Retrying...' as const;
export const EPG_ROW_UNAVAILABLE_LABEL = 'Unavailable — OK to retry' as const;

export interface EPGEventMap {
    open: void;
    close: void;
    focusChange: EPGFocusPosition;
    channelSelected: { channel: ChannelConfig; program: ScheduledProgram };
    programSelected: ScheduledProgram;
    libraryFilterChanged: { libraryId: string | null };
    rowRetryRequested: { channelId: string };
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
    rowLifecycle: Map<string, EpgRowLifecycleState>;
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
            lifecycle: EpgRowLifecycleKind;
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
