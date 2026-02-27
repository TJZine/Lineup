import type { ChannelBadgeConfig, ChannelBadgeViewModel } from './types';

export interface IChannelBadgeOverlay {
    initialize(config: ChannelBadgeConfig): void;
    destroy(): void;
    show(viewModel: ChannelBadgeViewModel): void;
    hide(): void;
    isVisible(): boolean;
}
