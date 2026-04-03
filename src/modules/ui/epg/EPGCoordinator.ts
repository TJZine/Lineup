/**
 * @fileoverview Coordinates EPG state, schedule loading, and overlay lifecycle.
 * @module modules/ui/epg/EPGCoordinator
 * @version 1.0.0
 */

import type { EpgGuideDensity } from '../../settings/EpgPreferencesStore';
import type { IEPGComponent } from './interfaces';
import type { ChannelConfig as EpgChannel, EPGConfig, EpgVisibleRange, ScheduledProgram as EpgScheduledProgram } from './types';
import type { GuideSettingChange } from '../settings/types';
import type { IChannelManager, ChannelConfig as SchedulerChannelConfig, ResolvedChannelContent } from '../../scheduler/channel-manager';
import type {
    IChannelScheduler,
    ScheduleConfig,
} from '../../scheduler/scheduler';
import { IssueDiagnosticsStore } from '../../debug/IssueDiagnosticsStore';
import { EpgPreferencesStore } from '../../settings/EpgPreferencesStore';
import { isAbortLikeError, summarizeErrorForLog } from '../../../utils/errors';
import {
    readAppliedLibraryFilterState,
    selectVisibleChannelsForLibraryFilter,
} from './EPGCoordinatorPolicies';
import { countLibraryTypeVotes } from './epgLibraryUtils';
import { EPGRefreshController } from './EPGRefreshController';
import { toEpgChannels } from './model/adapters';
import type { ChannelSwitchOptions, GuideSelectionSnapshot } from '../../../core/channel-tuning';
import type { IEpgDebugRuntime } from './EPGDebugRuntime';
import type { EpgUiStatus } from './types';

type EpgChannelSwitchOptions = Pick<ChannelSwitchOptions, 'guideSelectionSnapshot'>;

export interface EPGCoordinatorDeps {
    getEpg: () => IEPGComponent | null;
    getChannelManager: () => IChannelManager | null;
    getScheduler: () => IChannelScheduler | null;

    getEpgUiStatus: () => EpgUiStatus;
    ensureEpgInitialized: () => Promise<void>;

    getEpgConfig: () => EPGConfig | null;
    getLocalMidnightMs: (timeMs: number) => number;
    debugRuntime?: IEpgDebugRuntime | null;

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
    ) => Promise<void>;
    onVisibilityChange?: (visible: boolean) => void;
    reportEpgInitWarning: (error: unknown) => void;
    epgPreferencesStore: EpgPreferencesStore;
}

const DEFAULT_GUIDE_DENSITY: EpgGuideDensity = 'detailed';
const DETAILED_VISIBLE_HOURS = 2;
const WIDE_VISIBLE_HOURS = 3;
const QA_003B_ISSUE_ID = 'QA-003b';
const issueDiagnosticsStore = new IssueDiagnosticsStore();

export class EPGCoordinator {
    private readonly _epgPreferencesStore: EpgPreferencesStore;
    private readonly _refreshController: EPGRefreshController;
    private _openRequestId = 0;
    private _lastReportedVisibility: boolean | null = null;
    private _guideSelectionRequestId = 0;
    private _guideSelectionController: AbortController | null = null;

