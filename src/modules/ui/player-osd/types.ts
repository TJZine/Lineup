import type { PlaybackOptionsSection } from '../playback-options/types';

export interface PlayerOsdConfig {
    containerId: string;
}

export type PlayerOsdReason = 'play' | 'pause' | 'seek' | 'status';

export type PlayerPresentationState =
    | 'hidden'
    | 'compact'
    | 'expanded'
    | 'more-info'
    | 'audio'
    | 'subtitles'
    | 'sleep';

export interface PlayerSleepChoice {
    minutes: 0 | 15 | 30 | 60 | 90 | 120;
    label: string;
    selected: boolean;
}

interface PlayerOsdActionIds {
    subtitles: string;
    sleep: string;
    audio: string;
    expand?: string;
    guide?: string;
    transport?: string;
    retry?: string;
    moreInfo?: string;
}

export interface PlayerOsdViewModel {
    presentation?: PlayerPresentationState;
    parentPresentation?: 'compact' | 'expanded';
    reason: PlayerOsdReason;

    statusLabel: 'PLAYING' | 'PAUSED' | 'SEEKING' | 'BUFFERING' | 'LOADING' | 'STOPPED' | 'ERROR';

    channelPrefix: string;
    title: string;
    subtitle: string | null;

    isLive: boolean;

    currentTimeMs: number;
    durationMs: number;

    playedRatio: number;
    bufferedRatio: number;

    timecode: string;
    endsAtText: string | null;
    bufferText: string | null;
    upNextText?: string | null;
    actionIds?: PlayerOsdActionIds;
    audioLabel?: string | null;
    subtitleLabel?: string | null;
    /** Sleep timer text, e.g. "Sleep 45:00" */
    sleepTimerText?: string | null;
    /** When true, OSD renders as an info banner (no focusable actions). */
    /** Tokenized URL for clearLogo (if available). */
    clearLogoUrl?: string | null;
    description?: string | null;
    posterUrl?: string | null;
    facts?: string[];
    castText?: string | null;
    qualityBadges?: string[];
    playbackSummary?: string | null;
    playbackDetails?: string[];
    detailStatus?: 'loading' | 'ready' | 'unavailable' | 'error';
    sleepChoices?: PlayerSleepChoice[];
    sleepRemainingText?: string | null;
    trackDrawer?: PlaybackOptionsSection;
    retryPending?: boolean;
    errorText?: string | null;
}
