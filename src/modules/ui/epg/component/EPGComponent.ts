import '../styles.css';

import { EventEmitter } from '../../../../utils/EventEmitter';
import type { IDisposable } from '../../../../utils/interfaces';
import { EPG_CLASSES, EPG_ERRORS, DEFAULT_EPG_CONFIG } from '../constants';
import { EPGChannelList } from '../view/EPGChannelList';
import { EPGErrorBoundary } from '../view/EPGErrorBoundary';
import { EPGInfoPanel } from '../view/info-panel/EPGInfoPanel';
import { EPGInfoPanelCoordinator } from '../view/info-panel/EPGInfoPanelCoordinator';
import { EPGLibraryTabs } from '../view/EPGLibraryTabs';
import { EPGGuideToolbar, type GuideToolbarAction } from '../view/EPGGuideToolbar';
import { EPGShellView } from '../view/shell/EPGShellView';
import { EPGTimeHeader } from '../view/EPGTimeHeader';
import { EPGVirtualizer } from '../view/EPGVirtualizer';
import { appendDebugRuntimeLog, isDebugRuntimeEnabled } from '../debug/debugRuntimeGuards';
import { EPGFocusNavigator } from '../focus/EPGFocusNavigator';
import { EPGGridRuntimeController } from '../runtime/EPGGridRuntimeController';
import type { EPGShellElements } from '../view/shell/EPGShellView';
import type { IEPGComponent } from '../interfaces';
import type {
    EPGConfig,
    EPGState,
    EPGEventMap,
    EPGInternalState,
    EPGFocusPosition,
    EpgRowLifecycleState,
    EpgHeldScheduleSnapshot,
    EpgScheduleLoadMetadata,
    ScheduledProgram,
    ScheduleWindow,
    ChannelConfig,
} from '../types';
import { isMatchingEpgChannelSnapshot } from '../types';

/**
 * Render/focus/event surface for the Electronic Program Guide grid.
 * Implements virtualized rendering for 60fps performance on TV hardware.
 */
export class EPGComponent extends EventEmitter<EPGEventMap> implements IEPGComponent {
    private config: EPGConfig = { ...DEFAULT_EPG_CONFIG };

    private state: EPGInternalState = {
        isInitialized: false,
        isVisible: false,
        channels: [],
        schedules: new Map(),
        scheduleLoadTimes: new Map(),
        rowLifecycle: new Map(),
        focusedCell: null,
        focusTimeMs: Date.now(),
        scrollPosition: { channelOffset: 0, timeOffset: 0 },
        currentTime: Date.now(),
        gridAnchorTime: 0,
        lastRenderTime: 0,
    };

    // Sub-components
    private virtualizer: EPGVirtualizer = new EPGVirtualizer();
    private infoPanel: EPGInfoPanel = new EPGInfoPanel();
    private infoPanelCoordinator: EPGInfoPanelCoordinator = new EPGInfoPanelCoordinator({
        infoPanel: this.infoPanel,
        isEpgVisible: () => this.state.isVisible,
        getFocusedProgram: () => this.getFocusedProgram(),
    });
    private timeHeader: EPGTimeHeader = new EPGTimeHeader();
    private channelList: EPGChannelList = new EPGChannelList();
    private errorBoundary: EPGErrorBoundary = new EPGErrorBoundary();
    private shellView: EPGShellView = new EPGShellView();
    private toolbar = new EPGGuideToolbar();
    private gridRuntime: EPGGridRuntimeController = new EPGGridRuntimeController({
        getConfig: () => this.config,
        getState: () => this.state,
        getProgramAreaElement: () => this.programAreaElement,
        getChannelIds: () => this.channelIds,
        getErrorBoundary: () => this.errorBoundary,
        getTimeHeader: () => this.timeHeader,
        getVirtualizer: () => this.virtualizer,
        getFocusKey: (focusedCell) => this._getFocusKey(focusedCell),
        setHasRenderedOnce: (hasRenderedOnce): void => {
            this.hasRenderedOnce = hasRenderedOnce;
        },
        updateNowWatchingBanner: () => this.updateNowWatchingBanner(),
        syncPicture: () => this.syncPicture(),
        appendDebugLog: (event, payload) => this._appendDebugLog(event, payload),
        isDebugEnabled: () => this._isDebugEnabled(),
    });
    private focusNavigator: EPGFocusNavigator = new EPGFocusNavigator({
        getConfig: () => this.config,
        getState: () => this.state,
        getChannelList: () => this.channelList,
        getTimeHeader: () => this.timeHeader,
        getVirtualizer: () => this.virtualizer,
        getLibraryTabs: () => this._libraryTabs,
        getIsLibraryTabsFocused: () => this._isLibraryTabsFocused,
        setIsLibraryTabsFocused: (focused): void => {
            this._isLibraryTabsFocused = focused;
            this.syncControlFocus();
        },
        renderGrid: () => this.renderGrid(),
        renderGridInternal: () => this.renderGridInternal(),
        hide: () => this.hide(),
        syncFocusedProgram: (program) => this.infoPanelCoordinator.syncFocusedProgram(program),
        clearInfoPanel: () => this.infoPanelCoordinator.clear(),
        emit: (event, payload) => this.emit(event, payload),
        appendDebugLog: (event, payload) => this._appendDebugLog(event, payload),
        isDebugEnabled: () => this._isDebugEnabled(),
    });

