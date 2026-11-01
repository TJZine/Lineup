import { ChannelAuthoringService } from '../../../modules/scheduler/channel-manager/authoring/ChannelAuthoringService';
import { createBaseChannel } from '../../../modules/scheduler/channel-manager/__tests__/channel-manager-test-helpers';
import type { ChannelLoadOutcome, ChannelStructuralBase } from '../../../modules/scheduler/channel-manager/contracts/ChannelDurability';
import type { ChannelConfig } from '../../../modules/scheduler/channel-manager/contracts/types';
import type { ChannelStudioPorts, StudioAirCheckRequest, StudioVerificationStatus } from '../ChannelStudioContracts';
import { ChannelStudioSession } from '../ChannelStudioSession';

const initial = createBaseChannel({ id: 'saved', number: 8, playbackMode: 'block', blockSize: 2, contentSource: {
    type: 'show', showKey: 's1', showName: 'Show', seasonFilter: [1],
} });
let base = { generation: 1, revision: 2 };
let channels: ChannelConfig[];
let verify: jest.Mock<Promise<StudioVerificationStatus>, [StudioAirCheckRequest, AbortSignal]>;
let create: jest.Mock;
let update: jest.Mock;
let refresh: jest.Mock;
let tune: jest.Mock;
let ports: ChannelStudioPorts;
const verified = (request: StudioAirCheckRequest): StudioVerificationStatus => ({
    kind: 'verified', request, checkedAt: 100, items: [], programs: [], coverageEnd: request.asOf + request.horizonMs,
});

beforeEach(() => {
    base = { generation: 1, revision: 2 }; channels = [initial];
    verify = jest.fn(async (request: StudioAirCheckRequest, _signal: AbortSignal) => verified(request));
    create = jest.fn(async () => ({ kind: 'committed', value: initial, revision: ++base.revision, pointerWarning: false }));
    update = jest.fn(async () => ({ kind: 'committed', value: initial, revision: ++base.revision, pointerWarning: false }));
    refresh = jest.fn(async () => undefined); tune = jest.fn(async () => undefined);
    ports = {
        manager: {
            getStructuralBase: (): ChannelStructuralBase => ({ ...base }), getLastLoadOutcome: (): ChannelLoadOutcome => ({ kind: 'readable', generation: 1, revision: base.revision, channelCount: channels.length }),
            getChannel: (id: string): ChannelConfig | null => channels.find(channel => channel.id === id) ?? null, getAllChannels: (): ChannelConfig[] => channels,
            tryCreateChannel: create, tryUpdateChannel: update,
        }, plexLibrary: {} as ChannelStudioPorts['plexLibrary'], navigation: {} as ChannelStudioPorts['navigation'],
        airCheck: { verify, render: jest.fn() }, close: jest.fn(), refreshAfterSave: refresh, tuneNow: tune, now: (): number => 100,
    };
});

