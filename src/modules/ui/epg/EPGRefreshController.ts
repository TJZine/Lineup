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
import { EpgPreferencesStore } from '../../settings/EpgPreferencesStore';
import type { GuideSettingChange } from '../settings/types';
import { IssueDiagnosticsStore } from '../../debug/IssueDiagnosticsStore';
import { isAbortLikeError, summarizeErrorForLog } from '../../../utils/errors';
import type { IEPGComponent } from './interfaces';
import type { EpgUiStatus } from './EPGCoordinator';
import type { EpgVisibleRange } from './types';
import { EPGVisibleRangeRefreshQueue } from './EPGVisibleRangeRefreshQueue';
import { EPGScheduleRefreshRuntime } from './EPGScheduleRefreshRuntime';
import {
    computeEpgScheduleRangeMs,
    readAppliedLibraryFilterState,
    selectVisibleChannelsForLibraryFilter,
} from './EPGCoordinatorPolicies';
import { toEpgScheduleWindow } from './adapters';
import type { GuideSelectionSnapshot } from '../../../core/channel-tuning';
import type { EPGConfig } from './types';
import type { IEpgDebugRuntime } from './EPGDebugRuntime';

const EPG_SCHEDULE_CACHE_MIN_ENTRIES = 60;
const EPG_SCHEDULE_CACHE_MAX_ENTRIES = 240;
const EPG_SCHEDULE_CACHE_MIN_ENTRIES_AGGRESSIVE = 120;
const EPG_SCHEDULE_CACHE_MAX_ENTRIES_AGGRESSIVE = 360;

const QA_003B_ISSUE_ID = 'QA-003b';
const issueDiagnosticsStore = new IssueDiagnosticsStore();

