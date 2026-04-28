import type { AppShellPlaybackInfoSnapshot } from './AppShellRuntimeContracts';

export interface AppDiagnosticsPlaybackInfoText {
    display: string;
    summary: string;
    rawJson: string;
}

export function formatAppDiagnosticsPlaybackInfo(
    snapshot: AppShellPlaybackInfoSnapshot
): AppDiagnosticsPlaybackInfoText {
    const rawJson = JSON.stringify(snapshot, null, 2);
    const lines: string[] = [];
    appendPlaybackHeader(lines, snapshot);
    appendDeliverySection(lines, snapshot);
    appendRawSection(lines, rawJson);

    const display = lines.join('\n');
    const rawHeaderIdx = lines.findIndex((line) => line === 'RAW');
    const summary = rawHeaderIdx > 0 ? lines.slice(0, Math.max(0, rawHeaderIdx - 1)).join('\n') : display;

    return {
        display,
        summary,
        rawJson,
    };
}

function appendPlaybackHeader(lines: string[], snapshot: AppShellPlaybackInfoSnapshot): void {
    lines.push('PLAYBACK INFO');
    lines.push('='.repeat(60));
    lines.push(`Channel: ${snapshot.channel ? `${snapshot.channel.number} ${snapshot.channel.name}` : '(none)'}`);
    lines.push(`Item:    ${snapshot.program ? snapshot.program.title : '(none)'}`);
    if (snapshot.program) {
        lines.push(
            `Time:    elapsed ${formatMilliseconds(snapshot.program.elapsedMs)} / remaining ${formatMilliseconds(snapshot.program.remainingMs)}`
        );
    }
}

function appendDeliverySection(lines: string[], snapshot: AppShellPlaybackInfoSnapshot): void {
    lines.push('');
    lines.push('DELIVERY (what the TV receives)');
    lines.push('-'.repeat(60));
    if (!snapshot.stream) {
        lines.push('(no stream decision yet)');
        return;
    }

    const stream = snapshot.stream;
    lines.push(`Protocol: ${stream.protocol.toUpperCase()}  MIME: ${stream.mimeType}`);
    lines.push(`Lineup:    ${stream.isDirectPlay ? 'DIRECT PLAY' : 'HLS SESSION REQUESTED (Plex decides copy vs transcode)'}`);
    lines.push(`Target:    ${stream.container}  video=${stream.videoCodec}  audio=${stream.audioCodec}  ${stream.width}x${stream.height}  ${formatKbps(stream.bitrate)}`);
    lines.push(`Subtitles: ${stream.subtitleDelivery}`);
    appendPmsDecision(lines, stream);
    appendDirectPlayBlockedReasons(lines, stream);
    appendSourceSection(lines, stream);
    appendTracksSection(lines, stream);
    appendRequestSection(lines, stream);
}

function appendPmsDecision(
    lines: string[],
    stream: NonNullable<AppShellPlaybackInfoSnapshot['stream']>
): void {
    if (stream.serverDecision) {
        const serverDecision = stream.serverDecision;
        const parts = [
            serverDecision.videoDecision ? `video=${serverDecision.videoDecision}` : null,
            serverDecision.audioDecision ? `audio=${serverDecision.audioDecision}` : null,
            serverDecision.subtitleDecision ? `subtitles=${serverDecision.subtitleDecision}` : null,
        ].filter(Boolean);
        if (parts.length > 0) {
            lines.push(`PMS:       ${parts.join(' ')}`);
        }
        if (serverDecision.decisionText) {
            lines.push(`PMS text:  ${serverDecision.decisionText}`);
        }
    } else if (!stream.isDirectPlay) {
        lines.push('PMS:       (decision not fetched; press Refresh again)');
    }
}

function appendDirectPlayBlockedReasons(
    lines: string[],
    stream: NonNullable<AppShellPlaybackInfoSnapshot['stream']>
): void {
    if (stream.directPlay && stream.directPlay.reasons.length > 0) {
        lines.push('');
        lines.push(`Direct Play blocked by: ${stream.directPlay.reasons.join(', ')}`);
    }
}

function appendSourceSection(
    lines: string[],
    stream: NonNullable<AppShellPlaybackInfoSnapshot['stream']>
): void {
    lines.push('');
    lines.push('SOURCE (selected Plex media version)');
    lines.push('-'.repeat(60));
    if (stream.source) {
        lines.push(`Source: ${stream.source.container}  video=${stream.source.videoCodec}  audio=${stream.source.audioCodec}  ${stream.source.width}x${stream.source.height}  ${formatKbps(stream.source.bitrate)}`);
    } else {
        lines.push('(unknown)');
    }
}

function appendTracksSection(
    lines: string[],
    stream: NonNullable<AppShellPlaybackInfoSnapshot['stream']>
): void {
    lines.push('');
    lines.push('TRACKS');
    lines.push('-'.repeat(60));
    lines.push(`Audio:    ${stream.selectedAudio ? `${stream.selectedAudio.codec ?? 'unknown'}${typeof stream.selectedAudio.channels === 'number' ? ` ${stream.selectedAudio.channels}ch` : ''}${stream.selectedAudio.language ? ` (${stream.selectedAudio.language})` : ''}` : '(none)'}`);
    lines.push(`Subtitle: ${stream.selectedSubtitle ? `${stream.selectedSubtitle.codec ?? 'unknown'}${stream.selectedSubtitle.language ? ` (${stream.selectedSubtitle.language})` : ''}` : '(none)'}`);
    if (stream.audioFallback) {
        lines.push(`Fallback: ${stream.audioFallback.fromCodec} -> ${stream.audioFallback.toCodec} (${stream.audioFallback.reason})`);
    }
}

function appendRequestSection(
    lines: string[],
    stream: NonNullable<AppShellPlaybackInfoSnapshot['stream']>
): void {
    if (!stream.transcodeRequest) {
        return;
    }

    lines.push('');
    lines.push('REQUEST (Lineup -> PMS)');
    lines.push('-'.repeat(60));
    lines.push(`Session: ${stream.transcodeRequest.sessionId}`);
    lines.push(`Max BR:  ${formatKbps(stream.transcodeRequest.maxBitrate)}`);
    lines.push(`AudioID: ${stream.transcodeRequest.audioStreamId ?? '(none)'}`);
}

function appendRawSection(lines: string[], rawJson: string): void {
    lines.push('');
    lines.push('RAW');
    lines.push('-'.repeat(60));
    lines.push(rawJson);
}

function formatMilliseconds(ms: number): string {
    if (!Number.isFinite(ms)) {
        return 'unknown';
    }
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
}

function formatKbps(kbps: number): string {
    if (!Number.isFinite(kbps)) {
        return 'unknown';
    }
    if (kbps >= 1000) {
        return `${(kbps / 1000).toFixed(1)} Mbps`;
    }
    return `${kbps} kbps`;
}
