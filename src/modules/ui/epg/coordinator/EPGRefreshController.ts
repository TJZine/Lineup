import type {
    ChannelConfig as SchedulerChannelConfig,
    IChannelManager,
    ResolvedChannelContent,
} from '../../../scheduler/channel-manager';
import type {
    IChannelScheduler,
    ScheduleConfig,
    ScheduleWindow as SchedulerScheduleWindow,
} from '../../../scheduler/scheduler';
import { EpgPreferencesStore } from '../../../settings/EpgPreferencesStore';
import type { GuideSettingChange } from '../../settings/types';
import type { AppendIssueDiagnostic } from '../../../debug/IssueDiagnosticsStore';
import { isAbortLikeError } from '../../../../utils/errors';
import type { IEPGComponent } from '../interfaces';
import type { EpgVisibleRange } from '../types';
import type { EPGScheduleRefreshRuntime } from '../runtime/EPGScheduleRefreshRuntime';
import { EPGVisibleRangeRefreshQueue } from '../runtime/EPGVisibleRangeRefreshQueue';
import { throwIfEpgRefreshAborted } from '../runtime/EPGRefreshAbort';
import type { EpgRefreshInvocationOptions } from '../runtime/EPGGuardedVisibleRangeRefreshQueue';
import type { EpgRetainedOperationContext } from '../runtime/EPGRetainedOperationContext';
import {
    computeNormalizedLibraryFilterState,
    computeEpgScheduleRangeMs,
    selectVisibleChannelsForLibraryFilter,
} from './EPGCoordinatorPolicies';
import { reportLibraryFilterPersistenceResult } from './EPGLibraryFilterPersistenceDiagnostics';
import { appendDebugRuntimeLog, isDebugRuntimeEnabled } from '../debug/debugRuntimeGuards';
import { toEpgScheduleWindow } from '../model/adapters';
import type { EPGConfig } from '../types';
import type { IEPGDebugRuntime } from '../debug/EPGDebugRuntime';
import type {
    EpgGuideSelectionSnapshot,
    EpgScheduleRefreshResult,
    EpgScheduleRefreshOptions,
    EpgUiStatus,
} from './EPGCoordinatorContracts';
import { createSkippedEpgScheduleRefreshResult } from '../../../../shared/epgRefresh';

const EPG_SCHEDULE_CACHE_MIN_ENTRIES = 60;
const EPG_SCHEDULE_CACHE_MAX_ENTRIES = 240;
const EPG_SCHEDULE_CACHE_MIN_ENTRIES_AGGRESSIVE = 120;
const EPG_SCHEDULE_CACHE_MAX_ENTRIES_AGGRESSIVE = 360;

const QA_003B_ISSUE_ID = 'QA-003b';

export interface EPGRefreshControllerDeps {
    getEpg: () => IEPGComponent | null;
    getChannelManager: () => IChannelManager | null;
    getScheduler: () => IChannelScheduler | null;
    getEpgUiStatus: () => EpgUiStatus;
    getEpgConfig: () => EPGConfig | null;
    getLocalMidnightMs: (timeMs: number) => number;
    debugRuntime?: IEPGDebugRuntime | null;
    buildDailyScheduleConfig: (
        channel: SchedulerChannelConfig,
        items: ResolvedChannelContent['items'],
        referenceTimeMs: number
    ) => ScheduleConfig;
    appendIssueDiagnostic: AppendIssueDiagnostic;
    epgPreferencesStore: EpgPreferencesStore;
    primeEpgChannels: (operationContext?: EpgRetainedOperationContext) => void;
}

type EPGScheduleRefreshRuntimeModule = typeof import('../runtime/EPGScheduleRefreshRuntime');

export class EPGRefreshController {
    private readonly _visibleRangeRefreshQueue: EPGVisibleRangeRefreshQueue;
    private _scheduleRefreshRuntime: EPGScheduleRefreshRuntime | null = null;
    private _scheduleRefreshRuntimeLoad: Promise<EPGScheduleRefreshRuntime | null> | null = null;
    private _scheduleRefreshRuntimeInvalidation = 0;
    private _lastScheduleRefreshRuntimeInvalidationReason = 'cancel-before-runtime-ready';

