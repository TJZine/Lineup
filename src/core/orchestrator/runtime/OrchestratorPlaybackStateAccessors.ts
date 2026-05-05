import type { StreamDescriptor } from '../../../modules/player';
import type { StreamDecision } from '../../../modules/plex/stream';
import type { ScheduledProgram } from '../../../modules/scheduler/scheduler';

export interface OrchestratorPlaybackStateAccessors {
    getCurrentProgramForPlayback: () => ScheduledProgram | null;
    setCurrentProgramForPlayback: (program: ScheduledProgram | null) => void;
    getCurrentStreamDescriptor: () => StreamDescriptor | null;
    setCurrentStreamDescriptor: (stream: StreamDescriptor | null) => void;
    getCurrentStreamDecision: () => StreamDecision | null;
    setCurrentStreamDecision: (decision: StreamDecision | null) => void;
    getPendingNowPlayingChannelId: () => string | null;
    setPendingNowPlayingChannelId: (channelId: string | null) => void;
    getShouldAutoShowInfoBannerOnNextPlay: () => boolean;
    setShouldAutoShowInfoBannerOnNextPlay: (value: boolean) => void;
}
