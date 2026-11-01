/** @jest-environment jsdom */
import { flushPromisesAndMacrotask } from '../../../../__tests__/helpers';
import { createBaseChannel } from '../../../scheduler/channel-manager/__tests__/channel-manager-test-helpers';
import type { ChannelConfig } from '../../../scheduler/channel-manager/contracts/types';
import type { PlexMediaItem, PlexLibrarySection, PlexSeason, PlexCollection } from '../../../plex/library/types';
import type { KeyEvent } from '../../../navigation/contracts/interfaces';
import { AirCheckPanel } from '../../channel-air-check/AirCheckPanel';
import type { StudioAirCheckPort, StudioAirCheckRequest, StudioVerificationStatus, ChannelStudioPorts } from '../../../../core/channel-studio/ChannelStudioContracts';
import { ChannelStudioScreen } from '../ChannelStudioScreen';

const saved = createBaseChannel({ id: 'saved', number: 8, name: 'Eight', contentSource: {
    type: 'manual', items: [{ ratingKey: 'm1', title: 'First', durationMs: 60_000 }],
} });

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
    let resolver: (value: T) => void = () => undefined;
    const promise = new Promise<T>(resolve => { resolver = resolve; });
    return { promise, resolve: resolver };
}

function harness(libraries: Promise<PlexLibrarySection[]> = Promise.resolve([]), airCheck?: StudioAirCheckPort, channel: ChannelConfig = saved): { screen: ChannelStudioScreen; container: HTMLElement;
    back(): void; close: jest.Mock; setFocus: jest.Mock; getLibraries: jest.Mock; getLibraryItems: jest.Mock; getShowSeasons: jest.Mock; getCollections: jest.Mock; tryUpdate: jest.Mock } {
    const container = document.createElement('div'); document.body.append(container);
    let handler: ((event: KeyEvent) => void) | null = null;
    let modalCloseHandler: ((event: { modalId: string }) => void) | null = null;
    let modalId: string | null = null;
    const close = jest.fn(); const setFocus = jest.fn(); const getLibraries = jest.fn(() => libraries); const getLibraryItems = jest.fn(); const getShowSeasons = jest.fn(); const getCollections = jest.fn();
    const tryUpdate = jest.fn();
    const ports: ChannelStudioPorts = {
        manager: {
            getStructuralBase: () => ({ generation: 1, revision: 2 }),
            getLastLoadOutcome: () => ({ kind: 'readable', generation: 1, revision: 2, channelCount: 1 }),
            getChannel: () => channel, getAllChannels: () => [channel],
            tryCreateChannel: jest.fn(), tryUpdateChannel: tryUpdate,
        },
        plexLibrary: { getLibraries, getShows: jest.fn(), getShowEpisodes: jest.fn(), getShowSeasons, getCollections,
            getPlaylists: jest.fn(), search: jest.fn(), getLibraryItems },
        navigation: {
            registerFocusable: jest.fn(), unregisterFocusable: jest.fn(), setFocus,
            openModal: id => { modalId = id; },
            closeModal: id => { if (modalId && (!id || id === modalId)) { const closing = modalId; modalId = null; modalCloseHandler?.({ modalId: closing }); } },
            isModalOpen: id => id ? modalId === id : modalId !== null,
            on: (event, callback) => {
                if (event === 'keyPress') handler = callback as (event: KeyEvent) => void;
                if (event === 'modalClose') modalCloseHandler = callback as (event: { modalId: string }) => void;
                return { dispose: jest.fn() };
            },
            off: event => { if (event === 'keyPress') handler = null; if (event === 'modalClose') modalCloseHandler = null; },
        }, airCheck: airCheck ?? { verify: jest.fn(), render: jest.fn() }, close, refreshAfterSave: jest.fn(), tuneNow: jest.fn(), now: () => 100,
    };
    const screen = new ChannelStudioScreen(container, ports);
    return { screen, container, close, setFocus, getLibraries, getLibraryItems, getShowSeasons, getCollections, tryUpdate,
        back: (): void => {
            if (modalId) { ports.navigation.closeModal(modalId); return; }
            const event = { button: 'back', handled: false, originalEvent: { preventDefault: jest.fn() } } as unknown as KeyEvent; handler?.(event);
        },
    };
}

