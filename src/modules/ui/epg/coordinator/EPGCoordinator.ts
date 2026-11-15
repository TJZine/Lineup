import type { IEPGComponent } from '../interfaces';
import type { ChannelConfig as EpgChannel, EPGConfig, EpgVisibleRange, ScheduledProgram as EpgScheduledProgram } from '../types';
import type { GuideSettingChange } from '../../settings/types';
import type { ChannelSwitchOutcome } from '../../../../types/channelSwitch';
import { isChannelSwitchFailed } from '../../../../types/channelSwitch';
import type { IChannelManager, ChannelConfig as SchedulerChannelConfig, ResolvedChannelContent } from '../../../scheduler/channel-manager';
import type {
    IChannelScheduler,
    ScheduleConfig,
} from '../../../scheduler/scheduler';
import { buildScheduledProgramIdentity } from '../../../scheduler/scheduler';
import type { ScheduledProgram as SchedulerScheduledProgram } from '../../../scheduler/scheduler';
import type { AppendIssueDiagnostic } from '../../../debug/IssueDiagnosticsStore';
import { EpgPreferencesStore } from '../../../settings/EpgPreferencesStore';
import { isAbortLikeError } from '../../../../utils/errors';
import {
    computeNormalizedLibraryFilterState,
    selectVisibleChannelsForLibraryFilter,
} from './EPGCoordinatorPolicies';
import { reportLibraryFilterPersistenceResult } from './EPGLibraryFilterPersistenceDiagnostics';
import { EPGRefreshController } from './EPGRefreshController';
import type { IEPGDebugRuntime } from '../debug/EPGDebugRuntime';
import type {
    EpgChannelSwitchOptions,
    EpgGuideSelectionSnapshot,
    EpgScheduleRefreshOptions,
    EpgScheduleRefreshResult,
    EpgUiStatus,
} from './EPGCoordinatorContracts';
import {
    createEpgChannelPrimePublication,
    EPGChannelPrimePublisher,
} from './EPGChannelPrimePublisher';
import {
    createEpgRetainedOperationContext,
    type EpgRetainedOperationContext,
} from '../runtime/EPGRetainedOperationContext';

export interface EPGCoordinatorDeps {
    getEpg: () => IEPGComponent | null;
    getChannelManager: () => IChannelManager | null;
    getScheduler: () => IChannelScheduler | null;

    getEpgUiStatus: () => EpgUiStatus;
    canOpenEpg: () => boolean;
    ensureEpgInitialized: () => Promise<void>;

    getEpgConfig: () => EPGConfig | null;
    getLocalMidnightMs: (timeMs: number) => number;
    debugRuntime?: IEPGDebugRuntime | null;

    buildDailyScheduleConfig: (
        channel: SchedulerChannelConfig,
        items: ResolvedChannelContent['items'],
        referenceTimeMs: number
    ) => ScheduleConfig;

    getPreserveFocusOnOpen: () => boolean;

    setLastChannelChangeSourceToGuide: () => void;
    switchToChannel: (
        channelId: string,
        options?: EpgChannelSwitchOptions
    ) => Promise<ChannelSwitchOutcome>;
    onVisibilityChange?: (visible: boolean) => void;
    navigateFromGuide: (route: 'player' | 'settings' | 'channels' | 'channel-setup' | 'server-select') => void;
    reportEpgInitWarning: (error: unknown) => void;
    epgPreferencesStore: EpgPreferencesStore;
    appendIssueDiagnostic: AppendIssueDiagnostic;
}

const QA_003B_ISSUE_ID = 'QA-003b';

export class EPGCoordinator {
    private readonly _epgPreferencesStore: EpgPreferencesStore;
    private readonly _refreshController: EPGRefreshController;
    private readonly _primePublisher: EPGChannelPrimePublisher;
    private _openRequestId = 0;
    private _lastReportedVisibility: boolean | null = null;
    private _guideSelectionRequestId = 0;
    private _guideSelectionController: AbortController | null = null;

