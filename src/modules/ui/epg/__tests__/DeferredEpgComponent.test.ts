import { DeferredEpgComponent } from '../index';
import type { IEPGComponent } from '../interfaces';
import type { EPGConfig, ChannelConfig, ScheduleWindow, ScheduledProgram, EPGState } from '../types';
import type { EpgLayoutMode } from '../../../settings/EpgPreferencesStore';

type RuntimeCall =
    | ['initialize', EPGConfig]
    | ['loadChannels', ChannelConfig[]]
    | ['loadScheduleForChannel', string, ScheduleWindow]
    | ['setCategoryColorsEnabled', boolean]
    | ['setLayoutMode', EpgLayoutMode]
    | ['setVisibleHours', number]
    | ['setNowWatchingBannerEnabled', boolean]
    | ['setLibraryTabs', Array<{ id: string; name: string }>, string | null]
    | ['show', { preserveFocus?: boolean } | undefined]
    | ['hide']
    | ['toggle']
    | ['focusChannel', number]
    | ['focusProgram', number, number]
    | ['focusNow']
    | ['scrollToTime', number]
    | ['scrollToChannel', number]
    | ['setGridAnchorTime', number]
    | ['clearSchedules']
    | ['destroy']
    | ['refreshCurrentTime']
    | ['handleNavigation', 'up' | 'down' | 'left' | 'right']
    | ['handlePage', 'up' | 'down']
    | ['handleSelect']
    | ['handleBack'];

const makeConfig = (): EPGConfig => ({
    containerId: 'epg-container',
    visibleChannels: 5,
    timeSlotMinutes: 30,
    visibleHours: 3,
    totalHours: 24,
    pixelsPerMinute: 4,
    rowHeight: 80,
    showCurrentTimeIndicator: true,
    autoScrollToNow: true,
});

const makeChannel = (id: string): ChannelConfig => ({
    id,
    name: `Channel ${id}`,
    number: 1,
    contentSource: { type: 'manual', items: [] },
    playbackMode: 'loop',
    startTimeAnchor: 0,
    skipIntros: false,
    skipCredits: false,
    createdAt: 0,
    updatedAt: 0,
    lastContentRefresh: 0,
    itemCount: 0,
    totalDurationMs: 0,
});

const makeProgram = (ratingKey: string): ScheduledProgram => ({
    item: {
        ratingKey,
        type: 'movie',
        title: ratingKey,
        fullTitle: ratingKey,
        durationMs: 60000,
        thumb: null,
        guid: null,
        parentGuid: null,
        grandparentGuid: null,
        viewOffset: 0,
        year: 2026,
        scheduledIndex: 0,
    },
    scheduledStartTime: 0,
    scheduledEndTime: 60000,
    elapsedMs: 0,
    remainingMs: 60000,
    scheduleIndex: 0,
    loopNumber: 0,
    streamDescriptor: null,
    isCurrent: false,
});

const makeSchedule = (ratingKey: string): ScheduleWindow => ({
    startTime: 0,
    endTime: 60000,
    programs: [makeProgram(ratingKey)],
});

const makeState = (isVisible: boolean = false): EPGState => ({
    isVisible,
    focusedCell: null,
    scrollPosition: { channelOffset: 0, timeOffset: 0 },
    viewWindow: {
        startTime: 0,
        endTime: 0,
        startChannelIndex: 0,
        endChannelIndex: 0,
    },
    currentTime: 0,
});

type FakeRuntimeOverrides = Partial<IEPGComponent>;

const createFakeRuntime = (overrides: FakeRuntimeOverrides = {}): new () => IEPGComponent => (
    class FakeRuntime implements IEPGComponent {
        private visible = (overrides as { visible?: boolean }).visible ?? false;

        constructor() {
            Object.assign(this, overrides);
        }

        initialize(): void {}
        ensureReady(): Promise<void> {
            return Promise.resolve();
        }
        show(): void {
            this.visible = true;
        }
        hide(): void {
            this.visible = false;
        }
        toggle(): void {}
        isVisible(): boolean {
            return this.visible;
        }
        loadChannels(): void {}
        setCategoryColorsEnabled(): void {}
        setLayoutMode(): void {}
        setVisibleHours(): void {}
        setNowWatchingBannerEnabled(): void {}
        setLibraryTabs(): void {}
        loadScheduleForChannel(): void {}
        clearSchedules(): void {}
        refreshCurrentTime(): void {}
        focusChannel(): void {}
        focusProgram(): void {}
        focusNow(): void {}
        scrollToTime(): void {}
        scrollToChannel(): void {}
        getState(): EPGState {
            return makeState(this.visible);
        }
        getFocusedProgram(): ScheduledProgram | null {
            return null;
        }
        handleNavigation(): boolean {
            return false;
        }
        handlePage(): boolean {
            return false;
        }
        handleSelect(): boolean {
            return false;
        }
        handleBack(): boolean {
            return false;
        }
        setGridAnchorTime(): void {}
        destroy(): void {}
        on(): void {}
        off(): void {}
    }
);

