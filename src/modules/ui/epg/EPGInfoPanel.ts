/**
 * @fileoverview EPG Info Panel - Program details overlay
 * @module modules/ui/epg/EPGInfoPanel
 * @version 1.0.0
 */

import { EPG_CLASSES } from './constants';
import { formatTime, formatDuration } from './utils';
import type { IEPGInfoPanel } from './interfaces';
import type { ScheduledProgram } from './types';
import type { PlexMediaItem } from '../../plex/library';
import { extractHdrLabelFromPlexMedia } from '../../plex/stream/hdr';
import { formatContentRatingBadge } from '../../../utils/contentRating';

/**
 * EPG Info Panel class.
 * Displays program details in an overlay at the bottom of the EPG.
 */
export class EPGInfoPanel implements IEPGInfoPanel {
    private containerElement: HTMLElement | null = null;
    private backdropElement: HTMLImageElement | null = null;
    private posterElement: HTMLImageElement | null = null;
    private showTitleElement: HTMLElement | null = null;
    private titleElement: HTMLElement | null = null;
    private metaElement: HTMLElement | null = null;
    private tagsElement: HTMLElement | null = null;
    private genresElement: HTMLElement | null = null;
    private descriptionElement: HTMLElement | null = null;
    private isVisible: boolean = false;
    private currentProgram: ScheduledProgram | null = null;
    private thumbResolver:
        ((pathOrUrl: string | null, width?: number, height?: number) => string | null) | null = null;
    private fetchItemDetails:
        ((ratingKey: string, options?: { signal?: AbortSignal | null }) => Promise<PlexMediaItem | null>) | null = null;
    private qualityBadges: HTMLElement[] = [];
    private hdrCache = new Map<string, string>();
    private hdrFetchToken = 0;
    private hdrFetchController: AbortController | null = null;
    private hdrFetchTimer: ReturnType<typeof setTimeout> | null = null;
    private episodePosterCache = new Map<string, string | null>();
    private posterFetchToken = 0;
    private posterFetchController: AbortController | null = null;
    private posterFetchTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * Set the thumb URL resolver callback.
     * Called before assigning poster src to resolve relative Plex paths.
     *
     * @param resolver - Callback that converts paths to full URLs
     */
    setThumbResolver(
        resolver: ((pathOrUrl: string | null, width?: number, height?: number) => string | null) | null
    ): void {
        this.thumbResolver = resolver;
    }

    /**
     * Set callback to fetch Plex item details (used for HDR/DV badge fallback).
     */
    setFetchItemDetails(
        fetcher: ((ratingKey: string, options?: { signal?: AbortSignal | null }) => Promise<PlexMediaItem | null>) | null
    ): void {
        this.fetchItemDetails = fetcher;
    }

    /**
     * Initialize the info panel.
     *
     * @param parentElement - Parent element to append info panel to
     */
    initialize(parentElement: HTMLElement): void {
        this.containerElement = document.createElement('div');
        this.containerElement.className = EPG_CLASSES.INFO_PANEL;
        this.containerElement.innerHTML = this.createTemplate();
        this.containerElement.style.display = 'flex';
        this.containerElement.style.visibility = 'hidden';
        this.containerElement.style.opacity = '0';
        parentElement.appendChild(this.containerElement);

        this.backdropElement = this.containerElement.querySelector(
            `.${EPG_CLASSES.INFO_BACKDROP_IMG}`
        ) as HTMLImageElement | null;
        this.posterElement = this.containerElement.querySelector(
            `.${EPG_CLASSES.INFO_POSTER}`
        ) as HTMLImageElement | null;
        this.showTitleElement = this.containerElement.querySelector(
            `.${EPG_CLASSES.INFO_SHOW}`
        ) as HTMLElement | null;
        this.titleElement = this.containerElement.querySelector(
            `.${EPG_CLASSES.INFO_TITLE}`
        ) as HTMLElement | null;
        this.metaElement = this.containerElement.querySelector(
            `.${EPG_CLASSES.INFO_META}`
        ) as HTMLElement | null;
        this.tagsElement = this.containerElement.querySelector(
            `.${EPG_CLASSES.INFO_TAGS}`
        ) as HTMLElement | null;
        this.genresElement = this.containerElement.querySelector(
            `.${EPG_CLASSES.INFO_GENRES}`
        ) as HTMLElement | null;
        this.descriptionElement = this.containerElement.querySelector(
            `.${EPG_CLASSES.INFO_DESCRIPTION}`
        ) as HTMLElement | null;

        const qualityContainer = this.containerElement.querySelector(
            `.${EPG_CLASSES.INFO_QUALITY}`
        ) as HTMLElement | null;
        if (qualityContainer) {
            this.qualityBadges = [];
            // Rating + up to 4 media quality badges (resolution/HDR/audio codec/channels).
            for (let i = 0; i < 5; i++) {
                const badge = document.createElement('span');
                badge.className = EPG_CLASSES.INFO_QUALITY_BADGE;
                badge.style.display = 'none';
                qualityContainer.appendChild(badge);
                this.qualityBadges.push(badge);
            }
        }
    }

