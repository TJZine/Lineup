import {
    EPGScheduleCacheStore,
    EPG_SCHEDULE_CACHE_STALE_TTL_MS,
    EPG_SCHEDULE_CACHE_TTL_MS,
} from '../runtime/EPGScheduleCacheStore';
import type { ScheduleWindow } from '../../../scheduler/scheduler';

const createWindow = (channelId: string): ScheduleWindow => ({
    startTime: 0,
    endTime: 60_000,
    programs: [
        {
            item: {
                ratingKey: `${channelId}-0`,
                type: 'movie',
                title: `${channelId}-program`,
                fullTitle: `${channelId}-program`,
                durationMs: 60_000,
                thumb: null,
                year: 2024,
                scheduledIndex: 0,
            },
            scheduledStartTime: 0,
            scheduledEndTime: 60_000,
            elapsedMs: 0,
            remainingMs: 60_000,
            scheduleIndex: 0,
            loopNumber: 0,
            isCurrent: false,
        },
    ],
});

const getLoadedMarkerCount = (store: EPGScheduleCacheStore): number =>
    (
        store as unknown as {
            _loadedRangeKeyByChannel: Map<string, unknown>;
        }
    )._loadedRangeKeyByChannel.size;

describe('EPGScheduleCacheStore', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('returns fresh cached schedules before TTL expires', () => {
        const store = new EPGScheduleCacheStore();
        store.storeSchedule('c1', '0-60000', createWindow('c1'));

        const cached = store.getCachedSchedule('c1', '0-60000');

        expect(cached).not.toBeNull();
        expect(cached?.isStale).toBe(false);
        expect(cached?.schedule.programs[0]?.item.ratingKey).toBe('c1-0');
    });

    it('marks cache entries stale after TTL and evicts after stale TTL', () => {
        const store = new EPGScheduleCacheStore();
        store.storeSchedule('c1', '0-60000', createWindow('c1'));

        jest.advanceTimersByTime(EPG_SCHEDULE_CACHE_TTL_MS + 1);
        const stale = store.getCachedSchedule('c1', '0-60000');
        expect(stale?.isStale).toBe(true);

        jest.advanceTimersByTime(EPG_SCHEDULE_CACHE_STALE_TTL_MS - EPG_SCHEDULE_CACHE_TTL_MS + 1);
        const removed = store.getCachedSchedule('c1', '0-60000');
        expect(removed).toBeNull();
    });

    it('keeps expired cache entries intact until an explicit prune runs', () => {
        const store = new EPGScheduleCacheStore();
        store.storeSchedule('c1', '0-60000', createWindow('c1'));

        jest.advanceTimersByTime(EPG_SCHEDULE_CACHE_STALE_TTL_MS + 1);

        expect(store.getSize()).toBe(1);
        expect(store.getCachedSchedule('c1', '0-60000')).toBeNull();
        expect(store.getSize()).toBe(1);

        store.prune(Date.now());
        expect(store.getSize()).toBe(0);
    });

    it('prunes old entries when max cache size is reduced', () => {
        const store = new EPGScheduleCacheStore();
        store.setMaxEntries(2);
        store.storeSchedule('c1', '0-60000', createWindow('c1'));
        store.storeSchedule('c2', '0-60000', createWindow('c2'));
        store.storeSchedule('c3', '0-60000', createWindow('c3'));

        expect(store.getSize()).toBe(2);
        expect(store.getCachedSchedule('c1', '0-60000')).toBeNull();
        expect(store.getCachedSchedule('c2', '0-60000')).not.toBeNull();
        expect(store.getCachedSchedule('c3', '0-60000')).not.toBeNull();
    });

    it('expires loaded-range markers after TTL', () => {
        const store = new EPGScheduleCacheStore();
        store.markScheduleLoaded('c1', '0-60000');

        expect(store.isScheduleLoadedForRange('c1', '0-60000')).toBe(true);
        jest.advanceTimersByTime(EPG_SCHEDULE_CACHE_TTL_MS + 1);
        expect(store.isScheduleLoadedForRange('c1', '0-60000')).toBe(false);
    });

    it('keeps expired loaded-range markers intact until an explicit prune runs', () => {
        const store = new EPGScheduleCacheStore();
        store.markScheduleLoaded('c1', '0-60000');

        jest.advanceTimersByTime(EPG_SCHEDULE_CACHE_TTL_MS + 1);

        expect(getLoadedMarkerCount(store)).toBe(1);
        expect(store.isScheduleLoadedForRange('c1', '0-60000')).toBe(false);
        expect(getLoadedMarkerCount(store)).toBe(1);

        store.prune(Date.now());
        expect(getLoadedMarkerCount(store)).toBe(0);
    });
});