const click = (container: HTMLElement, id: string): void => {
    const button = container.querySelector<HTMLButtonElement>(`#${id}`);
    if (!button) throw new Error(`Missing ${id}`);
    button.click();
};
const edit = (container: HTMLElement, id: string, value: string): void => {
    click(container, id);
    const input = container.querySelector<HTMLInputElement>(`#${id}-edit`);
    if (!input) throw new Error(`Missing editor ${id}`);
    input.value = value; input.dispatchEvent(new Event('input'));
    container.querySelector<HTMLInputElement>(`#${id}-edit`)?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
};

it('discards only the pending recursive source on Back and keeps the saved draft source', () => {
    const app = harness();
    app.screen.show({ kind: 'inspect', channelId: 'saved', expectedBase: { generation: 1, revision: 2 } });
    click(app.container, 'studio-source-edit');
    click(app.container, 'studio-tab-mixed');
    click(app.container, 'studio-mix-add');
    expect(app.container.textContent).toContain('Eight › Mixed source › Part 1');
    app.back();
    expect(app.setFocus).toHaveBeenLastCalledWith('studio-mix-add');
    expect(app.container.textContent).toContain('Add child');
    expect(app.screen.session.draft?.channel.contentSource).toEqual(saved.contentSource);
    app.back();
    expect(app.screen.session.draft?.activeSource).toBeNull();
    expect(app.setFocus).toHaveBeenLastCalledWith('studio-source-edit');
    expect(app.close).not.toHaveBeenCalled();
    app.screen.hide(); app.container.remove();
});

it('keeps generated programming inspectable and duplicates it as a fresh custom draft', () => {
    const generated: ChannelConfig = { ...saved, isAutoGenerated: true, buildStrategy: 'collections', sourceLibraryId: 'lib1' };
    const app = harness(Promise.resolve([]), undefined, generated);
    app.screen.show({ kind: 'inspect', channelId: 'saved', expectedBase: { generation: 1, revision: 2 } });
    expect(app.container.textContent).toContain('Current source:');
    expect(app.container.querySelector<HTMLInputElement>('#studio-name')?.disabled).toBe(true);
    click(app.container, 'studio-duplicate');
    expect(app.screen.session.draft?.kind).toBe('duplicate');
    expect(app.screen.session.draft?.channel.isAutoGenerated).toBeUndefined();
    expect(app.screen.session.draft?.channel.buildStrategy).toBeUndefined();
    expect(app.screen.session.draft?.channel.number).toBe(1);
    expect(app.container.querySelector<HTMLButtonElement>('#studio-save')?.disabled).toBe(true);
    app.screen.hide(); app.container.remove();
});

it('keeps a dirty draft when Back opens the safe default leave dialog', () => {
    const app = harness();
    app.screen.show({ kind: 'inspect', channelId: 'saved', expectedBase: { generation: 1, revision: 2 } });
    edit(app.container, 'studio-name', 'My Eight');
    app.back();
    expect(app.container.textContent).toContain('Leave this draft?');
    expect(app.screen.session.draft?.channel.name).toBe('My Eight');
    expect(app.close).not.toHaveBeenCalled();
    click(app.container, 'studio-stay');
    expect(app.container.textContent).not.toContain('Leave this draft?');
    app.screen.hide(); app.container.remove();
});

it('lets an existing channel restore source order and clear saved runtime bounds', () => {
    const channel: ChannelConfig = { ...saved, sortOrder: 'year_desc', minEpisodeRunTimeMs: 60_000, maxEpisodeRunTimeMs: 120_000 };
    const app = harness(Promise.resolve([]), undefined, channel);
    app.screen.show({ kind: 'inspect', channelId: 'saved', expectedBase: { generation: 1, revision: 2 } });
    click(app.container, 'studio-sort');
    expect(app.container.querySelector<HTMLButtonElement>('#studio-sort-option-0')?.disabled).toBe(false);
    click(app.container, 'studio-sort-option-0');
    for (const id of ['studio-min-duration', 'studio-max-duration']) {
        edit(app.container, id, '');
    }
    expect(app.screen.session.draft?.toUpdateInput().clearFields).toEqual(['sortOrder', 'minEpisodeRunTimeMs', 'maxEpisodeRunTimeMs']);
    app.screen.hide(); app.container.remove();
});

