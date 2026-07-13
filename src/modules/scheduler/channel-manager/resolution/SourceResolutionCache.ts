import type { ChannelContentSource, ResolvedContentItem } from '../contracts/types';
import { RetainedOperationContext } from '../../../../utils/RetainedOperationContext';
import {
    SourceResolutionEntryAuthority,
    SourceResolutionScope,
    type SourceResolutionOperationContext,
} from './SourceResolutionEntryAuthority';

const SOURCE_CACHE_TTL_MS = 5 * 60_000;
const SOURCE_CACHE_MAX_ENTRIES = 24;

type SourceCacheEntry = {
    items: ResolvedContentItem[];
    cachedAt: number;
    epoch: number;
    generation: number;
    scopeAuthority: SourceResolutionOperationContext['authority'];
};

type SourceInFlightEntry = {
    authority: SourceResolutionEntryAuthority;
    promise: Promise<ResolvedContentItem[]>;
    waiters: number;
    epoch: number;
    generation: number;
    completed: boolean;
    released: boolean;
};

type ResolveSourceUncached = (
    source: ChannelContentSource,
    operation: SourceResolutionOperationContext
) => Promise<ResolvedContentItem[]>;

type ResolveSourceUncachedLegacy = (
    source: ChannelContentSource,
    options: { signal: AbortSignal }
) => Promise<ResolvedContentItem[]>;

export class SourceResolutionCache {
    private _cacheEpoch = 0;
    private readonly _sourceCacheGenerationByKey = new Map<string, number>();
    private readonly _sourceCache = new Map<string, SourceCacheEntry>();
    private readonly _sourceInFlight = new Map<string, SourceInFlightEntry>();
    private _defaultScope = new SourceResolutionScope([{ assertCurrent: (): void => undefined }]);
    private readonly _parentKeysByChildKey = new Map<string, Set<string>>();
    private readonly _childKeysByParentKey = new Map<string, Set<string>>();

    clear(): void {
        this._defaultScope.close();
        this._defaultScope.release();
        this._defaultScope = new SourceResolutionScope([{ assertCurrent: (): void => undefined }]);
        this._cacheEpoch += 1;
        this._sourceCache.clear();
        this._sourceCacheGenerationByKey.clear();
        this._parentKeysByChildKey.clear();
        this._childKeysByParentKey.clear();
        for (const entry of this._sourceInFlight.values()) this._closeEntry(entry);
        this._sourceInFlight.clear();
    }

    invalidate(source: ChannelContentSource): void {
        this._invalidateSource(source, new Set<string>());
    }

    async resolve(
        source: ChannelContentSource,
        resolveUncached: ResolveSourceUncachedLegacy,
        options?: { signal?: AbortSignal | null }
    ): Promise<ResolvedContentItem[]> {
        const operation = this._defaultScope.retain('default-source-resolution');
        try {
            return await this.resolveWithOperation(
                source,
                (nextSource, entry) => resolveUncached(nextSource, { signal: entry.signal }),
                operation,
                options?.signal
            );
        } finally {
            operation.release();
        }
    }

    async resolveWithOperation(
        source: ChannelContentSource,
        resolveUncached: ResolveSourceUncached,
        operation: SourceResolutionOperationContext,
        callerSignal?: AbortSignal | null
    ): Promise<ResolvedContentItem[]> {
        operation.assertCurrent();
        throwIfAborted(callerSignal);
        const cacheKey = this.buildKey(source);
        const epoch = this._cacheEpoch;
        const generation = this._getSourceCacheGeneration(cacheKey);
        const cached = this._getCachedSourceItems(cacheKey, operation);
        if (cached) {
            operation.assertCurrent();
            throwIfAborted(callerSignal);
            return cached;
        }

        const inFlight = this._sourceInFlight.get(cacheKey);
        if (inFlight) {
            if (
                inFlight.epoch === epoch
                && inFlight.generation === generation
                && inFlight.authority.scope.authority === operation.authority
            ) {
                return this._awaitInFlight(cacheKey, inFlight, operation, callerSignal ?? null);
            }
            this._closeEntry(inFlight);
            this._sourceInFlight.delete(cacheKey);
        }

        const entryScope = retainSourceOperation(operation, `source-entry:${cacheKey}`);
        const authority = new SourceResolutionEntryAuthority(entryScope);
        const entry: SourceInFlightEntry = {
            authority,
            promise: Promise.resolve([]),
            waiters: 0,
            epoch,
            generation,
            completed: false,
            released: false,
        };
        const resolvePromise = resolveUncached(source, {
            authority: operation.authority,
            signal: authority.signal,
            assertCurrent: (): void => authority.assertCurrent(),
            release: (): void => undefined,
            retain: (label): SourceResolutionOperationContext => authority.retain(label),
        }).then((items) => {
            authority.assertCurrent();
            if (this._sourceInFlight.get(cacheKey) !== entry) throw createAbortError();
            this._setCachedSourceItems(cacheKey, source, items, entry);
            authority.assertCurrent();
            return items;
        }).finally(() => {
            entry.completed = true;
            if (this._sourceInFlight.get(cacheKey) === entry) this._sourceInFlight.delete(cacheKey);
            if (entry.waiters === 0) this._releaseEntry(entry);
        });
        entry.promise = resolvePromise;
        this._sourceInFlight.set(cacheKey, entry);
        return this._awaitInFlight(cacheKey, entry, operation, callerSignal ?? null);
    }

