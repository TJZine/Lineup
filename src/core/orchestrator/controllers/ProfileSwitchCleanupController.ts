import type {
    PriorityOnePlaybackRuntimePort,
    PriorityOneSchedulerRuntimePort,
} from '../runtime/OrchestratorRuntimeSeams';

export interface ProfileSwitchCleanupControllerDeps {
    schedulerRuntime: Pick<PriorityOneSchedulerRuntimePort, 'cancelPendingDayRollover'>;
    playback: Pick<PriorityOnePlaybackRuntimePort, 'playbackState' | 'stopPlayback' | 'unloadCurrentChannel'>;
}

export class ProfileSwitchCleanupController {
    constructor(private readonly _deps: ProfileSwitchCleanupControllerDeps) {}

    public prepareForProfileSwitchAttempt(): void {
        this._deps.schedulerRuntime.cancelPendingDayRollover();
        this._deps.playback.stopPlayback();
    }

    public finalizeProfileSwitch(): void {
        this._deps.playback.unloadCurrentChannel();
        this._deps.playback.playbackState.setPendingNowPlayingChannelId(null);
        this._deps.playback.playbackState.setShouldAutoShowInfoBannerOnNextPlay(false);
        this._deps.playback.playbackState.setCurrentProgramForPlayback(null);
        this._deps.playback.playbackState.setCurrentStreamDescriptor(null);
        this._deps.playback.playbackState.setCurrentStreamDecision(null);
    }

    public prepareForProfileSwitch(): void {
        this.prepareForProfileSwitchAttempt();
        this.finalizeProfileSwitch();
    }
}