it('browses full media and preserves repeated hand-picked occurrences on Apply source', async () => {
    const library: PlexLibrarySection = { id: 'lib1', uuid: 'uuid', title: 'Movies', type: 'movie', agent: '', scanner: '',
        contentCount: 1, lastScannedAt: new Date(), art: null, thumb: null };
    const media: PlexMediaItem = { ratingKey: 'm1', key: '/library/metadata/m1', type: 'movie', title: 'First',
        sortTitle: 'First', summary: '', year: 2020, durationMs: 60_000, addedAt: new Date(), updatedAt: new Date(),
        thumb: null, art: null, media: [] };
    const app = harness(Promise.resolve([library]));
    app.getLibraryItems.mockResolvedValue([media]);
    app.screen.show({ kind: 'inspect', channelId: 'saved', expectedBase: { generation: 1, revision: 2 } });
    click(app.container, 'studio-source-edit'); click(app.container, 'studio-manual-browse');
    await Promise.resolve(); await Promise.resolve();
    click(app.container, 'studio-picker-choice-0');
    await Promise.resolve(); await Promise.resolve();
    click(app.container, 'studio-picker-choice-0'); click(app.container, 'studio-picker-choice-0');
    click(app.container, 'studio-picker-cancel');
    const pendingAfterCancel = app.screen.session.draft?.activeSource?.source;
    if (pendingAfterCancel?.type !== 'manual') throw new Error('expected pending manual source');
    expect(pendingAfterCancel.items).toHaveLength(1);
    click(app.container, 'studio-manual-browse');
    await Promise.resolve(); await Promise.resolve();
    click(app.container, 'studio-picker-choice-0');
    await Promise.resolve(); await Promise.resolve();
    click(app.container, 'studio-picker-choice-0'); click(app.container, 'studio-picker-choice-0');
    click(app.container, 'studio-picker-apply'); click(app.container, 'studio-apply-source');
    const source = app.screen.session.draft?.channel.contentSource;
    expect(source?.type).toBe('manual');
    if (source?.type === 'manual') expect(source.items.map(item => item.ratingKey)).toEqual(['m1', 'm1', 'm1']);
    app.screen.hide(); app.container.remove();
});

it('stages season-zero choice and discards it on picker Cancel before explicit Apply', async () => {
    const show: ChannelConfig = { ...saved, contentSource: { type: 'show', showKey: 's1', showName: 'Series', seasonFilter: [1] } };
    const seasons: PlexSeason[] = [
        { ratingKey: 'season-0', key: '/season/0', title: 'Specials', index: 0, leafCount: 2, viewedLeafCount: 0, thumb: null },
        { ratingKey: 'season-1', key: '/season/1', title: 'Season 1', index: 1, leafCount: 8, viewedLeafCount: 0, thumb: null },
    ];
    const app = harness(Promise.resolve([]), undefined, show); app.getShowSeasons.mockResolvedValue(seasons);
    app.screen.show({ kind: 'inspect', channelId: 'saved', expectedBase: { generation: 1, revision: 2 } });
    click(app.container, 'studio-source-edit'); click(app.container, 'studio-pick-season');
    await Promise.resolve(); await Promise.resolve();
    click(app.container, 'studio-picker-choice-0'); click(app.container, 'studio-picker-cancel');
    const canceled = app.screen.session.draft?.activeSource?.source;
    if (canceled?.type !== 'show') throw new Error('expected show');
    expect(canceled.seasonFilter).toEqual([1]);
    click(app.container, 'studio-pick-season'); await Promise.resolve(); await Promise.resolve();
    click(app.container, 'studio-picker-choice-0'); click(app.container, 'studio-picker-apply');
    click(app.container, 'studio-apply-source');
    expect(app.screen.session.draft?.channel.contentSource).toEqual({ type: 'show', showKey: 's1', showName: 'Series', seasonFilter: [0, 1] });
    app.screen.hide(); app.container.remove();
});

