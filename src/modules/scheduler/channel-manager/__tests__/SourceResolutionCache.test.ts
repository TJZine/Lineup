import { SourceResolutionCache } from '../resolution/SourceResolutionCache';
import { SourceResolutionScope } from '../resolution/SourceResolutionEntryAuthority';
import type { ChannelContentSource, ResolvedContentItem } from '../contracts/types';
import { flushPromises } from '../../../../__tests__/helpers';

type ResolveUncachedMock = jest.Mock<
    Promise<ResolvedContentItem[]>,
    [ChannelContentSource, { signal: AbortSignal }]
>;

function createItem(ratingKey: string, scheduledIndex = 0): ResolvedContentItem {
    return {
        ratingKey,
        type: 'movie',
        title: `Movie ${ratingKey}`,
        fullTitle: `Movie ${ratingKey}`,
        durationMs: 1000,
        thumb: null,
        year: 2024,
        scheduledIndex,
    };
}

function createManualSource(ratingKey: string): ChannelContentSource {
    return {
        type: 'manual',
        items: [{ ratingKey, title: `Manual ${ratingKey}`, durationMs: 1000 }],
    };
}

function createAbortError(): Error {
    const error = new Error('Aborted');
    error.name = 'AbortError';
    return error;
}

function createDeferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
} {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((resolvePromise) => {
        resolve = resolvePromise;
    });
    return { promise, resolve };
}

