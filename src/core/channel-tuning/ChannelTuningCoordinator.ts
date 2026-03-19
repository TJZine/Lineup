/**
 * @fileoverview Coordinates channel switching and schedule synchronization.
 * @module core/channel-tuning/ChannelTuningCoordinator
 * @version 1.0.0
 */

import type { AppError } from '../../modules/lifecycle';
import { AppErrorCode } from '../../modules/lifecycle';

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
import { IssueDiagnosticsStore } from '../../modules/debug/IssueDiagnosticsStore';
import { isAbortLikeError, summarizeErrorForLog } from '../../utils/errors';
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

function createAbortLikeError(message: string): Error {
    if (typeof DOMException !== 'undefined') {
        return new DOMException(message, 'AbortError');
    }
    const error = new Error(message);
    error.name = 'AbortError';
    return error;
}

const QA_003B_ISSUE_ID = 'QA-003b';
const issueDiagnosticsStore = new IssueDiagnosticsStore();

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
        const channelManager = this.deps.getChannelManager();
        const scheduler = this.deps.getScheduler();
        const videoPlayer = this.deps.getVideoPlayer();
        if (!channelManager || !scheduler || !videoPlayer) {
            console.error('Modules not initialized');
            return 'failed';
        }

        if (options?.signal?.aborted) {
            return 'aborted';
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
                console.error('Channel not found:', channelId);
                this.deps.handleGlobalError(
                    {
                        code: AppErrorCode.CHANNEL_NOT_FOUND,
                        message: `Channel ${channelId} not found`,
                        recoverable: true,
                    },
                    'switchToChannel'
                );
                return 'failed';
            }

            const now = Date.now();
            const snapshotValidation = this._validateGuideSelectionSnapshot(
                options?.guideSelectionSnapshot,
                channelId,
                now
            );
            let scheduleItems: ResolvedContentItem[] | null = null;
            if (snapshotValidation.valid && snapshotValidation.snapshot) {
                scheduleItems = [...snapshotValidation.snapshot.orderedItems];
                issueDiagnosticsStore.append(QA_003B_ISSUE_ID, 'channelTuning.guideSnapshotApplied', {
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
                issueDiagnosticsStore.append(QA_003B_ISSUE_ID, 'channelTuning.guideSnapshotRejected', {
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
                    issueDiagnosticsStore.append(QA_003B_ISSUE_ID, 'channelTuning.resolveChannelContent', {
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

                    console.error('Failed to resolve channel content:', summarizeErrorForLog(error));

                    if (
                        error &&
                        typeof error === 'object' &&
                        'code' in error &&
                        typeof (error as { code?: unknown }).code === 'string' &&
                        'message' in error &&
                        typeof (error as { message?: unknown }).message === 'string'
                    ) {
                        const errWithCode = error as { code: string; message: string; recoverable?: boolean };
                        this.deps.handleGlobalError(
                            {
                                code: errWithCode.code as AppErrorCode,
                                message: errWithCode.message,
                                recoverable: Boolean(errWithCode.recoverable),
                            },
                            'switchToChannel'
                        );
                    } else {
                        this.deps.handleGlobalError(
                            {
                                code: AppErrorCode.CONTENT_UNAVAILABLE,
                                message: `Failed to switch to channel: ${channel.name}`,
                                recoverable: true,
                            },
                            'switchToChannel'
                        );
                    }
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
            try {
                this.deps.armChannelTransitionForSwitch(channelPrefix);
            } catch (error: unknown) {
                console.warn('Failed to arm channel transition:', summarizeErrorForLog(error));
            }
            videoPlayer.stop();

            // Configure scheduler
            const scheduleConfig = this.deps.buildDailyScheduleConfig(channel, scheduleItems, now);
            this.deps.setPendingNowPlayingChannelId(channelId);
            scheduler.loadChannel(scheduleConfig);
            this.deps.setActiveScheduleDayKey(this.deps.getLocalDayKey(now));
            issueDiagnosticsStore.append(QA_003B_ISSUE_ID, 'channelTuning.schedulerLoaded', {
                channelId,
                referenceTimeMs: now,
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
                console.error('Failed to sync schedule time:', summary);
                this.deps.handleGlobalError(
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
                    'switchToChannel'
                );
                try {
                    scheduler.unloadChannel();
                } catch (cleanupError: unknown) {
                    console.warn(
                        'Failed to unload schedule after sync failure:',
                        summarizeErrorForLog(cleanupError)
                    );
                }
                return 'failed';
            }

            // Update current channel
            channelManager.setCurrentChannel(channelId);

            // Save state
            try {
                await this.deps.saveLifecycleState();
            } catch (error: unknown) {
                console.warn('Failed to save lifecycle state:', summarizeErrorForLog(error));
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
        const channelManager = this.deps.getChannelManager();
        if (!channelManager) {
            console.error('Channel manager not initialized');
            return 'failed';
        }

        const channel = channelManager.getChannelByNumber(number);
        if (!channel) {
            this.deps.handleGlobalError(
                {
                    code: AppErrorCode.CHANNEL_NOT_FOUND,
                    message: `Channel ${number} not found`,
                    recoverable: true,
                    context: {
                        operation: 'switchToChannelByNumber',
                        attemptedChannelNumber: number,
                    },
                },
                'switchToChannelByNumber'
            );
            return 'failed';
        }

        try {
            return await this.switchToChannel(channel.id, options);
        } catch (error: unknown) {
            if (isAbortLikeError(error, options?.signal)) {
                return 'aborted';
            }
            console.error('Failed to switch by channel number:', summarizeErrorForLog(error));
            return 'failed';
        }
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
