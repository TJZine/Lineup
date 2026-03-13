import type { ScheduleWindow } from '../../scheduler/scheduler';

export const EPG_SCHEDULE_CACHE_TTL_MS = 2 * 60_000;
export const EPG_SCHEDULE_CACHE_STALE_TTL_MS = 10 * 60_000;

type LoadedRangeEntry = {
    rangeKey: string;
    loadedAt: number;
};

type CachedScheduleEntry = {
    rangeKey: string;
    schedule: ScheduleWindow;
    loadedAt: number;
};

export class EPGScheduleCacheStore {
    private _loadedRangeKeyByChannel = new Map<string, LoadedRangeEntry>();
    private _scheduleCache = new Map<string, CachedScheduleEntry>();
    private _maxEntries = 60;

    setMaxEntries(limit: number): void {
        this._maxEntries = Math.max(1, Math.floor(limit));
        this.prune(Date.now());
    }

    getMaxEntries(): number {
        return this._maxEntries;
    }

    getSize(): number {
        return this._scheduleCache.size;
    }

    prune(nowMs: number): void {
        for (const [key, entry] of this._scheduleCache) {
            if (nowMs - entry.loadedAt > EPG_SCHEDULE_CACHE_STALE_TTL_MS) {
                this._scheduleCache.delete(key);
            }
        }

        for (const [channelId, entry] of this._loadedRangeKeyByChannel) {
            if (nowMs - entry.loadedAt > EPG_SCHEDULE_CACHE_TTL_MS) {
                this._loadedRangeKeyByChannel.delete(channelId);
            }
        }

        while (this._scheduleCache.size > this._maxEntries) {
            const oldestKey = this._scheduleCache.keys().next().value;
            if (oldestKey === undefined) {
                break;
            }
            this._scheduleCache.delete(oldestKey);
        }
    }

    getCachedSchedule(
        channelId: string,
        rangeKey: string
    ): { schedule: ScheduleWindow; isStale: boolean } | null {
        const key = this._getScheduleCacheKey(channelId, rangeKey);
        const entry = this._scheduleCache.get(key);
        if (!entry) {
            return null;
        }

        const now = Date.now();
        const ageMs = now - entry.loadedAt;
        if (ageMs > EPG_SCHEDULE_CACHE_STALE_TTL_MS) {
            this._scheduleCache.delete(key);
            return null;
        }

        return {
            schedule: entry.schedule,
            isStale: ageMs > EPG_SCHEDULE_CACHE_TTL_MS,
        };
    }

    storeSchedule(channelId: string, rangeKey: string, schedule: ScheduleWindow): void {
        const key = this._getScheduleCacheKey(channelId, rangeKey);
        if (this._scheduleCache.has(key)) {
            this._scheduleCache.delete(key);
        }
        this._scheduleCache.set(key, {
            rangeKey,
            schedule,
            loadedAt: Date.now(),
        });
        this.prune(Date.now());
    }

    isScheduleLoadedForRange(channelId: string, rangeKey: string): boolean {
        const entry = this._loadedRangeKeyByChannel.get(channelId);
        if (!entry || entry.rangeKey !== rangeKey) {
            return false;
        }

        const now = Date.now();
        if (now - entry.loadedAt > EPG_SCHEDULE_CACHE_TTL_MS) {
            this._loadedRangeKeyByChannel.delete(channelId);
            return false;
        }
        return true;
    }

    markScheduleLoaded(channelId: string, rangeKey: string): void {
        this._loadedRangeKeyByChannel.set(channelId, {
            rangeKey,
            loadedAt: Date.now(),
        });
    }

    clearLoadedSchedules(): void {
        this._loadedRangeKeyByChannel.clear();
    }

    clearScheduleCaches(): void {
        this._loadedRangeKeyByChannel.clear();
        this._scheduleCache.clear();
    }

    private _getScheduleCacheKey(channelId: string, rangeKey: string): string {
        return `${channelId}::${rangeKey}`;
    }
}
