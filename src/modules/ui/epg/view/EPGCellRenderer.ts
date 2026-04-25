import { EPG_CLASSES } from '../constants';
import { formatCellTimeLabel } from '../utils';
import type { CellRenderData, ScheduledProgram } from '../types';

const TEXT_GUTTER_PX = 12;
const TEXT_RIGHT_GUTTER_PX = 12;
const FOCUSED_TICKER_MIN_OVERFLOW_PX = 4;
const TIER_WIDE_MIN_PX = 220;
const TIER_MEDIUM_MIN_PX = 140;
const TIER_NARROW_MIN_PX = 88;
const FOCUSED_MOVIE_OVERLAY_CLASS = 'epg-cell-focused-movie-overlay';
const SLIVER_VISIBLE_WIDTH_MAX_PX = 56;

export type EPGCellWidthTier = 'wide' | 'medium' | 'narrow' | 'tiny';
type FocusedLayoutMode = 'normal' | 'compact';

export type EPGRenderedCellData = CellRenderData & {
    visibleWidthPx: number;
};

type CellChildren = {
    title: HTMLElement | null;
    titleText: HTMLElement | null;
    time: HTMLElement | null;
    meta: HTMLElement | null;
    episode: HTMLElement | null;
    subtitle: HTMLElement | null;
    subtitleText: HTMLElement | null;
    rail: HTMLElement | null;
    liveBadge: HTMLElement | null;
    progressFill: HTMLElement | null;
};

type CellTextLayout = {
    title: string;
    subtitle: string;
    showSubtitle: boolean;
    focusedCompactSubtitle?: string;
    focusedLayoutMode: FocusedLayoutMode;
};

type TickerTarget = {
    viewport: HTMLElement;
    content: HTMLElement;
    readyClass: string;
    runningClass: string;
    distanceVarName: string;
    durationVarName: string;
    supportsClampMeasurement: boolean;
};

export type EPGCellVisibleTextMetrics = {
    visibleLeftPx: number;
    visibleRightPx: number;
    visibleWidthPx: number;
    safeTextShiftPx: number;
    isLeftClippedByCell: boolean;
    isLeftClippedByScroll: boolean;
};

export class EPGCellRenderer {
    private cellChildrenCache: WeakMap<HTMLElement, CellChildren> = new WeakMap();
    private focusedTickerTimer: ReturnType<typeof setTimeout> | null = null;
    private focusedTickerTargets: TickerTarget[] = [];

    createElement(): HTMLElement {
        const element = document.createElement('div');
        element.className = EPG_CLASSES.CELL;
        const content = document.createElement('div');
        content.className = EPG_CLASSES.CELL_CONTENT;
        element.appendChild(content);

        const meta = document.createElement('div');
        meta.className = EPG_CLASSES.CELL_META;
        content.appendChild(meta);

        const episode = document.createElement('span');
        episode.className = EPG_CLASSES.CELL_EPISODE;
        meta.appendChild(episode);

        const title = document.createElement('div');
        title.className = EPG_CLASSES.CELL_TITLE;
        const titleText = document.createElement('span');
        titleText.className = EPG_CLASSES.CELL_TITLE_TEXT;
        title.appendChild(titleText);
        content.appendChild(title);

        const subtitle = document.createElement('div');
        subtitle.className = EPG_CLASSES.CELL_SUBTITLE;
        const subtitleText = document.createElement('span');
        subtitleText.className = EPG_CLASSES.CELL_SUBTITLE_TEXT;
        subtitle.appendChild(subtitleText);
        content.appendChild(subtitle);

        const rail = document.createElement('div');
        rail.className = EPG_CLASSES.CELL_RAIL;
        element.appendChild(rail);

        const liveBadge = document.createElement('span');
        liveBadge.className = EPG_CLASSES.LIVE_BADGE;
        liveBadge.hidden = true;
        liveBadge.setAttribute('aria-label', 'Currently playing');
        rail.appendChild(liveBadge);

        const time = document.createElement('div');
        time.className = EPG_CLASSES.CELL_TIME;
        rail.appendChild(time);

        const progress = document.createElement('div');
        progress.className = EPG_CLASSES.CELL_PROGRESS;
        element.appendChild(progress);

        const progressFill = document.createElement('div');
        progressFill.className = EPG_CLASSES.CELL_PROGRESS_FILL;
        progress.appendChild(progressFill);
        void this.getCellChildren(element);
        return element;
    }

