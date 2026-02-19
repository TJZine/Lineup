export interface IChannelNumberOverlay {
    initialize(containerId: string): void;
    destroy(): void;
    showDigits(digits: string, maxDigits: number): void;
    showError(channelNumber: number): void;
    scheduleHide(delayMs: number): void;
    hide(): void;
    isVisible(): boolean;
}
