import type { ChannelConfig } from '../../../scheduler/channel-manager';
import type { EPGConfig } from '../types';
import type {
    EpgPastItemsWindow,
    EpgScheduleRangeSnapshot,
} from '../../../settings/EpgPreferencesStore';
import {
    buildLibraries,
    countLibraryTypeVotes,
    countLibraryTypeVotesAcrossAllChannels,
} from './EPGLibraryUtils';

export type EpgScheduleRange = { startTime: number; endTime: number };

export type EpgScheduleRangeDeps = {
    getEpgConfig: () => EPGConfig | null;
    getChannelManager: () => { getAllChannels: () => ChannelConfig[] } | null;
    getLocalMidnightMs: (timeMs: number) => number;
};

export type EpgStorageSnapshotForScheduleRange = EpgScheduleRangeSnapshot;
export type NormalizedLibraryFilterState = {
    selectedId: string | null;
    tabsEnabled: boolean;
    shouldFilter: boolean;
    libraries: Array<{ id: string; name: string }>;
    shouldClearPersistedSelection: boolean;
};

export const computeNormalizedLibraryFilterState = (
    all: ChannelConfig[],
    storage: EpgStorageSnapshotForScheduleRange
): NormalizedLibraryFilterState => {
    const tabsEnabled = storage.tabsEnabled;
    const requestedSelectionId = storage.selectedLibraryId;
    let selectedId = requestedSelectionId;
    const libraries = buildLibraries(all);
    const hasMultipleLibraries = libraries.length > 1;
    const hasSelectedMatch = selectedId
        ? libraries.some((lib) => lib.id === selectedId) ||
          all.some((c) =>
            c.sourceLibraryId === selectedId ||
            (c.contentSource.type === 'library' && c.contentSource.libraryId === selectedId)
          )
        : false;

    const hasInvalidSelectedLibrary = Boolean(selectedId) && !hasSelectedMatch;
    if (!tabsEnabled || !hasMultipleLibraries || hasInvalidSelectedLibrary) {
        selectedId = null;
    }

    const shouldFilter = tabsEnabled && hasMultipleLibraries && Boolean(selectedId);
    const shouldClearPersistedSelection =
        Boolean(requestedSelectionId) &&
        selectedId === null &&
        (hasInvalidSelectedLibrary || (tabsEnabled && hasMultipleLibraries));

    return {
        selectedId,
        tabsEnabled,
        shouldFilter,
        libraries,
        shouldClearPersistedSelection,
    };
};

export const selectVisibleChannelsForLibraryFilter = (
    all: ChannelConfig[],
    selectedId: string | null,
    shouldFilter: boolean
): ChannelConfig[] => {
    if (!shouldFilter || !selectedId) return all;
    return all.filter((channel) => {
        if (channel.sourceLibraryId === selectedId) return true;
        if (channel.contentSource.type === 'library' && channel.contentSource.libraryId === selectedId) return true;
        return false;
    });
};

export const computeEffectivePastWindowMinutes = (
    all: ChannelConfig[],
    storage: EpgStorageSnapshotForScheduleRange,
    filter: {
        selectedId: string | null;
        shouldFilter: boolean;
        shouldClearPersistedSelection: boolean;
    }
): number => {
    const setting: EpgPastItemsWindow = storage.pastItemsWindowSetting;
    if (setting !== 'auto') {
        return Number(setting);
    }

    if (!filter.shouldFilter || !filter.selectedId) {
        const { movieVotes, showVotes, unknownVotes } = countLibraryTypeVotesAcrossAllChannels(all);
        if (unknownVotes === 0 && showVotes > 0 && movieVotes === 0) {
            return 0;
        }
        return 15;
    }

    const { movieVotes, showVotes } = countLibraryTypeVotes(all, filter.selectedId);
    if (showVotes > 0 && movieVotes === 0) {
        return 0;
    }
    return 15;
};

export const computeEpgScheduleRangeMs = (
    deps: EpgScheduleRangeDeps,
    nowMs: number,
    storage: EpgStorageSnapshotForScheduleRange
): { startTime: number; endTime: number } | null => {
    const config = deps.getEpgConfig();
    if (!config) return null;

    const totalHours = config.totalHours;
    const slotMinutes = config.timeSlotMinutes;
    const slotMs = slotMinutes * 60_000;

    const channelManager = deps.getChannelManager();
    const allChannels = channelManager?.getAllChannels() ?? [];
    const filter = computeNormalizedLibraryFilterState(allChannels, storage);
    const pastWindowMinutes = computeEffectivePastWindowMinutes(allChannels, storage, filter);

    const startTime = Math.max(
        Math.floor((nowMs - pastWindowMinutes * 60_000) / slotMs) * slotMs,
        deps.getLocalMidnightMs(nowMs)
    );
    const endTime = startTime + totalHours * 60 * 60 * 1000;
    return { startTime, endTime };
};

export type BackgroundWarmQueueCaps = {
    maxQueuedChannels: number;
    maxConcurrency: number;
};

