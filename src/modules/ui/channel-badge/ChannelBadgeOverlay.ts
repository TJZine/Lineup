import { CHANNEL_BADGE_CLASSES } from './constants';
import type { IChannelBadgeOverlay } from './interfaces';
import type { ChannelBadgeConfig, ChannelBadgeViewModel } from './types';

export class ChannelBadgeOverlay implements IChannelBadgeOverlay {
    private containerElement: HTMLElement | null = null;
    private textElement: HTMLElement | null = null;
    private isVisibleFlag = false;

    initialize(config: ChannelBadgeConfig): void {
        const container = document.getElementById(config.containerId);
        if (!container) {
            throw new Error(`Channel badge container #${config.containerId} not found`);
        }
        this.containerElement = container;
        this.containerElement.classList.add(CHANNEL_BADGE_CLASSES.CONTAINER);
        this.containerElement.classList.remove(CHANNEL_BADGE_CLASSES.VISIBLE);
        this.containerElement.replaceChildren();

        const text = document.createElement('span');
        text.className = CHANNEL_BADGE_CLASSES.TEXT;
        this.containerElement.appendChild(text);
        this.textElement = text;
        this.isVisibleFlag = false;
    }

    destroy(): void {
        if (this.containerElement) {
            this.containerElement.classList.remove(CHANNEL_BADGE_CLASSES.VISIBLE);
            this.containerElement.replaceChildren();
        }
        this.containerElement = null;
        this.textElement = null;
        this.isVisibleFlag = false;
    }

    show(viewModel: ChannelBadgeViewModel): void {
        if (!this.containerElement || !this.textElement) return;
        const label = formatChannelLabel(viewModel);
        if (!label) {
            this.hide();
            return;
        }
        this.textElement.textContent = label;
        this.containerElement.classList.add(CHANNEL_BADGE_CLASSES.VISIBLE);
        this.isVisibleFlag = true;
    }

    hide(): void {
        if (!this.containerElement) return;
        this.containerElement.classList.remove(CHANNEL_BADGE_CLASSES.VISIBLE);
        this.isVisibleFlag = false;
    }

    isVisible(): boolean {
        return this.isVisibleFlag;
    }
}

function formatChannelLabel(vm: ChannelBadgeViewModel): string {
    const num = vm.channelNumber;
    const name = vm.channelName?.trim() ?? '';
    if (typeof num === 'number' && Number.isFinite(num) && name.length > 0) return `${num} · ${name}`;
    if (typeof num === 'number' && Number.isFinite(num)) return `CH ${num}`;
    if (name.length > 0) return name;
    return '';
}
