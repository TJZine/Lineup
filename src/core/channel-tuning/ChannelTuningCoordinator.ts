import type { AppError } from '../../modules/lifecycle';
import { AppErrorCode, getAppErrorCode } from '../../types/app-errors';

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
import { redactSensitiveTokens } from '../../utils/redact';
import type { GuideSelectionSnapshot } from './GuideSelectionSnapshot';

export type { ChannelSwitchOutcome } from '../../types/channelSwitch';
import type { ChannelSwitchOutcome } from '../../types/channelSwitch';

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
}

export interface ChannelSwitchOptions {
    signal?: AbortSignal;
    guideSelectionSnapshot?: GuideSelectionSnapshot;
}

type ChannelTuningOperation = 'switchToChannel' | 'switchToChannelByNumber';

type ChannelTuningErrorFallback = {
    code: AppErrorCode;
    message: string;
    recoverable: boolean;
    context?: Record<string, unknown>;
};

function createAbortLikeError(message: string): Error {
    if (typeof DOMException !== 'undefined') {
        return new DOMException(message, 'AbortError');
    }
    const error = new Error(message);
    error.name = 'AbortError';
    return error;
}

const QA_003B_ISSUE_ID = 'QA-003b';

export class ChannelTuningCoordinator {
    private _isChannelSwitching = false;
    private _pendingSwitch: QueuedSwitchRequest | null = null;

    constructor(private readonly deps: ChannelTuningCoordinatorDeps) { }

    /**
     * Switch queue policy:
     * - At most one switch executes at a time.
     * - A single pending slot is kept (latest-wins).
     * - The returned promise is bound to the caller's own request.
     *
     * Promise semantics:
     * - If the caller-provided AbortSignal is aborted, resolves with outcome 'aborted' and no switch occurs.
     * - If a pending request is superseded by a newer request, the superseded request rejects with AbortError.
     */
    async switchToChannel(
        channelId: string,
        options?: ChannelSwitchOptions
    ): Promise<ChannelSwitchOutcome> {
        if (options?.signal?.aborted) {
            return 'aborted';
        }

        const channelManager = this.deps.getChannelManager();
        const scheduler = this.deps.getScheduler();
        const videoPlayer = this.deps.getVideoPlayer();
        if (!channelManager || !scheduler || !videoPlayer) {
            this._reportHandledError(
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
            return 'failed';
        }

        const request = this._createSwitchRequest(channelId, options);

        // Prevent concurrent state corruption while preserving latest user intent.
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
            // Latest-wins queue: keep only the most recent pending request.
            this._pendingSwitch = request;
            return request.completion;
        }

        this._isChannelSwitching = true;
        void this._drainSwitchQueue(
            request,
            channelManager,
            scheduler,
            videoPlayer
        );
        return request.completion;
    }

