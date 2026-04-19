/**
 * @fileoverview Maps error codes to user-facing recovery actions.
 * @module core/error-recovery/RecoveryActions
 * @version 1.0.0
 */

import { AppErrorCode } from '../../modules/lifecycle';
import { getAppErrorCode } from '../../types/app-errors';
import type { ErrorRecoveryAction, RecoveryActionDeps } from './types';

type RecoveryActionGroupId =
    | 'auth'
    | 'network'
    | 'server'
    | 'playback'
    | 'content'
    | 'storage'
    | 'startup'
    | 'dismiss'
    | 'unrecoverable';

type RecoveryActionFactory = (deps: RecoveryActionDeps) => ErrorRecoveryAction[];

function buildAction(
    label: string,
    action: () => void,
    options: { isPrimary: boolean; requiresNetwork: boolean }
): ErrorRecoveryAction {
    return {
        label,
        action,
        isPrimary: options.isPrimary,
        requiresNetwork: options.requiresNetwork,
    };
}

const RECOVERY_ACTION_FACTORIES: Record<RecoveryActionGroupId, RecoveryActionFactory> = {
    auth: (deps) => [
        buildAction('Sign In', () => {
            deps.goToAuth();
        }, { isPrimary: true, requiresNetwork: true }),
    ],
    network: (deps) => [
        buildAction('Retry', () => {
            deps.retryStart();
        }, { isPrimary: true, requiresNetwork: true }),
        buildAction('Exit', () => {
            deps.exitApp();
        }, { isPrimary: false, requiresNetwork: false }),
    ],
    server: (deps) => [
        buildAction('Select Server', () => {
            deps.goToServerSelect();
        }, { isPrimary: true, requiresNetwork: true }),
        buildAction('Retry', () => {
            deps.retryStart();
        }, { isPrimary: false, requiresNetwork: true }),
    ],
    playback: (deps) => [
        buildAction('Skip', () => {
            deps.skipToNext();
        }, { isPrimary: true, requiresNetwork: false }),
    ],
    content: (deps) => [
        buildAction('Edit Channels', () => {
            deps.goToChannelEdit();
        }, { isPrimary: true, requiresNetwork: false }),
    ],
    storage: (deps) => [
        buildAction('Open Settings', () => {
            deps.goToSettings();
        }, { isPrimary: true, requiresNetwork: false }),
        buildAction('Retry', () => {
            deps.retryStart();
        }, { isPrimary: false, requiresNetwork: false }),
    ],
    startup: (deps) => [
        buildAction('Retry', () => {
            deps.retryStart();
        }, { isPrimary: true, requiresNetwork: true }),
        buildAction('Exit', () => {
            deps.exitApp();
        }, { isPrimary: false, requiresNetwork: false }),
    ],
    dismiss: () => [
        buildAction('Dismiss', () => {
            // Intentionally no-op. The surrounding error UI owns dismissal.
        }, { isPrimary: true, requiresNetwork: false }),
    ],
    unrecoverable: (deps) => [
        buildAction('Exit', () => {
            deps.exitApp();
        }, { isPrimary: true, requiresNetwork: false }),
    ],
};

