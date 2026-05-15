import { formatCellTimeLabel } from '../utils';
import type { CellRenderData, ScheduledProgram } from '../types';

const TEXT_GUTTER_PX = 12;
const TEXT_RIGHT_GUTTER_PX = 12;
const TIER_WIDE_MIN_PX = 220;
const TIER_MEDIUM_MIN_PX = 140;
const TIER_NARROW_MIN_PX = 88;
const SLIVER_VISIBLE_WIDTH_MAX_PX = 56;
const FULL_LIVE_BADGE_MIN_VISIBLE_WIDTH_PX = TIER_NARROW_MIN_PX;
export const FOCUSED_TICKER_MIN_OVERFLOW_PX = 4;
export const FOCUSED_MOVIE_OVERLAY_CLASS = 'epg-cell-focused-movie-overlay';

export type EPGCellWidthTier = 'wide' | 'medium' | 'narrow' | 'tiny';
type FocusedLayoutMode = 'normal' | 'compact';
type RenderedCellInput = CellRenderData & {
    visibleWidthPx: number;
};

export type CellTextLayout = {
    title: string;
    subtitle: string;
    showSubtitle: boolean;
    episodeTag: string | null;
    focusedCompactSubtitle?: string;
    focusedLayoutMode: FocusedLayoutMode;
};

export type CellTimeLabelPresentation = {
    text: string;
    isCompact: boolean;
};

export type CellWidthPresentation = {
    usesFocusedCompactLayout: boolean;
    usesFocusedMovieOverlay: boolean;
    usesSliverPresentation: boolean;
};

export type EPGCellVisibleTextMetrics = {
    visibleLeftPx: number;
    visibleRightPx: number;
    visibleWidthPx: number;
    safeTextShiftPx: number;
    isLeftClippedByCell: boolean;
    isLeftClippedByScroll: boolean;
};

export type TickerTarget = {
    viewport: HTMLElement;
    content: HTMLElement;
    readyClass: string;
    runningClass: string;
    distanceVarName: string;
    durationVarName: string;
    supportsClampMeasurement: boolean;
};

export function getCellWidthTier(width: number): EPGCellWidthTier {
    if (width >= TIER_WIDE_MIN_PX) return 'wide';
    if (width >= TIER_MEDIUM_MIN_PX) return 'medium';
    if (width >= TIER_NARROW_MIN_PX) return 'narrow';
    return 'tiny';
}

export function getRenderedVisibleWidthPx(cellData: RenderedCellInput): number {
    return Math.max(0, Math.min(cellData.width, cellData.visibleWidthPx));
}

export function isSliverCell(cellData: RenderedCellInput): boolean {
    const renderedVisibleWidthPx = getRenderedVisibleWidthPx(cellData);
    return renderedVisibleWidthPx > 0 && renderedVisibleWidthPx <= SLIVER_VISIBLE_WIDTH_MAX_PX;
}

export function shouldCompactLiveBadgeForVisibleWidth(cellData: RenderedCellInput): boolean {
    return getRenderedVisibleWidthPx(cellData) < FULL_LIVE_BADGE_MIN_VISIBLE_WIDTH_PX;
}

export function getVisibleTextMetrics(input: {
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

export function getCellTimeLabelPresentation(
    tier: EPGCellWidthTier,
    cellData: CellRenderData,
    startTimeMs: number,
    endTimeMs: number
): CellTimeLabelPresentation {
    const isCompactTime = tier === 'narrow' || tier === 'tiny';
    const forceFull = !isCompactTime && (cellData.isFocused || cellData.isCurrent);
    return {
        text: formatCellTimeLabel(startTimeMs, endTimeMs, { compact: isCompactTime, forceFull }),
        isCompact: isCompactTime && !forceFull,
    };
}

export function getProgramCellTextLayout(cellData: CellRenderData, isFocused: boolean): CellTextLayout {
    if (cellData.kind !== 'program') {
        return {
            title: cellData.placeholder.label,
            subtitle: '',
            showSubtitle: false,
            episodeTag: null,
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
            episodeTag: null,
            focusedCompactSubtitle: '',
            focusedLayoutMode: 'normal',
        };
    }

    const episodeTitle = normalizeEpisodeTitleForSubtitle(item.title);
    const showTitle = (item.showTitle ?? '').trim() ||
        extractShowTitleFromFullTitle(item.fullTitle, episodeTitle) ||
        '';
    const episodeTag = formatEpisodeTag(item);
    const focusedCompactSubtitle =
        episodeTitle.length > 0 && episodeTag ? `${episodeTag} - ${episodeTitle}` : episodeTitle;

    if (isFocused) {
        const title = showTitle || item.title;
        const showSubtitle = focusedCompactSubtitle.length > 0 && focusedCompactSubtitle !== title;
        return {
            title,
            subtitle: episodeTitle,
            showSubtitle,
            episodeTag,
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
        episodeTag,
        focusedCompactSubtitle,
        focusedLayoutMode: 'normal',
    };
}

export function getCellWidthPresentation(
    cellData: RenderedCellInput,
    textLayout: CellTextLayout
): CellWidthPresentation {
    const isFocused = cellData.isFocused;
    const usesFocusedCompactLayout = isFocused && textLayout.focusedLayoutMode === 'compact';
    const usesFocusedMovieOverlay = isFocused &&
        !usesFocusedCompactLayout &&
        cellData.kind === 'program' &&
        cellData.program.item.type === 'movie';
    return {
        usesFocusedCompactLayout,
        usesFocusedMovieOverlay,
        usesSliverPresentation: isSliverCell(cellData) && !usesFocusedCompactLayout,
    };
}

export function getProgressFillWidth(cellData: CellRenderData, nowMs: number): string {
    if (cellData.kind !== 'program' || !cellData.isCurrent) {
        return '0%';
    }

    const duration = cellData.program.scheduledEndTime - cellData.program.scheduledStartTime;
    if (duration <= 0) {
        return '0%';
    }

    const elapsed = nowMs - cellData.program.scheduledStartTime;
    const progress = Math.max(0, Math.min(100, (elapsed / duration) * 100));
    return `${progress.toFixed(2)}%`;
}

export function getEffectiveTickerClientWidth(
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

export function measureReadyStateTickerOverflow(
    target: TickerTarget,
    cellWidthPx: number,
    visibleWidthPx: number,
    textShiftPx: number
): number {
    target.viewport.classList.add(target.readyClass);
    void target.viewport.offsetWidth;
    const effectiveClientWidth = getEffectiveTickerClientWidth(
        target,
        cellWidthPx,
        visibleWidthPx,
        textShiftPx
    );
    const contentWidth = Math.max(target.content.scrollWidth, target.viewport.scrollWidth);
    return Math.max(0, contentWidth - effectiveClientWidth);
}

export function buildTickerTarget(
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

function extractShowTitleFromFullTitle(fullTitle: string, episodeTitle?: string): string | null {
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

function formatEpisodeTag(item: ScheduledProgram['item']): string | null {
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

function normalizeEpisodeTitleForSubtitle(title: string): string {
    return title.replace(/^\s*S\d{1,2}E\d{1,2}\s*-\s*/i, '').trim();
}
