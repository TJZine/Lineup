import type { ChannelConfig as SchedulerChannelConfig } from '../../../scheduler/channel-manager';
import type {
    ScheduleWindow as SchedulerScheduleWindow,
    ScheduledProgram as SchedulerScheduledProgram,
} from '../../../scheduler/scheduler';
import type { PlexMediaItem } from '../../../plex/library';
import type {
    EpgChannel,
    EpgItemDetails,
    EpgScheduleWindow,
    EpgScheduledProgram,
} from './domainTypes';

export function toEpgChannel(channel: SchedulerChannelConfig): EpgChannel {
    return {
        id: channel.id,
        number: channel.number,
        name: channel.name,
        ...(channel.icon !== undefined ? { icon: channel.icon } : {}),
        ...(channel.buildStrategy !== undefined ? { buildStrategy: channel.buildStrategy } : {}),
        ...(channel.sourceLibraryId !== undefined ? { sourceLibraryId: channel.sourceLibraryId } : {}),
        ...(channel.sourceLibraryName !== undefined ? { sourceLibraryName: channel.sourceLibraryName } : {}),
        ...(channel.lineupReplicaIndex !== undefined ? { lineupReplicaIndex: channel.lineupReplicaIndex } : {}),
        ...(channel.isPlaybackModeVariant !== undefined ? { isPlaybackModeVariant: channel.isPlaybackModeVariant } : {}),
        contentSource: { ...channel.contentSource },
        playbackMode: channel.playbackMode,
        ...(channel.shuffleSeed !== undefined ? { shuffleSeed: channel.shuffleSeed } : {}),
        ...(channel.blockSize !== undefined ? { blockSize: channel.blockSize } : {}),
        ...(channel.phaseSeed !== undefined ? { phaseSeed: channel.phaseSeed } : {}),
        startTimeAnchor: channel.startTimeAnchor,
        ...(channel.contentFilters !== undefined ? { contentFilters: channel.contentFilters.map((filter) => ({ ...filter })) } : {}),
        ...(channel.sortOrder !== undefined ? { sortOrder: channel.sortOrder } : {}),
        skipIntros: channel.skipIntros,
        skipCredits: channel.skipCredits,
        ...(channel.maxEpisodeRunTimeMs !== undefined ? { maxEpisodeRunTimeMs: channel.maxEpisodeRunTimeMs } : {}),
        ...(channel.minEpisodeRunTimeMs !== undefined ? { minEpisodeRunTimeMs: channel.minEpisodeRunTimeMs } : {}),
        createdAt: channel.createdAt,
        updatedAt: channel.updatedAt,
        lastContentRefresh: channel.lastContentRefresh,
        itemCount: channel.itemCount,
        totalDurationMs: channel.totalDurationMs,
    } satisfies EpgChannel;
}

export function toEpgChannels(channels: SchedulerChannelConfig[]): EpgChannel[] {
    return channels.map((channel) => toEpgChannel(channel));
}

export function toEpgScheduledProgram(program: SchedulerScheduledProgram): EpgScheduledProgram {
    return {
        ...program,
        item: { ...program.item },
    } satisfies EpgScheduledProgram;
}

export function toEpgScheduleWindow(window: SchedulerScheduleWindow): EpgScheduleWindow {
    return {
        startTime: window.startTime,
        endTime: window.endTime,
        programs: window.programs.map((program) => toEpgScheduledProgram(program)),
    };
}

export function toEpgItemDetails(item: PlexMediaItem | null): EpgItemDetails | null {
    if (!item) {
        return null;
    }

    return {
        ...item,
        media: item.media.map((media) => ({
            ...media,
            parts: media.parts?.map((part) => ({
                ...part,
                streams: part.streams?.map((stream) => ({ ...stream })),
            })),
        })),
    } satisfies EpgItemDetails;
}
