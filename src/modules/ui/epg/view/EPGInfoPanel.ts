import { EPG_CLASSES } from '../constants';
import { formatTime, formatDuration } from '../utils';
import type { IEPGInfoPanel } from '../interfaces';
import type { ScheduledProgram } from '../types';
import type { EpgItemDetails } from '../model/domainTypes';
import { formatContentRatingBadge } from '../../../../utils/contentRating';
import { EpgPreferencesStore } from '../../../settings/EpgPreferencesStore';
import { NowPlayingDisplayStore } from '../../../settings/NowPlayingDisplayStore';
import { EPGInfoPanelDetailsLoader } from './EPGInfoPanelDetailsLoader';
import { EPGInfoPanelDynamicBackground } from './EPGInfoPanelDynamicBackground';

const QUALITY_BADGE_SLOT_COUNT = 5;

type InfoPanelTemplateBindings = {
    backdrop: HTMLImageElement | null;
    gradientA: HTMLElement | null;
    gradientB: HTMLElement | null;
    poster: HTMLImageElement | null;
    showTitle: HTMLElement | null;
    title: HTMLElement | null;
    clearLogo: HTMLImageElement | null;
    meta: HTMLElement | null;
    tags: HTMLElement | null;
    genres: HTMLElement | null;
    description: HTMLElement | null;
    descriptionInner: HTMLElement | null;
    qualityContainer: HTMLElement | null;
};

type TitleDisplayState = {
    isEpisode: boolean;
    hasShowTitleText: boolean;
    showTitleText: string;
    titleText: string;
};

/**
 * EPG Info Panel class.
 * Displays program details in an overlay at the bottom of the EPG.
 */