const createLoader = (overrides: FakeRuntimeOverrides = {}): jest.Mock => jest.fn(async () => ({
    EPGComponent: createFakeRuntime(overrides),
}));

describe('DeferredEpgComponent', () => {
    it('does not load the runtime during initialize()', async () => {
        const calls: RuntimeCall[] = [];
        const loader = createLoader({
            initialize(config: EPGConfig): void {
                calls.push(['initialize', config]);
            },
            show(options?: { preserveFocus?: boolean }): void {
                calls.push(['show', options]);
            },
            hide(): void {
                calls.push(['hide']);
            },
            toggle(): void {
                calls.push(['toggle']);
            },
            loadChannels(channels: ChannelConfig[]): void {
                calls.push(['loadChannels', channels]);
            },
            setCategoryColorsEnabled(enabled: boolean): void {
                calls.push(['setCategoryColorsEnabled', enabled]);
            },
            setLayoutMode(mode: EpgLayoutMode): void {
                calls.push(['setLayoutMode', mode]);
            },
            setVisibleHours(hours: number): void {
                calls.push(['setVisibleHours', hours]);
            },
            setNowWatchingBannerEnabled(enabled: boolean): void {
                calls.push(['setNowWatchingBannerEnabled', enabled]);
            },
            setLibraryTabs(libraries: Array<{ id: string; name: string }>, selectedId: string | null): void {
                calls.push(['setLibraryTabs', libraries, selectedId]);
            },
            loadScheduleForChannel(channelId: string, schedule: ScheduleWindow): void {
                calls.push(['loadScheduleForChannel', channelId, schedule]);
            },
            clearSchedules(): void {
                calls.push(['clearSchedules']);
            },
            refreshCurrentTime(): void {
                calls.push(['refreshCurrentTime']);
            },
            focusChannel(channelIndex: number): void {
                calls.push(['focusChannel', channelIndex]);
            },
            focusProgram(channelIndex: number, programIndex: number): void {
                calls.push(['focusProgram', channelIndex, programIndex]);
            },
            focusNow(): void {
                calls.push(['focusNow']);
            },
            scrollToTime(time: number): void {
                calls.push(['scrollToTime', time]);
            },
            scrollToChannel(channelIndex: number): void {
                calls.push(['scrollToChannel', channelIndex]);
            },
            handleNavigation(direction: 'up' | 'down' | 'left' | 'right'): boolean {
                calls.push(['handleNavigation', direction]);
                return false;
            },
            handlePage(direction: 'up' | 'down'): boolean {
                calls.push(['handlePage', direction]);
                return false;
            },
            handleSelect(): boolean {
                calls.push(['handleSelect']);
                return false;
            },
            handleBack(): boolean {
                calls.push(['handleBack']);
                return false;
            },
            setGridAnchorTime(anchorTime: number): void {
                calls.push(['setGridAnchorTime', anchorTime]);
            },
            destroy(): void {
                calls.push(['destroy']);
            },
        });

        const component = new DeferredEpgComponent(loader as never);

        component.initialize(makeConfig());

        expect(loader).not.toHaveBeenCalled();
        expect(calls).toHaveLength(0);
    });

    it('loads the runtime once when ensureReady() is called', async () => {
        const loader = createLoader();

        const component = new DeferredEpgComponent(loader as never);
        await component.ensureReady();
        await component.ensureReady();

        expect(loader).toHaveBeenCalledTimes(1);
    });

    it('replays queued config, channels, schedules, layout mode, banner mode, and tabs after load', async () => {
        const callLog: string[] = [];
        const loader = createLoader({
            initialize(config: EPGConfig): void {
                callLog.push(`initialize:${config.containerId}`);
            },
            show(): void {
                callLog.push('show');
            },
            hide(): void {
                callLog.push('hide');
            },
            toggle(): void {
                callLog.push('toggle');
            },
            loadChannels(channels: ChannelConfig[]): void {
                callLog.push(`loadChannels:${channels.map((channel) => channel.id).join(',')}`);
            },
            setCategoryColorsEnabled(enabled: boolean): void {
                callLog.push(`setCategoryColorsEnabled:${enabled}`);
            },
            setLayoutMode(mode: EpgLayoutMode): void {
                callLog.push(`setLayoutMode:${mode}`);
            },
            setVisibleHours(hours: number): void {
                callLog.push(`setVisibleHours:${hours}`);
            },
            setNowWatchingBannerEnabled(enabled: boolean): void {
                callLog.push(`setNowWatchingBannerEnabled:${enabled}`);
            },
            setLibraryTabs(libraries: Array<{ id: string; name: string }>, selectedId: string | null): void {
                callLog.push(`setLibraryTabs:${libraries.length}:${selectedId ?? 'null'}`);
            },
            loadScheduleForChannel(channelId: string): void {
                callLog.push(`loadScheduleForChannel:${channelId}`);
            },
            clearSchedules(): void {
                callLog.push('clearSchedules');
            },
        });

        const component = new DeferredEpgComponent(loader as never);
        const config = makeConfig();
        const channels = [makeChannel('ch-1'), makeChannel('ch-2')];
        const libraries = [{ id: 'lib-1', name: 'Library 1' }];

        component.initialize(config);
        component.loadChannels(channels);
        component.loadScheduleForChannel('ch-1', makeSchedule('prog-1'));
        component.setCategoryColorsEnabled(true);
        component.setLayoutMode('classic');
        component.setVisibleHours(4);
        component.setNowWatchingBannerEnabled(false);
        component.setLibraryTabs(libraries, 'lib-1');

        await component.ensureReady();

        expect(callLog).toEqual([
            'initialize:epg-container',
            'loadChannels:ch-1,ch-2',
            'loadScheduleForChannel:ch-1',
            'setCategoryColorsEnabled:true',
            'setLayoutMode:classic',
            'setVisibleHours:4',
            'setNowWatchingBannerEnabled:false',
            'setLibraryTabs:1:lib-1',
        ]);
    });

    it('shows the real runtime after queued show() once load resolves', async () => {
        const callLog: string[] = [];
        let visible = false;
        const loader = createLoader({
            show(): void {
                visible = true;
                callLog.push('show');
            },
            hide(): void {
                visible = false;
            },
            isVisible(): boolean {
                return visible;
            },
            getState(): EPGState {
                return makeState(visible);
            },
        });

        const component = new DeferredEpgComponent(loader as never);
        component.initialize(makeConfig());
        component.show();

        await component.ensureReady();

        expect(callLog).toEqual(['show']);
        expect(component.isVisible()).toBe(true);
    });

    it('forwards focus and scroll commands after runtime load', async () => {
        const callLog: string[] = [];
        const loader = createLoader({
            isVisible(): boolean {
                return true;
            },
            getState(): EPGState {
                return makeState(true);
            },
            focusChannel(channelIndex: number): void {
                callLog.push(`focusChannel:${channelIndex}`);
            },
            focusProgram(channelIndex: number, programIndex: number): void {
                callLog.push(`focusProgram:${channelIndex}:${programIndex}`);
            },
            focusNow(): void {
                callLog.push('focusNow');
            },
            scrollToTime(time: number): void {
                callLog.push(`scrollToTime:${time}`);
            },
            scrollToChannel(channelIndex: number): void {
                callLog.push(`scrollToChannel:${channelIndex}`);
            },
        });

        const component = new DeferredEpgComponent(loader as never);
        component.initialize(makeConfig());
        await component.ensureReady();

        component.focusChannel(2);
        component.focusProgram(2, 4);
        component.focusNow();
        component.scrollToTime(12345);
        component.scrollToChannel(7);

        expect(callLog).toEqual([
            'focusChannel:2',
            'focusProgram:2:4',
            'focusNow',
            'scrollToTime:12345',
            'scrollToChannel:7',
        ]);
    });

    it('does not mark the runtime initialized when replay fails and allows a retry', async () => {
        const callLog: string[] = [];
        let failReplay = true;
        const loader = createLoader({
            initialize(): void {
                callLog.push('initialize');
            },
            loadChannels(channels: ChannelConfig[]): void {
                callLog.push(`loadChannels:${channels.length}`);
                if (failReplay) {
                    throw new Error('replay failed');
                }
            },
            focusChannel(channelIndex: number): void {
                callLog.push(`focusChannel:${channelIndex}`);
            },
        });

        const component = new DeferredEpgComponent(loader as never);
        component.initialize(makeConfig());
        component.loadChannels([makeChannel('ch-1')]);

        await expect(component.ensureReady()).rejects.toThrow('replay failed');

        component.focusChannel(3);
        expect(callLog).not.toContain('focusChannel:3');

        failReplay = false;
        await component.ensureReady();
        component.focusChannel(3);

        expect(callLog).toEqual([
            'initialize',
            'loadChannels:1',
            'initialize',
            'loadChannels:1',
            'focusChannel:3',
            'focusChannel:3',
        ]);
    });

    it('rolls back deferred visibility state when show fails to load the runtime', async () => {
        const loader = jest.fn(async () => {
            throw new Error('chunk load failed');
        });
        const component = new DeferredEpgComponent(loader as never);
        component.initialize(makeConfig());

        component.show({ preserveFocus: true });
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(component.isVisible()).toBe(false);
        expect(component.getState().isVisible).toBe(false);
    });
});