    constructor(private readonly _deps: EPGRefreshControllerDeps) {
        this._visibleRangeRefreshQueue = new EPGVisibleRangeRefreshQueue(
            (range: EpgVisibleRange, reason: string, signal?: AbortSignal | null) =>
                this._refreshEpgSchedulesForRange(range, reason, signal ? { signal } : undefined),
            (range: EpgVisibleRange, reason: string, options?: EpgRefreshInvocationOptions) =>
                this._refreshEpgSchedulesForRange(range, reason, options)
        );
    }

    private _createScheduleRefreshRuntime(module: EPGScheduleRefreshRuntimeModule): EPGScheduleRefreshRuntime {
        return new module.EPGScheduleRefreshRuntime({
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
            appendIssueDiagnostic: (issue: string, event: string, data: unknown): void =>
                this._deps.appendIssueDiagnostic(issue, event, data),
        });
    }

    private async _getScheduleRefreshRuntime(): Promise<EPGScheduleRefreshRuntime | null> {
        if (this._scheduleRefreshRuntime) {
            return this._scheduleRefreshRuntime;
        }
        if (!this._scheduleRefreshRuntimeLoad) {
            const invalidation = this._scheduleRefreshRuntimeInvalidation;
            const runtimeLoad = import('../runtime/EPGScheduleRefreshRuntime')
                .then((module) => {
                    const runtime = this._createScheduleRefreshRuntime(module);
                    if (invalidation !== this._scheduleRefreshRuntimeInvalidation) {
                        runtime.dispose(this._lastScheduleRefreshRuntimeInvalidationReason);
                        return null;
                    }
                    this._scheduleRefreshRuntime = runtime;
                    return runtime;
                })
                .finally(() => {
                    if (this._scheduleRefreshRuntimeLoad === runtimeLoad) {
                        this._scheduleRefreshRuntimeLoad = null;
                    }
                });
            this._scheduleRefreshRuntimeLoad = runtimeLoad;
        }
        return this._scheduleRefreshRuntimeLoad;
    }

    private _getEpgScheduleRangeMs(): { startTime: number; endTime: number } | null {
        return computeEpgScheduleRangeMs(
            {
                getEpgConfig: (): EPGConfig | null => this._deps.getEpgConfig(),
                getChannelManager: (): IChannelManager | null => this._deps.getChannelManager(),
                getLocalMidnightMs: (timeMs: number): number => this._deps.getLocalMidnightMs(timeMs),
            },
            Date.now(),
            this._deps.epgPreferencesStore.readScheduleRangeSnapshotAndClean()
        );
    }

    private _readAppliedLibraryFilterState(allChannels: SchedulerChannelConfig[]): {
        selectedId: string | null;
        shouldFilter: boolean;
    } {
        const { selectedId, shouldFilter, shouldClearPersistedSelection } = computeNormalizedLibraryFilterState(
            allChannels,
            this._deps.epgPreferencesStore.readScheduleRangeSnapshotAndClean()
        );
        if (shouldClearPersistedSelection) {
            reportLibraryFilterPersistenceResult(
                this._deps.appendIssueDiagnostic,
                this._deps.epgPreferencesStore.writeSelectedLibraryId(null),
                null,
                'normalize-invalid-library-filter'
            );
        }
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
        return this._deps.epgPreferencesStore.readAggressivePreloadEnabledAndClean(false);
    }

    private _isDebugEnabled(): boolean {
        return isDebugRuntimeEnabled(this._deps.debugRuntime);
    }

    private _appendDebugLog(event: string, payload: Record<string, unknown>): void {
        appendDebugRuntimeLog(this._deps.debugRuntime, event, payload);
    }

    private _reportIssue(
        event: string,
        _error: unknown,
        payload: Record<string, unknown> = {}
    ): void {
        this._deps.appendIssueDiagnostic(QA_003B_ISSUE_ID, event, {
            ...payload,
            errorKind: 'non-abort',
        });
    }

    clearScheduleCaches(): void {
        this._scheduleRefreshRuntime?.clearScheduleCaches();
    }

    clearSelectedChannelScheduleSnapshot(): void {
        this._scheduleRefreshRuntime?.clearSelectedChannelScheduleSnapshot();
    }

