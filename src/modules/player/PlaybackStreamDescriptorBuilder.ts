import { isTextSubtitleFormat } from '../../shared/subtitle-formats';
import { subtitleModeIsDirectOnly, type SubtitleMode } from '../../shared/subtitle-mode';
import type { PlexStream, StreamDecision } from '../plex/stream';
import type { ScheduledProgram } from '../scheduler/scheduler';
import type { AudioTrack, StreamDescriptor, SubtitleTrack } from './types';

type SubtitleDeactivationArgs = {
    trackId: string;
    reason: string;
};

interface PlaybackStreamDescriptorBuilderDeps {
    buildPlexResourceUrl: (pathOrUrl: string) => string | null;
    getMimeType: (decision: StreamDecision) => string;
    getAuthHeaders: () => Record<string, string>;
    getServerUri: () => string | null;
    getPreferredSubtitleLanguage: () => string | null;
    getPlexPreferredSubtitleLanguage?: () => string | null;
    notifySubtitleUnavailable: () => void;
    readSubtitleMode: () => SubtitleMode;
    preferForcedSubtitles: () => boolean;
    shouldHandleSubtitleDeactivation: (args: SubtitleDeactivationArgs) => boolean;
    recoverSubtitleDeactivation: (
        args: SubtitleDeactivationArgs
    ) => Promise<'handled' | 'failed'>;
}

export class PlaybackStreamDescriptorBuilder {
    constructor(private readonly deps: PlaybackStreamDescriptorBuilderDeps) {}

    build(
        program: ScheduledProgram,
        decision: StreamDecision,
        startOffsetMs: number
    ): StreamDescriptor {
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
        const selectedAudioId = decision.selectedAudioStream?.id;
        if (selectedAudioId && audioTracks.some((track) => track.id === selectedAudioId)) {
            for (const track of audioTracks) {
                track.default = track.id === selectedAudioId;
            }
        }

        const subtitleMode = this.deps.readSubtitleMode();
        const subtitlesEnabled = subtitleMode !== 'off';
        const subtitleTracks = subtitlesEnabled
            ? this._mapSubtitleTracks(decision.availableSubtitleStreams ?? [])
            : [];
        const resolvedSubtitleBaseUrl = decision.resolvedBaseUrl ?? ((): string | undefined => {
            try {
                return new URL(decision.playbackUrl).origin;
            } catch {
                return undefined;
            }
        })();
        const preferredSubtitleTrackId = subtitleMode !== 'off'
            ? this._resolvePreferredSubtitleId(subtitleTracks)
            : null;
        const confirmedBurnedInSubtitleTrackId = getConfirmedBurnedInSubtitleTrackId(decision);
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
                confirmedBurnedInSubtitleTrackId,
                onUnavailable: this.deps.notifySubtitleUnavailable,
                onDeactivate: ({ trackId, reason }): boolean =>
                    this.deps.shouldHandleSubtitleDeactivation({ trackId, reason }),
                onDeactivateRecovery: ({ trackId, reason }): Promise<'handled' | 'failed'> =>
                    this.deps.recoverSubtitleDeactivation({ trackId, reason }),
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

    private _resolvePreferredSubtitleId(tracks: SubtitleTrack[]): string | null {
        const mode = this.deps.readSubtitleMode();
        if (mode === 'off') return null;

        const externalOnly = subtitleModeIsDirectOnly(mode);
        const eligible = tracks.filter((track) => {
            if (!track.isTextCandidate || !(track.fetchableViaKey || Boolean(track.id))) {
                return false;
            }
            if (externalOnly && !track.fetchableViaKey) {
                return false;
            }
            return true;
        });
        if (eligible.length === 0) {
            return null;
        }

        const appPreferredLanguage = this._normalizeLanguage(
            this.deps.getPreferredSubtitleLanguage()
        );
        if (appPreferredLanguage) {
            const preferred = this._findSubtitleByLanguage(eligible, appPreferredLanguage);
            if (preferred) return preferred.id;
        } else {
            const plexPreferredLanguage = this._normalizeLanguage(
                this.deps.getPlexPreferredSubtitleLanguage?.() ?? null
            );
            if (plexPreferredLanguage) {
                const preferred = this._findSubtitleByLanguage(eligible, plexPreferredLanguage);
                if (preferred) return preferred.id;
            }
        }

        const defaultLanguage =
            eligible.find((track) => track.default)?.languageCode ||
            eligible.find((track) => track.default)?.language ||
            null;
        if (defaultLanguage) {
            const preferred = this._findSubtitleByLanguage(eligible, defaultLanguage);
            if (preferred) return preferred.id;
        }

        return null;
    }

    private _findSubtitleByLanguage(
        tracks: SubtitleTrack[],
        language: string
    ): SubtitleTrack | null {
        const normalized = language.trim().toLowerCase();
        const matches = tracks.filter((track) => {
            return (
                track.languageCode.toLowerCase() === normalized ||
                track.language.toLowerCase() === normalized
            );
        });
        if (matches.length === 0) return null;

        if (this.deps.preferForcedSubtitles()) {
            const forced = matches.find((track) => track.forced);
            return forced ?? matches[0] ?? null;
        }

        const nonForced = matches.find((track) => !track.forced);
        return nonForced ?? matches[0] ?? null;
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
            const isTextCandidate = isTextSubtitleFormat(format) || isTextSubtitleFormat(codec);
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

    private _normalizeLanguage(value: string | null): string | null {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }
}

function getConfirmedBurnedInSubtitleTrackId(decision: StreamDecision): string | null {
    const burn = decision.subtitleBurnIn;
    if (!burn?.confirmed || !burn.subtitleStreamId) {
        return null;
    }
    return burn.subtitleStreamId;
}