    constructor(private readonly deps: EPGCoordinatorDeps) {
        this._epgPreferencesStore = deps.epgPreferencesStore;
        this._primePublisher = new EPGChannelPrimePublisher(() => this.deps.getEpg());
        this._refreshController = new EPGRefreshController({
            getEpg: (): IEPGComponent | null => this.deps.getEpg(),
            getChannelManager: (): IChannelManager | null => this.deps.getChannelManager(),
            getScheduler: (): IChannelScheduler | null => this.deps.getScheduler(),
            getEpgUiStatus: (): EpgUiStatus => this.deps.getEpgUiStatus(),
            getEpgConfig: (): EPGConfig | null => this.deps.getEpgConfig(),
            getLocalMidnightMs: (timeMs: number): number => this.deps.getLocalMidnightMs(timeMs),
            debugRuntime: this.deps.debugRuntime ?? null,
            buildDailyScheduleConfig: (
                channel: SchedulerChannelConfig,
                items: ResolvedChannelContent['items'],
                referenceTimeMs: number
            ): ScheduleConfig => this.deps.buildDailyScheduleConfig(channel, items, referenceTimeMs),
            epgPreferencesStore: this._epgPreferencesStore,
            primeEpgChannels: (operationContext?: EpgRetainedOperationContext): void =>
                this.primeEpgChannels(operationContext),
            appendIssueDiagnostic: (issue: string, event: string, data: unknown): void =>
                this.deps.appendIssueDiagnostic(issue, event, data),
        });
    }

    private _reportIssue(
        event: string,
        _error: unknown,
        payload: Record<string, unknown> = {}
    ): void {
        this.deps.appendIssueDiagnostic(QA_003B_ISSUE_ID, event, {
            ...payload,
            errorKind: 'non-abort',
        });
    }

    private _refreshEpgSchedulesBestEffort(options?: EpgScheduleRefreshOptions): void {
        void this.refreshEpgSchedules(options).catch((error: unknown) => {
            if (isAbortLikeError(error)) return;
            this._reportIssue('epg.refreshSchedulesBestEffortFailed', error, {
                reason: options?.reason ?? 'manual',
                debounceMs: options?.debounceMs ?? null,
            });
        });
    }

    private _refreshEpgSchedulesForRangeBestEffort(
        range: EpgVisibleRange,
        options?: EpgScheduleRefreshOptions
    ): void {
        void this.refreshEpgSchedulesForRange(range, options).catch((error: unknown) => {
            if (isAbortLikeError(error)) return;
            this._reportIssue('epg.refreshSchedulesForRangeBestEffortFailed', error, {
                reason: options?.reason ?? 'manual',
                debounceMs: options?.debounceMs ?? null,
                range,
            });
        });
    }

    /**
     * Clear schedule caches and "loaded range" markers.
     * Use this when the UI schedules are cleared (e.g. after library filter changes)
     * to avoid cache/UI mismatches where the coordinator believes data is loaded.
     */
    clearScheduleCaches(): void {
        this._refreshController.clearScheduleCaches();
    }

    clearSelectedChannelScheduleSnapshot(): void {
        this._refreshController.clearSelectedChannelScheduleSnapshot();
    }

    dispose(reason = 'shutdown'): void {
        this._openRequestId += 1;
        this._invalidateGuideSelection(reason);
        this._refreshController.dispose(reason);
        this._lastReportedVisibility = null;
    }

    handleVisibleRangeChange(range: EpgVisibleRange): void {
        const epg = this.deps.getEpg();
        if (!epg || !epg.isVisible()) {
            return;
        }
        this._refreshEpgSchedulesForRangeBestEffort(range, { reason: 'visible-range' });
    }

    handleGuideSettingChange(change: GuideSettingChange): void {
        const epg = this.deps.getEpg();
        const shouldInvalidateSchedules =
            change.key === 'libraryTabs' ||
            change.key === 'guideHours' ||
            change.key === 'aggressivePreload' ||
            change.key === 'pastItemsWindow';
        if (shouldInvalidateSchedules) {
            this._invalidateGuideSelection('guide-settings');
            this._refreshController.handleGuideSettingRefreshChange(change);
            return;
        }
        if (!epg) return;

        if (!epg.isVisible()) return;

        if (change.key === 'sourceLabels') {
            epg.setSourceLabelsEnabled(change.enabled);
            return;
        }

        if (change.key === 'nowWatchingBanner') {
            epg.setNowWatchingBannerEnabled(change.enabled);
            return;
        }

        if (change.key === 'infoBackgroundMode') {
            return;
        }
    }

