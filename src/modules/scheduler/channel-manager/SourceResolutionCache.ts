import type { ChannelContentSource, ResolvedContentItem } from './types';

const SOURCE_CACHE_TTL_MS = 5 * 60_000;
const SOURCE_CACHE_MAX_ENTRIES = 24;

type SourceCacheEntry = {
    items: ResolvedContentItem[];
    cachedAt: number;
    epoch: number;
    generation: number;
};

type SourceInFlightEntry = {
    controller: AbortController;
    promise: Promise<ResolvedContentItem[]>;
    waiters: number;
    epoch: number;
    generation: number;
};

type ResolveSourceUncached = (
    source: ChannelContentSource,
    options: { signal: AbortSignal }
) => Promise<ResolvedContentItem[]>;

export class SourceResolutionCache {
    private _cacheEpoch = 0;
    private readonly _sourceCacheGenerationByKey = new Map<string, number>();
    private readonly _sourceCache = new Map<string, SourceCacheEntry>();
    private readonly _sourceInFlight = new Map<string, SourceInFlightEntry>();

    clear(): void {
        this._cacheEpoch += 1;
        this._sourceCache.clear();
        this._sourceCacheGenerationByKey.clear();
        for (const entry of this._sourceInFlight.values()) {
            entry.controller.abort();
        }
        this._sourceInFlight.clear();
    }

    invalidate(source: ChannelContentSource): void {
        const key = this.buildKey(source);
        this._bumpSourceCacheGeneration(key);
        this._sourceCache.delete(key);

        const inFlight = this._sourceInFlight.get(key);
        if (inFlight) {
            inFlight.controller.abort();
            this._sourceInFlight.delete(key);
        }

        if (source.type === 'mixed') {
            for (const subSource of source.sources) {
                this.invalidate(subSource);
            }
        }
    }

    async resolve(
        source: ChannelContentSource,
        resolveUncached: ResolveSourceUncached,
        options?: { signal?: AbortSignal | null }
    ): Promise<ResolvedContentItem[]> {
        const cacheKey = this.buildKey(source);
        const epoch = this._cacheEpoch;
        const generation = this._getSourceCacheGeneration(cacheKey);
        const cached = this._getCachedSourceItems(cacheKey);
        if (cached) {
            return cached;
        }

        const inFlight = this._sourceInFlight.get(cacheKey);
        if (inFlight && inFlight.epoch === epoch && inFlight.generation === generation) {
            return this._awaitInFlight(cacheKey, inFlight, options?.signal ?? null);
        }

        const controller = new AbortController();
        const resolvePromise = resolveUncached(source, { signal: controller.signal })
            .then((items) => {
                this._setCachedSourceItems(cacheKey, items, { epoch, generation });
                return items;
            })
            .finally(() => {
                const current = this._sourceInFlight.get(cacheKey);
                if (current && current.promise === resolvePromise) {
                    this._sourceInFlight.delete(cacheKey);
                }
            });

        const entry: SourceInFlightEntry = {
            controller,
            promise: resolvePromise,
            waiters: 0,
            epoch,
            generation,
        };
        this._sourceInFlight.set(cacheKey, entry);
        return this._awaitInFlight(cacheKey, entry, options?.signal ?? null);
    }

    buildKey(source: ChannelContentSource): string {
        return this._stableSerialize(source);
    }

    cloneItems(items: ReadonlyArray<ResolvedContentItem>): ResolvedContentItem[] {
        return items.map((item, index) => this.cloneItem(item, item.scheduledIndex ?? index));
    }

    cloneItem(item: ResolvedContentItem, scheduledIndex = item.scheduledIndex): ResolvedContentItem {
        const cloned: ResolvedContentItem = {
            ...item,
            scheduledIndex,
        };
        if (item.genres) {
            cloned.genres = [...item.genres];
        }
        if (item.directors) {
            cloned.directors = [...item.directors];
        }
        if (item.mediaInfo) {
            cloned.mediaInfo = { ...item.mediaInfo };
        }
        return cloned;
    }

