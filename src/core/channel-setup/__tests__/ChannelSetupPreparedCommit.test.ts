/** @jest-environment jsdom */

import { ChannelSetupBuildCommitter } from '../build/ChannelSetupBuildCommitter';
import { ContentResolver } from '../../../modules/scheduler/channel-manager/resolution/ContentResolver';
import type { ChannelConfig, IChannelManager } from '../../../modules/scheduler/channel-manager';
import type { IPlexLibrary } from '../../../modules/plex/library';
import type { EpgScheduleRefreshResult } from '../../../shared/epgRefresh';

const channel: ChannelConfig = {
    id: 'reviewed-id', number: 42, name: 'Reviewed',
    contentSource: { type: 'library', libraryId: 'lib', libraryType: 'movie', includeWatched: true },
    playbackMode: 'shuffle', shuffleSeed: 72, phaseSeed: 72, startTimeAnchor: 1234,
    skipIntros: false, skipCredits: false, createdAt: 5, updatedAt: 5,
    lastContentRefresh: 0, itemCount: 0, totalDurationMs: 0,
};

const guideReady: EpgScheduleRefreshResult = {
    readiness: 'ready', attemptedChannelCount: 1, immediateReadyChannelCount: 1,
    backgroundQueuedChannelCount: 0, failedChannelCount: 0,
    staleCacheChannelCount: 0, firstVisibleScheduleReady: true,
};

const createHarness = (): {
    committer: ChannelSetupBuildCommitter;
    channelManager: jest.Mocked<IChannelManager>;
    ensureEpgInitialized: jest.Mock;
    refreshEpgSchedules: jest.Mock;
    clearSelectedChannelScheduleSnapshot: jest.Mock;
    primeEpgChannels: jest.Mock;
    request: Parameters<ChannelSetupBuildCommitter['commitPreparedCandidate']>[0];
} => {
    const channelManager = {
        tryReplaceAllChannels: jest.fn().mockResolvedValue({ kind: 'committed', value: undefined,
            revision: 9, pointerWarning: false }),
    } as unknown as jest.Mocked<IChannelManager>;
    const ensureEpgInitialized = jest.fn().mockResolvedValue(undefined);
    const refreshEpgSchedules = jest.fn().mockResolvedValue(guideReady);
    const clearSelectedChannelScheduleSnapshot = jest.fn();
    const primeEpgChannels = jest.fn();
    const committer = new ChannelSetupBuildCommitter({
        plexLibrary: {} as IPlexLibrary,
        channelManager,
        ensureEpgInitialized,
        clearSelectedChannelScheduleSnapshot,
        primeEpgChannels,
        refreshEpgSchedules,
    });
    const request = {
        channels: [channel], sourceCheckIds: ['reviewed-id'], expectedBase: { generation: 2, revision: 8 },
        minItemsPerChannel: 1,
        protectedReplacementHandle: null, isCurrent: (): boolean => true, signal: null,
        created: 1, skipped: 0, reachedMaxChannels: false,
    };
    return { committer, channelManager, ensureEpgInitialized, refreshEpgSchedules,
        clearSelectedChannelScheduleSnapshot, primeEpgChannels, request };
};