    private _getBaseVisibleHours(): number {
        const result = this._epgPreferencesStore.readGuideHoursAndMigrate();
        return result.ok ? result.value : result.effectiveValue;
    }

    openEPG(): void {
        if (!this.deps.canOpenEpg()) return;
        const initialEpg = this.deps.getEpg();
        if (!initialEpg) return;
        if (initialEpg.isVisible()) return;
        const requestId = ++this._openRequestId;
        const status = this.deps.getEpgUiStatus();

        const isCurrentDeferredOpen = (): boolean =>
            requestId === this._openRequestId &&
            this.deps.canOpenEpg();

        const canPublishDeferredOpen = (): boolean =>
            isCurrentDeferredOpen() &&
            initialEpg.isVisible();

        const showAndRefresh = (
            epgInstance: IEPGComponent,
            options?: { skipRefocus?: boolean }
        ): void => {
            this._refreshController.preseedCurrentChannelSchedule(epgInstance);
            const preserveFocus = this.deps.getPreserveFocusOnOpen();
            epgInstance.show({ preserveFocus });
            this._reportVisibilityIfChanged(epgInstance);
            if (!preserveFocus && !options?.skipRefocus) {
                this._focusEpgOnCurrentChannel(epgInstance);
                epgInstance.focusNow();
            }
            this._refreshEpgSchedulesBestEffort({ debounceMs: 0 });
        };

        if (status === 'ready') {
            this.primeEpgChannels();
            showAndRefresh(initialEpg);
            return;
        }

        const preserveFocus = this.deps.getPreserveFocusOnOpen();
        this._refreshController.preseedCurrentChannelSchedule(initialEpg);
        initialEpg.show({ preserveFocus });
        this._reportVisibilityIfChanged(initialEpg);
        if (!preserveFocus) {
            this._focusEpgOnCurrentChannel(initialEpg);
            initialEpg.focusNow();
        }
        void this.deps.ensureEpgInitialized()
            .then(() => {
                if (!canPublishDeferredOpen()) {
                    return;
                }
                const epgAfterInit = this.deps.getEpg();
                if (!epgAfterInit) {
                    return;
                }
                this.primeEpgChannels();
                showAndRefresh(epgAfterInit, { skipRefocus: true });
            })
            .catch((error: unknown) => {
                if (!isCurrentDeferredOpen()) {
                    return;
                }
                this._reportIssue('epg.initFailed', error, {
                    requestId,
                });
                const epgForRollback = this.deps.getEpg();
                epgForRollback?.hide();
                this._reportVisibilityIfChanged(epgForRollback);
                this.deps.reportEpgInitWarning(error);
            });
    }

    closeEPG(): void {
        this._closeEpg(true);
    }

    private _closeEpg(invalidateGuideSelection: boolean): void {
        this._openRequestId++;
        if (invalidateGuideSelection) {
            this._invalidateGuideSelection('close-epg');
        }
        this._refreshController.cancelScheduledRefreshWork('close-epg');
        const epg = this.deps.getEpg();
        epg?.hide();
        this._reportVisibilityIfChanged(epg);
    }

    toggleEPG(): void {
        this.openEPG();
    }

    primeEpgChannels(operationContext?: EpgRetainedOperationContext): void {
        const epg = this.deps.getEpg();
        const channelManager = this.deps.getChannelManager();
        if (!epg || !channelManager) return;
        if (this.deps.getEpgUiStatus() !== 'ready') return;
        const operation = operationContext?.retain('prime-epg-channels')
            ?? createEpgRetainedOperationContext([{ assertCurrent: (): void => undefined }]);
        try {
            operation.assertCurrent();
            const publication = createEpgChannelPrimePublication({
                channelManager,
                preferencesStore: this._epgPreferencesStore,
                appendIssueDiagnostic: this.deps.appendIssueDiagnostic,
                getVisibleHours: (): number => this._getBaseVisibleHours(),
            });
            this._primePublisher.publish(publication, operation);
        } finally {
            operation.release();
        }
    }

    async refreshEpgSchedules(options?: EpgScheduleRefreshOptions): Promise<EpgScheduleRefreshResult> {
        return this._refreshController.refreshEpgSchedules(options);
    }

