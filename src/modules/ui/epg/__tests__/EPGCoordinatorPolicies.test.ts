import type { ChannelConfig, PlaybackMode } from '../../../scheduler/channel-manager';
import type { EPGConfig } from '../types';
import {
    computeEpgScheduleRangeMs,
    computeNormalizedLibraryFilterState,
    partitionPrefetchChannels,
} from '../coordinator/EPGCoordinatorPolicies';

const makeChannel = (
    id: string,
    number: number,
    libraryId?: string,
    itemType: 'movie' | 'episode' = 'movie'
): ChannelConfig => {
    const channel: ChannelConfig = {
        id,
        name: `Channel ${number}`,
        number,
        contentSource: libraryId
            ? {
                type: 'library',
                libraryId,
                libraryType: itemType === 'episode' ? 'show' : 'movie',
                includeWatched: true,
            }
            : { type: 'manual', items: [] },
        playbackMode: 'sequential' as PlaybackMode,
        startTimeAnchor: 0,
        skipIntros: false,
        skipCredits: false,
        createdAt: 0,
        updatedAt: 0,
        lastContentRefresh: 0,
        itemCount: 0,
        totalDurationMs: 0,
    };
    if (libraryId) {
        channel.sourceLibraryId = libraryId;
    }
    return channel;
};

describe('EPGCoordinatorPolicies', () => {
    it('reports invalid persisted library selections for caller-owned cleanup', () => {
        const channels = [makeChannel('c1', 1, 'lib-a')];
        const result = computeNormalizedLibraryFilterState(channels, {
            pastItemsWindowSetting: 'auto',
            tabsEnabled: true,
            selectedLibraryId: 'missing-lib',
        });

        expect(result.selectedId).toBeNull();
        expect(result.shouldFilter).toBe(false);
        expect(result.shouldClearPersistedSelection).toBe(true);
    });

    it('clears active filtering when tabs are disabled without clearing persisted selection', () => {
        const channels = [
            makeChannel('c1', 1, 'lib-a'),
            makeChannel('c2', 2, 'lib-b'),
        ];
        const result = computeNormalizedLibraryFilterState(channels, {
            pastItemsWindowSetting: 'auto',
            tabsEnabled: false,
            selectedLibraryId: 'lib-a',
        });

        expect(result.selectedId).toBeNull();
        expect(result.shouldFilter).toBe(false);
        expect(result.shouldClearPersistedSelection).toBe(false);
    });

    it('does not clear persisted selection when only one library is available', () => {
        const channels = [makeChannel('c1', 1, 'lib-a')];
        const result = computeNormalizedLibraryFilterState(channels, {
            pastItemsWindowSetting: 'auto',
            tabsEnabled: true,
            selectedLibraryId: 'lib-a',
        });

        expect(result.selectedId).toBeNull();
        expect(result.shouldFilter).toBe(false);
        expect(result.shouldClearPersistedSelection).toBe(false);
    });

    it('keeps auto past-window schedule policy aligned with normalized filter state', () => {
        const channels = [
            makeChannel('show-1', 1, 'shows-lib', 'episode'),
            makeChannel('show-2', 2, 'shows-lib', 'episode'),
            makeChannel('movie-1', 3, 'movies-lib', 'movie'),
        ];
        const storage = {
            pastItemsWindowSetting: 'auto' as const,
            tabsEnabled: true,
            selectedLibraryId: 'shows-lib',
        };
        const normalized = computeNormalizedLibraryFilterState(channels, storage);
        const nowMs = new Date('2026-04-01T14:00:00.000Z').getTime();
        const slotMinutes = 30;
        const scheduleRange = computeEpgScheduleRangeMs(
            {
                getEpgConfig: (): EPGConfig => ({
                    containerId: 'epg',
                    visibleChannels: 5,
                    visibleHours: 3,
                    totalHours: 6,
                    timeSlotMinutes: slotMinutes,
                    pixelsPerMinute: 2,
                    rowHeight: 64,
                    autoScrollToNow: false,
                }),
                getChannelManager: (): { getAllChannels: () => ChannelConfig[] } => ({ getAllChannels: (): ChannelConfig[] => channels }),
                getLocalMidnightMs: (): number => 0,
            },
            nowMs,
            storage
        );

        expect(normalized.selectedId).toBe('shows-lib');
        expect(normalized.shouldFilter).toBe(true);
        expect(scheduleRange).not.toBeNull();
        if (!scheduleRange) return;
        const pastWindowMinutes = (nowMs - scheduleRange.startTime) / 60_000;
        expect(pastWindowMinutes).toBeGreaterThanOrEqual(0);
        expect(pastWindowMinutes).toBeLessThan(slotMinutes);
    });

    it('orders live, focused, visible, overscan, then bounded background without duplication', () => {
        const channels = Array.from({ length: 60 }, (_, index) => makeChannel(`c${index}`, index + 1));
        const partitioned = partitionPrefetchChannels(
            channels,
            { channelStart: 10, channelEndExclusive: 15 },
            { liveChannelId: 'c2', focusedChannelId: 'c12' },
            { visibleCount: 5, maxQueuedChannels: 96, aggressive: false }
        );

        expect(partitioned.immediateChannels.slice(0, 2).map((channel) => channel.id)).toEqual(['c2', 'c12']);
        const visibleIds = ['c10', 'c11', 'c13', 'c14'];
        let cursor = 2;
        for (const id of visibleIds) {
            const found = partitioned.immediateChannels.findIndex(
                (channel, index) => index >= cursor && channel.id === id
            );
            expect(found).toBeGreaterThanOrEqual(cursor);
            cursor = found + 1;
        }
        const ids = partitioned.immediateChannels.map((channel) => channel.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const channel of partitioned.backgroundChannels) {
            expect(ids).not.toContain(channel.id);
        }
        expect(partitioned.backgroundChannels.length).toBeLessThanOrEqual(96);
    });

    it('replaces obsolete background priority on a large Guide jump', () => {
        const channels = Array.from({ length: 100 }, (_, index) => makeChannel(`c${index}`, index + 1));
        const destination = partitionPrefetchChannels(
            channels,
            { channelStart: 80, channelEndExclusive: 85 },
            { liveChannelId: null, focusedChannelId: 'c82' },
            { visibleCount: 5, maxQueuedChannels: 96, aggressive: false }
        );

        expect(destination.immediateChannels[0]?.id).toBe('c82');
        for (const id of ['c80', 'c81', 'c83', 'c84']) {
            expect(destination.immediateChannels.map((channel) => channel.id)).toContain(id);
        }
        expect(destination.immediateChannels.map((channel) => channel.id)).not.toContain('c10');
    });

    it('globally distance-orders both overscan directions after the visible set', () => {
        const channels = Array.from({ length: 200 }, (_, index) => makeChannel(`c${index}`, index + 1));
        const partitioned = partitionPrefetchChannels(
            channels,
            { channelStart: 100, channelEndExclusive: 105 },
            { liveChannelId: null, focusedChannelId: 'c102' },
            { visibleCount: 5, maxQueuedChannels: 96, aggressive: false }
        );

        expect(partitioned.immediateChannels.slice(0, 7).map((channel) => channel.id)).toEqual([
            'c102',
            'c100',
            'c101',
            'c103',
            'c104',
            'c105',
            'c99',
        ]);
        expect(partitioned.immediateChannels.slice(7, 11).map((channel) => channel.id)).toEqual([
            'c106',
            'c98',
            'c107',
            'c97',
        ]);
    });
});