describe('ChannelStudioSession', () => {
    it('requires exact current Air Check, rechecks before Save, and never tunes on Save', async () => {
        const session = new ChannelStudioSession(ports);
        session.open({ kind: 'inspect', channelId: 'saved', expectedBase: base });
        session.draft?.change({ name: 'Renamed', includeSpecials: false });
        expect((await session.save()).kind).toBe('unverified');
        await session.verify(); expect(session.canSave).toBe(true);
        const result = await session.save();
        expect(result.kind).toBe('saved'); expect(verify).toHaveBeenCalledTimes(2);
        expect(update).toHaveBeenCalledWith('saved', expect.objectContaining({ name: 'Renamed', includeSpecials: false }), { generation: 1, revision: 2 });
        expect(tune).not.toHaveBeenCalled(); expect(refresh).toHaveBeenCalledTimes(1);
        await session.tuneNow(); expect(tune).toHaveBeenCalledWith('saved');
    });

    it('keeps the draft on conflict and offers an explicit latest-base replacement', async () => {
        const session = new ChannelStudioSession(ports);
        session.open({ kind: 'inspect', channelId: 'saved', expectedBase: base });
        session.draft?.change({ name: 'Mine' }); await session.verify();
        update.mockResolvedValueOnce({ kind: 'conflict', error: new Error('Changed elsewhere') });
        expect((await session.save()).kind).toBe('conflict');
        expect(session.draft?.channel.name).toBe('Mine'); expect(session.conflict).toBe(true);
        base.revision++;
        channels = [{ ...initial, name: 'Theirs' }];
        session.replaceSaved();
        expect(session.draft?.channel.name).toBe('Mine');
        expect(session.draft?.original?.name).toBe('Theirs');
        expect(session.canSave).toBe(false);
    });

    it('rejects late preview after draft change and preserves verified programming during horizon extension', async () => {
        let resolvePending: ((value: StudioVerificationStatus) => void) | null = null;
        verify.mockImplementationOnce(() => new Promise(resolve => { resolvePending = resolve; }));
        const session = new ChannelStudioSession(ports);
        session.open({ kind: 'inspect', channelId: 'saved', expectedBase: base });
        const first = session.verify();
        session.draft?.change({ shuffleSeed: 99 }); session.markDraftChanged();
        const stale = resolvePending as unknown as (value: StudioVerificationStatus) => void;
        stale({ kind: 'canceled' });
        expect((await first).kind).toBe('stale');
        await session.verify(); expect(session.canSave).toBe(true);
        let finishExtension: ((value: StudioVerificationStatus) => void) | null = null;
        verify.mockImplementationOnce(() => new Promise(resolve => { finishExtension = resolve; }));
        const extension = session.extendHorizon(12 * 60 * 60_000);
        expect(session.canSave).toBe(true);
        const latestRequest = verify.mock.calls.at(-1)?.[0];
        if (!latestRequest) throw new Error('missing request');
        const complete = finishExtension as unknown as (value: StudioVerificationStatus) => void;
        complete(verified(latestRequest));
        await extension;
        expect(session.canSave).toBe(true);
        expect(session.lastRequest?.asOf).toBe(100);
        expect(session.lastRequest?.horizonMs).toBe(12 * 60 * 60_000);
    });
    it('does not let a late verified extension revive Save after final Air Check finds partial programming', async () => {
        const session = new ChannelStudioSession(ports);
        session.open({ kind: 'inspect', channelId: 'saved', expectedBase: base });
        await session.verify();
        let finishExtension: ((value: StudioVerificationStatus) => void) | null = null;
        verify.mockImplementationOnce(() => new Promise(resolve => { finishExtension = resolve; }));
        verify.mockImplementationOnce(async () => ({ kind: 'partial', reason: 'Collection changed', checkedAt: 102 }));
        const extension = session.extendHorizon(12 * 60 * 60_000);
        expect(session.canSave).toBe(true);
        const request = verify.mock.calls.at(-1)?.[0];
        expect((await session.save()).kind).toBe('unverified');
        expect(session.verification.kind).toBe('partial');
        expect(session.canSave).toBe(false);
        const extensionRequest = request ?? verify.mock.calls.at(-2)?.[0];
        if (!extensionRequest) throw new Error('missing extension request');
        const complete = finishExtension as unknown as (value: StudioVerificationStatus) => void;
        complete(verified(extensionRequest));
        expect((await extension).kind).toBe('stale');
        expect(session.verification.kind).toBe('partial');
        expect(session.canSave).toBe(false);
        expect(update).not.toHaveBeenCalled();
    });
    it('keeps the draft on storage failure and rejects duplicate Save during a pending commit', async () => {
        const session = new ChannelStudioSession(ports);
        session.open({ kind: 'inspect', channelId: 'saved', expectedBase: base });
        session.draft?.change({ name: 'Still mine' }); await session.verify();
        let finish: ((value: { kind: 'storage-failure'; error: Error }) => void) | null = null;
        update.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const first = session.save();
        expect(session.saving).toBe(true);
        expect((await session.save()).kind).toBe('busy');
        const complete = finish as unknown as (value: { kind: 'storage-failure'; error: Error }) => void;
        complete({ kind: 'storage-failure', error: new Error('Quota exceeded') });
        expect((await first).kind).toBe('storage-failure');
        expect(session.draft?.channel.name).toBe('Still mine');
        expect(session.draft?.dirty).toBe(true);
        expect(tune).not.toHaveBeenCalled();
    });
    it('keeps a create draft and its chosen number across an explicit lineup refresh', async () => {
        channels = [];
        const session = new ChannelStudioSession(ports);
        session.open({ kind: 'create' });
        session.draft?.change({ name: 'New channel', contentSource: { type: 'manual', items: [
            { ratingKey: 'm1', title: 'Movie', durationMs: 60_000 },
        ] } });
        await session.verify(); expect(session.canSave).toBe(true);
        base.revision++;
        expect(session.canSave).toBe(false);
        expect(session.isBaseStale).toBe(true);
        session.refreshBase();
        expect(session.draft?.channel.name).toBe('New channel');
        expect(session.draft?.channel.number).toBe(1);
        expect(session.draft?.dirty).toBe(true);
        await session.verify(); expect(session.canSave).toBe(true);
    });
    it('does not let a late committed Save replace a newly opened draft', async () => {
        const session = new ChannelStudioSession(ports);
        session.open({ kind: 'inspect', channelId: 'saved', expectedBase: base });
        session.draft?.change({ name: 'Old edit' }); await session.verify();
        let finish: ((value: { kind: 'committed'; value: ChannelConfig; revision: number; pointerWarning: boolean }) => void) | null = null;
        update.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const first = session.save();
        await Promise.resolve();
        session.close(); session.open({ kind: 'create' });
        const current = session.draft;
        const complete = finish as unknown as (value: { kind: 'committed'; value: ChannelConfig; revision: number; pointerWarning: boolean }) => void;
        complete({ kind: 'committed', value: initial, revision: 3, pointerWarning: false });
        expect((await first).kind).toBe('saved');
        expect(session.draft).toBe(current);
        expect(session.draft?.kind).toBe('create');
        expect(session.notice).toBeNull();
    });
    it('aborts the final Air Check when Studio closes before a durable write', async () => {
        const session = new ChannelStudioSession(ports);
        session.open({ kind: 'inspect', channelId: 'saved', expectedBase: base });
        await session.verify();
        let finish: ((value: StudioVerificationStatus) => void) | null = null;
        let recheckSignal: AbortSignal | null = null;
        verify.mockImplementationOnce((_request, signal) => {
            recheckSignal = signal;
            return new Promise(resolve => { finish = resolve; });
        });
        const pending = session.save();
        expect(session.saving).toBe(true);
        session.close();
        expect((recheckSignal as AbortSignal | null)?.aborted).toBe(true);
        const complete = finish as unknown as (value: StudioVerificationStatus) => void;
        complete(verified(verify.mock.calls.at(-1)![0]));
        expect((await pending).kind).toBe('unverified');
        expect(update).not.toHaveBeenCalled();
        expect(session.draft).toBeNull();
    });
    it('keeps the draft and reports a retryable result when final Air Check throws', async () => {
        const session = new ChannelStudioSession(ports);
        session.open({ kind: 'inspect', channelId: 'saved', expectedBase: base });
        await session.verify();
        verify.mockRejectedValueOnce(new Error('Sensitive Plex URL'));
        expect((await session.save()).kind).toBe('unverified');
        expect(session.notice?.text).toBe('Air Check failed during Save. Retry.');
        expect(update).not.toHaveBeenCalled();
    });
    it('saves explicit sort and duration clears, then reopens the exact authored result', async () => {
        channels = [{ ...initial, sortOrder: 'year_desc', minEpisodeRunTimeMs: 60_000,
            maxEpisodeRunTimeMs: 120_000 }];
        const authoring = new ChannelAuthoringService({ generateId: (): string => 'unused', now: (): number => 110 });
        update.mockImplementation(async (_id: string, input: Parameters<typeof authoring.updateChannel>[1]) => {
            const saved = authoring.updateChannel(channels[0]!, input, []);
            channels = [saved];
            return { kind: 'committed', value: saved, revision: ++base.revision, pointerWarning: false };
        });
        const session = new ChannelStudioSession(ports);
        session.open({ kind: 'inspect', channelId: 'saved', expectedBase: base });
        session.draft?.clearSortOrder(); session.draft?.clearRuntimeBound('minEpisodeRunTimeMs');
        session.draft?.clearRuntimeBound('maxEpisodeRunTimeMs'); session.markDraftChanged();
        await session.verify(); expect(session.canSave).toBe(true);
        expect((await session.save()).kind).toBe('saved');
        expect(update).toHaveBeenCalledWith('saved', expect.objectContaining({
            clearFields: ['sortOrder', 'minEpisodeRunTimeMs', 'maxEpisodeRunTimeMs'],
        }), { generation: 1, revision: 2 });
        const reopened = new ChannelStudioSession(ports);
        reopened.open({ kind: 'inspect', channelId: 'saved', expectedBase: base });
        expect(reopened.draft?.channel.sortOrder).toBeUndefined();
        expect(reopened.draft?.channel.minEpisodeRunTimeMs).toBeUndefined();
        expect(reopened.draft?.channel.maxEpisodeRunTimeMs).toBeUndefined();
    });
});
