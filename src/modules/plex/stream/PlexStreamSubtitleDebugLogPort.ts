import { SubtitleDebugLogger } from '../../debug/SubtitleDebugLogger';
import { logPlexWarning } from '../shared/plexLogging';
import type {
    PlexStreamSubtitleDebugLogContext,
    PlexStreamSubtitleDebugLogPort,
    PlexStreamSubtitleDebugPolicyReader,
} from './interfaces';

export function createPlexStreamSubtitleDebugLogPort(
    subtitleDebugPolicyReader: PlexStreamSubtitleDebugPolicyReader
): PlexStreamSubtitleDebugLogPort {
    return new SubtitleDebugLogger({
        scope: 'PlexStreamResolver',
        sink: (scope, event, payload): void => {
            logPlexWarning('subtitle_debug', scope, event, payload);
        },
        settingsReader: subtitleDebugPolicyReader,
    });
}

export type { PlexStreamSubtitleDebugLogContext, PlexStreamSubtitleDebugLogPort };
