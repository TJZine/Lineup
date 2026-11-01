import { PLAYER_OSD_CLASSES } from './constants';
import type { IPlayerOsdOverlay } from './interfaces';
import type { PlayerOsdConfig, PlayerOsdViewModel } from './types';
import { isClearLogoUsable } from '../common/ClearLogoPresentation';
import { createOverlayPrimitives } from '../common/OverlayPrimitives';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CLEAR_LOGO_TARGET_HEIGHT = 60;

type PlayerOsdElements = {
    panel: HTMLElement | null;
    status: HTMLElement | null;
    errorText: HTMLElement | null;
    clearLogo: HTMLImageElement | null;
    title: HTMLElement | null;
    subtitle: HTMLElement | null;
    infoLine: HTMLElement | null;
    upNext: HTMLElement | null;
    actionSubtitles: HTMLElement | null;
    actionSleep: HTMLElement | null;
    actionAudio: HTMLElement | null;
    actionExpand: HTMLElement | null;
    actionGuide: HTMLElement | null;
    actionTransport: HTMLElement | null;
    actionRetry: HTMLElement | null;
    actionMoreInfo: HTMLElement | null;
    expanded: HTMLElement | null;
    reader: HTMLElement | null;
    trackDrawer: HTMLElement | null;
    sleepTimer: HTMLElement | null;
    barBuffer: HTMLElement | null;
    barPlayed: HTMLElement | null;
    timecode: HTMLElement | null;
    ends: HTMLElement | null;
    bufferText: HTMLElement | null;
    sleepPicker: HTMLElement | null;
};

export class PlayerOsdOverlay implements IPlayerOsdOverlay {
    private containerElement: HTMLElement | null = null;
    private isVisibleFlag = false;
    private lastStatusLabel: PlayerOsdViewModel['statusLabel'] | null = null;
    private lastInfoPillsKey: string | null = null;
    private elements: PlayerOsdElements = {
        panel: null,
        status: null,
        errorText: null,
        clearLogo: null,
        title: null,
        subtitle: null,
        infoLine: null,
        upNext: null,
        actionSubtitles: null,
        actionSleep: null,
        actionAudio: null,
        actionExpand: null,
        actionGuide: null,
        actionTransport: null,
        actionRetry: null,
        actionMoreInfo: null,
        expanded: null,
        reader: null,
        trackDrawer: null,
        sleepTimer: null,
        barBuffer: null,
        barPlayed: null,
        timecode: null,
        ends: null,
        bufferText: null,
        sleepPicker: null,
    };

    initialize(config: PlayerOsdConfig): void {
        const container = document.getElementById(config.containerId);
        if (!container) {
            throw new Error(`Player OSD container #${config.containerId} not found`);
        }
        this.containerElement = container;
        this.containerElement.classList.add(PLAYER_OSD_CLASSES.CONTAINER);
        this.containerElement.textContent = '';
        this.containerElement.appendChild(this.createTemplateElement());
        this.containerElement.classList.remove(PLAYER_OSD_CLASSES.VISIBLE);
        this.isVisibleFlag = false;
        this.lastStatusLabel = null;
        this.lastInfoPillsKey = null;
        this.cacheElements();
    }

    destroy(): void {
        if (this.elements.clearLogo) {
            this.elements.clearLogo.onerror = null;
            this.elements.clearLogo.onload = null;
        }
        if (this.containerElement) {
            this.containerElement.textContent = '';
            this.containerElement.classList.remove(PLAYER_OSD_CLASSES.VISIBLE);
        }
        this.containerElement = null;
        this.isVisibleFlag = false;
        this.lastStatusLabel = null;
        this.lastInfoPillsKey = null;
        this.elements = {
            panel: null,
            status: null,
            errorText: null,
            clearLogo: null,
            title: null,
            subtitle: null,
            infoLine: null,
            upNext: null,
            actionSubtitles: null,
            actionSleep: null,
            actionAudio: null,
            actionExpand: null,
            actionGuide: null,
            actionTransport: null,
            actionRetry: null,
            actionMoreInfo: null,
            expanded: null,
            reader: null,
            trackDrawer: null,
            sleepTimer: null,
            barBuffer: null,
            barPlayed: null,
            timecode: null,
            ends: null,
            bufferText: null,
            sleepPicker: null,
        };
    }

