import type {
    ChannelConfig,
    IChannelManager,
    ResolvedChannelContent,
} from '../../../modules/scheduler/channel-manager';
import type { IChannelScheduler, ScheduleConfig } from '../../../modules/scheduler/scheduler';
import type { IVideoPlayer, StreamDescriptor } from '../../../modules/player';
import type { PlaybackRecoveryManager } from '../../../modules/player';
import type { StreamDecision } from '../../../modules/plex/stream';
import type { EPGCoordinator } from '../../../modules/ui/epg';
import type { AppendIssueDiagnostic } from '../../../modules/debug/IssueDiagnosticsStore';
import type { SubtitleMode } from '../../../shared/subtitle-mode';
import { ScheduleDayRolloverController } from '../controllers/ScheduleDayRolloverController';
import { SubtitleTrackRecoveryController } from '../controllers/SubtitleTrackRecoveryController';

export interface OrchestratorRuntimeControllerBuilderInput {
    scheduleDayRollover: {
        now: () => number;
        getChannelManager: () => IChannelManager | null;
        getScheduler: () => IChannelScheduler | null;
        getEpgCoordinator: () => EPGCoordinator | null;
        getLocalMidnightMs: (timeMs: number) => number;
        getLocalDayKey: (timeMs: number) => number;
        buildDailyScheduleConfig: (
            channel: ChannelConfig,
            items: ResolvedChannelContent['items'],
            referenceTimeMs: number
        ) => ScheduleConfig;
        reportError: (message: string, error: unknown) => void;
    };
    subtitleTrackRecovery: {
        getVideoPlayer: () => IVideoPlayer | null;
        getPlaybackRecovery: () => PlaybackRecoveryManager | null;
        readSubtitleMode: () => SubtitleMode;
        setSubtitleTrack: (trackId: string | null) => Promise<void>;
        nowPlayingWarn: (message: string) => void;
        getCurrentStreamDecision: () => StreamDecision | null;
        getCurrentStreamDescriptor: () => StreamDescriptor | null;
        appendIssueDiagnostic: AppendIssueDiagnostic;
        issueId: string;
    };
}

export interface OrchestratorRuntimeControllers {
    scheduleDayRolloverController: ScheduleDayRolloverController;
    subtitleTrackRecoveryController: SubtitleTrackRecoveryController;
}

export function createOrchestratorRuntimeControllers(
    input: OrchestratorRuntimeControllerBuilderInput
): OrchestratorRuntimeControllers {
    return {
        scheduleDayRolloverController: new ScheduleDayRolloverController(input.scheduleDayRollover),
        subtitleTrackRecoveryController: new SubtitleTrackRecoveryController({
            getVideoPlayer: input.subtitleTrackRecovery.getVideoPlayer,
            getPlaybackRecovery: input.subtitleTrackRecovery.getPlaybackRecovery,
            readSubtitleMode: input.subtitleTrackRecovery.readSubtitleMode,
            setSubtitleTrack: input.subtitleTrackRecovery.setSubtitleTrack,
            nowPlayingWarn: input.subtitleTrackRecovery.nowPlayingWarn,
            getCurrentStreamDecision: input.subtitleTrackRecovery.getCurrentStreamDecision,
            getCurrentStreamDescriptor: input.subtitleTrackRecovery.getCurrentStreamDescriptor,
            appendIssueDiagnostic: ({ key, data }): void => {
                input.subtitleTrackRecovery.appendIssueDiagnostic(
                    input.subtitleTrackRecovery.issueId,
                    key,
                    data
                );
            },
        }),
    };
}
