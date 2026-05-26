import type { SubtitleTrack } from '../../player/types';
import { BURN_IN_SUBTITLE_FORMATS } from '../../../shared/subtitle-formats';
import {
    subtitleModeAllowsBurnIn,
    subtitleModeIsDirectOnly,
    type SubtitleMode,
} from '../../../shared/subtitle-mode';

export type PlaybackSubtitleOptionKind =
    | 'direct'
    | 'extract'
    | 'burn_in'
    | 'disabled'
    | 'hidden';

export function classifyPlaybackSubtitleOption(args: {
    track: SubtitleTrack;
    subtitleMode: SubtitleMode;
    canRequestBurnIn: boolean;
}): PlaybackSubtitleOptionKind {
    const { track, subtitleMode, canRequestBurnIn } = args;
    const directOnly = subtitleModeIsDirectOnly(subtitleMode);
    const allowBurnIn = subtitleModeAllowsBurnIn(subtitleMode);
    const burnInRequired = isBurnInSubtitleTrack(track);

    if (burnInRequired) {
        if (!allowBurnIn || directOnly) return 'hidden';
        return canRequestBurnIn ? 'burn_in' : 'disabled';
    }

    if (!track.isTextCandidate || !(track.fetchableViaKey || track.id)) {
        return 'hidden';
    }

    if (track.fetchableViaKey) {
        return 'direct';
    }

    if (directOnly) {
        return 'hidden';
    }

    if (subtitleMode === 'full') {
        return canRequestBurnIn ? 'burn_in' : 'disabled';
    }

    return 'extract';
}

export function isBurnInSubtitleTrack(track: SubtitleTrack): boolean {
    const format = (track.format || track.codec || '').toLowerCase();
    return BURN_IN_SUBTITLE_FORMATS.includes(format);
}