    show(): void {
        if (!this.containerElement) return;
        this.containerElement.classList.add(PLAYER_OSD_CLASSES.VISIBLE);
        this.isVisibleFlag = true;
    }

    hide(): void {
        if (!this.containerElement) return;
        this.containerElement.classList.remove(PLAYER_OSD_CLASSES.VISIBLE);
        this.isVisibleFlag = false;
    }

    isVisible(): boolean {
        return this.isVisibleFlag;
    }

    setViewModel(vm: PlayerOsdViewModel): void {
        if (!this.containerElement) return;
        this.containerElement.dataset.presentation = vm.presentation ?? 'compact';
        this.containerElement.dataset.parentPresentation = vm.parentPresentation ?? 'expanded';
        this.renderSleepPicker(vm);
        this.renderDetails(vm);
        this.renderTrackDrawer(vm);

        if (this.elements.status) {
            const label = vm.statusLabel;
            if (label !== this.lastStatusLabel) {
                this.elements.status.setAttribute('aria-label', label);
                this.elements.status.textContent = '';
                const icon = this.createStatusIcon(label);
                if (icon) this.elements.status.appendChild(icon);
                else this.elements.status.textContent = label;
                this.lastStatusLabel = label;
            }
        }
        if (this.elements.errorText) {
            this.elements.errorText.textContent = vm.retryPending
                ? 'Retrying playback…'
                : vm.errorText ?? '';
            this.elements.errorText.hidden = !vm.retryPending && !vm.errorText;
        }
        if (this.elements.title) {
            this.elements.title.textContent = vm.title;
        }
        if (this.elements.clearLogo) {
            const img = this.elements.clearLogo;
            if (vm.clearLogoUrl) {
                const expectedSrc = vm.clearLogoUrl;
                img.onerror = (): void => {
                    if (img.getAttribute('src') !== expectedSrc) return;
                    img.onerror = null;
                    img.onload = null;
                    img.style.visibility = '';
                    img.removeAttribute('src');
                    img.alt = '';
                    img.style.display = 'none';
                    if (this.elements.title) {
                        this.elements.title.style.display = '';
                    }
                };
                img.onload = (): void => {
                    if (img.getAttribute('src') !== expectedSrc) return;
                    img.onerror = null;
                    img.onload = null;

                    const isUsable = isClearLogoUsable(
                        img.naturalWidth,
                        img.naturalHeight,
                        CLEAR_LOGO_TARGET_HEIGHT,
                        img.getBoundingClientRect().width
                    );

                    img.style.visibility = '';
                    if (isUsable) {
                        if (this.elements.title) {
                            this.elements.title.style.display = 'none';
                        }
                        return;
                    }

                    // Unusable: hide logo and fall back to title.
                    img.removeAttribute('src');
                    img.alt = '';
                    img.style.display = 'none';
                    if (this.elements.title) {
                        this.elements.title.style.display = '';
                    }
                };

                img.setAttribute('src', expectedSrc);
                img.alt = vm.title || '';
                if (this.elements.title) {
                    // Keep the title visible until the logo is proven usable.
                    this.elements.title.style.display = '';
                }
                // Avoid flashing an unusable logo while still allowing measurement on load.
                img.style.visibility = 'hidden';
                img.style.display = '';
                // Some engines won't re-fire load for cached images when src is unchanged.
                if (img.complete && img.naturalWidth > 0) {
                    img.onload?.(new Event('load'));
                }
            } else {
                img.onerror = null;
                img.onload = null;
                img.removeAttribute('src');
                img.alt = '';
                img.style.display = 'none';
                img.style.visibility = '';
                if (this.elements.title) {
                    this.elements.title.style.display = '';
                }
            }
        }
        if (this.elements.subtitle) {
            this.elements.subtitle.textContent = vm.subtitle ?? '';
            this.elements.subtitle.style.display = vm.subtitle ? 'block' : 'none';
        }
        if (this.elements.infoLine) {
            const parts = [
                vm.audioLabel ? `Audio: ${vm.audioLabel}` : null,
                vm.subtitleLabel ? `Subs: ${vm.subtitleLabel}` : null,
            ].filter(Boolean) as string[];
            const nextKey = parts.join('\u0000');
            if (nextKey !== this.lastInfoPillsKey) {
                const pills = parts.map(part => {
                    const pill = document.createElement('span');
                    pill.className = PLAYER_OSD_CLASSES.PILL;
                    pill.textContent = part;
                    return pill;
                });
                this.elements.infoLine.textContent = '';
                this.elements.infoLine.append(...pills);
                this.lastInfoPillsKey = nextKey;
            }
            this.elements.infoLine.style.display = parts.length > 0 ? '' : 'none';
        }
        if (this.elements.upNext) {
            this.elements.upNext.textContent = vm.upNextText ?? '';
            this.elements.upNext.style.display = vm.upNextText ? 'block' : 'none';
        }
        this.updateActionButton(this.elements.actionSubtitles, vm.actionIds?.subtitles ?? '');
        this.updateActionButton(this.elements.actionSleep, vm.actionIds?.sleep ?? '');
        this.updateActionButton(this.elements.actionAudio, vm.actionIds?.audio ?? '');
        this.updateActionButton(this.elements.actionExpand, vm.actionIds?.expand ?? '');
        this.updateActionButton(this.elements.actionGuide, vm.actionIds?.guide ?? '');
        this.updateActionButton(this.elements.actionTransport, vm.actionIds?.transport ?? '');
        this.updateActionButton(this.elements.actionRetry, vm.actionIds?.retry ?? '');
        this.updateActionButton(this.elements.actionMoreInfo, vm.actionIds?.moreInfo ?? '');
        if (this.elements.sleepTimer) {
            this.elements.sleepTimer.textContent = vm.sleepTimerText ?? '';
            this.elements.sleepTimer.style.display = vm.sleepTimerText ? '' : 'none';
        }
        if (this.elements.barPlayed) {
            const playedPercent = Math.max(0, Math.min(1, vm.playedRatio)) * 100;
            this.elements.barPlayed.style.width = `${playedPercent.toFixed(2)}%`;
        }
        if (this.elements.barBuffer) {
            const bufferPercent = Math.max(0, Math.min(1, vm.bufferedRatio)) * 100;
            this.elements.barBuffer.style.width = `${bufferPercent.toFixed(2)}%`;
        }
        if (vm.statusLabel === 'BUFFERING') {
            if (this.elements.barPlayed) this.elements.barPlayed.style.opacity = '0.3';
            if (this.elements.barBuffer) this.elements.barBuffer.style.opacity = '0.3';
        } else {
            if (this.elements.barPlayed) this.elements.barPlayed.style.opacity = '';
            if (this.elements.barBuffer) this.elements.barBuffer.style.opacity = '';
        }
        if (this.elements.timecode) {
            this.elements.timecode.textContent = vm.timecode;
        }
        if (this.elements.ends) {
            this.elements.ends.textContent = vm.endsAtText ?? '';
            this.elements.ends.style.display = vm.endsAtText ? 'block' : 'none';
        }
        if (this.elements.bufferText) {
            this.elements.bufferText.textContent = vm.bufferText ?? '';
            this.elements.bufferText.style.display = vm.bufferText ? 'block' : 'none';
        }
    }

