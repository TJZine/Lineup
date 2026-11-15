import type { IChannelManager, ResolvedChannelContent } from '../../modules/scheduler/channel-manager';
import {
    buildScheduledProgramIdentityFromState,
    scheduledProgramIdentitiesMatch,
    type IChannelScheduler,
    type ScheduleConfig,
} from '../../modules/scheduler/scheduler';
import type { PlaybackRuntimeController } from '../orchestrator/priority-one/PlaybackRuntimeController';
import type { ActiveMediaIdentity, ChannelAuthoringRuntime, SavedChannelEffect } from './ChannelAuthoringRuntimeContracts';

export interface ChannelAuthoringRuntimeEffectsDeps {
    getManager(): IChannelManager | null;
    getScheduler(): IChannelScheduler | null;
    getPlaybackRuntime(): PlaybackRuntimeController | null;
    buildDailyScheduleConfig(channel: SavedChannelEffect['saved'], items: ResolvedChannelContent['items'], now: number): ScheduleConfig;
    refreshGuide(): Promise<void>;
    showPlaybackStoppedReason(message: string): void;
    now(): number;
}

/** Post-commit media and guide effects; durable mutation stays with ChannelManager. */
export class ChannelAuthoringRuntimeEffects implements ChannelAuthoringRuntime {
    private _effectGeneration = 0;

    constructor(private readonly _deps: ChannelAuthoringRuntimeEffectsDeps) {}

    getActiveMediaIdentity(): ActiveMediaIdentity | null {
        return this._deps.getPlaybackRuntime()?.getActiveMediaIdentity() ?? null;
    }

    getDirectoryScopeKey(): string {
        return this._deps.getPlaybackRuntime()?.getDirectoryScopeKey() ?? 'unavailable';
    }

    async stopDeletedMediaIfCurrent(identity: ActiveMediaIdentity): Promise<'stopped' | 'superseded'> {
        return this._deps.getPlaybackRuntime()?.stopDeletedMediaIfCurrent(identity) ?? 'superseded';
    }

    async refreshAfterSave(effect: SavedChannelEffect): Promise<void> {
        const generation = ++this._effectGeneration;
        const manager = this._deps.getManager();
        const scheduler = this._deps.getScheduler();
        const runtime = this._deps.getPlaybackRuntime();
        if (!manager || !scheduler || !runtime) return;
        const base = manager.getStructuralBase();
        const media = runtime.getActiveMediaIdentity();
        const state = scheduler.getState();
        const programAtSave = buildScheduledProgramIdentityFromState(state);
        const indexAtSave = state.isActive ? scheduler.getScheduleIndex() : null;
        const isCurrent = (): boolean => generation === this._effectGeneration
            && this._deps.getManager() === manager && this._deps.getScheduler() === scheduler
            && this._deps.getPlaybackRuntime() === runtime
            && manager.getStructuralBase().generation === base.generation
            && manager.getStructuralBase().revision === base.revision;

        if (effect.programmingChanged && media?.channelId === effect.saved.id
            && state.isActive && state.channelId === effect.saved.id
            && runtime.isCurrentMediaIdentity(media)) {
            let content: ResolvedChannelContent;
            try {
                content = await manager.resolveChannelContent(effect.saved.id);
            } catch (error) {
                if (isCurrent()) throw error;
                return;
            }
            if (!isCurrent() || !runtime.isCurrentMediaIdentity(media)) return;
            const current = scheduler.getState();
            if (!current.isActive || current.channelId !== effect.saved.id || !current.currentProgram
                || scheduler.getScheduleIndex() !== indexAtSave
                || !programAtSave || !scheduledProgramIdentitiesMatch(
                    buildScheduledProgramIdentityFromState(current), programAtSave
                )) return;
            const saved = manager.getChannel(effect.saved.id);
            if (!saved) return;
            if (content.isStale || content.channelId !== saved.id
                || JSON.stringify(content.channelSnapshot.contentSource) !== JSON.stringify(saved.contentSource)
                || content.channelSnapshot.playbackMode !== saved.playbackMode) {
                throw new Error('Saved programming could not be confirmed from current channel content');
            }
            const itemStillAvailable = content.items.some(item =>
                item.ratingKey === current.currentProgram?.item.ratingKey);
            if (!itemStillAvailable || content.items.length === 0) {
                if (runtime.stopDeletedMediaIfCurrent(media) === 'stopped') {
                    this._deps.showPlaybackStoppedReason(
                        'Saved programming no longer includes the playing item. Playback stopped. Tune the channel to start its new schedule.'
                    );
                }
            } else {
                scheduler.stageChannelReplacement(
                    this._deps.buildDailyScheduleConfig(saved, content.items, this._deps.now())
                );
            }
        }
        if (!isCurrent()) return;
        await this._deps.refreshGuide();
    }
}
