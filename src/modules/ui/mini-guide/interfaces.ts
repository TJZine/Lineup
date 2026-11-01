import type { MiniGuideConfig, MiniGuideViewModel } from './types';

export interface IMiniGuideOverlay {
    initialize(config: MiniGuideConfig): void;
    destroy(): void;

    show(): void;
    hide(): void;
    isVisible(): boolean;

    setViewModel(vm: MiniGuideViewModel): void;
    setFocusedIndex(index: number): void;
    setActions(actions: {
        select: (index: number) => void;
        fullGuide: () => void;
        close: () => void;
        tick?: () => void;
    }): void;
}
