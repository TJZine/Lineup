/**
 * @fileoverview EPG Component - Main orchestrator for Electronic Program Guide
 * @module modules/ui/epg/EPGComponent
 * @version 1.0.0
 */

import { EventEmitter } from '../../../utils/EventEmitter';
import { EPG_CONSTANTS, EPG_CLASSES, EPG_ERRORS, DEFAULT_EPG_CONFIG } from './constants';
import { EPGVirtualizer } from './EPGVirtualizer';
import { EPGInfoPanel } from './EPGInfoPanel';
import { EPGInfoPanelCoordinator } from './EPGInfoPanelCoordinator';
import { EPGTimeHeader } from './EPGTimeHeader';
import { EPGChannelList } from './EPGChannelList';
import { EPGErrorBoundary } from './EPGErrorBoundary';
import { EPGLibraryTabs } from './EPGLibraryTabs';
import { rafThrottle, appendEpgDebugLog, formatTimeRange } from './utils';
import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import { safeLocalStorageGet } from '../../../utils/storage';
import type { IEPGComponent } from './interfaces';
import type {
    EPGConfig,
    EPGState,
    EPGEventMap,
    EPGInternalState,
    EPGFocusPosition,
    ScheduledProgram,
    ScheduleWindow,
    ChannelConfig,
} from './types';

/**
 * EPG Component class.
 * Main orchestrator for the Electronic Program Guide grid.
 * Implements virtualized rendering for 60fps performance on TV hardware.
 */