    private renderDetails(vm: PlayerOsdViewModel): void {
        const expanded = this.elements.expanded;
        const reader = this.elements.reader;
        if (!expanded || !reader) return;
        const content = (host: HTMLElement, full: boolean): void => {
            const title = host.querySelector('.player-osd-detail-title');
            if (title) title.textContent = vm.title || 'Program information unavailable';
            const facts = host.querySelector('.player-osd-detail-facts');
            if (facts) facts.textContent = vm.facts?.join(' · ') ?? '';
            const badges = host.querySelector('.player-osd-detail-badges');
            if (badges) badges.textContent = vm.qualityBadges?.join(' · ') ?? '';
            const cast = host.querySelector('.player-osd-detail-cast');
            if (cast) cast.textContent = vm.castText ? `Cast: ${vm.castText}` : '';
            const playback = host.querySelector('.player-osd-detail-playback');
            if (playback) playback.textContent = [vm.playbackSummary, ...(vm.playbackDetails ?? [])].filter(Boolean).join(' · ');
            const summary = host.querySelector('.player-osd-detail-summary');
            if (summary) {
                summary.textContent = vm.detailStatus === 'loading'
                    ? 'Loading program details…'
                    : vm.detailStatus === 'error'
                        ? 'Could not load program details. Retry to try again.'
                        : vm.description || 'No description available for this program.';
            }
            const poster = host.querySelector('.player-osd-detail-poster') as HTMLImageElement | null;
            const posterFallback = host.querySelector('.player-osd-detail-poster-fallback') as HTMLElement | null;
            if (poster) {
                if (vm.posterUrl) {
                    if (poster.getAttribute('src') !== vm.posterUrl) {
                        poster.hidden = false;
                        if (posterFallback) posterFallback.hidden = true;
                    }
                    if (poster.getAttribute('src') !== vm.posterUrl) poster.src = vm.posterUrl;
                    poster.alt = vm.title ? `${vm.title} poster` : 'Program poster';
                    poster.onerror = (): void => {
                        poster.hidden = true;
                        if (posterFallback) posterFallback.hidden = false;
                    };
                } else {
                    poster.removeAttribute('src');
                    poster.hidden = true;
                    if (posterFallback) posterFallback.hidden = false;
                }
            }
            if (full) {
                const retry = host.querySelector('.player-osd-reader-retry') as HTMLButtonElement | null;
                if (retry) retry.hidden = vm.detailStatus !== 'error';
            }
        };
        content(expanded, false);
        content(reader, true);
    }