    /**
     * Create the HTML template for the info panel.
     */
    private createTemplate(): string {
        return `
      <div class="${EPG_CLASSES.INFO_BACKDROP}" aria-hidden="true">
        <img class="${EPG_CLASSES.INFO_BACKDROP_IMG}" alt="" />
      </div>
      <div class="${EPG_CLASSES.INFO_POSTER_WRAP}">
        <img class="${EPG_CLASSES.INFO_POSTER}" alt="" />
      </div>
      <div class="${EPG_CLASSES.INFO_CONTENT}">
        <div class="${EPG_CLASSES.INFO_SHOW} ${EPG_CLASSES.INFO_EYEBROW}"></div>
        <div class="${EPG_CLASSES.INFO_TITLE}"></div>
        <div class="${EPG_CLASSES.INFO_META}"></div>
        <div class="${EPG_CLASSES.INFO_TAGS}"></div>
        <div class="${EPG_CLASSES.INFO_GENRES}"></div>
        <div class="${EPG_CLASSES.INFO_QUALITY}"></div>
        <div class="${EPG_CLASSES.INFO_DESCRIPTION}"></div>
      </div>
    `;
    }

    /**
     * Destroy the info panel and clean up resources.
     */
    destroy(): void {
        this.clearHdrFetch();
        this.clearPosterFetch();
        if (this.containerElement) {
            this.containerElement.remove();
            this.containerElement = null;
        }
        this.backdropElement = null;
        this.posterElement = null;
        this.showTitleElement = null;
        this.titleElement = null;
        this.metaElement = null;
        this.tagsElement = null;
        this.genresElement = null;
        this.descriptionElement = null;
        this.currentProgram = null;
        this.thumbResolver = null;
        this.fetchItemDetails = null;
        this.isVisible = false;
        this.qualityBadges = [];
        this.hdrCache.clear();
        this.episodePosterCache.clear();
    }

    /**
     * Show the info panel with program details.
     *
     * @param program - Program to display
     */
    show(program: ScheduledProgram): void {
        this.updateFull(program);
    }

    /**
     * Hide the info panel.
     */
    hide(): void {
        if (!this.containerElement) return;

        this.containerElement.style.visibility = 'hidden';
        this.containerElement.style.opacity = '0';
        this.isVisible = false;
        this.clearHdrFetch();
        this.clearPosterFetch();
    }

    /**
     * Update the info panel with new program details.
     * Shows the panel if not already visible.
     *
     * @param program - Program to display
     */
    update(program: ScheduledProgram): void {
        this.updateFull(program);
    }

    /**
     * Update the info panel quickly (without poster/description).
     *
     * @param program - Program to display
     */
    updateFast(program: ScheduledProgram): void {
        if (!this.containerElement) return;

        this.currentProgram = program;
        this.updateContentFast(program, { allowHdrFetch: false });
        this.containerElement.style.visibility = 'visible';
        this.containerElement.style.opacity = '1';
        this.isVisible = true;
    }

    /**
     * Update the info panel fully (including poster/description).
     *
     * @param program - Program to display
     */
    updateFull(program: ScheduledProgram): void {
        if (!this.containerElement) return;

        this.currentProgram = program;
        this.updateContentFull(program);
        this.containerElement.style.visibility = 'visible';
        this.containerElement.style.opacity = '1';
        this.isVisible = true;
    }