describe('SourceResolutionCache', () => {
    it('preserves existing scheduledIndex values when cloning item arrays', () => {
        const cache = new SourceResolutionCache();
        const nullScheduledIndex = {
            ...createItem('c'),
            scheduledIndex: null,
        } as unknown as ResolvedContentItem;
        const missingScheduledIndex = {
            ...createItem('d'),
            scheduledIndex: undefined,
        } as unknown as ResolvedContentItem;

        const result = cache.cloneItems([
            createItem('a', 10),
            createItem('b', 0),
            nullScheduledIndex,
            missingScheduledIndex,
        ]);

        expect(result.map((item) => item.scheduledIndex)).toEqual([10, 0, 2, 3]);
    });

    it('coalesces same-key resolves and returns independent item clones to each caller', async () => {
        const cache = new SourceResolutionCache();
        const source: ChannelContentSource = { type: 'manual', items: [] };
        const resolveUncached: ResolveUncachedMock = jest.fn().mockResolvedValue([
            {
                ...createItem('shared'),
                genres: ['Drama'],
                directors: ['Director A'],
                mediaInfo: { resolution: '1080p' },
            },
        ]);

        const [first, second] = await Promise.all([
            cache.resolve(source, resolveUncached),
            cache.resolve(source, resolveUncached),
        ]);

        first[0]!.genres!.push('Mutated');
        first[0]!.directors!.push('Mutated Director');
        first[0]!.mediaInfo!.resolution = '480p';

        expect(resolveUncached).toHaveBeenCalledTimes(1);
        expect(first).toHaveLength(1);
        expect(second).toHaveLength(1);
        expect(first).not.toBe(second);
        expect(first[0]).not.toBe(second[0]);
        expect(second[0]!.genres).toEqual(['Drama']);
        expect(second[0]!.directors).toEqual(['Director A']);
        expect(second[0]!.mediaInfo).toEqual({ resolution: '1080p' });

        const cached = await cache.resolve(source, resolveUncached);
        expect(resolveUncached).toHaveBeenCalledTimes(1);
        expect(cached).toHaveLength(1);
        expect(cached[0]!.genres).toEqual(['Drama']);
        expect(cached[0]!.directors).toEqual(['Director A']);
        expect(cached[0]!.mediaInfo).toEqual({ resolution: '1080p' });
    });

    it('reports only bounded source-resolution scalars for create, join, settle, and cache access', async () => {
        const cache = new SourceResolutionCache();
        const source = createManualSource('private-source-key');
        const deferred = createDeferred<ResolvedContentItem[]>();
        const resolveUncached: ResolveUncachedMock = jest.fn(
            (_source: ChannelContentSource, _options: { signal: AbortSignal }) => deferred.promise
        );
        const scope = new SourceResolutionScope([{ assertCurrent: jest.fn() }]);
        const firstOperation = scope.retain('first');
        const secondOperation = scope.retain('second');
        const diagnostics: unknown[] = [];

        const first = cache.resolveWithOperation(
            source, resolveUncached, firstOperation, null, 'default', (event) => diagnostics.push(event)
        );
        const second = cache.resolveWithOperation(
            source, resolveUncached, secondOperation, null, 'default', (event) => diagnostics.push(event)
        );
        deferred.resolve([createItem('private-item-key')]);
        await Promise.all([first, second]);
        const cachedOperation = scope.retain('cached');
        await cache.resolveWithOperation(
            source, resolveUncached, cachedOperation, null, 'default', (event) => diagnostics.push(event)
        );

        expect(diagnostics).toEqual(expect.arrayContaining([
            expect.objectContaining({ event: 'access', access: 'create', outcome: 'pending', waiters: 1 }),
            expect.objectContaining({ event: 'access', access: 'join', outcome: 'pending', waiters: 2 }),
            expect.objectContaining({ event: 'result', access: 'create', outcome: 'success', itemCount: 1 }),
            expect.objectContaining({ event: 'access', access: 'cache', producerId: null }),
        ]));
        const producerIds = diagnostics
            .filter((event): event is { access: string; producerId: number | null } => (
                typeof event === 'object' && event !== null && 'access' in event && 'producerId' in event
            ))
            .filter((event) => event.access === 'create' || event.access === 'join')
            .map((event) => event.producerId);
        expect(new Set(producerIds).size).toBe(1);
        const diagnosticJson = JSON.stringify(diagnostics);
        expect(diagnosticJson).not.toContain('private-source-key');
        expect(diagnosticJson).not.toContain('private-item-key');
        expect(diagnosticJson).not.toContain('title');
        expect(diagnosticJson).not.toContain('message');

        firstOperation.release();
        secondOperation.release();
        cachedOperation.release();
        scope.release();
    });

    it('keeps observed results provisional when an observer reentrantly invalidates them', async () => {
        const cache = new SourceResolutionCache();
        const source: ChannelContentSource = { type: 'manual', items: [] };
        const scope = new SourceResolutionScope([{ assertCurrent: jest.fn() }]);
        const successfulOperation = scope.retain('successful');

        await expect(cache.resolveWithOperation(
            source,
            jest.fn().mockResolvedValue([createItem('success')]),
            successfulOperation,
            null,
            'default',
            () => { throw new Error('observer failed'); }
        )).resolves.toEqual([expect.objectContaining({ ratingKey: 'success' })]);

        cache.clear();
        const canceledOperation = scope.retain('canceled');
        const delayed = createDeferred<ResolvedContentItem[]>();
        const replacementResolver: ResolveUncachedMock = jest.fn()
            .mockImplementationOnce(() => delayed.promise)
            .mockResolvedValueOnce([createItem('fresh')]);
        const observations: Array<{ event: string; outcome: string }> = [];
        const canceled = cache.resolveWithOperation(
            source,
            replacementResolver,
            canceledOperation,
            null,
            'default',
            (event) => {
                observations.push({ event: event.event, outcome: event.outcome });
                if (event.event === 'result') cache.invalidate(source);
            }
        );

        delayed.resolve([createItem('late')]);
        await expect(canceled).rejects.toMatchObject({ name: 'AbortError' });
        expect(observations).toEqual([
            { event: 'access', outcome: 'pending' },
            { event: 'result', outcome: 'success' },
            { event: 'settled', outcome: 'failure' },
        ]);
        await cache.whenIdle();
        await expect(cache.resolveWithOperation(
            source, replacementResolver, canceledOperation
        )).resolves.toEqual([expect.objectContaining({ ratingKey: 'fresh' })]);
        expect(replacementResolver).toHaveBeenCalledTimes(2);

        const cachedObservations: Array<{ event: string; outcome: string }> = [];
        await expect(cache.resolveWithOperation(
            source, replacementResolver, canceledOperation, null, 'default', (event) => {
                cachedObservations.push({ event: event.event, outcome: event.outcome });
                if (event.event === 'result') cache.invalidate(source);
            }
        )).rejects.toMatchObject({ name: 'AbortError' });
        expect(cachedObservations).toEqual(observations);
        expect(replacementResolver).toHaveBeenCalledTimes(2);

        const accessCanceledOperation = scope.retain('access-canceled');
        const accessCaller = new AbortController();
        const accessDeferred = createDeferred<ResolvedContentItem[]>();
        const accessCanceled = cache.resolveWithOperation(
            createManualSource('second-source'),
            jest.fn(() => accessDeferred.promise),
            accessCanceledOperation,
            accessCaller.signal,
            'default',
            (event) => {
                if (event.event === 'access') accessCaller.abort('caller-abort');
            }
        );
        await expect(accessCanceled).rejects.toBe('caller-abort');
        accessDeferred.resolve([createItem('second-late')]);
        await cache.whenIdle();
        successfulOperation.release();
        canceledOperation.release();
        accessCanceledOperation.release();
        scope.release();
    });

    it('does not start fresh source resolution when the caller is already aborted', async () => {
        const cache = new SourceResolutionCache();
        const source: ChannelContentSource = { type: 'manual', items: [] };
        const controller = new AbortController();
        controller.abort();
        const resolveUncached: ResolveUncachedMock = jest.fn();

        await expect(cache.resolve(source, resolveUncached, {
            signal: controller.signal,
        })).rejects.toMatchObject({ name: 'AbortError' });

        expect(resolveUncached).not.toHaveBeenCalled();
    });

    it('rejects in-flight callers on invalidation and refetches on the next resolve', async () => {
        const cache = new SourceResolutionCache();
        const source: ChannelContentSource = { type: 'manual', items: [] };
        const resolveUncached: ResolveUncachedMock = jest.fn()
            .mockImplementationOnce((_source, { signal }) => new Promise((_resolve, reject) => {
                signal.addEventListener('abort', () => reject(createAbortError()), { once: true });
            }))
            .mockResolvedValueOnce([createItem('after-invalidate')]);

        const first = cache.resolve(source, resolveUncached);
        const second = cache.resolve(source, resolveUncached);

        cache.invalidate(source);

        await expect(first).rejects.toMatchObject({ name: 'AbortError' });
        await expect(second).rejects.toMatchObject({ name: 'AbortError' });
        await expect(cache.resolve(source, resolveUncached)).resolves.toEqual([
            expect.objectContaining({ ratingKey: 'after-invalidate' }),
        ]);
        expect(resolveUncached).toHaveBeenCalledTimes(2);
    });

    it('drops late cache writes after clear even when uncached resolution ignores abort', async () => {
        const cache = new SourceResolutionCache();
        const source: ChannelContentSource = { type: 'manual', items: [] };
        const deferred = createDeferred<ResolvedContentItem[]>();
        const resolveUncached: ResolveUncachedMock = jest.fn()
            .mockImplementationOnce(() => deferred.promise)
            .mockResolvedValueOnce([createItem('after-clear')]);

        const inFlight = cache.resolve(source, resolveUncached);
        cache.clear();

        await expect(inFlight).rejects.toMatchObject({ name: 'AbortError' });
        deferred.resolve([createItem('late-write')]);
        await flushPromises();

        const afterClear = await cache.resolve(source, resolveUncached);

        expect(afterClear.map((item) => item.ratingKey)).toEqual(['after-clear']);
        expect(resolveUncached).toHaveBeenCalledTimes(2);
    });

    it('closes an orphaned entry when its last waiter aborts and blocks late cache publication', async () => {
        const cache = new SourceResolutionCache();
        const source: ChannelContentSource = { type: 'manual', items: [] };
        const deferred = createDeferred<ResolvedContentItem[]>();
        const caller = new AbortController();
        const resolveUncached: ResolveUncachedMock = jest.fn()
            .mockImplementationOnce(() => deferred.promise)
            .mockResolvedValueOnce([createItem('fresh')]);

        const first = cache.resolve(source, resolveUncached, { signal: caller.signal });
        caller.abort(createAbortError());
        await expect(first).rejects.toMatchObject({ name: 'AbortError' });
        deferred.resolve([createItem('orphan')]);
        await flushPromises();

        await expect(cache.resolve(source, resolveUncached)).resolves.toEqual([
            expect.objectContaining({ ratingKey: 'fresh' }),
        ]);
        expect(resolveUncached).toHaveBeenCalledTimes(2);
    });

    it('lets an immediate rejoin claim a producer before the canceled waiter cleanup runs', async () => {
        const cache = new SourceResolutionCache();
        const source: ChannelContentSource = { type: 'manual', items: [] };
        const deferred = createDeferred<ResolvedContentItem[]>();
        const caller = new AbortController();
        const resolveUncached: ResolveUncachedMock = jest.fn(
            (_source: ChannelContentSource, _options: { signal: AbortSignal }) => deferred.promise
        );

        const canceled = cache.resolve(source, resolveUncached, { signal: caller.signal });
        caller.abort('request-replaced');
        const rejoined = cache.resolve(source, resolveUncached);
        deferred.resolve([createItem('shared')]);

        await expect(canceled).rejects.toBe('request-replaced');
        await expect(rejoined).resolves.toEqual([
            expect.objectContaining({ ratingKey: 'shared' }),
        ]);
        expect(resolveUncached).toHaveBeenCalledTimes(1);
    });

    it('retires a zero-waiter entry when uncached creation synchronously cancels its caller', async () => {
        const cache = new SourceResolutionCache();
        const source: ChannelContentSource = { type: 'manual', items: [] };
        const obsolete = createDeferred<ResolvedContentItem[]>();
        const current = createDeferred<ResolvedContentItem[]>();
        const caller = new AbortController();
        const resolveUncached: ResolveUncachedMock = jest.fn()
            .mockImplementationOnce(() => {
                caller.abort('creation-canceled');
                return obsolete.promise;
            })
            .mockImplementationOnce(() => current.promise);

        const canceled = cache.resolve(source, resolveUncached, { signal: caller.signal });
        await expect(canceled).rejects.toBe('creation-canceled');

        const replacement = cache.resolve(source, resolveUncached);
        current.resolve([createItem('current')]);
        await expect(replacement).resolves.toEqual([
            expect.objectContaining({ ratingKey: 'current' }),
        ]);

        obsolete.resolve([createItem('obsolete')]);
        await cache.whenIdle();
        await expect(cache.resolve(source, resolveUncached)).resolves.toEqual([
            expect.objectContaining({ ratingKey: 'current' }),
        ]);
        expect(resolveUncached).toHaveBeenCalledTimes(2);
    });

    it('never coalesces the same source key across distinct resolution authorities', async () => {
        const cache = new SourceResolutionCache();
        const source: ChannelContentSource = { type: 'manual', items: [] };
        const firstDeferred = createDeferred<ResolvedContentItem[]>();
        const firstScope = new SourceResolutionScope([{ assertCurrent: jest.fn() }]);
        const secondScope = new SourceResolutionScope([{ assertCurrent: jest.fn() }]);
        const firstOperation = firstScope.retain('first');
        const secondOperation = secondScope.retain('second');
        const resolveUncached = jest.fn()
            .mockImplementationOnce(() => firstDeferred.promise)
            .mockResolvedValueOnce([createItem('second-scope')]);

        const first = cache.resolveWithOperation(source, resolveUncached, firstOperation);
        const second = cache.resolveWithOperation(source, resolveUncached, secondOperation);

        await expect(first).rejects.toMatchObject({ name: 'AbortError' });
        await expect(second).resolves.toEqual([
            expect.objectContaining({ ratingKey: 'second-scope' }),
        ]);
        firstDeferred.resolve([createItem('first-scope-late')]);
        await flushPromises();
        expect(resolveUncached).toHaveBeenCalledTimes(2);

        firstOperation.release();
        secondOperation.release();
        firstScope.release();
        secondScope.release();
    });

    it('invalidates mixed parent entries when a leaf source is invalidated', async () => {
        const cache = new SourceResolutionCache();
        const leafA = createManualSource('a');
        const leafB = createManualSource('b');
        const mixed: ChannelContentSource = { type: 'mixed', sources: [leafA, leafB], mixMode: 'sequential' };
        let resolveCount = 0;
        const resolveUncached: ResolveUncachedMock = jest.fn().mockImplementation(async (source) => {
            resolveCount += 1;
            return [createItem(`${source.type}-${resolveCount}`)];
        });

        const first = await cache.resolve(mixed, resolveUncached);
        const second = await cache.resolve(mixed, resolveUncached);
        cache.invalidate(leafA);
        const afterLeafInvalidate = await cache.resolve(mixed, resolveUncached);

        expect(first.map((item) => item.ratingKey)).toEqual(['mixed-1']);
        expect(second.map((item) => item.ratingKey)).toEqual(['mixed-1']);
        expect(afterLeafInvalidate.map((item) => item.ratingKey)).toEqual(['mixed-2']);
        expect(resolveUncached).toHaveBeenCalledTimes(2);
    });

    it('propagates invalidation from nested mixed children to ancestor mixed entries', async () => {
        const cache = new SourceResolutionCache();
        const leaf = createManualSource('leaf');
        const nested: ChannelContentSource = { type: 'mixed', sources: [leaf], mixMode: 'sequential' };
        const parent: ChannelContentSource = { type: 'mixed', sources: [nested], mixMode: 'sequential' };
        let resolveCount = 0;
        const resolveUncached: ResolveUncachedMock = jest.fn().mockImplementation(async (source) => {
            resolveCount += 1;
            return [createItem(`${source.type}-${resolveCount}`)];
        });

        await cache.resolve(nested, resolveUncached);
        await cache.resolve(parent, resolveUncached);
        await cache.resolve(parent, resolveUncached);
        cache.invalidate(leaf);
        const afterLeafInvalidate = await cache.resolve(parent, resolveUncached);

        expect(afterLeafInvalidate.map((item) => item.ratingKey)).toEqual(['mixed-3']);
        expect(resolveUncached).toHaveBeenCalledTimes(3);
    });

    it('invalidates ancestor mixed entries when the intermediate mixed entry was not primed first', async () => {
        const cache = new SourceResolutionCache();
        const leaf = createManualSource('leaf');
        const nested: ChannelContentSource = { type: 'mixed', sources: [leaf], mixMode: 'sequential' };
        const parent: ChannelContentSource = { type: 'mixed', sources: [nested], mixMode: 'sequential' };
        let resolveCount = 0;
        const resolveUncached: ResolveUncachedMock = jest.fn().mockImplementation(async (source) => {
            resolveCount += 1;
            return [createItem(`${source.type}-${resolveCount}`)];
        });

        const first = await cache.resolve(parent, resolveUncached);
        const second = await cache.resolve(parent, resolveUncached);
        cache.invalidate(leaf);
        const afterLeafInvalidate = await cache.resolve(parent, resolveUncached);

        expect(first.map((item) => item.ratingKey)).toEqual(['mixed-1']);
        expect(second.map((item) => item.ratingKey)).toEqual(['mixed-1']);
        expect(afterLeafInvalidate.map((item) => item.ratingKey)).toEqual(['mixed-2']);
        expect(resolveUncached).toHaveBeenCalledTimes(2);
    });

    it('recursively invalidates mixed sources and their child entries', async () => {
        const cache = new SourceResolutionCache();
        const leaf = createManualSource('leaf');
        const mixed: ChannelContentSource = { type: 'mixed', sources: [leaf], mixMode: 'sequential' };
        let resolveCount = 0;
        const resolveUncached: ResolveUncachedMock = jest.fn().mockImplementation(async (source) => {
            resolveCount += 1;
            return [createItem(`${source.type}-${resolveCount}`)];
        });

        await cache.resolve(leaf, resolveUncached);
        await cache.resolve(mixed, resolveUncached);
        cache.invalidate(mixed);
        const [leafAfterInvalidate, mixedAfterInvalidate] = await Promise.all([
            cache.resolve(leaf, resolveUncached),
            cache.resolve(mixed, resolveUncached),
        ]);

        expect(leafAfterInvalidate.map((item) => item.ratingKey)).toEqual(['manual-3']);
        expect(mixedAfterInvalidate.map((item) => item.ratingKey)).toEqual(['mixed-4']);
        expect(resolveUncached).toHaveBeenCalledTimes(4);
    });

    it('fails fast for circular source cache keys', () => {
        const cache = new SourceResolutionCache();
        const source = {
            type: 'mixed',
            mixMode: 'sequential',
            sources: [] as unknown[],
        };
        source.sources.push(source);

        expect(() => cache.buildKey(source as unknown as ChannelContentSource)).toThrow(
            'Cannot build content source cache key for circular source data'
        );
    });

    it.each<[unknown, string]>([
        [(): undefined => undefined, 'function'],
        [Symbol('source'), 'symbol'],
        [Number.POSITIVE_INFINITY, 'non-finite number'],
    ])('fails fast for unsupported source cache key values: %s', (value, expectedMessage) => {
        const cache = new SourceResolutionCache();
        const source = {
            type: 'manual',
            items: [],
            unsupported: value,
        } as unknown as ChannelContentSource;

        expect(() => cache.buildKey(source)).toThrow(expectedMessage);
    });

    it('expires cached entries after the source cache TTL', async () => {
        const cache = new SourceResolutionCache();
        const nowSpy = jest.spyOn(Date, 'now');
        let nowMs = 0;
        nowSpy.mockImplementation(() => nowMs);
        const source: ChannelContentSource = { type: 'manual', items: [] };
        const resolveUncached: ResolveUncachedMock = jest.fn().mockResolvedValue([createItem('ttl')]);

        try {
            await cache.resolve(source, resolveUncached);
            await cache.resolve(source, resolveUncached);
            nowMs = 300_001;
            await cache.resolve(source, resolveUncached);

            expect(resolveUncached).toHaveBeenCalledTimes(2);
        } finally {
            nowSpy.mockRestore();
        }
    });

    it('evicts the least recently used source cache entry when max entries are exceeded', async () => {
        const cache = new SourceResolutionCache();
        const sources = Array.from({ length: 25 }, (_, index) => createManualSource(`manual-${index}`));
        const resolveUncached: ResolveUncachedMock = jest.fn().mockImplementation(async (source) => {
            if (source.type !== 'manual') {
                return [createItem(source.type)];
            }
            return [createItem(source.items[0]!.ratingKey)];
        });

        for (const source of sources.slice(0, 24)) {
            await cache.resolve(source, resolveUncached);
        }
        await cache.resolve(sources[0]!, resolveUncached);
        await cache.resolve(sources[24]!, resolveUncached);
        await cache.resolve(sources[1]!, resolveUncached);

        expect(resolveUncached).toHaveBeenCalledTimes(26);
        expect(resolveUncached.mock.calls.map(([source]) => {
            if (source.type !== 'manual') {
                return source.type;
            }
            return source.items[0]!.ratingKey;
        })).toEqual([
            ...sources.slice(0, 24).map((source) => source.type === 'manual'
                ? source.items[0]!.ratingKey
                : source.type),
            'manual-24',
            'manual-1',
        ]);
    });
});