    private renderTrackDrawer(vm: PlayerOsdViewModel): void {
        const host = this.elements.trackDrawer;
        if (!host) return;
        const section = vm.trackDrawer;
        if (!section || (vm.presentation !== 'audio' && vm.presentation !== 'subtitles')) {
            host.textContent = '';
            delete host.dataset.optionIds;
            delete host.dataset.section;
            return;
        }
        const ids = [...section.options, ...(section.modeOptions ?? [])].map((option) => option.id).join('\u0000');
        if (host.dataset.optionIds !== ids || host.dataset.section !== vm.presentation) {
            host.textContent = '';
            host.dataset.optionIds = ids;
            host.dataset.section = vm.presentation;
            const heading = document.createElement('div');
            heading.className = 'player-osd-track-heading';
            const title = document.createElement('h2');
            title.textContent = section.title;
            heading.appendChild(title);
            const close = document.createElement('button');
            close.id = 'player-osd-track-close';
            close.type = 'button';
            close.textContent = 'Close ×';
            heading.appendChild(close);
            host.appendChild(heading);
            const list = document.createElement('div');
            list.className = 'player-osd-track-list';
            host.appendChild(list);
            const empty = document.createElement('div');
            empty.className = 'player-osd-track-empty';
            empty.setAttribute('role', 'status');
            host.appendChild(empty);
            const footer = document.createElement('div');
            footer.className = 'player-osd-track-footer';
            host.appendChild(footer);
            if (section.modeOptions) {
                const modeHeading = document.createElement('div');
                modeHeading.className = 'player-osd-track-mode-heading';
                modeHeading.textContent = 'PLAYBACK MODE';
                host.insertBefore(modeHeading, footer);
                const modes = document.createElement('div');
                modes.className = 'player-osd-track-modes';
                host.insertBefore(modes, footer);
            }
        }
        const list = host.querySelector('.player-osd-track-list');
        if (!list) return;
        for (const option of section.options) {
            let button = Array.from(list.children).find((element) => element.id === option.id) as HTMLButtonElement | undefined;
            if (!button) {
                button = document.createElement('button');
                button.type = 'button';
                button.id = option.id;
                list.appendChild(button);
            }
            button.className = 'player-osd-track-option';
            button.disabled = Boolean(option.disabled);
            button.setAttribute('aria-pressed', String(Boolean(option.selected)));
            if (option.selected) button.classList.add('selected');
            const label = document.createElement('span');
            label.className = 'player-osd-track-label';
            label.textContent = option.label;
            const detail = document.createElement('span');
            detail.className = 'player-osd-track-meta';
            detail.textContent = [option.meta, option.state].filter(Boolean).join(' · ');
            button.textContent = '';
            button.append(label, detail);
        }
        const modes = host.querySelector('.player-osd-track-modes');
        if (modes) {
            for (const option of section.modeOptions ?? []) {
                let button = Array.from(modes.children).find((element) => element.id === option.id) as HTMLButtonElement | undefined;
                if (!button) {
                    button = document.createElement('button');
                    button.type = 'button';
                    button.id = option.id;
                    modes.appendChild(button);
                }
                button.textContent = option.label;
                button.className = `player-osd-track-mode${option.selected ? ' selected' : ''}`;
                button.setAttribute('aria-pressed', String(Boolean(option.selected)));
            }
        }
        const footer = host.querySelector('.player-osd-track-footer');
        const empty = host.querySelector('.player-osd-track-empty');
        if (empty) {
            empty.textContent = section.emptyMessage ?? '';
            (empty as HTMLElement).hidden = !section.emptyMessage;
        }
        if (footer) footer.textContent = section.helperText ?? '';
    }

