import { ProductionAirCheck } from '../ProductionAirCheck';
import { ContentResolver } from '../../../modules/scheduler/channel-manager/resolution/ContentResolver';
import { OrchestratorSchedulePolicy } from '../../orchestrator/policy/OrchestratorSchedulePolicy';
import { buildScheduleIndex, calculateProgramAtTime, generateScheduleWindow } from '../../../modules/scheduler/scheduler/ScheduleCalculator';
import { ShuffleGenerator } from '../../../modules/scheduler/scheduler/ShuffleGenerator';
import { createBaseChannel, createMockItem, createMockLibrary } from '../../../modules/scheduler/channel-manager/__tests__/channel-manager-test-helpers';
import type { ChannelContentSource } from '../../../modules/scheduler/channel-manager/contracts/types';
import type { StudioAirCheckRequest } from '../../channel-studio/ChannelStudioContracts';
import { PlexLibraryError } from '../../../modules/plex/library/PlexLibraryError';
import { AppErrorCode } from '../../../types/app-errors';

// Resolver and ordering cases stay within one local day; rollover has separate coverage.
const at = new Date(2026, 9, 31, 12).getTime();
const base = { generation: 2, revision: 7 };

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(complete => { resolve = complete; });
    return { promise, resolve };
}

function request(source: ChannelContentSource, mode: 'sequential' | 'shuffle' | 'block' | 'random' = 'sequential'): StudioAirCheckRequest {
    return {
        draftRevision: 3, expectedBase: { ...base },
        candidate: createBaseChannel({ id: 'draft-stable', contentSource: source, playbackMode: mode,
            shuffleSeed: 13, phaseSeed: 17, blockSize: 2, scheduleAnchorMode: 'fixed', startTimeAnchor: at - 60_000 }),
        source, asOf: at, horizonMs: 6 * 60 * 60_000, sourceIdentity: JSON.stringify(source),
    };
}

function createManualLibrary(source: Extract<ChannelContentSource, { type: 'manual' }>): ReturnType<typeof createMockLibrary> {
    const library = createMockLibrary();
    library.getItem.mockImplementation(async ratingKey => {
        const item = source.items.find(candidate => candidate.ratingKey === ratingKey);
        return item ? createMockItem({ ...item }) : null;
    });
    return library;
}