export const computeBackgroundWarmQueueCaps = (
    channelCount: number,
    visibleCount: number,
    aggressive: boolean
): BackgroundWarmQueueCaps => {
    if (channelCount >= 260) {
        if (aggressive) {
            return { maxQueuedChannels: 140, maxConcurrency: 2 };
        }
        return { maxQueuedChannels: 96, maxConcurrency: 1 };
    }

    const baseQueue = aggressive
        ? 128
        : 64;
    const maxQueueCap = aggressive ? 220 : 120;
    const scaledQueue = Math.max(baseQueue, visibleCount * (aggressive ? 20 : 12));
    const maxQueuedChannels = Math.min(
        maxQueueCap,
        Math.max(48, Math.min(channelCount, scaledQueue))
    );
    const maxConcurrency = aggressive
        ? (channelCount >= 120 ? 3 : 2)
        : (channelCount >= 120 ? 2 : 1);

    return { maxQueuedChannels, maxConcurrency };
};

type PrefetchCaps = {
    visibleCount: number;
    maxQueuedChannels: number;
    aggressive: boolean;
};

const getChannelOverscanCount = (channelCount: number, aggressive: boolean): number => {
    if (aggressive) {
        if (channelCount >= 200) return 16;
        if (channelCount >= 120) return 12;
        if (channelCount >= 80) return 10;
        return 8;
    }

    if (channelCount >= 200) return 10;
    if (channelCount >= 120) return 8;
    if (channelCount >= 80) return 7;
    return 6;
};

const getBackgroundLookAheadCount = (
    channelCount: number,
    visibleCount: number,
    aggressive: boolean
): number => {
    const scaled = Math.max(visibleCount * (aggressive ? 14 : 8), aggressive ? 48 : 24);
    if (channelCount >= 200) {
        return Math.max(scaled, aggressive ? 160 : 96);
    }
    if (channelCount >= 120) {
        return Math.max(scaled, aggressive ? 120 : 72);
    }
    return Math.max(scaled, aggressive ? 84 : 48);
};

export const partitionPrefetchChannels = (
    channels: ChannelConfig[],
    range: { channelStart: number; channelEnd: number },
    ids: { liveChannelId: string | null; focusedChannelId: string | null },
    caps: PrefetchCaps
): {
    immediateChannels: ChannelConfig[];
    backgroundChannels: ChannelConfig[];
    overscan: number;
    bufferedRange: { start: number; end: number };
    backgroundRange: { start: number; end: number };
} => {
    const overscan = getChannelOverscanCount(channels.length, caps.aggressive);
    // `range.channelEnd` is inclusive (see visibleCount computation); Array#slice end is exclusive.
    const startIndex = Math.max(0, range.channelStart - overscan);
    const endIndex = Math.min(channels.length, range.channelEnd + 1 + overscan);

    const immediateChannels: ChannelConfig[] = [];
    const immediateIds = new Set<string>();
    const addImmediate = (channel: ChannelConfig | null | undefined): void => {
        if (!channel) return;
        if (immediateIds.has(channel.id)) return;
        immediateIds.add(channel.id);
        immediateChannels.push(channel);
    };

    if (ids.liveChannelId) {
        addImmediate(channels.find((channel) => channel.id === ids.liveChannelId));
    }
    if (ids.focusedChannelId) {
        addImmediate(channels.find((channel) => channel.id === ids.focusedChannelId));
    }
    for (const channel of channels.slice(startIndex, endIndex)) {
        addImmediate(channel);
    }

    const lookAhead = getBackgroundLookAheadCount(channels.length, caps.visibleCount, caps.aggressive);
    const warmStart = endIndex;
    const warmEnd = Math.min(channels.length, warmStart + lookAhead);

    const backgroundChannels: ChannelConfig[] = [];
    for (const channel of channels.slice(warmStart, warmEnd)) {
        if (!immediateIds.has(channel.id)) {
            backgroundChannels.push(channel);
            if (backgroundChannels.length >= caps.maxQueuedChannels) {
                break;
            }
        }
    }

    return {
        immediateChannels,
        backgroundChannels,
        overscan,
        bufferedRange: { start: startIndex, end: endIndex },
        backgroundRange: { start: warmStart, end: warmEnd },
    };
};

export const shouldBackpressureBackgroundWarmQueue = (inFlightCount: number, concurrency: number): boolean => {
    return inFlightCount > concurrency * 2;
};

export type BackgroundWarmQueueAction =
    | { kind: 'cancel'; reason: 'stale-refresh-token' | 'warm-queue-complete' | 'schedule-cache-cap-reached' }
    | { kind: 'backpressure' }
    | { kind: 'runBatch' };

export const getBackgroundWarmQueueAction = (args: {
    refreshId: number;
    activeRefreshId: number;
    cursor: number;
    totalChannels: number;
    cacheSize: number;
    cacheLimit: number;
    inFlightCount: number;
    concurrency: number;
}): BackgroundWarmQueueAction => {
    if (args.refreshId !== args.activeRefreshId) {
        return { kind: 'cancel', reason: 'stale-refresh-token' };
    }
    if (args.cursor >= args.totalChannels) {
        return { kind: 'cancel', reason: 'warm-queue-complete' };
    }
    if (args.cacheSize >= args.cacheLimit) {
        return { kind: 'cancel', reason: 'schedule-cache-cap-reached' };
    }
    if (shouldBackpressureBackgroundWarmQueue(args.inFlightCount, args.concurrency)) {
        return { kind: 'backpressure' };
    }
    return { kind: 'runBatch' };
};