    retryRowSchedule(channelId: string): void {
        void this._refreshController.retryRowSchedule(channelId).catch((error: unknown) => {
            if (isAbortLikeError(error)) return;
            this._reportIssue('epg.retryRowScheduleFailed', error, {});
        });
    }

    async warmCurrentViewportForStartup(options?: {
        signal?: AbortSignal | null;
        shouldContinue?: () => boolean;
    }): Promise<void> {
        await this._refreshController.warmCurrentViewportForStartup(options);
    }

    refreshEpgScheduleForLiveChannel(): void {
        this._refreshController.refreshEpgScheduleForLiveChannel();
    }

    async refreshEpgSchedulesForRange(range: {
        channelStart: number;
        channelEndExclusive: number;
        timeStartMs: number;
        timeEndMs: number;
    }, options?: EpgScheduleRefreshOptions): Promise<EpgScheduleRefreshResult> {
        return this._refreshController.refreshEpgSchedulesForRange(range, options);
    }

    wireEpgEvents(): Array<() => void> {
        const epg = this.deps.getEpg();
        if (!epg) return [];

        const handler = (payload: { channel: EpgChannel; program: EpgScheduledProgram }): void => {
            const now = Date.now();
            if (
                payload.program.scheduleIndex === -1 ||
                payload.program.item.ratingKey.includes('-placeholder-')
            ) {
                return;
            }
            const { scheduledStartTime, scheduledEndTime } = payload.program;
            if (!Number.isFinite(scheduledStartTime) || !Number.isFinite(scheduledEndTime)) {
                return;
            }
            if (scheduledStartTime >= scheduledEndTime) {
                return;
            }
            if (now < scheduledStartTime || now >= scheduledEndTime) {
                return;
            }
            this.deps.appendIssueDiagnostic(QA_003B_ISSUE_ID, 'epg.channelSelected', {
                scheduledStartTime,
                scheduledEndTime,
                scheduleIndex: payload.program.scheduleIndex,
                selectedAt: now,
            });
            this.deps.setLastChannelChangeSourceToGuide();
            void this._switchToGuideSelectedChannel(payload.channel.id, payload.program, now).catch((error: unknown) => {
                if (isAbortLikeError(error)) return;
                this._reportIssue('epg.switchToChannelFailed', error, {
                    selectedAt: now,
                });
            });
        };
        epg.on('channelSelected', handler);

        const onFilter = (payload: { libraryId: string | null }): void => {
            reportLibraryFilterPersistenceResult(this.deps.appendIssueDiagnostic, this._epgPreferencesStore.writeSelectedLibraryId(payload.libraryId ?? null), payload.libraryId ?? null);

            this._invalidateGuideSelection('library-filter');
            this._refreshController.handleLibraryFilterRefreshChange();
        };

        epg.on('libraryFilterChanged', onFilter);
        const onOpen = (): void => {
            this._reportVisibilityIfChanged(epg);
        };
        const onClose = (): void => {
            this._reportVisibilityIfChanged(epg);
        };
        epg.on('open', onOpen);
        epg.on('close', onClose);
        const onRowRetry = (payload: { channelId: string }): void => {
            this.retryRowSchedule(payload.channelId);
        };
        epg.on('rowRetryRequested', onRowRetry);
        const onMenuRoute = (route: 'player' | 'settings' | 'channels' | 'channel-setup' | 'server-select'): void => {
            this.deps.navigateFromGuide(route);
        };
        const onSetup = (): void => this.deps.navigateFromGuide('channel-setup');
        epg.on('menuRouteRequested', onMenuRoute);
        epg.on('setupRequested', onSetup);

        return [
            (): void => {
                epg.off('channelSelected', handler);
            },
            (): void => {
                epg.off('libraryFilterChanged', onFilter);
            },
            (): void => {
                epg.off('open', onOpen);
            },
            (): void => {
                epg.off('close', onClose);
            },
            (): void => {
                epg.off('rowRetryRequested', onRowRetry);
            },
            (): void => {
                epg.off('menuRouteRequested', onMenuRoute);
                epg.off('setupRequested', onSetup);
            },
        ];
    }

