import { ChannelManager } from '../ChannelManager';
import type { ChannelContentSource, ChannelUpdateInput } from '../contracts/types';
import { ChannelRepository } from '../persistence/ChannelRepository';
import { STORAGE_KEY } from '../constants';
import { installMockLocalStorage, mockLocalStorage, resetMockLocalStorage, restoreOriginalLocalStorage } from '../../../../__tests__/mocks/localStorage';
import { createBaseChannel, createMockContentSource, createMockItem, createMockLibrary } from './channel-manager-test-helpers';

installMockLocalStorage();

describe('ChannelManager durable authored boundary', () => {
    const library = createMockLibrary();
    const logger = { warn: jest.fn(), error: jest.fn() };
    let manager: ChannelManager;
    beforeEach(() => {
        resetMockLocalStorage();
        jest.restoreAllMocks();
        library.getLibraryItems.mockResolvedValue([createMockItem()]);
        manager = new ChannelManager({ plexLibrary: library, logger });
    });
    afterEach(() => manager.dispose());
    afterAll(() => restoreOriginalLocalStorage());

    it('does not publish create or revision when body write fails', async () => {
        const created = jest.fn();
        manager.on('channelCreated', created);
        jest.spyOn(ChannelRepository.prototype, 'saveStoredChannelData').mockReturnValue({ ok: false, reason: 'quota-exceeded' });
        const result = await manager.tryCreateChannel({ contentSource: createMockContentSource() });
        expect(result.kind).toBe('storage-failure');
        expect(manager.getAllChannels()).toEqual([]);
        expect(manager.getStructuralBase().revision).toBe(0);
        expect(created).not.toHaveBeenCalled();
    });

    it('fences concurrent creates before persistence', async () => {
        let release!: (items: ReturnType<typeof createMockItem>[]) => void;
        library.getLibraryItems.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
        const first = manager.tryCreateChannel({ contentSource: createMockContentSource() });
        const second = manager.tryCreateChannel({ contentSource: createMockContentSource() });
        for (let i = 0; i < 20 && !release; i++) await Promise.resolve();
        release([createMockItem()]);
        const results = await Promise.all([first, second]);
        expect(results.filter((result) => result.kind === 'committed')).toHaveLength(1);
        expect(manager.getAllChannels().map((channel) => channel.number)).toEqual([1]);
    });

    it('preserves selection made during async authoring and rejects stale update', async () => {
        await manager.replaceAllChannels([createBaseChannel({ id: 'a', number: 1 }), createBaseChannel({ id: 'b', number: 2 })]);
        let release!: (items: ReturnType<typeof createMockItem>[]) => void;
        library.getLibraryItems.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
        const pending = manager.tryUpdateChannel('a', { contentSource: createMockContentSource('other') });
        manager.setCurrentChannel('b');
        for (let i = 0; i < 20 && !release; i++) await Promise.resolve();
        release([createMockItem()]);
        expect((await pending).kind).toBe('committed');
        expect(manager.getCurrentChannel()?.id).toBe('b');
        const saved = JSON.parse(mockLocalStorage.getItem(STORAGE_KEY) ?? '{}') as { currentChannelId: string };
        expect(saved.currentChannelId).toBe('b');
    });

    it('keeps unreadable bytes through canceled, stale, failed, and successful protected replacement', async () => {
        const raw = '{unreadable';
        mockLocalStorage.setItem(STORAGE_KEY, raw);
        const loaded = await manager.loadChannels();
        expect(loaded.kind).toBe('unreadable');
        if (loaded.kind !== 'unreadable') return;
        const candidate = [createBaseChannel({ id: 'new' })];
        manager.cancelProtectedReplacement(loaded.replacementHandle);
        expect((await manager.tryReplaceAllChannels(candidate, { protectedReplacementHandle: loaded.replacementHandle })).kind).toBe('conflict');
        expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe(raw);
        const prepared = manager.prepareProtectedReplacement();
        if (prepared.kind !== 'unreadable') return;
        mockLocalStorage.setItem(STORAGE_KEY, '{changed');
        expect((await manager.tryReplaceAllChannels(candidate, { protectedReplacementHandle: prepared.replacementHandle })).kind).toBe('conflict');
        mockLocalStorage.setItem(STORAGE_KEY, raw);
        const read = mockLocalStorage.getItem.getMockImplementation();
        mockLocalStorage.getItem.mockImplementation(() => { throw new Error('blocked'); });
        expect((await manager.tryReplaceAllChannels(candidate, { protectedReplacementHandle: prepared.replacementHandle })).kind).toBe('conflict');
        if (read) mockLocalStorage.getItem.mockImplementation(read);
        expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe(raw);
        jest.spyOn(ChannelRepository.prototype, 'saveStoredChannelData').mockReturnValueOnce({ ok: false, reason: 'quota-exceeded' });
        expect((await manager.tryReplaceAllChannels(candidate, { protectedReplacementHandle: prepared.replacementHandle })).kind).toBe('storage-failure');
        expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe(raw);
        const success = await manager.tryReplaceAllChannels(candidate, { protectedReplacementHandle: prepared.replacementHandle });
        expect(success.kind).toBe('committed');
        expect(manager.getAllChannels().map((channel) => channel.id)).toEqual(['new']);
    });

    it('reports absent, valid empty, unsupported, and read failure distinctly without erasing data', async () => {
        expect((await manager.loadChannels()).kind).toBe('absent');
        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify({ channels: [], channelOrder: [], currentChannelId: null, savedAt: 1 }));
        expect((await manager.loadChannels()).kind).toBe('valid-empty');
        const future = JSON.stringify({ version: 99, channels: [], channelOrder: [] });
        mockLocalStorage.setItem(STORAGE_KEY, future);
        expect((await manager.loadChannels()).kind).toBe('unsupported');
        expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe(future);
        jest.spyOn(mockLocalStorage, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
        expect((await manager.loadChannels()).kind).toBe('read-failed');
    });

    it('increments structural revision for every authored writer and leaves selection neutral', async () => {
        const initial = manager.getStructuralBase();
        const created = await manager.createChannel({ contentSource: createMockContentSource() });
        expect(manager.getStructuralBase().revision).toBe(initial.revision + 1);
        manager.setCurrentChannel(created.id);
        expect(manager.getStructuralBase().revision).toBe(initial.revision + 1);
        await manager.updateChannel(created.id, { name: 'Edited' });
        expect(manager.getStructuralBase().revision).toBe(initial.revision + 2);
        await manager.reorderChannels([created.id]);
        expect(manager.getStructuralBase().revision).toBe(initial.revision + 3);
        await manager.deleteChannel(created.id);
        expect(manager.getStructuralBase().revision).toBe(initial.revision + 4);
        await manager.replaceAllChannels([createBaseChannel({ id: 'replacement' })]);
        expect(manager.getStructuralBase().revision).toBe(initial.revision + 5);
        const loaded = await manager.loadChannels();
        expect(loaded.generation).toBeGreaterThan(initial.generation);
        expect(manager.getStructuralBase().revision).toBe(initial.revision + 6);
    });

    it('does not let a late update resurrect a deleted channel', async () => {
        await manager.replaceAllChannels([createBaseChannel({ id: 'a' })]);
        let release!: (items: ReturnType<typeof createMockItem>[]) => void;
        library.getLibraryItems.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
        const pending = manager.tryUpdateChannel('a', { contentSource: createMockContentSource('other') });
        for (let i = 0; i < 20 && !release; i++) await Promise.resolve();
        await manager.deleteChannel('a');
        release([createMockItem()]);
        expect((await pending).kind).toBe('conflict');
        expect(manager.getChannel('a')).toBeNull();
        expect(JSON.parse(mockLocalStorage.getItem(STORAGE_KEY) ?? '{}').channels).toEqual([]);
    });

    it('supersedes queued metadata snapshots before a structural replacement', async () => {
        await manager.replaceAllChannels([createBaseChannel({ id: 'old' })]);
        const queued = manager.saveChannels();
        await manager.replaceAllChannels([createBaseChannel({ id: 'new' })]);
        await queued;
        await manager.flushSaves();
        expect(JSON.parse(mockLocalStorage.getItem(STORAGE_KEY) ?? '{}').channelOrder).toEqual(['new']);
    });

    it('rejects invalid replacement without changing old body and reports a pointer warning after commit', async () => {
        await manager.replaceAllChannels([createBaseChannel({ id: 'old' })]);
        const body = mockLocalStorage.getItem(STORAGE_KEY);
        const invalid = await manager.tryReplaceAllChannels([
            createBaseChannel({ id: 'a', number: 1 }), createBaseChannel({ id: 'b', number: 1 }),
        ]);
        expect(invalid.kind).toBe('invalid');
        expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe(body);
        jest.spyOn(ChannelRepository.prototype, 'saveCurrentChannelId').mockReturnValue({ ok: false, reason: 'quota-exceeded' });
        const committed = await manager.tryReplaceAllChannels([createBaseChannel({ id: 'new' })], { currentChannelId: 'new' });
        expect(committed.kind).toBe('committed');
        if (committed.kind === 'committed') expect(committed.pointerWarning).toBe(true);
        expect(manager.getAllChannels().map((channel) => channel.id)).toEqual(['new']);
    });

    it('invalidates protected handles on reload and scope switch, even with identical raw bytes', async () => {
        mockLocalStorage.setItem(STORAGE_KEY, '{broken');
        const first = await manager.loadChannels();
        if (first.kind !== 'unreadable') throw new Error('expected unreadable');
        const base = manager.getStructuralBase();
        await manager.loadChannels();
        expect((await manager.tryReplaceAllChannels([createBaseChannel()], {
            expectedBase: base, protectedReplacementHandle: first.replacementHandle,
        })).kind).toBe('conflict');
        const second = manager.prepareProtectedReplacement();
        if (second.kind !== 'unreadable') throw new Error('expected unreadable');
        manager.setStorageKeys('other-channels', 'other-current');
        expect((await manager.tryReplaceAllChannels([createBaseChannel()], {
            protectedReplacementHandle: second.replacementHandle,
        })).kind).toBe('conflict');
        expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe('{broken');
    });


    it('preserves newer resolved metadata on unchanged replacement survivors', async () => {
        await manager.replaceAllChannels([createBaseChannel({ id: 'survivor' })]);
        const reviewed = manager.getAllChannels();
        await manager.refreshChannelContent('survivor');
        const refreshed = manager.getChannel('survivor');
        expect(refreshed?.lastContentRefresh).toBeGreaterThan(reviewed[0]!.lastContentRefresh);
        await manager.replaceAllChannels(reviewed);
        expect(manager.getChannel('survivor')?.lastContentRefresh).toBe(refreshed?.lastContentRefresh);
        expect(manager.getChannel('survivor')?.itemCount).toBe(refreshed?.itemCount);
    });

    it('blocks ordinary writes after a read failure until a successful reload', async () => {
        const raw = '{do-not-erase';
        mockLocalStorage.setItem(STORAGE_KEY, raw);
        const read = mockLocalStorage.getItem.getMockImplementation();
        mockLocalStorage.getItem.mockImplementation(() => { throw new Error('blocked'); });
        expect((await manager.loadChannels()).kind).toBe('read-failed');
        if (read) mockLocalStorage.getItem.mockImplementation(read);
        expect((await manager.tryReplaceAllChannels([createBaseChannel()])).kind).toBe('conflict');
        expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe(raw);
        expect((await manager.loadChannels()).kind).toBe('unreadable');
    });


    it('keeps update, delete, and reorder state and events unchanged on body failure', async () => {
        await manager.replaceAllChannels([createBaseChannel({ id: 'a', number: 1 }), createBaseChannel({ id: 'b', number: 2 })]);
        const before = mockLocalStorage.getItem(STORAGE_KEY);
        const revision = manager.getStructuralBase().revision;
        const updated = jest.fn();
        const deleted = jest.fn();
        manager.on('channelUpdated', updated);
        manager.on('channelDeleted', deleted);
        jest.spyOn(ChannelRepository.prototype, 'saveStoredChannelData').mockReturnValue({ ok: false, reason: 'quota-exceeded' });
        expect((await manager.tryUpdateChannel('a', { name: 'Changed' })).kind).toBe('storage-failure');
        expect((await manager.tryDeleteChannel('a')).kind).toBe('storage-failure');
        expect((await manager.tryReorderChannels(['b', 'a'])).kind).toBe('storage-failure');
        expect(manager.getAllChannels().map((channel) => [channel.id, channel.name])).toEqual([['a', 'Base Channel'], ['b', 'Base Channel']]);
        expect(manager.getStructuralBase().revision).toBe(revision);
        expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe(before);
        expect(updated).not.toHaveBeenCalled();
        expect(deleted).not.toHaveBeenCalled();
    });


    it('preserves an exhausted legacy body through load and timers until explicit protected replacement', async () => {
        jest.useFakeTimers();
        try {
            const channels = Array.from({ length: 500 }, (_value, index) =>
                createBaseChannel({ id: `channel-${index + 1}`, number: index + 1 })
            );
            const raw = JSON.stringify({ channels: [...channels, { ...createBaseChannel({ id: 'overflow' }), number: null }],
                channelOrder: [...channels.map((channel) => channel.id), 'overflow'], currentChannelId: null, savedAt: 1 });
            mockLocalStorage.setItem(STORAGE_KEY, raw);
            const loaded = await manager.loadChannels();
            expect(loaded.kind).toBe('unreadable');
            expect(manager.getAllChannels()).toEqual([]);
            jest.advanceTimersByTime(60_000);
            expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe(raw);
            const prepared = manager.prepareProtectedReplacement();
            expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe(raw);
            if (prepared.kind !== 'unreadable') throw new Error('expected protected unreadable body');
            const result = await manager.tryReplaceAllChannels([createBaseChannel({ id: 'replacement' })], {
                expectedBase: manager.getStructuralBase(), protectedReplacementHandle: prepared.replacementHandle,
            });
            expect(result.kind).toBe('committed');
            expect(mockLocalStorage.getItem(STORAGE_KEY)).not.toBe(raw);
        } finally {
            jest.clearAllTimers();
            jest.useRealTimers();
        }
    });

    it('returns each committed receipt when another mutation commits before callers await', async () => {
        const first = manager.tryReplaceAllChannels([createBaseChannel({ id: 'a' })], { currentChannelId: 'a' });
        const second = manager.tryReplaceAllChannels([createBaseChannel({ id: 'b' })], { currentChannelId: 'b' });
        const [a, b] = await Promise.all([first, second]);
        expect(a).toMatchObject({ kind: 'committed', revision: 1, pointerWarning: false });
        expect(b).toMatchObject({ kind: 'committed', revision: 2, pointerWarning: false });
    });

    it('keeps a delete receipt owned through synchronous listener re-entry and pointer failure', async () => {
        await manager.replaceAllChannels([createBaseChannel({ id: 'a' })], { currentChannelId: 'a' });
        jest.spyOn(ChannelRepository.prototype, 'saveCurrentChannelId').mockReturnValueOnce({ ok: false, reason: 'quota-exceeded' });
        let nested: ReturnType<ChannelManager['tryReplaceAllChannels']> | undefined;
        manager.on('channelDeleted', () => { nested = manager.tryReplaceAllChannels([createBaseChannel({ id: 'b' })]); });
        const deleted = await manager.tryDeleteChannel('a');
        const replacement = await nested;
        expect(deleted).toMatchObject({ kind: 'committed', revision: 2, pointerWarning: true });
        expect(replacement).toMatchObject({ kind: 'committed', revision: 3, pointerWarning: false });
    });

    it('rejects malformed recursive authored sources and exact filter fields in every writer', async () => {
        const malformedSources: unknown[] = [
            { ...createMockContentSource(), libraryFilter: { genre: null } },
            { ...createMockContentSource(), libraryFilter: { genre: { nested: 'Drama' } } },
            { ...createMockContentSource(), libraryFilter: { year: Number.NaN } },
            { type: 'mixed', mixMode: 'interleave', sources: [{ ...createMockContentSource(), libraryFilter: { year: Infinity } }] },
            { type: 'manual', items: [{ ratingKey: 'one', title: 'One', durationMs: 1000, unexpected: true }] },
        ];
        for (const source of malformedSources) {
            const cast = source as ChannelContentSource;
            expect((await manager.tryCreateChannel({ contentSource: cast })).kind).toBe('invalid');
            expect((await manager.tryReplaceAllChannels([createBaseChannel({ contentSource: cast })])).kind).toBe('invalid');
        }
        await manager.replaceAllChannels([createBaseChannel({ id: 'valid' })]);
        for (const source of malformedSources) {
            expect((await manager.tryUpdateChannel('valid', { contentSource: source as ChannelContentSource })).kind).toBe('invalid');
        }
        const invalidFilter = { field: 'year', operator: 'gte', value: 2020, extra: 'lost' } as const;
        expect((await manager.tryUpdateChannel('valid', { contentFilters: [invalidFilter] })).kind).toBe('invalid');
        expect(manager.getChannel('valid')?.contentSource).toEqual(createMockContentSource());
    });

    it('rejects an unknown undefined update key without changing body, revision, or events', async () => {
        await manager.replaceAllChannels([createBaseChannel({ id: 'valid' })]);
        const body = mockLocalStorage.getItem(STORAGE_KEY);
        const revision = manager.getStructuralBase().revision;
        const updated = jest.fn();
        manager.on('channelUpdated', updated);

        const result = await manager.tryUpdateChannel('valid', { color: undefined } as unknown as ChannelUpdateInput);

        expect(result.kind).toBe('invalid');
        expect(manager.getStructuralBase().revision).toBe(revision);
        expect(manager.getChannel('valid')?.name).toBe('Base Channel');
        expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe(body);
        expect(updated).not.toHaveBeenCalled();
    });

    it('rejects malformed collection scope metadata before every authored write', async () => {
        library.getCollectionItems.mockClear();
        await manager.replaceAllChannels([createBaseChannel({ id: 'valid' })]);
        const body = mockLocalStorage.getItem(STORAGE_KEY);
        const revision = manager.getStructuralBase().revision;
        const created = jest.fn();
        const updated = jest.fn();
        manager.on('channelCreated', created);
        manager.on('channelUpdated', updated);
        const collection = {
            type: 'collection',
            collectionKey: 'collection-1',
            collectionName: 'Favorites',
        };
        const malformedSources: unknown[] = [
            { ...collection, libraryId: 'library-1' },
            { ...collection, libraryId: 'library-1', libraryType: 'movie' },
            { ...collection, libraryId: 'library-1', libraryType: 'other', libraryName: 'Movies' },
            { ...collection, libraryId: undefined },
            { ...collection, unrecognizedField: undefined },
        ];

        for (const source of malformedSources) {
            const contentSource = source as ChannelContentSource;
            expect((await manager.tryCreateChannel({ contentSource })).kind).toBe('invalid');
            expect((await manager.tryUpdateChannel('valid', { contentSource })).kind).toBe('invalid');
            expect((await manager.tryReplaceAllChannels([
                createBaseChannel({ id: 'replacement', contentSource }),
            ])).kind).toBe('invalid');
        }

        expect(manager.getStructuralBase().revision).toBe(revision);
        expect(manager.getAllChannels()).toEqual([expect.objectContaining({ id: 'valid' })]);
        expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe(body);
        expect(created).not.toHaveBeenCalled();
        expect(updated).not.toHaveBeenCalled();
        expect(library.getCollectionItems).not.toHaveBeenCalled();
    });

    it('persists and reloads nested collection scope without changing collection-key resolution', async () => {
        library.getCollectionItems.mockClear();
        library.getCollectionItems.mockResolvedValue([createMockItem()]);
        const contentSource: ChannelContentSource = {
            type: 'mixed',
            mixMode: 'sequential',
            sources: [
                {
                    type: 'collection',
                    collectionKey: 'movie-collection-key',
                    collectionName: 'Movie Collection',
                    libraryId: 'movie-library-id',
                    libraryType: 'movie',
                    libraryName: 'Movies',
                },
                {
                    type: 'mixed',
                    mixMode: 'interleave',
                    sources: [{
                        type: 'collection',
                        collectionKey: 'show-collection-key',
                        collectionName: 'Show Collection',
                        libraryId: 'show-library-id',
                        libraryType: 'show',
                        libraryName: 'TV Shows',
                    }],
                },
            ],
        };

        const channel = await manager.createChannel({ contentSource }, { initialContent: [] });
        const stored = JSON.parse(mockLocalStorage.getItem(STORAGE_KEY) ?? '{}') as {
            channels?: Array<{ contentSource: ChannelContentSource }>;
        };
        expect(stored.channels?.[0]?.contentSource).toEqual(contentSource);

        expect((await manager.loadChannels()).kind).toBe('readable');
        expect(manager.getChannel(channel.id)?.contentSource).toEqual(contentSource);
        await manager.resolveChannelContent(channel.id);

        expect(library.getCollectionItems.mock.calls.map(([key]) => key)).toEqual([
            'movie-collection-key',
            'show-collection-key',
        ]);
    });

    it('loads a malformed cached collection scope as readable-degraded and resolves by collection key', async () => {
        library.getCollectionItems.mockClear();
        library.getCollectionItems.mockResolvedValue([createMockItem()]);
        const contentSource = {
            type: 'mixed',
            mixMode: 'sequential',
            sources: [{
                type: 'collection',
                collectionKey: 'legacy-collection-key',
                collectionName: 'Legacy Collection',
                libraryId: 'library-1',
                libraryType: 'movie',
                libraryName: 17,
            }],
        } as unknown as ChannelContentSource;
        const storedChannel = createBaseChannel({ id: 'legacy', contentSource });
        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify({
            channels: [storedChannel],
            channelOrder: ['legacy'],
            currentChannelId: null,
            savedAt: 1,
        }));

        expect((await manager.loadChannels()).kind).toBe('readable-degraded');
        const loaded = manager.getChannel('legacy');
        expect(loaded?.contentSource).toEqual({
            type: 'mixed',
            mixMode: 'sequential',
            sources: [{
                type: 'collection',
                collectionKey: 'legacy-collection-key',
                collectionName: 'Legacy Collection',
            }],
        });

        await manager.resolveChannelContent('legacy');
        expect(library.getCollectionItems.mock.calls.map(([key]) => key)).toEqual(['legacy-collection-key']);
    });


    it('keeps replacement pointer warning and revision through warning-listener re-entry', async () => {
        jest.spyOn(ChannelRepository.prototype, 'saveCurrentChannelId').mockReturnValueOnce({ ok: false, reason: 'quota-exceeded' });
        let nested: ReturnType<ChannelManager['tryReplaceAllChannels']> | undefined;
        manager.on('persistenceWarning', () => {
            nested = manager.tryReplaceAllChannels([createBaseChannel({ id: 'second' })], { currentChannelId: 'second' });
        });
        const first = await manager.tryReplaceAllChannels([createBaseChannel({ id: 'first' })], { currentChannelId: 'first' });
        const second = await nested;
        expect(first).toMatchObject({ kind: 'committed', revision: 1, pointerWarning: true });
        expect(second).toMatchObject({ kind: 'committed', revision: 2, pointerWarning: false });
    });

    it('clears optional authored fields through the durable update command', async () => {
        library.getLibraryItems.mockResolvedValue([
            createMockItem({ ratingKey: 'alpha', title: 'Alpha', durationMs: 30_000 }),
            createMockItem({ ratingKey: 'beta', title: 'Beta', durationMs: 120_000 }),
        ]);
        await manager.replaceAllChannels([createBaseChannel({
            id: 'clearable',
            playbackMode: 'sequential',
        })]);
        const initialContent = await manager.resolveChannelContent('clearable');
        expect(initialContent.orderedItems.map((item) => item.ratingKey)).toEqual(['alpha', 'beta']);

        const set = await manager.tryUpdateChannel('clearable', {
            sortOrder: 'title_desc',
            minEpisodeRunTimeMs: 50_000,
            maxEpisodeRunTimeMs: 150_000,
        });
        expect(set.kind).toBe('committed');
        expect(manager.getChannel('clearable')).toMatchObject({
            sortOrder: 'title_desc',
            minEpisodeRunTimeMs: 50_000,
            maxEpisodeRunTimeMs: 150_000,
            itemCount: 1,
            totalDurationMs: 120_000,
        });
        const restrictedContent = await manager.resolveChannelContent('clearable');
        expect(restrictedContent.orderedItems.map((item) => item.ratingKey)).toEqual(['beta']);

        const undefinedUpdates: unknown = {
            sortOrder: undefined,
            minEpisodeRunTimeMs: undefined,
            maxEpisodeRunTimeMs: undefined,
        };
        const undefinedUpdate = await manager.tryUpdateChannel('clearable', undefinedUpdates as ChannelUpdateInput);
        expect(undefinedUpdate.kind).toBe('committed');
        expect(manager.getChannel('clearable')).toMatchObject({
            sortOrder: 'title_desc',
            minEpisodeRunTimeMs: 50_000,
            maxEpisodeRunTimeMs: 150_000,
        });

        const beforeInvalid = mockLocalStorage.getItem(STORAGE_KEY);
        const base = manager.getStructuralBase();
        const updated = jest.fn();
        manager.on('channelUpdated', updated);
        const invalidUpdates: unknown[] = [
            { clearFields: 'sortOrder' },
            { clearFields: ['sortOrder', null] },
            { clearFields: ['unknownField'] },
            { clearFields: ['name'] },
            { clearFields: ['sortOrder', 'sortOrder'] },
            { sortOrder: 'title_asc', clearFields: ['sortOrder'] },
            { unknownField: undefined },
        ];
        for (const update of invalidUpdates) {
            const result = await manager.tryUpdateChannel(
                'clearable', update as ChannelUpdateInput, base
            );
            expect(result.kind).toBe('invalid');
            expect(manager.getStructuralBase()).toEqual(base);
            expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe(beforeInvalid);
            expect(updated).not.toHaveBeenCalled();
        }

        jest.spyOn(ChannelRepository.prototype, 'saveStoredChannelData')
            .mockReturnValueOnce({ ok: false, reason: 'quota-exceeded' });
        const failedWrite = await manager.tryUpdateChannel('clearable', {
            clearFields: ['sortOrder', 'minEpisodeRunTimeMs', 'maxEpisodeRunTimeMs'],
        }, base);
        expect(failedWrite.kind).toBe('storage-failure');
        expect(manager.getStructuralBase()).toEqual(base);
        expect(manager.getChannel('clearable')).toMatchObject({
            sortOrder: 'title_desc',
            minEpisodeRunTimeMs: 50_000,
            maxEpisodeRunTimeMs: 150_000,
        });
        expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe(beforeInvalid);
        expect(updated).not.toHaveBeenCalled();

        const clearUpdates: unknown = {
            sortOrder: undefined,
            clearFields: ['sortOrder', 'minEpisodeRunTimeMs', 'maxEpisodeRunTimeMs'],
        };
        const committed = await manager.tryUpdateChannel('clearable', clearUpdates as ChannelUpdateInput, base);
        expect(committed).toMatchObject({ kind: 'committed', revision: base.revision + 1 });
        const body = mockLocalStorage.getItem(STORAGE_KEY);
        expect(body).not.toBe(beforeInvalid);
        if (body === null) throw new Error('expected persisted channel body');
        const stored = JSON.parse(body) as { channels: Array<Record<string, unknown>> };
        const storedChannel = stored.channels.find((channel) => channel.id === 'clearable');
        if (!storedChannel) throw new Error('expected persisted clearable channel');
        for (const field of ['sortOrder', 'minEpisodeRunTimeMs', 'maxEpisodeRunTimeMs']) {
            expect(Object.prototype.hasOwnProperty.call(storedChannel, field)).toBe(false);
        }
        expect(Object.prototype.hasOwnProperty.call(storedChannel, 'clearFields')).toBe(false);
        expect(updated).toHaveBeenCalledTimes(1);
        expect(manager.getChannel('clearable')).toMatchObject({
            itemCount: 2,
            totalDurationMs: 150_000,
        });
        const clearedContent = await manager.resolveChannelContent('clearable');
        expect(clearedContent.orderedItems.map((item) => item.ratingKey)).toEqual(['alpha', 'beta']);
        expect(clearedContent.fromCache).toBe(true);

        const reloadedManager = new ChannelManager({ plexLibrary: library, logger });
        try {
            expect((await reloadedManager.loadChannels()).kind).toBe('readable');
            const reloaded = reloadedManager.getChannel('clearable');
            expect(reloaded?.sortOrder).toBeUndefined();
            expect(reloaded?.minEpisodeRunTimeMs).toBeUndefined();
            expect(reloaded?.maxEpisodeRunTimeMs).toBeUndefined();
            expect(reloaded?.itemCount).toBe(2);
            expect(reloaded && Object.prototype.hasOwnProperty.call(reloaded, 'clearFields')).toBe(false);
            for (const field of ['sortOrder', 'minEpisodeRunTimeMs', 'maxEpisodeRunTimeMs'] as const) {
                expect(reloaded && Object.prototype.hasOwnProperty.call(reloaded, field)).toBe(false);
            }
        } finally {
            reloadedManager.dispose();
        }
    });

});