    private renderSleepPicker(vm: PlayerOsdViewModel): void {
        const picker = this.elements.sleepPicker;
        if (!picker) return;
        if (vm.presentation !== 'sleep') {
            picker.textContent = '';
            return;
        }
        if (picker.querySelector('.player-osd-sleep-list')) {
            for (const choice of vm.sleepChoices ?? []) {
                const button = picker.querySelector(`#player-osd-sleep-${choice.minutes}`);
                button?.setAttribute('aria-pressed', String(choice.selected));
                button?.classList.toggle('selected', choice.selected);
            }
            const remaining = picker.querySelector('.player-osd-sleep-remaining');
            if (remaining) remaining.textContent = vm.sleepRemainingText ?? 'Sleep timer is off';
            return;
        }
        const heading = document.createElement('div');
        heading.className = 'player-osd-sleep-heading';
        const title = document.createElement('h2');
        title.textContent = 'Sleep timer';
        heading.appendChild(title);
        const close = document.createElement('button');
        close.type = 'button';
        close.id = 'player-osd-sleep-close';
        close.textContent = 'Close ×';
        heading.appendChild(close);
        picker.appendChild(heading);
        const list = document.createElement('div');
        list.className = 'player-osd-sleep-list';
        for (const choice of vm.sleepChoices ?? []) {
            const button = document.createElement('button');
            button.type = 'button';
            button.id = `player-osd-sleep-${choice.minutes}`;
            button.textContent = choice.label;
            button.setAttribute('aria-pressed', String(choice.selected));
            if (choice.selected) button.classList.add('selected');
            list.appendChild(button);
        }
        picker.appendChild(list);
        const remaining = document.createElement('div');
        remaining.className = 'player-osd-sleep-remaining';
        remaining.textContent = vm.sleepRemainingText ?? 'Sleep timer is off';
        picker.appendChild(remaining);
    }

    private createStatusIcon(label: PlayerOsdViewModel['statusLabel']): SVGElement | null {
        if (label !== 'PLAYING' && label !== 'PAUSED' && label !== 'BUFFERING') {
            return null;
        }
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('class', 'player-osd-status-icon');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');

        if (label === 'PLAYING') {
            svg.setAttribute('fill', 'currentColor');
            const path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('d', 'M8 5v14l11-7z');
            svg.appendChild(path);
            return svg;
        }

        if (label === 'PAUSED') {
            svg.setAttribute('fill', 'currentColor');
            const left = document.createElementNS(SVG_NS, 'rect');
            left.setAttribute('x', '6');
            left.setAttribute('y', '4');
            left.setAttribute('width', '4');
            left.setAttribute('height', '16');
            const right = document.createElementNS(SVG_NS, 'rect');
            right.setAttribute('x', '14');
            right.setAttribute('y', '4');
            right.setAttribute('width', '4');
            right.setAttribute('height', '16');
            svg.append(left, right);
            return svg;
        }

        if (label === 'BUFFERING') {
            svg.setAttribute('class', 'player-osd-status-icon player-osd-spinner');
            svg.setAttribute('fill', 'none');
            const circle = document.createElementNS(SVG_NS, 'circle');
            circle.setAttribute('cx', '12');
            circle.setAttribute('cy', '12');
            circle.setAttribute('r', '10');
            circle.setAttribute('stroke', 'currentColor');
            circle.setAttribute('stroke-width', '2.5');
            circle.setAttribute('stroke-dasharray', '50 20');
            circle.setAttribute('stroke-linecap', 'round');
            svg.appendChild(circle);
            return svg;
        }

        return null;
    }