it('changes Collection type and library only with a newly chosen collection, then applies nested source', async () => {
    const libraries: PlexLibrarySection[] = [
        { id: 'movies', uuid: 'm', title: 'Movie Library', type: 'movie', agent: '', scanner: '',
            contentCount: 1, lastScannedAt: new Date(), art: null, thumb: null },
        { id: 'shows', uuid: 's', title: 'TV Library', type: 'show', agent: '', scanner: '',
            contentCount: 1, lastScannedAt: new Date(), art: null, thumb: null },
    ];
    const prior = { type: 'collection' as const, collectionKey: 'old', collectionName: 'Old picks',
        libraryId: 'movies', libraryType: 'movie' as const, libraryName: 'Movie Library' };
    const channel: ChannelConfig = { ...saved, contentSource: { type: 'mixed', mixMode: 'sequential', sources: [prior] } };
    const collection: PlexCollection = { ratingKey: 'new', key: '/library/collections/new', title: 'TV picks', thumb: null, childCount: 4 };
    const app = harness(Promise.resolve(libraries), undefined, channel);
    app.getCollections.mockImplementation((id: string) => Promise.resolve(id === 'shows' ? [collection] : []));
    app.screen.show({ kind: 'inspect', channelId: 'saved', expectedBase: { generation: 1, revision: 2 } });
    click(app.container, 'studio-source-edit'); click(app.container, 'studio-mix-edit-0');
    expect(app.container.textContent).toContain('Collection type: Movies · Library scope: Movie Library');
    click(app.container, 'studio-pick-collection'); await Promise.resolve(); await Promise.resolve();
    click(app.container, 'studio-picker-collection-type'); click(app.container, 'studio-picker-collection-type-option-2');
    await Promise.resolve(); await Promise.resolve();
    expect(app.container.textContent).toContain('TV Library');
    expect(app.container.textContent).not.toContain('Movie Library · movie library');
    click(app.container, 'studio-picker-cancel');
    expect(app.screen.session.draft?.activeSource?.source).toEqual(prior);
    click(app.container, 'studio-pick-collection'); await Promise.resolve(); await Promise.resolve();
    click(app.container, 'studio-picker-collection-type'); click(app.container, 'studio-picker-collection-type-option-2');
    await Promise.resolve(); await Promise.resolve();
    click(app.container, 'studio-picker-choice-0'); await Promise.resolve(); await Promise.resolve();
    expect(app.getCollections).toHaveBeenLastCalledWith('shows', expect.objectContaining({ requestIntent: 'preview' }));
    expect(app.screen.session.draft?.activeSource?.source).toEqual(prior);
    click(app.container, 'studio-picker-choice-0');
    expect(app.screen.session.draft?.activeSource?.source).toEqual({ type: 'collection', collectionKey: 'new',
        collectionName: 'TV picks', libraryId: 'shows', libraryType: 'show', libraryName: 'TV Library' });
    click(app.container, 'studio-apply-source'); click(app.container, 'studio-apply-source');
    expect(app.screen.session.draft?.channel.contentSource).toEqual({ type: 'mixed', mixMode: 'sequential', sources: [{
        type: 'collection', collectionKey: 'new', collectionName: 'TV picks', libraryId: 'shows',
        libraryType: 'show', libraryName: 'TV Library',
    }] });
    app.screen.hide(); app.container.remove();
});

