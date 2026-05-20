import type { ChannelConfig as SchedulerChannelConfig } from '../../../scheduler/channel-manager';

export interface EpgItemDetailsStream {
    streamType?: number;
    title?: string | null;
    displayTitle?: string | null;
    extendedDisplayTitle?: string | null;
    hdr?: string | null;
    dynamicRange?: string | null;
    colorTrc?: string | null;
    doviPresent?: boolean | null;
    doviProfile?: string | null;
    [key: string]: unknown;
}

export interface EpgItemDetailsPart {
    streams?: EpgItemDetailsStream[];
    [key: string]: unknown;
}

export interface EpgItemDetailsMedia {
    parts?: EpgItemDetailsPart[];
    [key: string]: unknown;
}

export interface EpgItemDetails {
    ratingKey: string;
    type?: string;
    grandparentThumb?: string | null;
    media?: EpgItemDetailsMedia[];
    [key: string]: unknown;
}

export interface EpgProgramMediaInfo {
    resolution?: string | null;
    hdr?: string | null;
    videoResolution?: string | null;
    videoDynamicRange?: string | null;
    videoCodec?: string | null;
    audioCodec?: string | null;
    audioChannels?: number;
    audioTrackTitle?: string | null;
    [key: string]: unknown;
}

export interface EpgProgramItem {
    ratingKey: string;
    type: string;
    title: string;
    fullTitle: string;
    durationMs: number;
    thumb: string | null;
    showThumb?: string | null;
    showTitle?: string | null;
    art?: string | null;
    summary?: string | null;
    year: number;
    scheduledIndex: number;
    contentRating?: string | null;
    clearLogo?: string | null;
    genres?: string[];
    seasonNumber?: number;
    episodeNumber?: number;
    mediaInfo?: EpgProgramMediaInfo;
    [key: string]: unknown;
}

export interface EpgScheduledProgram {
    item: EpgProgramItem;
    scheduledStartTime: number;
    scheduledEndTime: number;
    elapsedMs: number;
    remainingMs: number;
    scheduleIndex: number;
    loopNumber: number;
    streamDescriptor: unknown | null;
    isCurrent: boolean;
}

export interface EpgScheduleWindow {
    startTime: number;
    endTime: number;
    programs: EpgScheduledProgram[];
}

export type EpgChannel = Pick<
    SchedulerChannelConfig,
    | 'id'
    | 'number'
    | 'name'
    | 'icon'
    | 'buildStrategy'
    | 'sourceLibraryId'
    | 'sourceLibraryName'
    | 'lineupReplicaIndex'
    | 'isPlaybackModeVariant'
    | 'contentSource'
    | 'playbackMode'
    | 'shuffleSeed'
    | 'blockSize'
    | 'phaseSeed'
    | 'startTimeAnchor'
    | 'contentFilters'
    | 'sortOrder'
    | 'skipIntros'
    | 'skipCredits'
    | 'maxEpisodeRunTimeMs'
    | 'minEpisodeRunTimeMs'
    | 'createdAt'
    | 'updatedAt'
    | 'lastContentRefresh'
    | 'itemCount'
    | 'totalDurationMs'
>;
