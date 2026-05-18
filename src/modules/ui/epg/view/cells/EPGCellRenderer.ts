import { EPG_CLASSES } from '../../constants';
import {
    FOCUSED_MOVIE_OVERLAY_CLASS,
    FOCUSED_TICKER_MIN_OVERFLOW_PX,
    buildTickerTarget,
    getCellTimeLabelPresentation,
    getCellWidthPresentation,
    getCellWidthTier,
    getEffectiveTickerClientWidth,
    getProgramCellTextLayout,
    getProgressFillWidth,
    getRenderedVisibleWidthTier,
    getVisibleTextMetrics,
    isSliverCell,
    measureReadyStateTickerOverflow,
    shouldShowEpisodeTagForCell,
    shouldShowCellTimeForWidth,
    shouldUseCellTitleFullRowLayout,
    type CellTextLayout,
    type EPGCellWidthTier,
    type EPGCellVisibleTextMetrics,
    type TickerTarget,
} from '../cells/EPGCellPresentation';
import type { CellRenderData } from '../../types';

export type { EPGCellWidthTier } from '../cells/EPGCellPresentation';

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

export type { EPGCellVisibleTextMetrics } from '../cells/EPGCellPresentation';

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
        this.clearSubtitlePresentation({ subtitle, subtitleText });
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
            EPG_CLASSES.CELL_FOCUSED_COMPACT,
            EPG_CLASSES.CELL_CURRENT,
            EPG_CLASSES.CELL_PAST,
            EPG_CLASSES.CELL_LOADING,
            EPG_CLASSES.CELL_TEXT_SHIFTED,
            EPG_CLASSES.CELL_TITLE_FULL_ROW,
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
        return getCellWidthTier(width);
    }

    getCellVisibleWidthTier(cellData: EPGRenderedCellData): EPGCellWidthTier {
        return getRenderedVisibleWidthTier(cellData);
    }

    isSliverCell(cellData: EPGRenderedCellData): boolean {
        return isSliverCell(cellData);
    }

    computeVisibleTextMetrics(input: {
        rawLeftPx: number;
        clippedLeftPx: number;
        clippedWidthPx: number;
        visibleWindowStartMinutes: number;
        visibleWindowEndMinutes: number;
        pixelsPerMinute: number;
    }): EPGCellVisibleTextMetrics {
        return getVisibleTextMetrics(input);
    }

    updateCellContent(cellData: EPGRenderedCellData, nowMs: number): void {
        const element = cellData.cellElement;
        if (!element) return;

        const children = this.getCellChildren(element);
        const tier = this.getCellWidthTier(cellData.width);
        const textLayout = getProgramCellTextLayout(cellData, cellData.isFocused);
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
        this.applyTextPresentation(children, cellData, textLayout);
        this.applyWidthPresentation(element, children, tier, cellData, textLayout);
        this.updateLiveBadge(element, cellData);
        this.applyProgressPresentation(children, cellData, nowMs);
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
        this.updateLiveBadge(element, cellData);
    }

    updateTemporalPresentation(cellData: EPGRenderedCellData, nowMs: number): void {
        const element = cellData.cellElement;
        if (!element) return;

        element.classList.toggle(EPG_CLASSES.CELL_CURRENT, cellData.isCurrent);
        element.classList.toggle(EPG_CLASSES.CELL_PAST, cellData.isPast);
        this.updateCellTimeLabelForCell(cellData);
        this.updateLiveBadge(element, cellData);
        this.applyProgressPresentation(this.getCellChildren(element), cellData, nowMs);
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
            buildTickerTarget(children.title, children.titleText, {
                readyClass: EPG_CLASSES.CELL_TITLE_TICKER_READY,
                runningClass: EPG_CLASSES.CELL_TITLE_TICKER_RUNNING,
                distanceVarName: '--epg-title-ticker-distance-px',
                durationVarName: '--epg-title-ticker-duration-ms',
                supportsClampMeasurement: true,
            }),
            buildTickerTarget(children.subtitle, children.subtitleText, {
                readyClass: EPG_CLASSES.CELL_SUBTITLE_TICKER_READY,
                runningClass: EPG_CLASSES.CELL_SUBTITLE_TICKER_RUNNING,
                distanceVarName: '--epg-subtitle-ticker-distance-px',
                durationVarName: '--epg-subtitle-ticker-duration-ms',
                supportsClampMeasurement: false,
            }),
        ].filter((target): target is TickerTarget => target !== null);
        if (targets.length === 0) return;
        this.clearTickerStateForTargets(targets);

        const textShiftPx = Math.max(0, focusedCell.textShiftPx);
        const tier = this.getCellWidthTier(focusedCell.width);
        const activeTargets: TickerTarget[] = [];

        for (const target of targets) {
            const effectiveClientWidth = getEffectiveTickerClientWidth(
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
                ? measureReadyStateTickerOverflow(
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

        const presentation = getCellTimeLabelPresentation(tier, cellData, startTimeMs, endTimeMs);
        timeEl.textContent = presentation.text;
        timeEl.classList.toggle(EPG_CLASSES.CELL_TIME_COMPACT, presentation.isCompact);
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

    private applyProgressPresentation(children: CellChildren, cellData: CellRenderData, nowMs: number): void {
        if (!children.progressFill) {
            return;
        }
        children.progressFill.style.width = getProgressFillWidth(cellData, nowMs);
    }

    private applyTextPresentation(
        children: CellChildren,
        cellData: CellRenderData,
        textLayout: CellTextLayout
    ): void {
        const { meta, episode, titleText } = children;
        if (!meta || !episode) return;

        if (titleText) {
            titleText.textContent = textLayout.title;
        }

        if (cellData.kind !== 'program') {
            episode.textContent = '';
            meta.style.display = 'none';
            this.clearSubtitlePresentation(children);
            return;
        }

        if (cellData.program.item.type !== 'episode') {
            episode.textContent = '';
            meta.style.display = 'none';
            this.clearSubtitlePresentation(children);
            return;
        }

        if (textLayout.episodeTag) {
            episode.textContent = textLayout.episodeTag;
            meta.style.display = 'flex';
        } else {
            episode.textContent = '';
            meta.style.display = 'none';
        }

        this.applySubtitlePresentation(children, {
            text: textLayout.subtitle,
            show: textLayout.showSubtitle,
        });
    }

    private applySubtitlePresentation(
        { subtitle, subtitleText }: Pick<CellChildren, 'subtitle' | 'subtitleText'>,
        presentation: { text: string; show: boolean }
    ): void {
        if (!presentation.show) {
            this.clearSubtitlePresentation({ subtitle, subtitleText });
            return;
        }
        if (!subtitle) {
            return;
        }
        if (subtitleText) {
            subtitleText.textContent = presentation.text;
        }
        subtitle.style.display = 'block';
    }

    private clearSubtitlePresentation(
        { subtitle, subtitleText }: Pick<CellChildren, 'subtitle' | 'subtitleText'>
    ): void {
        if (subtitleText) {
            subtitleText.textContent = '';
        }
        if (subtitle) {
            subtitle.style.display = 'none';
        }
    }

    private setSubtitleDisplay(
        { subtitle }: Pick<CellChildren, 'subtitle'>,
        show: boolean
    ): void {
        if (subtitle) {
            subtitle.style.display = show ? 'block' : 'none';
        }
    }

    private clearTickerStateForTargets(targets: TickerTarget[]): void {
        for (const target of targets) {
            target.viewport.classList.remove(target.readyClass, target.runningClass);
            target.viewport.style.removeProperty(target.durationVarName);
            target.viewport.style.removeProperty(target.distanceVarName);
        }
    }

    private applyWidthPresentation(
        element: HTMLElement,
        children: CellChildren,
        tier: EPGCellWidthTier,
        cellData: EPGRenderedCellData,
        textLayout: CellTextLayout
    ): void {
        element.classList.remove(
            EPG_CLASSES.CELL_TITLE_FULL_ROW,
            EPG_CLASSES.CELL_TIER_WIDE,
            EPG_CLASSES.CELL_TIER_MEDIUM,
            EPG_CLASSES.CELL_TIER_NARROW,
            EPG_CLASSES.CELL_TIER_TINY
        );

        const { time, meta, subtitleText } = children;
        const hasMetaContent = (meta?.textContent ?? '').trim().length > 0;
        const hasSubtitleContent = (subtitleText?.textContent ?? '').trim().length > 0;
        const isFocused = cellData.isFocused;
        const isFocusedEpisode = isFocused &&
            cellData.kind === 'program' &&
            cellData.program.item.type === 'episode';
        const showEpisodeTag = shouldShowEpisodeTagForCell(cellData, textLayout);
        const showTime = shouldShowCellTimeForWidth(cellData, textLayout);
        const usesTitleFullRowLayout = shouldUseCellTitleFullRowLayout(cellData, textLayout);
        const {
            usesFocusedCompactLayout,
            usesFocusedMovieOverlay,
            usesSliverPresentation,
        } = getCellWidthPresentation(cellData, textLayout);
        element.classList.toggle(EPG_CLASSES.CELL_FOCUSED_COMPACT, usesFocusedCompactLayout);
        element.classList.toggle(EPG_CLASSES.CELL_TITLE_FULL_ROW, usesTitleFullRowLayout);
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
            this.clearSubtitlePresentation(children);
            if (time) time.style.display = 'none';
            return;
        }

        if (tier === 'wide') {
            if (meta) meta.style.display = hasMetaContent && showEpisodeTag ? 'flex' : 'none';
            this.setSubtitleDisplay(children, hasSubtitleContent);
            if (time) time.style.display = showTime ? 'block' : 'none';
        } else if (tier === 'medium') {
            if (meta) meta.style.display = isFocusedEpisode && hasMetaContent && showEpisodeTag ? 'flex' : 'none';
            this.setSubtitleDisplay(children, hasSubtitleContent);
            if (time) time.style.display = showTime ? 'block' : 'none';
        } else if (tier === 'narrow' || tier === 'tiny') {
            if (meta) meta.style.display = isFocusedEpisode && hasMetaContent && showEpisodeTag ? 'flex' : 'none';
            this.setSubtitleDisplay(children, isFocusedEpisode && hasSubtitleContent);
            if (time) time.style.display = isFocused && showTime ? 'block' : 'none';
        }
    }

    private updateLiveBadge(element: HTMLElement, cellData: EPGRenderedCellData): void {
        const badge = this.getCellChildren(element).liveBadge;
        if (!badge) return;

        if (!cellData.isCurrent) {
            badge.hidden = true;
            badge.textContent = '';
            badge.classList.remove(EPG_CLASSES.CELL_LIVE_COMPACT);
            return;
        }

        badge.hidden = false;
        badge.classList.add(EPG_CLASSES.CELL_LIVE_COMPACT);
        badge.textContent = '';
    }

    private prefersReducedMotion(): boolean {
        return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    }
}
