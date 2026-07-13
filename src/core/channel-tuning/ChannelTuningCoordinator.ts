import type { AppError } from '../../modules/lifecycle';
import { AppErrorCode } from '../../types/app-errors';
import type { IVideoPlayer } from '../../modules/player';
import type {
    IChannelManager,
    ChannelConfig,
    ResolvedChannelContent,
    ResolvedContentItem,
} from '../../modules/scheduler/channel-manager';
import type {
    IChannelScheduler,
    ScheduleConfig,
} from '../../modules/scheduler/scheduler';
import type { AppendIssueDiagnostic } from '../../modules/debug/IssueDiagnosticsStore';
import { isAbortLikeError, summarizeErrorForLog } from '../../utils/errors';
import type { GuideSelectionSnapshot } from './GuideSelectionSnapshot';
import { validateGuideSelectionSnapshot } from './GuideSelectionSnapshot';
export type { ChannelSwitchOutcome } from '../../types/channelSwitch';
import { CHANNEL_SWITCH_OUTCOME } from '../../types/channelSwitch';
import type { ChannelSwitchOutcome } from '../../types/channelSwitch';
import type {
    OperationContextUpstream,
    RetainedOperationLease,
} from '../../utils/RetainedOperationContext';
import {
    ChannelInitialTuneAuthority,
    type ChannelInitialTuneLineage,
    type ChannelInitialTunePermit,
} from './ChannelInitialTuneAuthority';
import { ChannelTuningOperationContext } from './ChannelTuningOperationContext';
import { ChannelTuningDiagnostics } from './ChannelTuningDiagnostics';
import {
    buildChannelTransitionPrefix,
    captureAsyncError,
    captureSyncError,
} from './ChannelTuningExecutionSupport';
export interface ChannelTuningCoordinatorDeps {
    getChannelManager: () => IChannelManager | null;
    getScheduler: () => IChannelScheduler | null;
    getVideoPlayer: () => IVideoPlayer | null;

    buildDailyScheduleConfig: (
        channel: ChannelConfig,
        items: ResolvedChannelContent['items'],
        referenceTimeMs: number
    ) => ScheduleConfig;
    getLocalDayKey: (timeMs: number) => number;
    setActiveScheduleDayKey: (dayKey: number) => void;

    setPendingNowPlayingChannelId: (channelId: string | null) => void;
    getPendingNowPlayingChannelId: () => string | null;

    resetPlaybackGuardsForNewChannel: () => void;
    stopActiveTranscodeSession: () => void;
    armChannelTransitionForSwitch: (channelPrefix: string) => void;
    appendIssueDiagnostic: AppendIssueDiagnostic;

    handleGlobalError: (error: AppError, context: string) => void;
    saveLifecycleState: () => Promise<void>;
}

interface QueuedSwitchRequest {
    channelId: string;
    options: ChannelSwitchOptions | undefined;
    completion: Promise<ChannelSwitchOutcome>;
    resolve: (outcome: ChannelSwitchOutcome) => void;
    reject: (error: unknown) => void;
    operation: RetainedOperationLease;
}

export interface ChannelSwitchOptions {
    signal?: AbortSignal;
    guideSelectionSnapshot?: GuideSelectionSnapshot;
}

function createAbortLikeError(message: string): Error {
    if (typeof DOMException !== 'undefined') {
        return new DOMException(message, 'AbortError');
    }
    const error = new Error(message);
    error.name = 'AbortError';
    return error;
}

export class ChannelTuningCoordinator {
    private _isChannelSwitching = false;
    private _pendingSwitch: QueuedSwitchRequest | null = null;
    private _activeDrainPromise: Promise<void> | null = null;
    private readonly _operationContext = new ChannelTuningOperationContext();
    private readonly _initialTuneAuthority = new ChannelInitialTuneAuthority();
    private readonly _diagnostics: ChannelTuningDiagnostics;

    constructor(private readonly deps: ChannelTuningCoordinatorDeps) {
        this._diagnostics = new ChannelTuningDiagnostics(deps);
    }

    isSuspended(): boolean {
        return this._operationContext.isSuspended;
    }

    async suspendAndDrainForScopeTransition(): Promise<void> {
        this._operationContext.suspend();
        this._initialTuneAuthority.revokeActive();
        this._takePendingSwitch()?.reject(createAbortLikeError('Channel tuning was suspended.'));
        const channelManager = this.deps.getChannelManager();
        const resolutionDrain = channelManager?.supersedeActiveResolutions() ?? Promise.resolve();
        const tuningDrain = this._activeDrainPromise ?? Promise.resolve();
        await Promise.allSettled([tuningDrain, resolutionDrain]);
    }

