import { EventEmitter } from '../../../utils/EventEmitter';
import type { EpgLayoutMode } from '../../settings/EpgPreferencesStore';
import type { ChannelConfig, EPGConfig, EPGEventMap, EPGState, ScheduleWindow, ScheduledProgram } from './types';
import type { IEPGComponent } from './interfaces';

type EpgRuntimeModule = typeof import('./EPGComponent');
type EpgRuntimeLoader = () => Promise<EpgRuntimeModule>;

type PendingFocusCommand =
    | { kind: 'focusChannel'; channelIndex: number }
    | { kind: 'focusProgram'; channelIndex: number; programIndex: number }
    | { kind: 'focusNow' }
    | { kind: 'scrollToTime'; time: number }
    | { kind: 'scrollToChannel'; channelIndex: number };

type PendingLibraryTabs = {
    libraries: Array<{ id: string; name: string }>;
    selectedId: string | null;
};

export class DeferredEpgComponent extends EventEmitter<EPGEventMap> implements IEPGComponent {
    private readonly _loader: EpgRuntimeLoader;
    private _runtime: IEPGComponent | null = null;
    private _runtimeLoadPromise: Promise<void> | null = null;
    private _runtimeInitialized = false;
    private _destroyed = false;

    private _config: EPGConfig | null = null;
    private _gridAnchorTime: number | null = null;
    private _channels: ChannelConfig[] | null = null;
    private _schedules = new Map<string, ScheduleWindow>();
    private _scheduleOrder: string[] = [];
    private _categoryColorsEnabled: boolean | null = null;
    private _layoutMode: EpgLayoutMode | null = null;
    private _visibleHours: number | null = null;
    private _nowWatchingBannerEnabled: boolean | null = null;
    private _libraryTabs: PendingLibraryTabs | null = null;
    private _desiredVisible = false;
    private _lastShowOptions: { preserveFocus?: boolean } | undefined;
    private _pendingFocusCommand: PendingFocusCommand | null = null;
    private _runtimeBridges: Array<() => void> = [];

    constructor(loader: EpgRuntimeLoader = () => import('./EPGComponent')) {
        super();
        this._loader = loader;
    }

    async ensureReady(): Promise<void> {
        if (this._destroyed) {
            return;
        }

        if (this._runtime && this._runtimeInitialized) {
            return;
        }

        if (this._runtime && !this._runtimeInitialized) {
            this._initializeRuntimeIfPossible();
            return;
        }

        if (!this._runtimeLoadPromise) {
            this._runtimeLoadPromise = this._loadRuntime().finally(() => {
                this._runtimeLoadPromise = null;
            });
        }

        await this._runtimeLoadPromise;

        if (this._destroyed) {
            return;
        }

        this._initializeRuntimeIfPossible();
    }

    initialize(config: EPGConfig): void {
        this._config = config;
        if (this._runtime) {
            this._initializeRuntimeIfPossible();
        }
    }

    show(options?: { preserveFocus?: boolean }): void {
        this._desiredVisible = true;
        this._lastShowOptions = options;

        if (this._runtimeInitialized && this._runtime) {
            this._runtime.show(options);
            return;
        }

        void this.ensureReady().catch(() => undefined);
    }

    hide(): void {
        this._desiredVisible = false;
        this._lastShowOptions = undefined;

        if (this._runtimeInitialized && this._runtime) {
            this._runtime.hide();
        }
    }

    toggle(): void {
        if (this.isVisible()) {
            this.hide();
        } else {
            this.show();
        }
    }

    isVisible(): boolean {
        if (this._runtimeInitialized && this._runtime) {
            return this._runtime.isVisible();
        }
        return this._desiredVisible;
    }

    loadChannels(channels: ChannelConfig[]): void {
        this._channels = channels;
        if (this._runtimeInitialized && this._runtime) {
            this._runtime.loadChannels(channels);
        }
    }

    setCategoryColorsEnabled(enabled: boolean): void {
        this._categoryColorsEnabled = enabled;
        if (this._runtimeInitialized && this._runtime) {
            this._runtime.setCategoryColorsEnabled(enabled);
        }
    }

    setLayoutMode(mode: EpgLayoutMode): void {
        this._layoutMode = mode;
        if (this._runtimeInitialized && this._runtime) {
            this._runtime.setLayoutMode(mode);
        }
    }