    private updateActionButton(element: HTMLElement | null, id: string): void {
        if (!element) return;
        element.id = id;
        const enabled = id.length > 0;
        if (element instanceof HTMLButtonElement) {
            element.disabled = !enabled;
        }
        if (enabled) {
            element.removeAttribute('aria-disabled');
        } else {
            element.setAttribute('aria-disabled', 'true');
        }
    }

    private cacheElements(): void {
        if (!this.containerElement) return;
        this.elements = {
            panel: this.containerElement.querySelector(`.${PLAYER_OSD_CLASSES.PANEL}`),
            status: this.containerElement.querySelector(`.${PLAYER_OSD_CLASSES.STATUS}`),
            errorText: this.containerElement.querySelector('.player-osd-error-text'),
            clearLogo: this.containerElement.querySelector(`.${PLAYER_OSD_CLASSES.CLEAR_LOGO}`),
            title: this.containerElement.querySelector(`.${PLAYER_OSD_CLASSES.TITLE}`),
            subtitle: this.containerElement.querySelector(`.${PLAYER_OSD_CLASSES.SUBTITLE}`),
            infoLine: this.containerElement.querySelector(`.${PLAYER_OSD_CLASSES.INFO_LINE}`),
            upNext: this.containerElement.querySelector(`.${PLAYER_OSD_CLASSES.UP_NEXT}`),
            actionSubtitles: this.containerElement.querySelector(
                `.${PLAYER_OSD_CLASSES.ACTION}[data-action="subtitles"]`
            ),
            actionSleep: this.containerElement.querySelector(
                `.${PLAYER_OSD_CLASSES.ACTION}[data-action="sleep"]`
            ),
            actionAudio: this.containerElement.querySelector(
                `.${PLAYER_OSD_CLASSES.ACTION}[data-action="audio"]`
            ),
            actionExpand: this.containerElement.querySelector('[data-action="expand"]'),
            actionGuide: this.containerElement.querySelector('[data-action="guide"]'),
            actionTransport: this.containerElement.querySelector('[data-action="transport"]'),
            actionRetry: this.containerElement.querySelector('[data-action="retry"]'),
            actionMoreInfo: this.containerElement.querySelector('.player-osd-more-info'),
            expanded: this.containerElement.querySelector('.player-osd-expanded'),
            reader: this.containerElement.querySelector('.player-osd-reader'),
            trackDrawer: this.containerElement.querySelector('.player-osd-track-drawer'),
            sleepTimer: this.containerElement.querySelector(`.${PLAYER_OSD_CLASSES.SLEEP_TIMER}`),
            barBuffer: this.containerElement.querySelector(`.${PLAYER_OSD_CLASSES.BAR_BUFFER}`),
            barPlayed: this.containerElement.querySelector(`.${PLAYER_OSD_CLASSES.BAR_PLAYED}`),
            timecode: this.containerElement.querySelector(`.${PLAYER_OSD_CLASSES.TIMECODE}`),
            ends: this.containerElement.querySelector(`.${PLAYER_OSD_CLASSES.ENDS}`),
            bufferText: this.containerElement.querySelector(`.${PLAYER_OSD_CLASSES.BUFFER_TEXT}`),
            sleepPicker: this.containerElement.querySelector('.player-osd-sleep-picker'),
        };
    }

