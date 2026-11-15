export interface OverlayRuntimePolicyControllerDeps {
    hasChannelBadgeOverlay(): boolean;
    getPlayerOsdVisible(): boolean;
    getEpgVisible(): boolean;
    isChannelTransitionActive(): boolean;
    getCurrentChannel(): { number: number; name: string } | null;
    showChannelBadge(input: { channelNumber: number; channelName: string }): void;
    hideChannelBadge(): void;
}

export class OverlayRuntimePolicyController {
    constructor(private readonly _deps: OverlayRuntimePolicyControllerDeps) {}

    public syncChannelBadgeOverlay(): void {
        if (!this._deps.hasChannelBadgeOverlay()) {
            return;
        }

        const osdVisible = this._deps.getPlayerOsdVisible();
        const epgVisible = this._deps.getEpgVisible();
        const transitionActive = this._deps.isChannelTransitionActive();

        if (!osdVisible || epgVisible || transitionActive) {
            this._deps.hideChannelBadge();
            return;
        }

        const channel = this._deps.getCurrentChannel();
        if (!channel) {
            this._deps.hideChannelBadge();
            return;
        }

        this._deps.showChannelBadge({
            channelNumber: channel.number,
            channelName: channel.name,
        });
    }

    public handleOverlayVisibilityChange(_visible: boolean): void {
        this.syncChannelBadgeOverlay();
    }

}
