export interface OverlayRuntimePolicyControllerDeps {
    hasChannelBadgeOverlay(): boolean;
    getPlayerOsdVisible(): boolean;
    getNowPlayingInfoVisible(): boolean;
    getEpgVisible(): boolean;
    isChannelTransitionActive(): boolean;
    getCurrentChannel(): { number: number; name: string } | null;
    showChannelBadge(input: { channelNumber: number; channelName: string }): void;
    hideChannelBadge(): void;
    hasNavigation(): boolean;
    hasNowPlayingInfoOverlay(): boolean;
    getCurrentScreen(): string | null;
    hasCurrentProgramForPlayback(): boolean;
    isModalOpen(modalId?: string): boolean;
    openModal(modalId: string): void;
    closeModal(modalId: string): void;
    nowPlayingModalId: string;
}

export class OverlayRuntimePolicyController {
    constructor(private readonly _deps: OverlayRuntimePolicyControllerDeps) {}

    public syncChannelBadgeOverlay(): void {
        if (!this._deps.hasChannelBadgeOverlay()) {
            return;
        }

        const osdVisible = this._deps.getPlayerOsdVisible();
        const nowPlayingVisible = this._deps.getNowPlayingInfoVisible();
        const epgVisible = this._deps.getEpgVisible();
        const transitionActive = this._deps.isChannelTransitionActive();

        if ((!osdVisible && !nowPlayingVisible) || epgVisible || transitionActive) {
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

    public toggleNowPlayingInfoOverlay(): void {
        if (!this._deps.hasNavigation() || !this._deps.hasNowPlayingInfoOverlay()) {
            return;
        }

        if (this._deps.getCurrentScreen() !== 'player') {
            return;
        }

        if (this._deps.getEpgVisible()) {
            return;
        }

        if (!this._deps.hasCurrentProgramForPlayback()) {
            return;
        }

        if (this._deps.isModalOpen(this._deps.nowPlayingModalId)) {
            this._deps.closeModal(this._deps.nowPlayingModalId);
            return;
        }

        if (this._deps.isModalOpen(undefined)) {
            return;
        }

        this._deps.openModal(this._deps.nowPlayingModalId);
    }
}