    // DOM elements
    private containerElement: HTMLElement | null = null;
    private classicShowcaseInfoElement: HTMLElement | null = null;
    private gridElement: HTMLElement | null = null;
    private toolbarElement: HTMLElement | null = null;
    private menuTrigger: HTMLButtonElement | null = null;
    private menuFocused = false;
    private menuOverlay: HTMLElement | null = null;
    private menuIndex = 0;
    private emptyState: HTMLElement | null = null;
    private programAreaElement: HTMLElement | null = null;
    private hasRenderedOnce: boolean = false;
    private channelIds: string[] = [];
    private scheduleSourceSnapshots = new Map<string, ChannelConfig>();
    private _libraryTabs: EPGLibraryTabs | null = null;
    private _isLibraryTabsFocused = false;
    private _pictureOperation: 'guide-pip' | 'fullscreen' = 'fullscreen';
    private pictureStatusSubscription: IDisposable | null = null;
    initialize(config: EPGConfig): void {
        if (this.state.isInitialized) {
            return;
        }

        this.config = { ...DEFAULT_EPG_CONFIG, ...config };
        this.gridRuntime.configure(this.config);
        this.state.currentTime = Date.now();
        this.state.gridAnchorTime = this.calculateGridAnchorTime(this.state.currentTime);
        this.state.focusTimeMs = this.state.currentTime;

        this.containerElement = document.getElementById(this.config.containerId);
        if (!this.containerElement) {
            throw new Error(EPG_ERRORS.CONTAINER_NOT_FOUND);
        }
        this.containerElement.style.setProperty('--epg-row-height', `${this.config.rowHeight}px`);

        this.createDOMStructure();
        if (this.toolbarElement && this.containerElement) {
            this.toolbar.initialize(this.toolbarElement, this.containerElement, {
                onFocus: () => this.claimControlFocus('toolbar'),
                onAction: (action) => this.handleToolbarAction(action),
                onPickChannel: (index) => {
                    this.clearControlFocus();
                    this.focusNavigator.scrollToChannel(index);
                    this.focusNavigator.focusChannel(index);
                },
            });
            this.toolbar.setHours(this.config.visibleHours);
        }
        this.menuTrigger?.addEventListener('click', () => this.openMenu());
        this.createEmptyState();
        this.pictureStatusSubscription = this.config.subscribePictureStatus?.(() => this.syncPicture()) ?? null;
        this.config.onPictureOperation?.('fullscreen');

        this.initializeViewChildren();

        this.gridRuntime.createTimeIndicator();

        this.initializeErrorBoundary();

        // Timer starts when shown, not at init (optimization)

        this.state.isInitialized = true;
    }

    private _isDebugEnabled(): boolean {
        return isDebugRuntimeEnabled(this.config.debugRuntime);
    }

    private _appendDebugLog(event: string, payload: Record<string, unknown>): void {
        appendDebugRuntimeLog(this.config.debugRuntime, event, payload);
    }