it('composes the real panel Run → loading → verified Save gate and canceled retry', async () => {
    const first = deferred<StudioVerificationStatus>();
    const second = deferred<StudioVerificationStatus>();
    let pendingRequest: StudioAirCheckRequest | null = null;
    const verify = jest.fn((request: StudioAirCheckRequest): Promise<StudioVerificationStatus> => {
        pendingRequest = request;
        return verify.mock.calls.length === 1 ? first.promise : second.promise;
    });
    const panel = new AirCheckPanel({ verify }, { getImageUrl: (): null => null });
    const app = harness(Promise.resolve([]), panel);
    app.screen.show({ kind: 'inspect', channelId: 'saved', expectedBase: { generation: 1, revision: 2 } });
    expect(app.container.querySelectorAll('#air-check-run')).toHaveLength(1);
    click(app.container, 'air-check-run');
    expect(app.container.querySelector('#air-check-cancel')).not.toBeNull();
    expect(app.container.querySelector<HTMLButtonElement>('#studio-save')?.disabled).toBe(true);
    const request = pendingRequest;
    if (!request) throw new Error('missing preview request');
    const item = { ratingKey: 'm1', type: 'movie' as const, title: 'First', fullTitle: 'First', durationMs: 60_000,
        thumb: null, year: 2020, scheduledIndex: 0 };
    const program = { item, scheduledStartTime: 0, scheduledEndTime: 60_000, elapsedMs: 100, remainingMs: 59_900,
        scheduleIndex: 0, loopNumber: 0, isCurrent: true };
    first.resolve({ kind: 'verified', request, checkedAt: 100, items: [item], programs: [program], coverageEnd: 60_000 });
    await first.promise; await Promise.resolve(); await Promise.resolve();
    expect(app.container.querySelector<HTMLButtonElement>('#studio-save')?.disabled).toBe(false);
    edit(app.container, 'studio-name', 'Changed');
    expect(app.container.querySelector<HTMLButtonElement>('#studio-save')?.disabled).toBe(true);
    click(app.container, 'air-check-run');
    expect(app.container.querySelector('#air-check-cancel')).not.toBeNull();
    click(app.container, 'air-check-cancel');
    expect(app.container.querySelector<HTMLButtonElement>('#studio-save')?.disabled).toBe(true);
    if (pendingRequest) second.resolve({ kind: 'verified', request: pendingRequest, checkedAt: 101,
        items: [item], programs: [program], coverageEnd: 60_000 });
    await second.promise; await Promise.resolve();
    expect(app.container.querySelector<HTMLButtonElement>('#studio-save')?.disabled).toBe(true);
    app.screen.hide(); app.container.remove();
});

it('saves again after a filter-only edit in the same Studio session', async () => {
    const airCheck: StudioAirCheckPort = {
        verify: async request => ({ kind: 'verified', request, checkedAt: 100, items: [], programs: [],
            coverageEnd: request.asOf + request.horizonMs }),
        render: (root, _status, _request, options) => {
            const run = document.createElement('button'); run.id = 'air-check-run';
            run.addEventListener('click', options.onVerify); root.append(run);
        },
    };
    const app = harness(Promise.resolve([]), airCheck);
    app.tryUpdate.mockImplementation(async (_id: string, updates: Partial<ChannelConfig>) => ({
        kind: 'committed', value: { ...saved, ...updates }, revision: 3, pointerWarning: false,
    }));
    app.screen.show({ kind: 'inspect', channelId: 'saved', expectedBase: { generation: 1, revision: 2 } });
    click(app.container, 'air-check-run'); await Promise.resolve(); await Promise.resolve();
    click(app.container, 'studio-save'); await flushPromisesAndMacrotask();
    expect(app.tryUpdate).toHaveBeenCalledTimes(1);
    expect(app.screen.session.saving).toBe(false);
    click(app.container, 'studio-filters'); click(app.container, 'studio-filter-add'); click(app.container, 'studio-filter-apply');
    expect(app.screen.session.draft?.channel.contentFilters).toHaveLength(1);
    click(app.container, 'air-check-run'); await Promise.resolve(); await Promise.resolve();
    expect(app.container.querySelector<HTMLButtonElement>('#studio-save')?.disabled).toBe(false);
    click(app.container, 'studio-save'); await flushPromisesAndMacrotask();
    expect(app.tryUpdate).toHaveBeenCalledTimes(2);
    app.screen.hide(); app.container.remove();
});

it('does not publish a late picker result after hide', async () => {
    const pending = deferred<Awaited<ReturnType<ChannelStudioPorts['plexLibrary']['getLibraries']>>>();
    const app = harness(pending.promise);
    app.screen.show({ kind: 'inspect', channelId: 'saved', expectedBase: { generation: 1, revision: 2 } });
    click(app.container, 'studio-source-edit');
    click(app.container, 'studio-tab-library');
    click(app.container, 'studio-pick-library');
    app.screen.hide();
    pending.resolve([]); await pending.promise; await Promise.resolve();
    expect(app.container.childElementCount).toBe(0);
    app.container.remove();
});
