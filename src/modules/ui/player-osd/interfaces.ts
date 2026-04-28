import type { PlayerOsdConfig, PlayerOsdViewModel } from './types';

export interface IPlayerOsdOverlay {
    initialize(config: PlayerOsdConfig): void;
    destroy(): void;

    show(): void;
    hide(): void;
    isVisible(): boolean;

    setViewModel(vm: PlayerOsdViewModel): void;
}