    clearLoadedScheduleMarkers(): void {
        this._scheduleRefreshRuntime?.clearLoadedScheduleMarkers();
    }

    private _invalidateScheduleRefreshRuntime(reason: string): void {
        const runtime = this._scheduleRefreshRuntime;
        this._scheduleRefreshRuntimeInvalidation += 1;
        this._lastScheduleRefreshRuntimeInvalidationReason = reason;
        runtime?.dispose(reason);
        this._visibleRangeRefreshQueue.cancelPendingRefresh();
        this._scheduleRefreshRuntime = null;
        this._scheduleRefreshRuntimeLoad = null;
    }

    cancelScheduledRefreshWork(reason: string): void {
        this._invalidateScheduleRefreshRuntime(reason);
    }

    dispose(reason = 'shutdown'): void {
        this._invalidateScheduleRefreshRuntime(reason);
    }

    async refreshEpgSchedules(options?: EpgScheduleRefreshOptions): Promise<EpgScheduleRefreshResult> {
        const signal = options?.signal ?? null;
        throwIfEpgRefreshAborted(signal);
        const epg = this._deps.getEpg();
        if (!epg) return createSkippedEpgScheduleRefreshResult();
        const epgState = epg.getState();
        const range = {
            channelStart: epgState.viewWindow.startChannelIndex,
            channelEndExclusive: epgState.viewWindow.endChannelIndexExclusive,
            timeStartMs: epgState.viewWindow.startTime,
            timeEndMs: epgState.viewWindow.endTime,
        };
        const reason = options?.reason ?? 'manual';
        if (options?.debounceMs !== undefined) {
            if (!options.operationContext) {
                return this.refreshEpgSchedulesForRange(range, { reason, debounceMs: options.debounceMs, signal });
            }
            return this.refreshEpgSchedulesForRange(range, {
                reason,
                debounceMs: options.debounceMs,
                ...(signal ? { signal } : {}),
                ...(options.operationContext ? { operationContext: options.operationContext } : {}),
            });
        }
        return this._refreshEpgSchedulesForRange(range, reason, {
            ...(signal ? { signal } : {}),
            ...(options?.operationContext ? { operationContext: options.operationContext } : {}),
        });
    }

    async refreshEpgSchedulesForRange(
        range: {
            channelStart: number;
            channelEndExclusive: number;
            timeStartMs: number;
            timeEndMs: number;
        },
        options?: EpgScheduleRefreshOptions
    ): Promise<EpgScheduleRefreshResult> {
        return this._visibleRangeRefreshQueue.request(range, options);
    }

    async refreshEpgSchedulesForRangeNow(
        range: { channelStart: number; channelEndExclusive: number; timeStartMs: number; timeEndMs: number },
        reason: string,
        signal?: AbortSignal | null
    ): Promise<EpgScheduleRefreshResult> {
        return this._refreshEpgSchedulesForRange(range, reason, signal ? { signal } : undefined);
    }

    private _resolveLiveSchedulerRow(options?: {
        epgOverride?: IEPGComponent | undefined;
        requireVisible?: boolean;
    }): {
        epg: IEPGComponent;
        current: SchedulerChannelConfig;
        range: { startTime: number; endTime: number };
        schedule: SchedulerScheduleWindow;
    } | null {
        const epg = options?.epgOverride ?? this._deps.getEpg();
        const channelManager = this._deps.getChannelManager();
        const scheduler = this._deps.getScheduler();
        if (!epg || !channelManager || !scheduler) return null;
        if (this._deps.getEpgUiStatus() !== 'ready') return null;
        if (options?.requireVisible !== false && !epg.isVisible()) return null;

        const range = this._getEpgScheduleRangeMs();
        if (!range) return null;

        const current = channelManager.getCurrentChannel();
        if (!current) return null;

        const all = channelManager.getAllChannels();
        const { selectedId, shouldFilter } = this._readAppliedLibraryFilterState(all);
        const visible = selectVisibleChannelsForLibraryFilter(all, selectedId, shouldFilter);
        if (!visible.some((channel) => channel.id === current.id)) return null;

        const state = scheduler.getState();
        if (!state.isActive || state.channelId !== current.id) {
            return null;
        }

        const window = scheduler.getScheduleWindow(range.startTime, range.endTime);
        return {
            epg,
            current,
            range,
            schedule: this._cloneScheduleWindow(window),
        };
    }

