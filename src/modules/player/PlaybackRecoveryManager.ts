/**
 * @fileoverview Manages stream recovery, subtitle resolution, and failure guards.
 * @module modules/player/PlaybackRecoveryManager
 * @version 1.0.0
 */

import {
    AppErrorCode,
    getAppErrorCode,
    type AppError,
} from '../../types/app-errors';
import {
    mapPlexStreamErrorCodeToAppErrorCode,
    type IPlexStreamResolver,
    type StreamDecision,
    type StreamRequest,
    type StreamResolverError,
} from '../plex/stream';
import type { IChannelScheduler, ScheduledProgram } from '../scheduler/scheduler';
import type { IVideoPlayer } from './interfaces';
import type { StreamDescriptor } from './types';
import { subtitleModeAllowsBurnIn, type SubtitleMode } from '../../shared/subtitle-mode';
import type { AppendIssueDiagnostic } from '../debug/IssueDiagnosticsStore';
import { SubtitlePreferencesStore } from '../settings/SubtitlePreferencesStore';
import { redactSensitiveTokens } from '../../utils/redact';
import { summarizeErrorForLog } from '../../utils/errors';
import {
    PlaybackReloadController,
    type RecoveryAttemptResult,
    type RecoveryReloadContext,
    type RecoveryReloadIgnoredReason,
} from './PlaybackReloadController';
import { PlaybackStreamDescriptorBuilder } from './PlaybackStreamDescriptorBuilder';

const QA_003B_ISSUE_ID = 'QA-003b';

export interface PlaybackRecoveryDeps {
    getVideoPlayer: () => IVideoPlayer | null;
    getStreamResolver: () => IPlexStreamResolver | null;
    getScheduler: () => IChannelScheduler | null;

    getCurrentProgramForPlayback: () => ScheduledProgram | null;
    getCurrentStreamDescriptor: () => StreamDescriptor | null;
    getCurrentStreamDecision?: () => StreamDecision | null;

    setCurrentStreamDecision: (d: StreamDecision | null) => void;
    setCurrentStreamDescriptor: (d: StreamDescriptor | null) => void;

    buildPlexResourceUrl: (pathOrUrl: string) => string | null;
    getMimeType: (decision: StreamDecision) => string;
    getAuthHeaders: () => Record<string, string>;
    getServerUri: () => string | null;
    getPreferredSubtitleLanguage: () => string | null;
    getPlexPreferredSubtitleLanguage?: () => string | null;
    notifySubtitleUnavailable: () => void;
    notifyToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
    subtitlePreferencesStore?: SubtitlePreferencesStore;
    appendIssueDiagnostic: AppendIssueDiagnostic;

    handleGlobalError: (error: AppError, context: string) => void;
}

type PreparedBurnInSubtitleRecovery = {
    context: RecoveryReloadContext;
    attemptKey: string;
    recordAttemptBeforeReload: boolean;
};

export type AudioTrackReloadResult = RecoveryAttemptResult<'reloaded', RecoveryReloadIgnoredReason>;

export type BurnInSubtitleRecoveryResult = RecoveryAttemptResult<
    'burned_in',
    RecoveryReloadIgnoredReason | 'already_attempted' | 'already_burned_in'
>;

export type DisableBurnInSubtitlesResult = RecoveryAttemptResult<
    'disabled',
    RecoveryReloadIgnoredReason | 'not_burn_in'
>;

export class PlaybackRecoveryManager {
    private readonly _subtitlePreferencesStore: SubtitlePreferencesStore;
    private readonly _descriptorBuilder: PlaybackStreamDescriptorBuilder;
    private readonly _reloadController: PlaybackReloadController;
    // Playback fast-fail guard: prevents tight skip loops when all items fail to play.
    private _playbackFailureWindowStartMs: number = 0;
    private _playbackFailureCount: number = 0;
    private _playbackFailureTripped: boolean = false;
    private _playbackFailureWindowMs: number = 2000;
    private _playbackFailureTripCount: number = 3;

    // Prevent runaway recovery loops
    private _directFallbackAttemptedForItemKey: Set<string> = new Set();
    private _burnInAttemptedForItemKey: Set<string> = new Set();

