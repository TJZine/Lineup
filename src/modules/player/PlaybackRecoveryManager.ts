/**
 * @fileoverview Manages stream recovery, subtitle resolution, and failure guards.
 * @module modules/player/PlaybackRecoveryManager
 * @version 1.0.0
 */

import { AppErrorCode, type AppError } from '../lifecycle';
import {
    mapPlexStreamErrorCodeToAppErrorCode,
    type IPlexStreamResolver,
    type StreamDecision,
    type StreamResolverError,
    type PlexStream,
} from '../plex/stream';
import type { IChannelScheduler, ScheduledProgram } from '../scheduler/scheduler';
import type { IVideoPlayer, StreamDescriptor } from './index';
import type { AudioTrack, SubtitleTrack } from './types';
import { TEXT_SUBTITLE_FORMATS } from './constants';
import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    isStoredTrue,
    safeLocalStorageGet,
} from '../../utils/storage';
import { getSubtitleMode, subtitleModeAllowsBurnIn, subtitleModeIsDirectOnly } from '../../shared/subtitle-mode';
import { redactSensitiveTokens } from '../../utils/redact';
import { summarizeErrorForLog } from '../../utils/errors';

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

    handleGlobalError: (error: AppError, context: string) => void;
}

type DisableBurnInSubtitlesResult =
    | { outcome: 'disabled' }
    | {
        outcome: 'ignored';
        reason:
        | 'recovery_in_progress'
        | 'missing_deps'
        | 'not_burn_in'
        | 'program_changed'
        | 'no_program';
    }
    | { outcome: 'failed' };

export class PlaybackRecoveryManager {
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

    constructor(private readonly deps: PlaybackRecoveryDeps) { }

    isStreamRecoveryInProgress(): boolean {
        return this._streamRecoveryInProgress;
    }

    private _preferForcedSubtitles(): boolean {
        try {
            return isStoredTrue(
                safeLocalStorageGet(LINEUP_STORAGE_KEYS.SUBTITLE_PREFER_FORCED)
            );
        } catch {
            return false;
        }
    }

    private _getCurrentItemKey(): string | null {
        const program = this.deps.getCurrentProgramForPlayback();
        if (!program) return null;
        const itemKey = program.item.ratingKey;
        return typeof itemKey === 'string' && itemKey.length > 0 ? itemKey : null;
    }

    private _getPreferredSubtitleLanguage(): string | null {
        try {
            const value = this.deps.getPreferredSubtitleLanguage();
            if (typeof value !== 'string') return null;
            const trimmed = value.trim();
            return trimmed.length > 0 ? trimmed : null;
        } catch {
            return null;
        }
    }

    private _getPlexPreferredSubtitleLanguage(): string | null {
        try {
            const getter = this.deps.getPlexPreferredSubtitleLanguage;
            if (!getter) return null;
            const value = getter();
            if (typeof value !== 'string') return null;
            const trimmed = value.trim();
            return trimmed.length > 0 ? trimmed : null;
        } catch {
            return null;
        }
    }

    private _resolvePreferredSubtitleId(
        _itemKey: string | null,
        tracks: SubtitleTrack[]
    ): string | null {
        const mode = getSubtitleMode();
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
            const message = ((): string => {
                if (error instanceof Error) {
                    return error.message;
                }
                if (
                    error &&
                    typeof error === 'object' &&
                    'message' in error &&
                    typeof (error as { message?: unknown }).message === 'string'
                ) {
                    return (error as { message: string }).message;
                }
                return String(error);
            })();
            this.deps.handleGlobalError(
                {
                    code: AppErrorCode.PLAYBACK_FAILED,
                    message: `Playback failed repeatedly (${context}): ${message}`,
                    recoverable: true,
                },
                'playback'
            );
            return;
        }

