/**
 * @fileoverview Player OSD overlay UI.
 * @module modules/ui/player-osd/PlayerOsdOverlay
 */

import { PLAYER_OSD_CLASSES } from './constants';
import type { IPlayerOsdOverlay } from './interfaces';
import type { PlayerOsdConfig, PlayerOsdViewModel } from './types';
import { createOverlayPrimitives } from '../common/OverlayPrimitives';

const SVG_NS = 'http://www.w3.org/2000/svg';

type PlayerOsdElements = {
    panel: HTMLElement | null;
    status: HTMLElement | null;
    channel: HTMLElement | null;
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
        channel: null,
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
            channel: null,
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
        if (this.elements.channel) {
            this.elements.channel.textContent = vm.channelPrefix;
            this.elements.channel.style.display = vm.channelPrefix ? 'block' : 'none';
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

                    const renderedHeight = img.getBoundingClientRect().height;
                    const isUsable = renderedHeight >= 24;

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
        if (this.elements.actionSubtitles) {
            this.elements.actionSubtitles.id = vm.actionIds?.subtitles ?? '';
        }
        if (this.elements.actionSleep) {
            this.elements.actionSleep.id = vm.actionIds?.sleep ?? '';
        }
        if (this.elements.actionAudio) {
            this.elements.actionAudio.id = vm.actionIds?.audio ?? '';
        }
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

    private cacheElements(): void {
        if (!this.containerElement) return;
        this.elements = {
            panel: this.containerElement.querySelector(`.${PLAYER_OSD_CLASSES.PANEL}`),
            status: this.containerElement.querySelector(`.${PLAYER_OSD_CLASSES.STATUS}`),
            channel: this.containerElement.querySelector(`.${PLAYER_OSD_CLASSES.CHANNEL}`),
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
        panelEl.innerHTML = `
            <div class="${PLAYER_OSD_CLASSES.CONTENT_ROW}">
              <div class="${PLAYER_OSD_CLASSES.INFO_COLUMN}">
                <div class="${PLAYER_OSD_CLASSES.STATUS}" role="status"></div>

                <div class="${PLAYER_OSD_CLASSES.ZONE_BRAND}">
                  <img class="${PLAYER_OSD_CLASSES.CLEAR_LOGO}" alt="" style="display:none" />
                  <div class="${PLAYER_OSD_CLASSES.TITLE}"></div>
                </div>

                <div class="${PLAYER_OSD_CLASSES.ZONE_DETAILS}">
                  <div class="${PLAYER_OSD_CLASSES.SUBTITLE}"></div>
                  <div class="${PLAYER_OSD_CLASSES.INFO_LINE}"></div>
                </div>
              </div>

              <div class="${PLAYER_OSD_CLASSES.ACTIONS_COLUMN}">
                <div class="${PLAYER_OSD_CLASSES.ACTIONS}">
                  <button type="button" class="${PLAYER_OSD_CLASSES.ACTION}" data-action="subtitles">Subtitles</button>
                  <button type="button" class="${PLAYER_OSD_CLASSES.ACTION}" data-action="sleep">Sleep</button>
                  <button type="button" class="${PLAYER_OSD_CLASSES.ACTION}" data-action="audio">Audio</button>
                </div>
                <div class="${PLAYER_OSD_CLASSES.SLEEP_TIMER}"></div>
              </div>
            </div>

            <div class="${PLAYER_OSD_CLASSES.META_STRIP}">
              <div class="${PLAYER_OSD_CLASSES.CHANNEL}"></div>
              <div class="${PLAYER_OSD_CLASSES.UP_NEXT}"></div>
              <div class="${PLAYER_OSD_CLASSES.TIMECODE}"></div>
              <div class="${PLAYER_OSD_CLASSES.ENDS}"></div>
              <div class="${PLAYER_OSD_CLASSES.BUFFER_TEXT}"></div>
            </div>

            <div class="${PLAYER_OSD_CLASSES.PROGRESS_CONTAINER}">
              <div class="${PLAYER_OSD_CLASSES.BAR}">
                <div class="${PLAYER_OSD_CLASSES.BAR_BUFFER}"></div>
                <div class="${PLAYER_OSD_CLASSES.BAR_PLAYED}"></div>
              </div>
            </div>
        `;
        return panelEl;
    }
}