    resumeAfterScopeTransition(): void {
        this.deps.getChannelManager()?.resumeActiveResolutions();
        this._operationContext.resume();
    }

    beginInitialTuneLineage(
        validators: readonly OperationContextUpstream[]
    ): ChannelInitialTuneLineage {
        if (!this._operationContext.isSuspended) throw createAbortLikeError('Channel tuning is not suspended.');
        return this._initialTuneAuthority.beginLineage(validators);
    }

    mintInitialTunePermit(lineage: ChannelInitialTuneLineage): ChannelInitialTunePermit {
        return this._initialTuneAuthority.mintPermit(lineage);
    }

    completeInitialTuneLineage(lineage: ChannelInitialTuneLineage): void {
        this._initialTuneAuthority.completeLineage(lineage);
    }

    async switchToInitialChannel(
        channelId: string,
        permit: ChannelInitialTunePermit
    ): Promise<ChannelSwitchOutcome> {
        if (!this._operationContext.isSuspended) throw createAbortLikeError('Channel tuning is not suspended.');
        const operation = this._initialTuneAuthority.consumePermit(permit);
        try {
            const channelManager = this.deps.getChannelManager();
            const scheduler = this.deps.getScheduler();
            const videoPlayer = this.deps.getVideoPlayer();
            if (!channelManager || !scheduler || !videoPlayer) {
                return CHANNEL_SWITCH_OUTCOME.failed('missing_dependencies');
            }
            const authorization = channelManager.createInitialTuneResolutionAuthorization(
                channelId,
                operation
            );
            return await this._runSingleSwitch(
                channelId,
                channelManager,
                scheduler,
                videoPlayer,
                undefined,
                operation,
                authorization
            );
        } finally {
            operation.release();
        }
    }

    async switchToChannel(
        channelId: string,
        options?: ChannelSwitchOptions
    ): Promise<ChannelSwitchOutcome> {
        if (this._operationContext.isSuspended || options?.signal?.aborted) {
            return CHANNEL_SWITCH_OUTCOME.aborted;
        }

        const channelManager = this.deps.getChannelManager();
        const scheduler = this.deps.getScheduler();
        const videoPlayer = this.deps.getVideoPlayer();
        if (!channelManager || !scheduler || !videoPlayer) {
            this._diagnostics.report(
                'channelTuning.dependenciesMissing',
                {
                    code: AppErrorCode.CONTENT_UNAVAILABLE,
                    message: 'Channel tuning dependencies are not available.',
                    recoverable: true,
                    context: {
                        channelId,
                        hasChannelManager: Boolean(channelManager),
                        hasScheduler: Boolean(scheduler),
                        hasVideoPlayer: Boolean(videoPlayer),
                    },
                },
                'switchToChannel',
                { channelId }
            );
            return CHANNEL_SWITCH_OUTCOME.failed('missing_dependencies');
        }

        const request = this._createSwitchRequest(
            channelId,
            options,
            this._operationContext.capture(options?.signal)
        );

        if (this._isChannelSwitching) {
            const superseded = this._pendingSwitch;
            if (superseded) {
                superseded.reject(
                    createAbortLikeError(
                        `Channel switch to "${superseded.channelId}" was superseded by "${channelId}"`
                    )
                );
            }
            console.warn('Channel switch already in progress, queueing latest request');
            this._pendingSwitch = request;
            return request.completion;
        }

        this._isChannelSwitching = true;
        const drain = this._drainSwitchQueue(
            request,
            channelManager,
            scheduler,
            videoPlayer
        );
        this._trackDrain(drain);
        return request.completion;
    }

    private _trackDrain(drain: Promise<void>): void {
        this._activeDrainPromise = drain;
        const clear = (): void => {
            if (this._activeDrainPromise === drain) this._activeDrainPromise = null;
        };
        void drain.then(clear, clear);
    }

    private _createSwitchRequest(
        channelId: string,
        options: ChannelSwitchOptions | undefined,
        operation: RetainedOperationLease
    ): QueuedSwitchRequest {
        let resolveFn: (outcome: ChannelSwitchOutcome) => void = () => undefined;
        let rejectFn: (error: unknown) => void = () => undefined;
        const completion = new Promise<ChannelSwitchOutcome>((resolve, reject) => {
            resolveFn = resolve;
            rejectFn = reject;
        });
        let settled = false;
        const release = (): void => {
            if (settled) return;
            settled = true;
            operation.release();
        };
        return {
            channelId,
            options,
            completion,
            resolve: (outcome): void => { release(); resolveFn(outcome); },
            reject: (error): void => { release(); rejectFn(error); },
            operation,
        };
    }

