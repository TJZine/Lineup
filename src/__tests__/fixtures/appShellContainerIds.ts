import { CHANNEL_BADGE_CONTAINER_ID } from '../../modules/ui/channel-badge';
import { EXIT_CONFIRM_CONTAINER_ID } from '../../modules/ui/exit-confirm';

export const EXPECTED_CONTAINER_IDS = [
    'video-container',
    'player-osd-container',
    'channel-number-overlay-container',
    CHANNEL_BADGE_CONTAINER_ID,
    'mini-guide-container',
    'channel-transition-container',
    'epg-container',
    'now-playing-info-container',
    'playback-options-container',
    EXIT_CONFIRM_CONTAINER_ID,
    'splash-container',
    'auth-container',
    'profile-select-container',
    'server-select-container',
    'channel-setup-container',
    'audio-setup-container',
    'settings-container',
    'error-overlay',
    'dev-menu',
    'app-toast',
] as const;

