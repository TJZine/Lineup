import type { StreamDecision } from '../../modules/plex/stream';
import type { StreamDescriptor } from '../../modules/player';
import type { ScheduledProgram } from '../../modules/scheduler/scheduler';

export interface ProfileSwitchCleanupControllerDeps {
    getPendingDayRolloverTimer(): ReturnType<typeof setTimeout> | null;
    clearPendingDayRolloverTimer(timer: ReturnType<typeof setTimeout>): void;
    setPendingDayRolloverTimer(timer: ReturnType<typeof setTimeout> | null): void;
    setPendingDayRolloverDayKey(dayKey: number | null): void;
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

    public prepareForProfileSwitch(): void {
        const pendingTimer = this._deps.getPendingDayRolloverTimer();
        if (pendingTimer !== null) {
            this._deps.clearPendingDayRolloverTimer(pendingTimer);
            this._deps.setPendingDayRolloverTimer(null);
        }

        this._deps.setPendingDayRolloverDayKey(null);
        this._deps.stopPlayback();
        this._deps.unloadCurrentChannel();
        this._deps.setPendingNowPlayingChannelId(null);
        this._deps.setShouldAutoShowInfoBannerOnNextPlay(false);
        this._deps.setCurrentProgramForPlayback(null);
        this._deps.setCurrentStreamDescriptor(null);
        this._deps.setCurrentStreamDecision(null);
    }
}
