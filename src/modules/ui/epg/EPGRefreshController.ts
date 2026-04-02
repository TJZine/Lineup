import type {
    ChannelConfig as SchedulerChannelConfig,
    IChannelManager,
    ResolvedChannelContent,
} from '../../scheduler/channel-manager';
import type {
    IChannelScheduler,
    ScheduleConfig,
    ScheduleWindow as SchedulerScheduleWindow,
} from '../../scheduler/scheduler';
import type { GuideSettingChange } from '../settings/types';
import { IssueDiagnosticsStore } from '../../debug/IssueDiagnosticsStore';
import { isAbortLikeError, summarizeErrorForLog } from '../../../utils/errors';
import type { IEPGComponent } from './interfaces';
import type { EpgUiStatus } from './EPGCoordinator';
import type { EpgVisibleRange } from './types';
import { EPGVisibleRangeRefreshQueue } from './EPGVisibleRangeRefreshQueue';
import { EPGScheduleRefreshRuntime } from './EPGScheduleRefreshRuntime';
import { toEpgScheduleWindow } from './adapters';
import type { GuideSelectionSnapshot } from '../../../core/channel-tuning';

const QA_003B_ISSUE_ID = 'QA-003b';
const issueDiagnosticsStore = new IssueDiagnosticsStore();

export interface EPGRefreshControllerDeps {
    getEpg: () => IEPGComponent | null;
    getChannelManager: () => IChannelManager | null;
    getScheduler: () => IChannelScheduler | null;
    getEpgUiStatus: () => EpgUiStatus;
    getEpgScheduleRangeMs: () => { startTime: number; endTime: number } | null;
    getLibraryFilterState: (allChannels: SchedulerChannelConfig[]) => { selectedId: string | null; shouldFilter: boolean };
    getVisibleChannels: (
        allChannels: SchedulerChannelConfig[],
        selectedId: string | null,
        shouldFilter: boolean
    ) => SchedulerChannelConfig[];
    buildDailyScheduleConfig: (
        channel: SchedulerChannelConfig,
        items: ResolvedChannelContent['items'],
        referenceTimeMs: number
    ) => ScheduleConfig;
    computeScheduleCacheLimit: (channelCount: number, aggressive: boolean) => number;
    getScheduleLoadConcurrency: (channelCount: number, prefetchCount: number, aggressive: boolean) => number;
    cloneScheduleWindow: (window: SchedulerScheduleWindow) => SchedulerScheduleWindow;
    isAggressivePreloadEnabled: () => boolean;
    isDebugEnabled: () => boolean;
    appendDebugLog: (event: string, payload: Record<string, unknown>) => void;
    primeEpgChannels: () => void;
    onGuideSettingInvalidation: () => void;
}

export class EPGRefreshController {
    private readonly _scheduleRefreshRuntime: EPGScheduleRefreshRuntime;
    private readonly _visibleRangeRefreshQueue: EPGVisibleRangeRefreshQueue;

    constructor(private readonly _deps: EPGRefreshControllerDeps) {
        this._scheduleRefreshRuntime = new EPGScheduleRefreshRuntime({
            getEpg: (): IEPGComponent | null => this._deps.getEpg(),
            getChannelManager: (): IChannelManager | null => this._deps.getChannelManager(),
            getScheduler: (): IChannelScheduler | null => this._deps.getScheduler(),
            getEpgUiStatus: (): EpgUiStatus => this._deps.getEpgUiStatus(),
            getEpgScheduleRangeMs: (): { startTime: number; endTime: number } | null => this._deps.getEpgScheduleRangeMs(),
            getLibraryFilterState: (allChannels: SchedulerChannelConfig[]): { selectedId: string | null; shouldFilter: boolean } =>
                this._deps.getLibraryFilterState(allChannels),
            getVisibleChannels: (
                allChannels: SchedulerChannelConfig[],
                selectedId: string | null,
                shouldFilter: boolean
            ): SchedulerChannelConfig[] =>
                this._deps.getVisibleChannels(allChannels, selectedId, shouldFilter),
            buildDailyScheduleConfig: (
                channel: SchedulerChannelConfig,
                items: ResolvedChannelContent['items'],
                referenceTimeMs: number
            ): ScheduleConfig =>
                this._deps.buildDailyScheduleConfig(channel, items, referenceTimeMs),
            computeScheduleCacheLimit: (channelCount: number, aggressive: boolean): number =>
                this._deps.computeScheduleCacheLimit(channelCount, aggressive),
            getScheduleLoadConcurrency: (
                channelCount: number,
                prefetchCount: number,
                aggressive: boolean
            ): number =>
                this._deps.getScheduleLoadConcurrency(channelCount, prefetchCount, aggressive),
            cloneScheduleWindow: (window: SchedulerScheduleWindow): SchedulerScheduleWindow => this._deps.cloneScheduleWindow(window),
            isAggressivePreloadEnabled: (): boolean => this._deps.isAggressivePreloadEnabled(),
            isDebugEnabled: (): boolean => this._deps.isDebugEnabled(),
            appendDebugLog: (event: string, payload: Record<string, unknown>): void => this._deps.appendDebugLog(event, payload),
        });
        this._visibleRangeRefreshQueue = new EPGVisibleRangeRefreshQueue(
            (range: EpgVisibleRange, reason: string) => this._refreshEpgSchedulesForRange(range, reason)
        );
    }

