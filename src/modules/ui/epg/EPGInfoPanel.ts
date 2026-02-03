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
    private posterElement: HTMLImageElement | null = null;
    private showTitleElement: HTMLElement | null = null;
    private titleElement: HTMLElement | null = null;
    private metaElement: HTMLElement | null = null;
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
      <div class="${EPG_CLASSES.INFO_POSTER_WRAP}">
        <img class="${EPG_CLASSES.INFO_POSTER}" src="" alt="" />
      </div>
      <div class="${EPG_CLASSES.INFO_CONTENT}">
        <div class="${EPG_CLASSES.INFO_SHOW}"></div>
        <div class="${EPG_CLASSES.INFO_TITLE}"></div>
        <div class="${EPG_CLASSES.INFO_META}"></div>
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
        if (this.containerElement) {
            this.containerElement.remove();
            this.containerElement = null;
        }
        this.posterElement = null;
        this.showTitleElement = null;
        this.titleElement = null;
        this.metaElement = null;
        this.genresElement = null;
        this.descriptionElement = null;
        this.currentProgram = null;
        this.thumbResolver = null;
        this.fetchItemDetails = null;
        this.isVisible = false;
        this.qualityBadges = [];
        this.hdrCache.clear();
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

        const { item } = program;

        this.updatePoster(program, 'fast');

        // Update title
        const showTitle = this.showTitleElement;
        const title = this.titleElement;
        if (item.type === 'episode') {
            const showText = item.showTitle ?? '';
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

        // Update meta info
        const meta = this.metaElement;
        if (meta) {
            const startTime = formatTime(program.scheduledStartTime);
            const endTime = formatTime(program.scheduledEndTime);
            const duration = formatDuration(item.durationMs);
            const year = item.year > 0 ? `(${item.year})` : '';

            meta.textContent = `${startTime} - ${endTime} (${duration}) ${year}`;
        }

        // Update genres
        const genres = this.genresElement;
        if (genres) {
            const genreText = item.genres && item.genres.length > 0
                ? item.genres.slice(0, 3).join(' • ')
                : '';
            genres.textContent = genreText;
            genres.style.display = genreText ? 'block' : 'none';
        }

        // Hide description during fast nav without updating text
        const description = this.descriptionElement;
        if (description && description.style.display !== 'none') {
            description.style.display = 'none';
        }

        this.updateQualityBadges(program, undefined, options);
    }

    /**
     * Update the content of the info panel (full).
     */
    private updateContentFull(program: ScheduledProgram): void {
        if (!this.containerElement) return;

        this.updateContentFast(program, { allowHdrFetch: true });

        const { item } = program;

        this.updatePoster(program, 'full');

        // Update description
        const description = this.descriptionElement;
        if (description) {
            const summary = item.summary?.trim() ?? '';
            description.textContent = summary;
            description.style.display = summary ? 'block' : 'none';
        }
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
                    console.warn('[EPGInfoPanel] HDR fetch failed:', error);
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
        const poster = this.posterElement;
        if (!poster) return;

        const { item } = program;
        const preferredThumb = item.type === 'episode'
            ? (item.showThumb && item.showThumb.length ? item.showThumb : item.thumb)
            : item.thumb;

        const width = mode === 'fast' ? 140 : 280;
        const height = mode === 'fast' ? 210 : 420;
        const resolvedUrl = this.thumbResolver?.(preferredThumb, width, height) || null;
        if (resolvedUrl) {
            poster.src = resolvedUrl;
            poster.alt = item.showTitle && item.showTitle.length ? item.showTitle : item.title;
            poster.style.display = 'block';
            return;
        }

        // Hide poster when unresolved (prevents file:/// errors on webOS)
        poster.src = '';
        poster.style.display = 'none';
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