    refreshEpgScheduleForLiveChannel(): void {
        try {
            const liveRow = this._resolveLiveSchedulerRow();
            if (!liveRow) {
                return;
            }

            const { epg, current, schedule } = liveRow;
            const now = Date.now();
            const currentProgram =
                schedule.programs.find((program) => now >= program.scheduledStartTime && now < program.scheduledEndTime) ??
                null;
            this._deps.appendIssueDiagnostic(QA_003B_ISSUE_ID, 'epg.liveRowOverwrite', {
                source: 'live-scheduler',
                hasCurrentProgram: currentProgram !== null,
                programCount: schedule.programs.length,
            });
            epg.loadScheduleForChannel(current.id, toEpgScheduleWindow(schedule));
        } catch {
            if (this._isDebugEnabled()) {
                this._appendDebugLog('EPG.refreshEpgScheduleForLiveChannel.error', {
                    errorKind: 'non-abort',
                });
            }
        }
    }

    preseedCurrentChannelSchedule(epgOverride?: IEPGComponent): void {
        try {
            const liveRow = this._resolveLiveSchedulerRow({
                epgOverride,
                requireVisible: false,
            });
            if (!liveRow) {
                return;
            }

            liveRow.epg.loadScheduleForChannel(liveRow.current.id, toEpgScheduleWindow(liveRow.schedule));
        } catch {
            if (this._isDebugEnabled()) {
                this._appendDebugLog('EPG.preseedCurrentChannelSchedule.error', {
                    errorKind: 'non-abort',
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
    ): Promise<EpgGuideSelectionSnapshot | null> {
        const invalidation = this._scheduleRefreshRuntimeInvalidation;
        const runtime = await this._getScheduleRefreshRuntime();
        if (!runtime) {
            return null;
        }
        if (invalidation !== this._scheduleRefreshRuntimeInvalidation) {
            return null;
        }
        return runtime.buildGuideSelectionSnapshot(request, signal);
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
        this.cancelScheduledRefreshWork('library-filter');
        this.clearSelectedChannelScheduleSnapshot();
        this.clearLoadedScheduleMarkers();

        const epg = this._deps.getEpg();
        if (!epg) return;

        epg.clearSchedules();
        if (!epg.isVisible()) return;

        this._deps.primeEpgChannels();
        epg.scrollToChannel(0);
        epg.focusChannel(0);
        this.refreshEpgSchedulesBestEffort({ reason: 'library-filter', debounceMs: 0 });
    }

    private refreshEpgSchedulesBestEffort(options?: EpgScheduleRefreshOptions): void {
        void this.refreshEpgSchedules(options).catch((error: unknown) => {
            if (isAbortLikeError(error)) return;
            this._reportIssue('epg.refreshSchedulesBestEffortFailed', error, {
                reason: options?.reason ?? 'manual',
                debounceMs: options?.debounceMs ?? null,
            });
        });
    }

    private async _refreshEpgSchedulesForRange(
        range: { channelStart: number; channelEndExclusive: number; timeStartMs: number; timeEndMs: number },
        reason: string,
        options?: EpgRefreshInvocationOptions
    ): Promise<EpgScheduleRefreshResult> {
        const signal = options?.signal ?? null;
        const operationContext = options?.operationContext;
        operationContext?.assertCurrent();
        throwIfEpgRefreshAborted(signal);
        const invalidation = this._scheduleRefreshRuntimeInvalidation;
        const runtime = await this._getScheduleRefreshRuntime();
        operationContext?.assertCurrent();
        if (!runtime) {
            return createSkippedEpgScheduleRefreshResult();
        }
        throwIfEpgRefreshAborted(signal);
        if (invalidation !== this._scheduleRefreshRuntimeInvalidation) {
            return createSkippedEpgScheduleRefreshResult();
        }
        const runtimeOptions = {
            ...(signal ? { signal } : {}),
            ...(operationContext ? { operationContext } : {}),
        };
        return signal || operationContext
            ? runtime.refreshForRange(range, reason, runtimeOptions)
            : runtime.refreshForRange(range, reason);
    }
}