    constructor(private readonly deps: PlaybackRecoveryDeps) {
        this._subtitlePreferencesStore = deps.subtitlePreferencesStore ?? new SubtitlePreferencesStore();
        this._descriptorBuilder = new PlaybackStreamDescriptorBuilder({
            buildPlexResourceUrl: deps.buildPlexResourceUrl,
            getMimeType: deps.getMimeType,
            getAuthHeaders: deps.getAuthHeaders,
            getServerUri: deps.getServerUri,
            getPreferredSubtitleLanguage: deps.getPreferredSubtitleLanguage,
            notifySubtitleUnavailable: deps.notifySubtitleUnavailable,
            readSubtitleMode: (): SubtitleMode => this._readSubtitleMode(),
            preferForcedSubtitles: (): boolean => this._preferForcedSubtitles(),
            shouldHandleSubtitleDeactivation: ({ trackId, reason }): boolean =>
                this._shouldHandleSubtitleDeactivation(trackId, reason),
            recoverSubtitleDeactivation: ({ trackId, reason }): Promise<'handled' | 'failed'> =>
                this._recoverSubtitleDeactivation(trackId, reason),
            ...(deps.getPlexPreferredSubtitleLanguage
                ? { getPlexPreferredSubtitleLanguage: deps.getPlexPreferredSubtitleLanguage }
                : {}),
        });
        this._reloadController = new PlaybackReloadController({
            getVideoPlayer: deps.getVideoPlayer,
            getStreamResolver: deps.getStreamResolver,
            getCurrentProgramForPlayback: deps.getCurrentProgramForPlayback,
            setCurrentStreamDecision: deps.setCurrentStreamDecision,
            setCurrentStreamDescriptor: deps.setCurrentStreamDescriptor,
            buildStreamDescriptor: (program, decision, startOffsetMs): StreamDescriptor =>
                this._descriptorBuilder.build(program, decision, startOffsetMs),
            resetPlaybackFailureGuard: (): void => this.resetPlaybackFailureGuard(),
            ...(deps.getCurrentStreamDecision
                ? { getCurrentStreamDecision: deps.getCurrentStreamDecision }
                : {}),
        });
    }

    isStreamRecoveryInProgress(): boolean {
        return this._reloadController.isStreamRecoveryInProgress();
    }

    private _preferForcedSubtitles(): boolean {
        return this._subtitlePreferencesStore.readSubtitlePreferForcedAndClean(false);
    }

    private _readSubtitleMode(): SubtitleMode {
        return this._subtitlePreferencesStore.readSubtitleModeAndClean('full');
    }

    private _getCurrentItemKey(): string | null {
        const program = this.deps.getCurrentProgramForPlayback();
        if (!program) return null;
        const itemKey = program.item.ratingKey;
        return typeof itemKey === 'string' && itemKey.length > 0 ? itemKey : null;
    }

    private _buildPlaybackFailureContext(context: string, error: unknown): Record<string, unknown> {
        const schedulerState = this.deps.getScheduler()?.getState();
        return {
            source: redactSensitiveTokens(context),
            failureCount: this._playbackFailureCount,
            itemKey: this._getCurrentItemKey(),
            channelId: schedulerState?.channelId ?? null,
            safeError: summarizeErrorForLog(error),
        };
    }

    private _sanitizeResolverMessage(message: unknown, fallback: string): string {
        if (typeof message !== 'string') {
            return fallback;
        }

        const sanitized = redactSensitiveTokens(message).trim();
        if (!sanitized) {
            return fallback;
        }
        if (sanitized !== message.trim()) {
            return sanitized;
        }
        if (/\b(token|authorization|cookie|session)\b/i.test(message)) {
            return fallback;
        }
        return sanitized;
    }

    private _readPlayerState(player: IVideoPlayer): ReturnType<IVideoPlayer['getState']> | null {
        return player.getState();
    }

    resetPlaybackFailureGuard(): void {
        this._playbackFailureWindowStartMs = 0;
        this._playbackFailureCount = 0;
        this._playbackFailureTripped = false;
        const scheduler = this.deps.getScheduler();
        if (scheduler) {
            scheduler.resumeSyncTimer();
        }
    }

    resetDirectFallbackAttempts(): void {
        this._directFallbackAttemptedForItemKey.clear();
        this._burnInAttemptedForItemKey.clear();
    }

