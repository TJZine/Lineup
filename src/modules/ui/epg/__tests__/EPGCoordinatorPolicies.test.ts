import type { ChannelConfig, PlaybackMode } from '../../../scheduler/channel-manager';
import type { EPGConfig } from '../types';
import {
    computeEpgScheduleRangeMs,
    computeNormalizedLibraryFilterState,
} from '../EPGCoordinatorPolicies';

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
        playbackMode: 'loop' as PlaybackMode,
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

    it('clears filtering when tabs are disabled and reports persistence cleanup', () => {
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
        expect(result.shouldClearPersistedSelection).toBe(true);
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
                    showCurrentTimeIndicator: true,
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
});
