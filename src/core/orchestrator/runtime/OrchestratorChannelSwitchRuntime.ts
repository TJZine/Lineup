import type { IChannelManager } from '../../../modules/scheduler/channel-manager';
import type { IVideoPlayer } from '../../../modules/player';
import type { IChannelScheduler } from '../../../modules/scheduler/scheduler';
import { isAbortLikeError } from '../../../utils/errors';
import { CHANNEL_SWITCH_OUTCOME } from '../../../types/channelSwitch';
import type { ChannelSwitchOutcome } from '../../../types/channelSwitch';
import type { OperationContextUpstream } from '../../../utils/RetainedOperationContext';
import type {
    ChannelInitialTuneLineage,
    ChannelInitialTunePermit,
} from '../../channel-tuning/ChannelInitialTuneAuthority';
import type {
    ChannelSwitchOptions,
    ChannelTuningCoordinator,
} from '../../channel-tuning';

export interface OrchestratorChannelSwitchRuntimeDeps {
    assertNotShutdown(method: string): void;
    getChannelTuning(): ChannelTuningCoordinator | null;
    getChannelManager(): IChannelManager | null;
    getScheduler(): IChannelScheduler | null;
    getVideoPlayer(): IVideoPlayer | null;
    reportIssue(event: string, message: string, data?: Record<string, unknown>): void;
    reportError(event: string, message: string, error: unknown): void;
}

export class OrchestratorChannelSwitchRuntime {
    constructor(private readonly _deps: OrchestratorChannelSwitchRuntimeDeps) {}

    async suspendAndDrainForScopeTransition(): Promise<void> {
        this._deps.assertNotShutdown('suspendAndDrainForScopeTransition');
        await this._deps.getChannelTuning()?.suspendAndDrainForScopeTransition();
    }

    resumeAfterScopeTransition(): void {
        this._deps.assertNotShutdown('resumeAfterScopeTransition');
        this._deps.getChannelTuning()?.resumeAfterScopeTransition();
    }

    beginInitialTuneLineage(
        validators: readonly OperationContextUpstream[]
    ): ChannelInitialTuneLineage {
        const tuning = this._requireChannelTuning('beginInitialTuneLineage');
        return tuning.beginInitialTuneLineage(validators);
    }

    mintInitialTunePermit(lineage: ChannelInitialTuneLineage): ChannelInitialTunePermit {
        return this._requireChannelTuning('mintInitialTunePermit').mintInitialTunePermit(lineage);
    }

    completeInitialTuneLineage(lineage: ChannelInitialTuneLineage): void {
        this._requireChannelTuning('completeInitialTuneLineage').completeInitialTuneLineage(lineage);
    }

    switchToInitialChannel(
        channelId: string,
        permit: ChannelInitialTunePermit
    ): Promise<ChannelSwitchOutcome> {
        return this._requireChannelTuning('switchToInitialChannel')
            .switchToInitialChannel(channelId, permit);
    }

    async switchToChannel(channelId: string, options?: ChannelSwitchOptions): Promise<void> {
        this._deps.assertNotShutdown('switchToChannel');
        const channelTuning = this._deps.getChannelTuning();
        if (!channelTuning) {
            this._logMissingChannelTuningDependencies('switchToChannel');
            return;
        }

        await channelTuning.switchToChannel(channelId, options);
    }

    async switchToChannelWithOutcome(
        channelId: string,
        options?: ChannelSwitchOptions
    ): Promise<ChannelSwitchOutcome> {
        this._deps.assertNotShutdown('switchToChannel');
        const channelTuning = this._deps.getChannelTuning();
        if (!channelTuning) {
            this._logMissingChannelTuningDependencies('switchToChannel');
            return CHANNEL_SWITCH_OUTCOME.failed('missing_dependencies');
        }

        try {
            return await channelTuning.switchToChannel(channelId, options);
        } catch (error: unknown) {
            if (isAbortLikeError(error, options?.signal)) {
                return CHANNEL_SWITCH_OUTCOME.aborted;
            }
            this._deps.reportError(
                'orchestrator.channelSwitch.idOutcome',
                'switchToChannelWithOutcome failed',
                error
            );
            return CHANNEL_SWITCH_OUTCOME.failed('content_unavailable');
        }
    }