    handlePlaybackFailure(context: string, error: unknown): void {
        if (this._playbackFailureTripped) {
            return;
        }

        const scheduler = this.deps.getScheduler();
        const now = Date.now();

        // Reset window if stale
        if (
            this._playbackFailureWindowStartMs === 0 ||
            now - this._playbackFailureWindowStartMs > this._playbackFailureWindowMs
        ) {
            this._playbackFailureWindowStartMs = now;
            this._playbackFailureCount = 0;
        }

        this._playbackFailureCount++;

        // Trip guard: stop auto-skipping and surface the error to the user
        if (this._playbackFailureCount >= this._playbackFailureTripCount) {
            this._playbackFailureTripped = true;
            if (scheduler) {
                scheduler.pauseSyncTimer();
            }
            const failureContext = this._buildPlaybackFailureContext(context, error);
            this.deps.appendIssueDiagnostic(
                QA_003B_ISSUE_ID,
                'playbackRecovery.failureGuardTripped',
                failureContext
            );
            this.deps.handleGlobalError(
                {
                    code: AppErrorCode.PLAYBACK_FAILED,
                    message: 'Playback failed repeatedly',
                    recoverable: true,
                    context: failureContext,
                },
                'playback'
            );
            return;
        }

        // Single/rare failure: skip as before
        if (scheduler) {
            const schedulerState = scheduler.getState();
            this.deps.appendIssueDiagnostic(QA_003B_ISSUE_ID, 'playbackRecovery.skipToNext', {
                context: redactSensitiveTokens(context),
                itemKey: this._getCurrentItemKey(),
                channelId: schedulerState.channelId ?? null,
                failureCount: this._playbackFailureCount,
                safeError: summarizeErrorForLog(error),
            });
            scheduler.skipToNext();
        }
    }

    tryHandleStreamResolverAuthError(error: unknown): boolean {
        if (!error || typeof error !== 'object') {
            return false;
        }
        const maybe = error as Partial<StreamResolverError>;
        if (typeof maybe.message !== 'string') {
            return false;
        }
        const mapped = mapPlexStreamErrorCodeToAppErrorCode(maybe.code);
        if (
            mapped === AppErrorCode.AUTH_REQUIRED ||
            mapped === AppErrorCode.AUTH_EXPIRED ||
            mapped === AppErrorCode.AUTH_INVALID
        ) {
            this.deps.handleGlobalError(
                {
                    code: mapped,
                    message: this._sanitizeResolverMessage(maybe.message, 'Authentication is required.'),
                    recoverable: Boolean(maybe.recoverable),
                },
                'plex-stream'
            );
            return true;
        }
        return false;
    }

    async resolveStreamForProgram(program: ScheduledProgram): Promise<StreamDescriptor> {
        const resolver = this.deps.getStreamResolver();
        if (!resolver) {
            throw new Error('Stream resolver not initialized');
        }

        // Defensive: clamp elapsed time to valid bounds
        const clampedOffset = Math.max(0, Math.min(program.elapsedMs, program.item.durationMs));

        const decision: StreamDecision = await resolver.resolveStream({
            itemKey: program.item.ratingKey,
            startOffsetMs: clampedOffset,
            directPlay: true,
        });
        this.deps.setCurrentStreamDecision(decision);

        return this._descriptorBuilder.build(program, decision, clampedOffset);
    }

    async attemptAudioTrackReloadForCurrentProgram(
        trackId: string,
        reason: string
    ): Promise<AudioTrackReloadResult> {
        const context = this._reloadController.prepareReload(reason);
        if ('outcome' in context) {
            return context;
        }

        const preserveDirectPlayPreference = context.currentDecision
            ? context.currentDecision.isDirectPlay
            : true;
        const preReloadState = this._readPlayerState(context.player);
        const shouldResumeAfterReload =
            preReloadState?.status === 'playing' || preReloadState?.status === 'buffering';
        const activeSubtitleId =
            typeof preReloadState?.activeSubtitleId === 'string' && preReloadState.activeSubtitleId.length > 0
                ? preReloadState.activeSubtitleId
                : null;

        return this._reloadController.executeReload({
            context,
            successOutcome: 'reloaded',
            startEvent: 'audioReload.start',
            abortedEvent: 'audioReload.aborted',
            failedEvent: 'audioReload.failed',
            startData: ({ itemKey }) => ({
                trackId,
                itemKey,
                preserveDirectPlayPreference,
            }),
            buildRequest: ({ itemKey, clampedOffset, currentDecision }) => {
                const request: StreamRequest = {
                    itemKey,
                    startOffsetMs: clampedOffset,
                    directPlay: preserveDirectPlayPreference,
                    audioStreamId: trackId,
                };
                const burnInSubtitleId = currentDecision?.transcodeRequest?.subtitleMode === 'burn'
                    ? currentDecision.transcodeRequest.subtitleStreamId
                    : null;
                if (typeof burnInSubtitleId === 'string' && burnInSubtitleId.length > 0) {
                    request.subtitleStreamId = burnInSubtitleId;
                    request.subtitleMode = 'burn';
                } else if (activeSubtitleId) {
                    request.subtitleStreamId = activeSubtitleId;
                }
                return request;
            },
            customizeDescriptor: (descriptor) => {
                if (preReloadState?.activeSubtitleId === null) {
                    return { ...descriptor, preferredSubtitleTrackId: null };
                }
                if (
                    activeSubtitleId &&
                    descriptor.subtitleTracks.some((track) => track.id === activeSubtitleId)
                ) {
                    return { ...descriptor, preferredSubtitleTrackId: activeSubtitleId };
                }
                return descriptor;
            },
            shouldResumeAfterReload,
        });
    }