    buildKey(source: ChannelContentSource): string {
        return stableSerialize(source);
    }

    cloneItems(items: ReadonlyArray<ResolvedContentItem>): ResolvedContentItem[] {
        return items.map((item, index) => this.cloneItem(item, item.scheduledIndex ?? index));
    }

    cloneItem(item: ResolvedContentItem, scheduledIndex = item.scheduledIndex): ResolvedContentItem {
        return {
            ...item,
            scheduledIndex,
            ...(item.genres ? { genres: [...item.genres] } : {}),
            ...(item.directors ? { directors: [...item.directors] } : {}),
            ...(item.mediaInfo ? { mediaInfo: { ...item.mediaInfo } } : {}),
        };
    }

    private _awaitInFlight(
        key: string,
        entry: SourceInFlightEntry,
        operation: SourceResolutionOperationContext,
        callerSignal: AbortSignal | null
    ): Promise<ResolvedContentItem[]> {
        const waiter = new RetainedOperationContext([
            operation,
            {
                signal: callerSignal,
                assertCurrent: (): void => throwIfAborted(callerSignal),
            },
            entry.authority,
        ]);
        entry.waiters += 1;
        const aborted = new Promise<ResolvedContentItem[]>((_, reject) => {
            const onAbort = (): void => reject(waiter.signal.reason ?? createAbortError());
            waiter.signal.addEventListener('abort', onAbort, { once: true });
        });
        return Promise.race([entry.promise, aborted]).then((items) => {
            waiter.assertCurrent();
            return this.cloneItems(items);
        }).finally(() => {
            waiter.release();
            entry.waiters -= 1;
            if (entry.waiters === 0 && this._sourceInFlight.get(key) === entry) {
                this._sourceInFlight.delete(key);
                this._closeEntry(entry);
            }
            if (entry.waiters === 0 && entry.completed) this._releaseEntry(entry);
        });
    }

    private _closeEntry(entry: SourceInFlightEntry): void {
        entry.authority.close();
    }

    private _releaseEntry(entry: SourceInFlightEntry): void {
        if (entry.released) return;
        entry.released = true;
        entry.authority.release();
    }

    private _getSourceCacheGeneration(key: string): number {
        return this._sourceCacheGenerationByKey.get(key) ?? 0;
    }

    private _bumpSourceCacheGeneration(key: string): void {
        this._sourceCacheGenerationByKey.set(key, this._getSourceCacheGeneration(key) + 1);
    }

    private _invalidateSourceKey(key: string, invalidatedKeys: Set<string>): void {
        if (invalidatedKeys.has(key)) return;
        invalidatedKeys.add(key);
        const parentKeys = [...(this._parentKeysByChildKey.get(key) ?? [])];
        this._bumpSourceCacheGeneration(key);
        this._sourceCache.delete(key);
        this._unregisterParentDependencies(key);
        const inFlight = this._sourceInFlight.get(key);
        if (inFlight) {
            this._sourceInFlight.delete(key);
            this._closeEntry(inFlight);
        }
        for (const parentKey of parentKeys) this._invalidateSourceKey(parentKey, invalidatedKeys);
    }

    private _invalidateSource(source: ChannelContentSource, invalidatedKeys: Set<string>): void {
        this._invalidateSourceKey(this.buildKey(source), invalidatedKeys);
        if (source.type === 'mixed') {
            for (const subSource of source.sources) this._invalidateSource(subSource, invalidatedKeys);
        }
    }

