import { AppErrorCode } from '../../../../types/app-errors';
import { EPG_CONSTANTS, EPG_CLASSES } from '../constants';
import { rafThrottle } from '../utils';
import { EPGVisibleRangeEmitter } from '../view';
import type { EPGErrorBoundary, EPGTimeHeader, EPGVirtualizer } from '../view';
import type { EPGConfig, EPGFocusPosition, EPGInternalState, EpgVisibleRange } from '../types';

export type EPGGridRuntimeControllerContext = {
    getConfig: () => EPGConfig;
    getState: () => EPGInternalState;
    getProgramAreaElement: () => HTMLElement | null;
    getChannelIds: () => string[];
    getErrorBoundary: () => EPGErrorBoundary;
    getTimeHeader: () => EPGTimeHeader;
    getVirtualizer: () => EPGVirtualizer;
    getFocusKey: (focusedCell: EPGFocusPosition | null) => string | null;
    setHasRenderedOnce: (hasRenderedOnce: boolean) => void;
    updateNowWatchingBanner: () => void;
    syncPeekMode: () => void;
    applyLayoutMode: () => void;
    appendDebugLog: (event: string, payload: Record<string, unknown>) => void;
    isDebugEnabled: () => boolean;
};

export class EPGGridRuntimeController {
    private timeIndicatorElement: HTMLElement | null = null;
    private timeUpdateInterval: ReturnType<typeof setInterval> | null = null;
    private visibleRangeEmitter: EPGVisibleRangeEmitter = new EPGVisibleRangeEmitter();
    private lastRenderGridDebugLogMs = 0;
    private throttledRenderGrid = rafThrottle(() => this.renderGridInternal());

    private onVisibilityChange = (): void => {
        const state = this.context.getState();
        if (!state.isVisible) return;
        if (document.visibilityState === 'visible') {
            this.context.syncPeekMode();
            this.refreshCurrentTime();
            this.renderGrid();
        }
    };

    constructor(private readonly context: EPGGridRuntimeControllerContext) {}

    configure(config: EPGConfig): void {
        this.visibleRangeEmitter = new EPGVisibleRangeEmitter(config.onVisibleRangeChange);
    }

    destroy(): void {
        this.stopTimeUpdateInterval();
        this.removeVisibilityListener();
        this.timeIndicatorElement?.remove();
        this.timeIndicatorElement = null;
        this.visibleRangeEmitter = new EPGVisibleRangeEmitter();
        this.lastRenderGridDebugLogMs = 0;
    }

    resetVisibleRange(): void {
        this.visibleRangeEmitter.reset();
    }

    createTimeIndicator(): void {
        const programArea = this.context.getProgramAreaElement();
        if (!programArea) return;

        const host = this.context.getVirtualizer().getContentElement() ?? programArea;
        this.timeIndicatorElement?.remove();
        host.querySelectorAll(`.${EPG_CLASSES.TIME_INDICATOR}`).forEach((node) => {
            node.remove();
        });

        this.timeIndicatorElement = document.createElement('div');
        this.timeIndicatorElement.className = EPG_CLASSES.TIME_INDICATOR;
        host.appendChild(this.timeIndicatorElement);

        this.updateTimeIndicatorPosition();
    }

    setGridAnchorTime(anchorTime: number): void {
        const state = this.context.getState();
        state.gridAnchorTime = anchorTime;
        this.context.getVirtualizer().setGridAnchorTime(anchorTime);
        this.context.getTimeHeader().setGridAnchorTime(anchorTime);
        this.updateTimeIndicatorPosition();
        if (state.isVisible) {
            this.renderGrid();
        }
    }

    startTimeUpdateInterval(): void {
        if (this.timeUpdateInterval) return;

        this.timeUpdateInterval = setInterval(() => {
            this.refreshCurrentTime();
            this.context.updateNowWatchingBanner();
            this.context.syncPeekMode();
            this.context.applyLayoutMode();
        }, EPG_CONSTANTS.TIME_INDICATOR_UPDATE_MS);
    }

