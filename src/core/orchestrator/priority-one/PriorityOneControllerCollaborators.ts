import type { AppError } from '../../../modules/lifecycle';
import type {
    IVideoPlayer,
    PlaybackError,
    StreamDescriptor,
} from '../../../modules/player';
import type { ScheduledProgram } from '../../../modules/scheduler/scheduler';
import {
    OrchestratorEventBinder,
    type OrchestratorEventBinderDeps,
} from '../OrchestratorEventBinder';
import {
    OverlayRuntimePolicyController,
    type OverlayRuntimePolicyControllerDeps,
} from '../OverlayRuntimePolicyController';
import {
    ProfileSwitchCleanupController,
    type ProfileSwitchCleanupControllerDeps,
} from '../ProfileSwitchCleanupController';
import {
    PlaybackRuntimeController,
    type PlaybackRuntimeControllerDeps,
} from './PlaybackRuntimeController';
import { PlaybackStartController, type PlaybackStartControllerDeps } from './PlaybackStartController';
import type { PriorityOneAssemblyInput } from './PriorityOneAssemblyInput';

function getCurrentChannelSnapshot(
    surfaces: PriorityOneAssemblyInput['surfaces']
): { number: number; name: string } | null {
    const channel = surfaces.channelManager?.getCurrentChannel() ?? null;
    return channel
        ? { number: channel.number, name: channel.name }
        : null;
}

function resolvePlaybackStartStream(
    playback: PriorityOneAssemblyInput['playback'],
    program: ScheduledProgram
): Promise<StreamDescriptor | null> {
    if (!playback.playbackRecovery.resolveStreamForProgram) {
        return Promise.resolve(null);
    }

    return playback.playbackRecovery.resolveStreamForProgram(program).then((stream) => stream ?? null);
}

function markProgramStarting(
    playbackState: PriorityOneAssemblyInput['playback']['playbackState'],
    program: ScheduledProgram
): {
    programAtStart: ScheduledProgram;
    shouldResetAutoShowInfoBannerOnAbort: boolean;
} {
    playbackState.setCurrentProgramForPlayback(program);
    const shouldResetAutoShowInfoBannerOnAbort =
        playbackState.getPendingNowPlayingChannelId() !== null;

    if (shouldResetAutoShowInfoBannerOnAbort) {
        playbackState.setShouldAutoShowInfoBannerOnNextPlay(true);
        playbackState.setPendingNowPlayingChannelId(null);
    }

    return {
        programAtStart: program,
        shouldResetAutoShowInfoBannerOnAbort,
    };
}

function getActiveTranscodeSessionId(
    playbackState: PriorityOneAssemblyInput['playback']['playbackState']
): string | null {
    const decision = playbackState.getCurrentStreamDecision();
    if (!decision || !decision.isTranscoding || !decision.sessionId) {
        return null;
    }

    return decision.sessionId;
}

class OverlayRuntimePolicyControllerDepsAdapter
    implements OverlayRuntimePolicyControllerDeps
{
    public readonly nowPlayingModalId: string;

    constructor(private readonly _input: PriorityOneAssemblyInput) {
        this.nowPlayingModalId = _input.nowPlayingModalId;
    }

    public hasChannelBadgeOverlay(): boolean {
        return this._input.surfaces.channelBadgeOverlay !== null;
    }

    public getPlayerOsdVisible(): boolean {
        return this._input.surfaces.playerOsd?.isVisible() ?? false;
    }

    public getNowPlayingInfoVisible(): boolean {
        return this._input.surfaces.nowPlayingInfo?.isVisible() ?? false;
    }

    public getEpgVisible(): boolean {
        return this._input.surfaces.epg?.isVisible() ?? false;
    }

    public getCurrentChannel(): { number: number; name: string } | null {
        return getCurrentChannelSnapshot(this._input.surfaces);
    }

    public showChannelBadge(badge: { channelNumber: number; channelName: string }): void {
        this._input.surfaces.channelBadgeOverlay?.show(badge);
    }

    public hideChannelBadge(): void {
        this._input.surfaces.channelBadgeOverlay?.hide();
    }

    public hasNavigation(): boolean {
        return this._input.surfaces.navigation !== null;
    }

    public hasNowPlayingInfoOverlay(): boolean {
        return this._input.surfaces.nowPlayingInfo !== null;
    }

    public getCurrentScreen(): string | null {
        return this._input.surfaces.navigation?.getCurrentScreen() ?? null;
    }

    public hasCurrentProgramForPlayback(): boolean {
        return this._input.playback.playbackState.getCurrentProgramForPlayback() !== null;
    }

    public isModalOpen(modalId?: string): boolean {
        return this._input.surfaces.navigation?.isModalOpen(modalId) ?? false;
    }

    public openModal(modalId: string): void {
        this._input.surfaces.navigation?.openModal(modalId);
    }

    public closeModal(modalId: string): void {
        this._input.surfaces.navigation?.closeModal(modalId);
    }
}