    async switchToChannelByNumber(
        number: number,
        options?: { signal?: AbortSignal }
    ): Promise<void> {
        this._deps.assertNotShutdown('switchToChannelByNumber');
        const channelTuning = this._deps.getChannelTuning();
        if (!channelTuning) {
            this._logMissingChannelTuningDependencies('switchToChannelByNumber');
            return;
        }

        await channelTuning.switchToChannelByNumber(number, options);
    }

    async switchToChannelByNumberWithOutcome(
        number: number,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSwitchOutcome> {
        this._deps.assertNotShutdown('switchToChannelByNumber');
        const channelTuning = this._deps.getChannelTuning();
        if (!channelTuning) {
            this._logMissingChannelTuningDependencies('switchToChannelByNumberWithOutcome');
            return CHANNEL_SWITCH_OUTCOME.failed('missing_dependencies');
        }

        try {
            return await channelTuning.switchToChannelByNumber(number, options);
        } catch (error: unknown) {
            if (isAbortLikeError(error, options?.signal)) {
                return CHANNEL_SWITCH_OUTCOME.aborted;
            }
            this._deps.reportError(
                'orchestrator.channelSwitch.byNumberOutcome',
                'switchToChannelByNumberWithOutcome failed',
                error
            );
            return CHANNEL_SWITCH_OUTCOME.failed('content_unavailable');
        }
    }

    switchToNextChannel(): void {
        if (this._deps.getChannelTuning()?.isSuspended()) return;
        const channelManager = this._deps.getChannelManager();
        if (!channelManager) return;

        const nextChannel = channelManager.getNextChannel();
        if (nextChannel) {
            this.switchToChannel(nextChannel.id).catch((error: unknown) => {
                if (isAbortLikeError(error)) return;
                this._deps.reportError(
                    'orchestrator.channelSwitch.next',
                    'Next channel switch failed',
                    error
                );
            });
        }
    }

    switchToPreviousChannel(): void {
        if (this._deps.getChannelTuning()?.isSuspended()) return;
        const channelManager = this._deps.getChannelManager();
        if (!channelManager) return;

        const prevChannel = channelManager.getPreviousChannel();
        if (prevChannel) {
            this.switchToChannel(prevChannel.id).catch((error: unknown) => {
                if (isAbortLikeError(error)) return;
                this._deps.reportError(
                    'orchestrator.channelSwitch.previous',
                    'Previous channel switch failed',
                    error
                );
            });
        }
    }

    private _logMissingChannelTuningDependencies(context: string): void {
        const missingModules = [
            !this._deps.getChannelTuning() ? '_channelTuning' : null,
            !this._deps.getChannelManager() ? '_channelManager' : null,
            !this._deps.getScheduler() ? '_scheduler' : null,
            !this._deps.getVideoPlayer() ? '_videoPlayer' : null,
        ].filter((module): module is string => module !== null);

        if (missingModules.length === 0) {
            this._deps.reportIssue(
                'orchestrator.channelTuningUnavailable',
                `${context}: channel tuning unavailable`
            );
            return;
        }

        this._deps.reportIssue(
            'orchestrator.channelTuningUnavailable',
            `${context}: channel tuning unavailable`,
            { missingModules }
        );
    }

    private _requireChannelTuning(method: string): ChannelTuningCoordinator {
        this._deps.assertNotShutdown(method);
        const tuning = this._deps.getChannelTuning();
        if (tuning) return tuning;
        this._logMissingChannelTuningDependencies(method);
        throw new Error(`${method}: channel tuning unavailable`);
    }
}