    constructor(private readonly deps: EPGCoordinatorDeps) {
        this._epgPreferencesStore = deps.epgPreferencesStore;
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
            primeEpgChannels: (): void => this.primeEpgChannels(),
        });
    }

    private _refreshEpgSchedulesBestEffort(options?: { reason?: string; debounceMs?: number }): void {
        void this.refreshEpgSchedules(options).catch((error: unknown) => {
            if (isAbortLikeError(error)) return;
            console.error('[EPGCoordinator] refreshEpgSchedules failed:', summarizeErrorForLog(error));
        });
    }

    private _refreshEpgSchedulesForRangeBestEffort(
        range: EpgVisibleRange,
        options?: { reason?: string; debounceMs?: number }
    ): void {
        void this.refreshEpgSchedulesForRange(range, options).catch((error: unknown) => {
            if (isAbortLikeError(error)) return;
            console.error('[EPGCoordinator] refreshEpgSchedulesForRange failed:', summarizeErrorForLog(error));
        });
    }

    /**
     * Clear schedule caches and "loaded range" markers.
     * Use this when the UI schedules are cleared (e.g. after library filter changes)
     * to avoid cache/UI mismatches where the coordinator believes data is loaded.
     */
    clearScheduleCaches(): void {
        this._refreshController.clearScheduleCaches();
        this._refreshController.clearLoadedScheduleMarkers();
    }

    clearSelectedChannelScheduleSnapshot(): void {
        this._refreshController.clearSelectedChannelScheduleSnapshot();
    }

    handleVisibleRangeChange(range: EpgVisibleRange): void {
        this._refreshEpgSchedulesForRangeBestEffort(range, { reason: 'visible-range' });
    }

    handleGuideSettingChange(change: GuideSettingChange): void {
        const epg = this.deps.getEpg();
        const shouldInvalidateSchedules =
            change.key === 'libraryTabs' ||
            change.key === 'guideDensity' ||
            change.key === 'aggressivePreload' ||
            change.key === 'pastItemsWindow';
        if (shouldInvalidateSchedules) {
            this._invalidateGuideSelection('guide-settings');
            this._refreshController.handleGuideSettingRefreshChange(change);
            return;
        }
        if (!epg) return;

        if (!epg.isVisible()) return;

        if (change.key === 'layoutMode') {
            epg.setLayoutMode(change.mode);
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

    private _readGuideDensity(): EpgGuideDensity {
        return this._epgPreferencesStore.readGuideDensity(DEFAULT_GUIDE_DENSITY);
    }

    private _getBaseVisibleHours(): number {
        return this._readGuideDensity() === 'wide' ? WIDE_VISIBLE_HOURS : DETAILED_VISIBLE_HOURS;
    }

    private _inferLibraryType(
        channels: SchedulerChannelConfig[],
        selectedId: string
    ): 'movie' | 'show' | null {
        const { movieVotes, showVotes } = countLibraryTypeVotes(channels, selectedId);

        if (movieVotes === 0 && showVotes === 0) {
            return null;
        }
        if (movieVotes === showVotes) {
            return null;
        }
        return movieVotes > showVotes ? 'movie' : 'show';
    }

    private _getVisibleHoursForCurrentFilter(
        channels: SchedulerChannelConfig[],
        selectedId: string | null,
        shouldFilter: boolean
    ): number {
        if (!shouldFilter || !selectedId) {
            return this._getBaseVisibleHours();
        }

        const libraryType = this._inferLibraryType(channels, selectedId);
        if (libraryType === 'movie') {
            return WIDE_VISIBLE_HOURS;
        }
        if (libraryType === 'show') {
            return DETAILED_VISIBLE_HOURS;
        }
        return this._getBaseVisibleHours();
    }

    openEPG(): void {
        const initialEpg = this.deps.getEpg();
        if (!initialEpg) return;
        const requestId = ++this._openRequestId;
        const status = this.deps.getEpgUiStatus();

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
                if (requestId !== this._openRequestId) {
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
                if (requestId !== this._openRequestId) {
                    return;
                }
                console.error('[EPGCoordinator] Failed to init EPG:', summarizeErrorForLog(error));
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
        const epg = this.deps.getEpg();
        if (!epg) return;
        if (epg.isVisible()) {
            this.closeEPG();
        } else {
            this.openEPG();
        }
    }

    primeEpgChannels(): void {
        const epg = this.deps.getEpg();
        const channelManager = this.deps.getChannelManager();
        if (!epg || !channelManager) return;
        if (this.deps.getEpgUiStatus() !== 'ready') return;
        const all = channelManager.getAllChannels();
        const { selectedId, tabsEnabled, shouldFilter, libraries } = readAppliedLibraryFilterState(
            all,
            this._epgPreferencesStore
        );

        // Category colors
        const categoryColorsEnabled = this._epgPreferencesStore.readGuideCategoryColorsEnabled(true);
        epg.setCategoryColorsEnabled(categoryColorsEnabled);

        // Tabs (only show if enabled; EPGComponent will hide if <=1 library)
        if (tabsEnabled) {
            epg.setLibraryTabs(libraries, selectedId);
        } else {
            epg.setLibraryTabs([], null);
        }

        const layoutMode = this._epgPreferencesStore.readLayoutMode('classic');
        const nowWatchingEnabled = this._epgPreferencesStore.readNowWatchingEnabled(true);
        epg.setLayoutMode(layoutMode);
        epg.setNowWatchingBannerEnabled(nowWatchingEnabled);
        epg.setVisibleHours(this._getVisibleHoursForCurrentFilter(all, selectedId, shouldFilter));

        const visible = selectVisibleChannelsForLibraryFilter(all, selectedId, shouldFilter);
        epg.loadChannels(toEpgChannels(visible));
    }

    async refreshEpgSchedules(options?: { reason?: string; debounceMs?: number }): Promise<void> {
        const epg = this.deps.getEpg();
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

    refreshEpgScheduleForLiveChannel(): void {
        this._refreshController.refreshEpgScheduleForLiveChannel();
    }

    async refreshEpgSchedulesForRange(range: {
        channelStart: number;
        channelEnd: number;
        timeStartMs: number;
        timeEndMs: number;
    }, options?: { reason?: string; debounceMs?: number }): Promise<void> {
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
            issueDiagnosticsStore.append(QA_003B_ISSUE_ID, 'epg.channelSelected', {
                channelId: payload.channel.id,
                ratingKey: payload.program.item.ratingKey,
                scheduledStartTime,
                scheduledEndTime,
                scheduleIndex: payload.program.scheduleIndex,
                selectedAt: now,
            });
            this.deps.setLastChannelChangeSourceToGuide();
            void this._switchToGuideSelectedChannel(payload.channel.id, payload.program, now).catch((error: unknown) => {
                if (isAbortLikeError(error)) return;
                console.error('[EPG] switchToChannel failed:', summarizeErrorForLog(error));
            });
        };
        epg.on('channelSelected', handler);

        const onFilter = (payload: { libraryId: string | null }): void => {
            this._epgPreferencesStore.writeSelectedLibraryId(payload.libraryId ?? null);

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

    private async _refreshEpgSchedulesForRange(
        range: { channelStart: number; channelEnd: number; timeStartMs: number; timeEndMs: number },
        reason: string
    ): Promise<void> {
        await this._refreshController.refreshEpgSchedulesForRangeNow(range, reason);
    }

    private _focusEpgOnCurrentChannel(epgOverride?: IEPGComponent): void {
        const epg = epgOverride ?? this.deps.getEpg();
        const channelManager = this.deps.getChannelManager();
        if (!epg || !channelManager) return;
        const current = channelManager.getCurrentChannel();
        if (!current) return;
        const all = channelManager.getAllChannels();
        const { selectedId, shouldFilter } = readAppliedLibraryFilterState(all, this._epgPreferencesStore);
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
        let snapshot: GuideSelectionSnapshot | null = null;
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
            issueDiagnosticsStore.append(QA_003B_ISSUE_ID, 'epg.guideSnapshotBuildFailed', {
                channelId,
                ratingKey: program.item.ratingKey,
                selectedAt,
                safeError: summarizeErrorForLog(error),
            });
        } finally {
            if (this._guideSelectionController === controller) {
                this._guideSelectionController = null;
            }
        }
        if (controller.signal.aborted || requestId !== this._guideSelectionRequestId) {
            return;
        }
        this._closeEpg(false);
        await this.deps.switchToChannel(channelId, snapshot ? { guideSelectionSnapshot: snapshot } : undefined);
    }
}