    setVisibleHours(hours: number): void {
        this._visibleHours = hours;
        if (this._runtimeInitialized && this._runtime) {
            this._runtime.setVisibleHours(hours);
        }
    }

    setNowWatchingBannerEnabled(enabled: boolean): void {
        this._nowWatchingBannerEnabled = enabled;
        if (this._runtimeInitialized && this._runtime) {
            this._runtime.setNowWatchingBannerEnabled(enabled);
        }
    }

    setLibraryTabs(libraries: Array<{ id: string; name: string }>, selectedId: string | null): void {
        this._libraryTabs = { libraries, selectedId };
        if (this._runtimeInitialized && this._runtime) {
            this._runtime.setLibraryTabs(libraries, selectedId);
        }
    }

    loadScheduleForChannel(channelId: string, schedule: ScheduleWindow): void {
        const isNewSchedule = !this._schedules.has(channelId);
        this._schedules.set(channelId, schedule);
        if (isNewSchedule) {
            this._scheduleOrder.push(channelId);
        }

        if (this._runtimeInitialized && this._runtime) {
            this._runtime.loadScheduleForChannel(channelId, schedule);
        }
    }

    clearSchedules(): void {
        this._schedules.clear();
        this._scheduleOrder = [];
        this._pendingFocusCommand = null;

        if (this._runtimeInitialized && this._runtime) {
            this._runtime.clearSchedules();
        }
    }

    refreshCurrentTime(): void {
        if (this._runtimeInitialized && this._runtime) {
            this._runtime.refreshCurrentTime();
        }
    }

    focusChannel(channelIndex: number): void {
        this._pendingFocusCommand = { kind: 'focusChannel', channelIndex };
        if (this._runtimeInitialized && this._runtime) {
            this._runtime.focusChannel(channelIndex);
        }
    }

    focusProgram(channelIndex: number, programIndex: number): void {
        this._pendingFocusCommand = { kind: 'focusProgram', channelIndex, programIndex };
        if (this._runtimeInitialized && this._runtime) {
            this._runtime.focusProgram(channelIndex, programIndex);
        }
    }

    focusNow(): void {
        this._pendingFocusCommand = { kind: 'focusNow' };
        if (this._runtimeInitialized && this._runtime) {
            this._runtime.focusNow();
        }
    }

    scrollToTime(time: number): void {
        this._pendingFocusCommand = { kind: 'scrollToTime', time };
        if (this._runtimeInitialized && this._runtime) {
            this._runtime.scrollToTime(time);
        }
    }

    scrollToChannel(channelIndex: number): void {
        this._pendingFocusCommand = { kind: 'scrollToChannel', channelIndex };
        if (this._runtimeInitialized && this._runtime) {
            this._runtime.scrollToChannel(channelIndex);
        }
    }

    getState(): EPGState {
        if (this._runtimeInitialized && this._runtime) {
            return this._runtime.getState();
        }

        return {
            isVisible: this._desiredVisible,
            focusedCell: null,
            scrollPosition: { channelOffset: 0, timeOffset: 0 },
            viewWindow: {
                startTime: 0,
                endTime: 0,
                startChannelIndex: 0,
                endChannelIndex: 0,
            },
            currentTime: Date.now(),
        };
    }

    getFocusedProgram(): ScheduledProgram | null {
        if (this._runtimeInitialized && this._runtime) {
            return this._runtime.getFocusedProgram();
        }
        return null;
    }

    handleNavigation(direction: 'up' | 'down' | 'left' | 'right'): boolean {
        return this._runtimeInitialized && this._runtime
            ? this._runtime.handleNavigation(direction)
            : false;
    }

    handlePage(direction: 'up' | 'down'): boolean {
        return this._runtimeInitialized && this._runtime
            ? this._runtime.handlePage(direction)
            : false;
    }

    handleSelect(): boolean {
        return this._runtimeInitialized && this._runtime
            ? this._runtime.handleSelect()
            : false;
    }

    handleBack(): boolean {
        return this._runtimeInitialized && this._runtime
            ? this._runtime.handleBack()
            : false;
    }

    setGridAnchorTime(anchorTime: number): void {
        this._gridAnchorTime = anchorTime;
        if (this._runtimeInitialized && this._runtime) {
            this._runtime.setGridAnchorTime(anchorTime);
        }
    }