    private _takePendingSwitch(): QueuedSwitchRequest | null {
        const pending = this._pendingSwitch;
        this._pendingSwitch = null;
        return pending;
    }

    private async _drainSwitchQueue(
        initialRequest: QueuedSwitchRequest,
        channelManager: IChannelManager,
        scheduler: IChannelScheduler,
        videoPlayer: IVideoPlayer
    ): Promise<void> {
        let request: QueuedSwitchRequest | null = initialRequest;
        const failures: unknown[] = [];

        try {
            while (request) {
                const current = request;
                request = null;

                if (current.options?.signal?.aborted) {
                    current.resolve(CHANNEL_SWITCH_OUTCOME.aborted);
                    request = this._takePendingSwitch();
                    continue;
                }

                try {
                    const outcome = await this._runSingleSwitch(
                        current.channelId,
                        channelManager,
                        scheduler,
                        videoPlayer,
                        current.options,
                        current.operation
                    );
                    current.resolve(outcome);
                } catch (error: unknown) {
                    failures.push(error);
                    current.reject(error);
                }

                request = this._takePendingSwitch();
            }
        } finally {
            this._isChannelSwitching = false;
            const latePending = this._takePendingSwitch();
            if (latePending && !this._operationContext.isSuspended) {
                this._isChannelSwitching = true;
                this._trackDrain(
                    this._drainSwitchQueue(latePending, channelManager, scheduler, videoPlayer)
                );
            }
            if (latePending && this._operationContext.isSuspended) {
                latePending.reject(createAbortLikeError('Channel tuning was suspended.'));
            }
        }

        if (failures.length > 1) {
            console.warn(
                'Multiple queued channel switches failed',
                failures.map((error) => summarizeErrorForLog(error))
            );
        }
    }

