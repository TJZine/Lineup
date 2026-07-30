import { AppErrorCode } from '../../../types/app-errors';
import { LifecycleErrorMessageCatalog } from '../LifecycleErrorMessageCatalog';

describe('LifecycleErrorMessageCatalog', () => {
    const catalog = new LifecycleErrorMessageCatalog();

    it.each([
        [AppErrorCode.AUTH_EXPIRED, 'Please sign in again'],
        [AppErrorCode.AUTH_REQUIRED, 'Please sign in again'],
        [AppErrorCode.AUTH_RATE_LIMITED, 'Too many sign-in attempts. Please wait a moment'],
        [AppErrorCode.PLEX_PROFILE_AUTH_INVALID, 'This Plex Home profile needs to be selected again'],
        [AppErrorCode.PLEX_PROFILE_SERVER_ACCESS_DENIED, 'This Plex profile cannot access the selected server'],
        [AppErrorCode.PLEX_CLOUD_UNAVAILABLE, 'Plex cloud is temporarily unavailable'],
        [AppErrorCode.NETWORK_UNAVAILABLE, 'No internet connection'],
        [AppErrorCode.NETWORK_OFFLINE, 'No internet connection'],
        [AppErrorCode.PLEX_UNREACHABLE, 'Cannot connect to Plex server'],
        [AppErrorCode.SERVER_UNREACHABLE, 'Cannot connect to Plex server'],
        [AppErrorCode.SERVER_ERROR, 'Cannot connect to Plex server'],
        [AppErrorCode.DATA_CORRUPTION, 'Settings were reset'],
        [AppErrorCode.STORAGE_CORRUPTED, 'Settings were reset'],
        [AppErrorCode.STORAGE_QUOTA_EXCEEDED, 'Storage full - some settings may not be saved'],
        [AppErrorCode.PLAYBACK_FAILED, 'Unable to play content'],
        [AppErrorCode.CONTENT_UNAVAILABLE, 'That content is unavailable right now'],
        [AppErrorCode.PAGINATION_LIMIT_EXCEEDED, 'Unable to load all items from that library'],
        [AppErrorCode.ACCESS_DENIED, 'This profile does not have access to that library'],
        [AppErrorCode.OUT_OF_MEMORY, 'App needs to restart'],
        [AppErrorCode.MODULE_INIT_FAILED, 'App failed to start. Please try again'],
        [AppErrorCode.UNRECOVERABLE, 'A critical error occurred. Please restart the app'],
    ])('maps %s to owned user copy', (code, expected) => {
        expect(catalog.getUserMessage(code)).toBe(expected);
    });

    it.each([
        AppErrorCode.NETWORK_TIMEOUT,
        AppErrorCode.AUTH_INVALID,
        AppErrorCode.PLAYBACK_DECODE_ERROR,
        AppErrorCode.UNKNOWN,
    ])('uses generic copy for unmapped %s', (code) => {
        expect(catalog.getUserMessage(code)).toBe('An error occurred. Please try again.');
    });
});