    clearScheduleCaches(): void {
        this._scheduleRefreshRuntime.clearScheduleCaches();
    }

    clearSelectedChannelScheduleSnapshot(): void {
        this._scheduleRefreshRuntime.clearSelectedChannelScheduleSnapshot();
    }

    clearLoadedScheduleMarkers(): void {
        this._scheduleRefreshRuntime.clearLoadedScheduleMarkers();
    }

    cancelScheduledRefreshWork(reason: string): void {
        this._visibleRangeRefreshQueue.cancelPendingRefresh();
        this._scheduleRefreshRuntime.abortAllInFlightSchedules(reason);
    }

    async refreshEpgSchedules(options?: { reason?: string; debounceMs?: number }): Promise<void> {
        const epg = this._deps.getEpg();
        if (!epg) return;
        const epgState = epg.getState();
        const range = {
            channelStart: epgState.viewWindow.startChannelIndex,
            channelEnd: epgState.viewWindow.endChannelIndex,
            timeStartMs: epgState.viewWindow.startTime,
            timeEndMs: epgState.viewWindow.endTime,
        };
        const reason = options?.reason ?? 'manual';
        if (options?.debounceMs !== undefined) {
            await this.refreshEpgSchedulesForRange(range, { reason, debounceMs: options.debounceMs });
            return;
        }
        await this._refreshEpgSchedulesForRange(range, reason);
    }

    async refreshEpgSchedulesForRange(
        range: {
            channelStart: number;
            channelEnd: number;
            timeStartMs: number;
            timeEndMs: number;
        },
        options?: { reason?: string; debounceMs?: number }
    ): Promise<void> {
        return this._visibleRangeRefreshQueue.request(range, options);
    }

    async refreshEpgSchedulesForRangeNow(
        range: { channelStart: number; channelEnd: number; timeStartMs: number; timeEndMs: number },
        reason: string
    ): Promise<void> {
        await this._refreshEpgSchedulesForRange(range, reason);
    }

    refreshEpgScheduleForLiveChannel(): void {
        const epg = this._deps.getEpg();
        const channelManager = this._deps.getChannelManager();
        const scheduler = this._deps.getScheduler();
        if (!epg || !channelManager || !scheduler) return;
        if (this._deps.getEpgUiStatus() !== 'ready') return;
        if (!epg.isVisible()) return;

        const range = this._deps.getEpgScheduleRangeMs();
        if (!range) return;

        const current = channelManager.getCurrentChannel();
        if (!current) return;

        const all = channelManager.getAllChannels();
        const { selectedId, shouldFilter } = this._deps.getLibraryFilterState(all);
        const visible = this._deps.getVisibleChannels(all, selectedId, shouldFilter);
        if (!visible.some((c) => c.id === current.id)) return;

        const state = scheduler.getState();
        if (!state.isActive || state.channelId !== current.id) {
            return;
        }

        try {
            const window = scheduler.getScheduleWindow(range.startTime, range.endTime);
            const schedule = this._deps.cloneScheduleWindow(window);
            const now = Date.now();
            const currentProgram =
                schedule.programs.find((program) => now >= program.scheduledStartTime && now < program.scheduledEndTime) ??
                null;
            issueDiagnosticsStore.append(QA_003B_ISSUE_ID, 'epg.liveRowOverwrite', {
                channelId: current.id,
                source: 'live-scheduler',
                rangeStartTime: range.startTime,
                rangeEndTime: range.endTime,
                currentRatingKey: currentProgram?.item.ratingKey ?? null,
                currentScheduledStartTime: currentProgram?.scheduledStartTime ?? null,
                currentScheduledEndTime: currentProgram?.scheduledEndTime ?? null,
                programCount: schedule.programs.length,
            });
            epg.loadScheduleForChannel(current.id, toEpgScheduleWindow(schedule));
            this._scheduleRefreshRuntime.cacheScheduleForRange(
                current.id,
                range.startTime,
                range.endTime,
                schedule
            );
        } catch (error) {
            if (this._deps.isDebugEnabled()) {
                this._deps.appendDebugLog('EPG.refreshEpgScheduleForLiveChannel.error', {
                    error: summarizeErrorForLog(error),
                });
            }
        }
    }