const RECOVERY_GROUP_BY_ERROR_CODE: Record<AppErrorCode, RecoveryActionGroupId> = {
    [AppErrorCode.AUTH_REQUIRED]: 'auth',
    [AppErrorCode.AUTH_EXPIRED]: 'auth',
    [AppErrorCode.AUTH_INVALID]: 'auth',
    [AppErrorCode.AUTH_FAILED]: 'auth',
    [AppErrorCode.SERVER_UNAUTHORIZED]: 'auth',
    [AppErrorCode.AUTH_RATE_LIMITED]: 'network',
    [AppErrorCode.NETWORK_TIMEOUT]: 'network',
    [AppErrorCode.NETWORK_OFFLINE]: 'network',
    [AppErrorCode.NETWORK_UNAVAILABLE]: 'network',
    [AppErrorCode.RATE_LIMITED]: 'network',
    [AppErrorCode.SERVER_UNREACHABLE]: 'server',
    [AppErrorCode.SERVER_SSL_ERROR]: 'server',
    [AppErrorCode.MIXED_CONTENT_BLOCKED]: 'server',
    [AppErrorCode.SERVER_ERROR]: 'server',
    [AppErrorCode.PLEX_UNREACHABLE]: 'server',
    [AppErrorCode.LIBRARY_UNAVAILABLE]: 'server',
    [AppErrorCode.PLAYBACK_FAILED]: 'playback',
    [AppErrorCode.PLAYBACK_DECODE_ERROR]: 'playback',
    [AppErrorCode.PLAYBACK_FORMAT_UNSUPPORTED]: 'playback',
    [AppErrorCode.PLAYBACK_DRM_ERROR]: 'playback',
    [AppErrorCode.PLAYBACK_SOURCE_NOT_FOUND]: 'playback',
    [AppErrorCode.TRANSCODE_FAILED]: 'playback',
    [AppErrorCode.CODEC_UNSUPPORTED]: 'playback',
    [AppErrorCode.TRACK_NOT_FOUND]: 'playback',
    [AppErrorCode.TRACK_SWITCH_FAILED]: 'playback',
    [AppErrorCode.TRACK_SWITCH_TIMEOUT]: 'playback',
    [AppErrorCode.RENDER_ERROR]: 'playback',
    [AppErrorCode.CHANNEL_NOT_FOUND]: 'content',
    [AppErrorCode.SCHEDULER_EMPTY_CHANNEL]: 'content',
    [AppErrorCode.EMPTY_CHANNEL]: 'content',
    [AppErrorCode.ITEM_NOT_FOUND]: 'content',
    [AppErrorCode.CONTENT_UNAVAILABLE]: 'content',
    [AppErrorCode.ACCESS_DENIED]: 'content',
    [AppErrorCode.PAGINATION_LIMIT_EXCEEDED]: 'content',
    [AppErrorCode.RESOURCE_NOT_FOUND]: 'content',
    [AppErrorCode.STORAGE_QUOTA_EXCEEDED]: 'storage',
    [AppErrorCode.STORAGE_CORRUPTED]: 'storage',
    [AppErrorCode.DATA_CORRUPTION]: 'storage',
    [AppErrorCode.INITIALIZATION_FAILED]: 'startup',
    [AppErrorCode.MODULE_INIT_FAILED]: 'startup',
    [AppErrorCode.MODULE_CRASH]: 'startup',
    [AppErrorCode.OUT_OF_MEMORY]: 'startup',
    [AppErrorCode.UNRECOVERABLE]: 'unrecoverable',
    [AppErrorCode.SCHEDULER_INVALID_TIME]: 'dismiss',
    [AppErrorCode.UI_RENDER_ERROR]: 'dismiss',
    [AppErrorCode.UI_NAVIGATION_BLOCKED]: 'dismiss',
    [AppErrorCode.PARSE_ERROR]: 'dismiss',
    [AppErrorCode.EMPTY_RESPONSE]: 'dismiss',
    [AppErrorCode.NAV_BOUNDARY]: 'dismiss',
    [AppErrorCode.SCROLL_TIMEOUT]: 'dismiss',
    [AppErrorCode.POOL_EXHAUSTED]: 'dismiss',
    [AppErrorCode.UNKNOWN]: 'dismiss',
};

export function getRecoveryActions(
    errorCode: AppErrorCode | string,
    deps: RecoveryActionDeps
): ErrorRecoveryAction[] {
    const normalizedCode = getAppErrorCode(errorCode);
    const recoveryGroup = normalizedCode
        ? RECOVERY_GROUP_BY_ERROR_CODE[normalizedCode]
        : 'dismiss';
    const buildRecoveryActions = RECOVERY_ACTION_FACTORIES[recoveryGroup] ?? RECOVERY_ACTION_FACTORIES.dismiss;

    return buildRecoveryActions(deps);
}
