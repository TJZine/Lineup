/**
 * @fileoverview Mini Guide overlay UI.
 * @module modules/ui/mini-guide/MiniGuideOverlay
 */

import { MINI_GUIDE_CLASSES, MINI_GUIDE_TEXT } from './constants';
import type { IMiniGuideOverlay } from './interfaces';
import type { MiniGuideConfig, MiniGuideViewModel } from './types';
import { createOverlayPrimitives } from '../common/OverlayPrimitives';
import { getChannelBrandingIcon } from '../common/channelBrandingIcons';

const ROW_COUNT = 5;

type MiniGuideRowElements = {
    row: HTMLElement | null;
    number: HTMLElement | null;
    brandingIcon: HTMLElement | null;
    name: HTMLElement | null;
    now: HTMLElement | null;
    next: HTMLElement | null;
    progressFill: HTMLElement | null;
};

export class MiniGuideOverlay implements IMiniGuideOverlay {
    private containerElement: HTMLElement | null = null;
    private isVisibleFlag = false;
    private rows: MiniGuideRowElements[] = [];
    private processedBrandingStrategyByRow: Array<string | null> = [];

    initialize(config: MiniGuideConfig): void {
        const container = document.getElementById(config.containerId);
        if (!container) {
            throw new Error(`Mini Guide container #${config.containerId} not found`);
        }
        this.containerElement = container;
        this.containerElement.classList.add(MINI_GUIDE_CLASSES.CONTAINER);
        this.containerElement.textContent = '';
        this.containerElement.appendChild(this.createTemplateElement());
        this.containerElement.classList.remove(MINI_GUIDE_CLASSES.VISIBLE);
        this.isVisibleFlag = false;
        this.cacheElements();
        this.processedBrandingStrategyByRow = Array(ROW_COUNT).fill(null);
    }

    destroy(): void {
        if (this.containerElement) {
            this.containerElement.replaceChildren();
            this.containerElement.classList.remove(MINI_GUIDE_CLASSES.VISIBLE);
        }
        this.containerElement = null;
        this.isVisibleFlag = false;
        this.rows = [];
        this.processedBrandingStrategyByRow = [];
    }

    show(): void {
        if (!this.containerElement) return;
        this.containerElement.classList.add(MINI_GUIDE_CLASSES.VISIBLE);
        this.isVisibleFlag = true;
    }

    hide(): void {
        if (!this.containerElement) return;
        this.containerElement.classList.remove(MINI_GUIDE_CLASSES.VISIBLE);
        this.isVisibleFlag = false;
    }

    isVisible(): boolean {
        return this.isVisibleFlag;
    }

    setViewModel(vm: MiniGuideViewModel): void {
        if (!this.containerElement) return;

        for (let i = 0; i < ROW_COUNT; i += 1) {
            const rowVm = vm.channels[i];
            const rowElements = this.rows[i];
            if (!rowVm || !rowElements) {
                continue;
            }
            const hasStatus = rowVm.status !== undefined && rowVm.status !== null;
            const isLoading = hasStatus
                ? rowVm.status === 'loading'
                : rowVm.nowTitle === 'Loading...';
            if (rowElements.row) {
                if (isLoading) {
                    rowElements.row.classList.add(MINI_GUIDE_CLASSES.CHANNEL_ROW_LOADING);
                } else {
                    rowElements.row.classList.remove(MINI_GUIDE_CLASSES.CHANNEL_ROW_LOADING);
                }
                if (rowVm.buildStrategy) {
                    rowElements.row.dataset.buildStrategy = rowVm.buildStrategy;
                } else {
                    delete rowElements.row.dataset.buildStrategy;
                }
            }
            if (rowElements.number) {
                rowElements.number.textContent = String(rowVm.channelNumber);
            }
            if (rowElements.brandingIcon) {
                const desiredStrategy =
                    rowVm.showBrandingIcon && rowVm.buildStrategy ? rowVm.buildStrategy : null;
                const processedStrategy = this.processedBrandingStrategyByRow[i];
                if (desiredStrategy !== processedStrategy) {
                    if (desiredStrategy === null) {
                        rowElements.brandingIcon.replaceChildren();
                        this.processedBrandingStrategyByRow[i] = null;
                    } else {
                        const icon = getChannelBrandingIcon(desiredStrategy);
                        rowElements.brandingIcon.replaceChildren();
                        if (icon) {
                            rowElements.brandingIcon.appendChild(icon);
                        }
                        this.processedBrandingStrategyByRow[i] = desiredStrategy;
                    }
                }
            }
            if (rowElements.name) {
                rowElements.name.textContent = rowVm.channelName;
            }
            if (rowElements.now) {
                rowElements.now.textContent = '';
                if (rowVm.nowStartTime) {
                    const start = document.createElement('span');
                    start.className = 'mini-guide-start-time';
                    start.textContent = rowVm.nowStartTime;
                    rowElements.now.appendChild(start);
                }
                rowElements.now.appendChild(document.createTextNode(rowVm.nowTitle));
            }
            if (rowElements.next) {
                rowElements.next.textContent = rowVm.nextTitle ?? '';
                rowElements.next.style.display = rowVm.nextTitle ? 'block' : 'none';
            }
            if (rowElements.progressFill) {
                const percent = Math.max(0, Math.min(1, rowVm.nowProgress)) * 100;
                rowElements.progressFill.style.width = `${percent.toFixed(2)}%`;
            }
        }
    }