    private _getSourceCacheGeneration(key: string): number {
        return this._sourceCacheGenerationByKey.get(key) ?? 0;
    }

    private _bumpSourceCacheGeneration(key: string): number {
        const next = (this._sourceCacheGenerationByKey.get(key) ?? 0) + 1;
        this._sourceCacheGenerationByKey.set(key, next);
        return next;
    }

    private _createAbortError(): unknown {
        try {
            return new DOMException('Aborted', 'AbortError');
        } catch {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            return error;
        }
    }

    private _awaitInFlight(
        key: string,
        entry: SourceInFlightEntry,
        signal: AbortSignal | null
    ): Promise<ResolvedContentItem[]> {
        if (signal?.aborted) {
            return Promise.reject(this._createAbortError());
        }

        entry.waiters += 1;
        let released = false;
        const release = (): void => {
            if (released) return;
            released = true;
            entry.waiters -= 1;
            if (entry.waiters > 0) {
                return;
            }
            const current = this._sourceInFlight.get(key);
            if (current !== entry) {
                return;
            }
            entry.controller.abort();
            this._sourceInFlight.delete(key);
        };

        if (!signal) {
            return entry.promise.then((items) => this.cloneItems(items)).finally(release);
        }

        let onAbort: (() => void) | null = null;
        const abortPromise = new Promise<ResolvedContentItem[]>((_, reject) => {
            onAbort = (): void => reject(this._createAbortError());
            signal.addEventListener('abort', onAbort, { once: true });
        });

        return Promise.race([
            entry.promise.then((items) => this.cloneItems(items)),
            abortPromise,
        ]).finally(() => {
            if (onAbort) {
                signal.removeEventListener('abort', onAbort);
            }
            release();
        });
    }

    private _stableSerialize(value: unknown): string {
        if (value === undefined) {
            return JSON.stringify(null);
        }
        if (value === null || typeof value !== 'object') {
            return JSON.stringify(value);
        }
        if (Array.isArray(value)) {
            return `[${value.map((entry) => this._stableSerialize(entry)).join(',')}]`;
        }

        const entries = Object
            .entries(value as Record<string, unknown>)
            .filter(([, entry]) => entry !== undefined)
            .sort(([left], [right]) => left.localeCompare(right));
        return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${this._stableSerialize(entry)}`).join(',')}}`;
    }

    private _getCachedSourceItems(key: string): ResolvedContentItem[] | null {
        const cached = this._sourceCache.get(key);
        if (!cached) {
            return null;
        }

        if (cached.epoch !== this._cacheEpoch || cached.generation !== this._getSourceCacheGeneration(key)) {
            this._sourceCache.delete(key);
            return null;
        }

        if (Date.now() - cached.cachedAt > SOURCE_CACHE_TTL_MS) {
            this._sourceCache.delete(key);
            return null;
        }

        this._sourceCache.delete(key);
        this._sourceCache.set(key, cached);
        return this.cloneItems(cached.items);
    }

    private _setCachedSourceItems(
        key: string,
        items: ResolvedContentItem[],
        scope: { epoch: number; generation: number }
    ): void {
        if (scope.epoch !== this._cacheEpoch) {
            return;
        }
        if (scope.generation !== this._getSourceCacheGeneration(key)) {
            return;
        }

        this._sourceCache.delete(key);
        this._sourceCache.set(key, {
            items: this.cloneItems(items),
            cachedAt: Date.now(),
            epoch: scope.epoch,
            generation: scope.generation,
        });

        while (this._sourceCache.size > SOURCE_CACHE_MAX_ENTRIES) {
            const oldest = this._sourceCache.keys().next().value;
            if (oldest === undefined) {
                break;
            }
            this._sourceCache.delete(oldest);
        }
    }
}
