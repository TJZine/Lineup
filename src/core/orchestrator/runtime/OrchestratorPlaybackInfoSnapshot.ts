import type { StreamDescriptor } from '../../../modules/player';
import type { StreamDecision } from '../../../modules/plex/stream';
import type { ChannelConfig } from '../../../modules/scheduler/channel-manager';
import type { ScheduledProgram } from '../../../modules/scheduler/scheduler';
import type { OrchestratorPlaybackStateAccessors } from './OrchestratorPlaybackStateAccessors';

export interface PlaybackInfoSnapshot {
    channel: { id: string; number: number; name: string } | null;
    program:
    | {
        itemKey: string;
        title: string;
        fullTitle: string;
        type: string;
        scheduledStartTime: number;
        scheduledEndTime: number;
        elapsedMs: number;
        remainingMs: number;
    }
    | null;
    stream:
    | {
        protocol: StreamDescriptor['protocol'];
        mimeType: string;
        isDirectPlay: boolean;
        isTranscoding: boolean;
        container: string;
        videoCodec: string;
        audioCodec: string;
        subtitleDelivery: StreamDecision['subtitleDelivery'];
        bitrate: number;
        width: number;
        height: number;
        sessionId: string;
        selectedAudio:
        | {
            id: string;
            codec: string | null | undefined;
            channels?: number;
            language?: string;
            title?: string;
            default?: boolean;
        }
        | null;
        selectedSubtitle:
        | {
            id: string;
            codec: string | null | undefined;
            language?: string;
            title?: string;
            format?: string;
            default?: boolean;
        }
        | null;
        directPlay?: StreamDecision['directPlay'];
        audioFallback?: StreamDecision['audioFallback'];
        source?: StreamDecision['source'];
        transcodeRequest?: StreamDecision['transcodeRequest'];
        serverDecision?: StreamDecision['serverDecision'];
    }
    | null;
}

export interface OrchestratorPlaybackInfoSnapshotAccessors {
    playback: Pick<
        OrchestratorPlaybackStateAccessors,
        'getCurrentProgramForPlayback' | 'getCurrentStreamDescriptor' | 'getCurrentStreamDecision'
    >;
    getCurrentChannel: () => Pick<ChannelConfig, 'id' | 'number' | 'name'> | null;
}

type PlaybackInfoStreamSnapshot = NonNullable<PlaybackInfoSnapshot['stream']>;
type SelectedAudioSnapshot = PlaybackInfoStreamSnapshot['selectedAudio'];
type SelectedSubtitleSnapshot = PlaybackInfoStreamSnapshot['selectedSubtitle'];

export function createPlaybackInfoSnapshot(
    accessors: OrchestratorPlaybackInfoSnapshotAccessors
): PlaybackInfoSnapshot {
    const channel = accessors.getCurrentChannel();
    const program = accessors.playback.getCurrentProgramForPlayback();
    const decision = accessors.playback.getCurrentStreamDecision();
    const descriptor = accessors.playback.getCurrentStreamDescriptor();

    return {
        channel: channel ? { id: channel.id, number: channel.number, name: channel.name } : null,
        program: mapScheduledProgram(program),
        stream: decision && descriptor ? mapStreamSnapshot(decision, descriptor) : null,
    };
}

function mapScheduledProgram(
    program: ScheduledProgram | null
): PlaybackInfoSnapshot['program'] {
    if (!program) {
        return null;
    }

    return {
        itemKey: program.item.ratingKey,
        title: program.item.title,
        fullTitle: program.item.fullTitle,
        type: program.item.type,
        scheduledStartTime: program.scheduledStartTime,
        scheduledEndTime: program.scheduledEndTime,
        elapsedMs: program.elapsedMs,
        remainingMs: program.remainingMs,
    };
}

function mapStreamSnapshot(
    decision: StreamDecision,
    descriptor: StreamDescriptor
): PlaybackInfoStreamSnapshot {
    return {
        protocol: descriptor.protocol,
        mimeType: descriptor.mimeType,
        isDirectPlay: decision.isDirectPlay,
        isTranscoding: decision.isTranscoding,
        container: decision.container,
        videoCodec: decision.videoCodec,
        audioCodec: decision.audioCodec,
        subtitleDelivery: decision.subtitleDelivery,
        bitrate: decision.bitrate,
        width: decision.width,
        height: decision.height,
        sessionId: decision.sessionId,
        selectedAudio: mapSelectedAudioStream(decision.selectedAudioStream),
        selectedSubtitle: mapSelectedSubtitleStream(decision.selectedSubtitleStream),
        directPlay: decision.directPlay,
        audioFallback: decision.audioFallback,
        source: decision.source,
        transcodeRequest: decision.transcodeRequest,
        serverDecision: decision.serverDecision,
    };
}

function mapSelectedAudioStream(
    stream: StreamDecision['selectedAudioStream']
): SelectedAudioSnapshot {
    if (!stream) {
        return null;
    }

    const selectedAudio: NonNullable<SelectedAudioSnapshot> = {
        id: stream.id,
        codec: stream.codec,
    };

    if (typeof stream.channels === 'number') {
        selectedAudio.channels = stream.channels;
    }
    if (typeof stream.language === 'string') {
        selectedAudio.language = stream.language;
    }
    if (typeof stream.title === 'string') {
        selectedAudio.title = stream.title;
    }
    if (typeof stream.default === 'boolean') {
        selectedAudio.default = stream.default;
    }

    return selectedAudio;
}

function mapSelectedSubtitleStream(
    stream: StreamDecision['selectedSubtitleStream']
): SelectedSubtitleSnapshot {
    if (!stream) {
        return null;
    }

    const selectedSubtitle: NonNullable<SelectedSubtitleSnapshot> = {
        id: stream.id,
        codec: stream.codec,
    };

    if (typeof stream.language === 'string') {
        selectedSubtitle.language = stream.language;
    }
    if (typeof stream.title === 'string') {
        selectedSubtitle.title = stream.title;
    }
    if (typeof stream.format === 'string') {
        selectedSubtitle.format = stream.format;
    }
    if (typeof stream.default === 'boolean') {
        selectedSubtitle.default = stream.default;
    }

    return selectedSubtitle;
}