describe('ProductionAirCheck', () => {
    const movie = (key: string): ReturnType<typeof createMockItem> => createMockItem({ ratingKey: key, title: `Movie ${key}`, durationMs: 30 * 60_000 });
    const episode = (key: string, season: number): ReturnType<typeof createMockItem> => createMockItem({ ratingKey: key, type: 'episode',
        title: `Episode ${key}`, durationMs: 20 * 60_000, seasonNumber: season, episodeNumber: 1, grandparentTitle: 'Series' });
    const sourceCases: Array<[string, ChannelContentSource]> = [
        ['library', { type: 'library', libraryId: 'lib', libraryType: 'movie', includeWatched: true, libraryFilter: { genre: 'Drama' } }],
        ['collection', { type: 'collection', collectionKey: 'collection', collectionName: 'Collection' }],
        ['show/season', { type: 'show', showKey: 'show', showName: 'Series', seasonFilter: [1] }],
        ['playlist', { type: 'playlist', playlistKey: 'playlist', playlistName: 'Playlist' }],
        ['manual duplicates', { type: 'manual', items: [
            { ratingKey: 'a', title: 'A', durationMs: 30 * 60_000 },
            { ratingKey: 'a', title: 'A', durationMs: 30 * 60_000 },
        ] }],
        ['recursive mixed', { type: 'mixed', mixMode: 'interleave', sources: [
            { type: 'library', libraryId: 'lib', libraryType: 'movie', includeWatched: true },
            { type: 'mixed', mixMode: 'sequential', sources: [{ type: 'show', showKey: 'show', showName: 'Series', seasonFilter: [1] }] },
        ] }],
    ];

    it.each(sourceCases)('uses the production resolver and scheduler for %s', async (_, source) => {
        const library = source.type === 'manual' ? createManualLibrary(source) : createMockLibrary();
        library.getLibraryItems.mockResolvedValue([movie('a'), movie('b')]);
        library.getCollectionItems.mockResolvedValue([movie('a'), movie('b')]);
        library.getShowEpisodes.mockResolvedValue([episode('s0', 0), episode('s1', 1)]);
        library.getPlaylistItems.mockResolvedValue([movie('a'), movie('b')]);
        const airCheck = new ProductionAirCheck({ library, getStructuralBase: (): typeof base => base, now: (): number => at });
        const input = request(source);
        const actual = await airCheck.verify(input, new AbortController().signal);
        expect(actual.kind).toBe('verified');
        if (actual.kind !== 'verified') return;
        const resolver = new ContentResolver(library);
        const selected = resolver.selectChannelItems(input.candidate, await resolver.resolveSource(source));
        const config = new OrchestratorSchedulePolicy().buildDailyScheduleConfig(input.candidate, selected, at);
        const index = buildScheduleIndex(config, new ShuffleGenerator());
        const live = generateScheduleWindow(at, at + input.horizonMs, index, config.anchorTime);
        expect(actual.programs.map(program => [program.item.ratingKey, program.scheduledStartTime, program.scheduledEndTime]))
            .toEqual(live.map(program => [program.item.ratingKey, program.scheduledStartTime, program.scheduledEndTime]));
        if (source.type === 'manual') expect(actual.items.map(item => item.ratingKey)).toEqual(['a', 'a']);
        if (source.type === 'show') expect(actual.items.map(item => item.ratingKey)).toEqual(['s1']);
        if (source.type === 'library') expect(library.getLibraryItems).toHaveBeenCalledWith('lib', expect.objectContaining({ filter: { genre: 'Drama' } }));
    });

    it.each(['missing', 'request-failed'] as const)('rejects %s hand-picked metadata instead of trusting the previous verified result', async (failure) => {
        const source: ChannelContentSource = { type: 'manual', items: [
            { ratingKey: 'removed', title: 'Cached title', durationMs: 30 * 60_000 },
        ] };
        const library = createMockLibrary();
        library.getItem.mockResolvedValueOnce(movie('removed'));
        if (failure === 'missing') library.getItem.mockResolvedValueOnce(null);
        else library.getItem.mockRejectedValueOnce(new Error('Private Plex request failed'));
        const check = new ProductionAirCheck({ library, getStructuralBase: (): typeof base => base, now: (): number => at });
        const input = request(source);
        expect((await check.verify(input, new AbortController().signal)).kind).toBe('verified');
        expect(await check.verify(input, new AbortController().signal)).toMatchObject({
            kind: 'error', reason: 'Could not verify the source. Retry Air Check.',
        });
        expect(library.getItem).toHaveBeenCalledTimes(2);
    });

    it('applies episode selection and filters to authoritative hand-picked metadata', async () => {
        const source: ChannelContentSource = { type: 'manual', items: ['special', 'regular'].map(ratingKey => ({
            ratingKey, title: 'Cached', durationMs: 1,
        })) };
        const library = createMockLibrary();
        library.getItem.mockImplementation(async ratingKey => createMockItem({ ...episode(ratingKey, ratingKey === 'special' ? 0 : 1),
            year: 2026, viewCount: 1, genres: ['Drama'] }));
        const input = request(source, 'block');
        input.candidate.includeSpecials = false;
        input.candidate.contentFilters = [{ field: 'year', operator: 'gte', value: 2025 },
            { field: 'watched', operator: 'eq', value: true }, { field: 'genre', operator: 'contains', value: 'Drama' }];
        const result = await new ProductionAirCheck({ library, getStructuralBase: (): typeof base => base, now: (): number => at })
            .verify(input, new AbortController().signal);
        expect(result.kind).toBe('verified');
        if (result.kind !== 'verified') return;
        expect(result.items).toHaveLength(1);
        expect(result.items[0]).toMatchObject({ ratingKey: 'regular', type: 'episode', seasonNumber: 1,
            year: 2026, watched: true, durationMs: 20 * 60_000 });
    });

    it('does not verify the playable subset when a mixed hand-picked source is incomplete', async () => {
        const source: ChannelContentSource = { type: 'mixed', mixMode: 'sequential', sources: [
            { type: 'library', libraryId: 'lib', libraryType: 'movie', includeWatched: true },
            { type: 'manual', items: ['valid', 'missing'].map(ratingKey => ({ ratingKey, title: ratingKey, durationMs: 30 * 60_000 })) },
        ] };
        const library = createMockLibrary();
        library.getLibraryItems.mockResolvedValue([movie('library-movie')]);
        library.getItem.mockImplementation(async ratingKey => ratingKey === 'valid' ? movie(ratingKey) : null);
        const result = await new ProductionAirCheck({ library, getStructuralBase: (): typeof base => base, now: (): number => at })
            .verify(request(source), new AbortController().signal);
        expect(result.kind).toBe('error');
    });

    it.each(['sequential', 'shuffle', 'block', 'random'] as const)('matches actual %s scheduling, including fixed seed and anchor', async mode => {
        const library = createMockLibrary();
        library.getShowEpisodes.mockResolvedValue([episode('special', 0), episode('one', 1), episode('two', 1)]);
        const source: ChannelContentSource = { type: 'show', showKey: 'show', showName: 'Series' };
        const input = request(source, mode);
        input.candidate.includeSpecials = false;
        const actual = await new ProductionAirCheck({ library, getStructuralBase: (): typeof base => base, now: (): number => at })
            .verify(input, new AbortController().signal);
        expect(actual.kind).toBe('verified');
        if (actual.kind !== 'verified') return;
        const resolver = new ContentResolver(library);
        const selected = resolver.selectChannelItems(input.candidate, await resolver.resolveSource(source));
        const config = new OrchestratorSchedulePolicy().buildDailyScheduleConfig(input.candidate, selected, at);
        const index = buildScheduleIndex(config, new ShuffleGenerator());
        expect(actual.programs.map(program => program.item.ratingKey))
            .toEqual(generateScheduleWindow(at, at + input.horizonMs, index, config.anchorTime).map(program => program.item.ratingKey));
        if (mode === 'block') expect(actual.items.map(item => item.ratingKey)).not.toContain('special');
    });

    it('applies real filters, sort, duration bounds and daily phase before projecting', async () => {
        const library = createMockLibrary();
        library.getLibraryItems.mockResolvedValue([
            movie('old'),
            createMockItem({ ratingKey: 'b', title: 'Bravo', year: 2026, durationMs: 30 * 60_000 }),
            createMockItem({ ratingKey: 'a', title: 'Alpha', year: 2026, durationMs: 40 * 60_000 }),
            createMockItem({ ratingKey: 'long', title: 'Long', year: 2026, durationMs: 80 * 60_000 }),
        ]);
        const source: ChannelContentSource = { type: 'library', libraryId: 'lib', libraryType: 'movie', includeWatched: true };
        const input = request(source);
        input.candidate.scheduleAnchorMode = 'daily';
        input.candidate.contentFilters = [{ field: 'year', operator: 'gte', value: 2025 }];
        input.candidate.sortOrder = 'title_asc';
        input.candidate.minEpisodeRunTimeMs = 25 * 60_000;
        input.candidate.maxEpisodeRunTimeMs = 60 * 60_000;
        const result = await new ProductionAirCheck({ library, getStructuralBase: (): typeof base => base, now: (): number => at })
            .verify(input, new AbortController().signal);
        expect(result.kind).toBe('verified');
        if (result.kind !== 'verified') return;
        expect(result.items.map(item => item.ratingKey)).toEqual(['a', 'b']);
        const liveConfig = new OrchestratorSchedulePolicy().buildDailyScheduleConfig(input.candidate, [...result.items], at);
        const liveIndex = buildScheduleIndex(liveConfig, new ShuffleGenerator());
        expect(result.programs[0]?.scheduledStartTime)
            .toBe(generateScheduleWindow(at, at + input.horizonMs, liveIndex, liveConfig.anchorTime)[0]?.scheduledStartTime);
    });

    it.each(['daily', 'fixed'] as const)('uses the next day shuffle seed across midnight with a %s anchor', async anchorMode => {
        const source: ChannelContentSource = { type: 'manual', items: ['a', 'b', 'c', 'd'].map(ratingKey => ({
            ratingKey, title: ratingKey, durationMs: 30 * 60_000,
        })) };
        const input = { ...request(source, 'shuffle'), asOf: new Date(2026, 10, 1, 23).getTime() };
        input.candidate.scheduleAnchorMode = anchorMode;
        input.candidate.startTimeAnchor = new Date(2026, 10, 1).getTime();
        input.candidate.phaseSeed = 0;
        const midnight = new Date(2026, 10, 2).getTime();
        const result = await new ProductionAirCheck({ library: createManualLibrary(source),
            getStructuralBase: (): typeof base => base, now: (): number => input.asOf })
            .verify(input, new AbortController().signal);
        expect(result.kind).toBe('verified');
        if (result.kind !== 'verified') return;

        const policy = new OrchestratorSchedulePolicy();
        const nextConfig = policy.buildDailyScheduleConfig(input.candidate, [...result.items], midnight);
        const nextIndex = buildScheduleIndex(nextConfig, new ShuffleGenerator());
        const expected = generateScheduleWindow(midnight, input.asOf + input.horizonMs, nextIndex, nextConfig.anchorTime);
        expect(result.programs.filter(program => program.scheduledStartTime >= midnight)
            .map(program => [program.item.ratingKey, program.scheduledStartTime, program.scheduledEndTime]))
            .toEqual(expected.map(program => [program.item.ratingKey, program.scheduledStartTime, program.scheduledEndTime]));
        expect(result.programs.find(program => program.scheduledStartTime >= midnight)?.scheduledStartTime).toBe(midnight);
    });

    it('finishes a program spanning midnight before projecting the new day without overlapping intervals', async () => {
        const source: ChannelContentSource = { type: 'manual', items: ['a', 'b', 'c'].map(ratingKey => ({
            ratingKey, title: ratingKey, durationMs: 35 * 60_000,
        })) };
        const input = { ...request(source), asOf: new Date(2026, 10, 1, 23).getTime() };
        input.candidate.scheduleAnchorMode = 'daily';
        input.candidate.phaseSeed = 0;
        const midnight = new Date(2026, 10, 2).getTime();
        const result = await new ProductionAirCheck({ library: createManualLibrary(source),
            getStructuralBase: (): typeof base => base, now: (): number => input.asOf })
            .verify(input, new AbortController().signal);
        expect(result.kind).toBe('verified');
        if (result.kind !== 'verified') return;

        const policy = new OrchestratorSchedulePolicy();
        const oldConfig = policy.buildDailyScheduleConfig(input.candidate, [...result.items], input.asOf);
        const oldIndex = buildScheduleIndex(oldConfig, new ShuffleGenerator());
        const overnight = calculateProgramAtTime(midnight - 1, oldIndex, oldConfig.anchorTime);
        expect(overnight.scheduledEndTime).toBeGreaterThan(midnight);
        const oldPosition = result.programs.findIndex(program => program.scheduledStartTime === overnight.scheduledStartTime);
        expect(oldPosition).toBeGreaterThanOrEqual(0);
        expect(result.programs[oldPosition]).toMatchObject({ item: { ratingKey: overnight.item.ratingKey },
            scheduledStartTime: overnight.scheduledStartTime, scheduledEndTime: overnight.scheduledEndTime });
        const handoff = overnight.scheduledEndTime;
        const nextConfig = policy.buildDailyScheduleConfig(input.candidate, [...result.items], handoff);
        const nextIndex = buildScheduleIndex(nextConfig, new ShuffleGenerator());
        const nextProgram = calculateProgramAtTime(handoff, nextIndex, nextConfig.anchorTime);
        expect(result.programs[oldPosition + 1]).toMatchObject({
            item: { ratingKey: nextProgram.item.ratingKey }, scheduledStartTime: handoff,
            scheduledEndTime: nextProgram.scheduledEndTime, elapsedMs: nextProgram.elapsedMs,
            remainingMs: nextProgram.remainingMs,
        });
        for (let position = 1; position < result.programs.length; position++) {
            expect(result.programs[position]?.scheduledStartTime).toBe(result.programs[position - 1]?.scheduledEndTime);
        }
    });

    it.each([
        ['spring-forward', new Date(2026, 2, 8).getTime()],
        ['fall-back', new Date(2026, 10, 1, 0, 30).getTime()],
    ] as const)('follows local calendar dates over the %s day', async (_label, asOf) => {
        const source: ChannelContentSource = { type: 'manual', items: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(ratingKey => ({
            ratingKey, title: ratingKey, durationMs: 15 * 60_000,
        })) };
        const input = { ...request(source, 'shuffle'), asOf, horizonMs: 24 * 60 * 60_000 };
        input.candidate.scheduleAnchorMode = 'daily';
        input.candidate.phaseSeed = 0;
        const result = await new ProductionAirCheck({ library: createManualLibrary(source),
            getStructuralBase: (): typeof base => base, now: (): number => asOf })
            .verify(input, new AbortController().signal);
        expect(result.kind).toBe('verified');
        if (result.kind !== 'verified') return;

        const policy = new OrchestratorSchedulePolicy();
        for (const program of result.programs) {
            const config = policy.buildDailyScheduleConfig(input.candidate, [...result.items], program.scheduledStartTime);
            const index = buildScheduleIndex(config, new ShuffleGenerator());
            const expected = calculateProgramAtTime(program.scheduledStartTime, index, config.anchorTime);
            expect([program.item.ratingKey, program.scheduledStartTime, program.scheduledEndTime])
                .toEqual([expected.item.ratingKey, expected.scheduledStartTime, expected.scheduledEndTime]);
        }
        expect(result.coverageEnd).toBeGreaterThanOrEqual(asOf + input.horizonMs);
    });

    it('applies one safe program budget across calendar-day segments', async () => {
        const source: ChannelContentSource = { type: 'manual', items: [{ ratingKey: 'short', title: 'Short', durationMs: 60_000 }] };
        const input = { ...request(source), asOf: new Date(2026, 10, 3, 12).getTime(), horizonMs: 24 * 60 * 60_000 };
        const result = await new ProductionAirCheck({ library: createManualLibrary(source),
            getStructuralBase: (): typeof base => base, now: (): number => input.asOf })
            .verify(input, new AbortController().signal);
        expect(result.kind).toBe('partial');
    });

    it('keeps an unavailable mixed collection incomplete and a top-level empty source off air', async () => {
        const library = createMockLibrary();
        library.getCollectionItems.mockRejectedValue(new Error('missing collection'));
        library.getLibraryItems.mockResolvedValue([movie('a')]);
        const airCheck = new ProductionAirCheck({ library, getStructuralBase: (): typeof base => base, now: (): number => at });
        const mixed: ChannelContentSource = { type: 'mixed', mixMode: 'sequential', sources: [
            { type: 'library', libraryId: 'lib', libraryType: 'movie', includeWatched: true },
            { type: 'collection', collectionKey: 'gone', collectionName: 'Gone' },
        ] };
        // Arbitrary failures propagate as errors; semantic missing collections are
        // covered by the resolver's dedicated contract tests.
        expect((await airCheck.verify(request(mixed), new AbortController().signal)).kind).toBe('error');
        expect((await airCheck.verify(request({ type: 'manual', items: [] }), new AbortController().signal)).kind).toBe('offair');
    });

    it('does not call a mixed source verified when a missing collection is silently skipped by live resolution', async () => {
        const library = createMockLibrary();
        library.getLibraryItems.mockResolvedValue([movie('a')]);
        library.getCollectionItems.mockRejectedValue(new PlexLibraryError(AppErrorCode.RESOURCE_NOT_FOUND, 'Missing', 404));
        const source: ChannelContentSource = { type: 'mixed', mixMode: 'interleave', sources: [
            { type: 'library', libraryId: 'lib', libraryType: 'movie', includeWatched: true },
            { type: 'collection', collectionKey: 'gone', collectionName: 'Gone' },
        ] };
        const result = await new ProductionAirCheck({ library, getStructuralBase: (): typeof base => base, now: (): number => at })
            .verify(request(source), new AbortController().signal);
        expect(result.kind).toBe('partial');
        const retained = await new ProductionAirCheck({ library, getStructuralBase: (): typeof base => base, now: (): number => at })
            .verify(request({ type: 'collection', collectionKey: 'gone', collectionName: 'Gone' }), new AbortController().signal);
        expect(retained.kind).toBe('offair');
    });

    it('does not call silently failed collection show expansion verified', async () => {
        const library = createMockLibrary();
        library.getCollectionItems.mockResolvedValue([
            movie('playable'),
            createMockItem({ ratingKey: 'show-container', type: 'show', title: 'Series', durationMs: 0 }),
        ]);
        library.getShowEpisodes.mockRejectedValue(new Error('Plex temporarily unavailable'));
        const source: ChannelContentSource = { type: 'collection', collectionKey: 'collection', collectionName: 'Series collection' };
        const result = await new ProductionAirCheck({ library, getStructuralBase: (): typeof base => base, now: (): number => at })
            .verify(request(source), new AbortController().signal);
        expect(result.kind).toBe('partial');
    });

    it('keeps overlapping extension and pre-save checks independent after a swallowed expansion failure', async () => {
        const library = createMockLibrary();
        const showContainer = createMockItem({ ratingKey: 'show-container', type: 'show', title: 'Series', durationMs: 0 });
        library.getCollectionItems.mockResolvedValue([movie('playable'), showContainer]);
        const extensionHeld = deferred<ReturnType<typeof movie>[]>();
        const saveHeld = deferred<ReturnType<typeof movie>[]>();
        const cleanHeld = deferred<ReturnType<typeof movie>[]>();
        const extensionWaiting = deferred<void>();
        const saveWaiting = deferred<void>();
        let showCalls = 0;
        library.getShowEpisodes.mockImplementation(() => {
            showCalls++;
            if (showCalls === 1 || showCalls === 3) return Promise.reject(new Error('Expansion failed'));
            if (showCalls === 2) { extensionWaiting.resolve(); return extensionHeld.promise; }
            if (showCalls === 4) { saveWaiting.resolve(); return saveHeld.promise; }
            throw new Error('Unexpected show fetch');
        });
        library.getLibraryItems.mockReturnValue(cleanHeld.promise);
        const check = new ProductionAirCheck({ library, getStructuralBase: (): typeof base => base, now: (): number => at });
        const source: ChannelContentSource = { type: 'collection', collectionKey: 'collection', collectionName: 'Series collection' };
        const extended = check.verify({ ...request(source), horizonMs: 12 * 60 * 60_000 }, new AbortController().signal);
        await extensionWaiting.promise; // warning already emitted; later expansion remains held
        const cleanSource: ChannelContentSource = { type: 'library', libraryId: 'clean', libraryType: 'movie', includeWatched: true };
        const clean = check.verify(request(cleanSource), new AbortController().signal);
        const presave = check.verify(request(source), new AbortController().signal);
        await saveWaiting.promise; // second warning while the unrelated clean check is held
        expect(library.getCollectionItems).toHaveBeenCalledTimes(2);
        cleanHeld.resolve([movie('clean')]);
        expect((await clean).kind).toBe('verified');
        extensionHeld.resolve([]); saveHeld.resolve([]);
        expect((await extended).kind).toBe('partial');
        expect((await presave).kind).toBe('partial');
    });

    it('does not publish a result after caller cancellation or scope change', async () => {
        const library = createMockLibrary();
        let release!: (items: ReturnType<typeof movie>[]) => void;
        let producerSignal: AbortSignal | null | undefined;
        library.getLibraryItems.mockImplementation((_id, options) => {
            producerSignal = options?.signal;
            return new Promise(resolve => { release = resolve; });
        });
        let current = base;
        const airCheck = new ProductionAirCheck({ library, getStructuralBase: (): typeof base => current, now: (): number => at });
        const source: ChannelContentSource = { type: 'library', libraryId: 'lib', libraryType: 'movie', includeWatched: true };
        const controller = new AbortController();
        const inFlight = airCheck.verify(request(source), controller.signal);
        controller.abort(); release([movie('a')]);
        expect((await inFlight).kind).toBe('canceled');
        expect(producerSignal?.aborted).toBe(true);
        library.getLibraryItems.mockResolvedValue([movie('a')]);
        current = { generation: 3, revision: 1 };
        expect((await airCheck.verify(request(source), new AbortController().signal)).kind).toBe('stale');
    });

    it('does not call a capped, undercovered horizon verified', async () => {
        const source: ChannelContentSource = { type: 'manual', items: [{ ratingKey: 'short', title: 'Short', durationMs: 1_000 }] };
        const library = createManualLibrary(source);
        const result = await new ProductionAirCheck({ library, getStructuralBase: (): typeof base => base, now: (): number => at })
            .verify(request(source), new AbortController().signal);
        expect(result.kind).toBe('partial');
    });
});
