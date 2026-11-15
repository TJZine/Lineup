import type {
    NavigationModalEffectsRuntime,
    NavigationRepeatRuntime,
} from '../contracts/NavigationHandlerContracts';
import type {
    NavigationMiniGuidePort,
} from '../contracts/NavigationFeaturePorts';

export interface NavigationModalEffectsPort {
    miniGuide: NavigationMiniGuidePort;
}

export class NavigationModalEffectsHandler implements NavigationModalEffectsRuntime {
    constructor(
        private readonly deps: NavigationModalEffectsPort,
        private readonly repeats: NavigationRepeatRuntime
    ) { }

    handleModalOpen(_modalId: string): void {
        this.repeats.stopEpgRepeat('modalOpen');
        this.repeats.stopMiniGuideRepeat('modalOpen');
        this.deps.miniGuide.requestMiniGuideIntent({ type: 'hide' });
    }

    handleModalClose(_modalId: string): void {
    }
}