class PlaybackStartControllerDepsAdapter implements PlaybackStartControllerDeps {
    constructor(private readonly _input: PriorityOneAssemblyInput) {}

    public getVideoPlayer(): IVideoPlayer | null {
        return this._input.modules.videoPlayer;
    }

    public resolveStreamForProgram(
        program: ScheduledProgram
    ): Promise<StreamDescriptor | null> {
        return resolvePlaybackStartStream(this._input.playback, program);
    }

    public resetPlaybackFailureGuard(): void {
        this._input.playback.playbackRecovery.resetPlaybackFailureGuard?.();
    }

    public tryHandleStreamResolverAuthError(error: unknown): boolean {
        return this._input.playback.playbackRecovery.tryHandleStreamResolverAuthError?.(error) ?? false;
    }

    public tryHandleStreamResolverPermissionError(error: unknown): boolean {
        return (
            this._input.playback.playbackRecovery.tryHandleStreamResolverPermissionError?.(error) ??
            false
        );
    }

    public handlePlaybackFailure(context: string, error: unknown): void {
        this._input.playback.playbackRecovery.handlePlaybackFailure?.(context, error);
    }

    public logPlaybackStartFailure(error: unknown): void {
        this._input.uiRuntime.onPlaybackStartFailure(error);
    }

    public markProgramStarting(program: ScheduledProgram): {
        programAtStart: ScheduledProgram;
        shouldResetAutoShowInfoBannerOnAbort: boolean;
    } {
        return markProgramStarting(this._input.playback.playbackState, program);
    }

    public isProgramStillCurrent(program: ScheduledProgram): boolean {
        return this._input.playback.playbackState.getCurrentProgramForPlayback() === program;
    }

    public handleProgramStartUiSideEffects(program: ScheduledProgram): void {
        this._input.uiRuntime.onProgramStartUiSideEffects(program);
    }

    public handleStreamResolved(stream: StreamDescriptor): void {
        this._input.playback.playbackState.setCurrentStreamDescriptor(stream);
        this._input.uiRuntime.onStreamResolved(stream);
    }

    public clearAutoShowInfoBannerAfterAbortedStart(): void {
        this._input.playback.playbackState.setShouldAutoShowInfoBannerOnNextPlay(false);
    }
}

class PlaybackRuntimeControllerDepsAdapter implements PlaybackRuntimeControllerDeps {
    constructor(private readonly _input: PriorityOneAssemblyInput) {}

    public isStreamRecoveryInProgress(): boolean {
        return this._input.playback.playbackRecovery.isStreamRecoveryInProgress();
    }

    public getActiveTranscodeSessionId(): string | null {
        return getActiveTranscodeSessionId(this._input.playback.playbackState);
    }

    public stopTranscodeSession(sessionId: string): void {
        this._input.playback.stopTranscodeSessionById(sessionId);
    }

    public skipToNextProgram(): void {
        this._input.playback.skipToNextProgram();
    }

    public pausePlayer(): void {
        this._input.playback.pausePlayer();
    }

    public playPlayer(): Promise<void> {
        return this._input.playback.playPlayer();
    }

    public pauseSchedulerSync(): void {
        this._input.schedulerRuntime.pauseSchedulerSync();
    }

    public resumeSchedulerSync(): void {
        this._input.schedulerRuntime.resumeSchedulerSync();
    }

    public syncSchedulerToCurrentTime(): void {
        this._input.schedulerRuntime.syncSchedulerToCurrentTime();
    }

    public saveLifecycleState(): Promise<void> {
        return this._input.modules.lifecycle.saveState();
    }

    public handleGlobalError(error: AppError, context: string): void {
        this._input.uiRuntime.handleGlobalError(error, context);
    }

