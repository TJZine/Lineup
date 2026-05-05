

/** localStorage key for channel configurations */
export const STORAGE_KEY = 'lineup_channels_v4';


/** localStorage key for current channel ID */
export const CURRENT_CHANNEL_KEY = 'lineup_current_channel_v4';



/** Content cache TTL in milliseconds (1 hour per spec) */
export const CACHE_TTL_MS = 60 * 60 * 1000;


/** Default maximum channels used by setup wizard */
export const DEFAULT_CHANNEL_SETUP_MAX = 200;

/** Maximum number of channels allowed */
export const MAX_CHANNELS = 500;

/** Minimum channel number */
export const MIN_CHANNEL_NUMBER = 1;

/** Maximum channel number */
export const MAX_CHANNEL_NUMBER = 500;


export const CHANNEL_ERROR_MESSAGES = {
    CHANNEL_NOT_FOUND: 'Channel not found',
    CONTENT_SOURCE_REQUIRED: 'Content source is required',
    CONTENT_SOURCE_INVALID: 'Content source is invalid',
    MAX_CHANNELS_REACHED: 'Maximum number of channels reached',
    INVALID_CHANNEL_NUMBER: 'Channel number must be an integer between 1 and 500',
    DUPLICATE_CHANNEL_NUMBER: 'Channel number already in use',
    INVALID_IMPORT_DATA: 'Import file is invalid',
    EMPTY_CONTENT: 'No playable content found after filtering',
} as const;