export class EPGComponent extends EventEmitter<EPGEventMap> implements IEPGComponent {
    private config: EPGConfig = DEFAULT_EPG_CONFIG as unknown as EPGConfig;

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
        isScrubbingHorizontally: false,
        scrubLabelProgramKey: null,
        lastRenderTime: 0,
    };

    // Sub-components
    private virtualizer: EPGVirtualizer = new EPGVirtualizer();
    private infoPanel: EPGInfoPanel = new EPGInfoPanel();
    private infoPanelCoordinator: EPGInfoPanelCoordinator = new EPGInfoPanelCoordinator({
        infoPanel: this.infoPanel,
        getIsVisible: () => this.state.isVisible,
        getFocusedProgram: () => this.getFocusedProgram(),
    });
    private timeHeader: EPGTimeHeader = new EPGTimeHeader();
    private channelList: EPGChannelList = new EPGChannelList();
    private errorBoundary: EPGErrorBoundary = new EPGErrorBoundary();

    // DOM elements
    private containerElement: HTMLElement | null = null;
    private classicHeaderElement: HTMLElement | null = null;
    private classicNowPlayingElement: HTMLElement | null = null;
    private classicNowPlayingChannelElement: HTMLElement | null = null;
    private classicShowcaseElement: HTMLElement | null = null;
    private gridElement: HTMLElement | null = null;
    private programAreaElement: HTMLElement | null = null;
    private timeIndicatorElement: HTMLElement | null = null;
    private scrubLabelElement: HTMLElement | null = null;
    private scrubLabelTitleElement: HTMLElement | null = null;
    private scrubLabelTimeElement: HTMLElement | null = null;
    private scrubLabelChannelElement: HTMLElement | null = null;
    private nowWatchingBannerElement: HTMLElement | null = null;
    private nowWatchingChannelElement: HTMLElement | null = null;
    private nowWatchingProgramElement: HTMLElement | null = null;
    private nowWatchingTimeElement: HTMLElement | null = null;
    private hasRenderedOnce: boolean = false;
    private lastVisibleRangeKey: string | null = null;
    private channelIds: string[] = [];
    private _isSelectInProgress: boolean = false;
    private _placeholderAutoFocusKeys: Set<string> = new Set();
    private _libraryTabs: EPGLibraryTabs | null = null;
    private _isLibraryTabsFocused = false;
    private _lastNowWatchingTuple: [string, string, string] | null = null;
    private _appliedLayoutMode: 'overlay' | 'classic' | null = null;
    private _appliedPipMode: 'overlay' | 'classic' | null = null;
    private _debugEnabled: boolean = false;
    private _lastDebugEnabledStorageReadMs: number = 0;
    private _lastRenderGridDebugLogMs: number = 0;
    private _onStorage = (event: StorageEvent): void => {
        if (event.key !== LINEUP_STORAGE_KEYS.EPG_DEBUG) return;
        this._debugEnabled = event.newValue === '1';
        this._lastDebugEnabledStorageReadMs = Date.now();
    };

    // Timers
    private timeUpdateInterval: ReturnType<typeof setInterval> | null = null;
    private scrubLabelHideTimer: ReturnType<typeof setTimeout> | null = null;
    private _onVisibilityChange = (): void => {
        if (!this.state.isVisible) return;
        if (document.visibilityState === 'visible') {
            this.syncPeekMode();
            this.refreshCurrentTime();
            this.renderGrid();
        }
    };
    private _onTimeTick = (): void => {
        this.refreshCurrentTime();
        this.updateNowWatchingBanner();
        this.syncPeekMode();
        this.applyLayoutMode();
    };

    // Throttled render function for 60fps performance
    private throttledRenderGrid = rafThrottle(() => this.renderGridInternal());

    /**
     * Initialize the EPG component with configuration.
     *
     * @param config - EPG configuration
     */
    initialize(config: EPGConfig): void {
        if (this.state.isInitialized) {
            return;
        }

        this.config = { ...DEFAULT_EPG_CONFIG, ...config } as EPGConfig;
        this._debugEnabled = this._readDebugEnabledFromStorage();
        this._lastDebugEnabledStorageReadMs = Date.now();
        try {
            window.addEventListener('storage', this._onStorage);
        } catch {
            // ignore
        }
        this.state.currentTime = Date.now();
        this.state.gridAnchorTime = this.calculateGridAnchorTime(this.state.currentTime);
        this.state.focusTimeMs = this.state.currentTime;

        // Find container element
        this.containerElement = document.getElementById(this.config.containerId);
        if (!this.containerElement) {
            throw new Error(EPG_ERRORS.CONTAINER_NOT_FOUND);
        }
        this.containerElement.style.setProperty('--epg-row-height', `${this.config.rowHeight}px`);

        // Create DOM structure
        this.createDOMStructure();

        // Initialize sub-components
        if (this.gridElement && this.programAreaElement) {
            this.virtualizer.initialize(this.programAreaElement, this.config, this.state.gridAnchorTime);
            this.timeHeader.initialize(this.gridElement, this.config, this.state.gridAnchorTime);
            this.channelList.initialize(this.gridElement, this.config);
            const dashboard = this.containerElement.querySelector(`.${EPG_CLASSES.DASHBOARD_BOTTOM}`) as HTMLElement | null;
            const overlayShowcase = this.containerElement.querySelector(
                `.${EPG_CLASSES.OVERLAY_SHOWCASE}`
            ) as HTMLElement | null;
            if (!dashboard) {
                throw new Error(EPG_ERRORS.DASHBOARD_CONTAINER_NOT_FOUND);
            }
            if (!overlayShowcase) {
                throw new Error(EPG_ERRORS.OVERLAY_SHOWCASE_CONTAINER_NOT_FOUND);
            }
            this.infoPanel.initialize(overlayShowcase);
            const infoPanelElement = this.containerElement.querySelector(`.${EPG_CLASSES.INFO_PANEL}`) as HTMLElement | null;
            const classicShowcaseInfoElement = this.containerElement.querySelector('.epg-classic-showcase-info') as HTMLElement | null;

            // Wire thumb resolver to info panel
            if (this.config.resolveThumbUrl) {
                this.infoPanel.setThumbResolver(this.config.resolveThumbUrl);
            }
            if (this.config.fetchItemDetails) {
                this.infoPanel.setFetchItemDetails(this.config.fetchItemDetails);
            }
            this.infoPanelCoordinator.attachHosts({
                infoPanelElement,
                overlayShowcaseElement: overlayShowcase,
                classicShowcaseInfoElement,
            });
        }

        // Create time indicator
        this.createTimeIndicator();

        // Initialize error boundary callbacks
        this.initializeErrorBoundary();

        // Timer starts when shown, not at init (optimization)

        this.state.isInitialized = true;
    }

    private _readDebugEnabledFromStorage(): boolean {
        return safeLocalStorageGet(LINEUP_STORAGE_KEYS.EPG_DEBUG) === '1';
    }

    private isDebugEnabled(): boolean {
        // StorageEvent does not fire in the same document that calls localStorage.setItem(),
        // so periodically refresh to support same-tab toggles without reading on every call.
        const now = Date.now();
        const refreshIntervalMs = this.config.debugStorageRefreshIntervalMs ?? 500;
        if (now - this._lastDebugEnabledStorageReadMs >= refreshIntervalMs) {
            this._lastDebugEnabledStorageReadMs = now;
            this._debugEnabled = this._readDebugEnabledFromStorage();
        }
        return this._debugEnabled;
    }

    /**
     * Destroy the EPG component and clean up resources.
     */
    destroy(): void {
        this.hideScrubLabel(true);
        this.infoPanelCoordinator.destroy();
        this.stopTimeUpdateInterval();
        document.removeEventListener('visibilitychange', this._onVisibilityChange);
        try {
            window.removeEventListener('storage', this._onStorage);
        } catch {
            // ignore
        }

        this.virtualizer.destroy();
        this.infoPanel.destroy();
        this.timeHeader.destroy();
        this.channelList.destroy();
        this._libraryTabs?.destroy();
        this._libraryTabs = null;
        this._isLibraryTabsFocused = false;

        if (this.containerElement) {
            this.containerElement.style.removeProperty('--epg-row-height');
            this.containerElement.innerHTML = '';
            this.containerElement.classList.remove(EPG_CLASSES.CONTAINER_VISIBLE);
            this.containerElement.classList.remove(EPG_CLASSES.CONTAINER_PEEK);
            this.containerElement.classList.remove(EPG_CLASSES.CONTAINER_CLASSIC);
        }

        this.containerElement = null;
        this.classicHeaderElement = null;
        this.classicNowPlayingElement = null;
        this.classicNowPlayingChannelElement = null;
        this.classicShowcaseElement = null;
        this.gridElement = null;
        this.programAreaElement = null;
        this.timeIndicatorElement = null;
        this.scrubLabelElement = null;
        this.scrubLabelTitleElement = null;
        this.scrubLabelTimeElement = null;
        this.scrubLabelChannelElement = null;
        this.nowWatchingBannerElement = null;
        this.nowWatchingChannelElement = null;
        this.nowWatchingProgramElement = null;
        this.nowWatchingTimeElement = null;

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
            isScrubbingHorizontally: false,
            scrubLabelProgramKey: null,
            lastRenderTime: 0,
        };
        this.channelIds = [];
        this.hasRenderedOnce = false;
        this._isSelectInProgress = false;
        this._placeholderAutoFocusKeys.clear();
        this._lastNowWatchingTuple = null;
        this._appliedLayoutMode = null;
        if (this._appliedPipMode === 'classic') {
            this.config.onLayoutModeChange?.('overlay');
        }
        this._appliedPipMode = null;
        this._debugEnabled = false;
        this._lastDebugEnabledStorageReadMs = Date.now();
        this._lastRenderGridDebugLogMs = 0;

        this.errorBoundary.destroy();
        this.removeAllListeners();
    }

    /**
     * Initialize error boundary with recovery callbacks.
     */
    private initializeErrorBoundary(): void {
        this.errorBoundary.setCallbacks({
            showFallbackRow: (context: string) => {
                // Fallback: just skip the problematic row, don't crash.
                if (this.isDebugEnabled()) {
                    appendEpgDebugLog('EPG.showFallbackRow', { context });
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

        // Forward degraded mode events
        this.errorBoundary.on('degradedMode', (data) => {
            if (this.isDebugEnabled()) {
                appendEpgDebugLog('EPG.degradedMode', data);
            }
            console.warn('[EPG] Degraded mode');
        });
    }

    /**
     * Create the DOM structure for the EPG.
     */
    private createDOMStructure(): void {
        if (!this.containerElement) return;

        this.containerElement.className = EPG_CLASSES.CONTAINER;

        const classicHeader = document.createElement('div');
        classicHeader.className = 'epg-classic-header';
        classicHeader.hidden = true;

        const classicHeaderBrand = document.createElement('div');
        classicHeaderBrand.className = 'epg-classic-header-brand';
        classicHeader.appendChild(classicHeaderBrand);

        const classicHeaderTitle = document.createElement('div');
        classicHeaderTitle.className = 'epg-classic-header-title';
        classicHeaderTitle.textContent = 'LINEUP';
        classicHeaderBrand.appendChild(classicHeaderTitle);

        const classicNowPlaying = document.createElement('div');
        classicNowPlaying.className = 'epg-classic-now-playing';
        classicNowPlaying.hidden = true;
        classicHeaderBrand.appendChild(classicNowPlaying);

        const classicNowPlayingLabel = document.createElement('span');
        classicNowPlayingLabel.className = 'epg-classic-now-playing-label';
        classicNowPlayingLabel.textContent = 'NOW PLAYING';
        classicNowPlaying.appendChild(classicNowPlayingLabel);

        const classicNowPlayingChannel = document.createElement('span');
        classicNowPlayingChannel.className = 'epg-classic-now-playing-channel';
        classicNowPlaying.appendChild(classicNowPlayingChannel);

        const classicHeaderActions = document.createElement('div');
        classicHeaderActions.className = 'epg-classic-header-actions';
        classicHeader.appendChild(classicHeaderActions);

        const actionOk = document.createElement('span');
        actionOk.textContent = 'OK Select';
        const actionNavigate = document.createElement('span');
        actionNavigate.textContent = '· LEFT/RIGHT Navigate';
        const actionBack = document.createElement('span');
        actionBack.textContent = '· BACK Close';
        classicHeaderActions.append(actionOk, actionNavigate, actionBack);

        const classicShowcase = document.createElement('div');
        classicShowcase.className = 'epg-classic-showcase';
        classicShowcase.hidden = true;

        const classicShowcasePip = document.createElement('div');
        classicShowcasePip.className = 'epg-classic-showcase-pip';
        classicShowcase.appendChild(classicShowcasePip);

        const classicShowcaseInfo = document.createElement('div');
        classicShowcaseInfo.className = 'epg-classic-showcase-info';
        classicShowcase.appendChild(classicShowcaseInfo);

        const overlayShowcase = document.createElement('div');
        overlayShowcase.className = EPG_CLASSES.OVERLAY_SHOWCASE;

        const grid = document.createElement('div');
        grid.className = EPG_CLASSES.GRID;

        const programArea = document.createElement('div');
        programArea.className = EPG_CLASSES.PROGRAM_AREA;
        grid.appendChild(programArea);

        const dashboardBottom = document.createElement('div');
        dashboardBottom.className = EPG_CLASSES.DASHBOARD_BOTTOM;

        const nowWatchingBanner = document.createElement('div');
        nowWatchingBanner.className = EPG_CLASSES.NOW_WATCHING_BANNER;
        nowWatchingBanner.setAttribute('aria-live', 'polite');
        dashboardBottom.appendChild(nowWatchingBanner);

        const nowWatchingLive = document.createElement('span');
        nowWatchingLive.className = EPG_CLASSES.NOW_WATCHING_LIVE;
        nowWatchingLive.textContent = 'NOW PLAYING';
        nowWatchingBanner.appendChild(nowWatchingLive);

        const nowWatchingChannel = document.createElement('span');
        nowWatchingChannel.className = EPG_CLASSES.NOW_WATCHING_CHANNEL;
        nowWatchingBanner.appendChild(nowWatchingChannel);

        const nowWatchingProgram = document.createElement('span');
        nowWatchingProgram.className = EPG_CLASSES.NOW_WATCHING_PROGRAM;
        nowWatchingBanner.appendChild(nowWatchingProgram);

        const nowWatchingTime = document.createElement('span');
        nowWatchingTime.className = EPG_CLASSES.NOW_WATCHING_TIME;
        nowWatchingBanner.appendChild(nowWatchingTime);

        this.containerElement.replaceChildren(
            classicHeader,
            classicShowcase,
            overlayShowcase,
            grid,
            dashboardBottom
        );

        this.gridElement = grid;
        this.programAreaElement = programArea;
        this.classicHeaderElement = classicHeader;
        this.classicNowPlayingElement = classicNowPlaying;
        this.classicNowPlayingChannelElement = classicNowPlayingChannel;
        this.classicShowcaseElement = classicShowcase;
        this.nowWatchingBannerElement = nowWatchingBanner;
        this.nowWatchingChannelElement = nowWatchingChannel;
        this.nowWatchingProgramElement = nowWatchingProgram;
        this.nowWatchingTimeElement = nowWatchingTime;
        this.initializeProgramAreaOverlays();
        if (this.nowWatchingBannerElement) {
            this.nowWatchingBannerElement.hidden = true;
        }
    }

    private setAriaHidden(element: HTMLElement, hidden: boolean): void {
        if (hidden) {
            element.setAttribute('aria-hidden', 'true');
        } else {
            element.removeAttribute('aria-hidden');
        }
    }

    private syncClassicShellVisibility(): void {
        const header = this.classicHeaderElement;
        const showcase = this.classicShowcaseElement;
        const container = this.containerElement;
        if (!header || !showcase || !container) return;

        const mode: 'overlay' | 'classic' = this.config.layoutMode ?? 'classic';
        const isVisible = this.state.isVisible;
        const isClassicVisible = mode === 'classic' && isVisible;

        header.hidden = !isClassicVisible;
        showcase.hidden = !isClassicVisible;
        this.setAriaHidden(header, !isClassicVisible);
        this.setAriaHidden(showcase, !isClassicVisible);
    }

    private initializeProgramAreaOverlays(): void {
        if (!this.programAreaElement) return;

        const leftMask = document.createElement('div');
        leftMask.className = `${EPG_CLASSES.PROGRAM_EDGE_MASK} ${EPG_CLASSES.PROGRAM_EDGE_MASK_LEFT}`;
        leftMask.setAttribute('aria-hidden', 'true');
        this.programAreaElement.appendChild(leftMask);

        const rightMask = document.createElement('div');
        rightMask.className = `${EPG_CLASSES.PROGRAM_EDGE_MASK} ${EPG_CLASSES.PROGRAM_EDGE_MASK_RIGHT}`;
        rightMask.setAttribute('aria-hidden', 'true');
        this.programAreaElement.appendChild(rightMask);

        this.scrubLabelElement = document.createElement('div');
        this.scrubLabelElement.className = EPG_CLASSES.SCRUB_LABEL;
        this.scrubLabelElement.setAttribute('aria-hidden', 'true');
        this.scrubLabelElement.hidden = true;

        this.scrubLabelTitleElement = document.createElement('div');
        this.scrubLabelTitleElement.className = EPG_CLASSES.SCRUB_LABEL_TITLE;
        this.scrubLabelElement.appendChild(this.scrubLabelTitleElement);

        this.scrubLabelTimeElement = document.createElement('div');
        this.scrubLabelTimeElement.className = EPG_CLASSES.SCRUB_LABEL_TIME;
        this.scrubLabelElement.appendChild(this.scrubLabelTimeElement);

        this.scrubLabelChannelElement = document.createElement('div');
        this.scrubLabelChannelElement.className = EPG_CLASSES.SCRUB_LABEL_CHANNEL;
        this.scrubLabelElement.appendChild(this.scrubLabelChannelElement);

        this.programAreaElement.appendChild(this.scrubLabelElement);
    }

    /**
     * Create the current time indicator element.
     */
    private createTimeIndicator(): void {
        if (!this.programAreaElement) return;

        this.timeIndicatorElement = document.createElement('div');
        this.timeIndicatorElement.className = EPG_CLASSES.TIME_INDICATOR;
        // Attach to the translated content container so it scrolls horizontally with the grid.
        // (Appending to the program area would keep it fixed while the grid content translates.)
        const host = this.virtualizer.getContentElement() ?? this.programAreaElement;
        host.appendChild(this.timeIndicatorElement);

        this.updateTimeIndicatorPosition();
    }

    /**
     * Calculate the grid anchor time (start of schedule day, typically midnight).
     *
     * @param currentTime - Current time in milliseconds
     * @returns Anchor time (start of day) in milliseconds
     */
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
        this.state.gridAnchorTime = anchorTime;
        this.virtualizer.setGridAnchorTime(anchorTime);
        this.timeHeader.setGridAnchorTime(anchorTime);
        this.updateTimeIndicatorPosition();
        if (this.state.isVisible) {
            this.renderGrid();
        }
    }

    /**
     * Start the time update interval.
     */
    private startTimeUpdateInterval(): void {
        if (this.timeUpdateInterval) return;

        this.timeUpdateInterval = setInterval(() => {
            this._onTimeTick();
        }, EPG_CONSTANTS.TIME_INDICATOR_UPDATE_MS);
    }

    /**
     * Stop the time update interval.
     */
    private stopTimeUpdateInterval(): void {
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
            this.timeUpdateInterval = null;
        }
    }

    // ============================================
    // Visibility Methods
    // ============================================

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
        const mode: 'overlay' | 'classic' = this.config.layoutMode ?? 'classic';
        const didLayoutModeChange = mode !== this._appliedLayoutMode;
        if (didLayoutModeChange) {
            this._appliedLayoutMode = mode;
            if (mode === 'classic') {
                this.containerElement.classList.add(EPG_CLASSES.CONTAINER_CLASSIC);
            } else {
                this.containerElement.classList.remove(EPG_CLASSES.CONTAINER_CLASSIC);
            }
        }

        const pipMode: 'overlay' | 'classic' =
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
        this.lastVisibleRangeKey = null;
        this.syncPeekMode();
        this.applyLayoutMode();
        this.updateNowWatchingBanner();
        this.syncClassicShellVisibility();

        // Start time indicator updates (paused when hidden)
        this.startTimeUpdateInterval();
        document.addEventListener('visibilitychange', this._onVisibilityChange);

        const shouldPreserveFocus = Boolean(options?.preserveFocus && this.state.focusedCell);
        if (this.config.autoScrollToNow && !shouldPreserveFocus) {
            this.setTimeOffsetToNow();
        }

        this._refreshPixelsPerMinuteForCurrentViewport();
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

        if (this.isDebugEnabled()) {
            const payload = {
                channelCount: this.state.channels.length,
                scheduleCount: this.state.schedules.size,
                timeOffset: this.state.scrollPosition.timeOffset,
                gridAnchorTime: this.state.gridAnchorTime,
            };
            appendEpgDebugLog('EPG.show', payload);
        }

        this.emit('open', undefined);
    }

    /**
     * Hide the EPG overlay.
     */
    hide(): void {
        if (!this.containerElement) return;

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
        this.stopTimeUpdateInterval();
        document.removeEventListener('visibilitychange', this._onVisibilityChange);

        this.infoPanelCoordinator.clear();
        this.hideScrubLabel(true);
        this._isLibraryTabsFocused = false;
        this._libraryTabs?.destroy();
        this._libraryTabs = null;
        this.emit('close', undefined);
    }

    /**
     * Toggle EPG visibility.
     */
    toggle(): void {
        if (this.state.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Check if EPG is currently visible.
     *
     * @returns true if visible
     */
    isVisible(): boolean {
        return this.state.isVisible;
    }

    // ============================================
    // Data Loading Methods
    // ============================================

    /**
     * Load channel list into EPG.
     *
     * @param channels - Array of channel configurations
     */
    loadChannels(channels: ChannelConfig[]): void {
        this.state.channels = channels;
        this.channelIds = channels.map((c) => c.id);
        this.virtualizer.setChannelCount(channels.length);
        this.channelList.updateChannels(channels);
        this._placeholderAutoFocusKeys.clear();

        if (this.state.isVisible) {
            if (this.config.autoScrollToNow && this.state.scrollPosition.timeOffset === 0) {
                this.setTimeOffsetToNow();
            }
            if (!this.hasRenderedOnce) {
                this.renderGridInternal();
            } else {
                this.renderGrid();
            }
        }

        if (this.isDebugEnabled()) {
            const payload = {
                channelCount: channels.length,
                timeOffset: this.state.scrollPosition.timeOffset,
            };
            appendEpgDebugLog('EPG.loadChannels', payload);
        }
    }

    setCategoryColorsEnabled(enabled: boolean): void {
        this.channelList.setCategoryColorsEnabled(enabled);
        if (this.state.isVisible) {
            // Re-render visible rows only (virtualized pool), not all channels.
            this.channelList.updateChannels(this.state.channels);
        }
    }

    setLayoutMode(mode: 'overlay' | 'classic'): void {
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
        this.lastVisibleRangeKey = null;

        this._refreshPixelsPerMinuteForCurrentViewport();
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

    /**
     * Load schedule for a specific channel.
     *
     * @param channelId - Channel ID
     * @param schedule - Schedule window with programs
     */
    loadScheduleForChannel(channelId: string, schedule: ScheduleWindow): void {
        this.state.schedules.set(channelId, schedule);
        this.state.scheduleLoadTimes.set(channelId, Date.now());

        const focused = this.state.focusedCell;
        const isFocusedChannel = focused && this.state.channels[focused.channelIndex]?.id === channelId;
        const focusKeyBefore = this._getFocusKey(focused);
        let didAutoFocus = false;

        if (isFocusedChannel && focused && !this._isSelectInProgress) {
            if (focused.kind === 'program') {
                const stillExists = schedule.programs.some((program) =>
                    program.item.ratingKey === focused.program.item.ratingKey &&
                    program.scheduledStartTime === focused.program.scheduledStartTime
                );
                if (!stillExists) {
                    this.focusProgramAtTime(focused.channelIndex, this.state.focusTimeMs);
                    didAutoFocus = true;
                }
            } else if (focused.kind === 'placeholder') {
                const placeholderKey = `${channelId}-placeholder-${focused.placeholder.scheduledStartTime}`;
                if (!this._placeholderAutoFocusKeys.has(placeholderKey)) {
                    this._placeholderAutoFocusKeys.add(placeholderKey);
                    this.focusProgramAtTime(focused.channelIndex, focused.focusTimeMs);
                    didAutoFocus = true;
                }
            }
        }

        if (this.state.isVisible) {
            if (!this.hasRenderedOnce) {
                this.renderGridInternal();
            } else {
                this.renderGrid();
            }
        }

        if (this.isDebugEnabled()) {
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
            appendEpgDebugLog('EPG.loadScheduleForChannel', payload);
        }
    }

    /**
     * Clear all loaded schedules and schedule timestamps.
     */
    clearSchedules(): void {
        this.state.schedules.clear();
        this.state.scheduleLoadTimes.clear();
        this._placeholderAutoFocusKeys.clear();

        this.state.focusedCell = null;
        this.infoPanelCoordinator.clear();
        this.state.focusTimeMs = Date.now();

        if (this.state.isVisible) {
            this.renderGrid();
        }

        if (this.isDebugEnabled()) {
            const payload = {
                channelCount: this.state.channels.length,
            };
            appendEpgDebugLog('EPG.clearSchedules', payload);
        }
    }

    /**
     * Refresh the current time indicator position.
     */
    refreshCurrentTime(): void {
        this.state.currentTime = Date.now();
        this.updateTimeIndicatorPosition();
        this.virtualizer.updateTemporalClasses(this.state.currentTime);
    }

    private updateNowWatchingBanner(): void {
        const banner = this.nowWatchingBannerElement;
        if (!banner) return;
        const classicRail = this.classicNowPlayingElement;
        const classicRailChannel = this.classicNowPlayingChannelElement;
        const mode: 'overlay' | 'classic' = this.config.layoutMode ?? 'classic';

        if (!this.config.showNowWatchingBanner || !this.config.getCurrentChannelInfo) {
            if (classicRail) {
                classicRail.hidden = true;
            }
            if (!banner.hidden) {
                banner.hidden = true;
            }
            this._lastNowWatchingTuple = null;
            return;
        }

        const info = this.config.getCurrentChannelInfo();
        if (!info) {
            if (classicRail) {
                classicRail.hidden = true;
            }
            if (!banner.hidden) {
                banner.hidden = true;
            }
            this._lastNowWatchingTuple = null;
            return;
        }

        const channelName = typeof info.channelName === 'string' ? info.channelName.trim() : '';
        const channelText = channelName ? `${info.channelNumber} • ${channelName}` : String(info.channelNumber);
        const programText = typeof info.programTitle === 'string' ? info.programTitle : '';
        const rawTimeText = typeof info.timeLabel === 'string' ? info.timeLabel : '';
        const timeText = rawTimeText.includes('Invalid') ? '' : rawTimeText;
        const nextTuple: [string, string, string] = [channelText, programText, timeText];

        if (
            this._lastNowWatchingTuple &&
            this._lastNowWatchingTuple[0] === channelText &&
            this._lastNowWatchingTuple[1] === programText &&
            this._lastNowWatchingTuple[2] === timeText
        ) {
            if (mode === 'classic') {
                if (classicRail) {
                    classicRail.hidden = false;
                }
                banner.hidden = true;
            } else {
                if (classicRail) {
                    classicRail.hidden = true;
                }
                if (banner.hidden) {
                    banner.hidden = false;
                }
            }
            return;
        }

        if (classicRailChannel) {
            classicRailChannel.textContent = channelText;
        }
        if (this.nowWatchingChannelElement) {
            this.nowWatchingChannelElement.textContent = channelText;
        }
        if (this.nowWatchingProgramElement) {
            this.nowWatchingProgramElement.textContent = programText;
        }
        if (this.nowWatchingTimeElement) {
            this.nowWatchingTimeElement.textContent = timeText;
        }
        if (mode === 'classic') {
            if (classicRail) {
                classicRail.hidden = false;
            }
            banner.hidden = true;
        } else {
            if (classicRail) {
                classicRail.hidden = true;
            }
            banner.hidden = false;
        }
        this._lastNowWatchingTuple = nextTuple;
    }

    /**
     * Update the time indicator position.
     */
    private updateTimeIndicatorPosition(): void {
        if (!this.timeIndicatorElement || !this.config) return;

        const minutesFromAnchor = (this.state.currentTime - this.state.gridAnchorTime) / 60000;
        const left = minutesFromAnchor * this.config.pixelsPerMinute;

        this.timeIndicatorElement.style.left = `${left}px`;
    }

    // ============================================
    // Navigation Methods
    // ============================================

    /**
     * Focus a specific channel row.
     *
     * @param channelIndex - Channel index (0-based)
     */
    focusChannel(channelIndex: number): void {
        if (channelIndex < 0 || channelIndex >= this.state.channels.length) return;

        // Find first program in this channel's schedule
        const channel = this.state.channels[channelIndex];
        if (!channel) return;
        const schedule = this.state.schedules.get(channel.id);

        const targetTime = this.state.focusTimeMs || Date.now();
        if (schedule && schedule.programs.length > 0) {
            this.focusProgramAtTime(channelIndex, targetTime);
            return;
        }

        this.focusPlaceholder(channelIndex, targetTime);
    }

    /**
     * Focus a specific program cell.
     *
     * @param channelIndex - Channel index (0-based)
     * @param programIndex - Program index within channel
     */
    focusProgram(channelIndex: number, programIndex: number): void {
        if (channelIndex < 0 || channelIndex >= this.state.channels.length) return;

        const channel = this.state.channels[channelIndex];
        if (!channel) return;
        const schedule = this.state.schedules.get(channel.id);

        if (!schedule || programIndex < 0 || programIndex >= schedule.programs.length) return;

        const program = schedule.programs[programIndex];
        if (!program) return;

        // Update focus state
        const previousFocus = this.state.focusedCell;
        if (previousFocus && previousFocus.cellElement) {
            previousFocus.cellElement.classList.remove(EPG_CLASSES.CELL_FOCUSED);
        }

        // Ensure cell is visible (may require scrolling/render)
        const didScroll = this.ensureCellVisible(channelIndex, program);

        const focusTimeMs = this.getProgramFocusTime(program);
        this.state.focusTimeMs = focusTimeMs;
        // Set the focusedCell state BEFORE rendering so renderGridInternal() can correctly
        // apply focus styling to the new target (and not the previous focused cell).
        this.state.focusedCell = {
            kind: 'program',
            channelIndex,
            programIndex,
            program,
            focusTimeMs,
            cellElement: null,
        };

        // Update channel list focus
        this.channelList.setFocusedChannel(channelIndex);

        // Update info panel
        this.infoPanelCoordinator.syncFocusedProgram(program);

        // Try to focus immediately if the cell is already rendered; otherwise let renderGridInternal()
        // render it and then apply focus styling.
        const cellElement = this.virtualizer.setFocusedCell(
            channel.id,
            program.scheduledStartTime,
            focusTimeMs
        );
        this.state.focusedCell.cellElement = cellElement;
        if (didScroll || !cellElement) {
            this.renderGridInternal();
        }

        // Emit focus change event
        this.emit('focusChange', this.state.focusedCell);
    }

    /**
     * Focus the currently airing program on the current channel.
     */
    focusNow(): void {
        const now = Date.now();
        this.state.focusTimeMs = now;

        // EPG window is anchored to "now"; do not scroll back into the past.
        this.state.scrollPosition.timeOffset = 0;
        this.timeHeader.updateScrollPosition(this.state.scrollPosition.timeOffset);

        // Track if we focused a program (to avoid redundant render)
        let didFocus = false;

        // If we have a focused channel, find current program there
        const channelIndex = this.state.focusedCell
            ? this.state.focusedCell.channelIndex
            : 0;

        if (channelIndex >= 0 && channelIndex < this.state.channels.length) {
            const channel = this.state.channels[channelIndex];
            if (channel) {
                const schedule = this.state.schedules.get(channel.id);

                if (schedule) {
                    const currentProgramIndex = schedule.programs.findIndex(
                        (p) => now >= p.scheduledStartTime && now < p.scheduledEndTime
                    );

                    if (currentProgramIndex >= 0) {
                        this.focusProgram(channelIndex, currentProgramIndex);
                        didFocus = true;
                    }
                }
            }
        }

        // Only render if focusProgram wasn't called (it already renders)
        if (!didFocus) {
            this.renderGrid();
        }
    }

    /**
     * Scroll the grid to a specific time.
     *
     * @param time - Unix timestamp (ms)
     */
    scrollToTime(time: number): void {
        const previousOffset = this.state.scrollPosition.timeOffset;
        const minutesFromAnchor = (time - this.state.gridAnchorTime) / 60000;
        this.state.scrollPosition.timeOffset = Math.max(0, minutesFromAnchor);
        this.state.focusTimeMs = time;

        this.timeHeader.updateScrollPosition(this.state.scrollPosition.timeOffset);
        this.renderGrid();

        this.emit('timeScroll', {
            direction: this.state.scrollPosition.timeOffset >= previousOffset ? 'right' : 'left',
            newOffset: this.state.scrollPosition.timeOffset,
        });
    }

    /**
     * Scroll the grid to a specific channel.
     *
     * @param channelIndex - Channel index (0-based)
     */
    scrollToChannel(channelIndex: number): void {
        const previousOffset = this.state.scrollPosition.channelOffset;
        const maxOffset = Math.max(0, this.state.channels.length - this.config.visibleChannels);
        this.state.scrollPosition.channelOffset = Math.max(0, Math.min(channelIndex, maxOffset));

        this.channelList.updateScrollPosition(this.state.scrollPosition.channelOffset);
        this.renderGrid();

        this.emit('channelScroll', {
            direction: this.state.scrollPosition.channelOffset >= previousOffset ? 'down' : 'up',
            newOffset: this.state.scrollPosition.channelOffset,
        });
    }

    /**
     * Ensure a cell is visible by scrolling if needed.
     *
     * @param channelIndex - Channel index
     * @param program - Program to make visible
     */
    private ensureCellVisible(channelIndex: number, program: ScheduledProgram): boolean {
        const { scrollPosition } = this.state;
        const { visibleHours, totalHours } = this.config;
        let didScroll = this.ensureChannelVisible(channelIndex);

        // Check horizontal visibility
        const programStartMinutes = (program.scheduledStartTime - this.state.gridAnchorTime) / 60000;
        const programEndMinutes = (program.scheduledEndTime - this.state.gridAnchorTime) / 60000;
        const visibleEndMinutes = scrollPosition.timeOffset + (visibleHours * 60);
        const maxOffset = Math.max(0, (totalHours * 60) - (visibleHours * 60));
        const clampTimeOffset = (minutes: number): number => Math.max(0, Math.min(minutes, maxOffset));

        if (programStartMinutes < scrollPosition.timeOffset) {
            this.state.scrollPosition.timeOffset = clampTimeOffset(programStartMinutes);
            this.timeHeader.updateScrollPosition(this.state.scrollPosition.timeOffset);
            didScroll = true;
        } else if (programEndMinutes > visibleEndMinutes) {
            this.state.scrollPosition.timeOffset = clampTimeOffset(programEndMinutes - (visibleHours * 60));
            this.timeHeader.updateScrollPosition(this.state.scrollPosition.timeOffset);
            didScroll = true;
        }

        return didScroll;
    }

    private ensureTimeVisible(targetTimeMs: number): boolean {
        const { visibleHours, totalHours } = this.config;
        const minutesFromAnchor = (targetTimeMs - this.state.gridAnchorTime) / 60000;
        const maxOffset = Math.max(0, (totalHours * 60) - (visibleHours * 60));
        const clampOffset = (minutes: number): number => Math.max(0, Math.min(minutes, maxOffset));
        let didScroll = false;

        if (minutesFromAnchor < this.state.scrollPosition.timeOffset) {
            this.state.scrollPosition.timeOffset = clampOffset(minutesFromAnchor);
            this.timeHeader.updateScrollPosition(this.state.scrollPosition.timeOffset);
            didScroll = true;
        } else if (minutesFromAnchor > this.state.scrollPosition.timeOffset + (visibleHours * 60)) {
            this.state.scrollPosition.timeOffset = clampOffset(minutesFromAnchor - (visibleHours * 60));
            this.timeHeader.updateScrollPosition(this.state.scrollPosition.timeOffset);
            didScroll = true;
        }

        return didScroll;
    }

    private getProgramFocusTime(program: ScheduledProgram): number {
        const start = program.scheduledStartTime;
        const end = program.scheduledEndTime;
        const elapsed = typeof program.elapsedMs === 'number' ? program.elapsedMs : 0;
        const candidate = start + Math.max(0, elapsed);
        return Math.min(Math.max(candidate, start), Math.max(start, end - 1));
    }

    private focusPlaceholder(channelIndex: number, targetTime: number): void {
        if (channelIndex < 0 || channelIndex >= this.state.channels.length) return;

        this.ensureChannelVisible(channelIndex);
        this.ensureTimeVisible(targetTime);

        const visibleStartMs = this.state.gridAnchorTime + (this.state.scrollPosition.timeOffset * 60000);
        const visibleEndMs = this.state.gridAnchorTime +
            ((this.state.scrollPosition.timeOffset + (this.config.visibleHours * 60)) * 60000);
        const clampedTime = Math.min(Math.max(targetTime, visibleStartMs), Math.max(visibleStartMs, visibleEndMs - 1));

        this.state.focusTimeMs = clampedTime;
        this.state.focusedCell = {
            kind: 'placeholder',
            channelIndex,
            programIndex: -1,
            placeholder: {
                label: 'Loading...',
                scheduledStartTime: visibleStartMs,
                scheduledEndTime: visibleEndMs,
            },
            focusTimeMs: clampedTime,
            cellElement: null,
        };

        this.channelList.setFocusedChannel(channelIndex);
        this.infoPanelCoordinator.clear();
        this.renderGridInternal();
        this.emit('focusChange', this.state.focusedCell);
    }

    private ensureChannelVisible(channelIndex: number): boolean {
        const { visibleChannels } = this.config;
        const { channelOffset } = this.state.scrollPosition;
        let didScroll = false;

        if (channelIndex < channelOffset) {
            const maxOffset = Math.max(0, this.state.channels.length - visibleChannels);
            this.state.scrollPosition.channelOffset = Math.max(0, Math.min(channelIndex, maxOffset));
            this.channelList.updateScrollPosition(this.state.scrollPosition.channelOffset);
            didScroll = true;
        } else if (channelIndex >= channelOffset + visibleChannels) {
            const targetOffset = channelIndex - visibleChannels + 1;
            const maxOffset = Math.max(0, this.state.channels.length - visibleChannels);
            this.state.scrollPosition.channelOffset = Math.max(0, Math.min(targetOffset, maxOffset));
            this.channelList.updateScrollPosition(this.state.scrollPosition.channelOffset);
            didScroll = true;
        }

        return didScroll;
    }

    // ============================================
    // Input Handling Methods
    // ============================================

    /**
     * Handle D-pad navigation input.
     *
     * @param direction - Navigation direction
     * @returns true if navigation was handled, false if at boundary
     */
    handleNavigation(direction: 'up' | 'down' | 'left' | 'right'): boolean {
        if (this._isLibraryTabsFocused) {
            if (!this._libraryTabs || !this._libraryTabs.isVisible()) {
                this._isLibraryTabsFocused = false;
                this._libraryTabs?.setPillFocused(false);
                return false;
            }
            if (this._libraryTabs.isPickerOpen()) {
                switch (direction) {
                    case 'up':
                        this._libraryTabs.moveFocus(-1);
                        return true;
                    case 'down':
                        this._libraryTabs.moveFocus(1);
                        return true;
                    case 'left':
                    case 'right':
                        return true;
                    default:
                        return false;
                }
            }
            switch (direction) {
                case 'down':
                    this._isLibraryTabsFocused = false;
                    this._libraryTabs.setPillFocused(false);
                    this.focusProgramAtTime(0, this.state.focusTimeMs);
                    return true;
                case 'left':
                case 'right':
                    return true;
                case 'up':
                default:
                    return false;
            }
        }

        const { focusedCell, channels } = this.state;

        // If no focus, focus first visible cell
        if (!focusedCell) {
            if (channels.length > 0) {
                const targetTime = this.state.gridAnchorTime +
                    (this.state.scrollPosition.timeOffset * 60000);
                this.focusProgramAtTime(this.state.scrollPosition.channelOffset, targetTime);
                return true;
            }
            return false;
        }

        switch (direction) {
            case 'up':
                return this.handleVerticalNavigation('up');
            case 'down':
                return this.handleVerticalNavigation('down');
            case 'left':
                return this.handleHorizontalNavigation('left');
            case 'right':
                return this.handleHorizontalNavigation('right');
            default:
                return false;
        }
    }

    private handleVerticalNavigation(direction: 'up' | 'down'): boolean {
        const handled = direction === 'up' ? this.navigateUp() : this.navigateDown();
        if (handled) {
            this.hideScrubLabel(true);
        }
        return handled;
    }

    private handleHorizontalNavigation(direction: 'left' | 'right'): boolean {
        const handled = direction === 'left' ? this.navigateLeft() : this.navigateRight();
        if (handled) {
            this.showScrubLabelForFocusedProgram();
        }
        return handled;
    }

    private showScrubLabelForFocusedProgram(): void {
        if (
            !this.scrubLabelElement ||
            !this.scrubLabelTitleElement ||
            !this.scrubLabelTimeElement ||
            !this.scrubLabelChannelElement
        ) {
            return;
        }

        const focusedCell = this.state.focusedCell;
        if (!focusedCell || focusedCell.kind !== 'program') {
            this.hideScrubLabel(true);
            return;
        }

        const channel = this.state.channels[focusedCell.channelIndex];
        const channelLabel = channel
            ? `${channel.number} • ${channel.name}`
            : '';
        const program = focusedCell.program;
        const key = `${program.item.ratingKey}::${program.scheduledStartTime}`;

        this.scrubLabelTitleElement.textContent = program.item.title;
        this.scrubLabelTimeElement.textContent = formatTimeRange(
            program.scheduledStartTime,
            program.scheduledEndTime
        );
        this.scrubLabelChannelElement.textContent = channelLabel;

        this.state.isScrubbingHorizontally = true;
        this.state.scrubLabelProgramKey = key;
        this.scrubLabelElement.hidden = false;
        this.scrubLabelElement.classList.add(EPG_CLASSES.SCRUB_LABEL_VISIBLE);
        this.scheduleScrubLabelHide();
    }

    private scheduleScrubLabelHide(): void {
        if (this.scrubLabelHideTimer !== null) {
            clearTimeout(this.scrubLabelHideTimer);
        }
        this.scrubLabelHideTimer = setTimeout(() => {
            this.hideScrubLabel(false);
        }, 450);
    }

    private hideScrubLabel(clearTimer: boolean): void {
        if (this.scrubLabelHideTimer !== null) {
            if (clearTimer) {
                clearTimeout(this.scrubLabelHideTimer);
            }
            this.scrubLabelHideTimer = null;
        }

        this.state.isScrubbingHorizontally = false;
        this.state.scrubLabelProgramKey = null;
        if (!this.scrubLabelElement) return;
        this.scrubLabelElement.classList.remove(EPG_CLASSES.SCRUB_LABEL_VISIBLE);
        this.scrubLabelElement.hidden = true;
    }

    /**
     * Page up/down by a screenful of channels while preserving time focus.
     */
    handlePage(direction: 'up' | 'down'): boolean {
        if (!this.isVisible()) return false;
        if (!this.config) return false;
        if (this.state.channels.length === 0) return false;

        const focused = this.state.focusedCell;
        const baseChannelIndex = focused
            ? focused.channelIndex
            : this.state.scrollPosition.channelOffset;
        const focusedTimeMs = focused?.focusTimeMs;
        const baseTimeMs = Number.isFinite(focusedTimeMs)
            ? (focusedTimeMs as number)
            : Number.isFinite(this.state.focusTimeMs)
                ? (this.state.focusTimeMs as number)
                : this.state.gridAnchorTime + (this.state.scrollPosition.timeOffset * 60000);

        const pageSize = Math.max(1, this.config.visibleChannels);
        const delta = direction === 'down' ? pageSize : -pageSize;
        const targetChannelIndex = Math.max(
            0,
            Math.min(baseChannelIndex + delta, this.state.channels.length - 1)
        );
        if (targetChannelIndex === baseChannelIndex) {
            return false;
        }

        this.focusProgramAtTime(targetChannelIndex, baseTimeMs);
        this.hideScrubLabel(true);
        return true;
    }

    /**
     * Navigate up to previous channel.
     */
    private navigateUp(): boolean {
        const { focusedCell } = this.state;
        if (!focusedCell) return false;

        if (focusedCell.channelIndex > 0) {
            const prevChannel = focusedCell.channelIndex - 1;
            const targetTime = focusedCell.focusTimeMs ?? this.state.focusTimeMs;
            this.focusProgramAtTime(prevChannel, targetTime);
            return true;
        }

        if (focusedCell.channelIndex === 0 && this._libraryTabs?.isVisible()) {
            this._isLibraryTabsFocused = true;
            this._libraryTabs.setFocusedToSelected();
            this._libraryTabs.setPillFocused(true);
            return true;
        }

        const lastIndex = this.state.channels.length - 1;
        if (lastIndex < 0) return false;
        this.channelList.flashWrapCue();
        const targetTime = focusedCell.focusTimeMs ?? this.state.focusTimeMs;
        this.focusProgramAtTime(lastIndex, targetTime);
        return true;
    }

    /**
     * Navigate down to next channel.
     */
    private navigateDown(): boolean {
        const { focusedCell, channels } = this.state;
        if (!focusedCell) return false;

        if (focusedCell.channelIndex < channels.length - 1) {
            const nextChannel = focusedCell.channelIndex + 1;
            const targetTime = focusedCell.focusTimeMs ?? this.state.focusTimeMs;
            this.focusProgramAtTime(nextChannel, targetTime);
            return true;
        }

        if (channels.length === 0) return false;
        this.channelList.flashWrapCue();
        const targetTime = focusedCell.focusTimeMs ?? this.state.focusTimeMs;
        this.focusProgramAtTime(0, targetTime);
        return true;
    }

    /**
     * Navigate left to previous program.
     */
    private navigateLeft(): boolean {
        const { focusedCell } = this.state;
        if (!focusedCell) return false;

        if (focusedCell.kind === 'placeholder') {
            const nextTime = Math.max(
                this.state.gridAnchorTime,
                focusedCell.focusTimeMs - (EPG_CONSTANTS.TIME_SCROLL_AMOUNT * 60000)
            );
            if (nextTime === focusedCell.focusTimeMs && this.state.scrollPosition.timeOffset === 0) {
                return false;
            }
            this.focusPlaceholder(focusedCell.channelIndex, nextTime);
            return true;
        }

        if (focusedCell.programIndex > 0) {
            this.focusProgram(focusedCell.channelIndex, focusedCell.programIndex - 1);
            return true;
        }

        // At left edge - check if we can scroll back in time
        const minutesFromAnchor = (focusedCell.program.scheduledStartTime - this.state.gridAnchorTime) / 60000;
        if (minutesFromAnchor <= 0) {
            return false; // At start of schedule day
        }

        // Scroll time back
        this.state.scrollPosition.timeOffset = Math.max(
            0,
            this.state.scrollPosition.timeOffset - EPG_CONSTANTS.TIME_SCROLL_AMOUNT
        );
        this.timeHeader.updateScrollPosition(this.state.scrollPosition.timeOffset);
        this.renderGrid();

        // Find program that ends at or before the current program's start
        const channel = this.state.channels[focusedCell.channelIndex];
        if (channel) {
            const schedule = this.state.schedules.get(channel.id);
            if (schedule) {
                // Find the program immediately before the currently focused one
                // Use reverse search since programs are ordered by time
                let prevIndex = -1;
                for (let i = schedule.programs.length - 1; i >= 0; i--) {
                    const p = schedule.programs[i];
                    if (p && p.scheduledEndTime <= focusedCell.program.scheduledStartTime) {
                        prevIndex = i;
                        break;
                    }
                }

                if (prevIndex >= 0) {
                    this.focusProgram(focusedCell.channelIndex, prevIndex);
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Navigate right to next program.
     */
    private navigateRight(): boolean {
        const { focusedCell } = this.state;
        if (!focusedCell) return false;

        if (focusedCell.kind === 'placeholder') {
            const nextTime = focusedCell.focusTimeMs + (EPG_CONSTANTS.TIME_SCROLL_AMOUNT * 60000);
            this.focusPlaceholder(focusedCell.channelIndex, nextTime);
            return true;
        }

        const channel = this.state.channels[focusedCell.channelIndex];
        if (!channel) return false;
        const schedule = this.state.schedules.get(channel.id);

        if (!schedule) return false;

        if (focusedCell.programIndex < schedule.programs.length - 1) {
            this.focusProgram(focusedCell.channelIndex, focusedCell.programIndex + 1);
            return true;
        }

        // At right edge - check if we're at end of schedule day
        const programEndMinutes = (focusedCell.program.scheduledEndTime - this.state.gridAnchorTime) / 60000;
        const maxMinutes = this.config.totalHours * 60;

        if (programEndMinutes >= maxMinutes) {
            return false; // At end of schedule day
        }

        // Scroll time forward
        this.state.scrollPosition.timeOffset += EPG_CONSTANTS.TIME_SCROLL_AMOUNT;
        this.timeHeader.updateScrollPosition(this.state.scrollPosition.timeOffset);
        this.renderGrid();

        // Find and focus the next program after the current one
        const nextIndex = schedule.programs.findIndex(
            (p) => p.scheduledStartTime >= focusedCell.program.scheduledEndTime
        );
        if (nextIndex >= 0) {
            this.focusProgram(focusedCell.channelIndex, nextIndex);
        }

        return true;
    }

    /**
     * Focus program at a specific time on a channel.
     *
     * @param channelIndex - Channel index
     * @param targetTime - Target time (Unix ms)
     */
    private focusProgramAtTime(channelIndex: number, targetTime: number): void {
        const channel = this.state.channels[channelIndex];
        if (!channel) return;

        const schedule = this.state.schedules.get(channel.id);
        if (!schedule || schedule.programs.length === 0) {
            this.focusPlaceholder(channelIndex, targetTime);
            return;
        }

        this.state.focusTimeMs = targetTime;

        // Find program containing the target time
        let programIndex = schedule.programs.findIndex(
            (p) => targetTime >= p.scheduledStartTime && targetTime < p.scheduledEndTime
        );

        // If not found, find nearest program
        if (programIndex < 0) {
            programIndex = schedule.programs.findIndex(
                (p) => p.scheduledStartTime >= targetTime
            );
            if (programIndex < 0) {
                programIndex = schedule.programs.length - 1;
            }
        }

        this.focusProgram(channelIndex, programIndex);
    }

    /**
     * Handle OK/Select button press.
     *
     * @returns true if handled
     */
    handleSelect(): boolean {
        if (this._isLibraryTabsFocused) {
            if (this._libraryTabs) {
                this._libraryTabs.selectFocused();
                return true;
            }
            return false;
        }

        const { focusedCell } = this.state;
        if (!focusedCell) return false;

        const channel = this.state.channels[focusedCell.channelIndex];
        if (!channel) return false;

        this._isSelectInProgress = true;
        window.setTimeout(() => {
            this._isSelectInProgress = false;
        }, 0);

        if (this.isDebugEnabled()) {
            const payload = {
                channelId: channel.id,
                focusKey: this._getFocusKey(focusedCell),
                ratingKey: focusedCell.kind === 'program' ? focusedCell.program.item.ratingKey : null,
                scheduledStartTime:
                    focusedCell.kind === 'program'
                        ? focusedCell.program.scheduledStartTime
                        : focusedCell.placeholder.scheduledStartTime,
                scheduledEndTime:
                    focusedCell.kind === 'program'
                        ? focusedCell.program.scheduledEndTime
                        : focusedCell.placeholder.scheduledEndTime,
                focusedKind: focusedCell.kind,
                scheduleLoaded: this.state.schedules.has(channel.id),
            };
            appendEpgDebugLog('EPG.handleSelect', payload);
        }

        if (focusedCell.kind === 'placeholder') {
            return false;
        }

        this.emit('channelSelected', {
            channel,
            program: focusedCell.program,
        });

        this.emit('programSelected', focusedCell.program);

        return true;
    }

    /**
     * Handle Back button press.
     *
     * @returns true if handled (closes EPG), false if already hidden
     */
    handleBack(): boolean {
        if (this._libraryTabs?.isPickerOpen()) {
            this._libraryTabs.closePicker();
            return true;
        }
        if (this.state.isVisible) {
            this.hide();
            return true;
        }
        return false;
    }

    // ============================================
    // State Methods
    // ============================================

    /**
     * Get current EPG state.
     *
     * @returns Current EPG state
     */
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
        if (!focusedCell) return null;
        const channel = this.state.channels[focusedCell.channelIndex];
        if (!channel) return null;
        if (focusedCell.kind === 'program') {
            return `${channel.id}-${focusedCell.program.scheduledStartTime}`;
        }
        return `${channel.id}-placeholder-${focusedCell.placeholder.scheduledStartTime}`;
    }

    /**
     * Get the currently focused program.
     *
     * @returns Focused program or null
     */
    getFocusedProgram(): ScheduledProgram | null {
        if (this.state.focusedCell?.kind !== 'program') {
            return null;
        }
        return this.state.focusedCell.program;
    }

    // ============================================
    // Rendering Methods
    // ============================================

    /**
     * Render the visible portion of the grid (throttled for 60fps).
     */
    private renderGrid(): void {
        this.throttledRenderGrid();
    }

    /**
     * Internal render implementation called by throttled wrapper.
     */
    private renderGridInternal(): void {
        if (!this.state.isVisible || !this.state.isInitialized) return;

        this.errorBoundary.wrap('RENDER_ERROR', 'renderGrid', () => {
            this.refreshCurrentTime();
            this.timeHeader.updateScrollPosition(this.state.scrollPosition.timeOffset);
            this.virtualizer.updateScrollPosition(this.state.scrollPosition.timeOffset);
            const range = this.virtualizer.calculateVisibleRange(this.state.scrollPosition);
            this.maybeEmitVisibleRange();
            const channelIds = this.channelIds;
            const focused = this.state.focusedCell;
            const focusedChannel = focused ? this.state.channels[focused.channelIndex] : undefined;
            const focusedKey = this._getFocusKey(focused) ?? undefined;

            this.virtualizer.renderVisibleCells(
                channelIds,
                this.state.schedules,
                range,
                focusedKey,
                this.state.currentTime
            );

            // Ensure focus styling is applied after (re)rendering.
            if (focused && focusedChannel) {
                const focusStartTime = focused.kind === 'program'
                    ? focused.program.scheduledStartTime
                    : focused.placeholder.scheduledStartTime;
                focused.cellElement = this.virtualizer.setFocusedCell(
                    focusedChannel.id,
                    focusStartTime,
                    focused.focusTimeMs
                );
            }

            if (channelIds.length > 0) {
                this.hasRenderedOnce = true;
            }

            if (this.isDebugEnabled()) {
                const now = Date.now();
                const intervalMs = this.config.debugRenderGridLogIntervalMs ?? 1000;
                const shouldLog = intervalMs <= 0 || now - this._lastRenderGridDebugLogMs >= intervalMs;
                if (!shouldLog) {
                    return;
                }
                this._lastRenderGridDebugLogMs = now;
                const payload = {
                    channelCount: channelIds.length,
                    scheduleCount: this.state.schedules.size,
                    timeOffset: this.state.scrollPosition.timeOffset,
                    visibleRows: range.visibleRows.length,
                    renderedCells: this.virtualizer.getElementCount(),
                };
                appendEpgDebugLog('EPG.renderGrid', payload);
            }
        });
    }

    private _refreshPixelsPerMinuteForCurrentViewport(): void {
        if (!this.config.autoFitPixelsPerMinute || !this.programAreaElement) {
            return;
        }

        const width = this.programAreaElement.getBoundingClientRect().width;
        const minutesVisible = this.config.visibleHours * 60;
        const raw = minutesVisible > 0 ? width / minutesVisible : 0;
        const minPpm = this.config.minPixelsPerMinute ?? 6;
        const maxPpm = this.config.maxPixelsPerMinute ?? 12;

        if (!Number.isFinite(raw) || width <= 0) {
            return;
        }

        this.config.pixelsPerMinute = Math.min(maxPpm, Math.max(minPpm, Math.round(raw)));
        this.updateTimeIndicatorPosition();
    }

    private maybeEmitVisibleRange(): void {
        if (!this.config.onVisibleRangeChange) {
            return;
        }

        const rowBuffer = EPG_CONSTANTS.ROW_BUFFER;
        const channelStart = Math.max(0, this.state.scrollPosition.channelOffset - rowBuffer);
        const channelEnd = Math.min(
            this.state.scrollPosition.channelOffset + this.config.visibleChannels + rowBuffer,
            this.state.channels.length
        );
        const timeStartMs = this.state.gridAnchorTime + (this.state.scrollPosition.timeOffset * 60000);
        const timeEndMs = this.state.gridAnchorTime +
            ((this.state.scrollPosition.timeOffset + (this.config.visibleHours * 60)) * 60000);

        const rangeKey = `${channelStart}-${channelEnd}-${timeStartMs}-${timeEndMs}`;
        if (rangeKey === this.lastVisibleRangeKey) {
            return;
        }

        this.lastVisibleRangeKey = rangeKey;
        this.config.onVisibleRangeChange({
            channelStart,
            channelEnd,
            timeStartMs,
            timeEndMs,
        });
    }

    private setTimeOffsetToNow(): void {
        const now = Date.now();
        const minutesFromAnchor = (now - this.state.gridAnchorTime) / 60000;
        const centerOffset = minutesFromAnchor - (this.config.visibleHours * 60 / 2);
        this.state.scrollPosition.timeOffset = Math.max(0, centerOffset);
        this.state.focusTimeMs = now;
        this.timeHeader.updateScrollPosition(this.state.scrollPosition.timeOffset);
    }
}