    destroy(): void {
        this.pictureStatusSubscription?.dispose();
        this.pictureStatusSubscription = null;
        this.infoPanelCoordinator.destroy();
        this.gridRuntime.destroy();

        this.virtualizer.destroy();
        this.infoPanel.destroy();
        this.timeHeader.destroy();
        this.channelList.destroy();
        this._libraryTabs?.destroy();
        this.toolbar.destroy();
        this.closeMenu();
        this._libraryTabs = null;
        this._isLibraryTabsFocused = false;

        if (this.containerElement) {
            this.containerElement.style.removeProperty('--epg-row-height');
            this.containerElement.replaceChildren();
            this.containerElement.classList.remove(EPG_CLASSES.CONTAINER_VISIBLE);

        }

        this.containerElement = null;
        this.classicShowcaseInfoElement = null;
        this.gridElement = null;
        this.toolbarElement = null;
        this.menuTrigger = null;
        this.menuFocused = false;
        this.emptyState = null;
        this.programAreaElement = null;

        this.state = {
            isInitialized: false,
            isVisible: false,
            channels: [],
            schedules: new Map(),
            scheduleLoadTimes: new Map(),
            rowLifecycle: new Map(),
            focusedCell: null,
            focusTimeMs: Date.now(),
            scrollPosition: { channelOffset: 0, timeOffset: 0 },
            currentTime: Date.now(),
            gridAnchorTime: 0,
            lastRenderTime: 0,
        };
        this.scheduleSourceSnapshots.clear();
        this.channelIds = [];
        this.hasRenderedOnce = false;
        this.shellView.reset();
        this.config.onPictureOperation?.('fullscreen');
        this._pictureOperation = 'fullscreen';

        this.errorBoundary.destroy();
        this.removeAllListeners();
    }

    private initializeErrorBoundary(): void {
        this.errorBoundary.setCallbacks({
            showFallbackRow: (context: string) => {
                // Fallback: just skip the problematic row, don't crash.
                if (this._isDebugEnabled()) {
                    this._appendDebugLog('EPG.showFallbackRow', { context });
                }
            },
            resetScrollPosition: () => {
                this.state.scrollPosition = { channelOffset: 0, timeOffset: 0 };
                this.renderGrid();
            },
            forceRecycleAll: () => {
                this.virtualizer.forceRecycleAll();
            },
        });

        this.errorBoundary.on('degradedMode', (data) => {
            if (this._isDebugEnabled()) {
                this._appendDebugLog('EPG.degradedMode', data);
            }
        });
    }

    private createDOMStructure(): void {
        if (!this.containerElement) return;

        const shell = this.shellView.create(this.containerElement);
        this._cacheShellElements(shell);
    }

    private initializeViewChildren(): void {
        const grid = this.gridElement;
        const programArea = this.programAreaElement;
        if (!grid || !programArea) {
            return;
        }

        this.virtualizer.initialize(programArea, this.config, this.state.gridAnchorTime);
        this.timeHeader.initialize(grid, this.config, this.state.gridAnchorTime);
        this.channelList.initialize(grid, this.config);
        this.initializeInfoPanelHosts();
    }

    private initializeInfoPanelHosts(): void {
        const host = this.classicShowcaseInfoElement;
        if (!host) throw new Error(EPG_ERRORS.SHOWCASE_INFO_HOST_NOT_FOUND);
        this.infoPanel.initialize(host);
        if (this.config.resolveThumbUrl) this.infoPanel.setThumbResolver(this.config.resolveThumbUrl);
        if (this.config.fetchItemDetails) this.infoPanel.setFetchItemDetails(this.config.fetchItemDetails);
    }

    private _cacheShellElements(shell: EPGShellElements): void {
        this.gridElement = shell.grid;
        this.toolbarElement = shell.toolbar;
        this.menuTrigger = shell.menuTrigger;
        this.programAreaElement = shell.programArea;
        this.classicShowcaseInfoElement = shell.classicShowcaseInfo;
    }

    private calculateGridAnchorTime(currentTime: number): number {
        const date = new Date(currentTime);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
    }

    /**
     * Set the grid anchor time (left edge of the EPG timeline).
     * Used to shift the guide window to start at "now".
     */
    setGridAnchorTime(anchorTime: number): void {
        this.gridRuntime.setGridAnchorTime(anchorTime);
    }


    private syncPicture(): void {
        if (!this.containerElement) return;
        const status = this.state.isVisible
            ? this.config.getPictureStatus?.() ?? 'untuned'
            : 'untuned';
        const operation = this.state.isVisible && status !== 'untuned' && status !== 'error'
            ? 'guide-pip' : 'fullscreen';
        if (operation !== this._pictureOperation) {
            this._pictureOperation = operation;
            this.config.onPictureOperation?.(operation);
        }
        this.shellView.updatePictureStatus(status);
    }