    private _createSwitchRequest(
        channelId: string,
        options: ChannelSwitchOptions | undefined
    ): QueuedSwitchRequest {
        let resolveFn: (outcome: ChannelSwitchOutcome) => void = () => undefined;
        let rejectFn: (error: unknown) => void = () => undefined;
        const completion = new Promise<ChannelSwitchOutcome>((resolve, reject) => {
            resolveFn = resolve;
            rejectFn = reject;
        });
        return {
            channelId,
            options,
            completion,
            resolve: resolveFn,
            reject: rejectFn,
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
                    current.resolve('aborted');
                    request = this._takePendingSwitch();
                    continue;
                }

                try {
                    const outcome = await this._runSingleSwitch(
                        current.channelId,
                        channelManager,
                        scheduler,
                        videoPlayer,
                        current.options
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
            if (latePending) {
                this._isChannelSwitching = true;
                void this._drainSwitchQueue(latePending, channelManager, scheduler, videoPlayer);
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
        options: ChannelSwitchOptions | undefined
    ): Promise<ChannelSwitchOutcome> {
        const signal = options?.signal;
        if (signal?.aborted) {
            return 'aborted';
        }

        // New channel = new playback attempt; unblock any prior fast-fail guard.
        this.deps.resetPlaybackGuardsForNewChannel();
        let didRequestProgramStart = false;

        try {
            const channel = channelManager.getChannel(channelId);
            if (!channel) {
                this._reportHandledError(
                    'channelTuning.channelMissing',
                    {
                        code: AppErrorCode.CHANNEL_NOT_FOUND,
                        message: `Channel ${channelId} not found`,
                        recoverable: true,
                    },
                    'switchToChannel',
                    { channelId }
                );
                return 'failed';
            }

            const snapshotValidationReferenceTimeMs = Date.now();
            const snapshotValidation = this._validateGuideSelectionSnapshot(
                options?.guideSelectionSnapshot,
                channelId,
                snapshotValidationReferenceTimeMs
            );
            let scheduleItems: ResolvedContentItem[] | null = null;
            let scheduleReferenceTimeMs = snapshotValidationReferenceTimeMs;
            if (snapshotValidation.valid && snapshotValidation.snapshot) {
                scheduleItems = [...snapshotValidation.snapshot.orderedItems];
                this._appendIssueDiagnosticSafely('channelTuning.guideSnapshotApplied', {
                    channelId,
                    source: snapshotValidation.snapshot.source,
                    dayKey: snapshotValidation.snapshot.dayKey,
                    ratingKey: snapshotValidation.snapshot.ratingKey,
                    scheduledStartTime: snapshotValidation.snapshot.scheduledStartTime,
                    scheduledEndTime: snapshotValidation.snapshot.scheduledEndTime,
                    itemCount: scheduleItems.length,
                    sampleRatingKeys: scheduleItems.slice(0, 5).map((item) => item.ratingKey),
                });
            } else if (snapshotValidation.reason) {
                this._appendIssueDiagnosticSafely('channelTuning.guideSnapshotRejected', {
                    channelId,
                    reason: snapshotValidation.reason,
                });
            }

            if (!scheduleItems) {
                // Resolve channel content BEFORE stopping player
                // This prevents blank screen if resolution fails
                let content: ResolvedChannelContent;
                try {
                    content = await channelManager.resolveChannelContent(channelId, {
                        signal: signal ?? null,
                    });
                    scheduleItems = content.items;
                    scheduleReferenceTimeMs = Date.now();
                    this._appendIssueDiagnosticSafely('channelTuning.resolveChannelContent', {
                        channelId,
                        resolvedAt: content.resolvedAt,
                        fromCache: content.fromCache ?? false,
                        isStale: content.isStale ?? false,
                        cacheReason: content.cacheReason ?? null,
                        itemCount: content.items.length,
                        sampleRatingKeys: content.items.slice(0, 5).map((item) => item.ratingKey),
                    });
                } catch (error: unknown) {
                    if (isAbortLikeError(error, signal)) {
                        return 'aborted';
                    }

                    this._reportHandledUnknownError(
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
                    return 'failed';
                }
            }

            if (signal?.aborted) {
                return 'aborted';
            }

            // Only stop player after successful content resolution
            this.deps.stopActiveTranscodeSession();
            const channelPrefix = ((): string => {
                const hasNumber = typeof channel.number === 'number' && Number.isFinite(channel.number);
                const hasName = typeof channel.name === 'string' && channel.name.length > 0;
                if (hasNumber && hasName) {
                    return `${channel.number} ${channel.name}`;
                }
                if (hasName) {
                    return channel.name;
                }
                if (hasNumber) {
                    return `${channel.number}`;
                }
                return '';
            })();
            const transitionArmError = this._captureSyncError(() => {
                this.deps.armChannelTransitionForSwitch(channelPrefix);
            });
            if (transitionArmError) {
                this._reportHandledUnknownError(
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
            videoPlayer.stop();

            // Configure scheduler
            const scheduleConfig = this.deps.buildDailyScheduleConfig(
                channel,
                scheduleItems,
                scheduleReferenceTimeMs
            );
            this.deps.setPendingNowPlayingChannelId(channelId);
            scheduler.loadChannel(scheduleConfig);
            this.deps.setActiveScheduleDayKey(this.deps.getLocalDayKey(scheduleReferenceTimeMs));
            this._appendIssueDiagnosticSafely('channelTuning.schedulerLoaded', {
                channelId,
                referenceTimeMs: scheduleReferenceTimeMs,
                anchorTime: scheduleConfig.anchorTime,
                playbackMode: scheduleConfig.playbackMode,
                shuffleSeed: scheduleConfig.shuffleSeed,
                contentCount: scheduleConfig.content.length,
                sampleRatingKeys: scheduleConfig.content.slice(0, 5).map((item) => item.ratingKey),
            });

            // Sync to current time (this will emit programStart)
            try {
                scheduler.syncToCurrentTime();
                didRequestProgramStart = true;
            } catch (error: unknown) {
                const summary = summarizeErrorForLog(error);
                this._reportHandledError(
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
                const schedulerUnloadError = this._captureSyncError(() => {
                    scheduler.unloadChannel();
                });
                if (schedulerUnloadError) {
                    this._reportHandledUnknownError(
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
                return 'failed';
            }

            channelManager.setCurrentChannel(channelId);

            const lifecycleSaveError = await this._captureAsyncError(() =>
                this.deps.saveLifecycleState()
            );
            if (lifecycleSaveError) {
                this._reportHandledUnknownError(
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
            return 'switched';
        } finally {
            if (!didRequestProgramStart && this.deps.getPendingNowPlayingChannelId() === channelId) {
                this.deps.setPendingNowPlayingChannelId(null);
            }
        }
    }

    async switchToChannelByNumber(
        number: number,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSwitchOutcome> {
        if (options?.signal?.aborted) {
            return 'aborted';
        }

        const channelManager = this.deps.getChannelManager();
        if (!channelManager) {
            this._reportHandledError(
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
            return 'failed';
        }

        const channel = channelManager.getChannelByNumber(number);
        if (!channel) {
            this._reportHandledError(
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
            return 'failed';
        }

        try {
            return await this.switchToChannel(channel.id, options);
        } catch (error: unknown) {
            if (isAbortLikeError(error, options?.signal)) {
                return 'aborted';
            }
            this._reportHandledUnknownError(
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
            return 'failed';
        }
    }

    private _reportHandledUnknownError(
        stage: string,
        error: unknown,
        fallback: ChannelTuningErrorFallback,
        operation: ChannelTuningOperation,
        details: Record<string, unknown> = {}
    ): AppError {
        const appError = this._normalizeAppError(error, fallback);
        this._reportHandledError(stage, appError, operation, {
            ...details,
            error: summarizeErrorForLog(error),
        });
        return appError;
    }

    private _appendIssueDiagnosticSafely(stage: string, details: Record<string, unknown>): void {
        try {
            this.deps.appendIssueDiagnostic(QA_003B_ISSUE_ID, stage, details);
        } catch {
            // Diagnostics are best-effort and must never break switch control flow.
        }
    }

    private _reportHandledError(
        stage: string,
        error: AppError,
        operation: ChannelTuningOperation,
        details: Record<string, unknown> = {}
    ): void {
        this._appendIssueDiagnosticSafely(stage, {
            ...details,
            code: error.code,
            message: error.message,
            recoverable: error.recoverable,
            context: error.context ?? null,
        });
        this.deps.handleGlobalError(error, operation);
    }

    private _captureSyncError(operation: () => void): unknown | null {
        try {
            operation();
            return null;
        } catch (error: unknown) {
            return error;
        }
    }

    private async _captureAsyncError(operation: () => Promise<void>): Promise<unknown | null> {
        try {
            await operation();
            return null;
        } catch (error: unknown) {
            return error;
        }
    }

    private _normalizeAppError(error: unknown, fallback: ChannelTuningErrorFallback): AppError {
        if (!error || typeof error !== 'object') {
            return { ...fallback };
        }

        const maybeError = error as {
            code?: unknown;
            message?: unknown;
            recoverable?: unknown;
            context?: unknown;
        };

        const code = getAppErrorCode(maybeError.code) ?? fallback.code;
        const message = typeof maybeError.message === 'string'
            ? redactSensitiveTokens(maybeError.message).trim() || fallback.message
            : fallback.message;
        const recoverable = typeof maybeError.recoverable === 'boolean'
            ? maybeError.recoverable
            : fallback.recoverable;
        const context = {
            ...(fallback.context ?? {}),
            ...(maybeError.context && typeof maybeError.context === 'object'
                ? maybeError.context as Record<string, unknown>
                : {}),
            errorSummary: summarizeErrorForLog(error),
        };

        return { code, message, recoverable, context };
    }

    private _validateGuideSelectionSnapshot(
        snapshot: GuideSelectionSnapshot | undefined,
        channelId: string,
        referenceTimeMs: number
    ): { valid: true; snapshot: GuideSelectionSnapshot } | { valid: false; snapshot: null; reason: string | null } {
        if (!snapshot) {
            return { valid: false, snapshot: null, reason: null };
        }
        if (snapshot.channelId !== channelId) {
            return { valid: false, snapshot: null, reason: 'channel-mismatch' };
        }
        if (snapshot.dayKey !== this.deps.getLocalDayKey(referenceTimeMs)) {
            return { valid: false, snapshot: null, reason: 'day-mismatch' };
        }
        if (
            !Number.isFinite(snapshot.scheduledStartTime) ||
            !Number.isFinite(snapshot.scheduledEndTime) ||
            snapshot.scheduledStartTime >= snapshot.scheduledEndTime
        ) {
            return { valid: false, snapshot: null, reason: 'invalid-program-window' };
        }
        if (!Array.isArray(snapshot.orderedItems) || snapshot.orderedItems.length === 0) {
            return { valid: false, snapshot: null, reason: 'missing-items' };
        }
        if (!snapshot.orderedItems.some((item) => item.ratingKey === snapshot.ratingKey)) {
            return { valid: false, snapshot: null, reason: 'rating-key-mismatch' };
        }
        return { valid: true, snapshot };
    }
}