    public handlePlaybackFailure(context: string, error: unknown): void {
        this._input.playback.playbackRecovery.handlePlaybackFailure?.(context, error);
    }

    public onPlayerStateChange(
        state: Parameters<PlaybackRuntimeControllerDeps['onPlayerStateChange']>[0]
    ): void {
        this._input.playerEvents.onPlayerStateChange(state);
    }

    public shouldAutoShowInfoBannerOnNextPlay(): boolean {
        return this._input.playback.playbackState.getShouldAutoShowInfoBannerOnNextPlay();
    }

    public clearAutoShowInfoBannerOnNextPlay(): void {
        this._input.playback.playbackState.setShouldAutoShowInfoBannerOnNextPlay(false);
    }

    public showInfoBanner(): void {
        this._input.uiRuntime.showInfoBanner();
    }

    public onPlayerTimeUpdate(
        payload: Parameters<PlaybackRuntimeControllerDeps['onPlayerTimeUpdate']>[0]
    ): void {
        this._input.playerEvents.onPlayerTimeUpdate(payload);
    }

    public onPlayerBufferUpdate(
        payload: Parameters<PlaybackRuntimeControllerDeps['onPlayerBufferUpdate']>[0]
    ): void {
        this._input.playerEvents.onPlayerBufferUpdate(payload);
    }
}

class ProfileSwitchCleanupControllerDepsAdapter
    implements ProfileSwitchCleanupControllerDeps
{
    constructor(private readonly _input: PriorityOneAssemblyInput) {}

    public cancelPendingDayRollover(): void {
        this._input.schedulerRuntime.cancelPendingDayRollover();
    }

    public stopPlayback(): void {
        this._input.playback.stopPlayback();
    }

    public unloadCurrentChannel(): void {
        this._input.playback.unloadCurrentChannel();
    }

    public setPendingNowPlayingChannelId(channelId: string | null): void {
        this._input.playback.playbackState.setPendingNowPlayingChannelId(channelId);
    }

    public setShouldAutoShowInfoBannerOnNextPlay(value: boolean): void {
        this._input.playback.playbackState.setShouldAutoShowInfoBannerOnNextPlay(value);
    }

    public setCurrentProgramForPlayback(program: ScheduledProgram | null): void {
        this._input.playback.playbackState.setCurrentProgramForPlayback(program);
    }

    public setCurrentStreamDescriptor(stream: StreamDescriptor | null): void {
        this._input.playback.playbackState.setCurrentStreamDescriptor(stream);
    }

    public setCurrentStreamDecision(
        decision: Parameters<ProfileSwitchCleanupControllerDeps['setCurrentStreamDecision']>[0]
    ): void {
        this._input.playback.playbackState.setCurrentStreamDecision(decision);
    }
}

export class OrchestratorEventBinderDepsAdapter implements OrchestratorEventBinderDeps {
    public readonly cleanupReporter: PriorityOneAssemblyInput['events']['cleanupReporter'];
    public readonly reportRecoverableAsyncFailure: PriorityOneAssemblyInput['events']['reportRecoverableAsyncFailure'];

    constructor(
        private readonly _input: PriorityOneAssemblyInput,
        private readonly _playbackStartController: PlaybackStartController,
        private readonly _playbackRuntimeController: PlaybackRuntimeController
    ) {
        this.cleanupReporter = _input.events.cleanupReporter;
        this.reportRecoverableAsyncFailure = _input.events.reportRecoverableAsyncFailure;
    }

    public getScheduler(): ReturnType<OrchestratorEventBinderDeps['getScheduler']> {
        return this._input.modules.scheduler;
    }

    public getVideoPlayer(): ReturnType<OrchestratorEventBinderDeps['getVideoPlayer']> {
        return this._input.modules.videoPlayer;
    }

    public getPlexLibrary(): ReturnType<OrchestratorEventBinderDeps['getPlexLibrary']> {
        return this._input.surfaces.plexLibrary;
    }

    public getPlexStreamResolver(): ReturnType<OrchestratorEventBinderDeps['getPlexStreamResolver']> {
        return this._input.surfaces.plexStreamResolver;
    }

    public getNavigation(): ReturnType<OrchestratorEventBinderDeps['getNavigation']> {
        return this._input.surfaces.navigation;
    }

