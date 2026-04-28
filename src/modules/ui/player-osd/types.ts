export interface PlayerOsdConfig {
    containerId: string;
}

export type PlayerOsdReason = 'play' | 'pause' | 'seek' | 'status';

interface PlayerOsdActionIds {
    subtitles: string;
    sleep: string;
    audio: string;
}

export interface PlayerOsdViewModel {
    reason: PlayerOsdReason;

    statusLabel: 'PLAYING' | 'PAUSED' | 'SEEKING' | 'BUFFERING' | 'LOADING' | 'STOPPED';

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
    infoOnly?: boolean;
    /** Tokenized URL for clearLogo (if available). */
    clearLogoUrl?: string | null;
}
