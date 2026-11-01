import { MINI_GUIDE_CLASSES, MINI_GUIDE_TEXT } from './constants';
import type { IMiniGuideOverlay } from './interfaces';
import type { MiniGuideConfig, MiniGuideViewModel } from './types';
import { createOverlayPrimitives } from '../common/OverlayPrimitives';
import { getChannelBrandingIcon } from '../common/channelBrandingIcons';

const ROW_COUNT = 5;
type MiniGuideBrandingStrategy = MiniGuideViewModel['channels'][number]['buildStrategy'];

type MiniGuideRowElements = {
    row: HTMLElement | null;
    number: HTMLElement | null;
    brandingIcon: HTMLElement | null;
    name: HTMLElement | null;
    now: HTMLElement | null;
    next: HTMLElement | null;
    progressFill: HTMLElement | null;
    nowTime: HTMLElement | null;
    nextTime: HTMLElement | null;
    watching: HTMLElement | null;
};

type MiniGuideActions = {
    select: (index: number) => void;
    fullGuide: () => void;
    close: () => void;
    tick?: () => void;
};

export class MiniGuideOverlay implements IMiniGuideOverlay {
    private containerElement: HTMLElement | null = null;
    private isVisibleFlag = false;
    private rows: MiniGuideRowElements[] = [];
    private processedBrandingStrategyByRow: Array<MiniGuideBrandingStrategy> = [];
    private actions: MiniGuideActions | null = null;
    private emptyElement: HTMLElement | null = null;
    private clockElement: HTMLElement | null = null;
    private clockTimer: ReturnType<typeof setInterval> | null = null;

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
        this.emptyElement = this.containerElement.querySelector(`.${MINI_GUIDE_CLASSES.EMPTY}`);
        this.clockElement = this.containerElement.querySelector('.mini-guide-clock');
    }

    destroy(): void {
        this.hide();
        if (this.containerElement) {
            this.containerElement.replaceChildren();
            this.containerElement.classList.remove(MINI_GUIDE_CLASSES.VISIBLE);
        }
        this.containerElement = null;
        this.isVisibleFlag = false;
        this.rows = [];
        this.processedBrandingStrategyByRow = [];
        this.actions = null;
        this.emptyElement = null;
        this.clockElement = null;
    }

    show(): void {
        if (!this.containerElement) return;
        this.updateClock();
        if (this.clockTimer === null) {
            this.clockTimer = globalThis.setInterval(() => {
                this.updateClock();
                this.actions?.tick?.();
            }, 30_000);
        }
        this.containerElement.classList.add(MINI_GUIDE_CLASSES.VISIBLE);
        this.isVisibleFlag = true;
    }

    hide(): void {
        if (!this.containerElement) return;
        if (this.clockTimer !== null) {
            globalThis.clearInterval(this.clockTimer);
            this.clockTimer = null;
        }
        this.containerElement.classList.remove(MINI_GUIDE_CLASSES.VISIBLE);
        this.isVisibleFlag = false;
    }

    isVisible(): boolean {
        return this.isVisibleFlag;
    }

    setActions(actions: MiniGuideActions): void {
        this.actions = actions;
    }

    setViewModel(vm: MiniGuideViewModel): void {
        if (!this.containerElement) return;
        if (this.emptyElement) {
            this.emptyElement.textContent = vm.emptyMessage ?? '';
            this.emptyElement.hidden = vm.channels.length > 0;
        }

        for (let i = 0; i < ROW_COUNT; i += 1) {
            const rowVm = vm.channels[i];
            const rowElements = this.rows[i];
            if (!rowElements) {
                continue;
            }
            if (rowElements.row) rowElements.row.hidden = !rowVm;
            if (!rowVm) continue;
            const hasStatus = rowVm.status !== undefined && rowVm.status !== null;
            const isLoading = hasStatus
                ? rowVm.status === 'loading'
                : rowVm.nowTitle === 'Loading...';
            if (rowElements.row) {
                rowElements.row.classList.toggle('watching', !!rowVm.isWatching);
                if (isLoading) {
                    rowElements.row.classList.add(MINI_GUIDE_CLASSES.CHANNEL_ROW_LOADING);
                } else {
                    rowElements.row.classList.remove(MINI_GUIDE_CLASSES.CHANNEL_ROW_LOADING);
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
                rowElements.now.textContent = rowVm.nowTitle;
            }
            if (rowElements.watching) rowElements.watching.hidden = !rowVm.isWatching;
            if (rowElements.nowTime) {
                const wallTime = rowVm.nowStartTime
                    ? `${rowVm.nowStartTime}${rowVm.nowEndTime ? `–${rowVm.nowEndTime}` : ''}`
                    : '';
                const programTime = rowVm.nowElapsedTime && rowVm.nowRemainingTime
                    ? `${rowVm.nowElapsedTime} elapsed · ${rowVm.nowRemainingTime} left`
                    : '';
                rowElements.nowTime.textContent = [wallTime, programTime].filter(Boolean).join(' · ');
            }
            if (rowElements.next) {
                rowElements.next.textContent = rowVm.nextTitle ?? '—';
            }
            if (rowElements.nextTime) rowElements.nextTime.textContent = rowVm.nextStartTime ?? '';
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
                nowTime: root.querySelector(`#mini-guide-now-time-${i}`),
                nextTime: root.querySelector(`#mini-guide-next-time-${i}`),
                watching: root.querySelector(`#mini-guide-watching-${i}`),
            });
        }
    }

    private createTemplateElement(): HTMLElement {
        const { panelEl } = createOverlayPrimitives(
            { panel: MINI_GUIDE_CLASSES.PANEL },
            { panel: {} }
        );

        const header = document.createElement('div');
        header.className = 'mini-guide-header';
        const title = document.createElement('div');
        title.className = 'mini-guide-title';
        title.textContent = 'Mini Guide';
        const clock = document.createElement('span');
        clock.className = 'mini-guide-clock';
        const fullGuide = document.createElement('button');
        fullGuide.type = 'button';
        fullGuide.className = 'mini-guide-full-guide';
        fullGuide.textContent = 'Full Guide →';
        fullGuide.addEventListener('click', () => {
            if (this.isVisibleFlag) this.actions?.fullGuide();
        });
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'mini-guide-close';
        close.textContent = 'Close ×';
        close.addEventListener('click', () => {
            if (this.isVisibleFlag) this.actions?.close();
        });
        header.append(title, clock, fullGuide, close);
        panelEl.appendChild(header);

        const labels = document.createElement('div');
        labels.className = 'mini-guide-labels';
        for (const label of ['Channel', 'On now', 'Up next']) {
            const column = document.createElement('span');
            column.textContent = label;
            labels.appendChild(column);
        }
        panelEl.appendChild(labels);

        const empty = document.createElement('div');
        empty.className = MINI_GUIDE_CLASSES.EMPTY;
        empty.setAttribute('role', 'status');
        empty.hidden = true;
        panelEl.appendChild(empty);

        for (let i = 0; i < ROW_COUNT; i += 1) {
            const row = document.createElement('div');
            row.id = `mini-guide-row-${i}`;
            row.className = MINI_GUIDE_CLASSES.CHANNEL_ROW;
            row.addEventListener('click', () => {
                if (this.isVisibleFlag && !row.hidden) this.actions?.select(i);
            });

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
            const watching = document.createElement('span');
            watching.id = `mini-guide-watching-${i}`;
            watching.className = 'mini-guide-watching';
            watching.textContent = '▸ Watching';
            watching.hidden = true;
            name.appendChild(watching);

            const nowTime = document.createElement('div');
            nowTime.id = `mini-guide-now-time-${i}`;
            nowTime.className = 'mini-guide-time';

            const progressBar = document.createElement('div');
            progressBar.className = MINI_GUIDE_CLASSES.PROGRESS_BAR;
            const progressFill = document.createElement('div');
            progressFill.id = `mini-guide-progress-${i}`;
            progressFill.className = MINI_GUIDE_CLASSES.PROGRESS_FILL;
            progressBar.appendChild(progressFill);

            const next = document.createElement('div');
            next.id = `mini-guide-next-${i}`;
            next.className = MINI_GUIDE_CLASSES.PROGRAM_NEXT;
            const nextTime = document.createElement('div');
            nextTime.id = `mini-guide-next-time-${i}`;
            nextTime.className = 'mini-guide-time';

            const channelCell = document.createElement('div');
            channelCell.className = 'mini-guide-channel-cell';
            channelCell.append(number, brandingIcon, name);
            const nowCell = document.createElement('div');
            nowCell.className = 'mini-guide-program-cell';
            nowCell.append(now, nowTime, progressBar);
            const nextCell = document.createElement('div');
            nextCell.className = 'mini-guide-program-cell';
            nextCell.append(next, nextTime);

            row.append(channelCell, nowCell, nextCell);
            panelEl.appendChild(row);
        }

        const footer = document.createElement('div');
        footer.className = MINI_GUIDE_CLASSES.FOOTER_HINT;
        footer.textContent = MINI_GUIDE_TEXT.FOOTER_HINT;
        panelEl.appendChild(footer);

        return panelEl;
    }

    private updateClock(): void {
        if (!this.clockElement) return;
        this.clockElement.textContent = new Date().toLocaleTimeString(undefined, {
            hour: 'numeric', minute: '2-digit', hour12: true,
        });
    }
}
