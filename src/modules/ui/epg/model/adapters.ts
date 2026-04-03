/**
 * @fileoverview Boundary adapters between scheduler/Plex models and EPG-owned UI domain types.
 * @module modules/ui/epg/adapters
 */

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
        ...channel,
        contentSource: { ...channel.contentSource },
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