    private async _runSingleSwitch(
        channelId: string,
        channelManager: IChannelManager,
        scheduler: IChannelScheduler,
        videoPlayer: IVideoPlayer,
        options: ChannelSwitchOptions | undefined,
        operation: RetainedOperationLease,
        initialResolutionAuthorization?: ReturnType<
            IChannelManager['createInitialTuneResolutionAuthorization']
        >
    ): Promise<ChannelSwitchOutcome> {
        const signal = operation.signal;
        if (signal.aborted) {
            return CHANNEL_SWITCH_OUTCOME.aborted;
        }

        operation.assertCurrent();
        this.deps.resetPlaybackGuardsForNewChannel();
        operation.assertCurrent();
        let didRequestProgramStart = false;

        try {
            const channel = channelManager.getChannel(channelId);
            if (!channel) {
                this._diagnostics.report(
                    'channelTuning.channelMissing',
                    {
                        code: AppErrorCode.CHANNEL_NOT_FOUND,
                        message: `Channel ${channelId} not found`,
                        recoverable: true,
                    },
                    'switchToChannel',
                    { channelId }
                );
                return CHANNEL_SWITCH_OUTCOME.failed('missing_channel');
            }

            const snapshotValidationReferenceTimeMs = Date.now();
            const snapshotValidation = validateGuideSelectionSnapshot(
                options?.guideSelectionSnapshot,
                channelId,
                this.deps.getLocalDayKey(snapshotValidationReferenceTimeMs)
            );
            let scheduleItems: ResolvedContentItem[] | null = null;
            let scheduleReferenceTimeMs = snapshotValidationReferenceTimeMs;
            if (snapshotValidation.valid && snapshotValidation.snapshot) {
                scheduleItems = [...snapshotValidation.snapshot.orderedItems];
                operation.assertCurrent();
                this._diagnostics.append('channelTuning.guideSnapshotApplied', {
                    channelId,
                    source: snapshotValidation.snapshot.source,
                    dayKey: snapshotValidation.snapshot.dayKey,
                    ratingKey: snapshotValidation.snapshot.ratingKey,
                    scheduledStartTime: snapshotValidation.snapshot.scheduledStartTime,
                    scheduledEndTime: snapshotValidation.snapshot.scheduledEndTime,
                    itemCount: scheduleItems.length,
                    sampleRatingKeys: scheduleItems.slice(0, 5).map((item) => item.ratingKey),
                });
                operation.assertCurrent();
            } else if (snapshotValidation.reason) {
                operation.assertCurrent();
                this._diagnostics.append('channelTuning.guideSnapshotRejected', {
                    channelId,
                    reason: snapshotValidation.reason,
                });
                operation.assertCurrent();
            }

            if (!scheduleItems) {
                let content: ResolvedChannelContent;
                try {
                    content = initialResolutionAuthorization
                        ? await channelManager.resolveChannelContentForInitialTune(
                            channelId,
                            initialResolutionAuthorization
                        )
                        : await channelManager.resolveChannelContent(channelId, {
                            signal: options?.signal ?? null,
                        });
                    operation.assertCurrent();
                    scheduleItems = content.items;
                    scheduleReferenceTimeMs = Date.now();
                    operation.assertCurrent();
                    this._diagnostics.append('channelTuning.resolveChannelContent', {
                        channelId,
                        resolvedAt: content.resolvedAt,
                        fromCache: content.fromCache ?? false,
                        isStale: content.isStale ?? false,
                        cacheReason: content.cacheReason ?? null,
                        itemCount: content.items.length,
                        sampleRatingKeys: content.items.slice(0, 5).map((item) => item.ratingKey),
                    });
                    operation.assertCurrent();
                } catch (error: unknown) {
                    if (isAbortLikeError(error, signal)) {
                        return CHANNEL_SWITCH_OUTCOME.aborted;
                    }

                    this._diagnostics.reportUnknown(
                        'channelTuning.resolveFailed',
                        error,
                        {
                            code: AppErrorCode.CONTENT_UNAVAILABLE,
                            message: `Failed to switch to channel: ${channel.name}`,
                            recoverable: true,
                            context: {
                                channelId,
                                operation: 'switchToChannel',
                                step: 'resolveChannelContent',
                            },
                        },
                        'switchToChannel',
                        { channelId }
                    );
                    return CHANNEL_SWITCH_OUTCOME.failed('content_unavailable');
                }
            }

            operation.assertCurrent();
            this.deps.stopActiveTranscodeSession();
            operation.assertCurrent();
            const channelPrefix = buildChannelTransitionPrefix(channel);
            const transitionArmError = captureSyncError(() => {
                operation.assertCurrent();
                this.deps.armChannelTransitionForSwitch(channelPrefix);
                operation.assertCurrent();
            });
            if (transitionArmError) {
                if (isAbortLikeError(transitionArmError, signal)) {
                    return CHANNEL_SWITCH_OUTCOME.aborted;
                }
                this._diagnostics.reportUnknown(
                    'channelTuning.channelTransitionArmFailed',
                    transitionArmError,
                    {
                        code: AppErrorCode.UI_RENDER_ERROR,
                        message: 'Unable to prepare the channel transition overlay.',
                        recoverable: true,
                        context: {
                            operation: 'switchToChannel',
                            channelId,
                            channelPrefix,
                            step: 'armChannelTransitionForSwitch',
                        },
                    },
                    'switchToChannel',
                    {
                        channelId,
                        channelPrefix,
                    }
                );
            }
            operation.assertCurrent();
            videoPlayer.stop();
            operation.assertCurrent();

            const scheduleConfig = this.deps.buildDailyScheduleConfig(
                channel,
                scheduleItems,
                scheduleReferenceTimeMs
            );
            operation.assertCurrent();
            this.deps.setPendingNowPlayingChannelId(channelId);
            operation.assertCurrent();
            scheduler.loadChannel(scheduleConfig);
            operation.assertCurrent();
            this.deps.setActiveScheduleDayKey(this.deps.getLocalDayKey(scheduleReferenceTimeMs));
            operation.assertCurrent();
            this._diagnostics.append('channelTuning.schedulerLoaded', {
                channelId,
                referenceTimeMs: scheduleReferenceTimeMs,
                anchorTime: scheduleConfig.anchorTime,
                playbackMode: scheduleConfig.playbackMode,
                shuffleSeed: scheduleConfig.shuffleSeed,
                contentCount: scheduleConfig.content.length,
                sampleRatingKeys: scheduleConfig.content.slice(0, 5).map((item) => item.ratingKey),
            });
            operation.assertCurrent();

            try {
                operation.assertCurrent();
                scheduler.syncToCurrentTime();
                operation.assertCurrent();
                didRequestProgramStart = true;
            } catch (error: unknown) {
                if (isAbortLikeError(error, signal)) {
                    return CHANNEL_SWITCH_OUTCOME.aborted;
                }
                const summary = summarizeErrorForLog(error);
                this._diagnostics.report(
                    'channelTuning.schedulerSyncFailed',
                    {
                        code: AppErrorCode.CONTENT_UNAVAILABLE,
                        message: 'Unable to start scheduled playback.',
                        recoverable: true,
                        context: {
                            operation: 'switchToChannel',
                            channelId,
                            step: 'scheduler.syncToCurrentTime',
                            error: summary,
                        },
                    },
                    'switchToChannel',
                    { channelId, error: summary }
                );
                const schedulerUnloadError = captureSyncError(() => {
                    scheduler.unloadChannel();
                });
                if (schedulerUnloadError) {
                    this._diagnostics.reportUnknown(
                        'channelTuning.schedulerUnloadFailed',
                        schedulerUnloadError,
                        {
                            code: AppErrorCode.PLAYBACK_FAILED,
                            message: 'Unable to clean up the failed channel switch.',
                            recoverable: true,
                            context: {
                                operation: 'switchToChannel',
                                channelId,
                                failedStep: 'scheduler.syncToCurrentTime',
                            },
                        },
                        'switchToChannel',
                        {
                            channelId,
                            failedStep: 'scheduler.syncToCurrentTime',
                        }
                    );
                }
                return CHANNEL_SWITCH_OUTCOME.failed('playback_start_failed');
            }

            operation.assertCurrent();
            channelManager.setCurrentChannel(channelId);
            operation.assertCurrent();

            const lifecycleSaveError = await captureAsyncError(() =>
                this.deps.saveLifecycleState()
            );
            operation.assertCurrent();
            if (lifecycleSaveError) {
                this._diagnostics.reportUnknown(
                    'channelTuning.lifecycleSaveFailed',
                    lifecycleSaveError,
                    {
                        code: AppErrorCode.STORAGE_CORRUPTED,
                        message: 'Unable to persist lifecycle state after switching channels.',
                        recoverable: true,
                        context: {
                            operation: 'switchToChannel',
                            channelId,
                            step: 'saveLifecycleState',
                        },
                    },
                    'switchToChannel',
                    { channelId }
                );
            }
            operation.assertCurrent();
            return CHANNEL_SWITCH_OUTCOME.switched;
        } catch (error: unknown) {
            if (isAbortLikeError(error, signal)) return CHANNEL_SWITCH_OUTCOME.aborted;
            throw error;
        } finally {
            try {
                operation.assertCurrent();
                if (!didRequestProgramStart && this.deps.getPendingNowPlayingChannelId() === channelId) {
                    this.deps.setPendingNowPlayingChannelId(null);
                    operation.assertCurrent();
                }
            } catch {
            }
        }
    }

