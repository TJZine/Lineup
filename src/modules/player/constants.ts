/* Prevent webOS from suspending the app during long playback. */
export const KEEP_ALIVE_INTERVAL_MS = 30000;

export const MAX_RETRY_ATTEMPTS = 3;

export const RETRY_BASE_DELAY_MS = 1000;

export const SYNTHETIC_MEDIA_ERROR_CODE_KEY = '__lineupSyntheticMediaErrorCode';

export const VIDEO_ELEMENT_ID = 'lineup-video-player';

export const VIDEO_ELEMENT_STYLES = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: #000;
    object-fit: contain;
`;

export const AUDIO_TRACK_SWITCH_TIMEOUT_MS = 5000;

export const DEFAULT_CONFIG = {
    defaultVolume: 1.0,
    bufferAheadMs: 30000,
    seekIncrementSec: 10,
    hideControlsAfterMs: 5000,
    retryAttempts: MAX_RETRY_ATTEMPTS,
    retryDelayMs: RETRY_BASE_DELAY_MS,
} as const;
