import type { StreamDecision } from '../../modules/plex/stream';
import type { StreamDescriptor } from '../../modules/player';
import type { ScheduledProgram } from '../../modules/scheduler/scheduler';

export interface ProfileSwitchCleanupControllerDeps {
    cancelPendingDayRollover(): void;
    stopPlayback(): void;
    unloadCurrentChannel(): void;
    setPendingNowPlayingChannelId(channelId: string | null): void;
    setShouldAutoShowInfoBannerOnNextPlay(value: boolean): void;
    setCurrentProgramForPlayback(program: ScheduledProgram | null): void;
    setCurrentStreamDescriptor(stream: StreamDescriptor | null): void;
    setCurrentStreamDecision(decision: StreamDecision | null): void;
}

export class ProfileSwitchCleanupController {
    constructor(private readonly _deps: ProfileSwitchCleanupControllerDeps) {}

    public prepareForProfileSwitchAttempt(): void {
        this._deps.cancelPendingDayRollover();
        this._deps.stopPlayback();
    }

    public finalizeProfileSwitch(): void {
        this._deps.unloadCurrentChannel();
        this._deps.setPendingNowPlayingChannelId(null);
        this._deps.setShouldAutoShowInfoBannerOnNextPlay(false);
        this._deps.setCurrentProgramForPlayback(null);
        this._deps.setCurrentStreamDescriptor(null);
        this._deps.setCurrentStreamDecision(null);
    }

    public prepareForProfileSwitch(): void {
        this.prepareForProfileSwitchAttempt();
        this.finalizeProfileSwitch();
    }
}
