/**
 * @fileoverview EPG Virtualizer - DOM element pooling and virtualized rendering
 * @module modules/ui/epg/EPGVirtualizer
 * @version 1.0.0
 *
 * Implements virtualized grid rendering to maintain <200 DOM elements
 * regardless of channel/program count. See ADR-003 for rationale.
 */

import { EPG_CONSTANTS, EPG_CLASSES } from './constants';
import { formatCellTimeLabel, appendEpgDebugLog } from './utils';
import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import type {
    ScheduledProgram,
    ScheduleWindow,
    EPGConfig,
    EPGProgramCell,
    VirtualizedGridState,
    CellRenderData,
} from './types';

/**
 * Calculates cell position from program timing.
 * Pure function for deterministic positioning.
 *
 * @param program - The scheduled program
 * @param gridAnchorTime - Start time of the grid (Unix ms)
 * @param pixelsPerMinute - Scaling factor for width
 * @param now - Current time (Unix ms), defaults to Date.now()
 * @returns EPGProgramCell with position data
 */
export function positionCell(
    program: ScheduledProgram,
    gridAnchorTime: number,
    pixelsPerMinute: number = EPG_CONSTANTS.PIXELS_PER_MINUTE,
    now: number = Date.now()
): EPGProgramCell {
    const minutesFromStart = (program.scheduledStartTime - gridAnchorTime) / 60000;
    const durationMinutes = (program.scheduledEndTime - program.scheduledStartTime) / 60000;

    return {
        program,
        left: minutesFromStart * pixelsPerMinute,
        width: Math.max(durationMinutes * pixelsPerMinute, 20), // Minimum 20px width
        isPartial: false, // Will be set by caller based on visible range
        isCurrent: now >= program.scheduledStartTime && now < program.scheduledEndTime,
        isFocused: false,
    };
}

const TEXT_GUTTER_PX = 12;
const TEXT_RIGHT_GUTTER_PX = 12;
const TIER_WIDE_MIN_PX = 220;
const TIER_MEDIUM_MIN_PX = 140;
const TIER_NARROW_MIN_PX = 88;

type CellWidthTier = 'wide' | 'medium' | 'narrow' | 'tiny';

type VisibleTextMetrics = {
    visibleLeftPx: number;
    visibleRightPx: number;
    visibleWidthPx: number;
    safeTextShiftPx: number;
    isLeftClippedByCell: boolean;
    isLeftClippedByScroll: boolean;
};

type CellChildren = {
    title: HTMLElement | null;
    time: HTMLElement | null;
    meta: HTMLElement | null;
    episode: HTMLElement | null;
    subtitle: HTMLElement | null;
    liveBadge: HTMLElement | null;
};

/**
 * EPG Virtualizer class.
 * Manages DOM element pooling and efficient grid rendering.
 */
export class EPGVirtualizer {
    private config: EPGConfig | null = null;
    private gridContainer: HTMLElement | null = null;
    private contentElement: HTMLElement | null = null;
    private gridAnchorTime: number = 0;
    private channelOffset: number = 0;

    /** Pool of recycled DOM elements */
    private elementPool: Map<string, HTMLElement> = new Map();

    /** Currently visible cells */
    private visibleCells: Map<string, CellRenderData> = new Map();

    private cellChildrenCache: WeakMap<HTMLElement, CellChildren> = new WeakMap();

