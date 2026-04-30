import { redactSensitiveTokens } from '../../../utils/redact';
import { isTextSubtitleFormat } from './constants';
import type { PlexStreamSubtitleDebugLogPort } from './interfaces';
import { probeSubtitleStreamDelivery } from './SubtitleStreamProbe';
import type { PlexStream } from './types';

export interface SubtitleStreamDebugProbeCoordinatorDeps {
    getServerUri: () => string | null;
    getAuthHeaders: () => Record<string, string>;
    subtitleDebugLogPort: PlexStreamSubtitleDebugLogPort;
}

export interface SubtitleStreamDebugProbeScheduleInput {
    itemKey: string;
    selectedSubtitleStream: PlexStream | null;
    availableSubtitleStreams: PlexStream[];
}

export class SubtitleStreamDebugProbeCoordinator {
    private readonly _deps: SubtitleStreamDebugProbeCoordinatorDeps;

    constructor(deps: SubtitleStreamDebugProbeCoordinatorDeps) {
        this._deps = deps;
    }

    scheduleDebugProbes(input: SubtitleStreamDebugProbeScheduleInput): void {
        if (!this._deps.subtitleDebugLogPort.isEnabled()) {
            return;
        }

        this._logDiscoverySummary(input);

        for (const stream of this._selectProbeCandidates(input.availableSubtitleStreams)) {
            void probeSubtitleStreamDelivery(
                {
                    itemKey: input.itemKey,
                    subtitleStreamId: stream.id,
                    ...(typeof stream.key === 'string' ? { subtitleStreamKey: stream.key } : {}),
                    codec: stream.codec,
                    ...(typeof stream.language === 'string' ? { language: stream.language } : {}),
                },
                {
                    serverUri: this._deps.getServerUri(),
                    getAuthHeaders: this._deps.getAuthHeaders,
                    logDebug: this._logDebug,
                }
            );
        }
    }

    private _logDiscoverySummary(input: SubtitleStreamDebugProbeScheduleInput): void {
        const codecCounts = input.availableSubtitleStreams.reduce<Record<string, number>>(
            (acc, stream) => {
                const codec = (stream.codec ?? stream.format ?? 'unknown').toLowerCase();
                acc[codec] = (acc[codec] ?? 0) + 1;
                return acc;
            },
            {}
        );
        const withKeyCount = input.availableSubtitleStreams.filter(hasSubtitleStreamKey).length;

        this._logDebug('subtitle_tracks_discovered', {
            count: input.availableSubtitleStreams.length,
            codecs: codecCounts,
            withKeyCount,
            withoutKeyCount: Math.max(0, input.availableSubtitleStreams.length - withKeyCount),
        });
        this._logDebug('subtitle_streams_discovered', {
            itemKey: input.itemKey,
            subtitlesCount: input.availableSubtitleStreams.length,
            subtitleStreams: input.availableSubtitleStreams.map((stream) => ({
                id: stream.id,
                codec: stream.codec,
                format: stream.format,
                language: stream.language,
                languageCode: stream.languageCode,
                title: stream.title,
                default: stream.default,
                forced: stream.forced,
                selected: input.selectedSubtitleStream?.id === stream.id,
                isTextCandidate: isTextSubtitleCandidate(stream),
                fetchableViaKey: hasSubtitleStreamKey(stream),
                key: typeof stream.key === 'string' ? redactSensitiveTokens(stream.key) : null,
            })),
        });
    }

    private _selectProbeCandidates(availableSubtitleStreams: PlexStream[]): PlexStream[] {
        const candidates = availableSubtitleStreams.filter(isTextSubtitleCandidate);
        if (candidates.length === 0) {
            return [];
        }

        const withKey = candidates.filter(hasSubtitleStreamKey);
        const withoutKey = candidates.filter((stream) => !hasSubtitleStreamKey(stream));
        const toProbe: PlexStream[] = [];

        if (withKey.length > 0) {
            toProbe.push(pickPreferredSubtitleStream(withKey));
        }
        if (withoutKey.length > 0 && toProbe.length < 2) {
            toProbe.push(pickPreferredSubtitleStream(withoutKey));
        }
        while (toProbe.length < 2) {
            const next = candidates.find(
                (stream) => !toProbe.some((probe) => probe.id === stream.id)
            );
            if (!next) {
                break;
            }
            toProbe.push(next);
        }

        return toProbe;
    }

    private readonly _logDebug = (event: string, context: Record<string, unknown>): void => {
        this._deps.subtitleDebugLogPort.log(event, context);
    };
}

function isTextSubtitleCandidate(stream: PlexStream): boolean {
    return isTextSubtitleFormat(stream.codec) || isTextSubtitleFormat(stream.format);
}

function hasSubtitleStreamKey(stream: PlexStream): boolean {
    return typeof stream.key === 'string' && stream.key.length > 0;
}

function pickPreferredSubtitleStream(streams: PlexStream[]): PlexStream {
    const forced = streams.find((stream) => stream.forced);
    if (forced) {
        return forced;
    }

    const english = streams.find(
        (stream) =>
            (stream.language ?? '').toLowerCase() === 'english' ||
            (stream.languageCode ?? '').toLowerCase() === 'en'
    );
    if (english) {
        return english;
    }

    return streams[0]!;
}