    private _reportVisibilityIfChanged(epgOverride?: IEPGComponent | null): void {
        const readVisibility = (epg: IEPGComponent | null | undefined): boolean | null =>
            typeof epg?.isVisible === 'function' ? epg.isVisible() : null;
        const visible = readVisibility(epgOverride) ?? readVisibility(this.deps.getEpg()) ?? false;
        if (this._lastReportedVisibility === visible) {
            return;
        }
        this._lastReportedVisibility = visible;
        this.deps.onVisibilityChange?.(visible);
    }

    focusEpgOnCurrentChannel(): void {
        this._focusEpgOnCurrentChannel();
    }

    openLineupMenu(): void {
        this.deps.getEpg()?.openLineupMenu();
    }

    private _focusEpgOnCurrentChannel(epgOverride?: IEPGComponent): void {
        const epg = epgOverride ?? this.deps.getEpg();
        const channelManager = this.deps.getChannelManager();
        if (!epg || !channelManager) return;
        const current = channelManager.getCurrentChannel();
        if (!current) return;
        const all = channelManager.getAllChannels();
        const { selectedId, shouldFilter, shouldClearPersistedSelection } = computeNormalizedLibraryFilterState(
            all,
            this._epgPreferencesStore.readScheduleRangeSnapshotAndClean()
        );
        if (shouldClearPersistedSelection) {
            reportLibraryFilterPersistenceResult(this.deps.appendIssueDiagnostic, this._epgPreferencesStore.writeSelectedLibraryId(null), null, 'focus-current-channel');
        }
        const channels = selectVisibleChannelsForLibraryFilter(all, selectedId, shouldFilter);
        const index = channels.findIndex((channel) => channel.id === current.id);
        if (index >= 0) {
            epg.focusChannel(index);
        }
    }

    private _invalidateGuideSelection(reason: string): void {
        this._guideSelectionRequestId += 1;
        this._guideSelectionController?.abort(reason);
        this._guideSelectionController = null;
    }

    private _startGuideSelectionRequest(): { requestId: number; controller: AbortController } {
        this._invalidateGuideSelection('new-guide-selection');
        const controller = new AbortController();
        this._guideSelectionController = controller;
        return {
            requestId: this._guideSelectionRequestId,
            controller,
        };
    }

    private async _switchToGuideSelectedChannel(
        channelId: string,
        program: EpgScheduledProgram,
        selectedAt: number
    ): Promise<void> {
        const { requestId, controller } = this._startGuideSelectionRequest();
        let snapshot: EpgGuideSelectionSnapshot | null = null;
        try {
            snapshot = await this._refreshController.buildGuideSelectionSnapshot({
                channelId,
                ratingKey: program.item.ratingKey,
                scheduledStartTime: program.scheduledStartTime,
                scheduledEndTime: program.scheduledEndTime,
                selectedAt,
            }, controller.signal);
        } catch (error: unknown) {
            if (isAbortLikeError(error, controller.signal)) {
                return;
            }
            this._reportIssue('epg.guideSnapshotBuildFailed', error, {
                selectedAt,
            });
        }
        if (controller.signal.aborted || requestId !== this._guideSelectionRequestId) {
            if (this._guideSelectionController === controller) this._guideSelectionController = null;
            return;
        }
        // EPG widens media item.type for display; the scheduler identity reads only the stable schedule fields.
        const selectedProgram = buildScheduledProgramIdentity(channelId, program as SchedulerScheduledProgram);
        if (!selectedProgram) {
            this._reportIssue('epg.guideSelectionInvalid', new Error('Selected Guide program has no identity'), {
                selectedAt,
            });
            if (this._guideSelectionController === controller) this._guideSelectionController = null;
            return;
        }
        let outcome: ChannelSwitchOutcome;
        try {
            outcome = await this.deps.switchToChannel(channelId, {
                fromGuideSelection: true,
                signal: controller.signal,
                selectedProgram,
                ...(snapshot ? { guideSelectionSnapshot: snapshot } : {}),
            });
        } finally {
            if (this._guideSelectionController === controller) this._guideSelectionController = null;
        }
        if (controller.signal.aborted || requestId !== this._guideSelectionRequestId) return;
        if (isChannelSwitchFailed(outcome)) {
            this._reportIssue('epg.switchToChannelFailed', new Error('Guide channel switch failed'), {
                selectedAt,
                reason: outcome.reason,
            });
        }
    }
}