describe('prepared setup commit', () => {
    afterEach(() => jest.restoreAllMocks());

    it('saves the exact reviewed structure after source checks without writing scratch keys or freezing selection', async () => {
        jest.spyOn(ContentResolver.prototype, 'resolveSource').mockResolvedValue([{ durationMs: 1000 } as never]);
        const { committer, channelManager, request } = createHarness();
        const result = await committer.commitPreparedCandidate(request);
        expect(result.kind).toBe('committed');
        expect(channelManager.tryReplaceAllChannels).toHaveBeenCalledWith([channel], {
            expectedBase: request.expectedBase,
        });
        expect(result.kind === 'committed' ? result.summary.initialChannelNumber : null).toBeUndefined();
    });

    it('rejects a superseded Review after asynchronous resolution with zero body writes', async () => {
        let finish: ((items: never[]) => void) | undefined;
        jest.spyOn(ContentResolver.prototype, 'resolveSource').mockImplementation(() =>
            new Promise((resolve) => { finish = resolve as (items: never[]) => void; }));
        const { committer, channelManager, request } = createHarness();
        let current = true;
        const pending = committer.commitPreparedCandidate({ ...request, isCurrent: () => current });
        current = false;
        finish?.([{ durationMs: 1000 } as never]);
        const result = await pending;
        expect(result).toMatchObject({ kind: 'blocked', reason: 'stale' });
        expect(channelManager.tryReplaceAllChannels).not.toHaveBeenCalled();
    });

    it('does not save when a reviewed source has disappeared', async () => {
        jest.spyOn(ContentResolver.prototype, 'resolveSource').mockResolvedValue([]);
        const { committer, channelManager, request } = createHarness();
        const result = await committer.commitPreparedCandidate(request);
        expect(result).toMatchObject({ kind: 'blocked', reason: 'source' });
        expect(channelManager.tryReplaceAllChannels).not.toHaveBeenCalled();
    });

    it('blocks before writing when specials exclusion leaves fewer than the reviewed minimum', async () => {
        jest.spyOn(ContentResolver.prototype, 'resolveSource').mockResolvedValue([
            { type: 'episode', seasonNumber: 0, durationMs: 1000 },
            { type: 'episode', seasonNumber: 1, durationMs: 1000 },
        ] as never);
        const { committer, channelManager, request } = createHarness();
        const result = await committer.commitPreparedCandidate({ ...request, minItemsPerChannel: 2,
            channels: [{ ...channel, playbackMode: 'block', includeSpecials: false }] });
        expect(result).toMatchObject({ kind: 'blocked', reason: 'source',
            message: expect.stringContaining('1 playable items') });
        expect(channelManager.tryReplaceAllChannels).not.toHaveBeenCalled();
    });

    it.each([
        { label: 'content filter', override: { contentFilters: [{ field: 'year' as const,
            operator: 'eq' as const, value: 1999 }] }, items: [{ durationMs: 1000, year: 2000 }] },
        { label: 'runtime duration', override: { minEpisodeRunTimeMs: 2000 }, items: [{ durationMs: 1000 }] },
    ])('blocks a raw nonempty source emptied by the production $label policy', async ({ override, items }) => {
        jest.spyOn(ContentResolver.prototype, 'resolveSource').mockResolvedValue(items as never);
        const { committer, channelManager, request } = createHarness();
        const result = await committer.commitPreparedCandidate({ ...request,
            channels: [{ ...channel, ...override }] });
        expect(result).toMatchObject({ kind: 'blocked', reason: 'source' });
        expect(channelManager.tryReplaceAllChannels).not.toHaveBeenCalled();
    });

    it('reports pointer and Guide warnings after a committed body', async () => {
        jest.spyOn(ContentResolver.prototype, 'resolveSource').mockResolvedValue([{ durationMs: 1000 } as never]);
        const { committer, channelManager, refreshEpgSchedules, request } = createHarness();
        channelManager.tryReplaceAllChannels.mockResolvedValueOnce({ kind: 'committed', value: undefined,
            revision: 9, pointerWarning: true });
        refreshEpgSchedules.mockRejectedValueOnce(new Error('guide offline'));
        const result = await committer.commitPreparedCandidate({ ...request, protectedReplacementHandle: 'opaque' });
        expect(result.kind).toBe('committed');
        expect(result.kind === 'committed' ? result.summary.pointerWarning : undefined).toBe(true);
        expect(result.kind === 'committed' ? result.summary.guideRefresh : undefined).toEqual({ kind: 'failed', failure: { kind: 'thrown', stage: 'refresh_schedules' } });
        expect(channelManager.tryReplaceAllChannels).toHaveBeenCalledWith([channel], {
            expectedBase: request.expectedBase, protectedReplacementHandle: 'opaque',
        });
    });

    it.each(['invalid', 'conflict', 'storage-failure'] as const)(
        'keeps Guide untouched and reports %s without a false commit', async (kind) => {
            jest.spyOn(ContentResolver.prototype, 'resolveSource').mockResolvedValue([{ durationMs: 1000 } as never]);
            const { committer, channelManager, refreshEpgSchedules, request } = createHarness();
            channelManager.tryReplaceAllChannels.mockResolvedValueOnce({ kind, error: new Error(kind) });
            const result = await committer.commitPreparedCandidate(request);
            expect(result).toMatchObject({ kind: 'blocked', reason: kind });
            expect(result.kind).not.toBe('committed');
            expect(refreshEpgSchedules).not.toHaveBeenCalled();
        }
    );

    it('does not publish after caller cancellation during source validation', async () => {
        let finish: ((items: never[]) => void) | undefined;
        jest.spyOn(ContentResolver.prototype, 'resolveSource').mockImplementation(() =>
            new Promise((resolve) => { finish = resolve as (items: never[]) => void; }));
        const { committer, channelManager, request } = createHarness();
        const controller = new AbortController();
        const pending = committer.commitPreparedCandidate({ ...request, signal: controller.signal,
            isCurrent: (): boolean => !controller.signal.aborted });
        controller.abort();
        finish?.([{ durationMs: 1000 } as never]);
        await pending;
        expect(channelManager.tryReplaceAllChannels).not.toHaveBeenCalled();
    });

    it('refreshes Guide in order and treats degraded readiness separately from body persistence', async () => {
        const { committer, channelManager, ensureEpgInitialized, refreshEpgSchedules,
            clearSelectedChannelScheduleSnapshot, primeEpgChannels, request } = createHarness();
        refreshEpgSchedules.mockResolvedValueOnce({ ...guideReady, readiness: 'degraded' });
        const result = await committer.commitPreparedCandidate({ ...request, sourceCheckIds: [] });
        expect(result.kind).toBe('committed');
        expect((result.kind === 'committed' ? result.summary.guideRefresh : undefined)?.kind).toBe('completed');
        expect(result.kind === 'committed' ? result.summary.warnings : undefined).toEqual(expect.arrayContaining([expect.stringContaining('Guide refresh needs retry')]));
        expect(channelManager.tryReplaceAllChannels.mock.invocationCallOrder[0]).toBeLessThan(
            clearSelectedChannelScheduleSnapshot.mock.invocationCallOrder[0] ?? 0);
        expect(clearSelectedChannelScheduleSnapshot.mock.invocationCallOrder[0]).toBeLessThan(
            ensureEpgInitialized.mock.invocationCallOrder[0] ?? 0);
        expect(ensureEpgInitialized.mock.invocationCallOrder[0]).toBeLessThan(
            primeEpgChannels.mock.invocationCallOrder[0] ?? 0);
        expect(primeEpgChannels.mock.invocationCallOrder[0]).toBeLessThan(
            refreshEpgSchedules.mock.invocationCallOrder[0] ?? 0);
    });

    it('keeps a committed body when progress reporting throws and an abort interrupts Guide refresh', async () => {
        const { committer, channelManager, refreshEpgSchedules, request } = createHarness();
        const controller = new AbortController();
        refreshEpgSchedules.mockImplementationOnce(async () => {
            controller.abort();
            throw new DOMException('Aborted', 'AbortError');
        });
        const result = await committer.commitPreparedCandidate({ ...request, sourceCheckIds: [],
            signal: controller.signal,
            onProgress: (): never => { throw new Error('progress observer failed'); } });
        expect(channelManager.tryReplaceAllChannels).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({ kind: 'committed', summary: {
            guideRefresh: { kind: 'interrupted', interruption: { kind: 'aborted', stage: 'refresh_schedules' } },
        } });
        expect(result.kind === 'committed' ? result.summary.warnings : []).toEqual(
            expect.arrayContaining([expect.stringContaining('Progress callback failed')]));
    });

    it.each(['prepare', 'ensure_initialized', 'prime_channels', 'refresh_schedules'] as const)(
        'keeps a committed body when an abort-like rejection interrupts Guide at %s', async (stage) => {
            const harness = createHarness();
            const abort = (): never => { throw new DOMException('Aborted', 'AbortError'); };
            if (stage === 'prepare') harness.clearSelectedChannelScheduleSnapshot.mockImplementationOnce(abort);
            if (stage === 'ensure_initialized') harness.ensureEpgInitialized.mockRejectedValueOnce(
                new DOMException('Aborted', 'AbortError'));
            if (stage === 'prime_channels') harness.primeEpgChannels.mockImplementationOnce(abort);
            if (stage === 'refresh_schedules') harness.refreshEpgSchedules.mockRejectedValueOnce(
                new DOMException('Aborted', 'AbortError'));

            const result = await harness.committer.commitPreparedCandidate({ ...harness.request, sourceCheckIds: [],
                signal: new AbortController().signal });
            expect(harness.channelManager.tryReplaceAllChannels).toHaveBeenCalledTimes(1);
            expect(result).toMatchObject({ kind: 'committed', summary: {
                guideRefresh: { kind: 'interrupted', interruption: { kind: 'aborted', stage } },
            } });
        }
    );

    it.each([
        { readiness: 'superseded' as const, warns: false },
        { readiness: 'skipped' as const, warns: true },
    ])('reports $readiness Guide readiness truthfully after a committed body', async ({ readiness, warns }) => {
        const { committer, refreshEpgSchedules, request } = createHarness();
        refreshEpgSchedules.mockResolvedValueOnce({ ...guideReady, readiness });
        const result = await committer.commitPreparedCandidate({ ...request, sourceCheckIds: [] });
        expect(result).toMatchObject({ kind: 'committed', summary: {
            guideRefresh: { kind: 'completed', result: { readiness } },
        } });
        expect(result.kind === 'committed' && Boolean(result.summary.warnings?.length)).toBe(warns);
    });

    it.each([
        ['prepare', 'clear'],
        ['ensure_initialized', 'ensure'],
        ['prime_channels', 'prime'],
        ['refresh_schedules', 'refresh'],
    ] as const)('reports a postcommit %s failure at its actual stage', async (stage, failedHook) => {
        const harness = createHarness();
        const fail = (): never => { throw new Error('guide failure'); };
        if (failedHook === 'clear') harness.clearSelectedChannelScheduleSnapshot.mockImplementationOnce(fail);
        if (failedHook === 'ensure') harness.ensureEpgInitialized.mockRejectedValueOnce(new Error('guide failure'));
        if (failedHook === 'prime') harness.primeEpgChannels.mockImplementationOnce(fail);
        if (failedHook === 'refresh') harness.refreshEpgSchedules.mockRejectedValueOnce(new Error('guide failure'));
        const result = await harness.committer.commitPreparedCandidate({ ...harness.request, sourceCheckIds: [] });
        expect(result.kind).toBe('committed');
        expect(result.kind === 'committed' ? result.summary.guideRefresh : undefined).toEqual({ kind: 'failed', failure: { kind: 'thrown', stage } });
    });
});