    /**
     * Update the content of the info panel (fast path).
     */
    private updateContentFast(
        program: ScheduledProgram,
        options?: { allowHdrFetch?: boolean }
    ): void {
        if (!this.containerElement) return;

        this.updatePoster(program, 'fast');

        this.updateNonPosterContent(program, { allowHdrFetch: options?.allowHdrFetch ?? false, showDescription: false });
    }

    private updateNonPosterContent(
        program: ScheduledProgram,
        options: { allowHdrFetch: boolean; showDescription: boolean }
    ): void {
        const { item } = program;

        // Update title
        const showTitle = this.showTitleElement;
        const title = this.titleElement;
        if (item.type === 'episode') {
            const showText = this.getEffectiveShowTitle(item);
            if (showTitle) {
                showTitle.textContent = showText;
                showTitle.style.display = showText ? 'block' : 'none';
            }
            if (title) {
                title.textContent = item.title;
            }
        } else {
            if (showTitle) {
                showTitle.textContent = '';
                showTitle.style.display = 'none';
            }
            if (title) {
                title.textContent = item.fullTitle || item.title;
            }
        }

        this.updateMetaAndTags(program);

        // Update genres
        const genres = this.genresElement;
        if (genres) {
            const genreText = item.genres && item.genres.length > 0
                ? item.genres.slice(0, 3).join(' • ')
                : '';
            genres.textContent = genreText;
            genres.style.display = genreText ? 'block' : 'none';
        }

        const description = this.descriptionElement;
        if (description) {
            if (options.showDescription) {
                const summary = item.summary?.trim() ?? '';
                description.textContent = summary;
                description.style.display = summary ? 'block' : 'none';
            } else if (description.style.display !== 'none') {
                // Hide description during fast nav without updating text
                description.style.display = 'none';
            }
        }

        this.updateQualityBadges(program, undefined, { allowHdrFetch: options.allowHdrFetch });
    }

    /**
     * Update the content of the info panel (full).
     */
    private updateContentFull(program: ScheduledProgram): void {
        if (!this.containerElement) return;

        this.updateNonPosterContent(program, { allowHdrFetch: true, showDescription: true });

        this.updatePoster(program, 'full');
    }

    private updateQualityBadges(
        program: ScheduledProgram,
        overrideHdr?: string | null,
        options?: { allowHdrFetch?: boolean }
    ): void {
        const qualityBadges = this.qualityBadges;
        const mediaInfo = program.item.mediaInfo;
        const badgeValues: string[] = [];

        const contentRating = formatContentRatingBadge(program.item.contentRating ?? null) ?? '';
        if (contentRating) badgeValues.push(contentRating);
        if (mediaInfo?.resolution) badgeValues.push(mediaInfo.resolution);
        const hdrValue = mediaInfo?.hdr || overrideHdr || null;
        if (hdrValue) badgeValues.push(hdrValue);
        if (mediaInfo?.audioCodec) {
            badgeValues.push(this.formatAudioCodec(mediaInfo.audioCodec));
        }
        const audioDetail = this.formatAudioDetail(mediaInfo);
        if (audioDetail) badgeValues.push(audioDetail);

        for (let i = 0; i < qualityBadges.length; i++) {
            const badge = qualityBadges[i];
            const value = badgeValues[i];
            if (badge && value) {
                badge.textContent = value;
                badge.style.display = 'inline-flex';
            } else if (badge) {
                badge.textContent = '';
                badge.style.display = 'none';
            }
        }

        const allowHdrFetch = options?.allowHdrFetch ?? true;
        if (!mediaInfo?.hdr && !overrideHdr) {
            if (allowHdrFetch) {
                this.maybeFetchHdr(program);
            } else {
                this.clearHdrFetch();
            }
        } else {
            this.clearHdrFetch();
        }
    }

