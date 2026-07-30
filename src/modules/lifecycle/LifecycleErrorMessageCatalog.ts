import { AppErrorCode } from '../../types/app-errors';
import { ERROR_MESSAGES } from './constants';

export class LifecycleErrorMessageCatalog {
    public getUserMessage(code: AppErrorCode): string {
        switch (code) {
            case AppErrorCode.AUTH_EXPIRED:
            case AppErrorCode.AUTH_REQUIRED:
                return ERROR_MESSAGES.AUTH_EXPIRED;
            case AppErrorCode.AUTH_RATE_LIMITED:
                return ERROR_MESSAGES.AUTH_RATE_LIMITED;
            case AppErrorCode.PLEX_PROFILE_AUTH_INVALID:
                return ERROR_MESSAGES.PLEX_PROFILE_AUTH_INVALID;
            case AppErrorCode.PLEX_PROFILE_SERVER_ACCESS_DENIED:
                return ERROR_MESSAGES.PLEX_PROFILE_SERVER_ACCESS_DENIED;
            case AppErrorCode.PLEX_CLOUD_UNAVAILABLE:
                return ERROR_MESSAGES.PLEX_CLOUD_UNAVAILABLE;
            case AppErrorCode.NETWORK_UNAVAILABLE:
            case AppErrorCode.NETWORK_OFFLINE:
                return ERROR_MESSAGES.NETWORK_UNAVAILABLE;
            case AppErrorCode.PLEX_UNREACHABLE:
            case AppErrorCode.SERVER_UNREACHABLE:
            case AppErrorCode.SERVER_ERROR:
                return ERROR_MESSAGES.PLEX_UNREACHABLE;
            case AppErrorCode.DATA_CORRUPTION:
            case AppErrorCode.STORAGE_CORRUPTED:
                return ERROR_MESSAGES.DATA_CORRUPTION;
            case AppErrorCode.STORAGE_QUOTA_EXCEEDED:
                return ERROR_MESSAGES.STORAGE_QUOTA_EXCEEDED;
            case AppErrorCode.PLAYBACK_FAILED:
                return ERROR_MESSAGES.PLAYBACK_FAILED;
            case AppErrorCode.CONTENT_UNAVAILABLE:
                return ERROR_MESSAGES.CONTENT_UNAVAILABLE;
            case AppErrorCode.PAGINATION_LIMIT_EXCEEDED:
                return ERROR_MESSAGES.PAGINATION_LIMIT_EXCEEDED;
            case AppErrorCode.ACCESS_DENIED:
                return ERROR_MESSAGES.ACCESS_DENIED;
            case AppErrorCode.OUT_OF_MEMORY:
                return ERROR_MESSAGES.OUT_OF_MEMORY;
            case AppErrorCode.MODULE_INIT_FAILED:
                return ERROR_MESSAGES.MODULE_INIT_FAILED;
            case AppErrorCode.UNRECOVERABLE:
                return ERROR_MESSAGES.UNRECOVERABLE;
            default:
                return 'An error occurred. Please try again.';
        }
    }
}