export interface EPGRefreshControllerDeps {
    getEpg: () => IEPGComponent | null;
    getChannelManager: () => IChannelManager | null;
    getScheduler: () => IChannelScheduler | null;
    getEpgUiStatus: () => EpgUiStatus;
    getEpgConfig: () => EPGConfig | null;
    getLocalMidnightMs: (timeMs: number) => number;
    debugRuntime?: IEpgDebugRuntime | null;
    buildDailyScheduleConfig: (
        channel: SchedulerChannelConfig,
        items: ResolvedChannelContent['items'],
        referenceTimeMs: number
    ) => ScheduleConfig;
    epgPreferencesStore: EpgPreferencesStore;
    primeEpgChannels: () => void;
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
            getEpgScheduleRangeMs: (): { startTime: number; endTime: number } | null => this._getEpgScheduleRangeMs(),
            getLibraryFilterState: (allChannels: SchedulerChannelConfig[]): { selectedId: string | null; shouldFilter: boolean } =>
                this._readAppliedLibraryFilterState(allChannels),
            getVisibleChannels: (
                allChannels: SchedulerChannelConfig[],
                selectedId: string | null,
                shouldFilter: boolean
            ): SchedulerChannelConfig[] =>
                selectVisibleChannelsForLibraryFilter(allChannels, selectedId, shouldFilter),
            buildDailyScheduleConfig: (
                channel: SchedulerChannelConfig,
                items: ResolvedChannelContent['items'],
                referenceTimeMs: number
            ): ScheduleConfig =>
                this._deps.buildDailyScheduleConfig(channel, items, referenceTimeMs),
            computeScheduleCacheLimit: (channelCount: number, aggressive: boolean): number =>
                this._computeScheduleCacheLimit(channelCount, aggressive),
            getScheduleLoadConcurrency: (
                channelCount: number,
                prefetchCount: number,
                aggressive: boolean
            ): number =>
                this._getScheduleLoadConcurrency(channelCount, prefetchCount, aggressive),
            cloneScheduleWindow: (window: SchedulerScheduleWindow): SchedulerScheduleWindow => this._cloneScheduleWindow(window),
            isAggressivePreloadEnabled: (): boolean => this._isAggressivePreloadEnabled(),
            isDebugEnabled: (): boolean => this._isDebugEnabled(),
            appendDebugLog: (event: string, payload: Record<string, unknown>): void => this._appendDebugLog(event, payload),
        });
        this._visibleRangeRefreshQueue = new EPGVisibleRangeRefreshQueue(
            (range: EpgVisibleRange, reason: string) => this._refreshEpgSchedulesForRange(range, reason)
        );
    }

    private _getEpgScheduleRangeMs(): { startTime: number; endTime: number } | null {
        return computeEpgScheduleRangeMs(
            {
                getEpgConfig: (): EPGConfig | null => this._deps.getEpgConfig(),
                getChannelManager: (): IChannelManager | null => this._deps.getChannelManager(),
                getLocalMidnightMs: (timeMs: number): number => this._deps.getLocalMidnightMs(timeMs),
            },
            Date.now(),
            this._deps.epgPreferencesStore.readScheduleRangeSnapshot()
        );
    }

    private _readAppliedLibraryFilterState(allChannels: SchedulerChannelConfig[]): {
        selectedId: string | null;
        shouldFilter: boolean;
    } {
        const { selectedId, shouldFilter } = readAppliedLibraryFilterState(allChannels, this._deps.epgPreferencesStore);
        return { selectedId, shouldFilter };
    }

    private _computeScheduleCacheLimit(channelCount: number, aggressive: boolean): number {
        const scaled = Math.ceil(channelCount * (aggressive ? 1.6 : 1.25));
        const minEntries = aggressive ? EPG_SCHEDULE_CACHE_MIN_ENTRIES_AGGRESSIVE : EPG_SCHEDULE_CACHE_MIN_ENTRIES;
        const maxEntries = aggressive ? EPG_SCHEDULE_CACHE_MAX_ENTRIES_AGGRESSIVE : EPG_SCHEDULE_CACHE_MAX_ENTRIES;
        return Math.min(maxEntries, Math.max(minEntries, scaled));
    }

    private _getScheduleLoadConcurrency(
        channelCount: number,
        prefetchCount: number,
        aggressive: boolean
    ): number {
        if (prefetchCount <= 0) {
            return 1;
        }
        let target = aggressive ? 5 : 4;
        if (channelCount >= 180) target = aggressive ? 10 : 8;
        else if (channelCount >= 120) target = aggressive ? 8 : 7;
        else if (channelCount >= 80) target = aggressive ? 7 : 6;
        return Math.max(1, Math.min(target, prefetchCount));
    }

    private _cloneScheduleWindow(window: SchedulerScheduleWindow): SchedulerScheduleWindow {
        return { ...window, programs: [...window.programs] };
    }

    private _isAggressivePreloadEnabled(): boolean {
        return this._deps.epgPreferencesStore.readAggressivePreloadEnabled(false);
    }

    private _isDebugEnabled(): boolean {
        return this._deps.debugRuntime?.isEnabled() ?? false;
    }

    private _appendDebugLog(event: string, payload: Record<string, unknown>): void {
        this._deps.debugRuntime?.append(event, payload);
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

        const range = this._getEpgScheduleRangeMs();
        if (!range) return;

        const current = channelManager.getCurrentChannel();
        if (!current) return;

        const all = channelManager.getAllChannels();
        const { selectedId, shouldFilter } = this._readAppliedLibraryFilterState(all);
        const visible = selectVisibleChannelsForLibraryFilter(all, selectedId, shouldFilter);
        if (!visible.some((c) => c.id === current.id)) return;

        const state = scheduler.getState();
        if (!state.isActive || state.channelId !== current.id) {
            return;
        }

        try {
            const window = scheduler.getScheduleWindow(range.startTime, range.endTime);
            const schedule = this._cloneScheduleWindow(window);
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
            if (this._isDebugEnabled()) {
                this._appendDebugLog('EPG.refreshEpgScheduleForLiveChannel.error', {
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

        const range = this._getEpgScheduleRangeMs();
        if (!range) return;

        const current = channelManager.getCurrentChannel();
        if (!current) return;

        const all = channelManager.getAllChannels();
        const { selectedId, shouldFilter } = this._readAppliedLibraryFilterState(all);
        const visible = selectVisibleChannelsForLibraryFilter(all, selectedId, shouldFilter);
        if (!visible.some((c) => c.id === current.id)) return;

        const state = scheduler.getState();
        if (!state.isActive || state.channelId !== current.id) {
            return;
        }

        try {
            const window = scheduler.getScheduleWindow(range.startTime, range.endTime);
            const schedule = this._cloneScheduleWindow(window);
            epg.loadScheduleForChannel(current.id, toEpgScheduleWindow(schedule));
            this._scheduleRefreshRuntime.cacheScheduleForRange(
                current.id,
                range.startTime,
                range.endTime,
                schedule
            );
        } catch (error) {
            if (this._isDebugEnabled()) {
                this._appendDebugLog('EPG.preseedCurrentChannelSchedule.error', {
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

        const epg = this._deps.getEpg();
        if (!epg) return;
        epg.clearSchedules();

        if (!epg.isVisible()) return;
        this._deps.primeEpgChannels();
        this.refreshEpgSchedulesBestEffort({ reason: 'guide-settings', debounceMs: 0 });
    }

    handleLibraryFilterRefreshChange(): void {
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
