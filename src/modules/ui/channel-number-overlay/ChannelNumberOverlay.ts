import { CHANNEL_NUMBER_CLASSES } from './constants';
import type { IChannelNumberOverlay } from './interfaces';

const DEFAULT_MAX_DIGITS = 3;
const ERROR_AUTO_HIDE_MS = 2_000;

export class ChannelNumberOverlay implements IChannelNumberOverlay {
    private containerElement: HTMLElement | null = null;
    private digitsElement: HTMLElement | null = null;
    private hideTimer: number | null = null;
    private isVisibleFlag = false;

    initialize(containerId: string): void {
        if (typeof document === 'undefined') {
            this.containerElement = null;
            this.digitsElement = null;
            this.isVisibleFlag = false;
            return;
        }
        const existing = document.getElementById(containerId);
        if (!existing) {
            throw new Error(`Channel number overlay container #${containerId} not found`);
        }
        this.containerElement = existing;
        this.containerElement.classList.add(CHANNEL_NUMBER_CLASSES.CONTAINER);
        this.containerElement.classList.remove(CHANNEL_NUMBER_CLASSES.VISIBLE, CHANNEL_NUMBER_CLASSES.ERROR);
        this.containerElement.innerHTML = `
            <div class="${CHANNEL_NUMBER_CLASSES.PANEL}">
                <span class="${CHANNEL_NUMBER_CLASSES.LABEL}">CH</span>
                <span class="${CHANNEL_NUMBER_CLASSES.DIGITS}"></span>
            </div>
        `;
        this.digitsElement = this.containerElement.querySelector(`.${CHANNEL_NUMBER_CLASSES.DIGITS}`);
        this.isVisibleFlag = false;
    }

    destroy(): void {
        this._clearHideTimer();
        if (this.containerElement) {
            this.containerElement.innerHTML = '';
            this.containerElement.classList.remove(CHANNEL_NUMBER_CLASSES.VISIBLE, CHANNEL_NUMBER_CLASSES.ERROR);
        }
        this.containerElement = null;
        this.digitsElement = null;
        this.isVisibleFlag = false;
    }

    showDigits(digits: string, maxDigits: number): void {
        if (!this.containerElement || !this.digitsElement) return;
        this._clearHideTimer();
        const max = sanitizeMaxDigits(maxDigits);
        const normalized = digits.replace(/\D/g, '').slice(0, max);
        const missingCount = Math.max(0, max - normalized.length);
        const placeholders = missingCount > 0 ? '_'.repeat(missingCount) : '';
        const value = placeholders && normalized ? `${normalized} ${placeholders}` : normalized || placeholders;

        this.digitsElement.textContent = value;
        this.containerElement.classList.remove(CHANNEL_NUMBER_CLASSES.ERROR);
        this.containerElement.classList.add(CHANNEL_NUMBER_CLASSES.VISIBLE);
        this.isVisibleFlag = true;
    }

    showError(channelNumber: number): void {
        if (!this.containerElement || !this.digitsElement) return;
        this._clearHideTimer();
        this.digitsElement.textContent = `${Math.floor(channelNumber)} NOT FOUND`;
        this.containerElement.classList.add(CHANNEL_NUMBER_CLASSES.VISIBLE, CHANNEL_NUMBER_CLASSES.ERROR);
        this.isVisibleFlag = true;
        this.scheduleHide(ERROR_AUTO_HIDE_MS);
    }

    scheduleHide(delayMs: number): void {
        if (!this.containerElement) return;
        this._clearHideTimer();
        this.hideTimer = globalThis.setTimeout(() => {
            this.hideTimer = null;
            this.hide();
        }, Math.max(0, Math.floor(delayMs))) as unknown as number;
    }

    hide(): void {
        if (!this.containerElement) return;
        this.containerElement.classList.remove(CHANNEL_NUMBER_CLASSES.VISIBLE, CHANNEL_NUMBER_CLASSES.ERROR);
        this.isVisibleFlag = false;
    }

    isVisible(): boolean {
        return this.isVisibleFlag;
    }

    private _clearHideTimer(): void {
        if (this.hideTimer !== null) {
            globalThis.clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }
    }
}

function sanitizeMaxDigits(maxDigits: number): number {
    if (!Number.isFinite(maxDigits) || maxDigits <= 0) {
        return DEFAULT_MAX_DIGITS;
    }
    return Math.floor(maxDigits);
}
