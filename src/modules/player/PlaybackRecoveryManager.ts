/**
 * @fileoverview Manages stream recovery, subtitle resolution, and failure guards.
 * @module modules/player/PlaybackRecoveryManager
 * @version 1.0.0
 */

import {
    AppErrorCode,
    getAppErrorCode,
    getMappedAppErrorCode,
    type AppError,
} from '../../types/app-errors';
import {
    mapPlexStreamErrorCodeToAppErrorCode,
    type IPlexStreamResolver,
    type StreamDecision,
    type StreamRequest,
    type StreamResolverError,
    type PlexStream,
} from '../plex/stream';
import type { IChannelScheduler, ScheduledProgram } from '../scheduler/scheduler';
import type { IVideoPlayer, StreamDescriptor } from './index';
import type { AudioTrack, SubtitleTrack } from './types';
import { TEXT_SUBTITLE_FORMATS } from '../../shared/subtitle-formats';
import {
    subtitleModeAllowsBurnIn,
    subtitleModeIsDirectOnly,
    type SubtitleMode,
} from '../../shared/subtitle-mode';
import type { AppendIssueDiagnostic } from '../debug/IssueDiagnosticsStore';
import { SubtitlePreferencesStore } from '../settings/SubtitlePreferencesStore';
import { redactSensitiveTokens } from '../../utils/redact';
import { summarizeErrorForLog } from '../../utils/errors';

const QA_003B_ISSUE_ID = 'QA-003b';

export interface PlaybackRecoveryDeps {
    getVideoPlayer: () => IVideoPlayer | null;
    getStreamResolver: () => IPlexStreamResolver | null;
    getScheduler: () => IChannelScheduler | null;

    getCurrentProgramForPlayback: () => ScheduledProgram | null;
    getCurrentStreamDescriptor: () => StreamDescriptor | null;
    getCurrentStreamDecision?: () => StreamDecision | null;

    setCurrentStreamDecision: (d: StreamDecision) => void;
    setCurrentStreamDescriptor: (d: StreamDescriptor) => void;

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

type RecoveryReloadIgnoredReason =
    | 'recovery_in_progress'
    | 'missing_deps'
    | 'no_program'
    | 'program_changed';

type RecoveryAttemptResult<Success extends string, IgnoredReason extends string> =
    | { outcome: Success }
    | { outcome: 'ignored'; reason: IgnoredReason }
    | { outcome: 'failed' };

type RecoveryReloadContext = {
    program: ScheduledProgram;
    player: IVideoPlayer;
    resolver: IPlexStreamResolver;
    itemKey: string;
    safeReason: string;
    clampedOffset: number;
    currentDecision: StreamDecision | null;
};

type RecoveryDescriptorContext = RecoveryReloadContext & {
    decision: StreamDecision;
};

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
    // Playback fast-fail guard: prevents tight skip loops when all items fail to play.
    private _playbackFailureWindowStartMs: number = 0;
    private _playbackFailureCount: number = 0;
    private _playbackFailureTripped: boolean = false;
    private _playbackFailureWindowMs: number = 2000;
    private _playbackFailureTripCount: number = 3;

    // Prevent runaway recovery loops
    private _directFallbackAttemptedForItemKey: Set<string> = new Set();
    private _burnInAttemptedForItemKey: Set<string> = new Set();
    private _streamRecoveryInProgress: boolean = false;

    constructor(private readonly deps: PlaybackRecoveryDeps) {
        this._subtitlePreferencesStore = deps.subtitlePreferencesStore ?? new SubtitlePreferencesStore();
    }

    isStreamRecoveryInProgress(): boolean {
        return this._streamRecoveryInProgress;
    }

    private _preferForcedSubtitles(): boolean {
        return this._subtitlePreferencesStore.readSubtitlePreferForced(false);
    }

    private _readSubtitleMode(): SubtitleMode {
        return this._subtitlePreferencesStore.readSubtitleMode('full');
    }