    /** Total channel count */
    private totalChannels: number = 0;
    private isDebugEnabled(): boolean {
        try {
            return localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_DEBUG) === '1';
        } catch {
            return false;
        }
    }

    /**
     * Initialize the virtualizer.
     *
     * @param gridContainer - The grid container element
     * @param config - EPG configuration
     * @param gridAnchorTime - Start time of the schedule day (Unix ms)
     */
    initialize(
        gridContainer: HTMLElement,
        config: EPGConfig,
        gridAnchorTime: number
    ): void {
        if (this.contentElement) {
            this.contentElement.remove();
            this.contentElement = null;
        }
        this.gridContainer = gridContainer;
        this.config = config;
        this.gridAnchorTime = gridAnchorTime;
        this.channelOffset = 0;
        this.totalChannels = 0;
        this.elementPool.clear();
        this.visibleCells.clear();
        this.cellChildrenCache = new WeakMap();
        this.contentElement = document.createElement('div');
        this.contentElement.style.position = 'relative';
        this.contentElement.style.width = '100%';
        this.contentElement.style.height = '100%';
        this.gridContainer.appendChild(this.contentElement);
    }

    /**
     * Destroy the virtualizer and clean up resources.
     */
    destroy(): void {
        this.forceRecycleAll();
        this.elementPool.clear();
        this.visibleCells.clear();
        if (this.contentElement) {
            this.contentElement.remove();
        }
        this.contentElement = null;
        this.gridContainer = null;
        this.config = null;
    }

    /**
     * Set total channel count for range calculations.
     *
     * @param count - Number of channels
     */
    setChannelCount(count: number): void {
        this.totalChannels = count;
    }

    /**
     * Update the grid anchor time.
     *
     * @param anchorTime - New anchor time (Unix ms)
     */
    setGridAnchorTime(anchorTime: number): void {
        this.gridAnchorTime = anchorTime;
    }

    /**
     * Calculate visible range based on scroll position.
     * Adds buffer rows and time buffer for smooth scrolling.
     *
     * @param scrollPosition - Current scroll position
     * @returns Visible range with row indices and time window
     */
    calculateVisibleRange(scrollPosition: {
        channelOffset: number;
        timeOffset: number;
    }): VirtualizedGridState {
        const config = this.config;
        if (!config) {
            return {
                visibleRows: [],
                channelOffset: 0,
                visibleTimeRange: { start: 0, end: 0 },
                recycledElements: this.elementPool,
            };
        }

        const rowBuffer = EPG_CONSTANTS.ROW_BUFFER;
        const timeBuffer = EPG_CONSTANTS.TIME_BUFFER_MINUTES;

        const clampedOffset = Math.max(
            0,
            Math.min(scrollPosition.channelOffset, Math.max(0, this.totalChannels - 1))
        );
        const startRow = Math.max(0, clampedOffset - rowBuffer);
        const endRow = Math.min(
            this.totalChannels,
            clampedOffset + config.visibleChannels + rowBuffer
        );

        const visibleRows: number[] = [];
        for (let i = startRow; i < endRow; i++) {
            visibleRows.push(i);
        }

        return {
            visibleRows,
            channelOffset: clampedOffset,
            visibleTimeRange: {
                start: scrollPosition.timeOffset - timeBuffer,
                end: scrollPosition.timeOffset + (config.visibleHours * 60) + timeBuffer,
            },
            recycledElements: this.elementPool,
        };
    }

    /**
     * Check if a program overlaps with a time range.
     *
     * @param program - The scheduled program
     * @param timeRange - Time range in minutes from anchor
     * @returns true if program overlaps the range
     */
    private overlapsTimeRange(
        program: ScheduledProgram,
        timeRange: { start: number; end: number }
    ): boolean {
        const programStartMinutes = (program.scheduledStartTime - this.gridAnchorTime) / 60000;
        const programEndMinutes = (program.scheduledEndTime - this.gridAnchorTime) / 60000;

        return programEndMinutes > timeRange.start && programStartMinutes < timeRange.end;
    }

    private addPlaceholderCell(
        channelId: string,
        rowIndex: number,
        startMinutes: number,
        endMinutes: number,
        label: string,
        addCell: (cellData: CellRenderData, isFocusedCell: boolean) => void
    ): void {
        if (!this.config) return;

        const normalizedStart = Math.max(0, startMinutes);
        const normalizedEnd = Math.max(normalizedStart, endMinutes);
        if (normalizedEnd <= normalizedStart) return;

        const scheduledStartTime = this.gridAnchorTime + (normalizedStart * 60000);
        const scheduledEndTime = this.gridAnchorTime + (normalizedEnd * 60000);
        const cellKey = `${channelId}-placeholder-${scheduledStartTime}`;
        const left = normalizedStart * this.config.pixelsPerMinute;
        const width = Math.max((normalizedEnd - normalizedStart) * this.config.pixelsPerMinute, 20);
        addCell({
            kind: 'placeholder',
            key: cellKey,
            channelId,
            rowIndex,
            placeholder: {
                label,
                scheduledStartTime,
                scheduledEndTime,
            },
            left,
            width,
            isPartial: false,
            isCurrent: false,
            isPast: false,
            isFocused: false,
            textShiftPx: 0,
            cellElement: null,
        }, false);
    }

    /**
     * Render visible cells with DOM recycling.
     * Main virtualization entry point.
     *
     * @param channelIds - Ordered array of channel IDs
     * @param schedules - Map of channel ID to schedule window
     * @param range - Visible range from calculateVisibleRange
     */
    renderVisibleCells(
        channelIds: string[],
        schedules: Map<string, ScheduleWindow>,
        range: VirtualizedGridState,
        focusedCellKey?: string
    ): void {
        if (!this.contentElement || !this.config) return;

        this.channelOffset = range.channelOffset;

        const newVisibleCells = new Map<string, CellRenderData>();
        const now = Date.now();
        const maxDomElements = EPG_CONSTANTS.MAX_DOM_ELEMENTS;
        const visibleRowCount = Math.max(1, range.visibleRows.length);
        const perRowLimit = Math.max(1, Math.ceil(maxDomElements / visibleRowCount));
        const perRowCounts = new Map<number, number>();
        const timeBuffer = EPG_CONSTANTS.TIME_BUFFER_MINUTES;
        const visibleWindowStartMinutes = range.visibleTimeRange.start + timeBuffer;
        const visibleWindowEndMinutes = range.visibleTimeRange.end - timeBuffer;

        const addCell = (cellData: CellRenderData, isFocusedCell: boolean): void => {
            const currentRowCount = perRowCounts.get(cellData.rowIndex) ?? 0;

            if (!isFocusedCell) {
                if (newVisibleCells.size >= maxDomElements) {
                    return;
                }
                if (currentRowCount >= perRowLimit) {
                    return;
                }
            }

            newVisibleCells.set(cellData.key, cellData);
            if (!isFocusedCell) {
                perRowCounts.set(cellData.rowIndex, currentRowCount + 1);
            }
        };

        // Determine needed cells
        for (const rowIndex of range.visibleRows) {
            if (rowIndex >= channelIds.length) continue;

            const channelId = channelIds[rowIndex];
            if (channelId === undefined) continue;
            const schedule = schedules.get(channelId);
            if (!schedule) {
                this.addPlaceholderCell(
                    channelId,
                    rowIndex,
                    Math.max(0, visibleWindowStartMinutes),
                    Math.max(0, visibleWindowEndMinutes),
                    'Loading...',
                    addCell
                );
                continue;
            }

            let hadVisibleOverlap = false;
            const visibleWindowStartMs = this.gridAnchorTime + (Math.max(0, visibleWindowStartMinutes) * 60000);
            const visibleWindowEndMs = this.gridAnchorTime + (Math.max(0, visibleWindowEndMinutes) * 60000);
            let lastCoveredTimeMs = visibleWindowStartMs;

            for (const program of schedule.programs) {
                if (this.overlapsTimeRange(program, range.visibleTimeRange)) {
                    const cellKey = `${channelId}-${program.scheduledStartTime}`;
                    const isFocusedCell = focusedCellKey === cellKey;
                    const overlapsVisibleWindow = program.scheduledEndTime > visibleWindowStartMs &&
                        program.scheduledStartTime < visibleWindowEndMs;
                    if (overlapsVisibleWindow) {
                        hadVisibleOverlap = true;
                    }

                    const cell = positionCell(program, this.gridAnchorTime, this.config.pixelsPerMinute);
                    const isCurrent = now >= program.scheduledStartTime && now < program.scheduledEndTime;
                    const isPast = now >= program.scheduledEndTime;
                    const rawLeft = cell.left;
                    // If the program started before the visible guide window, clip to the left edge (no past).
                    let left = rawLeft;
                    let width = cell.width;
                    const wasLeftClipped = rawLeft < 0;
                    if (wasLeftClipped) {
                        width = Math.max(20, width + left);
                        left = 0;
                    }

                    // Compute isPartial: true if program is clipped by visible window
                    const programStartMinutes = (program.scheduledStartTime - this.gridAnchorTime) / 60000;
                    const programEndMinutes = (program.scheduledEndTime - this.gridAnchorTime) / 60000;
                    const isPartial =
                        programStartMinutes < visibleWindowStartMinutes ||
                        programEndMinutes > visibleWindowEndMinutes;
                    const textMetrics = this.computeVisibleTextMetrics({
                        rawLeftPx: rawLeft,
                        clippedLeftPx: left,
                        clippedWidthPx: width,
                        visibleWindowStartMinutes,
                        visibleWindowEndMinutes,
                    });
                    const textShiftPx = textMetrics.safeTextShiftPx;

                    addCell({
                        kind: 'program',
                        key: cellKey,
                        channelId,
                        rowIndex,
                        program,
                        left,
                        width,
                        isPartial,
                        isCurrent,
                        isPast,
                        isFocused: isFocusedCell,
                        textShiftPx,
                        cellElement: null,
                    }, isFocusedCell);

                    if (overlapsVisibleWindow && program.scheduledStartTime > lastCoveredTimeMs) {
                        const gapEndMs = Math.min(program.scheduledStartTime, visibleWindowEndMs);
                        if (gapEndMs > lastCoveredTimeMs) {
                            this.addPlaceholderCell(
                                channelId,
                                rowIndex,
                                (lastCoveredTimeMs - this.gridAnchorTime) / 60000,
                                (gapEndMs - this.gridAnchorTime) / 60000,
                                'No Program',
                                addCell
                            );
                        }
                    }

                    if (overlapsVisibleWindow) {
                        lastCoveredTimeMs = Math.max(lastCoveredTimeMs, program.scheduledEndTime);
                    }
                }
            }

            if (!hadVisibleOverlap) {
                this.addPlaceholderCell(
                    channelId,
                    rowIndex,
                    Math.max(0, visibleWindowStartMinutes),
                    Math.max(0, visibleWindowEndMinutes),
                    'No Program',
                    addCell
                );
            } else if (lastCoveredTimeMs < visibleWindowEndMs) {
                this.addPlaceholderCell(
                    channelId,
                    rowIndex,
                    (lastCoveredTimeMs - this.gridAnchorTime) / 60000,
                    Math.max(0, visibleWindowEndMinutes),
                    'No Program',
                    addCell
                );
            }
        }

        // Ensure we never exceed the DOM cap; preferentially keep focused cell if present.
        while (newVisibleCells.size > maxDomElements) {
            let removed = false;
            for (const key of newVisibleCells.keys()) {
                if (key !== focusedCellKey) {
                    newVisibleCells.delete(key);
                    removed = true;
                    break;
                }
            }
            if (!removed) {
                break;
            }
        }

        // Recycle cells no longer visible
        for (const [key, cellData] of this.visibleCells) {
            if (!newVisibleCells.has(key)) {
                this.recycleElement(key, cellData);
            }
        }

        // Render new cells
        for (const [key, cellData] of newVisibleCells) {
            const existing = this.visibleCells.get(key);
            if (existing && existing.cellElement) {
                // Reuse existing element, update position and content
                cellData.cellElement = existing.cellElement;
                this.updateCellPosition(cellData);
                this.updateCellContent(cellData);
            } else {
                // Render new cell
                this.renderCell(key, cellData);
            }
        }

        this.visibleCells = newVisibleCells;

        if (this.isDebugEnabled()) {
            let placeholderCount = 0;
            for (const key of newVisibleCells.keys()) {
                if (key.includes('-placeholder-')) {
                    placeholderCount += 1;
                }
            }
            const payload = {
                renderedCells: newVisibleCells.size,
                placeholders: placeholderCount,
                visibleRows: range.visibleRows.length,
                timeOffset: range.visibleTimeRange.start + EPG_CONSTANTS.TIME_BUFFER_MINUTES,
            };
            appendEpgDebugLog('EPGVirtualizer.render', payload);
        }
    }

    /**
     * Get an element from the pool or create a new one.
     * Pool elements are cleaned before reuse.
     *
     * @returns A DOM element ready for use
     */
    private getOrCreateElement(): HTMLElement {
        // Check pool for reusable element
        for (const [key, element] of this.elementPool) {
            this.elementPool.delete(key);
            this.resetElement(element);
            return element;
        }

        // Create new element if pool is empty
        const element = document.createElement('div');
        element.className = EPG_CLASSES.CELL;
        element.innerHTML = `
            <div class="${EPG_CLASSES.CELL_CONTENT}">
                <div class="${EPG_CLASSES.CELL_META}">
                    <span class="${EPG_CLASSES.CELL_EPISODE}"></span>
                </div>
                <div class="${EPG_CLASSES.CELL_TITLE}"></div>
                <div class="${EPG_CLASSES.CELL_SUBTITLE}"></div>
            </div>
            <div class="${EPG_CLASSES.CELL_RAIL}">
                <span class="${EPG_CLASSES.LIVE_BADGE}" hidden aria-label="Currently playing"></span>
                <div class="${EPG_CLASSES.CELL_TIME}"></div>
            </div>
        `;
        // Prime cache for stable cell structure to avoid repeated DOM queries in hot paths.
        void this.getCellChildren(element);
        return element;
    }

    /**
     * Return an element to the pool for later reuse.
     * If pool exceeds MAX_POOL_SIZE, oldest entries are removed.
     *
     * @param _key - Cell key being recycled (unused, for debugging)
     * @param cellData - Cell data with element reference
     */
    private recycleElement(_key: string, cellData: CellRenderData): void {
        const element = cellData.cellElement;
        if (!element) return;

        // Remove from DOM but don't destroy
        element.remove();
        element.classList.remove(
            EPG_CLASSES.CELL_FOCUSED,
            EPG_CLASSES.CELL_CURRENT,
            EPG_CLASSES.CELL_LOADING
        );

        // Add to pool with unique key
        const poolKey = `pool-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        this.elementPool.set(poolKey, element);

        // Prevent pool from growing unbounded
        if (this.elementPool.size > EPG_CONSTANTS.MAX_POOL_SIZE) {
            const oldestKey = this.elementPool.keys().next().value;
            if (oldestKey !== undefined) {
                this.elementPool.delete(oldestKey);
            }
        }
    }

    /**
     * Reset element content for reuse.
     * Clears text content and inline styles, keeps structure.
     *
     * @param element - Element to reset
     */
    private resetElement(element: HTMLElement): void {
        const { meta, episode, subtitle, title, time, liveBadge } = this.getCellChildren(element);
        if (meta) {
            meta.style.display = 'none';
        }
        if (episode) {
            episode.textContent = '';
        }
        if (subtitle) {
            subtitle.textContent = '';
            subtitle.style.display = 'none';
        }
        if (title) title.textContent = '';
        if (time) {
            time.textContent = '';
            time.style.display = 'block';
        }
        if (liveBadge) {
            liveBadge.hidden = true;
            liveBadge.textContent = '';
            liveBadge.classList.remove(EPG_CLASSES.CELL_LIVE_COMPACT);
        }
        if (time) {
            time.classList.remove(EPG_CLASSES.CELL_TIME_COMPACT);
        }

        // Reset positioning
        element.style.left = '';
        element.style.width = '';
        element.style.top = '';
        element.style.removeProperty('--epg-cell-text-shift-px');

        // Remove state classes
        element.classList.remove(
            EPG_CLASSES.CELL_FOCUSED,
            EPG_CLASSES.CELL_CURRENT,
            EPG_CLASSES.CELL_PAST,
            EPG_CLASSES.CELL_LOADING,
            EPG_CLASSES.CELL_TEXT_SHIFTED,
            EPG_CLASSES.CELL_TIER_WIDE,
            EPG_CLASSES.CELL_TIER_MEDIUM,
            EPG_CLASSES.CELL_TIER_NARROW,
            EPG_CLASSES.CELL_TIER_TINY
        );
        element.removeAttribute('data-key');
    }

    private updateCellTimeLabel(
        timeEl: HTMLElement | null,
        tier: CellWidthTier,
        cellData: CellRenderData,
        startTimeMs: number,
        endTimeMs: number
    ): void {
        if (!timeEl) return;

        const isCompactTime = tier === 'narrow' || tier === 'tiny';
        const forceFull = cellData.isFocused || cellData.isCurrent;
        timeEl.textContent = formatCellTimeLabel(startTimeMs, endTimeMs, { compact: isCompactTime, forceFull });
        timeEl.classList.toggle(EPG_CLASSES.CELL_TIME_COMPACT, isCompactTime && !forceFull);
    }

    private extractShowTitleFromFullTitle(fullTitle: string): string | null {
        const match = fullTitle.match(/^(.*?)\s-\sS\d{1,2}E\d{1,2}\s-/);
        if (!match) return null;
        const showTitle = match[1]?.trim() ?? '';
        return showTitle.length > 0 ? showTitle : null;
    }

    private formatEpisodeTag(item: ScheduledProgram['item']): string | null {
        if (item.type !== 'episode') return null;

        const season = item.seasonNumber;
        const episode = item.episodeNumber;
        if (typeof season === 'number' && typeof episode === 'number') {
            const s = String(season).padStart(2, '0');
            const e = String(episode).padStart(2, '0');
            return `S${s}E${e}`;
        }

        const text = `${item.title ?? ''} ${item.fullTitle ?? ''}`;
        const match = text.match(/\bS(\d{1,2})E(\d{1,2})\b/i);
        if (!match) return null;

        const s = match[1]!.padStart(2, '0');
        const e = match[2]!.padStart(2, '0');
        return `S${s}E${e}`;
    }

    private normalizeEpisodeTitleForSubtitle(title: string): string {
        return title.replace(/^\s*S\d{1,2}E\d{1,2}\s*-\s*/i, '').trim();
    }

    private getCellChildren(element: HTMLElement): CellChildren {
        const cached = this.cellChildrenCache.get(element);
        if (cached) {
            return cached;
        }
        const children = {
            title: element.querySelector(`.${EPG_CLASSES.CELL_TITLE}`) as HTMLElement | null,
            time: element.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement | null,
            meta: element.querySelector(`.${EPG_CLASSES.CELL_META}`) as HTMLElement | null,
            episode: element.querySelector(`.${EPG_CLASSES.CELL_EPISODE}`) as HTMLElement | null,
            subtitle: element.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE}`) as HTMLElement | null,
            liveBadge: element.querySelector(`.${EPG_CLASSES.LIVE_BADGE}`) as HTMLElement | null,
        };
        this.cellChildrenCache.set(element, children);
        return children;
    }

    private updateEpisodePresentation(children: CellChildren, cellData: CellRenderData): void {
        const { meta, episode, subtitle, title } = children;
        if (!meta || !episode) return;

        if (cellData.kind !== 'program') {
            episode.textContent = '';
            meta.style.display = 'none';
            if (subtitle) {
                subtitle.textContent = '';
                subtitle.style.display = 'none';
            }
            return;
        }

        const item = cellData.program.item;
        if (item.type !== 'episode') {
            episode.textContent = '';
            meta.style.display = 'none';
            if (subtitle) {
                subtitle.textContent = '';
                subtitle.style.display = 'none';
            }
            return;
        }

        const tag = this.formatEpisodeTag(item);
        if (tag) {
            episode.textContent = tag;
            meta.style.display = 'flex';
        } else {
            episode.textContent = '';
            meta.style.display = 'none';
        }

        const rawShowTitle = (item.showTitle ?? '').trim();
        const showTitle =
            rawShowTitle ||
            this.extractShowTitleFromFullTitle(item.fullTitle) ||
            '';
        const subtitleText = this.normalizeEpisodeTitleForSubtitle(item.title);

        if (title) {
            title.textContent = showTitle || item.title;
        }

        if (subtitle) {
            const shouldShowSubtitle =
                Boolean(showTitle) ||
                (subtitleText.length > 0 && subtitleText !== item.title);
            subtitle.textContent = shouldShowSubtitle ? subtitleText : '';
            subtitle.style.display = shouldShowSubtitle ? 'block' : 'none';
        }
    }

    private getCellWidthTier(width: number): CellWidthTier {
        if (width >= TIER_WIDE_MIN_PX) return 'wide';
        if (width >= TIER_MEDIUM_MIN_PX) return 'medium';
        if (width >= TIER_NARROW_MIN_PX) return 'narrow';
        return 'tiny';
    }

    private applyWidthTierPresentation(element: HTMLElement, children: CellChildren, tier: CellWidthTier): void {
        element.classList.remove(
            EPG_CLASSES.CELL_TIER_WIDE,
            EPG_CLASSES.CELL_TIER_MEDIUM,
            EPG_CLASSES.CELL_TIER_NARROW,
            EPG_CLASSES.CELL_TIER_TINY
        );

        const { time, meta, subtitle } = children;
        const hasMetaContent = (meta?.textContent ?? '').trim().length > 0;
        const hasSubtitleContent = (subtitle?.textContent ?? '').trim().length > 0;

        if (tier === 'wide') {
            element.classList.add(EPG_CLASSES.CELL_TIER_WIDE);
            if (meta) meta.style.display = hasMetaContent ? 'flex' : 'none';
            if (subtitle) subtitle.style.display = hasSubtitleContent ? 'block' : 'none';
            if (time) time.style.display = 'block';
        } else if (tier === 'medium') {
            element.classList.add(EPG_CLASSES.CELL_TIER_MEDIUM);
            if (meta) meta.style.display = 'none';
            if (subtitle) subtitle.style.display = hasSubtitleContent ? 'block' : 'none';
            if (time) time.style.display = 'block';
        } else if (tier === 'narrow' || tier === 'tiny') {
            if (tier === 'narrow') {
                element.classList.add(EPG_CLASSES.CELL_TIER_NARROW);
            } else {
                element.classList.add(EPG_CLASSES.CELL_TIER_TINY);
            }
            if (meta) meta.style.display = 'none';
            if (subtitle) subtitle.style.display = hasSubtitleContent ? 'block' : 'none';
            if (time) time.style.display = 'block';
        }
    }

    private computeVisibleTextMetrics(input: {
        rawLeftPx: number;
        clippedLeftPx: number;
        clippedWidthPx: number;
        visibleWindowStartMinutes: number;
        visibleWindowEndMinutes: number;
    }): VisibleTextMetrics {
        if (!this.config) {
            return {
                visibleLeftPx: 0,
                visibleRightPx: 0,
                visibleWidthPx: 0,
                safeTextShiftPx: 0,
                isLeftClippedByCell: false,
                isLeftClippedByScroll: false,
            };
        }

        const {
            rawLeftPx,
            clippedLeftPx,
            clippedWidthPx,
            visibleWindowStartMinutes,
            visibleWindowEndMinutes,
        } = input;
        const ppm = this.config.pixelsPerMinute;
        const clippedRightPx = clippedLeftPx + clippedWidthPx;
        const visibleWindowLeftPx = visibleWindowStartMinutes * ppm;
        const visibleWindowRightPx = visibleWindowEndMinutes * ppm;
        const visibleLeftPx = Math.max(clippedLeftPx, visibleWindowLeftPx);
        const visibleRightPx = Math.min(clippedRightPx, visibleWindowRightPx);
        const visibleWidthPx = Math.max(0, visibleRightPx - visibleLeftPx);
        const hiddenLeftPx = Math.max(0, visibleLeftPx - clippedLeftPx);
        const isLeftClippedByCell = rawLeftPx < 0;
        const isLeftClippedByScroll = hiddenLeftPx > 0;

        if (!isLeftClippedByScroll || visibleWidthPx <= 0) {
            return {
                visibleLeftPx,
                visibleRightPx,
                visibleWidthPx,
                safeTextShiftPx: 0,
                isLeftClippedByCell,
                isLeftClippedByScroll,
            };
        }

        const desiredShiftPx = hiddenLeftPx;
        const maxShiftPx = Math.max(0, clippedWidthPx - (TEXT_GUTTER_PX + TEXT_RIGHT_GUTTER_PX));
        const safeTextShiftPx = Math.max(0, Math.min(desiredShiftPx, maxShiftPx));

        return {
            visibleLeftPx,
            visibleRightPx,
            visibleWidthPx,
            safeTextShiftPx,
            isLeftClippedByCell,
            isLeftClippedByScroll,
        };
    }

    /**
     * Render a cell to the DOM using a pooled or new element.
     *
     * @param key - Unique cell key
     * @param cellData - Cell data to render
     */
    private renderCell(key: string, cellData: CellRenderData): void {
        if (!this.contentElement || !this.config) return;

        const element = this.getOrCreateElement();
        const children = this.getCellChildren(element);
        const tier = this.getCellWidthTier(cellData.width);

        // Set content
        if (cellData.kind === 'program') {
            const isEpisode = cellData.program.item.type === 'episode';
            if (children.title && !isEpisode) children.title.textContent = cellData.program.item.title;
            this.updateCellTimeLabel(
                children.time,
                tier,
                cellData,
                cellData.program.scheduledStartTime,
                cellData.program.scheduledEndTime
            );
            element.classList.remove(EPG_CLASSES.CELL_LOADING);
        } else {
            if (children.title) children.title.textContent = cellData.placeholder.label;
            this.updateCellTimeLabel(
                children.time,
                tier,
                cellData,
                cellData.placeholder.scheduledStartTime,
                cellData.placeholder.scheduledEndTime
            );
            element.classList.add(EPG_CLASSES.CELL_LOADING);
        }
        this.updateEpisodePresentation(children, cellData);
        this.applyWidthTierPresentation(element, children, tier);

        if (cellData.textShiftPx > 0) {
            element.classList.add(EPG_CLASSES.CELL_TEXT_SHIFTED);
            element.style.setProperty('--epg-cell-text-shift-px', `${cellData.textShiftPx}px`);
        } else {
            element.classList.remove(EPG_CLASSES.CELL_TEXT_SHIFTED);
            element.style.removeProperty('--epg-cell-text-shift-px');
        }

        // Calculate position
        element.style.left = `${cellData.left}px`;
        element.style.width = `${cellData.width}px`;
        element.style.top = `${(cellData.rowIndex - this.channelOffset) * this.config.rowHeight}px`;
        element.setAttribute('data-key', key);

        element.classList.toggle(EPG_CLASSES.CELL_FOCUSED, cellData.isFocused);

        // Mark current program
        if (cellData.isCurrent) {
            element.classList.add(EPG_CLASSES.CELL_CURRENT);
        }
        if (cellData.isPast) {
            element.classList.add(EPG_CLASSES.CELL_PAST);
        } else {
            element.classList.remove(EPG_CLASSES.CELL_PAST);
        }
        this.updateLiveBadge(element, cellData.isCurrent);

        // Append to grid
        this.contentElement.appendChild(element);
        cellData.cellElement = element;
    }

    /**
     * Update cell position without recreating.
     *
     * @param cellData - Cell data with updated position
     */
    private updateCellPosition(cellData: CellRenderData): void {
        const element = cellData.cellElement;
        if (!element || !this.config) return;

        if (cellData.textShiftPx > 0) {
            element.classList.add(EPG_CLASSES.CELL_TEXT_SHIFTED);
            element.style.setProperty('--epg-cell-text-shift-px', `${cellData.textShiftPx}px`);
        } else {
            element.classList.remove(EPG_CLASSES.CELL_TEXT_SHIFTED);
            element.style.removeProperty('--epg-cell-text-shift-px');
        }
        element.style.left = `${cellData.left}px`;
        element.style.width = `${cellData.width}px`;
        element.style.top = `${(cellData.rowIndex - this.channelOffset) * this.config.rowHeight}px`;

        element.classList.toggle(EPG_CLASSES.CELL_FOCUSED, cellData.isFocused);
        // Update current state
        if (cellData.isCurrent) {
            element.classList.add(EPG_CLASSES.CELL_CURRENT);
        } else {
            element.classList.remove(EPG_CLASSES.CELL_CURRENT);
        }
        if (cellData.isPast) {
            element.classList.add(EPG_CLASSES.CELL_PAST);
        } else {
            element.classList.remove(EPG_CLASSES.CELL_PAST);
        }
        this.updateLiveBadge(element, cellData.isCurrent);
    }

    updateTemporalClasses(nowMs: number): void {
        for (const cellData of this.visibleCells.values()) {
            const element = cellData.cellElement;
            if (cellData.kind === 'program') {
                const wasCurrent = cellData.isCurrent;
                const wasPast = cellData.isPast;
                const isCurrent = nowMs >= cellData.program.scheduledStartTime &&
                    nowMs < cellData.program.scheduledEndTime;
                const isPast = nowMs >= cellData.program.scheduledEndTime;
                cellData.isCurrent = isCurrent;
                cellData.isPast = isPast;
                if (element) {
                    if (isCurrent) {
                        element.classList.add(EPG_CLASSES.CELL_CURRENT);
                    } else {
                        element.classList.remove(EPG_CLASSES.CELL_CURRENT);
                    }
                    if (isPast) {
                        element.classList.add(EPG_CLASSES.CELL_PAST);
                    } else {
                        element.classList.remove(EPG_CLASSES.CELL_PAST);
                    }
                    if (wasCurrent !== isCurrent || wasPast !== isPast) {
                        this.updateCellContent(cellData);
                    }
                    this.updateLiveBadge(element, isCurrent);
                }
            } else if (element) {
                cellData.isCurrent = false;
                cellData.isPast = false;
                element.classList.remove(EPG_CLASSES.CELL_PAST, EPG_CLASSES.CELL_CURRENT);
                this.updateLiveBadge(element, false);
            }
        }
    }

    private updateLiveBadge(element: HTMLElement, isCurrent: boolean): void {
        const badge = this.getCellChildren(element).liveBadge;
        if (!badge) return;
        badge.hidden = !isCurrent;
        if (isCurrent) {
            if (!badge.classList.contains(EPG_CLASSES.CELL_LIVE_COMPACT)) {
                badge.textContent = 'LIVE';
            }
        } else {
            badge.textContent = '';
            badge.classList.remove(EPG_CLASSES.CELL_LIVE_COMPACT);
        }
    }

    /**
     * Update cell content (title and time).
     * Called on reused cells to ensure fresh data after schedule updates.
     *
     * @param cellData - Cell data with program info
     */
    private updateCellContent(cellData: CellRenderData): void {
        const element = cellData.cellElement;
        if (!element) return;

        const children = this.getCellChildren(element);
        const tier = this.getCellWidthTier(cellData.width);
        if (cellData.kind === 'program') {
            const isEpisode = cellData.program.item.type === 'episode';
            if (children.title && !isEpisode) children.title.textContent = cellData.program.item.title;
            this.updateCellTimeLabel(
                children.time,
                tier,
                cellData,
                cellData.program.scheduledStartTime,
                cellData.program.scheduledEndTime
            );
            element.classList.remove(EPG_CLASSES.CELL_LOADING);
        } else {
            if (children.title) children.title.textContent = cellData.placeholder.label;
            this.updateCellTimeLabel(
                children.time,
                tier,
                cellData,
                cellData.placeholder.scheduledStartTime,
                cellData.placeholder.scheduledEndTime
            );
            element.classList.add(EPG_CLASSES.CELL_LOADING);
        }
        this.updateEpisodePresentation(children, cellData);
        this.applyWidthTierPresentation(element, children, tier);
    }

    /**
     * Force recycle all elements when memory pressure detected.
     */
    forceRecycleAll(): void {
        for (const [key, cellData] of this.visibleCells) {
            this.recycleElement(key, cellData);
        }
        this.visibleCells.clear();

        // Clear pool completely to free memory
        this.elementPool.clear();
    }

    /**
     * Set focus on a cell element.
     *
     * @param channelId - Channel ID
     * @param programStartTime - Program start time (Unix ms)
     * @returns The focused element or null
     */
    setFocusedCell(channelId: string, programStartTime: number, focusTimeMs?: number): HTMLElement | null {
        const key = `${channelId}-${programStartTime}`;

        // Resolve target first so we can synchronize data + visual focus state in one pass.
        let targetCellData = this.visibleCells.get(key);
        if (!targetCellData) {
            const placeholderKey = `${channelId}-placeholder-${programStartTime}`;
            targetCellData = this.visibleCells.get(placeholderKey);
        }

        if (!targetCellData && focusTimeMs !== undefined) {
            for (const candidate of this.visibleCells.values()) {
                if (candidate.channelId !== channelId) {
                    continue;
                }
                const start = candidate.kind === 'program'
                    ? candidate.program.scheduledStartTime
                    : candidate.placeholder.scheduledStartTime;
                const end = candidate.kind === 'program'
                    ? candidate.program.scheduledEndTime
                    : candidate.placeholder.scheduledEndTime;
                if (focusTimeMs >= start && focusTimeMs < end) {
                    targetCellData = candidate;
                    break;
                }
            }
        }

        for (const candidate of this.visibleCells.values()) {
            const shouldFocus = candidate === targetCellData;
            const focusChanged = candidate.isFocused !== shouldFocus;
            candidate.isFocused = shouldFocus;

            if (!candidate.cellElement) continue;
            candidate.cellElement.classList.toggle(EPG_CLASSES.CELL_FOCUSED, shouldFocus);
            if (focusChanged) {
                this.updateCellContent(candidate);
                this.updateLiveBadge(candidate.cellElement, candidate.isCurrent);
            }
        }

        if (targetCellData?.cellElement) {
            return targetCellData.cellElement;
        }

        return null;
    }

    /**
     * Get the DOM element count (for testing).
     *
     * @returns Number of visible cell elements
     */
    getElementCount(): number {
        return this.visibleCells.size;
    }

    /**
     * Get pool size (for testing).
     *
     * @returns Number of elements in pool
     */
    getPoolSize(): number {
        return this.elementPool.size;
    }

    /**
     * Get the root content element that is translated for time scrolling.
     * Used for attaching overlays that should move with the grid (e.g. the "Now" line).
     */
    getContentElement(): HTMLElement | null {
        return this.contentElement;
    }

    updateScrollPosition(timeOffset: number): void {
        if (!this.contentElement || !this.config) return;
        const translateX = -(timeOffset * this.config.pixelsPerMinute);
        this.contentElement.style.transform = `translateX(${translateX}px)`;
    }
}