    resetCache(): void {
        this.cellChildrenCache = new WeakMap();
    }

    resetElement(element: HTMLElement): void {
        const { meta, episode, subtitle, subtitleText, titleText, time, liveBadge, progressFill } = this.getCellChildren(element);
        this.clearFocusedTickersForElement(element);
        if (meta) {
            meta.style.display = 'none';
        }
        if (episode) {
            episode.textContent = '';
        }
        if (subtitle) {
            if (subtitleText) {
                subtitleText.textContent = '';
            }
            subtitle.style.display = 'none';
        }
        if (titleText) titleText.textContent = '';
        if (time) {
            time.textContent = '';
            time.style.display = 'block';
            time.classList.remove(EPG_CLASSES.CELL_TIME_COMPACT);
        }
        if (liveBadge) {
            liveBadge.hidden = true;
            liveBadge.textContent = '';
            liveBadge.classList.remove(EPG_CLASSES.CELL_LIVE_COMPACT);
        }
        if (progressFill) {
            progressFill.style.width = '0%';
        }

        element.style.left = '';
        element.style.width = '';
        element.style.top = '';
        element.style.removeProperty('--epg-cell-text-shift-px');

        element.classList.remove(
            EPG_CLASSES.CELL_FOCUSED,
            EPG_CLASSES.CELL_CURRENT,
            EPG_CLASSES.CELL_PAST,
            EPG_CLASSES.CELL_LOADING,
            EPG_CLASSES.CELL_TEXT_SHIFTED,
            FOCUSED_MOVIE_OVERLAY_CLASS,
            EPG_CLASSES.SLIVER_CELL_CLASS,
            EPG_CLASSES.CELL_TIER_WIDE,
            EPG_CLASSES.CELL_TIER_MEDIUM,
            EPG_CLASSES.CELL_TIER_NARROW,
            EPG_CLASSES.CELL_TIER_TINY
        );
        element.removeAttribute('data-key');
    }

    getCellWidthTier(width: number): EPGCellWidthTier {
        if (width >= TIER_WIDE_MIN_PX) return 'wide';
        if (width >= TIER_MEDIUM_MIN_PX) return 'medium';
        if (width >= TIER_NARROW_MIN_PX) return 'narrow';
        return 'tiny';
    }

    isSliverCell(cellData: EPGRenderedCellData): boolean {
        const renderedVisibleWidthPx = this.getRenderedVisibleWidthPx(cellData);
        return renderedVisibleWidthPx > 0 && renderedVisibleWidthPx <= SLIVER_VISIBLE_WIDTH_MAX_PX;
    }

