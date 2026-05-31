import { KEEP_ALIVE_INTERVAL_MS } from './constants';

export class KeepAliveManager {
    private _intervalId: ReturnType<typeof setInterval> | null = null;
    private _isPlayingFn: () => boolean = (): boolean => false;

    public setIsPlayingCheck(fn: () => boolean): void {
        this._isPlayingFn = fn;
    }

    public start(): void {
        this.stop();

        this._intervalId = setInterval(() => {
            if (this._isPlayingFn()) {
                // Touch DOM to prevent webOS suspension
                // Use custom event to avoid triggering NavigationManager click handlers
                // which expect event.target to be an HTMLElement with .closest()
                document.dispatchEvent(new CustomEvent('lineup:keepalive'));
            }
        }, KEEP_ALIVE_INTERVAL_MS);
    }

    public stop(): void {
        if (this._intervalId) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }
    }
}