    private maybeFetchHdr(program: ScheduledProgram): void {
        const ratingKey = program.item.ratingKey;
        if (!ratingKey || !this.fetchItemDetails) {
            return;
        }

        const cached = this.hdrCache.get(ratingKey);
        if (cached) {
            this.updateQualityBadges(program, cached);
            return;
        }

        this.clearHdrFetch();
        const fetchToken = ++this.hdrFetchToken;
        this.hdrFetchController = new AbortController();
        this.hdrFetchTimer = setTimeout(() => {
            this.hdrFetchTimer = null;
            void this.fetchItemDetails?.(ratingKey, { signal: this.hdrFetchController?.signal ?? null })
                .then((item) => {
                    if (fetchToken !== this.hdrFetchToken) return;
                    const hdr = extractHdrLabelFromPlexMedia(item);
                    if (!hdr) return;
                    this.hdrCache.set(ratingKey, hdr);
                    const current = this.currentProgram;
                    if (!current || current.item.ratingKey !== ratingKey) return;
                    this.updateQualityBadges(current, hdr);
                })
                .catch((error) => {
                    if (error instanceof DOMException && error.name === 'AbortError') {
                        return;
                    }
                });
        }, 200);
    }

    private clearHdrFetch(): void {
        if (this.hdrFetchTimer !== null) {
            clearTimeout(this.hdrFetchTimer);
            this.hdrFetchTimer = null;
        }
        if (this.hdrFetchController) {
            this.hdrFetchController.abort();
            this.hdrFetchController = null;
        }
    }

    private formatAudioCodec(codec: string): string {
        const normalized = codec.trim().toLowerCase();
        switch (normalized) {
            case 'truehd':
                return 'TRUEHD';
            case 'eac3':
                return 'DD+';
            case 'ac3':
                return 'DD';
            case 'dca':
            case 'dts':
                return 'DTS';
            case 'dts-hd':
            case 'dtshd':
                return 'DTS-HD';
            default:
                return normalized.toUpperCase();
        }
    }

    private formatAudioDetail(
        mediaInfo: ScheduledProgram['item']['mediaInfo'] | undefined
    ): string | null {
        if (!mediaInfo) return null;

        if (typeof mediaInfo.audioChannels === 'number' && mediaInfo.audioChannels > 0) {
            switch (mediaInfo.audioChannels) {
                case 1:
                    return '1.0';
                case 2:
                    return '2.0';
                case 6:
                    return '5.1';
                case 8:
                    return '7.1';
                default:
                    return `${mediaInfo.audioChannels}ch`;
            }
        }

        if (mediaInfo.audioTrackTitle) {
            const trimmed = mediaInfo.audioTrackTitle.trim();
            return trimmed.length > 0 ? trimmed.slice(0, 24) : null;
        }

        return null;
    }

    private updatePoster(program: ScheduledProgram, mode: 'fast' | 'full'): void {
        const backdrop = this.backdropElement;
        const poster = this.posterElement;
        if (!poster) return;

        const { item } = program;
        if (backdrop) {
            if (mode === 'full') {
                const art = item.art ?? null;
                if (art) {
                    const resolvedBackdrop = this.thumbResolver?.(art, 960, 540) || null;
                    if (resolvedBackdrop) {
                        backdrop.src = resolvedBackdrop;
                        backdrop.style.display = 'block';
                    } else {
                        backdrop.removeAttribute('src');
                        backdrop.style.display = 'none';
                    }
                } else {
                    backdrop.removeAttribute('src');
                    backdrop.style.display = 'none';
                }
            } else {
                backdrop.removeAttribute('src');
                backdrop.style.display = 'none';
            }
        }

        // For episodes, prefer the series poster over per-episode thumbnails to keep the guide consistent.
        // If we don't have a series poster thumb, hide the poster rather than showing an episode still.
        let preferredThumb: string | null = null;
        if (item.type !== 'episode') {
            preferredThumb = item.thumb;
        } else {
            const ratingKey = item.ratingKey;
            const hasCached = this.episodePosterCache.has(ratingKey);
            const cached = hasCached ? this.episodePosterCache.get(ratingKey) : undefined;
            const showThumb = item.showThumb || null;
            preferredThumb = (cached ?? showThumb) ?? null;
            if (!preferredThumb && !hasCached && mode === 'full') {
                this.maybeFetchEpisodePoster(program);
            }
        }

        const width = mode === 'fast' ? 160 : 320;
        const height = mode === 'fast' ? 240 : 480;
        const resolvedUrl = this.thumbResolver?.(preferredThumb, width, height) || null;
        if (resolvedUrl) {
            poster.src = resolvedUrl;
            const showTitle = item.type === 'episode' ? this.getEffectiveShowTitle(item) : '';
            poster.alt = showTitle.length ? showTitle : item.title;
            poster.style.display = 'block';
            return;
        }

        // Hide poster when unresolved (prevents file:/// errors on webOS)
        poster.removeAttribute('src');
        poster.style.display = 'none';
    }