export class EPGInfoPanel implements IEPGInfoPanel {
    private readonly epgPreferencesStore = new EpgPreferencesStore();
    private readonly nowPlayingDisplayStore = new NowPlayingDisplayStore();
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
    private qualityBadges: HTMLElement[] = [];
    private readonly detailsLoader = new EPGInfoPanelDetailsLoader({
        onPendingWork: (): void => this.ensureIdlePromise(),
        onSettled: (): void => this.resolveIdleIfSettled(),
        onHdrLoaded: (ratingKey, hdr): void => this.applyFetchedHdr(ratingKey, hdr),
        onEpisodePosterLoaded: (ratingKey): void => this.applyFetchedEpisodePoster(ratingKey),
    });
    private readonly dynamicBackground = new EPGInfoPanelDynamicBackground({
        onPendingWork: (): void => this.ensureIdlePromise(),
        onSettled: (): void => this.resolveIdleIfSettled(),
        isCurrentRequest: (program, token): boolean => this.isDynamicColorRequestCurrent(program, token),
    });
    private presentationMode: 'classic' | 'overlay' = 'overlay';
    private idlePromise: Promise<void> = Promise.resolve();
    private resolveIdlePromise: (() => void) | null = null;

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
        fetcher: ((ratingKey: string, options?: { signal?: AbortSignal | null }) => Promise<EpgItemDetails | null>) | null
    ): void {
        this.detailsLoader.setFetchItemDetails(fetcher);
    }

    setPresentationMode(mode: 'classic' | 'overlay'): void {
        this.presentationMode = mode;
    }

    async whenIdle(): Promise<void> {
        while (this.hasPendingAsyncWork()) {
            this.ensureIdlePromise();
            const idle = this.idlePromise;
            await idle;
        }
    }

    getPresentationMode(): 'classic' | 'overlay' {
        return this.presentationMode;
    }

    getDynamicBackgroundCacheStats(): ReturnType<EPGInfoPanelDynamicBackground['getCacheStats']> {
        return this.dynamicBackground.getCacheStats();
    }

    initialize(parentElement: HTMLElement): void {
        const container = this.createContainerElement();
        parentElement.appendChild(container);
        this.containerElement = container;

        const bindings = this.bindTemplateElements(container);
        this.backdropElement = bindings.backdrop;
        this.dynamicBackground.bindGradientElements(bindings.gradientA, bindings.gradientB);
        this.posterElement = bindings.poster;
        this.showTitleElement = bindings.showTitle;
        this.titleElement = bindings.title;
        this.clearLogoElement = bindings.clearLogo;
        this.metaElement = bindings.meta;
        this.tagsElement = bindings.tags;
        this.genresElement = bindings.genres;
        this.descriptionElement = bindings.description;
        this.descriptionInnerElement = bindings.descriptionInner;
        this.initializeQualityBadges(bindings.qualityContainer);
    }

    private createContainerElement(): HTMLElement {
        const container = document.createElement('div');
        container.className = EPG_CLASSES.INFO_PANEL;
        container.replaceChildren(this.createTemplateElement());
        container.style.display = 'flex';
        container.style.visibility = 'hidden';
        container.style.opacity = '0';
        return container;
    }

    private bindTemplateElements(container: HTMLElement): InfoPanelTemplateBindings {
        return {
            backdrop: this.queryTemplateElement<HTMLImageElement>(container, EPG_CLASSES.INFO_BACKDROP_IMG),
            gradientA: this.queryTemplateElement<HTMLElement>(container, EPG_CLASSES.INFO_GRADIENT_A),
            gradientB: this.queryTemplateElement<HTMLElement>(container, EPG_CLASSES.INFO_GRADIENT_B),
            poster: this.queryTemplateElement<HTMLImageElement>(container, EPG_CLASSES.INFO_POSTER),
            showTitle: this.queryTemplateElement<HTMLElement>(container, EPG_CLASSES.INFO_SHOW),
            title: this.queryTemplateElement<HTMLElement>(container, EPG_CLASSES.INFO_TITLE),
            clearLogo: this.queryTemplateElement<HTMLImageElement>(container, EPG_CLASSES.INFO_CLEAR_LOGO),
            meta: this.queryTemplateElement<HTMLElement>(container, EPG_CLASSES.INFO_META),
            tags: this.queryTemplateElement<HTMLElement>(container, EPG_CLASSES.INFO_TAGS),
            genres: this.queryTemplateElement<HTMLElement>(container, EPG_CLASSES.INFO_GENRES),
            description: this.queryTemplateElement<HTMLElement>(container, EPG_CLASSES.INFO_DESCRIPTION),
            descriptionInner: this.queryTemplateElement<HTMLElement>(container, EPG_CLASSES.INFO_DESCRIPTION_INNER),
            qualityContainer: this.queryTemplateElement<HTMLElement>(container, EPG_CLASSES.INFO_QUALITY),
        };
    }

    private queryTemplateElement<T extends HTMLElement>(
        container: HTMLElement,
        className: string
    ): T | null {
        return container.querySelector(`.${className}`) as T | null;
    }

    private initializeQualityBadges(qualityContainer: HTMLElement | null): void {
        this.qualityBadges = [];
        if (!qualityContainer) {
            return;
        }

        // Rating + up to 4 media quality badges (resolution/HDR/audio codec/channels).
        for (let i = 0; i < QUALITY_BADGE_SLOT_COUNT; i++) {
            const badge = document.createElement('span');
            badge.className = EPG_CLASSES.INFO_QUALITY_BADGE;
            badge.style.display = 'none';
            qualityContainer.appendChild(badge);
            this.qualityBadges.push(badge);
        }
    }

    private createTemplateElement(): DocumentFragment {
        const fragment = document.createDocumentFragment();

        const backdrop = document.createElement('div');
        backdrop.className = EPG_CLASSES.INFO_BACKDROP;
        backdrop.setAttribute('aria-hidden', 'true');
        const gradientA = document.createElement('div');
        gradientA.className = `${EPG_CLASSES.INFO_GRADIENT_A} ${EPG_CLASSES.INFO_GRADIENT_ACTIVE}`;
        backdrop.appendChild(gradientA);
        const gradientB = document.createElement('div');
        gradientB.className = EPG_CLASSES.INFO_GRADIENT_B;
        backdrop.appendChild(gradientB);
        const backdropImage = document.createElement('img');
        backdropImage.className = EPG_CLASSES.INFO_BACKDROP_IMG;
        backdropImage.setAttribute('alt', '');
        backdrop.appendChild(backdropImage);
        fragment.appendChild(backdrop);

        const posterWrap = document.createElement('div');
        posterWrap.className = EPG_CLASSES.INFO_POSTER_WRAP;
        const poster = document.createElement('img');
        poster.className = EPG_CLASSES.INFO_POSTER;
        poster.setAttribute('alt', '');
        posterWrap.appendChild(poster);
        fragment.appendChild(posterWrap);

        const content = document.createElement('div');
        content.className = EPG_CLASSES.INFO_CONTENT;
        const header = document.createElement('div');
        header.className = EPG_CLASSES.INFO_HEADER;
        const heading = document.createElement('div');
        heading.className = EPG_CLASSES.INFO_HEADING;
        const clearLogo = document.createElement('img');
        clearLogo.className = EPG_CLASSES.INFO_CLEAR_LOGO;
        clearLogo.setAttribute('alt', '');
        clearLogo.style.display = 'none';
        heading.appendChild(clearLogo);
        const show = document.createElement('div');
        show.className = `${EPG_CLASSES.INFO_SHOW} ${EPG_CLASSES.INFO_EYEBROW}`;
        heading.appendChild(show);
        const title = document.createElement('div');
        title.className = EPG_CLASSES.INFO_TITLE;
        heading.appendChild(title);
        const genres = document.createElement('div');
        genres.className = EPG_CLASSES.INFO_GENRES;
        heading.appendChild(genres);
        header.appendChild(heading);

        const metaCluster = document.createElement('div');
        metaCluster.className = EPG_CLASSES.INFO_META_CLUSTER;
        const tags = document.createElement('div');
        tags.className = EPG_CLASSES.INFO_TAGS;
        tags.setAttribute('aria-hidden', 'true');
        metaCluster.appendChild(tags);
        header.appendChild(metaCluster);
        content.appendChild(header);

        const meta = document.createElement('div');
        meta.className = EPG_CLASSES.INFO_META;
        content.appendChild(meta);

        const quality = document.createElement('div');
        quality.className = EPG_CLASSES.INFO_QUALITY;
        content.appendChild(quality);

        const description = document.createElement('div');
        description.className = EPG_CLASSES.INFO_DESCRIPTION;
        const descriptionInner = document.createElement('div');
        descriptionInner.className = EPG_CLASSES.INFO_DESCRIPTION_INNER;
        description.appendChild(descriptionInner);
        content.appendChild(description);

        fragment.appendChild(content);
        return fragment;
    }

    /**
     * Destroy the info panel and clean up resources.
     */
    destroy(): void {
        this.detailsLoader.destroy();
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
        this.dynamicBackground.unbind();
        this.dynamicBackground.clearCaches();
        this.currentProgram = null;
        this.thumbResolver = null;
        this.isVisible = false;
        this.qualityBadges = [];
        this.resolveIdleIfSettled();
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
        this.detailsLoader.clearHdrFetch();
        this.detailsLoader.clearPosterFetch();
        this.dynamicBackground.clearDynamicColor();
        this.resolveIdleIfSettled();
    }

    update(program: ScheduledProgram): void {
        this.updateFull(program);
    }

    updateFast(program: ScheduledProgram): void {
        if (!this.containerElement) return;

        this.currentProgram = program;
        this.updateContentFast(program, { allowHdrFetch: false });
        this.containerElement.style.visibility = 'visible';
        this.containerElement.style.opacity = '1';
        this.isVisible = true;
    }

    updateFull(program: ScheduledProgram): void {
        if (!this.containerElement) return;

        this.currentProgram = program;
        this.updateContentFull(program);
        this.containerElement.style.visibility = 'visible';
        this.containerElement.style.opacity = '1';
        this.isVisible = true;
    }

    private updateContentFast(
        program: ScheduledProgram,
        options?: { allowHdrFetch?: boolean }
    ): void {
        if (!this.containerElement) return;

        const infoBackgroundMode = this.resolveInfoBackgroundMode();
        this.applyModeClass(infoBackgroundMode);
        this.updatePoster(program, 'fast', infoBackgroundMode);

        this.updateNonPosterContent(program, { allowHdrFetch: options?.allowHdrFetch ?? false, showDescription: false });
    }

    private updateNonPosterContent(
        program: ScheduledProgram,
        options: { allowHdrFetch: boolean; showDescription: boolean }
    ): void {
        const titleState = this.applyTitleText(program);
        this.applyClearLogo(program, titleState);

        this.updateMetaAndTags(program);
        this.applyGenres(program);
        this.applyDescription(program, options.showDescription);

        this.updateQualityBadges(program, undefined, { allowHdrFetch: options.allowHdrFetch });
    }

    private applyTitleText(program: ScheduledProgram): TitleDisplayState {
        const { item } = program;
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

        return {
            isEpisode: item.type === 'episode',
            hasShowTitleText: Boolean(showTitle?.textContent?.trim()),
            showTitleText: showTitle?.textContent ?? '',
            titleText: title?.textContent ?? '',
        };
    }

    private applyClearLogo(program: ScheduledProgram, titleState: TitleDisplayState): void {
        const { item } = program;
        const showTitle = this.showTitleElement;
        const title = this.titleElement;
        const clearLogo = this.clearLogoElement;
        const preferClearLogos = this.nowPlayingDisplayStore.readPreferClearLogosEnabledAndClean(true);
        const clearLogoPath = (item as { clearLogo?: string | null }).clearLogo ?? null;
        const clearLogoUrl = preferClearLogos && clearLogoPath
            ? (this.thumbResolver?.(clearLogoPath, 520, 84) ?? null)
            : null;

        if (clearLogoUrl && clearLogo) {
            clearLogo.onerror = (): void => {
                clearLogo.onerror = null;
                clearLogo.removeAttribute('src');
                clearLogo.alt = '';
                clearLogo.style.display = 'none';
                if (titleState.isEpisode) {
                    if (showTitle) showTitle.style.display = titleState.hasShowTitleText ? 'block' : 'none';
                } else {
                    if (title) title.style.display = '';
                }
            };

            clearLogo.alt = titleState.isEpisode
                ? titleState.showTitleText
                : titleState.titleText;
            clearLogo.src = clearLogoUrl;
            clearLogo.style.display = 'block';

            if (titleState.isEpisode) {
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
            this.restoreTextVisibilityForLogoFallback(titleState);
        }
    }

    private restoreTextVisibilityForLogoFallback(titleState: TitleDisplayState): void {
        if (titleState.isEpisode) {
            if (this.showTitleElement) {
                this.showTitleElement.style.display = titleState.hasShowTitleText ? 'block' : 'none';
            }
            if (this.titleElement) {
                this.titleElement.style.display = '';
            }
            return;
        }

        if (this.titleElement) {
            this.titleElement.style.display = '';
        }
    }

    private applyGenres(program: ScheduledProgram): void {
        const genres = this.genresElement;
        if (!genres) {
            return;
        }

        const genreText = program.item.genres && program.item.genres.length > 0
            ? program.item.genres.slice(0, 3).join(' • ')
            : '';
        genres.textContent = genreText;
        genres.style.display = genreText ? 'block' : 'none';
    }

    private applyDescription(program: ScheduledProgram, visible: boolean): void {
        const description = this.descriptionElement;
        const descriptionInner = this.descriptionInnerElement;
        if (!description || !descriptionInner) {
            return;
        }

        if (!visible) {
            if (descriptionInner.textContent) {
                descriptionInner.textContent = '';
            }
            if (description.style.display !== 'none') {
                description.style.display = 'none';
            }
            description.dataset.scrollActive = 'false';
            description.style.removeProperty('--scroll-distance');
            return;
        }

        const summary = program.item.summary?.trim() ?? '';
        descriptionInner.textContent = summary;
        description.style.display = summary ? 'block' : 'none';

        if (!summary) {
            description.dataset.scrollActive = 'false';
            description.style.removeProperty('--scroll-distance');
            return;
        }

        const overflowPx = Math.max(0, descriptionInner.scrollHeight - description.clientHeight);
        if (overflowPx > 4) {
            description.dataset.scrollActive = 'true';
            description.style.setProperty('--scroll-distance', `-${overflowPx}px`);
            return;
        }

        description.dataset.scrollActive = 'false';
        description.style.removeProperty('--scroll-distance');
    }

    private updateContentFull(program: ScheduledProgram): void {
        if (!this.containerElement) return;

        const infoBackgroundMode = this.resolveInfoBackgroundMode();
        this.applyModeClass(infoBackgroundMode);
        this.updateNonPosterContent(program, { allowHdrFetch: true, showDescription: true });

        this.updatePoster(program, 'full', infoBackgroundMode);
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
            const cachedHdr = this.detailsLoader.getCachedHdr(program.item.ratingKey);
            if (cachedHdr) {
                this.updateQualityBadges(program, cachedHdr);
                return;
            }
            if (allowHdrFetch) {
                this.detailsLoader.maybeFetchHdr(program);
            } else {
                this.detailsLoader.clearHdrFetch();
            }
        } else {
            this.detailsLoader.clearHdrFetch();
        }
    }

    private applyFetchedHdr(ratingKey: string, hdr: string): void {
        const current = this.currentProgram;
        if (!current || current.item.ratingKey !== ratingKey) {
            return;
        }
        this.updateQualityBadges(current, hdr);
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

    private resolveInfoBackgroundMode(): 0 | 1 | 2 {
        return this.epgPreferencesStore.readInfoBackgroundModeAndClean(0);
    }

    private resolvePosterSampleUrl(program: ScheduledProgram): string | null {
        const preferredThumb = this.resolvePreferredPosterThumb(program, 'fast');
        return preferredThumb ? (this.thumbResolver?.(preferredThumb, 32, 32) ?? null) : null;
    }

    private isDynamicColorRequestCurrent(program: ScheduledProgram, _token: number): boolean {
        if (!this.isVisible) {
            return false;
        }

        const current = this.currentProgram;
        return Boolean(current && current.item.ratingKey === program.item.ratingKey);
    }

    private resolvePreferredPosterThumb(program: ScheduledProgram, mode: 'fast' | 'full'): string | null {
        const { item } = program;
        if (item.type !== 'episode') {
            return item.thumb;
        } else {
            const ratingKey = item.ratingKey;
            const hasCached = this.detailsLoader.hasCachedEpisodePoster(ratingKey);
            const cached = this.detailsLoader.getCachedEpisodePoster(ratingKey);
            const showThumb = item.showThumb || null;
            const preferredThumb = (cached ?? showThumb) ?? null;
            if (!preferredThumb && !hasCached && mode === 'full') {
                this.detailsLoader.maybeFetchEpisodePoster(program);
            }
            return preferredThumb;
        }
    }

    private updatePoster(
        program: ScheduledProgram,
        mode: 'fast' | 'full',
        infoBackgroundModeOverride?: 0 | 1 | 2
    ): void {
        const poster = this.posterElement;
        if (!poster) return;

        const infoBackgroundMode = infoBackgroundModeOverride ?? this.resolveInfoBackgroundMode();
        const shouldShowVisiblePoster = this.presentationMode === 'overlay';
        const preserveBleedDuringFastPath = mode !== 'full' && infoBackgroundMode === 0;

        this.applyBackdrop(program, mode, infoBackgroundMode);

        if (!shouldShowVisiblePoster) {
            this.hidePoster(poster);
            this.applyDynamicBackground(program, mode, infoBackgroundMode, preserveBleedDuringFastPath);
            return;
        }

        const preferredThumb = this.resolvePreferredPosterThumb(program, mode);

        const width = mode === 'fast' ? 160 : 320;
        const height = mode === 'fast' ? 240 : 480;
        const resolvedUrl = this.thumbResolver?.(preferredThumb, width, height) || null;
        if (resolvedUrl) {
            this.showPoster(poster, program, resolvedUrl);
            this.applyDynamicBackground(program, mode, infoBackgroundMode, preserveBleedDuringFastPath);
            return;
        }

        // Hide poster when unresolved (prevents file:/// errors on webOS)
        this.hidePoster(poster);
        this.clearDynamicBackgroundForMissingPoster(preserveBleedDuringFastPath);
    }

    private applyBackdrop(
        program: ScheduledProgram,
        mode: 'fast' | 'full',
        infoBackgroundMode: 0 | 1 | 2
    ): void {
        const backdrop = this.backdropElement;
        if (!backdrop) {
            return;
        }

        if (mode === 'full' && infoBackgroundMode === 2) {
            const art = program.item.art ?? null;
            if (art) {
                const resolvedBackdrop = this.thumbResolver?.(art, 960, 540) || null;
                if (resolvedBackdrop) {
                    backdrop.src = resolvedBackdrop;
                    backdrop.style.display = 'block';
                    return;
                }
            }
        }

        backdrop.removeAttribute('src');
        backdrop.style.display = 'none';
    }

    private showPoster(
        poster: HTMLImageElement,
        program: ScheduledProgram,
        resolvedUrl: string
    ): void {
        const { item } = program;
        poster.src = resolvedUrl;
        const showTitle = item.type === 'episode' ? this.getEffectiveShowTitle(item) : '';
        poster.alt = showTitle.length ? showTitle : item.title;
        poster.style.display = 'block';
    }

    private hidePoster(poster: HTMLImageElement): void {
        poster.removeAttribute('src');
        poster.style.display = 'none';
    }

    private applyDynamicBackground(
        program: ScheduledProgram,
        mode: 'fast' | 'full',
        infoBackgroundMode: 0 | 1 | 2,
        preserveBleedDuringFastPath: boolean
    ): void {
        if (preserveBleedDuringFastPath) {
            return;
        }

        if (mode !== 'full') {
            this.dynamicBackground.clearDynamicColor();
            return;
        }

        if (infoBackgroundMode === 0) {
            const sampleUrl = this.resolvePosterSampleUrl(program);
            if (!sampleUrl) {
                this.dynamicBackground.clearDynamicColor();
                return;
            }
            this.dynamicBackground.scheduleDynamicColor(program, sampleUrl);
            return;
        }

        this.dynamicBackground.clearDynamicColor();
    }

    private clearDynamicBackgroundForMissingPoster(preserveBleedDuringFastPath: boolean): void {
        if (!preserveBleedDuringFastPath) {
            this.dynamicBackground.clearDynamicColor();
        }
    }

    private extractShowTitleFromFullTitle(fullTitle: string): string | null {
        const match = fullTitle.match(/^(.*?)\s-\sS\d{1,2}E\d{1,2}\s-/i);
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

    private applyFetchedEpisodePoster(ratingKey: string): void {
        const current = this.currentProgram;
        if (!current || current.item.ratingKey !== ratingKey) {
            return;
        }
        this.updatePoster(current, 'full');
    }

    private hasPendingAsyncWork(): boolean {
        return this.detailsLoader.hasPendingAsyncWork()
            || this.dynamicBackground.hasPendingAsyncWork();
    }

    private ensureIdlePromise(): void {
        if (this.resolveIdlePromise) {
            return;
        }

        this.idlePromise = new Promise((resolve) => {
            this.resolveIdlePromise = resolve;
        });
    }

    private resolveIdleIfSettled(): void {
        if (this.hasPendingAsyncWork() || !this.resolveIdlePromise) {
            return;
        }

        const resolve = this.resolveIdlePromise;
        this.resolveIdlePromise = null;
        resolve();
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

    getCurrentProgram(): ScheduledProgram | null {
        return this.currentProgram;
    }

    isShowing(): boolean {
        return this.isVisible;
    }
}
