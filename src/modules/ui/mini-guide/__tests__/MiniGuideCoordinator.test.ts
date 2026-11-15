/**
 * @jest-environment jsdom
 */
import { MiniGuideCoordinator } from '../MiniGuideCoordinator';
import { MiniGuideOverlay } from '../MiniGuideOverlay';
import { MINI_GUIDE_CONTAINER_ID } from '../constants';
import type { IMiniGuideOverlay } from '../interfaces';
import type { IChannelManager, ChannelConfig } from '../../../scheduler/channel-manager';
import type { IChannelScheduler, ScheduledProgram, ScheduleConfig } from '../../../scheduler/scheduler';
import type { ResolvedChannelContent, ResolvedContentItem } from '../../../scheduler/channel-manager/contracts/types';
import { createDeferred, type Deferred } from '../../../../__tests__/helpers';
import { shouldApplyMiniGuideRowUpdate } from '../MiniGuideCoordinatorPolicies';

const AUTO_HIDE_MS = 1000;

const makeItem = (title: string, durationMs: number, index: number): ResolvedContentItem => ({
    ratingKey: `rk-${title}`,
    type: 'movie',
    title,
    fullTitle: title,
    durationMs,
    thumb: null,
    year: 2024,
    scheduledIndex: index,
});

const makeEpisodeItem = (
    showTitle: string,
    episodeTitle: string,
    seasonNumber: number | undefined,
    episodeNumber: number | undefined,
    index: number
): ResolvedContentItem => ({
    ratingKey: `rk-${showTitle}-${episodeTitle}`,
    type: 'episode',
    title: episodeTitle,
    fullTitle: `${showTitle} - ${episodeTitle}`,
    showTitle,
    durationMs: 60_000,
    thumb: null,
    year: 2024,
    scheduledIndex: index,
    ...(typeof seasonNumber === 'number' ? { seasonNumber } : {}),
    ...(typeof episodeNumber === 'number' ? { episodeNumber } : {}),
});

const makeResolvedContent = (channelId: string): ResolvedChannelContent => ({
    channelId,
    channelSnapshot: {
        id: channelId,
        name: channelId,
        number: 1,
        contentSource: { type: 'manual', items: [] },
        playbackMode: 'sequential',
        startTimeAnchor: 0,
        skipIntros: false,
        skipCredits: false,
        createdAt: 0,
        updatedAt: 0,
        lastContentRefresh: 0,
        itemCount: 0,
        totalDurationMs: 0,
    },
    resolvedAt: 0,
    items: [
        makeItem(`${channelId}-Now`, 60_000, 0),
        makeItem(`${channelId}-Next`, 60_000, 1),
    ],
    totalDurationMs: 120_000,
    orderedItems: [],
});

const makeProgram = (title: string): ScheduledProgram => ({
    item: makeItem(title, 60_000, 0),
    scheduledStartTime: 0,
    scheduledEndTime: 60_000,
    elapsedMs: 10_000,
    remainingMs: 50_000,
    scheduleIndex: 0,
    loopNumber: 0,
    isCurrent: true,
});

const makeEpisodeProgram = (
    showTitle: string,
    episodeTitle: string,
    seasonNumber?: number,
    episodeNumber?: number
): ScheduledProgram => ({
    item: makeEpisodeItem(showTitle, episodeTitle, seasonNumber, episodeNumber, 0),
    scheduledStartTime: 0,
    scheduledEndTime: 60_000,
    elapsedMs: 10_000,
    remainingMs: 50_000,
    scheduleIndex: 0,
    loopNumber: 0,
    isCurrent: true,
});

const makeOverlay = (): IMiniGuideOverlay => {
    let visible = false;
    const overlay = {
        initialize: jest.fn(),
        destroy: jest.fn(),
        show: jest.fn(() => {
            visible = true;
        }),
        hide: jest.fn(() => {
            visible = false;
        }),
        isVisible: jest.fn(() => visible),
        setViewModel: jest.fn(),
        setFocusedIndex: jest.fn(),
        setActions: jest.fn(),
    } as unknown as IMiniGuideOverlay;
    return overlay;
};

const makeChannel = (
    id: string,
    number: number,
    buildStrategy?: ChannelConfig['buildStrategy']
): ChannelConfig => ({
    id,
    name: `Channel ${number}`,
    number,
    ...(buildStrategy ? { buildStrategy } : {}),
    playbackMode: 'sequential',
    shuffleSeed: 1,
    phaseSeed: 0,
} as ChannelConfig);