    destroy(): void {
        this._destroyed = true;
        this._desiredVisible = false;
        this._lastShowOptions = undefined;
        this._pendingFocusCommand = null;
        this._config = null;
        this._gridAnchorTime = null;
        this._channels = null;
        this._schedules.clear();
        this._scheduleOrder = [];
        this._categoryColorsEnabled = null;
        this._layoutMode = null;
        this._visibleHours = null;
        this._nowWatchingBannerEnabled = null;
        this._libraryTabs = null;

        for (const dispose of this._runtimeBridges) {
            dispose();
        }
        this._runtimeBridges = [];

        this._runtime?.destroy();
        this._runtime = null;
        this._runtimeInitialized = false;
        this._runtimeLoadPromise = null;
        this.removeAllListeners();
    }

    private async _loadRuntime(): Promise<void> {
        const module = await this._loader();
        if (this._destroyed) {
            return;
        }

        const runtime = new module.EPGComponent();
        if (this._destroyed) {
            runtime.destroy();
            return;
        }

        this._runtime = runtime;
        this._bridgeRuntimeEvents(runtime);
    }

    private _bridgeRuntimeEvents(runtime: IEPGComponent): void {
        this._runtimeBridges = [];
        const runtimeEmitter = runtime as unknown as EventEmitter<EPGEventMap>;
        const bridge = <K extends keyof EPGEventMap>(event: K): void => {
            const disposable = runtimeEmitter.on(event, (payload: EPGEventMap[K]) => {
                this.emit(event, payload);
            });
            this._runtimeBridges.push(() => disposable.dispose());
        };

        bridge('open');
        bridge('close');
        bridge('focusChange');
        bridge('channelSelected');
        bridge('programSelected');
        bridge('libraryFilterChanged');
        bridge('timeScroll');
        bridge('channelScroll');
    }

    private _initializeRuntimeIfPossible(): void {
        if (!this._runtime || !this._config || this._destroyed) {
            return;
        }

        this._runtime.initialize(this._config);
        this._runtimeInitialized = true;

        if (this._gridAnchorTime !== null) {
            this._runtime.setGridAnchorTime(this._gridAnchorTime);
        }

        if (this._channels) {
            this._runtime.loadChannels(this._channels);
        }

        for (const channelId of this._scheduleOrder) {
            const schedule = this._schedules.get(channelId);
            if (schedule) {
                this._runtime.loadScheduleForChannel(channelId, schedule);
            }
        }

        if (this._categoryColorsEnabled !== null) {
            this._runtime.setCategoryColorsEnabled(this._categoryColorsEnabled);
        }

        if (this._layoutMode !== null) {
            this._runtime.setLayoutMode(this._layoutMode);
        }

        if (this._visibleHours !== null) {
            this._runtime.setVisibleHours(this._visibleHours);
        }

        if (this._nowWatchingBannerEnabled !== null) {
            this._runtime.setNowWatchingBannerEnabled(this._nowWatchingBannerEnabled);
        }

        if (this._libraryTabs !== null) {
            this._runtime.setLibraryTabs(this._libraryTabs.libraries, this._libraryTabs.selectedId);
        }

        if (this._pendingFocusCommand) {
            this._applyPendingFocusCommand();
        }

        if (this._desiredVisible && !this._runtime.isVisible()) {
            this._runtime.show(this._lastShowOptions);
        }
    }

    private _applyPendingFocusCommand(): void {
        if (!this._runtime || !this._pendingFocusCommand) {
            return;
        }

        switch (this._pendingFocusCommand.kind) {
            case 'focusChannel':
                this._runtime.focusChannel(this._pendingFocusCommand.channelIndex);
                return;
            case 'focusProgram':
                this._runtime.focusProgram(
                    this._pendingFocusCommand.channelIndex,
                    this._pendingFocusCommand.programIndex
                );
                return;
            case 'focusNow':
                this._runtime.focusNow();
                return;
            case 'scrollToTime':
                this._runtime.scrollToTime(this._pendingFocusCommand.time);
                return;
            case 'scrollToChannel':
                this._runtime.scrollToChannel(this._pendingFocusCommand.channelIndex);
                return;
        }
    }
}