    stopTimeUpdateInterval(): void {
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
            this.timeUpdateInterval = null;
        }
    }

    addVisibilityListener(): void {
        document.addEventListener('visibilitychange', this.onVisibilityChange);
    }

    removeVisibilityListener(): void {
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }

    refreshCurrentTime(): void {
        const state = this.context.getState();
        state.currentTime = Date.now();
        this.updateTimeIndicatorPosition();
        this.context.getVirtualizer().updateTemporalClasses(state.currentTime);
    }

    renderGrid(): void {
        this.throttledRenderGrid();
    }

    renderGridInternal(): void {
        const state = this.context.getState();
        if (!state.isVisible || !state.isInitialized) return;

        this.context.getErrorBoundary().wrap(AppErrorCode.RENDER_ERROR, 'renderGrid', () => {
            this.refreshCurrentTime();
            this.context.getTimeHeader().updateScrollPosition(state.scrollPosition.timeOffset);
            this.context.getVirtualizer().updateScrollPosition(state.scrollPosition.timeOffset);
            const range = this.context.getVirtualizer().calculateVisibleRange(state.scrollPosition);
            this.maybeEmitVisibleRange();
            const channelIds = this.context.getChannelIds();
            const focused = state.focusedCell;
            const focusedChannel = focused ? state.channels[focused.channelIndex] : undefined;
            const focusedKey = this.context.getFocusKey(focused) ?? undefined;

            this.context.getVirtualizer().renderVisibleCells(
                channelIds,
                state.schedules,
                range,
                focusedKey,
                state.currentTime
            );

            if (focused && focusedChannel) {
                const focusStartTime = focused.kind === 'program'
                    ? focused.program.scheduledStartTime
                    : focused.placeholder.scheduledStartTime;
                focused.cellElement = this.context.getVirtualizer().setFocusedCell(
                    focusedChannel.id,
                    focusStartTime,
                    focused.focusTimeMs,
                    { syncTicker: state.isVisible }
                );
            }

            if (channelIds.length > 0) {
                this.context.setHasRenderedOnce(true);
            }

            if (this.context.isDebugEnabled()) {
                const now = Date.now();
                const intervalMs = this.context.getConfig().debugRenderGridLogIntervalMs ?? 1000;
                const shouldLog = intervalMs <= 0 || now - this.lastRenderGridDebugLogMs >= intervalMs;
                if (!shouldLog) {
                    return;
                }
                this.lastRenderGridDebugLogMs = now;
                const payload = {
                    channelCount: channelIds.length,
                    scheduleCount: state.schedules.size,
                    timeOffset: state.scrollPosition.timeOffset,
                    visibleRows: range.visibleRows.length,
                    renderedCells: this.context.getVirtualizer().getElementCount(),
                };
                this.context.appendDebugLog('EPG.renderGrid', payload);
            }
        });
    }

    refreshPixelsPerMinuteForCurrentViewport(): void {
        const config = this.context.getConfig();
        const programArea = this.context.getProgramAreaElement();
        if (!config.autoFitPixelsPerMinute || !programArea) {
            return;
        }

        const width = programArea.getBoundingClientRect().width;
        const minutesVisible = config.visibleHours * 60;
        const raw = minutesVisible > 0 ? width / minutesVisible : 0;
        const minPpm = config.minPixelsPerMinute ?? 6;
        const maxPpm = config.maxPixelsPerMinute ?? 12;

        if (!Number.isFinite(raw) || width <= 0) {
            return;
        }

        config.pixelsPerMinute = Math.min(maxPpm, Math.max(minPpm, Math.round(raw)));
        this.updateTimeIndicatorPosition();
    }

    setTimeOffsetToNow(): void {
        const config = this.context.getConfig();
        const state = this.context.getState();
        const now = Date.now();
        const minutesFromAnchor = (now - state.gridAnchorTime) / 60000;
        const centerOffset = minutesFromAnchor - (config.visibleHours * 60 / 2);
        state.scrollPosition.timeOffset = this.clampTimeOffset(centerOffset);
        state.focusTimeMs = now;
        this.context.getTimeHeader().updateScrollPosition(state.scrollPosition.timeOffset);
        this.context.getVirtualizer().updateScrollPosition(state.scrollPosition.timeOffset);
        if (state.isVisible && state.isInitialized) {
            this.renderGridInternal();
        }
    }

    updateTimeIndicatorPosition(): void {
        const config = this.context.getConfig();
        const state = this.context.getState();
        if (!this.timeIndicatorElement || !config) return;

        const minutesFromAnchor = (state.currentTime - state.gridAnchorTime) / 60000;
        const left = minutesFromAnchor * config.pixelsPerMinute;

        this.timeIndicatorElement.style.left = `${left}px`;
    }

    private maybeEmitVisibleRange(): void {
        const config = this.context.getConfig();
        const state = this.context.getState();
        if (!config.onVisibleRangeChange) {
            return;
        }

        const rowBuffer = EPG_CONSTANTS.ROW_BUFFER;
        const channelStart = Math.max(0, state.scrollPosition.channelOffset - rowBuffer);
        const channelEnd = Math.min(
            state.scrollPosition.channelOffset + config.visibleChannels + rowBuffer,
            state.channels.length
        );
        const timeStartMs = state.gridAnchorTime + (state.scrollPosition.timeOffset * 60000);
        const timeEndMs = state.gridAnchorTime +
            ((state.scrollPosition.timeOffset + (config.visibleHours * 60)) * 60000);

        const range: EpgVisibleRange = {
            channelStart,
            channelEnd,
            timeStartMs,
            timeEndMs,
        };

        this.visibleRangeEmitter.emit(range);
    }

    private getMaxTimeOffsetMinutes(): number {
        const config = this.context.getConfig();
        return Math.max(0, (config.totalHours * 60) - (config.visibleHours * 60));
    }

    private clampTimeOffset(minutes: number): number {
        return Math.max(0, Math.min(minutes, this.getMaxTimeOffsetMinutes()));
    }
}