const buildScheduleConfig = (
    channel: ChannelConfig,
    items: ResolvedChannelContent['items'],
    _referenceTimeMs: number
): ScheduleConfig => ({
    channelId: channel.id,
    anchorTime: 0,
    content: items,
    playbackMode: channel.playbackMode === 'random' ? 'shuffle' : channel.playbackMode,
    shuffleSeed: channel.shuffleSeed ?? 0,
});

const setup = (overrides?: Partial<{
    overlay: IMiniGuideOverlay;
    scheduler: IChannelScheduler | null;
    channels: ChannelConfig[];
    currentChannel: ChannelConfig | null;
    watchingChannelId: string | null;
}>): {
    coordinator: MiniGuideCoordinator;
    overlay: IMiniGuideOverlay;
    channelManager: IChannelManager;
    scheduler: IChannelScheduler;
    resolveDeferred: Record<string, Deferred<ResolvedChannelContent>>;
    switchToChannel: jest.Mock<Promise<void>, [string]>;
} => {
    const overlay = overrides?.overlay ?? makeOverlay();
    const channels = overrides?.channels ?? [
        makeChannel('ch1', 1),
        makeChannel('ch2', 2),
        makeChannel('ch3', 3),
        makeChannel('ch4', 4),
        makeChannel('ch5', 5),
        makeChannel('ch6', 6),
    ];
    const currentChannel = overrides && 'currentChannel' in overrides
        ? overrides.currentChannel ?? null
        : (channels[2] ?? channels[0] ?? null);
    const resolveDeferred: Record<string, Deferred<ResolvedChannelContent>> = {};
    channels.forEach((channel) => {
        resolveDeferred[channel.id] = createDeferred<ResolvedChannelContent>();
    });

    const channelManager = {
        getAllChannels: jest.fn().mockReturnValue(channels),
        getCurrentChannel: jest.fn().mockReturnValue(currentChannel),
        resolveChannelContent: jest.fn((channelId: string) => {
            const deferred = resolveDeferred[channelId];
            if (!deferred) {
                throw new Error(`Missing deferred for ${channelId}`);
            }
            return deferred.promise;
        }),
    } as unknown as IChannelManager;

    const scheduler = {
        getState: jest.fn().mockReturnValue({ isActive: true, channelId: currentChannel?.id ?? 'ch1' }),
        getCurrentProgram: jest.fn().mockReturnValue(makeProgram('Current-Now')),
        getNextProgram: jest.fn().mockReturnValue(makeProgram('Current-Next')),
    } as unknown as IChannelScheduler;

    const switchToChannel = jest.fn().mockResolvedValue(undefined);

    const coordinator = new MiniGuideCoordinator({
        getOverlay: (): IMiniGuideOverlay => overlay,
        getChannelManager: (): IChannelManager => channelManager,
        getScheduler: (): IChannelScheduler | null =>
            overrides && 'scheduler' in overrides ? overrides.scheduler ?? null : scheduler,
        getWatchingChannelId: (): string | null =>
            overrides && 'watchingChannelId' in overrides
                ? overrides.watchingChannelId ?? null
                : currentChannel?.id ?? null,
        buildDailyScheduleConfig: buildScheduleConfig,
        switchToChannel,
    });

    return { coordinator, overlay, channelManager, scheduler, resolveDeferred, switchToChannel };
};

