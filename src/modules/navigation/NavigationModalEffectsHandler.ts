import { NOW_PLAYING_INFO_MODAL_ID } from '../ui/now-playing-info';
import type { NavigationCoordinatorDeps } from './NavigationCoordinator';
import type { NavigationRepeatHandler } from './NavigationRepeatHandler';

export class NavigationModalEffectsHandler {
    constructor(
        private readonly deps: NavigationCoordinatorDeps,
        private readonly repeats: NavigationRepeatHandler
    ) { }

    handleModalOpen(modalId: string): void {
        this.repeats.stopEpgRepeat('modalOpen');
        this.repeats.stopMiniGuideRepeat('modalOpen');
        this.deps.miniGuide.coordinator?.hide();
        if (modalId === NOW_PLAYING_INFO_MODAL_ID) {
            this.deps.nowPlayingInfo.showOverlay();
        }
        if (modalId === this.deps.modals.playbackOptions.modalId) {
            this.deps.modals.playbackOptions.show();
        }
        if (modalId === this.deps.modals.exitConfirm.modalId) {
            this.deps.modals.exitConfirm.show();
        }
    }

    handleModalClose(modalId: string): void {
        if (modalId === NOW_PLAYING_INFO_MODAL_ID) {
            this.deps.nowPlayingInfo.hideOverlay();
        }
        if (modalId === this.deps.modals.playbackOptions.modalId) {
            this.deps.modals.playbackOptions.hide();
        }
        if (modalId === this.deps.modals.exitConfirm.modalId) {
            this.deps.modals.exitConfirm.hide();
        }
    }
}