    private createTemplateElement(): HTMLElement {
        const { panelEl } = createOverlayPrimitives(
            { panel: PLAYER_OSD_CLASSES.PANEL },
            { panel: {} }
        );

        const expanded = document.createElement('section');
        expanded.className = 'player-osd-expanded';
        expanded.setAttribute('aria-label', 'Now playing details');
        const expandedHeading = document.createElement('div');
        expandedHeading.className = 'player-osd-expanded-heading';
        expandedHeading.textContent = 'Now playing';
        expanded.appendChild(expandedHeading);
        const expandedClose = document.createElement('button');
        expandedClose.id = 'player-osd-expanded-close';
        expandedClose.type = 'button';
        expandedClose.textContent = 'Close ×';
        expanded.appendChild(expandedClose);
        const expandedBody = document.createElement('div');
        expandedBody.className = 'player-osd-expanded-body';
        expandedBody.appendChild(this.createDetailsBody());
        expanded.appendChild(expandedBody);
        const moreInfo = document.createElement('button');
        moreInfo.className = 'player-osd-more-info';
        moreInfo.type = 'button';
        moreInfo.textContent = 'More info';
        expanded.appendChild(moreInfo);
        panelEl.appendChild(expanded);

        const contentRow = document.createElement('div');
        contentRow.className = PLAYER_OSD_CLASSES.CONTENT_ROW;

        const infoColumn = document.createElement('div');
        infoColumn.className = PLAYER_OSD_CLASSES.INFO_COLUMN;
        contentRow.appendChild(infoColumn);

        const status = document.createElement('div');
        status.className = PLAYER_OSD_CLASSES.STATUS;
        status.setAttribute('role', 'status');
        infoColumn.appendChild(status);

        const errorText = document.createElement('div');
        errorText.className = 'player-osd-error-text';
        errorText.setAttribute('role', 'status');
        errorText.hidden = true;
        infoColumn.appendChild(errorText);

        const zoneBrand = document.createElement('div');
        zoneBrand.className = PLAYER_OSD_CLASSES.ZONE_BRAND;
        infoColumn.appendChild(zoneBrand);

        const clearLogo = document.createElement('img');
        clearLogo.className = PLAYER_OSD_CLASSES.CLEAR_LOGO;
        clearLogo.setAttribute('alt', '');
        clearLogo.style.display = 'none';
        zoneBrand.appendChild(clearLogo);

        const title = document.createElement('div');
        title.className = PLAYER_OSD_CLASSES.TITLE;
        zoneBrand.appendChild(title);

        const zoneDetails = document.createElement('div');
        zoneDetails.className = PLAYER_OSD_CLASSES.ZONE_DETAILS;
        infoColumn.appendChild(zoneDetails);

        const subtitle = document.createElement('div');
        subtitle.className = PLAYER_OSD_CLASSES.SUBTITLE;
        zoneDetails.appendChild(subtitle);

        const infoLine = document.createElement('div');
        infoLine.className = PLAYER_OSD_CLASSES.INFO_LINE;
        zoneDetails.appendChild(infoLine);

        const actionsColumn = document.createElement('div');
        actionsColumn.className = PLAYER_OSD_CLASSES.ACTIONS_COLUMN;
        contentRow.appendChild(actionsColumn);

        const actions = document.createElement('div');
        actions.className = PLAYER_OSD_CLASSES.ACTIONS;
        actionsColumn.appendChild(actions);

        const subtitlesBtn = document.createElement('button');
        subtitlesBtn.type = 'button';
        subtitlesBtn.className = PLAYER_OSD_CLASSES.ACTION;
        subtitlesBtn.dataset.action = 'subtitles';
        subtitlesBtn.textContent = 'Subtitles';
        subtitlesBtn.disabled = true;
        subtitlesBtn.setAttribute('aria-disabled', 'true');
        actions.appendChild(subtitlesBtn);

        const sleepBtn = document.createElement('button');
        sleepBtn.type = 'button';
        sleepBtn.className = PLAYER_OSD_CLASSES.ACTION;
        sleepBtn.dataset.action = 'sleep';
        sleepBtn.textContent = 'Sleep';
        sleepBtn.disabled = true;
        sleepBtn.setAttribute('aria-disabled', 'true');
        actions.appendChild(sleepBtn);

        const audioBtn = document.createElement('button');
        audioBtn.type = 'button';
        audioBtn.className = PLAYER_OSD_CLASSES.ACTION;
        audioBtn.dataset.action = 'audio';
        audioBtn.textContent = 'Audio';
        audioBtn.disabled = true;
        audioBtn.setAttribute('aria-disabled', 'true');
        actions.appendChild(audioBtn);

        const retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.className = PLAYER_OSD_CLASSES.ACTION;
        retryBtn.dataset.action = 'retry';
        retryBtn.textContent = 'Retry';
        actions.appendChild(retryBtn);

        for (const [action, label] of [
            ['transport', 'Pause / Play'],
            ['guide', 'Guide'],
            ['expand', 'More'],
        ] as const) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = PLAYER_OSD_CLASSES.ACTION;
            button.dataset.action = action;
            button.textContent = label;
            actions.appendChild(button);
        }

        const sleepTimer = document.createElement('div');
        sleepTimer.className = PLAYER_OSD_CLASSES.SLEEP_TIMER;
        actionsColumn.appendChild(sleepTimer);

        panelEl.appendChild(contentRow);

        const metaStrip = document.createElement('div');
        metaStrip.className = PLAYER_OSD_CLASSES.META_STRIP;
        panelEl.appendChild(metaStrip);

