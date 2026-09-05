import type { ChannelContentSource, ResolvedContentItem } from '../contracts/types';
import { RetainedOperationContext } from '../../../../utils/RetainedOperationContext';
import {
    SourceResolutionEntryAuthority,
    SourceResolutionScope,
    type SourceResolutionOperationContext,
} from './SourceResolutionEntryAuthority';
import {
    describeGuideFailure,
    guideDiagnosticClock,
} from '../../../debug/GuideDiagnosticValues';
import type {
    ObserveSourceResolution,
    SourceResolutionDiagnostic,
} from '../contracts/SourceResolutionDiagnostic';

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
    producerId: number;
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

type SourceResolutionCacheMode = 'default' | 'revalidate';

let nextSourceProducerId = 1;
let nextSourceConsumerId = 1;

export class SourceResolutionCache {
    private _cacheEpoch = 0;
    private readonly _sourceCacheGenerationByKey = new Map<string, number>();
    private readonly _sourceCache = new Map<string, SourceCacheEntry>();
    private readonly _sourceInFlight = new Map<string, SourceInFlightEntry>();
    private readonly _activeProducerPromises = new Set<Promise<ResolvedContentItem[]>>();
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

    async whenIdle(): Promise<void> {
        while (this._activeProducerPromises.size > 0) {
            await Promise.allSettled([...this._activeProducerPromises]);
        }
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
        callerSignal?: AbortSignal | null,
        cacheMode: SourceResolutionCacheMode = 'default',
        onDiagnostic?: ObserveSourceResolution
    ): Promise<ResolvedContentItem[]> {
        const consumerId = nextSourceConsumerId++;
        const consumerStartedAt = guideDiagnosticClock().monotonicMs;
        operation.assertCurrent();
        throwIfAborted(callerSignal);
        const cacheKey = this.buildKey(source);
        const epoch = this._cacheEpoch;
        const generation = this._getSourceCacheGeneration(cacheKey);
        const cached = cacheMode === 'revalidate'
            ? null
            : this._getCachedSourceItems(cacheKey, operation);
        if (cached) {
            this._emitDiagnostic(onDiagnostic, {
                event: 'access', consumerId, producerId: null, access: 'cache', cacheMode,
                outcome: 'pending', itemCount: null, operation, callerSignal,
                consumerSignal: operation.signal, producerSignal: null, failure: null,
                startedAtMonotonic: consumerStartedAt, waiters: 0,
            });
            try {
                operation.assertCurrent();
                throwIfAborted(callerSignal);
                this._emitDiagnostic(onDiagnostic, {
                    event: 'result', consumerId, producerId: null, access: 'cache', cacheMode,
                    outcome: 'success', itemCount: cached.length, operation, callerSignal,
                    consumerSignal: operation.signal, producerSignal: null, failure: null,
                    startedAtMonotonic: consumerStartedAt, waiters: 0,
                });
                operation.assertCurrent();
                throwIfAborted(callerSignal);
                if (epoch !== this._cacheEpoch || generation !== this._getSourceCacheGeneration(cacheKey)) {
                    throw createAbortError();
                }
                return cached;
            } catch (error) {
                this._emitDiagnostic(onDiagnostic, {
                    event: 'settled', consumerId, producerId: null, access: 'cache', cacheMode,
                    outcome: 'failure', itemCount: null, operation, callerSignal,
                    consumerSignal: operation.signal, producerSignal: null, failure: error,
                    startedAtMonotonic: consumerStartedAt, waiters: 0,
                });
                throw error;
            }
        }

        const inFlight = this._sourceInFlight.get(cacheKey);
        if (inFlight) {
            if (
                inFlight.epoch === epoch
                && inFlight.generation === generation
                && inFlight.authority.scope.authority === operation.authority
                && this._isEntryCurrent(inFlight)
            ) {
                return this._awaitInFlight(cacheKey, inFlight, operation, callerSignal ?? null, {
                    consumerId, access: 'join', cacheMode, consumerStartedAt,
                    ...(onDiagnostic ? { onDiagnostic } : {}),
                });
            }
            this._closeEntry(inFlight);
            this._sourceInFlight.delete(cacheKey);
        }

        const entryScope = operation.commonScope.retain(`source-entry:${cacheKey}`);
        const authority = new SourceResolutionEntryAuthority(entryScope);
        const entry: SourceInFlightEntry = {
            producerId: nextSourceProducerId++,
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
            commonScope: operation.commonScope,
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
        this._activeProducerPromises.add(resolvePromise);
        void resolvePromise.then(
            () => this._activeProducerPromises.delete(resolvePromise),
            () => this._activeProducerPromises.delete(resolvePromise)
        );
        this._sourceInFlight.set(cacheKey, entry);
        try {
            return this._awaitInFlight(cacheKey, entry, operation, callerSignal ?? null, {
                consumerId, access: 'create', cacheMode, consumerStartedAt,
                ...(onDiagnostic ? { onDiagnostic } : {}),
            });
        } catch (error) {
            if (entry.waiters === 0 && this._sourceInFlight.get(cacheKey) === entry) {
                this._sourceInFlight.delete(cacheKey);
                this._closeEntry(entry);
            }
            throw error;
        }
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
        callerSignal: AbortSignal | null,
        diagnostic: {
            consumerId: number;
            access: 'create' | 'join';
            cacheMode: SourceResolutionCacheMode;
            onDiagnostic?: ObserveSourceResolution;
            consumerStartedAt: number;
        }
    ): Promise<ResolvedContentItem[]> {
        let waiter: RetainedOperationContext;
        try {
            waiter = new RetainedOperationContext([
                operation,
                {
                    signal: callerSignal,
                    assertCurrent: (): void => throwIfAborted(callerSignal),
                },
                entry.authority,
            ]);
        } catch (error) {
            this._emitDiagnostic(diagnostic.onDiagnostic, {
                event: 'access', consumerId: diagnostic.consumerId, producerId: entry.producerId,
                access: diagnostic.access, cacheMode: diagnostic.cacheMode, outcome: 'pending',
                itemCount: null, operation, callerSignal, consumerSignal: operation.signal,
                producerSignal: entry.authority.signal, failure: null,
                startedAtMonotonic: diagnostic.consumerStartedAt, waiters: entry.waiters,
            });
            this._emitDiagnostic(diagnostic.onDiagnostic, {
                event: 'settled', consumerId: diagnostic.consumerId, producerId: entry.producerId,
                access: diagnostic.access, cacheMode: diagnostic.cacheMode, outcome: 'failure',
                itemCount: null, operation, callerSignal, consumerSignal: operation.signal,
                producerSignal: entry.authority.signal, failure: error,
                startedAtMonotonic: diagnostic.consumerStartedAt, waiters: entry.waiters,
            });
            throw error;
        }
        entry.waiters += 1;
        let onAbort = (): void => undefined;
        const aborted = new Promise<ResolvedContentItem[]>((_, reject) => {
            onAbort = (): void => reject(waiter.signal.reason ?? createAbortError());
            waiter.signal.addEventListener('abort', onAbort, { once: true });
        });
        this._emitDiagnostic(diagnostic.onDiagnostic, {
            event: 'access', consumerId: diagnostic.consumerId, producerId: entry.producerId,
            access: diagnostic.access, cacheMode: diagnostic.cacheMode, outcome: 'pending',
            itemCount: null, operation, callerSignal, consumerSignal: waiter.signal,
            producerSignal: entry.authority.signal, failure: null,
            startedAtMonotonic: diagnostic.consumerStartedAt, waiters: entry.waiters,
        });
        return Promise.race([entry.promise, aborted]).then((items) => {
            waiter.assertCurrent();
            const cloned = this.cloneItems(items);
            this._emitDiagnostic(diagnostic.onDiagnostic, {
                event: 'result', consumerId: diagnostic.consumerId, producerId: entry.producerId,
                access: diagnostic.access, cacheMode: diagnostic.cacheMode, outcome: 'success',
                itemCount: cloned.length, operation, callerSignal, consumerSignal: waiter.signal,
                producerSignal: entry.authority.signal, failure: null,
                startedAtMonotonic: diagnostic.consumerStartedAt, waiters: entry.waiters,
            });
            waiter.assertCurrent();
            if (
                entry.epoch !== this._cacheEpoch
                || entry.generation !== this._getSourceCacheGeneration(key)
            ) throw createAbortError();
            return cloned;
        }).catch((error: unknown) => {
            this._emitDiagnostic(diagnostic.onDiagnostic, {
                event: 'settled', consumerId: diagnostic.consumerId, producerId: entry.producerId,
                access: diagnostic.access, cacheMode: diagnostic.cacheMode, outcome: 'failure',
                itemCount: null, operation, callerSignal, consumerSignal: waiter.signal,
                producerSignal: entry.authority.signal, failure: error,
                startedAtMonotonic: diagnostic.consumerStartedAt, waiters: entry.waiters,
            });
            throw error;
        }).finally(() => {
            waiter.signal.removeEventListener('abort', onAbort);
            waiter.release();
            entry.waiters -= 1;
            if (entry.waiters === 0 && this._sourceInFlight.get(key) === entry) {
                this._sourceInFlight.delete(key);
                this._closeEntry(entry);
            }
            if (entry.waiters === 0 && entry.completed) this._releaseEntry(entry);
        });
    }

    private _emitDiagnostic(
        observer: ObserveSourceResolution | undefined,
        value: {
            event: SourceResolutionDiagnostic['event'];
            consumerId: number;
            producerId: number | null;
            access: SourceResolutionDiagnostic['access'];
            cacheMode: SourceResolutionCacheMode;
            outcome: SourceResolutionDiagnostic['outcome'];
            itemCount: number | null;
            operation: SourceResolutionOperationContext;
            callerSignal: AbortSignal | null | undefined;
            consumerSignal: AbortSignal;
            producerSignal: AbortSignal | null;
            failure: unknown;
            startedAtMonotonic: number;
            waiters: number;
        }
    ): void {
        if (!observer) return;
        try {
            const clock = guideDiagnosticClock();
            const commonSignal = value.operation.commonScope.signal;
            const failure = value.failure;
            observer({
                event: value.event,
                consumerId: value.consumerId,
                producerId: value.producerId,
                access: value.access,
                cacheMode: value.cacheMode,
                outcome: value.outcome,
                timeOrigin: clock.timeOrigin,
                monotonicMs: clock.monotonicMs,
                elapsedMs: Math.max(0, clock.monotonicMs - value.startedAtMonotonic),
                itemCount: value.itemCount,
                activeProducers: this._activeProducerPromises.size,
                waiters: value.waiters,
                callerAborted: value.callerSignal?.aborted === true,
                consumerAborted: value.consumerSignal.aborted,
                producerAborted: value.producerSignal?.aborted === true,
                commonScopeAborted: commonSignal.aborted,
                matchesConsumerReason: value.outcome === 'failure' && value.consumerSignal.aborted
                    && failure === value.consumerSignal.reason,
                matchesProducerReason: value.outcome === 'failure' && value.producerSignal?.aborted === true
                    && failure === value.producerSignal.reason,
                matchesCommonScopeReason: value.outcome === 'failure' && commonSignal.aborted
                    && failure === commonSignal.reason,
                failure: value.outcome === 'failure' ? describeGuideFailure(failure) : null,
            });
        } catch {
            // Diagnostic observation is best-effort and never affects resolution.
        }
    }

    private _closeEntry(entry: SourceInFlightEntry): void {
        entry.authority.close();
    }

    private _isEntryCurrent(entry: SourceInFlightEntry): boolean {
        try {
            entry.authority.assertCurrent();
            return true;
        } catch {
            return false;
        }
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