    async switchToChannelByNumber(
        number: number,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSwitchOutcome> {
        if (this._operationContext.isSuspended || options?.signal?.aborted) {
            return CHANNEL_SWITCH_OUTCOME.aborted;
        }

        const channelManager = this.deps.getChannelManager();
        if (!channelManager) {
            this._diagnostics.report(
                'channelTuning.channelManagerMissing',
                {
                    code: AppErrorCode.CONTENT_UNAVAILABLE,
                    message: 'Channel manager not initialized',
                    recoverable: true,
                    context: {
                        attemptedChannelNumber: number,
                        operation: 'switchToChannelByNumber',
                    },
                },
                'switchToChannelByNumber',
                { attemptedChannelNumber: number }
            );
            return CHANNEL_SWITCH_OUTCOME.failed('missing_dependencies');
        }

        const channel = channelManager.getChannelByNumber(number);
        if (!channel) {
            this._diagnostics.report(
                'channelTuning.channelMissingByNumber',
                {
                    code: AppErrorCode.CHANNEL_NOT_FOUND,
                    message: `Channel ${number} not found`,
                    recoverable: true,
                    context: {
                        operation: 'switchToChannelByNumber',
                        attemptedChannelNumber: number,
                    },
                },
                'switchToChannelByNumber',
                { attemptedChannelNumber: number }
            );
            return CHANNEL_SWITCH_OUTCOME.failed('missing_channel');
        }

        try {
            return await this.switchToChannel(channel.id, options);
        } catch (error: unknown) {
            if (isAbortLikeError(error, options?.signal)) {
                return CHANNEL_SWITCH_OUTCOME.aborted;
            }
            this._diagnostics.reportUnknown(
                'channelTuning.switchByNumberFailed',
                error,
                {
                    code: AppErrorCode.CONTENT_UNAVAILABLE,
                    message: `Failed to switch to channel ${number}`,
                    recoverable: true,
                    context: {
                        attemptedChannelNumber: number,
                        operation: 'switchToChannelByNumber',
                    },
                },
                'switchToChannelByNumber',
                { attemptedChannelNumber: number }
            );
            return CHANNEL_SWITCH_OUTCOME.failed('content_unavailable');
        }
    }

}