    tryHandleStreamResolverPermissionError(error: unknown): boolean {
        if (!error || typeof error !== 'object') {
            return false;
        }
        const maybe = error as { code?: unknown; message?: unknown };
        if (typeof maybe.message !== 'string') {
            return false;
        }
        const code = getAppErrorCode(maybe.code);
        if (code !== AppErrorCode.ACCESS_DENIED) {
            return false;
        }
        this.deps.handleGlobalError(
            {
                code: AppErrorCode.ACCESS_DENIED,
                message: this._sanitizeResolverMessage(maybe.message, 'Access denied.'),
                recoverable: false,
            },
            'plex-stream'
        );
        return true;
    }

    async attemptTranscodeFallbackForCurrentProgram(reason: string): Promise<boolean> {
        const context = this._reloadController.prepareReload(reason);
        if ('outcome' in context) {
            return false;
        }

        const currentProtocol = this.deps.getCurrentStreamDescriptor()?.protocol ?? null;
        if (currentProtocol !== 'direct') {
            return false;
        }
        if (this._directFallbackAttemptedForItemKey.has(context.itemKey)) {
            return false;
        }

        this._directFallbackAttemptedForItemKey.add(context.itemKey);

        const result = await this._reloadController.executeReload({
            context,
            successOutcome: 'reloaded',
            startEvent: 'transcodeFallback.start',
            abortedEvent: 'transcodeFallback.aborted',
            failedEvent: 'transcodeFallback.failed',
            startData: ({ itemKey }) => ({ itemKey }),
            buildRequest: ({ itemKey, clampedOffset }) => ({
                itemKey,
                startOffsetMs: clampedOffset,
                directPlay: false,
            }),
            afterLoad: async (descriptor) => {
                if (descriptor.preferredSubtitleTrackId) {
                    await context.player.setSubtitleTrack(descriptor.preferredSubtitleTrackId);
                }
            },
            shouldResumeAfterReload: true,
        });

        return result.outcome === 'reloaded';
    }

    async attemptBurnInSubtitleForCurrentProgram(
        trackId: string,
        reason: string
    ): Promise<BurnInSubtitleRecoveryResult> {
        const prepared = this._prepareBurnInSubtitleRecovery(trackId, reason);
        if ('outcome' in prepared) {
            return prepared;
        }

        return this._executeBurnInSubtitleRecovery(trackId, prepared);
    }

    async attemptDisableBurnInSubtitlesForCurrentProgram(
        reason: string
    ): Promise<DisableBurnInSubtitlesResult> {
        const context = this._reloadController.prepareReload(reason);
        if ('outcome' in context) {
            return context;
        }

        const currentDecision = context.currentDecision;
        if (!currentDecision) {
            return { outcome: 'ignored', reason: 'missing_deps' };
        }

        const transcodeRequest = currentDecision.transcodeRequest ?? null;
        const isBurnIn = transcodeRequest?.subtitleMode === 'burn';
        if (!isBurnIn) {
            return { outcome: 'ignored', reason: 'not_burn_in' };
        }

        const burnedInTrackId = transcodeRequest?.subtitleStreamId ?? null;
        return this._reloadController.executeReload({
            context,
            successOutcome: 'disabled',
            startEvent: 'disableBurnIn.start',
            abortedEvent: 'disableBurnIn.aborted',
            failedEvent: 'disableBurnIn.failed',
            startData: ({ itemKey }) => ({
                itemKey,
                burnedInTrackId,
            }),
            beforeResolve: async () => {
                if (currentDecision.isTranscoding && currentDecision.sessionId) {
                    try {
                        await context.resolver.stopTranscodeSession(currentDecision.sessionId);
                    } catch {
                        // Best-effort cleanup; the recovery should still continue.
                    }
                }
            },
            buildRequest: ({ itemKey, clampedOffset, player }) => {
                const activeAudioId = this._readPlayerState(player)?.activeAudioId ?? null;
                return {
                    itemKey,
                    startOffsetMs: clampedOffset,
                    directPlay: true,
                    ...(activeAudioId ? { audioStreamId: activeAudioId } : {}),
                };
            },
            customizeDescriptor: (descriptor) => ({
                ...descriptor,
                preferredSubtitleTrackId: null,
            }),
            shouldResumeAfterReload: true,
            onSuccess: ({ itemKey }) => {
                if (typeof burnedInTrackId === 'string' && burnedInTrackId.length > 0) {
                    this._burnInAttemptedForItemKey.delete(`${itemKey}::${burnedInTrackId}`);
                }
            },
        });
    }