        // Single/rare failure: skip as before
        if (scheduler) {
            scheduler.skipToNext();
        }
    }

    tryHandleStreamResolverAuthError(error: unknown): boolean {
        if (!error || typeof error !== 'object') {
            return false;
        }
        const maybe = error as Partial<StreamResolverError>;
        if (typeof maybe.code !== 'string' || typeof maybe.message !== 'string') {
            return false;
        }
        const mapped = mapPlexStreamErrorCodeToAppErrorCode(maybe.code as StreamResolverError['code']);
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
        const subtitleMode = getSubtitleMode();
        const subtitlesEnabled = subtitleMode !== 'off';
        const subtitleTracks = subtitlesEnabled
            ? this._mapSubtitleTracks(decision.availableSubtitleStreams ?? [])
            : [];
        const itemKey = this._getCurrentItemKey();
        const preferredSubtitleTrackId = subtitleMode !== 'off'
            ? this._resolvePreferredSubtitleId(itemKey, subtitleTracks)
            : null;
        const subtitleContext: StreamDescriptor['subtitleContext'] | undefined = subtitlesEnabled
            ? {
                serverUri: this.deps.getServerUri(),
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
                onDeactivate: ({ trackId, reason }): boolean => {
                    const allowBurnIn = subtitleModeAllowsBurnIn(getSubtitleMode());
                    if (!allowBurnIn) {
                        return false;
                    }
                    // Best-effort: try burn-in subtitles when extraction fails.
                    this.deps.notifyToast?.(
                        'Subtitles failed to load. Trying burn-in…',
                        'info'
                    );
                    void this.attemptBurnInSubtitleForCurrentProgram(trackId, `subtitle_extract_failed:${reason}`)
                        .then((ok) => {
                            if (!ok) {
                                this.deps.notifyToast?.('Subtitles unavailable for this item', 'warning');
                            }
                        })
                        .catch(() => {
                            this.deps.notifyToast?.('Subtitles unavailable for this item', 'warning');
                        });
                    return true;
                },
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
        if (this._streamRecoveryInProgress) {
            return false;
        }
        const program = this.deps.getCurrentProgramForPlayback();
        const player = this.deps.getVideoPlayer();
        const resolver = this.deps.getStreamResolver();
        if (!program || !player || !resolver) {
            return false;
        }
        const programAtStart = program;
        const currentProtocol = this.deps.getCurrentStreamDescriptor()?.protocol ?? null;
        if (currentProtocol !== 'direct') {
            return false;
        }
        const itemKey = program.item.ratingKey;
        if (this._directFallbackAttemptedForItemKey.has(itemKey)) {
            return false;
        }

        this._directFallbackAttemptedForItemKey.add(itemKey);
        console.warn('[PlaybackRecovery] Transcode fallback start:', {
            reason: redactSensitiveTokens(reason),
            itemKey,
        });
        this._streamRecoveryInProgress = true;

        try {

            const clampedOffset = Math.max(0, Math.min(program.elapsedMs, program.item.durationMs));
            const decision: StreamDecision = await resolver.resolveStream({
                itemKey: itemKey,
                startOffsetMs: clampedOffset,
                directPlay: false,
            });
            if (this.deps.getCurrentProgramForPlayback() !== programAtStart) {
                console.warn('[PlaybackRecovery] Transcode fallback aborted:', {
                    outcome: 'program_changed',
                    itemKey,
                });
                return false;
            }
            this.deps.setCurrentStreamDecision(decision);

            const descriptor = this._buildStreamDescriptor(program, decision, clampedOffset);
            const preferredSubtitleTrackId = descriptor.preferredSubtitleTrackId;

            this.deps.setCurrentStreamDescriptor(descriptor);
            await player.loadStream(descriptor);
            if (preferredSubtitleTrackId) {
                await player.setSubtitleTrack(preferredSubtitleTrackId);
            }
            await player.play();
            this.resetPlaybackFailureGuard();
            return true;
        } catch (error) {
            console.error('[PlaybackRecovery] Transcode fallback failed:', summarizeErrorForLog(error));
            return false;
        } finally {
            this._streamRecoveryInProgress = false;
        }
    }

    async attemptBurnInSubtitleForCurrentProgram(trackId: string, reason: string): Promise<boolean> {
        if (this._streamRecoveryInProgress) {
            return false;
        }
        const program = this.deps.getCurrentProgramForPlayback();
        const player = this.deps.getVideoPlayer();
        const resolver = this.deps.getStreamResolver();
        if (!program || !player || !resolver) {
            return false;
        }

        const itemKey = program.item.ratingKey;
        const attemptKey = `${itemKey}::${trackId}`;
        if (this._burnInAttemptedForItemKey.has(attemptKey)) {
            return false;
        }

        const currentDescriptor = this.deps.getCurrentStreamDescriptor();
        const currentDecision = this.deps.getCurrentStreamDecision?.() ?? null;
        if (
            currentDescriptor?.protocol === 'hls' &&
            currentDecision?.transcodeRequest?.subtitleMode === 'burn' &&
            currentDecision.transcodeRequest.subtitleStreamId === trackId
        ) {
            return false;
        }

        console.warn('[PlaybackRecovery] Burn-in reload start:', {
            reason: redactSensitiveTokens(reason),
            trackId,
            itemKey,
        });
        this._streamRecoveryInProgress = true;

        try {

            const livePosition = ((): number | null => {
                try {
                    const value = player.getCurrentTimeMs();
                    return Number.isFinite(value) ? value : null;
                } catch {
                    return null;
                }
            })();
            const baseOffset = typeof livePosition === 'number' ? livePosition : program.elapsedMs;
            const clampedOffset = Math.max(0, Math.min(baseOffset, program.item.durationMs));
            const activeAudioId = player.getState()?.activeAudioId ?? null;
            const decision: StreamDecision = await resolver.resolveStream({
                itemKey,
                startOffsetMs: clampedOffset,
                directPlay: false,
                subtitleStreamId: trackId,
                subtitleMode: 'burn',
                ...(activeAudioId ? { audioStreamId: activeAudioId } : {}),
            });
            if (this.deps.getCurrentProgramForPlayback() !== program) {
                console.warn('[PlaybackRecovery] Burn-in reload aborted:', {
                    outcome: 'program_changed',
                    trackId,
                    itemKey,
                });
                return false;
            }
            this.deps.setCurrentStreamDecision(decision);

            const descriptor = this._buildStreamDescriptor(program, decision, clampedOffset);
            // Override preferred subtitle to the burn-in track that triggered this reload.
            const descriptorWithBurnIn = { ...descriptor, preferredSubtitleTrackId: trackId };
            this.deps.setCurrentStreamDescriptor(descriptorWithBurnIn);

            await player.loadStream(descriptorWithBurnIn);
            await player.play();
            this.resetPlaybackFailureGuard();
            this._burnInAttemptedForItemKey.add(attemptKey);
            return true;
        } catch (error) {
            console.error('[PlaybackRecovery] Burn-in reload failed:', summarizeErrorForLog(error));
            return false;
        } finally {
            this._streamRecoveryInProgress = false;
        }
    }

    async attemptDisableBurnInSubtitlesForCurrentProgram(
        reason: string
    ): Promise<DisableBurnInSubtitlesResult> {
        if (this._streamRecoveryInProgress) {
            return { outcome: 'ignored', reason: 'recovery_in_progress' };
        }
        const program = this.deps.getCurrentProgramForPlayback();
        const player = this.deps.getVideoPlayer();
        const resolver = this.deps.getStreamResolver();
        const currentDecision = this.deps.getCurrentStreamDecision?.() ?? null;
        if (!program) {
            return { outcome: 'ignored', reason: 'no_program' };
        }
        if (!player || !resolver || !currentDecision) {
            return { outcome: 'ignored', reason: 'missing_deps' };
        }

        const transcodeRequest = currentDecision.transcodeRequest ?? null;
        const isBurnIn = transcodeRequest?.subtitleMode === 'burn';
        if (!isBurnIn) {
            return { outcome: 'ignored', reason: 'not_burn_in' };
        }

        const itemKey = program.item.ratingKey;
        const burnedInTrackId = transcodeRequest?.subtitleStreamId ?? null;
        console.warn('[PlaybackRecovery] Disable burn-in start:', {
            reason: redactSensitiveTokens(reason),
            itemKey,
            burnedInTrackId,
        });

        this._streamRecoveryInProgress = true;

        try {

            // Best-effort: stop the current transcode session before switching back to direct play.
            if (currentDecision.isTranscoding && currentDecision.sessionId) {
                void resolver.stopTranscodeSession(currentDecision.sessionId);
            }

            const livePosition = ((): number | null => {
                try {
                    const value = player.getCurrentTimeMs();
                    return Number.isFinite(value) ? value : null;
                } catch {
                    return null;
                }
            })();
            const baseOffset = typeof livePosition === 'number' ? livePosition : program.elapsedMs;
            const clampedOffset = Math.max(0, Math.min(baseOffset, program.item.durationMs));
            const activeAudioId = player.getState()?.activeAudioId ?? null;

            const decision: StreamDecision = await resolver.resolveStream({
                itemKey,
                startOffsetMs: clampedOffset,
                directPlay: true,
                ...(activeAudioId ? { audioStreamId: activeAudioId } : {}),
            });
            if (this.deps.getCurrentProgramForPlayback() !== program) {
                console.warn('[PlaybackRecovery] Disable burn-in aborted:', {
                    outcome: 'program_changed',
                    itemKey,
                });
                return { outcome: 'ignored', reason: 'program_changed' };
            }
            this.deps.setCurrentStreamDecision(decision);

            const descriptor = this._buildStreamDescriptor(program, decision, clampedOffset);
            // Ensure subtitles are off after returning to direct play.
            const descriptorWithSubtitlesOff = { ...descriptor, preferredSubtitleTrackId: null };
            this.deps.setCurrentStreamDescriptor(descriptorWithSubtitlesOff);

            await player.loadStream(descriptorWithSubtitlesOff);
            await player.play();
            this.resetPlaybackFailureGuard();

            if (typeof burnedInTrackId === 'string' && burnedInTrackId.length > 0) {
                this._burnInAttemptedForItemKey.delete(`${itemKey}::${burnedInTrackId}`);
            }

            return { outcome: 'disabled' };
        } catch (error) {
            console.error('[PlaybackRecovery] Disable burn-in reload failed:', summarizeErrorForLog(error));
            return { outcome: 'failed' };
        } finally {
            this._streamRecoveryInProgress = false;
        }
    }
}