describe('MiniGuideCoordinator', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(0);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('refreshes visible program progress and rollover on the shared clock tick', async () => {
        const current = makeChannel('ch1', 1);
        const peer = makeChannel('ch2', 2);
        const scheduler = {
            getState: jest.fn(() => ({ isActive: true, channelId: current.id })),
            getCurrentProgram: jest.fn(() => ({
                ...makeProgram(Date.now() >= 60_000 ? 'Current-Second' : 'Current-First'),
                scheduledStartTime: Date.now() >= 60_000 ? 60_000 : 0,
                scheduledEndTime: Date.now() >= 60_000 ? 120_000 : 60_000,
                elapsedMs: Date.now() % 60_000,
            })),
            getNextProgram: jest.fn(() => makeProgram('Current-Up-Next')),
        } as unknown as IChannelScheduler;
        const { coordinator, overlay, resolveDeferred } = setup({
            channels: [current, peer], currentChannel: current, scheduler,
        });
        coordinator.show();
        resolveDeferred[peer.id]?.resolve(makeResolvedContent(peer.id));
        await Promise.resolve();
        await Promise.resolve();
        const actions = (overlay.setActions as jest.Mock).mock.calls[0]?.[0] as { tick: () => void };
        const latestRows = (): Array<{ channelId: string; nowTitle: string; nowProgress: number; isWatching?: boolean }> =>
            ((overlay.setViewModel as jest.Mock).mock.lastCall?.[0] as {
                channels: Array<{ channelId: string; nowTitle: string; nowProgress: number; isWatching?: boolean }>;
            }).channels;

        jest.setSystemTime(30_000);
        actions.tick();
        expect(latestRows().find((row) => row.channelId === peer.id)?.nowProgress).toBeCloseTo(0.5);
        expect(latestRows().find((row) => row.channelId === current.id)?.nowProgress).toBeCloseTo(0.5);

        jest.setSystemTime(65_000);
        actions.tick();
        expect(latestRows().find((row) => row.channelId === peer.id)?.nowTitle).toBe('ch2-Next');
        expect(latestRows().find((row) => row.channelId === current.id)?.nowTitle).toBe('Current-Second');
        expect(latestRows().find((row) => row.channelId === current.id)?.isWatching).toBe(true);
        expect((overlay.setFocusedIndex as jest.Mock).mock.lastCall?.[0]).toBe(0);

        const renders = (overlay.setViewModel as jest.Mock).mock.calls.length;
        coordinator.hide();
        actions.tick();
        expect((overlay.setViewModel as jest.Mock).mock.calls.length).toBe(renders);
    });

    it('renders elapsed and remaining program time initially, on tick, and after rollover', () => {
        const container = document.createElement('div');
        container.id = MINI_GUIDE_CONTAINER_ID;
        document.body.appendChild(container);
        const overlay = new MiniGuideOverlay();
        overlay.initialize({ containerId: MINI_GUIDE_CONTAINER_ID });
        const current = makeChannel('ch1', 1);
        const scheduler = {
            getState: jest.fn(() => ({ isActive: true, channelId: current.id })),
            getCurrentProgram: jest.fn(() => ({
                ...makeProgram(Date.now() >= 60_000 ? 'Second' : 'First'),
                scheduledStartTime: Date.now() >= 60_000 ? 60_000 : 0,
                scheduledEndTime: Date.now() >= 60_000 ? 120_000 : 60_000,
                elapsedMs: Date.now() % 60_000,
            })),
            getNextProgram: jest.fn(() => makeProgram('Next')),
        } as unknown as IChannelScheduler;
        const { coordinator } = setup({ overlay, channels: [current], currentChannel: current, scheduler });
        const now = (): string | null => document.getElementById('mini-guide-now-time-0')?.textContent ?? null;

        try {
            coordinator.show();
            expect(now()).toContain('0:00 elapsed · 1:00 left');

            jest.advanceTimersByTime(30_000);
            expect(now()).toContain('0:30 elapsed · 0:30 left');

            jest.setSystemTime(35_000);
            jest.advanceTimersByTime(30_000);
            expect(document.getElementById('mini-guide-now-0')?.textContent).toBe('Second');
            expect(now()).toContain('0:05 elapsed · 0:55 left');
        } finally {
            coordinator.hide();
            overlay.destroy();
            container.remove();
        }
    });

    it('shows immediately with loading placeholders', () => {
        const { coordinator, overlay } = setup();

        coordinator.show();

        expect(overlay.show).toHaveBeenCalledTimes(1);
        const firstVm = (overlay.setViewModel as jest.Mock).mock.calls[0]?.[0];
        expect(firstVm.channels[0].nowTitle).toBe('Loading...');
        expect(firstVm.channels[4].nowTitle).toBe('Loading...');
        expect(firstVm.channels[2].nowTitle).toBe('Current-Now');
    });

    it('shows a bounded empty state when there are no channels', () => {
        const { coordinator, overlay } = setup({
            channels: [],
            currentChannel: null,
        });

        coordinator.show();

        expect(overlay.show).toHaveBeenCalledTimes(1);
        expect(overlay.setViewModel).toHaveBeenCalledWith({ channels: [], emptyMessage: 'No channels available' });
        expect(coordinator.handleNavigation('down')).toBe(true);
        expect(coordinator.handlePage('down')).toBe(true);
    });

    it('shows a single row when only one channel exists', () => {
        const singleChannel = makeChannel('ch1', 1);
        const scheduler = {
            getState: jest.fn().mockReturnValue({ isActive: true, channelId: 'ch1' }),
            getCurrentProgram: jest.fn().mockReturnValue(makeProgram('Current-Now')),
            getNextProgram: jest.fn().mockReturnValue(makeProgram('Current-Next')),
        } as unknown as IChannelScheduler;
        const { coordinator, overlay } = setup({
            channels: [singleChannel],
            currentChannel: singleChannel,
            scheduler,
        });

        coordinator.show();

        const firstVm = (overlay.setViewModel as jest.Mock).mock.calls[0]?.[0];
        expect(firstVm.channels[0].nowTitle).toBe('Current-Now');
        expect(firstVm.channels).toHaveLength(1);
        expect(firstVm.channels[0].isWatching).toBe(true);
    });

    it('marks only an accepted watching channel, separate from selected channel', () => {
        const channels = [makeChannel('ch1', 1), makeChannel('ch2', 2)];
        const { coordinator, overlay } = setup({
            channels,
            currentChannel: channels[1]!,
            watchingChannelId: 'ch1',
        });

        coordinator.show();

        const rows = (overlay.setViewModel as jest.Mock).mock.calls[0]?.[0].channels;
        expect(rows.find((row: { channelId: string }) => row.channelId === 'ch1').isWatching).toBe(true);
        expect(rows.find((row: { channelId: string }) => row.channelId === 'ch2').isWatching).toBe(false);
    });

    it('formats episode titles with series context in the mini guide', () => {
        const singleChannel = makeChannel('ch1', 1);
        const scheduler = {
            getState: jest.fn().mockReturnValue({ isActive: true, channelId: 'ch1' }),
            getCurrentProgram: jest.fn().mockReturnValue(
                makeEpisodeProgram('Series Title', 'Episode Name', 2, 3)
            ),
            getNextProgram: jest.fn().mockReturnValue(makeProgram('Next Up')),
        } as unknown as IChannelScheduler;
        const { coordinator, overlay } = setup({
            channels: [singleChannel],
            currentChannel: singleChannel,
            scheduler,
        });

        coordinator.show();

        const firstVm = (overlay.setViewModel as jest.Mock).mock.calls[0]?.[0];
        expect(firstVm.channels[0].nowTitle).toBe('Series Title • S02E03 • Episode Name');
    });

    it('formats episode titles without season/episode metadata', () => {
        const singleChannel = makeChannel('ch1', 1);
        const scheduler = {
            getState: jest.fn().mockReturnValue({ isActive: true, channelId: 'ch1' }),
            getCurrentProgram: jest.fn().mockReturnValue(
                makeEpisodeProgram('Series Title', 'Episode Name')
            ),
            getNextProgram: jest.fn().mockReturnValue(makeProgram('Next Up')),
        } as unknown as IChannelScheduler;
        const { coordinator, overlay } = setup({
            channels: [singleChannel],
            currentChannel: singleChannel,
            scheduler,
        });

        coordinator.show();

        const firstVm = (overlay.setViewModel as jest.Mock).mock.calls[0]?.[0];
        expect(firstVm.channels[0].nowTitle).toBe('Series Title • Episode Name');
    });

    it('sets showBrandingIcon based on whether channel.icon is present', () => {
        const withIcon = {
            ...makeChannel('with-icon', 1, 'genres'),
            icon: 'https://example.com/icon.png',
        } as ChannelConfig;
        const noIcon = makeChannel('no-icon', 2, 'genres');

        const withIconSetup = setup({
            channels: [withIcon],
            currentChannel: withIcon,
        });
        withIconSetup.coordinator.show();
        const withIconVm = (withIconSetup.overlay.setViewModel as jest.Mock).mock.calls[0]?.[0];
        expect(withIconVm.channels[0].showBrandingIcon).toBe(false);

        const noIconSetup = setup({
            channels: [noIcon],
            currentChannel: noIcon,
        });
        noIconSetup.coordinator.show();
        const noIconVm = (noIconSetup.overlay.setViewModel as jest.Mock).mock.calls[0]?.[0];
        expect(noIconVm.channels[0].showBrandingIcon).toBe(true);
    });

    it('includes formatted current start time when current program has scheduledStartTime', () => {
        const singleChannel = makeChannel('ch1', 1);
        const scheduler = {
            getState: jest.fn().mockReturnValue({ isActive: true, channelId: 'ch1' }),
            getCurrentProgram: jest.fn().mockReturnValue({
                ...makeProgram('Current-Now'),
                scheduledStartTime: Date.parse('2024-01-01T13:05:00.000Z'),
            }),
            getNextProgram: jest.fn().mockReturnValue(makeProgram('Current-Next')),
        } as unknown as IChannelScheduler;
        const { coordinator, overlay } = setup({
            channels: [singleChannel],
            currentChannel: singleChannel,
            scheduler,
        });

        coordinator.show();

        const firstVm = (overlay.setViewModel as jest.Mock).mock.calls[0]?.[0];
        expect((firstVm.channels[0] as { nowStartTime?: string | null }).nowStartTime).toMatch(
            /^\d{1,2}:\d{2} [AP]M$/
        );
    });

    it('sets nowStartTime to null for loading and unavailable rows', () => {
        const { coordinator, overlay } = setup();

        coordinator.show();

        const firstVm = (overlay.setViewModel as jest.Mock).mock.calls[0]?.[0];
        expect((firstVm.channels[0] as { nowStartTime?: string | null }).nowStartTime).toBeNull();

        const unavailableSetup = setup({
            channels: [makeChannel('ch1', 1)],
            currentChannel: makeChannel('ch1', 1),
            scheduler: null,
        });
        unavailableSetup.coordinator.show();

        const unavailableVm = (unavailableSetup.overlay.setViewModel as jest.Mock).mock.calls[0]?.[0];
        expect((unavailableVm.channels[0] as { nowStartTime?: string | null }).nowStartTime).toBeNull();
    });

    it('threads buildStrategy into ready, loading, and unavailable rows', () => {
        const readyChannel = makeChannel('ch1', 1, 'genres');
        const readyScheduler = {
            getState: jest.fn().mockReturnValue({ isActive: true, channelId: 'ch1' }),
            getCurrentProgram: jest.fn().mockReturnValue(makeProgram('Current-Now')),
            getNextProgram: jest.fn().mockReturnValue(makeProgram('Current-Next')),
        } as unknown as IChannelScheduler;

        const ready = setup({
            channels: [readyChannel],
            currentChannel: readyChannel,
            scheduler: readyScheduler,
        });
        ready.coordinator.show();
        const readyVm = (ready.overlay.setViewModel as jest.Mock).mock.calls[0]?.[0];
        expect(readyVm.channels[0].buildStrategy).toBe('genres');

        const loading = setup({
            channels: [
                makeChannel('ch1', 1, 'collections'),
                makeChannel('ch2', 2, 'playlists'),
                makeChannel('ch3', 3, 'genres'),
            ],
            currentChannel: makeChannel('ch3', 3, 'genres'),
            scheduler: readyScheduler,
        });
        loading.coordinator.show();
        const loadingVm = (loading.overlay.setViewModel as jest.Mock).mock.calls[0]?.[0];
        expect(loadingVm.channels[0].buildStrategy).toBe('collections');

        const unavailableChannel = makeChannel('ch9', 9, 'actors');
        const unavailable = setup({
            channels: [unavailableChannel],
            currentChannel: unavailableChannel,
            scheduler: null,
        });
        unavailable.coordinator.show();
        const unavailableVm = (unavailable.overlay.setViewModel as jest.Mock).mock.calls[0]?.[0];
        expect(unavailableVm.channels[0].buildStrategy).toBe('actors');
    });

    it('dedupes resolve for duplicate non-current channels', () => {
        const channelA = makeChannel('ch1', 1);
        const channelB = makeChannel('ch2', 2);
        const { coordinator, channelManager } = setup({
            channels: [channelA, channelB],
            currentChannel: channelA,
        });

        coordinator.show();

        expect(channelManager.resolveChannelContent).toHaveBeenCalledTimes(1);
        expect(channelManager.resolveChannelContent).toHaveBeenCalledWith('ch2', expect.any(Object));
    });

    it('falls back to first channel when current channel is null', () => {
        const channelA = makeChannel('ch1', 1);
        const channelB = makeChannel('ch2', 2);
        const { coordinator, overlay } = setup({
            channels: [channelA, channelB],
            currentChannel: null,
        });

        coordinator.show();

        const firstVm = (overlay.setViewModel as jest.Mock).mock.calls[0]?.[0];
        expect(firstVm.channels[0].channelId).toBe('ch1');
        expect(firstVm.channels[0].channelNumber).toBe(1);
    });

    it('resolves prev/next channels and updates view model', async () => {
        const { coordinator, overlay, resolveDeferred } = setup();

        coordinator.show();

        resolveDeferred['ch1']!.resolve(makeResolvedContent('ch1'));
        resolveDeferred['ch5']!.resolve(makeResolvedContent('ch5'));

        await Promise.resolve();

        const lastCall = (overlay.setViewModel as jest.Mock).mock.calls.at(-1)?.[0];
        expect(lastCall.channels[0].nowTitle).toBe('ch1-Now');
        expect(lastCall.channels[0].nextTitle).toBe('ch1-Next');
        expect(lastCall.channels[4].nowTitle).toBe('ch5-Now');
        expect(lastCall.channels[4].nextTitle).toBe('ch5-Next');
    });

    it('navigation shifts window when moving past edges', () => {
        const { coordinator, overlay } = setup();
        coordinator.show();

        coordinator.handleNavigation('up');
        coordinator.handleNavigation('up');
        expect(overlay.setFocusedIndex).toHaveBeenCalledWith(0);

        coordinator.handleNavigation('up');
        const lastVm = (overlay.setViewModel as jest.Mock).mock.calls.at(-1)?.[0];
        expect(lastVm.channels[0].channelId).toBe('ch6');
        expect(overlay.hide).not.toHaveBeenCalled();

        coordinator.show();
        coordinator.handleNavigation('down');
        coordinator.handleNavigation('down');
        coordinator.handleNavigation('down');
        expect(overlay.setFocusedIndex).toHaveBeenCalledWith(4);

        const lastVmDown = (overlay.setViewModel as jest.Mock).mock.calls.at(-1)?.[0];
        expect(lastVmDown.channels[4].channelId).toBe('ch6');
        expect(overlay.hide).not.toHaveBeenCalled();
    });

    it('pages window by jump size', () => {
        const { coordinator, overlay } = setup();
        coordinator.show();

        expect(coordinator.handlePage('down')).toBe(true);
        const lastVm = (overlay.setViewModel as jest.Mock).mock.calls.at(-1)?.[0];
        expect(lastVm.channels[0].channelId).toBe('ch6');
        expect(lastVm.channels[2].channelId).toBe('ch2');
    });

    it('ok hides and switches channel', () => {
        const { coordinator, overlay, switchToChannel } = setup();
        coordinator.show();

        coordinator.handleSelect();

        expect(overlay.hide).toHaveBeenCalled();
        expect(switchToChannel).toHaveBeenCalledWith('ch3');
    });

    it('reports channel switch failures through notifyToast only', async () => {
        const overlay = makeOverlay();
        const channels = [
            makeChannel('ch1', 1),
            makeChannel('ch2', 2),
            makeChannel('ch3', 3),
            makeChannel('ch4', 4),
            makeChannel('ch5', 5),
        ];
        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue(channels),
            getCurrentChannel: jest.fn().mockReturnValue(channels[2]),
            resolveChannelContent: jest.fn().mockImplementation(() => createDeferred<ResolvedChannelContent>().promise),
        } as unknown as IChannelManager;
        const scheduler = {
            getState: jest.fn().mockReturnValue({ isActive: true, channelId: 'ch3' }),
            getCurrentProgram: jest.fn().mockReturnValue(makeProgram('Current-Now')),
            getNextProgram: jest.fn().mockReturnValue(makeProgram('Current-Next')),
        } as unknown as IChannelScheduler;
        const switchToChannel = jest.fn().mockRejectedValue(new Error('switch failed'));
        const notifyToast = jest.fn();
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        try {
            const coordinator = new MiniGuideCoordinator({
                getOverlay: (): IMiniGuideOverlay => overlay,
                getChannelManager: (): IChannelManager => channelManager,
                getScheduler: (): IChannelScheduler => scheduler,
                getWatchingChannelId: (): string | null => 'ch3',
                buildDailyScheduleConfig: buildScheduleConfig,
                switchToChannel,
                notifyToast,
            });

            coordinator.show();
            coordinator.handleSelect();
            await Promise.resolve();

            expect(switchToChannel).toHaveBeenCalledWith('ch3');
            expect(notifyToast).toHaveBeenCalledWith({ message: 'Failed to switch channel', type: 'warning' });
            expect(warnSpy).not.toHaveBeenCalled();
        } finally {
            warnSpy.mockRestore();
        }
    });

    it('remains open after browsing beyond the old timeout', () => {
        const { coordinator, overlay } = setup();
        coordinator.show();
        coordinator.handleNavigation('down');

        jest.advanceTimersByTime(AUTO_HIDE_MS + 1);

        expect(overlay.hide).not.toHaveBeenCalled();
    });

    it('does not auto-hide without interaction', () => {
        const { coordinator, overlay } = setup();
        coordinator.show();

        jest.advanceTimersByTime(AUTO_HIDE_MS + 1);

        expect(overlay.hide).not.toHaveBeenCalled();
    });

    it('hide aborts and prevents post-hide updates', async () => {
        const { coordinator, overlay, resolveDeferred } = setup();
        coordinator.show();

        coordinator.hide();
        resolveDeferred['ch1']!.resolve(makeResolvedContent('ch1'));

        await Promise.resolve();

        expect((overlay.setViewModel as jest.Mock).mock.calls.length).toBe(1);
    });

    it('ignores resolves that complete after window shifts', async () => {
        const { coordinator, overlay, resolveDeferred } = setup();
        coordinator.show();

        coordinator.handlePage('down');
        const callCountBefore = (overlay.setViewModel as jest.Mock).mock.calls.length;

        resolveDeferred['ch5']!.resolve(makeResolvedContent('ch5'));

        await Promise.resolve();

        const callCountAfter = (overlay.setViewModel as jest.Mock).mock.calls.length;
        expect(callCountAfter).toBe(callCountBefore);
        const lastVm = (overlay.setViewModel as jest.Mock).mock.calls.at(-1)?.[0];
        expect(lastVm.channels[0].channelId).toBe('ch6');
    });

    it('skips stale row updates when channel id differs', () => {
        const { coordinator, overlay } = setup();
        coordinator.show();

        coordinator.handlePage('down');

        const latestVm = (overlay.setViewModel as jest.Mock).mock.calls.at(-1)?.[0];
        const currentRowChannelId = latestVm.channels[0].channelId as string;

        expect(
            shouldApplyMiniGuideRowUpdate({
                expectedToken: 123,
                currentToken: 123,
                overlayVisible: overlay.isVisible(),
                currentRowChannelId,
                nextRowChannelId: 'ch1',
            })
        ).toBe(false);

        expect(
            shouldApplyMiniGuideRowUpdate({
                expectedToken: 123,
                currentToken: 123,
                overlayVisible: overlay.isVisible(),
                currentRowChannelId,
                nextRowChannelId: currentRowChannelId,
            })
        ).toBe(true);
    });

    describe('shouldApplyMiniGuideRowUpdate policy', () => {
        it('returns false when overlay is not visible', () => {
            expect(
                shouldApplyMiniGuideRowUpdate({
                    expectedToken: 1,
                    currentToken: 1,
                    overlayVisible: false,
                    currentRowChannelId: 'ch1',
                    nextRowChannelId: 'ch1',
                })
            ).toBe(false);
        });

        it('returns false when the expected token does not match the current token', () => {
            expect(
                shouldApplyMiniGuideRowUpdate({
                    expectedToken: 1,
                    currentToken: 2,
                    overlayVisible: true,
                    currentRowChannelId: 'ch1',
                    nextRowChannelId: 'ch1',
                })
            ).toBe(false);
        });

        it('returns false when the current row channel id is null', () => {
            expect(
                shouldApplyMiniGuideRowUpdate({
                    expectedToken: 1,
                    currentToken: 1,
                    overlayVisible: true,
                    currentRowChannelId: null,
                    nextRowChannelId: 'ch1',
                })
            ).toBe(false);
        });
    });
});
