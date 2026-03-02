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
import { safeLocalStorageGet, readStoredBoolean } from '../../../utils/storage';
import { extractDominantColor } from '../../../utils/color/extractDominantColor';
import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';

const MAX_DYNAMIC_COLOR_CACHE_ENTRIES = 128;
const DYNAMIC_COLOR_FAILURE_COOLDOWN_MS = 60_000;

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
    private clearLogoElement: HTMLImageElement | null = null;
    private metaElement: HTMLElement | null = null;
    private tagsElement: HTMLElement | null = null;
    private genresElement: HTMLElement | null = null;
    private descriptionElement: HTMLElement | null = null;
    private descriptionInnerElement: HTMLElement | null = null;
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
    private dynamicColorToken = 0;
    private gradientAElement: HTMLElement | null = null;
    private gradientBElement: HTMLElement | null = null;
    private activeGradientSlot: 'a' | 'b' = 'a';
    private colorExtractTimer: ReturnType<typeof setTimeout> | null = null;
    private colorCache = new Map<string, string>();
    private colorFailureCache = new Map<string, number>();
    private presentationMode: 'classic' | 'overlay' = 'overlay';

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

    setPresentationMode(mode: 'classic' | 'overlay'): void {
        this.presentationMode = mode;
    }

    getPresentationMode(): 'classic' | 'overlay' {
        return this.presentationMode;
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
        this.gradientAElement = this.containerElement.querySelector(
            `.${EPG_CLASSES.INFO_GRADIENT_A}`
        ) as HTMLElement | null;
        this.gradientBElement = this.containerElement.querySelector(
            `.${EPG_CLASSES.INFO_GRADIENT_B}`
        ) as HTMLElement | null;
        this.posterElement = this.containerElement.querySelector(
            `.${EPG_CLASSES.INFO_POSTER}`
        ) as HTMLImageElement | null;
        this.showTitleElement = this.containerElement.querySelector(
            `.${EPG_CLASSES.INFO_SHOW}`
        ) as HTMLElement | null;
        this.titleElement = this.containerElement.querySelector(
            `.${EPG_CLASSES.INFO_TITLE}`
        ) as HTMLElement | null;
        this.clearLogoElement = this.containerElement.querySelector(
            `.${EPG_CLASSES.INFO_CLEAR_LOGO}`
        ) as HTMLImageElement | null;
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
        this.descriptionInnerElement = this.containerElement.querySelector(
            `.${EPG_CLASSES.INFO_DESCRIPTION_INNER}`
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
    <div class="${EPG_CLASSES.INFO_GRADIENT_A} ${EPG_CLASSES.INFO_GRADIENT_ACTIVE}"></div>
    <div class="${EPG_CLASSES.INFO_GRADIENT_B}"></div>
    <img class="${EPG_CLASSES.INFO_BACKDROP_IMG}" alt="" />
  </div>
  <div class="${EPG_CLASSES.INFO_POSTER_WRAP}">
    <img class="${EPG_CLASSES.INFO_POSTER}" alt="" />
  </div>
  <div class="${EPG_CLASSES.INFO_CONTENT}">
      <div class="${EPG_CLASSES.INFO_HEADER}">
      <div class="${EPG_CLASSES.INFO_HEADING}">
        <img class="${EPG_CLASSES.INFO_CLEAR_LOGO}" alt="" style="display:none" />
        <div class="${EPG_CLASSES.INFO_SHOW} ${EPG_CLASSES.INFO_EYEBROW}"></div>
        <div class="${EPG_CLASSES.INFO_TITLE}"></div>
        <div class="${EPG_CLASSES.INFO_GENRES}"></div>
      </div>
      <div class="${EPG_CLASSES.INFO_META_CLUSTER}">
        <div class="${EPG_CLASSES.INFO_TAGS}" aria-hidden="true"></div>
      </div>
    </div>
    <div class="${EPG_CLASSES.INFO_META}"></div>
    <div class="${EPG_CLASSES.INFO_QUALITY}"></div>
    <div class="${EPG_CLASSES.INFO_DESCRIPTION}">
      <div class="${EPG_CLASSES.INFO_DESCRIPTION_INNER}"></div>
    </div>
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
        this.clearLogoElement = null;
        this.metaElement = null;
        this.tagsElement = null;
        this.genresElement = null;
        this.descriptionElement = null;
        this.descriptionInnerElement = null;
        this.dynamicColorToken += 1;
        this.clearColorExtractTimer();
        this.gradientAElement = null;
        this.gradientBElement = null;
        this.activeGradientSlot = 'a';
        this.colorCache.clear();
        this.colorFailureCache.clear();
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
        this.clearDynamicColor();
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

        this.applyModeClass(this.resolveInfoBackgroundMode());
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
        const hasShowTitleText = Boolean(showTitle?.textContent?.trim());

        const preferClearLogos = readStoredBoolean(LINEUP_STORAGE_KEYS.PREFER_CLEAR_LOGOS, true);
        const clearLogoPath = (item as { clearLogo?: string | null }).clearLogo ?? null;
        const clearLogoUrl = preferClearLogos && clearLogoPath
            ? (this.thumbResolver?.(clearLogoPath, 520, 84) ?? null)
            : null;

        const clearLogo = this.clearLogoElement;
        if (clearLogoUrl && clearLogo) {
            clearLogo.onerror = (): void => {
                clearLogo.onerror = null;
                clearLogo.removeAttribute('src');
                clearLogo.alt = '';
                clearLogo.style.display = 'none';
                if (item.type === 'episode') {
                    if (showTitle) showTitle.style.display = hasShowTitleText ? 'block' : 'none';
                } else {
                    if (title) title.style.display = '';
                }
            };

            clearLogo.alt = item.type === 'episode'
                ? (showTitle?.textContent ?? '')
                : (title?.textContent ?? '');
            clearLogo.src = clearLogoUrl;
            clearLogo.style.display = 'block';

            if (item.type === 'episode') {
                if (showTitle) showTitle.style.display = 'none';
                if (title) title.style.display = '';
            } else {
                if (title) title.style.display = 'none';
            }
        } else if (clearLogo) {
            clearLogo.onerror = null;
            clearLogo.removeAttribute('src');
            clearLogo.style.display = 'none';
            clearLogo.alt = '';
            if (item.type === 'episode') {
                if (showTitle) showTitle.style.display = hasShowTitleText ? 'block' : 'none';
                if (title) title.style.display = '';
            } else {
                if (title) title.style.display = '';
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
        const descriptionInner = this.descriptionInnerElement;
        if (description && descriptionInner) {
            if (options.showDescription) {
                const summary = item.summary?.trim() ?? '';
                descriptionInner.textContent = summary;
                description.style.display = summary ? 'block' : 'none';

                if (!summary) {
                    description.dataset.scrollActive = 'false';
                    description.style.removeProperty('--scroll-distance');
                } else {
                    const overflowPx = Math.max(0, descriptionInner.scrollHeight - description.clientHeight);
                    if (overflowPx > 4) {
                        description.dataset.scrollActive = 'true';
                        description.style.setProperty('--scroll-distance', `-${overflowPx}px`);
                    } else {
                        description.dataset.scrollActive = 'false';
                        description.style.removeProperty('--scroll-distance');
                    }
                }
            } else {
                if (descriptionInner.textContent) {
                    descriptionInner.textContent = '';
                }
                if (description.style.display !== 'none') {
                    description.style.display = 'none';
                }
                description.dataset.scrollActive = 'false';
                description.style.removeProperty('--scroll-distance');
            }
        }

        this.updateQualityBadges(program, undefined, { allowHdrFetch: options.allowHdrFetch });
    }

    /**
     * Update the content of the info panel (full).
     */
    private updateContentFull(program: ScheduledProgram): void {
        if (!this.containerElement) return;

        this.applyModeClass(this.resolveInfoBackgroundMode());
        this.updateNonPosterContent(program, { allowHdrFetch: true, showDescription: true });

        this.updatePoster(program, 'full');
    }

    private applyModeClass(mode: 0 | 1 | 2): void {
        if (!this.containerElement) {
            return;
        }

        this.containerElement.classList.remove(
            EPG_CLASSES.INFO_MODE_BLEED,
            EPG_CLASSES.INFO_MODE_THEME_DEFAULT,
            EPG_CLASSES.INFO_MODE_ARTWORK
        );

        if (mode === 0) {
            this.containerElement.classList.add(EPG_CLASSES.INFO_MODE_BLEED);
            return;
        }

        if (mode === 2) {
            this.containerElement.classList.add(EPG_CLASSES.INFO_MODE_ARTWORK);
            return;
        }

        this.containerElement.classList.add(EPG_CLASSES.INFO_MODE_THEME_DEFAULT);
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

    private clearColorExtractTimer(): void {
        if (this.colorExtractTimer !== null) {
            clearTimeout(this.colorExtractTimer);
            this.colorExtractTimer = null;
        }
    }

    private resolveInfoBackgroundMode(): 0 | 1 | 2 {
        const stored = safeLocalStorageGet(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE);
        if (stored === '1') {
            return 1;
        }
        if (stored === '2') {
            return 2;
        }
        return 0;
    }

    private resolvePosterSampleUrl(program: ScheduledProgram): string | null {
        const preferredThumb = this.resolvePreferredPosterThumb(program, 'full');
        return preferredThumb ? (this.thumbResolver?.(preferredThumb, 32, 32) ?? null) : null;
    }

    private ensureCacheUnderLimit<T>(map: Map<string, T>, limit: number): void {
        if (map.size <= limit) {
            return;
        }

        const oldestKey = map.keys().next().value;
        if (typeof oldestKey === 'string') {
            map.delete(oldestKey);
        }
    }

    private storeDynamicColor(cacheKey: string, color: string): void {
        this.colorFailureCache.delete(cacheKey);
        this.colorCache.set(cacheKey, color);
        this.ensureCacheUnderLimit(this.colorCache, MAX_DYNAMIC_COLOR_CACHE_ENTRIES);
    }

    private markDynamicColorFailure(cacheKey: string): void {
        this.colorFailureCache.set(cacheKey, Date.now());
        this.ensureCacheUnderLimit(this.colorFailureCache, MAX_DYNAMIC_COLOR_CACHE_ENTRIES);
    }

    private clearDynamicColor(): void {
        this.dynamicColorToken += 1;
        this.clearColorExtractTimer();

        if (this.gradientAElement) {
            this.gradientAElement.style.removeProperty('--dynamic-info-bg');
            this.gradientAElement.classList.add(EPG_CLASSES.INFO_GRADIENT_ACTIVE);
        }

        if (this.gradientBElement) {
            this.gradientBElement.style.removeProperty('--dynamic-info-bg');
            this.gradientBElement.classList.remove(EPG_CLASSES.INFO_GRADIENT_ACTIVE);
        }

        this.activeGradientSlot = 'a';
    }

    private applyDynamicColor(color: string): void {
        const incoming = this.activeGradientSlot === 'a' ? this.gradientBElement : this.gradientAElement;
        const outgoing = this.activeGradientSlot === 'a' ? this.gradientAElement : this.gradientBElement;

        if (!incoming || !outgoing) {
            return;
        }

        incoming.style.setProperty('--dynamic-info-bg', color);
        incoming.classList.add(EPG_CLASSES.INFO_GRADIENT_ACTIVE);
        outgoing.classList.remove(EPG_CLASSES.INFO_GRADIENT_ACTIVE);
        this.activeGradientSlot = this.activeGradientSlot === 'a' ? 'b' : 'a';
    }

    private scheduleDynamicColor(program: ScheduledProgram, sampleUrl: string): void {
        this.clearColorExtractTimer();

        const poster = this.posterElement;
        if (!poster) {
            this.clearDynamicColor();
            return;
        }

        const cacheKey = program.item.ratingKey;
        const cachedColor = this.colorCache.get(cacheKey);
        if (cachedColor) {
            this.applyDynamicColor(cachedColor);
            return;
        }

        const lastFailure = this.colorFailureCache.get(cacheKey) ?? null;
        if (lastFailure !== null && (Date.now() - lastFailure) < DYNAMIC_COLOR_FAILURE_COOLDOWN_MS) {
            this.clearDynamicColor();
            return;
        }
        const token = ++this.dynamicColorToken;
        this.colorExtractTimer = setTimeout(() => {
            if (token !== this.dynamicColorToken) {
                return;
            }
            const current = this.currentProgram;
            if (!current || current.item.ratingKey !== program.item.ratingKey) {
                return;
            }
            if (!this.isVisible) {
                return;
            }

            if (!sampleUrl) {
                this.markDynamicColorFailure(cacheKey);
                this.clearDynamicColor();
                return;
            }

            const sampler = new Image();
            sampler.crossOrigin = 'anonymous';
            sampler.onload = (): void => {
                if (token !== this.dynamicColorToken) {
                    return;
                }
                if (!this.isVisible) {
                    return;
                }
                const stillCurrent = this.currentProgram;
                if (!stillCurrent || stillCurrent.item.ratingKey !== program.item.ratingKey) {
                    return;
                }
                const color = extractDominantColor(sampler);
                if (color) {
                    this.storeDynamicColor(cacheKey, color);
                    this.applyDynamicColor(color);
                    return;
                }
                this.markDynamicColorFailure(cacheKey);
                this.clearDynamicColor();
            };
            sampler.onerror = (): void => {
                if (token !== this.dynamicColorToken) {
                    return;
                }
                if (!this.isVisible) {
                    return;
                }
                const stillCurrent = this.currentProgram;
                if (!stillCurrent || stillCurrent.item.ratingKey !== program.item.ratingKey) {
                    return;
                }
                this.markDynamicColorFailure(cacheKey);
                this.clearDynamicColor();
            };
            sampler.src = sampleUrl;
        }, 120);
    }

    private resolvePreferredPosterThumb(program: ScheduledProgram, mode: 'fast' | 'full'): string | null {
        const { item } = program;
        if (item.type !== 'episode') {
            return item.thumb;
        } else {
            const ratingKey = item.ratingKey;
            const hasCached = this.episodePosterCache.has(ratingKey);
            const cached = hasCached ? this.episodePosterCache.get(ratingKey) : undefined;
            const showThumb = item.showThumb || null;
            const preferredThumb = (cached ?? showThumb) ?? null;
            if (!preferredThumb && !hasCached && mode === 'full') {
                this.maybeFetchEpisodePoster(program);
            }
            return preferredThumb;
        }
    }

    private updatePoster(program: ScheduledProgram, mode: 'fast' | 'full'): void {
        const backdrop = this.backdropElement;
        const poster = this.posterElement;
        if (!poster) return;

        const { item } = program;
        const infoBackgroundMode = this.resolveInfoBackgroundMode();
        const shouldShowVisiblePoster = this.presentationMode === 'overlay';

        if (backdrop) {
            if (mode === 'full' && infoBackgroundMode === 2) {
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

        if (!shouldShowVisiblePoster) {
            poster.removeAttribute('src');
            poster.style.display = 'none';

            if (infoBackgroundMode === 0) {
                const sampleUrl = this.resolvePosterSampleUrl(program);
                if (!sampleUrl) {
                    this.clearDynamicColor();
                    return;
                }
                this.scheduleDynamicColor(program, sampleUrl);
                return;
            }

            this.clearDynamicColor();
            return;
        }

        const preferredThumb = this.resolvePreferredPosterThumb(program, mode);

        const width = mode === 'fast' ? 160 : 320;
        const height = mode === 'fast' ? 240 : 480;
        const resolvedUrl = this.thumbResolver?.(preferredThumb, width, height) || null;
        if (resolvedUrl) {
            poster.src = resolvedUrl;
            const showTitle = item.type === 'episode' ? this.getEffectiveShowTitle(item) : '';
            poster.alt = showTitle.length ? showTitle : item.title;
            poster.style.display = 'block';
            if (mode !== 'full') {
                this.clearDynamicColor();
                return;
            }

            if (infoBackgroundMode === 0) {
                const sampleUrl = this.resolvePosterSampleUrl(program);
                if (!sampleUrl) {
                    this.clearDynamicColor();
                    return;
                }
                this.scheduleDynamicColor(program, sampleUrl);
                return;
            }

            this.clearDynamicColor();
            return;
        }

        // Hide poster when unresolved (prevents file:/// errors on webOS)
        poster.removeAttribute('src');
        poster.style.display = 'none';
        this.clearDynamicColor();
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