    private _getCachedSourceItems(
        key: string,
        operation: SourceResolutionOperationContext
    ): ResolvedContentItem[] | null {
        const cached = this._sourceCache.get(key);
        if (!cached) return null;
        if (
            cached.epoch !== this._cacheEpoch
            || cached.generation !== this._getSourceCacheGeneration(key)
            || cached.scopeAuthority !== operation.authority
            || Date.now() - cached.cachedAt > SOURCE_CACHE_TTL_MS
        ) {
            this._sourceCache.delete(key);
            this._unregisterParentDependencies(key);
            return null;
        }
        operation.assertCurrent();
        this._sourceCache.delete(key);
        this._sourceCache.set(key, cached);
        return this.cloneItems(cached.items);
    }

    private _setCachedSourceItems(
        key: string,
        source: ChannelContentSource,
        items: ResolvedContentItem[],
        entry: SourceInFlightEntry
    ): void {
        entry.authority.assertCurrent();
        if (
            entry.epoch !== this._cacheEpoch
            || entry.generation !== this._getSourceCacheGeneration(key)
        ) throw createAbortError();
        this._sourceCache.delete(key);
        this._unregisterParentDependencies(key);
        this._sourceCache.set(key, {
            items: this.cloneItems(items),
            cachedAt: Date.now(),
            epoch: entry.epoch,
            generation: entry.generation,
            scopeAuthority: entry.authority.scope.authority,
        });
        entry.authority.assertCurrent();
        if (source.type === 'mixed') {
            this._registerParentDependencies(key, buildDescendantSourceKeys(source));
        }
        while (this._sourceCache.size > SOURCE_CACHE_MAX_ENTRIES) {
            entry.authority.assertCurrent();
            const oldest = this._sourceCache.keys().next().value;
            if (oldest === undefined) break;
            this._sourceCache.delete(oldest);
            this._unregisterParentDependencies(oldest);
        }
    }

    private _registerParentDependencies(parentKey: string, childKeys: string[]): void {
        this._unregisterParentDependencies(parentKey);
        if (childKeys.length === 0) return;
        const uniqueChildKeys = new Set(childKeys);
        this._childKeysByParentKey.set(parentKey, uniqueChildKeys);
        for (const childKey of uniqueChildKeys) {
            const parents = this._parentKeysByChildKey.get(childKey) ?? new Set<string>();
            parents.add(parentKey);
            this._parentKeysByChildKey.set(childKey, parents);
        }
    }

    private _unregisterParentDependencies(parentKey: string): void {
        const children = this._childKeysByParentKey.get(parentKey);
        if (!children) return;
        for (const childKey of children) {
            const parents = this._parentKeysByChildKey.get(childKey);
            parents?.delete(parentKey);
            if (parents?.size === 0) this._parentKeysByChildKey.delete(childKey);
        }
        this._childKeysByParentKey.delete(parentKey);
    }
}

function retainSourceOperation(
    operation: SourceResolutionOperationContext,
    label: string
): SourceResolutionOperationContext {
    return operation.retain(label);
}

function buildDescendantSourceKeys(source: ChannelContentSource): string[] {
    if (source.type !== 'mixed') return [];
    const keys: string[] = [];
    const pending = [...source.sources];
    for (let index = 0; index < pending.length; index += 1) {
        const child = pending[index];
        if (!child) continue;
        keys.push(stableSerialize(child));
        if (child.type === 'mixed') pending.push(...child.sources);
    }
    return keys;
}

function stableSerialize(value: unknown, seen = new WeakSet<object>()): string {
    if (value === undefined || value === null) return JSON.stringify(value ?? null);
    if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new Error('Unsupported content source cache key value: non-finite number');
        }
        return JSON.stringify(value);
    }
    if (typeof value !== 'object') throw new Error(`Unsupported source key type: ${typeof value}`);
    if (seen.has(value)) {
        throw new Error('Cannot build content source cache key for circular source data');
    }
    seen.add(value);
    try {
        if (Array.isArray(value)) {
            return `[${value.map((entry) => stableSerialize(entry, seen)).join(',')}]`;
        }
        const entries = Object.entries(value)
            .filter(([, entry]) => entry !== undefined)
            .sort(([left], [right]) => left.localeCompare(right));
        return `{${entries.map(([key, entry]) =>
            `${JSON.stringify(key)}:${stableSerialize(entry, seen)}`).join(',')}}`;
    } finally {
        seen.delete(value);
    }
}

function throwIfAborted(signal: AbortSignal | null | undefined): void {
    if (signal?.aborted) throw signal.reason ?? createAbortError();
}

function createAbortError(): Error {
    if (typeof DOMException !== 'undefined') return new DOMException('Aborted', 'AbortError');
    const error = new Error('Aborted');
    error.name = 'AbortError';
    return error;
}
