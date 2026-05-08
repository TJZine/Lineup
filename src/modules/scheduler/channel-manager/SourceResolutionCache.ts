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
    // Child -> parent links outlive child cache entries while a mixed parent is cached.
    // _registerParentDependencies records those links for mixed parents, and
    // _unregisterParentDependencies removes them when the parent leaves the cache.
    // This lets a later child invalidation still bump live parent generations.
    private readonly _parentKeysByChildKey = new Map<string, Set<string>>();
    private readonly _childKeysByParentKey = new Map<string, Set<string>>();

    clear(): void {
        this._cacheEpoch += 1;
        this._sourceCache.clear();
        this._sourceCacheGenerationByKey.clear();
        this._parentKeysByChildKey.clear();
        this._childKeysByParentKey.clear();
        for (const entry of this._sourceInFlight.values()) {
            entry.controller.abort();
        }
        this._sourceInFlight.clear();
    }

    invalidate(source: ChannelContentSource): void {
        const invalidatedKeys = new Set<string>();
        this._invalidateSource(source, invalidatedKeys);
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
        if (inFlight) {
            if (inFlight.epoch === epoch && inFlight.generation === generation) {
                return this._awaitInFlight(cacheKey, inFlight, options?.signal ?? null);
            }
            inFlight.controller.abort();
            this._sourceInFlight.delete(cacheKey);
        }

        if (options?.signal?.aborted) {
            return Promise.reject(this._createAbortError());
        }

        const controller = new AbortController();
        const resolvePromise = resolveUncached(source, { signal: controller.signal })
            .then((items) => {
                this._setCachedSourceItems(cacheKey, source, items, { epoch, generation });
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

    private _invalidateSourceKey(key: string, invalidatedKeys: Set<string>): void {
        if (invalidatedKeys.has(key)) {
            return;
        }
        invalidatedKeys.add(key);

        const parentKeys = [...(this._parentKeysByChildKey.get(key) ?? [])];
        this._bumpSourceCacheGeneration(key);
        this._sourceCache.delete(key);
        this._unregisterParentDependencies(key);

        const inFlight = this._sourceInFlight.get(key);
        if (inFlight) {
            inFlight.controller.abort();
            this._sourceInFlight.delete(key);
        }

        for (const parentKey of parentKeys) {
            this._invalidateSourceKey(parentKey, invalidatedKeys);
        }
    }

    private _invalidateSource(source: ChannelContentSource, invalidatedKeys: Set<string>): void {
        this._invalidateSourceKey(this.buildKey(source), invalidatedKeys);

        if (source.type !== 'mixed') {
            return;
        }

        for (const subSource of source.sources) {
            this._invalidateSource(subSource, invalidatedKeys);
        }
    }

    private _registerParentDependencies(parentKey: string, childKeys: string[]): void {
        this._unregisterParentDependencies(parentKey);

        if (childKeys.length === 0) {
            return;
        }

        this._childKeysByParentKey.set(parentKey, new Set(childKeys));
        for (const childKey of childKeys) {
            const parentKeys = this._parentKeysByChildKey.get(childKey) ?? new Set<string>();
            parentKeys.add(parentKey);
            this._parentKeysByChildKey.set(childKey, parentKeys);
        }
    }

    private _unregisterParentDependencies(parentKey: string): void {
        const childKeys = this._childKeysByParentKey.get(parentKey);
        if (!childKeys) {
            return;
        }

        for (const childKey of childKeys) {
            const parentKeys = this._parentKeysByChildKey.get(childKey);
            if (!parentKeys) {
                continue;
            }
            parentKeys.delete(parentKey);
            if (parentKeys.size === 0) {
                this._parentKeysByChildKey.delete(childKey);
            }
        }

        this._childKeysByParentKey.delete(parentKey);
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
        if (signal?.aborted || entry.controller.signal.aborted) {
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

        let onCallerAbort: (() => void) | null = null;
        let onEntryAbort: (() => void) | null = null;
        const abortPromise = new Promise<ResolvedContentItem[]>((_, reject) => {
            const rejectAborted = (): void => reject(this._createAbortError());
            onCallerAbort = rejectAborted;
            onEntryAbort = rejectAborted;
            signal?.addEventListener('abort', onCallerAbort, { once: true });
            entry.controller.signal.addEventListener('abort', onEntryAbort, { once: true });
        });

        return Promise.race([
            entry.promise.then((items) => this.cloneItems(items)),
            abortPromise,
        ]).finally(() => {
            if (onCallerAbort) {
                signal?.removeEventListener('abort', onCallerAbort);
            }
            if (onEntryAbort) {
                entry.controller.signal.removeEventListener('abort', onEntryAbort);
            }
            release();
        });
    }

    private _stableSerialize(value: unknown, seen = new WeakSet<object>()): string {
        if (value === undefined) {
            return JSON.stringify(null);
        }
        if (value === null) {
            return JSON.stringify(value);
        }
        const valueType = typeof value;
        if (valueType === 'string' || valueType === 'boolean') {
            return JSON.stringify(value);
        }
        if (valueType === 'number') {
            if (!Number.isFinite(value)) {
                throw new Error('Unsupported content source cache key value: non-finite number');
            }
            return JSON.stringify(value);
        }
        if (valueType === 'function' || valueType === 'bigint' || valueType === 'symbol') {
            throw new Error(`Unsupported content source cache key value type: ${valueType}`);
        }

        const objectValue = value as object;
        if (seen.has(objectValue)) {
            throw new Error('Cannot build content source cache key for circular source data');
        }

        seen.add(objectValue);
        try {
            if (Array.isArray(value)) {
                return `[${value.map((entry) => this._stableSerialize(entry, seen)).join(',')}]`;
            }

            const entries = Object
                .entries(value as Record<string, unknown>)
                .filter(([, entry]) => entry !== undefined)
                .sort(([left], [right]) => left.localeCompare(right));
            return `{${entries.map(([key, entry]) =>
                `${JSON.stringify(key)}:${this._stableSerialize(entry, seen)}`
            ).join(',')}}`;
        } finally {
            seen.delete(objectValue);
        }
    }

    private _getCachedSourceItems(key: string): ResolvedContentItem[] | null {
        const cached = this._sourceCache.get(key);
        if (!cached) {
            return null;
        }

        if (cached.epoch !== this._cacheEpoch || cached.generation !== this._getSourceCacheGeneration(key)) {
            this._sourceCache.delete(key);
            this._unregisterParentDependencies(key);
            return null;
        }

        if (Date.now() - cached.cachedAt > SOURCE_CACHE_TTL_MS) {
            this._sourceCache.delete(key);
            this._unregisterParentDependencies(key);
            return null;
        }

        this._sourceCache.delete(key);
        this._sourceCache.set(key, cached);
        return this.cloneItems(cached.items);
    }

    private _setCachedSourceItems(
        key: string,
        source: ChannelContentSource,
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
        this._unregisterParentDependencies(key);
        this._sourceCache.set(key, {
            items: this.cloneItems(items),
            cachedAt: Date.now(),
            epoch: scope.epoch,
            generation: scope.generation,
        });
        if (source.type === 'mixed') {
            this._registerParentDependencies(key, source.sources.map((subSource) => this.buildKey(subSource)));
        }

        while (this._sourceCache.size > SOURCE_CACHE_MAX_ENTRIES) {
            const oldest = this._sourceCache.keys().next().value;
            if (oldest === undefined) {
                break;
            }
            this._sourceCache.delete(oldest);
            this._unregisterParentDependencies(oldest);
        }
    }
}