    preseedCurrentChannelSchedule(epgOverride?: IEPGComponent): void {
        const epg = epgOverride ?? this._deps.getEpg();
        const channelManager = this._deps.getChannelManager();
        const scheduler = this._deps.getScheduler();
        if (!epg || !channelManager || !scheduler) return;
        if (this._deps.getEpgUiStatus() !== 'ready') return;

        const range = this._deps.getEpgScheduleRangeMs();
        if (!range) return;

        const current = channelManager.getCurrentChannel();
        if (!current) return;

        const all = channelManager.getAllChannels();
        const { selectedId, shouldFilter } = this._deps.getLibraryFilterState(all);
        const visible = this._deps.getVisibleChannels(all, selectedId, shouldFilter);
        if (!visible.some((c) => c.id === current.id)) return;

        const state = scheduler.getState();
        if (!state.isActive || state.channelId !== current.id) {
            return;
        }

        try {
            const window = scheduler.getScheduleWindow(range.startTime, range.endTime);
            const schedule = this._deps.cloneScheduleWindow(window);
            epg.loadScheduleForChannel(current.id, toEpgScheduleWindow(schedule));
            this._scheduleRefreshRuntime.cacheScheduleForRange(
                current.id,
                range.startTime,
                range.endTime,
                schedule
            );
        } catch (error) {
            if (this._deps.isDebugEnabled()) {
                this._deps.appendDebugLog('EPG.preseedCurrentChannelSchedule.error', {
                    error: summarizeErrorForLog(error),
                });
            }
        }
    }

    async buildGuideSelectionSnapshot(
        request: {
            channelId: string;
            ratingKey: string;
            scheduledStartTime: number;
            scheduledEndTime: number;
            selectedAt: number;
        },
        signal?: AbortSignal | null
    ): Promise<GuideSelectionSnapshot | null> {
        return this._scheduleRefreshRuntime.buildGuideSelectionSnapshot(request, signal);
    }

    handleGuideSettingRefreshChange(change: GuideSettingChange): void {
        const shouldInvalidateSchedules =
            change.key === 'libraryTabs' ||
            change.key === 'guideDensity' ||
            change.key === 'aggressivePreload' ||
            change.key === 'pastItemsWindow';

        if (!shouldInvalidateSchedules) {
            return;
        }

        this.cancelScheduledRefreshWork('guide-settings');
        this.clearScheduleCaches();
        this.clearSelectedChannelScheduleSnapshot();
        this._deps.onGuideSettingInvalidation();

        const epg = this._deps.getEpg();
        if (!epg) return;
        epg.clearSchedules();

        if (!epg.isVisible()) return;
        this._deps.primeEpgChannels();
        this.refreshEpgSchedulesBestEffort({ reason: 'guide-settings', debounceMs: 0 });
    }

    handleLibraryFilterRefreshChange(_libraryId: string | null): void {
        const epg = this._deps.getEpg();
        if (!epg) return;

        this.cancelScheduledRefreshWork('library-filter');
        this.clearSelectedChannelScheduleSnapshot();
        this._scheduleRefreshRuntime.clearLoadedScheduleMarkers();

        epg.clearSchedules();
        this._deps.primeEpgChannels();

        epg.scrollToChannel(0);
        epg.focusChannel(0);

        this.refreshEpgSchedulesBestEffort({ reason: 'library-filter', debounceMs: 0 });
    }

    private refreshEpgSchedulesBestEffort(options?: { reason?: string; debounceMs?: number }): void {
        void this.refreshEpgSchedules(options).catch((error: unknown) => {
            if (isAbortLikeError(error)) return;
            console.error('[EPGRefreshController] refreshEpgSchedules failed:', summarizeErrorForLog(error));
        });
    }

    private async _refreshEpgSchedulesForRange(
        range: { channelStart: number; channelEnd: number; timeStartMs: number; timeEndMs: number },
        reason: string
    ): Promise<void> {
        await this._scheduleRefreshRuntime.refreshForRange(range, reason);
    }
}
