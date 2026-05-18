import { EventEmitter } from '../../../../utils/EventEmitter';
import { EPG_CLASSES, EPG_ERRORS, DEFAULT_EPG_CONFIG } from '../constants';
import { EPGChannelList } from '../view/EPGChannelList';
import { EPGErrorBoundary } from '../view/EPGErrorBoundary';
import { EPGInfoPanel } from '../view/info-panel/EPGInfoPanel';
import { EPGInfoPanelCoordinator } from '../view/info-panel/EPGInfoPanelCoordinator';
import { EPGLibraryTabs } from '../view/EPGLibraryTabs';
import { EPGShellView } from '../view/shell/EPGShellView';
import { EPGTimeHeader } from '../view/EPGTimeHeader';
import { EPGVirtualizer } from '../view/EPGVirtualizer';
import { appendDebugRuntimeLog, isDebugRuntimeEnabled } from '../debug/debugRuntimeGuards';
import { EPGFocusNavigator } from '../focus/EPGFocusNavigator';
import { EPGGridRuntimeController } from '../runtime/EPGGridRuntimeController';
import type { EpgLayoutMode } from '../../../settings/EpgPreferencesStore';
import type { EPGShellElements } from '../view/shell/EPGShellView';
import type { IEPGComponent } from '../interfaces';
import type {
    EPGConfig,
    EPGState,
    EPGEventMap,
    EPGInternalState,
    EPGFocusPosition,
    ScheduledProgram,
    ScheduleWindow,
    ChannelConfig,
} from '../types';

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
        syncPeekMode: () => this.syncPeekMode(),
        applyLayoutMode: () => this.applyLayoutMode(),
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
    private overlayShowcaseElement: HTMLElement | null = null;
    private dashboardBottomElement: HTMLElement | null = null;
    private gridElement: HTMLElement | null = null;
    private programAreaElement: HTMLElement | null = null;
    private hasRenderedOnce: boolean = false;
    private channelIds: string[] = [];
    private _libraryTabs: EPGLibraryTabs | null = null;
    private _isLibraryTabsFocused = false;
    private _appliedLayoutMode: EpgLayoutMode | null = null;
    private _appliedPipMode: EpgLayoutMode | null = null;
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
        this.infoPanelCoordinator.destroy();
        this.gridRuntime.destroy();

        this.virtualizer.destroy();
        this.infoPanel.destroy();
        this.timeHeader.destroy();
        this.channelList.destroy();
        this._libraryTabs?.destroy();
        this._libraryTabs = null;
        this._isLibraryTabsFocused = false;

        if (this.containerElement) {
            this.containerElement.style.removeProperty('--epg-row-height');
            this.containerElement.replaceChildren();
            this.containerElement.classList.remove(EPG_CLASSES.CONTAINER_VISIBLE);
            this.containerElement.classList.remove(EPG_CLASSES.CONTAINER_PEEK);
            this.containerElement.classList.remove(EPG_CLASSES.CONTAINER_CLASSIC);
        }

        this.containerElement = null;
        this.classicShowcaseInfoElement = null;
        this.overlayShowcaseElement = null;
        this.dashboardBottomElement = null;
        this.gridElement = null;
        this.programAreaElement = null;

        this.state = {
            isInitialized: false,
            isVisible: false,
            channels: [],
            schedules: new Map(),
            scheduleLoadTimes: new Map(),
            focusedCell: null,
            focusTimeMs: Date.now(),
            scrollPosition: { channelOffset: 0, timeOffset: 0 },
            currentTime: Date.now(),
            gridAnchorTime: 0,
            lastRenderTime: 0,
        };
        this.channelIds = [];
        this.hasRenderedOnce = false;
        this.shellView.reset();
        this._appliedLayoutMode = null;
        if (this._appliedPipMode === 'classic') {
            this.config.onLayoutModeChange?.('overlay');
        }
        this._appliedPipMode = null;

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
        const dashboard = this.dashboardBottomElement;
        const overlayShowcase = this.overlayShowcaseElement;
        if (!dashboard) {
            throw new Error(EPG_ERRORS.DASHBOARD_CONTAINER_NOT_FOUND);
        }
        if (!overlayShowcase) {
            throw new Error(EPG_ERRORS.OVERLAY_SHOWCASE_CONTAINER_NOT_FOUND);
        }

        this.infoPanel.initialize(overlayShowcase);
        const infoPanelElement = overlayShowcase.querySelector(`.${EPG_CLASSES.INFO_PANEL}`) as HTMLElement | null;

        if (this.config.resolveThumbUrl) {
            this.infoPanel.setThumbResolver(this.config.resolveThumbUrl);
        }
        if (this.config.fetchItemDetails) {
            this.infoPanel.setFetchItemDetails(this.config.fetchItemDetails);
        }
        this.infoPanelCoordinator.attachHosts({
            infoPanelElement,
            overlayShowcaseElement: overlayShowcase,
            classicShowcaseInfoElement: this.classicShowcaseInfoElement,
        });
    }

    private _cacheShellElements(shell: EPGShellElements): void {
        this.gridElement = shell.grid;
        this.programAreaElement = shell.programArea;
        this.classicShowcaseInfoElement = shell.classicShowcaseInfo;
        this.overlayShowcaseElement = shell.overlayShowcase;
        this.dashboardBottomElement = shell.dashboardBottom;
    }

    private syncClassicShellVisibility(): void {
        const mode: EpgLayoutMode = this.config.layoutMode ?? 'classic';
        this.shellView.syncClassicShellVisibility(mode, this.state.isVisible);
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


    private syncPeekMode(): void {
        if (!this.containerElement) return;
        if (this.config.isVideoPlaying?.() === true) {
            this.containerElement.classList.add(EPG_CLASSES.CONTAINER_PEEK);
        } else {
            this.containerElement.classList.remove(EPG_CLASSES.CONTAINER_PEEK);
        }
        this.syncClassicShellVisibility();
    }

    private applyLayoutMode(): void {
        if (!this.containerElement) return;
        const mode: EpgLayoutMode = this.config.layoutMode ?? 'classic';
        const didLayoutModeChange = mode !== this._appliedLayoutMode;
        if (didLayoutModeChange) {
            this._appliedLayoutMode = mode;
            if (mode === 'classic') {
                this.containerElement.classList.add(EPG_CLASSES.CONTAINER_CLASSIC);
            } else {
                this.containerElement.classList.remove(EPG_CLASSES.CONTAINER_CLASSIC);
            }
        }

        const pipMode: EpgLayoutMode =
            mode === 'classic' && this.config.isVideoPlaying?.() === true ? 'classic' : 'overlay';
        if (pipMode !== this._appliedPipMode) {
            this._appliedPipMode = pipMode;
            this.config.onLayoutModeChange?.(pipMode);
        }
        this.infoPanelCoordinator.setLayoutMode(mode);
        if (didLayoutModeChange && this.state.isVisible) {
            const focusedCell = this.state.focusedCell;
            if (focusedCell?.kind === 'program') {
                this.infoPanelCoordinator.syncFocusedProgram(focusedCell.program);
            }
        }
        this.syncClassicShellVisibility();
    }

    /**
     * Show the EPG overlay.
     */
    show(options?: { preserveFocus?: boolean }): void {
        if (!this.state.isInitialized || !this.containerElement) return;

        this.containerElement.classList.add(EPG_CLASSES.CONTAINER_VISIBLE);
        this.state.isVisible = true;
        this.gridRuntime.resetVisibleRange();
        this.syncPeekMode();
        this.applyLayoutMode();
        this.updateNowWatchingBanner();
        this.syncClassicShellVisibility();

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
        this.syncPeekMode();
        this.containerElement.classList.remove(EPG_CLASSES.CONTAINER_PEEK);
        const wasClassic = this._appliedPipMode === 'classic';
        this.containerElement.classList.remove(EPG_CLASSES.CONTAINER_CLASSIC);
        this._appliedLayoutMode = 'overlay';
        this._appliedPipMode = 'overlay';
        if (wasClassic) {
            this.config.onLayoutModeChange?.('overlay');
        }
        this.syncClassicShellVisibility();

        // Stop time updates when hidden (CPU optimization)
        this.gridRuntime.stopTimeUpdateInterval();
        this.gridRuntime.removeVisibilityListener();

        this.infoPanelCoordinator.clear();
        this._isLibraryTabsFocused = false;
        this._libraryTabs?.destroy();
        this._libraryTabs = null;
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
        this.channelIds = channels.map((c) => c.id);
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

    setCategoryColorsEnabled(enabled: boolean): void {
        this.channelList.setCategoryColorsEnabled(enabled);
        if (this.state.isVisible) {
            // Re-render visible rows only (virtualized pool), not all channels.
            this.channelList.updateChannels(this.state.channels);
        }
    }

    setLayoutMode(mode: EpgLayoutMode): void {
        this.config.layoutMode = mode;
        if (this.state.isVisible) {
            this.applyLayoutMode();
        }
    }

    setVisibleHours(hours: number): void {
        const normalized = Math.max(1, Math.min(this.config.totalHours, Math.round(hours)));
        if (!Number.isFinite(normalized) || normalized === this.config.visibleHours) {
            return;
        }

        this.config.visibleHours = normalized;
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
        if (!this.gridElement) return;
        if (!this._libraryTabs) {
            if (libraries.length <= 1) {
                return;
            }
            this._libraryTabs = new EPGLibraryTabs({
                onSelect: (libraryId: string | null): void => this.emit('libraryFilterChanged', { libraryId }),
            });
            this._libraryTabs.initialize(this.gridElement);
        }
        this._libraryTabs.update(libraries, selectedId);
        if (!this._libraryTabs.isVisible()) {
            this._isLibraryTabsFocused = false;
            this._libraryTabs.setPillFocused(false);
        }
    }

    loadScheduleForChannel(channelId: string, schedule: ScheduleWindow): void {
        this.state.schedules.set(channelId, schedule);
        this.state.scheduleLoadTimes.set(channelId, Date.now());

        const focused = this.state.focusedCell;
        const isFocusedChannel = focused && this.state.channels[focused.channelIndex]?.id === channelId;
        const focusKeyBefore = this._getFocusKey(focused);
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
                channelId,
                programCount: schedule.programs.length,
                startTime: schedule.startTime,
                endTime: schedule.endTime,
                focusedChannel: isFocusedChannel,
                focusKeyBefore,
                focusKeyAfter: this._getFocusKey(this.state.focusedCell),
                didAutoFocus,
            };
            this._appendDebugLog('EPG.loadScheduleForChannel', payload);
        }
    }

    /**
     * Clear all loaded schedules and schedule timestamps.
     */
    clearSchedules(): void {
        this.state.schedules.clear();
        this.state.scheduleLoadTimes.clear();
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
        const mode: EpgLayoutMode = this.config.layoutMode ?? 'classic';
        this.shellView.updateNowWatchingBanner({
            enabled: this.config.showNowWatchingBanner,
            getCurrentChannelInfo: this.config.getCurrentChannelInfo,
            layoutMode: mode,
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
        return this.focusNavigator.handleNavigation(direction);
    }

    /**
     * Page up/down by a screenful of channels while preserving time focus.
     */
    handlePage(direction: 'up' | 'down'): boolean {
        return this.focusNavigator.handlePage(direction);
    }

    handleSelect(): boolean {
        return this.focusNavigator.handleSelect();
    }

    handleBack(): boolean {
        return this.focusNavigator.handleBack();
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
                endChannelIndex: Math.min(
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
