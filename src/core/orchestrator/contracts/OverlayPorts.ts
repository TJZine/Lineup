import type { ChannelBadgeOverlay } from '../../../modules/ui/channel-badge';
import type { ChannelNumberOverlay } from '../../../modules/ui/channel-number-overlay';

export type ChannelNumberOverlayInitPort = Pick<
    ChannelNumberOverlay,
    'initialize' | 'showDigits' | 'showError' | 'scheduleHide' | 'hide' | 'isVisible' | 'destroy'
>;

export type ChannelNumberOverlayRuntimePort = Pick<
    ChannelNumberOverlay,
    'showDigits' | 'showError' | 'scheduleHide' | 'hide' | 'isVisible'
>;

export type ChannelBadgeOverlayInitPort = Pick<
    ChannelBadgeOverlay,
    'initialize' | 'show' | 'hide' | 'isVisible' | 'destroy'
>;