    private extractShowTitleFromFullTitle(fullTitle: string): string | null {
        const match = fullTitle.match(/^(.*?)\s-\sS\d{1,2}E\d{1,2}\s-/);
        if (!match) return null;
        const showTitle = match[1]?.trim() ?? '';
        return showTitle.length > 0 ? showTitle : null;
    }

    private getEffectiveShowTitle(item: ScheduledProgram['item']): string {
        const raw = (item.showTitle ?? '').trim();
        if (raw.length > 0) return raw;
        const derived = this.extractShowTitleFromFullTitle(item.fullTitle);
        return derived ?? '';
    }

    private maybeFetchEpisodePoster(program: ScheduledProgram): void {
        const ratingKey = program.item.ratingKey;
        if (!ratingKey || !this.fetchItemDetails) {
            return;
        }
        if (this.episodePosterCache.has(ratingKey)) {
            return;
        }

        this.clearPosterFetch();
        const fetchToken = ++this.posterFetchToken;
        this.posterFetchController = new AbortController();
        this.posterFetchTimer = setTimeout(() => {
            this.posterFetchTimer = null;
            void this.fetchItemDetails?.(ratingKey, { signal: this.posterFetchController?.signal ?? null })
                .then((item) => {
                    if (fetchToken !== this.posterFetchToken) return;
                    const seriesPosterThumb = item?.grandparentThumb ?? null;
                    this.episodePosterCache.set(ratingKey, seriesPosterThumb);
                    const current = this.currentProgram;
                    if (!current || current.item.ratingKey !== ratingKey) return;
                    this.updatePoster(current, 'full');
                })
                .catch((error) => {
                    if (error instanceof DOMException && error.name === 'AbortError') {
                        return;
                    }
                });
        }, 200);
    }

    private clearPosterFetch(): void {
        if (this.posterFetchTimer !== null) {
            clearTimeout(this.posterFetchTimer);
            this.posterFetchTimer = null;
        }
        if (this.posterFetchController) {
            this.posterFetchController.abort();
            this.posterFetchController = null;
        }
        this.posterFetchToken += 1;
    }

    private updateMetaAndTags(program: ScheduledProgram): void {
        const { item } = program;
        const startTime = formatTime(program.scheduledStartTime);
        const endTime = formatTime(program.scheduledEndTime);
        const duration = formatDuration(item.durationMs);
        const year = item.year > 0 ? `(${item.year})` : '';
        const metaText = `${startTime} - ${endTime} (${duration}) ${year}`.trim();

        const meta = this.metaElement;
        if (meta) {
            // Keep meta as the semantic (screen-reader) version; pills below are visual-only.
            meta.textContent = metaText;
            meta.classList.add('sr-only');
        }

        const tags = this.tagsElement;
        if (!tags) return;

        // Visual pills are presentational; avoid duplicate announcements.
        tags.setAttribute('aria-hidden', 'true');
        tags.replaceChildren();
        const pills: string[] = [];
        pills.push(`${startTime} - ${endTime}`);
        pills.push(duration);
        if (item.year > 0) {
            pills.push(String(item.year));
        }

        for (const text of pills) {
            const pill = document.createElement('span');
            pill.className = EPG_CLASSES.INFO_PILL;
            pill.textContent = text;
            tags.appendChild(pill);
        }
    }

    /**
     * Get the currently displayed program.
     *
     * @returns Current program or null
     */
    getCurrentProgram(): ScheduledProgram | null {
        return this.currentProgram;
    }

    /**
     * Check if the info panel is currently visible.
     *
     * @returns true if visible
     */
    getIsVisible(): boolean {
        return this.isVisible;
    }
}