    private _prepareBurnInSubtitleRecovery(
        trackId: string,
        reason: string
    ): PreparedBurnInSubtitleRecovery | BurnInSubtitleRecoveryResult {
        const context = this._reloadController.prepareReload(reason);
        if ('outcome' in context) {
            return context;
        }

        const attemptKey = `${context.itemKey}::${trackId}`;
        const recordAttemptBeforeReload = this._shouldRecordAutomaticBurnInAttempt(reason);
        if (recordAttemptBeforeReload && this._burnInAttemptedForItemKey.has(attemptKey)) {
            return { outcome: 'ignored', reason: 'already_attempted' };
        }

        const currentDescriptor = this.deps.getCurrentStreamDescriptor();
        if (
            currentDescriptor?.protocol === 'hls' &&
            context.currentDecision?.transcodeRequest?.subtitleMode === 'burn' &&
            context.currentDecision.transcodeRequest.subtitleStreamId === trackId
        ) {
            return { outcome: 'ignored', reason: 'already_burned_in' };
        }

        return {
            context,
            attemptKey,
            recordAttemptBeforeReload,
        };
    }

    private _shouldRecordAutomaticBurnInAttempt(reason: string): boolean {
        return reason.startsWith('subtitle_extract_failed:');
    }

    private _executeBurnInSubtitleRecovery(
        trackId: string,
        prepared: PreparedBurnInSubtitleRecovery
    ): Promise<BurnInSubtitleRecoveryResult> {
        if (prepared.recordAttemptBeforeReload) {
            this._burnInAttemptedForItemKey.add(prepared.attemptKey);
        }

        return this._reloadController.executeReload({
            context: prepared.context,
            successOutcome: 'burned_in',
            startEvent: 'burnInReload.start',
            abortedEvent: 'burnInReload.aborted',
            failedEvent: 'burnInReload.failed',
            startData: ({ itemKey }) => ({
                trackId,
                itemKey,
            }),
            buildRequest: ({ itemKey, clampedOffset, player }) => {
                const activeAudioId = this._readPlayerState(player)?.activeAudioId ?? null;
                return {
                    itemKey,
                    startOffsetMs: clampedOffset,
                    directPlay: false,
                    subtitleStreamId: trackId,
                    subtitleMode: 'burn',
                    ...(activeAudioId ? { audioStreamId: activeAudioId } : {}),
                };
            },
            customizeDescriptor: (descriptor) => ({
                ...descriptor,
                preferredSubtitleTrackId: trackId,
            }),
            shouldResumeAfterReload: true,
            onSuccess: () => {
                this._burnInAttemptedForItemKey.add(prepared.attemptKey);
            },
        });
    }

    private _shouldHandleSubtitleDeactivation(_trackId: string, _reason: string): boolean {
        return subtitleModeAllowsBurnIn(this._readSubtitleMode());
    }

    private _isHandledIgnoredSubtitleRecovery(
        result: BurnInSubtitleRecoveryResult
    ): boolean {
        return result.outcome === 'ignored' && result.reason === 'already_burned_in';
    }

    private async _recoverSubtitleDeactivation(
        trackId: string,
        reason: string
    ): Promise<'handled' | 'failed'> {
        const prepared = this._prepareBurnInSubtitleRecovery(
            trackId,
            `subtitle_extract_failed:${reason}`
        );
        if ('outcome' in prepared) {
            return this._isHandledIgnoredSubtitleRecovery(prepared) ? 'handled' : 'failed';
        }

        this.deps.notifyToast?.('Subtitles failed to load. Trying burn-in…', 'info');
        const result = await this._executeBurnInSubtitleRecovery(trackId, prepared);
        return result.outcome === 'failed' ? 'failed' : 'handled';
    }
}