        const metaLeft = document.createElement('div');
        metaLeft.className = PLAYER_OSD_CLASSES.META_LEFT;
        metaStrip.appendChild(metaLeft);

        const timecode = document.createElement('div');
        timecode.className = PLAYER_OSD_CLASSES.TIMECODE;
        metaLeft.appendChild(timecode);

        const ends = document.createElement('div');
        ends.className = PLAYER_OSD_CLASSES.ENDS;
        metaLeft.appendChild(ends);

        const bufferText = document.createElement('div');
        bufferText.className = PLAYER_OSD_CLASSES.BUFFER_TEXT;
        metaLeft.appendChild(bufferText);

        const metaRight = document.createElement('div');
        metaRight.className = PLAYER_OSD_CLASSES.META_RIGHT;
        metaStrip.appendChild(metaRight);

        const upNext = document.createElement('div');
        upNext.className = PLAYER_OSD_CLASSES.UP_NEXT;
        metaRight.appendChild(upNext);

        const progressContainer = document.createElement('div');
        progressContainer.className = PLAYER_OSD_CLASSES.PROGRESS_CONTAINER;
        panelEl.appendChild(progressContainer);

        const bar = document.createElement('div');
        bar.className = PLAYER_OSD_CLASSES.BAR;
        progressContainer.appendChild(bar);

        const barBuffer = document.createElement('div');
        barBuffer.className = PLAYER_OSD_CLASSES.BAR_BUFFER;
        bar.appendChild(barBuffer);

        const barPlayed = document.createElement('div');
        barPlayed.className = PLAYER_OSD_CLASSES.BAR_PLAYED;
        bar.appendChild(barPlayed);

        const sleepPicker = document.createElement('section');
        sleepPicker.className = 'player-osd-sleep-picker';
        sleepPicker.setAttribute('role', 'dialog');
        sleepPicker.setAttribute('aria-label', 'Sleep timer');
        panelEl.appendChild(sleepPicker);

        const reader = document.createElement('section');
        reader.className = 'player-osd-reader';
        reader.setAttribute('role', 'dialog');
        reader.setAttribute('aria-label', 'More information');
        const readerHeading = document.createElement('div');
        readerHeading.className = 'player-osd-reader-heading';
        const readerTitle = document.createElement('h2');
        readerTitle.textContent = 'More info';
        readerHeading.appendChild(readerTitle);
        const readerClose = document.createElement('button');
        readerClose.type = 'button';
        readerClose.id = 'player-osd-reader-close';
        readerClose.textContent = 'Close ×';
        readerHeading.appendChild(readerClose);
        reader.appendChild(readerHeading);
        const readerScroll = document.createElement('div');
        readerScroll.className = 'player-osd-reader-scroll';
        readerScroll.id = 'player-osd-reader-scroll';
        readerScroll.tabIndex = -1;
        readerScroll.appendChild(this.createDetailsBody());
        reader.appendChild(readerScroll);
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'player-osd-reader-retry';
        retry.id = 'player-osd-reader-retry';
        retry.textContent = 'Retry';
        reader.appendChild(retry);
        panelEl.appendChild(reader);

        const trackDrawer = document.createElement('section');
        trackDrawer.className = 'player-osd-track-drawer';
        trackDrawer.setAttribute('role', 'dialog');
        panelEl.appendChild(trackDrawer);

        return panelEl;
    }

    private createDetailsBody(): HTMLElement {
        const body = document.createElement('div');
        body.className = 'player-osd-detail-body';
        const poster = document.createElement('img');
        poster.className = 'player-osd-detail-poster';
        poster.hidden = true;
        body.appendChild(poster);
        const posterFallback = document.createElement('div');
        posterFallback.className = 'player-osd-detail-poster-fallback';
        posterFallback.textContent = 'Poster unavailable';
        body.appendChild(posterFallback);
        const text = document.createElement('div');
        text.className = 'player-osd-detail-text';
        for (const className of ['title', 'facts', 'badges', 'summary', 'cast', 'playback']) {
            const element: HTMLElement = className === 'title'
                ? document.createElement('h3')
                : document.createElement('p');
            element.className = `player-osd-detail-${className}`;
            text.appendChild(element);
        }
        body.appendChild(text);
        return body;
    }
}