    computeVisibleTextMetrics(input: {
        rawLeftPx: number;
        clippedLeftPx: number;
        clippedWidthPx: number;
        visibleWindowStartMinutes: number;
        visibleWindowEndMinutes: number;
        pixelsPerMinute: number;
    }): EPGCellVisibleTextMetrics {
        const {
            rawLeftPx,
            clippedLeftPx,
            clippedWidthPx,
            visibleWindowStartMinutes,
            visibleWindowEndMinutes,
            pixelsPerMinute,
        } = input;
        const clippedRightPx = clippedLeftPx + clippedWidthPx;
        const visibleWindowLeftPx = visibleWindowStartMinutes * pixelsPerMinute;
        const visibleWindowRightPx = visibleWindowEndMinutes * pixelsPerMinute;
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

    updateCellContent(cellData: EPGRenderedCellData, nowMs: number): void {
        const element = cellData.cellElement;
        if (!element) return;

        const children = this.getCellChildren(element);
        const tier = this.getCellWidthTier(cellData.width);
        const textLayout = this.getProgramCellTextLayout(cellData, cellData.isFocused);
        if (cellData.kind === 'program') {
            if (children.titleText) {
                children.titleText.textContent = textLayout.title;
            }
            this.updateCellTimeLabel(
                children.time,
                tier,
                cellData,
                cellData.program.scheduledStartTime,
                cellData.program.scheduledEndTime
            );
            element.classList.remove(EPG_CLASSES.CELL_LOADING);
        } else {
            if (children.titleText) children.titleText.textContent = cellData.placeholder.label;
            this.updateCellTimeLabel(
                children.time,
                tier,
                cellData,
                cellData.placeholder.scheduledStartTime,
                cellData.placeholder.scheduledEndTime
            );
            element.classList.add(EPG_CLASSES.CELL_LOADING);
        }
        this.updateEpisodePresentation(children, cellData, textLayout);
        this.applyWidthTierPresentation(element, children, tier, cellData, textLayout);
        this.updateLiveBadge(element, cellData.isCurrent);
        this.updateProgressPresentation(children, cellData, nowMs);
    }

    updatePositionPresentation(cellData: EPGRenderedCellData): void {
        const element = cellData.cellElement;
        if (!element) return;

        if (cellData.textShiftPx > 0) {
            element.classList.add(EPG_CLASSES.CELL_TEXT_SHIFTED);
            element.style.setProperty('--epg-cell-text-shift-px', `${cellData.textShiftPx}px`);
        } else {
            element.classList.remove(EPG_CLASSES.CELL_TEXT_SHIFTED);
            element.style.removeProperty('--epg-cell-text-shift-px');
        }

        element.classList.toggle(EPG_CLASSES.CELL_FOCUSED, cellData.isFocused);
        element.classList.toggle(EPG_CLASSES.CELL_CURRENT, cellData.isCurrent);
        element.classList.toggle(EPG_CLASSES.CELL_PAST, cellData.isPast);
        this.updateLiveBadge(element, cellData.isCurrent);
    }

    updateTemporalPresentation(cellData: EPGRenderedCellData, nowMs: number): void {
        const element = cellData.cellElement;
        if (!element) return;

        element.classList.toggle(EPG_CLASSES.CELL_CURRENT, cellData.isCurrent);
        element.classList.toggle(EPG_CLASSES.CELL_PAST, cellData.isPast);
        this.updateCellTimeLabelForCell(cellData);
        this.updateLiveBadge(element, cellData.isCurrent);
        this.updateProgressPresentation(this.getCellChildren(element), cellData, nowMs);
    }

    clearFocusedTickers(): void {
        if (this.focusedTickerTimer) {
            clearTimeout(this.focusedTickerTimer);
            this.focusedTickerTimer = null;
        }
        for (const target of this.focusedTickerTargets) {
            target.viewport.classList.remove(target.readyClass, target.runningClass);
            target.viewport.style.removeProperty(target.durationVarName);
            target.viewport.style.removeProperty(target.distanceVarName);
        }
        this.focusedTickerTargets = [];
    }

    clearFocusedTickersForElement(element: HTMLElement): void {
        if (this.focusedTickerTargets.some((target) => element.contains(target.viewport))) {
            this.clearFocusedTickers();
        }
    }

    syncFocusedTicker(focusedCell: EPGRenderedCellData | null): void {
        this.clearFocusedTickers();
        if (this.prefersReducedMotion()) return;
        if (!focusedCell?.cellElement) return;

        const focusedElement = focusedCell.cellElement;
        if (focusedElement.classList.contains(EPG_CLASSES.SLIVER_CELL_CLASS)) return;
        if (focusedCell.visibleWidthPx === 0) return;

        const children = this.getCellChildren(focusedElement);
        const targets = [
            this.buildTickerTarget(children.title, children.titleText, {
                readyClass: EPG_CLASSES.CELL_TITLE_TICKER_READY,
                runningClass: EPG_CLASSES.CELL_TITLE_TICKER_RUNNING,
                distanceVarName: '--epg-title-ticker-distance-px',
                durationVarName: '--epg-title-ticker-duration-ms',
                supportsClampMeasurement: true,
            }),
            this.buildTickerTarget(children.subtitle, children.subtitleText, {
                readyClass: EPG_CLASSES.CELL_SUBTITLE_TICKER_READY,
                runningClass: EPG_CLASSES.CELL_SUBTITLE_TICKER_RUNNING,
                distanceVarName: '--epg-subtitle-ticker-distance-px',
                durationVarName: '--epg-subtitle-ticker-duration-ms',
                supportsClampMeasurement: false,
            }),
        ].filter((target): target is TickerTarget => target !== null);
        if (targets.length === 0) return;

        const textShiftPx = Math.max(0, focusedCell.textShiftPx);
        const tier = this.getCellWidthTier(focusedCell.width);
        const activeTargets: TickerTarget[] = [];

        for (const target of targets) {
            const effectiveClientWidth = this.getEffectiveTickerClientWidth(
                target,
                focusedCell.width,
                focusedCell.visibleWidthPx,
                textShiftPx
            );
            const contentWidth = Math.max(target.content.scrollWidth, target.viewport.scrollWidth);
            const overflowPx = contentWidth - effectiveClientWidth;
            const clampHiddenPx = target.viewport.scrollHeight - target.viewport.clientHeight;
            const hasClampHiddenText =
                target.supportsClampMeasurement &&
                tier === 'tiny' &&
                clampHiddenPx > 2;

            if (overflowPx <= FOCUSED_TICKER_MIN_OVERFLOW_PX && !hasClampHiddenText) {
                continue;
            }

            const travelPx = hasClampHiddenText
                ? this.measureReadyStateTickerOverflow(
                    target,
                    focusedCell.width,
                    focusedCell.visibleWidthPx,
                    textShiftPx
                )
                : Math.max(overflowPx, 0);
            if (travelPx <= FOCUSED_TICKER_MIN_OVERFLOW_PX) {
                target.viewport.classList.remove(target.readyClass);
                continue;
            }

            const durationMs = Math.max(1600, Math.min(3200, travelPx * 30));
            target.viewport.classList.add(target.readyClass);
            target.viewport.style.setProperty(target.durationVarName, `${durationMs}ms`);
            target.viewport.style.setProperty(target.distanceVarName, `${travelPx}px`);
            activeTargets.push(target);
        }

        if (activeTargets.length === 0) {
            return;
        }

        this.focusedTickerTargets = activeTargets;
        this.focusedTickerTimer = setTimeout(() => {
            for (const target of this.focusedTickerTargets) {
                target.viewport.classList.add(target.runningClass);
            }
        }, 900);
    }

    private updateCellTimeLabel(
        timeEl: HTMLElement | null,
        tier: EPGCellWidthTier,
        cellData: CellRenderData,
        startTimeMs: number,
        endTimeMs: number
    ): void {
        if (!timeEl) return;

        const isCompactTime = tier === 'narrow' || tier === 'tiny';
        const forceFull = !isCompactTime && (cellData.isFocused || cellData.isCurrent);
        timeEl.textContent = formatCellTimeLabel(startTimeMs, endTimeMs, { compact: isCompactTime, forceFull });
        timeEl.classList.toggle(EPG_CLASSES.CELL_TIME_COMPACT, isCompactTime && !forceFull);
    }

    private updateCellTimeLabelForCell(cellData: CellRenderData): void {
        const element = cellData.cellElement;
        if (!element) return;

        const children = this.getCellChildren(element);
        const tier = this.getCellWidthTier(cellData.width);
        if (cellData.kind === 'program') {
            this.updateCellTimeLabel(
                children.time,
                tier,
                cellData,
                cellData.program.scheduledStartTime,
                cellData.program.scheduledEndTime
            );
        } else {
            this.updateCellTimeLabel(
                children.time,
                tier,
                cellData,
                cellData.placeholder.scheduledStartTime,
                cellData.placeholder.scheduledEndTime
            );
        }
    }

    private extractShowTitleFromFullTitle(fullTitle: string, episodeTitle?: string): string | null {
        const withEpisodeCode = fullTitle.match(/^(.*?)\s-\sS\d{1,2}E\d{1,2}\s-/i);
        if (withEpisodeCode) {
            const showTitle = withEpisodeCode[1]?.trim() ?? '';
            return showTitle.length > 0 ? showTitle : null;
        }

        const trimmedEpisodeTitle = episodeTitle?.trim() ?? '';
        if (trimmedEpisodeTitle.length > 0) {
            const episodeSuffix = ` - ${trimmedEpisodeTitle}`;
            if (fullTitle.endsWith(episodeSuffix)) {
                const showTitle = fullTitle.slice(0, -episodeSuffix.length).trim();
                return showTitle.length > 0 ? showTitle : null;
            }
        }

        return null;
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
            titleText: element.querySelector(`.${EPG_CLASSES.CELL_TITLE_TEXT}`) as HTMLElement | null,
            time: element.querySelector(`.${EPG_CLASSES.CELL_TIME}`) as HTMLElement | null,
            meta: element.querySelector(`.${EPG_CLASSES.CELL_META}`) as HTMLElement | null,
            episode: element.querySelector(`.${EPG_CLASSES.CELL_EPISODE}`) as HTMLElement | null,
            subtitle: element.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE}`) as HTMLElement | null,
            subtitleText: element.querySelector(`.${EPG_CLASSES.CELL_SUBTITLE_TEXT}`) as HTMLElement | null,
            rail: element.querySelector(`.${EPG_CLASSES.CELL_RAIL}`) as HTMLElement | null,
            liveBadge: element.querySelector(`.${EPG_CLASSES.LIVE_BADGE}`) as HTMLElement | null,
            progressFill: element.querySelector(`.${EPG_CLASSES.CELL_PROGRESS_FILL}`) as HTMLElement | null,
        };
        this.cellChildrenCache.set(element, children);
        return children;
    }

    private updateProgressPresentation(children: CellChildren, cellData: CellRenderData, nowMs: number): void {
        if (!children.progressFill) {
            return;
        }
        if (cellData.kind !== 'program' || !cellData.isCurrent) {
            children.progressFill.style.width = '0%';
            return;
        }

        const duration = cellData.program.scheduledEndTime - cellData.program.scheduledStartTime;
        if (duration <= 0) {
            children.progressFill.style.width = '0%';
            return;
        }

        const elapsed = nowMs - cellData.program.scheduledStartTime;
        const progress = Math.max(0, Math.min(100, (elapsed / duration) * 100));
        children.progressFill.style.width = `${progress.toFixed(2)}%`;
    }

    private getProgramCellTextLayout(
        cellData: CellRenderData,
        isFocused: boolean
    ): CellTextLayout {
        if (cellData.kind !== 'program') {
            return {
                title: cellData.placeholder.label,
                subtitle: '',
                showSubtitle: false,
                focusedLayoutMode: 'normal',
            };
        }

        const item = cellData.program.item;
        if (item.type !== 'episode') {
            const focusedFullTitle = item.fullTitle.trim();
            return {
                title: isFocused && focusedFullTitle.length > 0 ? focusedFullTitle : item.title,
                subtitle: '',
                showSubtitle: false,
                focusedCompactSubtitle: '',
                focusedLayoutMode: 'normal',
            };
        }

        const episodeTitle = this.normalizeEpisodeTitleForSubtitle(item.title);
        const showTitle = (item.showTitle ?? '').trim() ||
            this.extractShowTitleFromFullTitle(item.fullTitle, episodeTitle) ||
            '';
        const episodeTag = this.formatEpisodeTag(item);
        const focusedCompactSubtitle =
            episodeTitle.length > 0 && episodeTag ? `${episodeTag} - ${episodeTitle}` : episodeTitle;

        if (isFocused) {
            const title = showTitle || item.title;
            const showSubtitle = focusedCompactSubtitle.length > 0 && focusedCompactSubtitle !== title;
            return {
                title,
                subtitle: episodeTitle,
                showSubtitle,
                focusedCompactSubtitle,
                focusedLayoutMode: 'compact',
            };
        }

        const showSubtitle =
            Boolean(showTitle) || (episodeTitle.length > 0 && episodeTitle !== item.title);
        return {
            title: showTitle || item.title,
            subtitle: showSubtitle ? episodeTitle : '',
            showSubtitle,
            focusedCompactSubtitle,
            focusedLayoutMode: 'normal',
        };
    }

    private updateEpisodePresentation(
        children: CellChildren,
        cellData: CellRenderData,
        textLayout: CellTextLayout
    ): void {
        const { meta, episode, subtitle, subtitleText, titleText } = children;
        if (!meta || !episode) return;

        if (titleText) {
            titleText.textContent = textLayout.title;
        }

        if (cellData.kind !== 'program') {
            episode.textContent = '';
            meta.style.display = 'none';
            if (subtitle) {
                if (subtitleText) {
                    subtitleText.textContent = '';
                }
                subtitle.style.display = 'none';
            }
            return;
        }

        const item = cellData.program.item;
        if (item.type !== 'episode') {
            episode.textContent = '';
            meta.style.display = 'none';
            if (subtitle) {
                if (subtitleText) {
                    subtitleText.textContent = '';
                }
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

        if (subtitle) {
            const shouldInlineEpisodeTag = textLayout.focusedLayoutMode === 'compact';
            const subtitleValue = shouldInlineEpisodeTag && textLayout.focusedCompactSubtitle
                ? textLayout.focusedCompactSubtitle
                : textLayout.subtitle;
            if (subtitleText) {
                subtitleText.textContent = textLayout.showSubtitle ? subtitleValue : '';
            }
            subtitle.style.display = textLayout.showSubtitle ? 'block' : 'none';
        }
    }

    private applyWidthTierPresentation(
        element: HTMLElement,
        children: CellChildren,
        tier: EPGCellWidthTier,
        cellData: EPGRenderedCellData,
        textLayout: CellTextLayout
    ): void {
        element.classList.remove(
            EPG_CLASSES.CELL_TIER_WIDE,
            EPG_CLASSES.CELL_TIER_MEDIUM,
            EPG_CLASSES.CELL_TIER_NARROW,
            EPG_CLASSES.CELL_TIER_TINY
        );

        const { time, meta, subtitle, subtitleText } = children;
        const hasMetaContent = (meta?.textContent ?? '').trim().length > 0;
        const hasSubtitleContent = (subtitleText?.textContent ?? '').trim().length > 0;
        const isFocused = cellData.isFocused;
        const usesFocusedCompactLayout = isFocused && textLayout.focusedLayoutMode === 'compact';
        const usesFocusedMovieOverlay = isFocused &&
            !usesFocusedCompactLayout &&
            cellData.kind === 'program' &&
            cellData.program.item.type === 'movie';
        const usesSliverPresentation = this.isSliverCell(cellData) && !usesFocusedCompactLayout;
        element.classList.toggle(EPG_CLASSES.CELL_FOCUSED_COMPACT, usesFocusedCompactLayout);
        element.classList.toggle(FOCUSED_MOVIE_OVERLAY_CLASS, usesFocusedMovieOverlay);
        element.classList.toggle(EPG_CLASSES.SLIVER_CELL_CLASS, usesSliverPresentation);

        if (tier === 'wide') {
            element.classList.add(EPG_CLASSES.CELL_TIER_WIDE);
        } else if (tier === 'medium') {
            element.classList.add(EPG_CLASSES.CELL_TIER_MEDIUM);
        } else if (tier === 'narrow' || tier === 'tiny') {
            element.classList.add(tier === 'narrow' ? EPG_CLASSES.CELL_TIER_NARROW : EPG_CLASSES.CELL_TIER_TINY);
        }

        if (usesSliverPresentation) {
            if (meta) meta.style.display = 'none';
            if (subtitle) subtitle.style.display = 'none';
            if (time) time.style.display = 'none';
            return;
        }

        if (tier === 'wide') {
            if (meta) meta.style.display = usesFocusedCompactLayout ? 'none' : hasMetaContent ? 'flex' : 'none';
            if (subtitle) subtitle.style.display = hasSubtitleContent ? 'block' : 'none';
            if (time) time.style.display = usesFocusedCompactLayout ? 'none' : 'block';
        } else if (tier === 'medium') {
            if (meta) meta.style.display = 'none';
            if (subtitle) subtitle.style.display = hasSubtitleContent ? 'block' : 'none';
            if (time) time.style.display = usesFocusedCompactLayout ? 'none' : 'block';
        } else if (tier === 'narrow' || tier === 'tiny') {
            if (meta) meta.style.display = 'none';
            if (subtitle) subtitle.style.display = usesFocusedCompactLayout && hasSubtitleContent ? 'block' : 'none';
            if (time) time.style.display = isFocused && !usesFocusedCompactLayout ? 'block' : 'none';
        }
    }

    private getRenderedVisibleWidthPx(cellData: EPGRenderedCellData): number {
        return Math.max(0, Math.min(cellData.width, cellData.visibleWidthPx));
    }

    private updateLiveBadge(element: HTMLElement, isCurrent: boolean): void {
        const badge = this.getCellChildren(element).liveBadge;
        if (!badge) return;

        if (!isCurrent) {
            badge.hidden = true;
            badge.textContent = '';
            badge.classList.remove(EPG_CLASSES.CELL_LIVE_COMPACT);
            return;
        }

        badge.hidden = false;
        const isNarrowOrTiny =
            element.classList.contains(EPG_CLASSES.CELL_TIER_NARROW) ||
            element.classList.contains(EPG_CLASSES.CELL_TIER_TINY);
        const shouldCompact =
            isNarrowOrTiny ||
            element.classList.contains(EPG_CLASSES.CELL_FOCUSED_COMPACT) ||
            element.classList.contains(FOCUSED_MOVIE_OVERLAY_CLASS) ||
            element.classList.contains(EPG_CLASSES.SLIVER_CELL_CLASS);

        badge.classList.toggle(EPG_CLASSES.CELL_LIVE_COMPACT, shouldCompact);
        badge.textContent = shouldCompact ? '' : 'LIVE';
    }

    private prefersReducedMotion(): boolean {
        return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    }

    private getEffectiveTickerClientWidth(
        target: TickerTarget,
        cellWidthPx: number,
        visibleWidthPx: number,
        textShiftPx: number
    ): number {
        const shiftedClientWidth = Math.max(0, target.viewport.clientWidth - textShiftPx);
        if (visibleWidthPx >= cellWidthPx) {
            return shiftedClientWidth;
        }
        return Math.max(0, Math.min(shiftedClientWidth, visibleWidthPx));
    }

    private measureReadyStateTickerOverflow(
        target: TickerTarget,
        cellWidthPx: number,
        visibleWidthPx: number,
        textShiftPx: number
    ): number {
        target.viewport.classList.add(target.readyClass);
        void target.viewport.offsetWidth;
        const effectiveClientWidth = this.getEffectiveTickerClientWidth(
            target,
            cellWidthPx,
            visibleWidthPx,
            textShiftPx
        );
        const contentWidth = Math.max(target.content.scrollWidth, target.viewport.scrollWidth);
        return Math.max(0, contentWidth - effectiveClientWidth);
    }

    private buildTickerTarget(
        viewport: HTMLElement | null,
        content: HTMLElement | null,
        options: Omit<TickerTarget, 'viewport' | 'content'>
    ): TickerTarget | null {
        if (!viewport || !content) {
            return null;
        }

        const text = content.textContent?.trim() ?? '';
        if (text.length === 0) {
            return null;
        }

        return {
            viewport,
            content,
            ...options,
        };
    }
}