    private _getCurrentItemKey(): string | null {
        const program = this.deps.getCurrentProgramForPlayback();
        if (!program) return null;
        const itemKey = program.item.ratingKey;
        return typeof itemKey === 'string' && itemKey.length > 0 ? itemKey : null;
    }

    private _getPreferredSubtitleLanguage(): string | null {
        const value = this.deps.getPreferredSubtitleLanguage();
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }

    private _getPlexPreferredSubtitleLanguage(): string | null {
        const getter = this.deps.getPlexPreferredSubtitleLanguage;
        if (!getter) return null;
        const value = getter();
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }

    private _logRecoveryWarn(event: string, data: Record<string, unknown>): void {
        console.warn(`[PlaybackRecovery] ${event}`, data);
    }

    private _logRecoveryError(event: string, data: Record<string, unknown>): void {
        console.error(`[PlaybackRecovery] ${event}`, data);
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

    private _readPlayerState(player: IVideoPlayer): ReturnType<IVideoPlayer['getState']> | null {
        return player.getState();
    }

    private _getRecoveryReloadOffset(program: ScheduledProgram, player: IVideoPlayer): number {
        const livePosition = player.getCurrentTimeMs();
        const baseOffset = Number.isFinite(livePosition)
            ? livePosition
            : Number.isFinite(program.elapsedMs)
                ? program.elapsedMs
                : 0;
        return Math.max(0, Math.min(baseOffset, program.item.durationMs));
    }

    private _prepareRecoveryReload(
        reason: string
    ): RecoveryReloadContext | { outcome: 'ignored'; reason: RecoveryReloadIgnoredReason } {
        if (this._streamRecoveryInProgress) {
            return { outcome: 'ignored', reason: 'recovery_in_progress' };
        }

        const program = this.deps.getCurrentProgramForPlayback();
        if (!program) {
            return { outcome: 'ignored', reason: 'no_program' };
        }

        const player = this.deps.getVideoPlayer();
        const resolver = this.deps.getStreamResolver();
        if (!player || !resolver) {
            return { outcome: 'ignored', reason: 'missing_deps' };
        }

        return {
            program,
            player,
            resolver,
            itemKey: program.item.ratingKey,
            safeReason: redactSensitiveTokens(reason),
            clampedOffset: this._getRecoveryReloadOffset(program, player),
            currentDecision: this.deps.getCurrentStreamDecision?.() ?? null,
        };
    }

    private async _executeRecoveryReload<TSuccess extends string>(config: {
        context: RecoveryReloadContext;
        successOutcome: TSuccess;
        startEvent: string;
        abortedEvent: string;
        failedEvent: string;
        startData?: (context: RecoveryReloadContext) => Record<string, unknown>;
        failureData?: (context: RecoveryReloadContext) => Record<string, unknown>;
        beforeResolve?: (context: RecoveryReloadContext) => void | Promise<void>;
        buildRequest: (context: RecoveryReloadContext) => StreamRequest;
        customizeDescriptor?: (
            descriptor: StreamDescriptor,
            context: RecoveryDescriptorContext
        ) => StreamDescriptor;
        afterLoad?: (
            descriptor: StreamDescriptor,
            context: RecoveryDescriptorContext
        ) => void | Promise<void>;
        shouldResumeAfterReload?: boolean;
        onSuccess?: (context: RecoveryDescriptorContext) => void;
    }): Promise<RecoveryAttemptResult<TSuccess, 'program_changed'>> {
        const { context } = config;
        this._logRecoveryWarn(config.startEvent, {
            reason: context.safeReason,
            ...(config.startData?.(context) ?? {}),
        });
        this._streamRecoveryInProgress = true;

        try {
            await config.beforeResolve?.(context);

            const decision = await context.resolver.resolveStream(config.buildRequest(context));
            if (this.deps.getCurrentProgramForPlayback() !== context.program) {
                this._logRecoveryWarn(config.abortedEvent, {
                    reason: context.safeReason,
                    outcome: 'program_changed',
                    ...(config.startData?.(context) ?? {}),
                });
                return { outcome: 'ignored', reason: 'program_changed' };
            }

            this.deps.setCurrentStreamDecision(decision);

            let descriptor = this._buildStreamDescriptor(
                context.program,
                decision,
                context.clampedOffset
            );
            const descriptorContext: RecoveryDescriptorContext = {
                ...context,
                decision,
            };
            if (config.customizeDescriptor) {
                descriptor = config.customizeDescriptor(descriptor, descriptorContext);
            }
            this.deps.setCurrentStreamDescriptor(descriptor);

            await context.player.loadStream(descriptor);
            await config.afterLoad?.(descriptor, descriptorContext);
            if (config.shouldResumeAfterReload) {
                await context.player.play();
            }
            this.resetPlaybackFailureGuard();
            config.onSuccess?.(descriptorContext);
            return { outcome: config.successOutcome };
        } catch (error) {
            this._logRecoveryError(config.failedEvent, {
                reason: context.safeReason,
                ...(config.failureData?.(context) ?? config.startData?.(context) ?? {}),
                safeError: summarizeErrorForLog(error),
            });
            return { outcome: 'failed' };
        } finally {
            this._streamRecoveryInProgress = false;
        }
    }

    private _resolvePreferredSubtitleId(
        _itemKey: string | null,
        tracks: SubtitleTrack[]
    ): string | null {
        const mode = this._readSubtitleMode();
        if (mode === 'off') return null;
        const externalOnly = subtitleModeIsDirectOnly(mode);
        const eligible = tracks.filter((t) => {
            if (!t.isTextCandidate || !(t.fetchableViaKey || Boolean(t.id))) {
                return false;
            }
            if (externalOnly && !t.fetchableViaKey) {
                return false;
            }
            return true;
        });
        if (eligible.length === 0) {
            return null;
        }

        // Lineup does not persist a specific subtitle track choice across items/channels.
        // Auto-selection is derived only from language preferences (app override, Plex user preference, or defaults).
        const appPreferredLanguage = this._getPreferredSubtitleLanguage();
        if (appPreferredLanguage) {
            const preferred = this._findSubtitleByLanguage(eligible, appPreferredLanguage);
            if (preferred) return preferred.id;
        } else {
            const plexPreferredLanguage = this._getPlexPreferredSubtitleLanguage();
            if (plexPreferredLanguage) {
                const preferred = this._findSubtitleByLanguage(eligible, plexPreferredLanguage);
                if (preferred) return preferred.id;
            }
        }

        const defaultLanguage =
            eligible.find((t) => t.default)?.languageCode ||
            eligible.find((t) => t.default)?.language ||
            null;
        if (defaultLanguage) {
            const preferred = this._findSubtitleByLanguage(eligible, defaultLanguage);
            if (preferred) return preferred.id;
        }

        return null;
    }

    private _findSubtitleByLanguage(tracks: SubtitleTrack[], language: string): SubtitleTrack | null {
        const normalized = language.trim().toLowerCase();
        const matches = tracks.filter((t) => {
            return (
                t.languageCode.toLowerCase() === normalized ||
                t.language.toLowerCase() === normalized
            );
        });
        if (matches.length === 0) return null;

        // Use setting to determine forced/full preference
        const preferForced = this._preferForcedSubtitles();
        if (preferForced) {
            const forced = matches.find((t) => t.forced);
            return forced ?? matches[0] ?? null;
        } else {
            const nonForced = matches.find((t) => !t.forced);
            return nonForced ?? matches[0] ?? null;
        }
    }

    private _mapAudioTracks(streams: PlexStream[]): AudioTrack[] {
        return streams.map((stream, index) => ({
            id: stream.id,
            title: stream.title ?? stream.language ?? 'Unknown',
            languageCode: (stream.languageCode ?? '').toLowerCase(),
            language: stream.language ?? 'Unknown',
            codec: (stream.codec ?? 'unknown').toLowerCase(),
            channels: typeof stream.channels === 'number' ? stream.channels : 0,
            index,
            default: stream.default ?? false,
        }));
    }

    private _mapSubtitleTracks(streams: PlexStream[]): SubtitleTrack[] {
        const baseTracks = streams.map((stream) => {
            const codec = (stream.codec ?? stream.format ?? 'unknown').toLowerCase();
            const format = (stream.format ?? stream.codec ?? 'unknown').toLowerCase();
            const languageCode = (stream.languageCode ?? '').toLowerCase();
            const language = (stream.language ?? languageCode) || 'Unknown';
            const isTextCandidate = TEXT_SUBTITLE_FORMATS.includes(codec);
            const fetchableViaKey = typeof stream.key === 'string' && stream.key.length > 0;
            const codecLabel = codec ? codec.toUpperCase() : 'Unknown';
            const languageLabel = language || 'Unknown';
            const key = typeof stream.key === 'string' && stream.key.length > 0 ? stream.key : undefined;
            return {
                id: stream.id,
                label: `${languageLabel} (${codecLabel})`,
                languageCode,
                language: languageLabel,
                codec,
                format,
                ...(key ? { key } : {}),
                forced: stream.forced ?? false,
                default: stream.default ?? false,
                isTextCandidate,
                fetchableViaKey,
                title: stream.title ?? '',
            };
        });

        const labelCounts = baseTracks.reduce<Record<string, number>>((acc, track) => {
            acc[track.label] = (acc[track.label] ?? 0) + 1;
            return acc;
        }, {});

        return baseTracks.map((track) => {
            let label = track.label;
            if ((labelCounts[label] ?? 0) > 1 && track.title) {
                label = `${label} • ${track.title}`;
            }
            if (track.forced) {
                label = `${label} • Forced`;
            }
            return {
                id: track.id,
                label,
                languageCode: track.languageCode,
                language: track.language,
                codec: track.codec,
                format: track.format,
                ...(track.key ? { key: track.key } : {}),
                forced: track.forced,
                default: track.default,
                isTextCandidate: track.isTextCandidate,
                fetchableViaKey: track.fetchableViaKey,
            };
        });
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
        const mapped = getMappedAppErrorCode(maybe.code, mapPlexStreamErrorCodeToAppErrorCode);
        if (
            mapped === AppErrorCode.AUTH_REQUIRED ||
            mapped === AppErrorCode.AUTH_EXPIRED ||
            mapped === AppErrorCode.AUTH_INVALID
        ) {
            this.deps.handleGlobalError(
                {
                    code: mapped,
                    message: maybe.message,
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

        return this._buildStreamDescriptor(program, decision, clampedOffset);
    }

    async attemptAudioTrackReloadForCurrentProgram(
        trackId: string,
        reason: string
    ): Promise<AudioTrackReloadResult> {
        const context = this._prepareRecoveryReload(reason);
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

        return this._executeRecoveryReload({
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
                message: maybe.message,
                recoverable: false,
            },
            'plex-stream'
        );
        return true;
    }

    /**
     * Build a StreamDescriptor from a StreamDecision and ScheduledProgram.
     * Shared helper to reduce duplication between normal playback and transcode fallback.
     */
    private _buildStreamDescriptor(
        program: ScheduledProgram,
        decision: StreamDecision,
        startOffsetMs: number
    ): StreamDescriptor {
        // Build mediaMetadata carefully for exactOptionalPropertyTypes
        const metadata: StreamDescriptor['mediaMetadata'] = {
            title: program.item.title,
            durationMs: program.item.durationMs,
        };
        if (program.item.type === 'episode' && program.item.fullTitle) {
            metadata.subtitle = program.item.fullTitle;
        }
        if (program.item.thumb) {
            const thumbUrl = this.deps.buildPlexResourceUrl(program.item.thumb);
            if (thumbUrl) {
                metadata.thumb = thumbUrl;
            }
        }
        if (program.item.year !== undefined) {
            metadata.year = program.item.year;
        }

        const audioTracks = this._mapAudioTracks(decision.availableAudioStreams ?? []);
        // Align default audio flag with the resolver's selected stream. Plex can return
        // stale stream.default values during fallback (e.g. TrueHD -> AAC), and downstream
        // track selection uses the default flag to determine active audio.
        const selectedAudioId = decision.selectedAudioStream?.id;
        if (selectedAudioId && audioTracks.some((track) => track.id === selectedAudioId)) {
            for (const track of audioTracks) {
                track.default = track.id === selectedAudioId;
            }
        }
        const subtitleMode = this._readSubtitleMode();
        const subtitlesEnabled = subtitleMode !== 'off';
        const subtitleTracks = subtitlesEnabled
            ? this._mapSubtitleTracks(decision.availableSubtitleStreams ?? [])
            : [];
        const itemKey = this._getCurrentItemKey();
        const resolvedSubtitleBaseUrl = decision.resolvedBaseUrl ?? ((): string | undefined => {
            try {
                return new URL(decision.playbackUrl).origin;
            } catch {
                return undefined;
            }
        })();
        const preferredSubtitleTrackId = subtitleMode !== 'off'
            ? this._resolvePreferredSubtitleId(itemKey, subtitleTracks)
            : null;
        const subtitleContext: StreamDescriptor['subtitleContext'] | undefined = subtitlesEnabled
            ? {
                serverUri: this.deps.getServerUri(),
                ...(resolvedSubtitleBaseUrl ? { resolvedBaseUrl: resolvedSubtitleBaseUrl } : {}),
                authHeaders: this.deps.getAuthHeaders(),
                itemKey: program.item.ratingKey,
                mediaIndex: decision.mediaIndex,
                partIndex: decision.partIndex,
                partKey: decision.partKey,
                sessionId: decision.sessionId,
                burnedInSubtitleTrackId:
                    decision.transcodeRequest?.subtitleMode === 'burn'
                        ? (decision.transcodeRequest.subtitleStreamId ?? null)
                        : null,
                onUnavailable: this.deps.notifySubtitleUnavailable,
                onDeactivate: (): boolean => this._shouldHandleSubtitleDeactivation(),
                onDeactivateRecovery: ({ trackId, reason }): Promise<'handled' | 'failed'> =>
                    this._recoverSubtitleDeactivation(trackId, reason),
            }
            : undefined;

        return {
            url: decision.playbackUrl,
            protocol: decision.protocol === 'hls' ? 'hls' : 'direct',
            mimeType: this.deps.getMimeType(decision),
            startPositionMs: startOffsetMs,
            mediaMetadata: metadata,
            subtitleTracks,
            audioTracks,
            ...(preferredSubtitleTrackId !== undefined ? { preferredSubtitleTrackId } : {}),
            ...(subtitleContext ? { subtitleContext } : {}),
            durationMs: program.item.durationMs,
            isLive: false,
        };
    }

    async attemptTranscodeFallbackForCurrentProgram(reason: string): Promise<boolean> {
        const context = this._prepareRecoveryReload(reason);
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

        const result = await this._executeRecoveryReload({
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
        const context = this._prepareRecoveryReload(reason);
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
        return this._executeRecoveryReload({
            context,
            successOutcome: 'disabled',
            startEvent: 'disableBurnIn.start',
            abortedEvent: 'disableBurnIn.aborted',
            failedEvent: 'disableBurnIn.failed',
            startData: ({ itemKey }) => ({
                itemKey,
                burnedInTrackId,
            }),
            beforeResolve: () => {
                if (currentDecision.isTranscoding && currentDecision.sessionId) {
                    return context.resolver.stopTranscodeSession(currentDecision.sessionId);
                }
                return undefined;
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
        const context = this._prepareRecoveryReload(reason);
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

        return this._executeRecoveryReload({
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

    private _shouldHandleSubtitleDeactivation(): boolean {
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