    /**
     * Show the EPG overlay.
     */
    show(options?: { preserveFocus?: boolean }): void {
        if (!this.state.isInitialized || !this.containerElement) return;

        this.containerElement.classList.add(EPG_CLASSES.CONTAINER_VISIBLE);
        this.state.isVisible = true;
        this.closeMenu();
        this.clearControlFocus();
        this.gridRuntime.resetVisibleRange();
        this.syncPicture();
        this.updateNowWatchingBanner();
        this.shellView.syncVisibility(this.state.isVisible);

        // Start time indicator updates (paused when hidden)
        this.gridRuntime.startTimeUpdateInterval();
        this.gridRuntime.addVisibilityListener();

        const shouldPreserveFocus = Boolean(options?.preserveFocus && this.state.focusedCell);
        if (this.config.autoScrollToNow && !shouldPreserveFocus) {
            this.gridRuntime.setTimeOffsetToNow();
        }

        this.gridRuntime.refreshPixelsPerMinuteForCurrentViewport();
        this.timeHeader.refreshLayout();
        this.timeHeader.updateScrollPosition(this.state.scrollPosition.timeOffset);

        // Render immediately on open to avoid a blank guide before first input.
        this.renderGridInternal();
        this.virtualizer.updateTemporalClasses(this.state.currentTime);
        this.channelList.refreshChannelNameLayouts();

        // Auto-focus current program if available.
        if (this.config.autoScrollToNow && !shouldPreserveFocus) {
            this.focusNow();
        } else if (shouldPreserveFocus) {
            const focusedCell = this.state.focusedCell;
            if (focusedCell?.kind === 'program') {
                this.infoPanelCoordinator.syncFocusedProgram(focusedCell.program);
            } else {
                this.infoPanelCoordinator.clear();
            }
        }

        if (this._isDebugEnabled()) {
            const payload = {
                channelCount: this.state.channels.length,
                scheduleCount: this.state.schedules.size,
                timeOffset: this.state.scrollPosition.timeOffset,
                gridAnchorTime: this.state.gridAnchorTime,
            };
            this._appendDebugLog('EPG.show', payload);
        }

        this.emit('open', undefined);
    }

    /**
     * Hide the EPG overlay.
     */
    hide(): void {
        if (!this.containerElement) return;

        this.virtualizer.clearFocusedTickerState();
        this.containerElement.classList.remove(EPG_CLASSES.CONTAINER_VISIBLE);
        this.state.isVisible = false;
        this.containerElement.classList.remove('epg-focus-in-toolbar');
        this.syncPicture();
        this.shellView.syncVisibility(false);

        // Stop time updates when hidden (CPU optimization)
        this.gridRuntime.stopTimeUpdateInterval();
        this.gridRuntime.removeVisibilityListener();

        this.infoPanelCoordinator.clear();
        this.closeMenu();
        this.toolbar.back();
        this.clearControlFocus();
        this._libraryTabs?.closePicker();
        this.emit('close', undefined);
    }