    setFocusedIndex(index: number): void {
        for (let i = 0; i < this.rows.length; i += 1) {
            const row = this.rows[i]?.row;
            if (!row) continue;
            if (i === index) {
                row.classList.add(MINI_GUIDE_CLASSES.CHANNEL_ROW_FOCUSED);
            } else {
                row.classList.remove(MINI_GUIDE_CLASSES.CHANNEL_ROW_FOCUSED);
            }
        }
    }

    private cacheElements(): void {
        this.rows = [];
        const root = this.containerElement;
        if (!root) return;
        for (let i = 0; i < ROW_COUNT; i += 1) {
            this.rows.push({
                row: root.querySelector(`#mini-guide-row-${i}`),
                number: root.querySelector(`#mini-guide-num-${i}`),
                brandingIcon: root.querySelector(`#mini-guide-icon-${i}`),
                name: root.querySelector(`#mini-guide-name-${i}`),
                now: root.querySelector(`#mini-guide-now-${i}`),
                next: root.querySelector(`#mini-guide-next-${i}`),
                progressFill: root.querySelector(`#mini-guide-progress-${i}`),
            });
        }
    }

    private createTemplateElement(): HTMLElement {
        const { panelEl } = createOverlayPrimitives(
            { panel: MINI_GUIDE_CLASSES.PANEL },
            { panel: {} }
        );

        for (let i = 0; i < ROW_COUNT; i += 1) {
            const row = document.createElement('div');
            row.id = `mini-guide-row-${i}`;
            row.className = MINI_GUIDE_CLASSES.CHANNEL_ROW;

            const number = document.createElement('div');
            number.id = `mini-guide-num-${i}`;
            number.className = MINI_GUIDE_CLASSES.CHANNEL_NUMBER;

            const brandingIcon = document.createElement('span');
            brandingIcon.id = `mini-guide-icon-${i}`;
            brandingIcon.className = MINI_GUIDE_CLASSES.BRANDING_ICON_SLOT;

            const name = document.createElement('div');
            name.id = `mini-guide-name-${i}`;
            name.className = MINI_GUIDE_CLASSES.CHANNEL_NAME;

            const now = document.createElement('div');
            now.id = `mini-guide-now-${i}`;
            now.className = MINI_GUIDE_CLASSES.PROGRAM_NOW;

            const progressBar = document.createElement('div');
            progressBar.className = MINI_GUIDE_CLASSES.PROGRESS_BAR;
            const progressFill = document.createElement('div');
            progressFill.id = `mini-guide-progress-${i}`;
            progressFill.className = MINI_GUIDE_CLASSES.PROGRESS_FILL;
            progressBar.appendChild(progressFill);

            const next = document.createElement('div');
            next.id = `mini-guide-next-${i}`;
            next.className = MINI_GUIDE_CLASSES.PROGRAM_NEXT;

            row.append(number, brandingIcon, name, now, progressBar, next);
            panelEl.appendChild(row);
        }

        const footer = document.createElement('div');
        footer.className = MINI_GUIDE_CLASSES.FOOTER_HINT;
        footer.textContent = MINI_GUIDE_TEXT.FOOTER_HINT;
        panelEl.appendChild(footer);

        return panelEl;
    }
}
