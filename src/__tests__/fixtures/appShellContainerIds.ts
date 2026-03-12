import { CHANNEL_BADGE_CONTAINER_ID } from '../../modules/ui/channel-badge';
import { EXIT_CONFIRM_CONTAINER_ID } from '../../modules/ui/exit-confirm';
import { EPG_CONTAINER_ID } from '../../modules/ui/epg';
import { PLAYER_OSD_CONTAINER_ID } from '../../modules/ui/player-osd';
import { CHANNEL_NUMBER_OVERLAY_CONTAINER_ID } from '../../modules/ui/channel-number-overlay';
import { MINI_GUIDE_CONTAINER_ID } from '../../modules/ui/mini-guide';
import { CHANNEL_TRANSITION_CONTAINER_ID } from '../../modules/ui/channel-transition';

export const EXPECTED_CONTAINER_IDS = [
    'video-container',
    PLAYER_OSD_CONTAINER_ID,
    CHANNEL_NUMBER_OVERLAY_CONTAINER_ID,
    CHANNEL_BADGE_CONTAINER_ID,
    MINI_GUIDE_CONTAINER_ID,
    CHANNEL_TRANSITION_CONTAINER_ID,
    EPG_CONTAINER_ID,
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
