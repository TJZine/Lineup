import { summarizeErrorForLog } from '../../utils/errors';

export function logPlaybackRecoveryWarning(
    event: string,
    context: Record<string, unknown>
): void {
    console.warn('playback_recovery', {
        event,
        ...context,
    });
}

export function logPlaybackRecoveryError(
    event: string,
    context: Record<string, unknown>,
    error: unknown
): void {
    console.error('playback_recovery', {
        event,
        ...context,
        safeError: summarizeErrorForLog(error),
    });
}

export function logVideoPlayerPlayFailure(error: unknown): void {
    console.error('video_player_play_failed', summarizeErrorForLog(error));
}

export function logVideoPlayerMediaSessionActionFailure(
    action: string,
    error: unknown
): void {
    console.warn('video_player_media_session_action_failed', {
        action,
        error: summarizeErrorForLog(error),
    });
}
