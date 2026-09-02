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
    clearLogo: HTMLImageElement | null;
    title: HTMLElement | null;
    subtitle: HTMLElement | null;
    infoLine: HTMLElement | null;
    upNext: HTMLElement | null;
    actionSubtitles: HTMLElement | null;
    actionSleep: HTMLElement | null;
    actionAudio: HTMLElement | null;
    sleepTimer: HTMLElement | null;
    barBuffer: HTMLElement | null;
    barPlayed: HTMLElement | null;
    timecode: HTMLElement | null;
    ends: HTMLElement | null;
    bufferText: HTMLElement | null;
};

export class PlayerOsdOverlay implements IPlayerOsdOverlay {
    private containerElement: HTMLElement | null = null;
    private isVisibleFlag = false;
    private lastStatusLabel: PlayerOsdViewModel['statusLabel'] | null = null;
    private lastInfoPillsKey: string | null = null;
    private elements: PlayerOsdElements = {
        panel: null,
        status: null,
        clearLogo: null,
        title: null,
        subtitle: null,
        infoLine: null,
        upNext: null,
        actionSubtitles: null,
        actionSleep: null,
        actionAudio: null,
        sleepTimer: null,
        barBuffer: null,
        barPlayed: null,
        timecode: null,
        ends: null,
        bufferText: null,
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
            this.containerElement.replaceChildren();
            this.containerElement.classList.remove(PLAYER_OSD_CLASSES.VISIBLE);
        }
        this.containerElement = null;
        this.isVisibleFlag = false;
        this.lastStatusLabel = null;
        this.lastInfoPillsKey = null;
        this.elements = {
            panel: null,
            status: null,
            clearLogo: null,
            title: null,
            subtitle: null,
            infoLine: null,
            upNext: null,
            actionSubtitles: null,
            actionSleep: null,
            actionAudio: null,
            sleepTimer: null,
            barBuffer: null,
            barPlayed: null,
            timecode: null,
            ends: null,
            bufferText: null,
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
        this.elements.panel?.classList.toggle(PLAYER_OSD_CLASSES.INFO_ONLY, !!vm.infoOnly);

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
                this.elements.infoLine.replaceChildren(...pills);
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
            sleepTimer: this.containerElement.querySelector(`.${PLAYER_OSD_CLASSES.SLEEP_TIMER}`),
            barBuffer: this.containerElement.querySelector(`.${PLAYER_OSD_CLASSES.BAR_BUFFER}`),
            barPlayed: this.containerElement.querySelector(`.${PLAYER_OSD_CLASSES.BAR_PLAYED}`),
            timecode: this.containerElement.querySelector(`.${PLAYER_OSD_CLASSES.TIMECODE}`),
            ends: this.containerElement.querySelector(`.${PLAYER_OSD_CLASSES.ENDS}`),
            bufferText: this.containerElement.querySelector(`.${PLAYER_OSD_CLASSES.BUFFER_TEXT}`),
        };
    }

    private createTemplateElement(): HTMLElement {
        const { panelEl } = createOverlayPrimitives(
            { panel: PLAYER_OSD_CLASSES.PANEL },
            { panel: {} }
        );

        const contentRow = document.createElement('div');
        contentRow.className = PLAYER_OSD_CLASSES.CONTENT_ROW;

        const infoColumn = document.createElement('div');
        infoColumn.className = PLAYER_OSD_CLASSES.INFO_COLUMN;
        contentRow.appendChild(infoColumn);

        const status = document.createElement('div');
        status.className = PLAYER_OSD_CLASSES.STATUS;
        status.setAttribute('role', 'status');
        infoColumn.appendChild(status);

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

        return panelEl;
    }
}