    public getLifecycle(): ReturnType<OrchestratorEventBinderDeps['getLifecycle']> {
        return this._input.modules.lifecycle;
    }

    public getChannelManager(): ReturnType<OrchestratorEventBinderDeps['getChannelManager']> {
        return this._input.surfaces.channelManager;
    }

    public wireNavigationCoordinatorEvents(): Array<() => void> {
        return this._input.events.wireNavigationCoordinatorEvents();
    }

    public wireEpgCoordinatorEvents(): Array<() => void> {
        return this._input.events.wireEpgCoordinatorEvents();
    }

    public handleProgramStartTracked(program: ScheduledProgram): Promise<void> {
        const promise = this._playbackStartController.handleProgramStart(program);
        return this._playbackRuntimeController.trackProgramStart(promise);
    }

    public handleScheduleDayRollover(): Promise<void> {
        return this._input.events.handleScheduleDayRollover();
    }

    public handlePlayerEnded(): void {
        this._playbackRuntimeController.handlePlayerEnded();
    }

    public handlePlayerTrackChange(
        event: Parameters<OrchestratorEventBinderDeps['handlePlayerTrackChange']>[0]
    ): void {
        this._input.events.handlePlayerTrackChange(event);
    }

    public handlePlaybackError(error: PlaybackError): void {
        this._playbackRuntimeController.handlePlaybackError(error);
    }

    public handlePlayerStateChange(
        state: Parameters<OrchestratorEventBinderDeps['handlePlayerStateChange']>[0]
    ): void {
        this._playbackRuntimeController.handlePlayerStateChange(state);
    }

    public handlePlayerTimeUpdate(
        payload: Parameters<OrchestratorEventBinderDeps['handlePlayerTimeUpdate']>[0]
    ): void {
        this._playbackRuntimeController.handlePlayerTimeUpdate(payload);
    }

    public handlePlayerBufferUpdate(
        payload: Parameters<OrchestratorEventBinderDeps['handlePlayerBufferUpdate']>[0]
    ): void {
        this._playbackRuntimeController.handlePlayerBufferUpdate(payload);
    }

    public handlePlexLibraryAuthExpired(): void {
        this._input.events.handlePlexLibraryAuthExpired();
    }

    public handlePlexStreamError(
        error: Parameters<OrchestratorEventBinderDeps['handlePlexStreamError']>[0]
    ): void {
        this._input.events.handlePlexStreamError(error);
    }

    public handleScreenChange(
        payload: Parameters<OrchestratorEventBinderDeps['handleScreenChange']>[0]
    ): void {
        this._input.events.handleScreenChange(payload);
    }

    public handleLifecyclePause(): Promise<void> {
        return this._playbackRuntimeController.handleLifecyclePause();
    }

    public handleLifecycleResume(): Promise<void> {
        return this._playbackRuntimeController.handleLifecycleResume();
    }

    public reportPersistenceWarning(
        warning: Parameters<OrchestratorEventBinderDeps['reportPersistenceWarning']>[0]
    ): void {
        this._input.events.reportPersistenceWarning(warning);
    }
}

export function createOverlayRuntimePolicyController(
    input: PriorityOneAssemblyInput
): OverlayRuntimePolicyController {
    return new OverlayRuntimePolicyController(
        new OverlayRuntimePolicyControllerDepsAdapter(input)
    );
}

export function createPlaybackStartController(
    input: PriorityOneAssemblyInput
): PlaybackStartController {
    return new PlaybackStartController(new PlaybackStartControllerDepsAdapter(input));
}

export function createPlaybackRuntimeController(
    input: PriorityOneAssemblyInput
): PlaybackRuntimeController {
    return new PlaybackRuntimeController(new PlaybackRuntimeControllerDepsAdapter(input));
}

export function createProfileSwitchCleanupController(
    input: PriorityOneAssemblyInput
): ProfileSwitchCleanupController {
    return new ProfileSwitchCleanupController(
        new ProfileSwitchCleanupControllerDepsAdapter(input)
    );
}

export function createEventBinder(
    input: PriorityOneAssemblyInput,
    playbackStartController: PlaybackStartController,
    playbackRuntimeController: PlaybackRuntimeController
): OrchestratorEventBinder {
    return new OrchestratorEventBinder(
        new OrchestratorEventBinderDepsAdapter(
            input,
            playbackStartController,
            playbackRuntimeController
        )
    );
}
