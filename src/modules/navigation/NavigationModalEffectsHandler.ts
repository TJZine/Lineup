import type { NavigationModalEffectsPort } from './NavigationCoordinatorDeps';
import type { NavigationRepeatHandler } from './NavigationRepeatHandler';

export class NavigationModalEffectsHandler {
    constructor(
        private readonly deps: NavigationModalEffectsPort,
        private readonly repeats: NavigationRepeatHandler
    ) { }

    handleModalOpen(modalId: string): void {
        this.repeats.stopEpgRepeat('modalOpen');
        this.repeats.stopMiniGuideRepeat('modalOpen');
        this.deps.miniGuide.coordinator?.hide();
        if (modalId === this.deps.nowPlayingInfo.modalId) {
            this.deps.nowPlayingInfo.showOverlay();
        } else if (modalId === this.deps.modals.playbackOptions.modalId) {
            this.deps.modals.playbackOptions.show();
        } else if (modalId === this.deps.modals.exitConfirm.modalId) {
            this.deps.modals.exitConfirm.show();
        }
    }

    handleModalClose(modalId: string): void {
        if (modalId === this.deps.nowPlayingInfo.modalId) {
            this.deps.nowPlayingInfo.hideOverlay();
        } else if (modalId === this.deps.modals.playbackOptions.modalId) {
            this.deps.modals.playbackOptions.hide();
        } else if (modalId === this.deps.modals.exitConfirm.modalId) {
            this.deps.modals.exitConfirm.hide();
        }
    }
}
