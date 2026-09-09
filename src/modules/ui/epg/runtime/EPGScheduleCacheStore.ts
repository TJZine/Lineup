import type { ScheduleWindow } from '../../../scheduler/scheduler';
import type { ChannelConfig } from '../../../scheduler/channel-manager';
import { isMatchingEpgChannelSnapshot } from '../types';

export const EPG_SCHEDULE_CACHE_TTL_MS = 2 * 60_000;
export const EPG_SCHEDULE_CACHE_STALE_TTL_MS = 10 * 60_000;

type LoadedRangeEntry = {
    rangeKey: string;
    loadedAt: number;
    channelSnapshot?: ChannelConfig;
};

type CachedScheduleEntry = {
    rangeKey: string;
    schedule: ScheduleWindow;
    loadedAt: number;
    channelSnapshot?: ChannelConfig;
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
        rangeKey: string,
        channelSnapshot?: ChannelConfig
    ): { schedule: ScheduleWindow; isStale: boolean; loadedAt: number } | null {
        const key = this._getScheduleCacheKey(channelId, rangeKey);
        const entry = this._scheduleCache.get(key);
        if (!entry) {
            return null;
        }
        if (
            channelSnapshot &&
            (!entry.channelSnapshot || !isMatchingEpgChannelSnapshot(entry.channelSnapshot, channelSnapshot))
        ) {
            return null;
        }

        const now = Date.now();
        const ageMs = now - entry.loadedAt;
        if (ageMs > EPG_SCHEDULE_CACHE_STALE_TTL_MS) {
            return null;
        }

        return {
            schedule: entry.schedule,
            isStale: ageMs > EPG_SCHEDULE_CACHE_TTL_MS,
            loadedAt: entry.loadedAt,
        };
    }

    storeSchedule(
        channelId: string,
        rangeKey: string,
        schedule: ScheduleWindow,
        channelSnapshot?: ChannelConfig
    ): void {
        const key = this._getScheduleCacheKey(channelId, rangeKey);
        if (this._scheduleCache.has(key)) {
            this._scheduleCache.delete(key);
        }
        this._scheduleCache.set(key, {
            rangeKey,
            schedule,
            loadedAt: Date.now(),
            ...(channelSnapshot ? { channelSnapshot } : {}),
        });
        this.prune(Date.now());
    }

    isScheduleLoadedForRange(
        channelId: string,
        rangeKey: string,
        channelSnapshot?: ChannelConfig
    ): boolean {
        const entry = this._loadedRangeKeyByChannel.get(channelId);
        if (!entry || entry.rangeKey !== rangeKey) {
            return false;
        }
        if (
            channelSnapshot &&
            (!entry.channelSnapshot || !isMatchingEpgChannelSnapshot(entry.channelSnapshot, channelSnapshot))
        ) {
            return false;
        }

        const now = Date.now();
        return now - entry.loadedAt <= EPG_SCHEDULE_CACHE_TTL_MS;
    }

    markScheduleLoaded(channelId: string, rangeKey: string, channelSnapshot?: ChannelConfig): void {
        this._loadedRangeKeyByChannel.set(channelId, {
            rangeKey,
            loadedAt: Date.now(),
            ...(channelSnapshot ? { channelSnapshot } : {}),
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