    toggle(): void {
        if (this.state.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    isVisible(): boolean {
        return this.state.isVisible;
    }


    loadChannels(channels: ChannelConfig[]): void {
        this.state.channels = channels;
        if (this.emptyState) this.emptyState.hidden = channels.length > 0;
        this.toolbar.setChannels(channels);
        this.channelIds = channels.map((c) => c.id);
        const retainedIds = new Set(this.channelIds);
        for (const channelId of this.state.rowLifecycle.keys()) {
            if (!retainedIds.has(channelId)) {
                this.state.rowLifecycle.delete(channelId);
            }
        }
        const channelsById = new Map(channels.map((channel) => [channel.id, channel]));
        for (const channelId of this.state.schedules.keys()) {
            const heldSnapshot = this.scheduleSourceSnapshots.get(channelId);
            const currentChannel = channelsById.get(channelId);
            if (!heldSnapshot || !currentChannel || !isMatchingEpgChannelSnapshot(heldSnapshot, currentChannel)) {
                this.clearScheduleForChannel(channelId, false);
            }
        }
        this.virtualizer.setChannelCount(channels.length);
        this.channelList.updateChannels(channels);
        this.focusNavigator.clearPlaceholderAutoFocusKeys();

        if (this.state.isVisible) {
            if (this.config.autoScrollToNow && this.state.scrollPosition.timeOffset === 0) {
                this.gridRuntime.setTimeOffsetToNow();
            }
            if (!this.hasRenderedOnce) {
                this.renderGridInternal();
            } else {
                this.renderGrid();
            }
        }

        if (this._isDebugEnabled()) {
            const payload = {
                channelCount: channels.length,
                timeOffset: this.state.scrollPosition.timeOffset,
            };
            this._appendDebugLog('EPG.loadChannels', payload);
        }
    }

    setSourceLabelsEnabled(enabled: boolean): void {
        this.config.sourceLabelsEnabled = enabled;
        this.channelList.setSourceLabelsEnabled(enabled);
    }

    setVisibleHours(hours: number): void {
        const normalized = Math.max(1, Math.min(this.config.totalHours, Math.round(hours)));
        if (!Number.isFinite(normalized) || normalized === this.config.visibleHours) {
            return;
        }

        this.config.visibleHours = normalized;
        this.toolbar.setHours(normalized);
        const maxOffset = Math.max(0, (this.config.totalHours * 60) - (this.config.visibleHours * 60));
        this.state.scrollPosition.timeOffset = Math.max(0, Math.min(this.state.scrollPosition.timeOffset, maxOffset));
        this.gridRuntime.resetVisibleRange();

        this.gridRuntime.refreshPixelsPerMinuteForCurrentViewport();
        this.timeHeader.refreshLayout();
        this.timeHeader.updateScrollPosition(this.state.scrollPosition.timeOffset);

        if (this.state.isVisible) {
            this.renderGridInternal();
            this.virtualizer.updateTemporalClasses(this.state.currentTime);
        }
    }

    setNowWatchingBannerEnabled(enabled: boolean): void {
        this.config.showNowWatchingBanner = enabled;
        if (this.state.isVisible) {
            this.updateNowWatchingBanner();
        }
    }

    setLibraryTabs(libraries: Array<{ id: string; name: string }>, selectedId: string | null): void {
        if (!this.toolbarElement || !this.gridElement) return;
        if (!this._libraryTabs) {
            if (libraries.length <= 1) {
                return;
            }
            this._libraryTabs = new EPGLibraryTabs({
                onFocus: (): void => this.claimControlFocus('library'),
                onSelect: (libraryId: string | null): void => this.emit('libraryFilterChanged', { libraryId }),
            });
            this._libraryTabs.initialize(this.toolbarElement, this.gridElement);
        }
        this._libraryTabs.update(libraries, selectedId);
        if (!this._libraryTabs.isVisible()) {
            this._isLibraryTabsFocused = false;
            this._libraryTabs.setPillFocused(false);
        }
    }

    getRowLifecycle(channelId: string): EpgRowLifecycleState | null {
        return this.state.rowLifecycle.get(channelId) ?? null;
    }

    setRowLifecycle(channelId: string, lifecycle: EpgRowLifecycleState): void {
        this.state.rowLifecycle.set(channelId, { ...lifecycle });
        if (this.state.isVisible) {
            this.renderGrid();
        }
    }

    clearRowLifecycle(channelId: string, rangeKey?: string): void {
        const current = this.state.rowLifecycle.get(channelId);
        if (!current) {
            return;
        }
        if (rangeKey !== undefined && current.rangeKey !== rangeKey) {
            return;
        }
        this.state.rowLifecycle.delete(channelId);
        if (this.state.isVisible) {
            this.renderGrid();
        }
    }

    clearAllRowLifecycles(): void {
        if (this.state.rowLifecycle.size === 0) {
            return;
        }
        this.state.rowLifecycle.clear();
        if (this.state.isVisible) {
            this.renderGrid();
        }
    }

    loadScheduleForChannel(
        channelId: string,
        schedule: ScheduleWindow,
        metadata?: EpgScheduleLoadMetadata
    ): void {
        this.state.schedules.set(channelId, schedule);
        this.state.scheduleLoadTimes.set(channelId, metadata?.loadedAt ?? Date.now());
        const channelSnapshot = metadata?.channelSnapshot ??
            this.state.channels.find((channel) => channel.id === channelId);
        if (channelSnapshot) {
            this.scheduleSourceSnapshots.set(channelId, channelSnapshot);
        } else {
            this.scheduleSourceSnapshots.delete(channelId);
        }
        this.state.rowLifecycle.delete(channelId);

        const focused = this.state.focusedCell;
        const isFocusedChannel = focused && this.state.channels[focused.channelIndex]?.id === channelId;
        let didAutoFocus = false;

        if (isFocusedChannel && focused && !this.focusNavigator.isSelectInProgress()) {
            if (focused.kind === 'program') {
                const stillExists = schedule.programs.some((program) =>
                    program.item.ratingKey === focused.program.item.ratingKey &&
                    program.scheduledStartTime === focused.program.scheduledStartTime
                );
                if (!stillExists) {
                    this.focusNavigator.focusProgramAtTime(focused.channelIndex, this.state.focusTimeMs);
                    didAutoFocus = true;
                }
            } else if (focused.kind === 'placeholder') {
                didAutoFocus = this.focusNavigator.didAutoFocusPlaceholder(channelId, focused);
            }
        }

        if (this.state.isVisible) {
            if (!this.hasRenderedOnce) {
                this.renderGridInternal();
            } else {
                this.renderGrid();
            }
        }

        if (this._isDebugEnabled()) {
            const payload = {
                rowOrdinal: this.state.channels.findIndex((channel) => channel.id === channelId),
                programCount: schedule.programs.length,
                startTime: schedule.startTime,
                endTime: schedule.endTime,
                focusedChannel: isFocusedChannel,
                focusKindBefore: focused?.kind ?? 'absent',
                focusKindAfter: this.state.focusedCell?.kind ?? 'absent',
                didAutoFocus,
            };
            this._appendDebugLog('EPG.loadScheduleForChannel', payload);
        }
    }

    hasScheduleForChannelRange(channelId: string, startTime: number, endTime: number): boolean {
        const schedule = this.state.schedules.get(channelId);
        return schedule?.startTime === startTime && schedule.endTime === endTime;
    }

    getHeldScheduleForChannel(channelId: string): EpgHeldScheduleSnapshot | null {
        const schedule = this.state.schedules.get(channelId);
        const loadedAt = this.state.scheduleLoadTimes.get(channelId);
        const channelSnapshot = this.scheduleSourceSnapshots.get(channelId);
        if (!schedule || loadedAt === undefined || !channelSnapshot) {
            return null;
        }
        return {
            schedule,
            loadedAt,
            channelSnapshot,
        };
    }

    clearScheduleForChannel(channelId: string, render = true): void {
        const hadSchedule = this.state.schedules.delete(channelId);
        this.state.scheduleLoadTimes.delete(channelId);
        this.scheduleSourceSnapshots.delete(channelId);
        if (render && hadSchedule && this.state.isVisible) {
            this.renderGrid();
        }
    }

    /**
     * Clear all loaded schedules and schedule timestamps.
     */
    clearSchedules(): void {
        this.state.schedules.clear();
        this.state.scheduleLoadTimes.clear();
        this.scheduleSourceSnapshots.clear();
        this.state.rowLifecycle.clear();
        this.focusNavigator.clearPlaceholderAutoFocusKeys();

        this.state.focusedCell = null;
        this.infoPanelCoordinator.clear();
        this.state.focusTimeMs = Date.now();

        if (this.state.isVisible) {
            this.renderGrid();
        }

        if (this._isDebugEnabled()) {
            const payload = {
                channelCount: this.state.channels.length,
            };
            this._appendDebugLog('EPG.clearSchedules', payload);
        }
    }

    /**
     * Refresh the current time indicator position.
     */
    refreshCurrentTime(): void {
        this.gridRuntime.refreshCurrentTime();
    }

    private updateNowWatchingBanner(): void {
        this.shellView.updateNowWatchingBanner({
            enabled: this.config.showNowWatchingBanner,
            getCurrentChannelInfo: this.config.getCurrentChannelInfo,
        });
    }

    /**
     * Focus a specific channel row.
     *
     * @param channelIndex - Channel index (0-based)
     */
    focusChannel(channelIndex: number): void {
        this.focusNavigator.focusChannel(channelIndex);
    }

    /**
     * Focus a specific program cell.
     *
     * @param channelIndex - Channel index (0-based)
     * @param programIndex - Program index within channel
     */
    focusProgram(channelIndex: number, programIndex: number): void {
        this.containerElement?.classList.remove('epg-focus-in-toolbar');
        this.focusNavigator.focusProgram(channelIndex, programIndex);
    }

    /**
     * Focus the currently airing program on the current channel.
     */
    focusNow(): void {
        this.focusNavigator.focusNow();
    }

    /**
     * Scroll the grid to a specific time.
     *
     * @param time - Unix timestamp (ms)
     */
    scrollToTime(time: number): void {
        this.focusNavigator.scrollToTime(time);
    }

    /**
     * Scroll the grid to a specific channel.
     *
     * @param channelIndex - Channel index (0-based)
     */
    scrollToChannel(channelIndex: number): void {
        this.focusNavigator.scrollToChannel(channelIndex);
    }

    handleNavigation(direction: 'up' | 'down' | 'left' | 'right'): boolean {
        if (this.menuOverlay) {
            if (direction === 'up' || direction === 'down') {
                const buttons = this.menuOverlay.querySelectorAll('button');
                const next = Math.max(0, Math.min(buttons.length - 1, this.menuIndex + (direction === 'down' ? 1 : -1)));
                if (!buttons[next]?.disabled) this.menuIndex = next;
                this.syncMenuFocus();
            }
            return true;
        }
        if (this.menuFocused) {
            if (direction === 'down') {
                this.setMenuFocused(false);
                if (this._libraryTabs?.isVisible()) {
                    this._isLibraryTabsFocused = true;
                    this._libraryTabs.setFocusedToSelected();
                } else this.toolbar.focus(0);
            }
            this.syncControlFocus();
            return true;
        }
        if (this.toolbar.isFocused() || this.toolbar.isSearchOpen()) {
            const result = this.toolbar.handleNavigation(direction);
            if (result === 'menu') this.setMenuFocused(true);
            else if (result === 'library' && this._libraryTabs?.isVisible()) {
                this._isLibraryTabsFocused = true;
                this._libraryTabs.setFocusedToSelected();
            } else if (result === 'grid' && direction === 'down') {
                this.focusNavigator.focusChannel(this.state.scrollPosition.channelOffset);
            }
            this.syncControlFocus();
            return true;
        }
        if (this._isLibraryTabsFocused && direction === 'right' && !this._libraryTabs?.isPickerOpen()) {
            this._isLibraryTabsFocused = false;
            this._libraryTabs?.setPillFocused(false);
            this.toolbar.focus(0);
            this.containerElement?.classList.add('epg-focus-in-toolbar');
            return true;
        }
        if (this._isLibraryTabsFocused && direction === 'up' && !this._libraryTabs?.isPickerOpen()) {
            this._isLibraryTabsFocused = false;
            this._libraryTabs?.setPillFocused(false);
            this.setMenuFocused(true);
            return true;
        }
        if (!this._isLibraryTabsFocused && direction === 'up'
            && (this.state.channels.length === 0 || this.state.focusedCell?.channelIndex === 0)) {
            if (this._libraryTabs?.isVisible()) {
                this._isLibraryTabsFocused = true;
                this._libraryTabs.setFocusedToSelected();
            } else this.toolbar.focus(0);
            this.containerElement?.classList.add('epg-focus-in-toolbar');
            return true;
        }
        return this.focusNavigator.handleNavigation(direction);
    }

    /**
     * Page up/down by a screenful of channels while preserving time focus.
     */
    handlePage(direction: 'up' | 'down'): boolean {
        return this.focusNavigator.handlePage(direction);
    }

    handleSelect(): boolean {
        if (this.menuOverlay) {
            this.menuOverlay.querySelectorAll('button')[this.menuIndex]?.click();
            return true;
        }
        if (this.menuFocused) {
            this.openMenu();
            return true;
        }
        if (this.toolbar.isFocused() || this.toolbar.isSearchOpen()) {
            return this.containerElement ? this.toolbar.select(this.containerElement) : false;
        }
        if (this.state.channels.length === 0 && !this._isLibraryTabsFocused) {
            this.emit('setupRequested', undefined);
            return true;
        }
        return this.focusNavigator.handleSelect();
    }

    handleBack(): boolean {
        if (this.menuOverlay) {
            this.closeMenu();
            return true;
        }
        if (this.toolbar.back()) {
            this.syncControlFocus();
            return true;
        }
        if (this.menuFocused) {
            this.setMenuFocused(false);
            return true;
        }
        return this.focusNavigator.handleBack();
    }

    private setMenuFocused(focused: boolean): void {
        if (focused) {
            this.claimControlFocus('menu');
            return;
        }
        this.menuFocused = focused;
        this.syncControlFocus();
    }

    private claimControlFocus(owner: 'menu' | 'library' | 'toolbar'): void {
        this.menuFocused = owner === 'menu';
        this._isLibraryTabsFocused = owner === 'library';
        if (owner !== 'menu') this.closeMenu();
        if (owner !== 'library') this._libraryTabs?.closePicker();
        if (owner !== 'toolbar') {
            this.toolbar.back();
            this.toolbar.blur();
        }
        this.syncControlFocus();
    }

    private clearControlFocus(): void {
        this.menuFocused = false;
        this._isLibraryTabsFocused = false;
        this.toolbar.blur();
        this.syncControlFocus();
    }

    private syncControlFocus(): void {
        this.menuTrigger?.classList.toggle('epg-toolbar-focused', this.menuFocused);
        this._libraryTabs?.setPillFocused(this._isLibraryTabsFocused);
        this.containerElement?.classList.toggle('epg-focus-in-toolbar',
            this.menuFocused || this.toolbar.isFocused() || this._isLibraryTabsFocused);
    }

    private createEmptyState(): void {
        if (!this.containerElement) return;
        const state = document.createElement('div');
        state.className = 'epg-empty-state';
        state.hidden = this.state.channels.length > 0;
        const heading = document.createElement('h2');
        heading.textContent = 'No channels yet';
        const description = document.createElement('p');
        description.textContent = 'Set up your channels to start watching.';
        const setup = document.createElement('button');
        setup.type = 'button';
        setup.dataset.action = 'setup';
        setup.textContent = 'Set up channels';
        setup.addEventListener('click', () => this.emit('setupRequested', undefined));
        state.append(heading, description, setup);
        this.containerElement.appendChild(state);
        this.emptyState = state;
    }

    private openMenu(): void {
        if (!this.containerElement || this.menuOverlay) return;
        this.claimControlFocus('menu');
        const overlay = document.createElement('nav');
        overlay.className = 'epg-menu-overlay';
        overlay.setAttribute('aria-label', 'Lineup menu');
        const entries: Array<['player' | 'settings' | 'channels' | 'channel-setup' | 'server-select', string]> = [
            ['player', 'Now playing'], ['settings', 'Settings'], ['channels', 'Channels'],
            ['channel-setup', 'Set up channels'], ['server-select', 'Switch server'],
        ];
        for (const [route, label] of entries) {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.action = route;
            button.textContent = label;
            if (route === 'player') {
                const status = this.config.getPictureStatus?.() ?? 'untuned';
                button.disabled = status === 'untuned' || status === 'error';
            }
            button.addEventListener('click', () => {
                this.closeMenu();
                this.emit('menuRouteRequested', route);
            });
            overlay.appendChild(button);
        }
        this.menuOverlay = overlay;
        this.menuIndex = overlay.firstElementChild?.hasAttribute('disabled') ? 1 : 0;
        this.containerElement.appendChild(overlay);
        this.syncMenuFocus();
    }

    openLineupMenu(): void {
        if (!this.isVisible()) return;
        this.openMenu();
    }

    private syncMenuFocus(): void {
        this.menuOverlay?.querySelectorAll('button').forEach((button, index) => {
            button.classList.toggle('epg-toolbar-focused', index === this.menuIndex);
        });
    }

    private closeMenu(): void {
        this.menuOverlay?.remove();
        this.menuOverlay = null;
    }

    private handleToolbarAction(action: GuideToolbarAction): void {
        if (action === 'earlier' || action === 'later') {
            const delta = action === 'later' ? 30 : -30;
            this.focusNavigator.scrollToTime(this.getState().viewWindow.startTime + delta * 60_000);
        } else if (action === 'now') {
            this.focusNavigator.scrollToTime(Date.now());
        } else if (action === 'hours') {
            const next = this.config.visibleHours === 2 ? 3 : this.config.visibleHours === 3 ? 4 : 2;
            if (this.config.onGuideHoursChange?.(next) === false) this.toolbar.reportSaveFailure();
            else {
                this.toolbar.clearStatus();
                this.setVisibleHours(next);
            }
        }
    }


    getState(): EPGState {
        const { scrollPosition, currentTime, focusedCell, isVisible } = this.state;
        const { visibleHours, visibleChannels } = this.config;

        return {
            isVisible,
            focusedCell: focusedCell ?? null,
            scrollPosition,
            viewWindow: {
                startTime: this.state.gridAnchorTime + (scrollPosition.timeOffset * 60000),
                endTime: this.state.gridAnchorTime + ((scrollPosition.timeOffset + visibleHours * 60) * 60000),
                startChannelIndex: scrollPosition.channelOffset,
                endChannelIndexExclusive: Math.min(
                    scrollPosition.channelOffset + visibleChannels,
                    this.state.channels.length
                ),
            },
            currentTime,
        };
    }

    private _getFocusKey(focusedCell: EPGFocusPosition | null): string | null {
        return this.focusNavigator.getFocusKey(focusedCell);
    }

    getFocusedProgram(): ScheduledProgram | null {
        if (this.state.focusedCell?.kind !== 'program') {
            return null;
        }
        return this.state.focusedCell.program;
    }


    private renderGrid(): void {
        this.gridRuntime.renderGrid();
    }

    private renderGridInternal(): void {
        this.gridRuntime.renderGridInternal();
    }
}
