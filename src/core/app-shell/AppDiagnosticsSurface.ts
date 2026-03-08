import type { IAppOrchestrator } from '../../Orchestrator';
import { DebugOverridesStore } from '../../modules/debug/DebugOverridesStore';
import { AudioSettingsStore } from '../../modules/settings/AudioSettingsStore';
import { DeveloperSettingsStore } from '../../modules/settings/DeveloperSettingsStore';
import type { ToastInput } from '../../modules/ui/toast/types';
import {
    safeClearLineupStorage,
} from '../../utils/storage';
import { STORAGE_KEYS } from '../../types';

type DiagnosticsWindow = Window & {
    lineup?: {
        toggleDevMenu: () => void;
    };
};

export type DiagnosticsOrchestrator = Pick<
    IAppOrchestrator,
    'refreshPlaybackInfoSnapshot'
> & {
    toggleServerSelect: () => void;
};

export interface AppDiagnosticsSurfaceOptions {
    getOrchestrator: () => DiagnosticsOrchestrator | null;
    showToast: (input: ToastInput) => void;
    debugOverridesStore: DebugOverridesStore;
}

export class AppDiagnosticsSurface {
    private readonly _getOrchestrator: () => DiagnosticsOrchestrator | null;
    private readonly _showToast: (input: ToastInput) => void;
    private readonly _debugOverridesStore: DebugOverridesStore;
    private readonly _audioSettingsStore = new AudioSettingsStore();
    private readonly _developerSettingsStore = new DeveloperSettingsStore();
    private _container: HTMLElement | null = null;
    private _globalKeydownHandler: ((event: KeyboardEvent) => void) | null = null;

    constructor(options: AppDiagnosticsSurfaceOptions) {
        this._getOrchestrator = options.getOrchestrator;
        this._showToast = options.showToast;
        this._debugOverridesStore = options.debugOverridesStore;
    }

    setContainer(container: HTMLElement | null): void {
        this._container = container;
    }

    initialize(): void {
        if (this._globalKeydownHandler) {
            document.removeEventListener('keydown', this._globalKeydownHandler);
        }
        this._globalKeydownHandler = (event: KeyboardEvent): void => {
            if (this._isDebugSurfaceEnabled() && event.code === 'KeyI') {
                this._getOrchestrator()?.toggleServerSelect();
            }
            if (this._isDebugSurfaceEnabled() && event.code === 'KeyD' && event.ctrlKey && event.shiftKey) {
                this._toggleDevMenu();
            }
        };
        document.addEventListener('keydown', this._globalKeydownHandler);

        if (this._isDebugSurfaceEnabled()) {
            (window as DiagnosticsWindow).lineup = {
                toggleDevMenu: (): void => this._toggleDevMenu(),
            };
        }
        if (!this._isDebugSurfaceEnabled()) {
            try {
                delete (window as DiagnosticsWindow).lineup;
            } catch {
                // ignore
            }
        }
    }

    dispose(): void {
        if (this._globalKeydownHandler) {
            document.removeEventListener('keydown', this._globalKeydownHandler);
        }
        this._globalKeydownHandler = null;
        try {
            delete (window as DiagnosticsWindow).lineup;
        } catch {
            // ignore
        }
        this._container = null;
    }

    private async _copyToClipboard(text: string): Promise<boolean> {
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    private _isDebugSurfaceEnabled(): boolean {
        if (__LINEUP_DEV_BUILD__) {
            return true;
        }
        return this._developerSettingsStore.readDebugLoggingEnabled(false);
    }

    private _toggleDevMenu(): void {
        if (!this._isDebugSurfaceEnabled()) return;
        if (!this._container) return;

        if (this._container.style.display === 'none') {
            this._renderDevMenu();
            this._container.style.display = 'block';
        } else {
            this._container.style.display = 'none';
        }
    }

    private _renderDevMenu(): void {
        if (!this._container) return;
        const container = this._container;

        // Dev-only: keep all interpolations here strictly to controlled constants/flags.
        // Do NOT interpolate Plex/user-provided strings into innerHTML to avoid future XSS foot-guns.
        container.innerHTML = `
            <h2 style="margin-top:0;border-bottom:1px solid #444;padding-bottom:10px;">Dev Menu</h2>
            <div style="margin-bottom:15px;color:#aaa;font-size:13px;">
                Storage keys: <code id="dev-storage-key-channels"></code>, <code id="dev-storage-key-current"></code>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px;">
                <details style="border:1px solid #333;border-radius:8px;padding:10px;">
                    <summary style="cursor:pointer;color:#ddd;">Plex Debug Overrides</summary>
                    <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">
                        <label style="font-size:13px;color:#aaa;">
                            <input id="dev-directplay-audio-fallback" type="checkbox" /> Try Direct Play using fallback audio track (lineup_direct_play_audio_fallback=1)
                        </label>
                        <div style="margin-top:6px;font-size:12px;color:#888;">
                            Now Playing Stream Debug (overlay)
                        </div>
                        <label style="font-size:13px;color:#aaa;">
                            <input id="dev-nowplaying-stream-debug" type="checkbox" /> Show stream decision in Show Info overlay (lineup_now_playing_stream_debug=1)
                        </label>
                        <label style="font-size:13px;color:#aaa;">
                            <input id="dev-nowplaying-stream-debug-auto" type="checkbox" /> Auto-open Show Info on tune when debug is enabled (lineup_now_playing_stream_debug_auto_show=1)
                        </label>
                        <label style="font-size:13px;color:#aaa;">
                            Forced Client Profile Name
                            <select id="dev-transcode-profile-name" style="margin-left:8px;padding:6px;">
                                <option value="">(default)</option>
                                <option value="HTML TV App">HTML TV App</option>
                                <option value="Generic">Generic</option>
                            </select>
                        </label>
                        <div style="display:flex;gap:10px;margin-top:6px;">
                            <button id="dev-transcode-save" style="padding:8px;cursor:pointer;">Save Overrides</button>
                            <button id="dev-transcode-clear" style="padding:8px;cursor:pointer;background:#500;color:#fff;border:none;">Clear Overrides</button>
                        </div>
                        <div style="font-size:12px;color:#888;margin-top:6px;">
                            Forced profile affects only transcode URL generation. Tokens are never shown.
                        </div>
                    </div>
                </details>
                <details style="border:1px solid #333;border-radius:8px;padding:10px;">
                    <summary style="cursor:pointer;color:#ddd;">Playback Info (PMS Decision)</summary>
                    <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">
                        <div style="display:flex;gap:10px;align-items:center;">
                            <button id="dev-playback-refresh" style="padding:8px;cursor:pointer;">Refresh</button>
                            <button id="dev-playback-copy-summary" style="padding:8px;cursor:pointer;">Copy Summary</button>
                            <button id="dev-playback-copy-raw" style="padding:8px;cursor:pointer;">Copy Raw</button>
                            <span style="font-size:12px;color:#888;">Tip: Ctrl+Shift+D (desktop) or run window.lineup.toggleDevMenu() in the console</span>
                        </div>
                        <pre id="dev-playback-info" style="margin:0;max-height:260px;overflow:auto;background:#111;border:1px solid #333;border-radius:6px;padding:10px;color:#ddd;font-size:12px;line-height:1.35;white-space:pre-wrap;"></pre>
                        <div style="font-size:12px;color:#888;">
                            Shows Lineup's local decision and (when transcoding) the server's universal transcode decision.
                        </div>
                    </div>
                </details>
                <button id="dev-reset-app" style="padding:10px;cursor:pointer;background:#500;color:#fff;border:none;">Reset Lineup Storage</button>
                <button id="dev-close" style="padding:10px;cursor:pointer;margin-top:10px;">Close</button>
            </div>
        `;
        const channelsKey = container.querySelector('#dev-storage-key-channels');
        if (channelsKey) {
            channelsKey.textContent = STORAGE_KEYS.CHANNELS_REAL;
        }
        const currentChannelKey = container.querySelector('#dev-storage-key-current');
        if (currentChannelKey) {
            currentChannelKey.textContent = STORAGE_KEYS.CURRENT_CHANNEL;
        }

        // Bind events
        container.querySelector('#dev-reset-app')?.addEventListener('click', () => {
            const ok = window.confirm('Reset Lineup storage (channels, overrides)?');
            if (!ok) return;
            safeClearLineupStorage();
            window.location.reload();
        });

        container.querySelector('#dev-close')?.addEventListener('click', () => {
            container.style.display = 'none';
        });

        container.querySelector('#dev-playback-refresh')?.addEventListener('click', () => {
            void this._refreshDevPlaybackInfo();
        });
        void this._refreshDevPlaybackInfo();

        // Transcode override controls (real mode only)
        const profileNameSelect = container.querySelector('#dev-transcode-profile-name') as HTMLSelectElement | null;
        if (profileNameSelect) {
            const storedProfileName = this._debugOverridesStore.readTranscodeProfileName();
            const isSupportedStoredProfileName = Array.from(profileNameSelect.options).some(
                (option) => option.value === storedProfileName
            );
            if (storedProfileName && !isSupportedStoredProfileName) {
                this._debugOverridesStore.clearTranscodeProfileName();
                profileNameSelect.value = '';
            } else {
                profileNameSelect.value = storedProfileName ?? '';
            }
        }
        const directPlayAudioFallbackEl = container.querySelector('#dev-directplay-audio-fallback') as HTMLInputElement | null;
        if (directPlayAudioFallbackEl) {
            directPlayAudioFallbackEl.checked = this._audioSettingsStore.readDirectPlayAudioFallbackEnabled();
        }
        const nowPlayingStreamDebugEl = container.querySelector('#dev-nowplaying-stream-debug') as HTMLInputElement | null;
        if (nowPlayingStreamDebugEl) {
            nowPlayingStreamDebugEl.checked = this._debugOverridesStore.readNowPlayingStreamDebugEnabled();
        }
        const nowPlayingStreamDebugAutoEl = container.querySelector('#dev-nowplaying-stream-debug-auto') as HTMLInputElement | null;
        if (nowPlayingStreamDebugAutoEl) {
            nowPlayingStreamDebugAutoEl.checked = this._debugOverridesStore.readNowPlayingStreamDebugAutoShowEnabled();
        }

        container.querySelector('#dev-transcode-save')?.addEventListener('click', () => {
            if (directPlayAudioFallbackEl) {
                this._audioSettingsStore.writeDirectPlayAudioFallbackEnabled(directPlayAudioFallbackEl.checked);
            }
            if (nowPlayingStreamDebugEl) {
                this._debugOverridesStore.writeNowPlayingStreamDebugEnabled(nowPlayingStreamDebugEl.checked);
            }
            if (nowPlayingStreamDebugAutoEl) {
                this._debugOverridesStore.writeNowPlayingStreamDebugAutoShowEnabled(
                    nowPlayingStreamDebugAutoEl.checked
                );
            }
            if (profileNameSelect) {
                this._debugOverridesStore.writeTranscodeProfileName(profileNameSelect.value);
            }
            this._showToast({ message: 'Saved overrides', type: 'success' });
        });

        container.querySelector('#dev-transcode-clear')?.addEventListener('click', () => {
            const ok = window.confirm('Clear transcode overrides?');
            if (!ok) return;
            this._audioSettingsStore.clearDirectPlayAudioFallbackEnabled();
            this._debugOverridesStore.clearDebugOverrides();
            this._showToast({ message: 'Cleared overrides', type: 'success' });
            // Re-render to reflect cleared state
            this._renderDevMenu();
        });

        container.querySelector('#dev-playback-copy-summary')?.addEventListener('click', async () => {
            const pre = container.querySelector('#dev-playback-info') as HTMLPreElement | null;
            const text = pre?.dataset?.summary ?? '';
            if (!text) {
                this._showToast({ message: 'Nothing to copy (refresh first)', type: 'warning' });
                return;
            }
            const ok = await this._copyToClipboard(text);
            this._showToast({ message: ok ? 'Copied summary' : 'Copy not supported', type: ok ? 'success' : 'warning' });
        });

        container.querySelector('#dev-playback-copy-raw')?.addEventListener('click', async () => {
            const pre = container.querySelector('#dev-playback-info') as HTMLPreElement | null;
            const text = pre?.dataset?.raw ?? '';
            if (!text) {
                this._showToast({ message: 'Nothing to copy (refresh first)', type: 'warning' });
                return;
            }
            const ok = await this._copyToClipboard(text);
            this._showToast({ message: ok ? 'Copied raw JSON' : 'Copy not supported', type: ok ? 'success' : 'warning' });
        });
    }

    private async _refreshDevPlaybackInfo(): Promise<void> {
        const orchestrator = this._getOrchestrator();
        if (!this._container || !orchestrator) return;
        const pre = this._container.querySelector('#dev-playback-info') as HTMLPreElement | null;
        if (!pre) return;

        pre.textContent = 'Loading...';
        pre.dataset.summary = '';
        pre.dataset.raw = '';
        try {
            const snapshot = await orchestrator.refreshPlaybackInfoSnapshot();
            const fmtMs = (ms: number): string => {
                const totalSec = Math.max(0, Math.floor(ms / 1000));
                const h = Math.floor(totalSec / 3600);
                const m = Math.floor((totalSec % 3600) / 60);
                const s = totalSec % 60;
                if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                return `${m}:${String(s).padStart(2, '0')}`;
            };
            const fmtKbps = (kbps: number): string => {
                if (!Number.isFinite(kbps)) return 'unknown';
                if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)} Mbps`;
                return `${kbps} kbps`;
            };

            const rawJson = JSON.stringify(snapshot, null, 2);

            const lines: string[] = [];
            lines.push('PLAYBACK INFO');
            lines.push('='.repeat(60));
            lines.push(`Channel: ${snapshot.channel ? `${snapshot.channel.number} ${snapshot.channel.name}` : '(none)'}`);
            lines.push(`Item:    ${snapshot.program ? snapshot.program.title : '(none)'}`);
            if (snapshot.program) {
                lines.push(`Time:    elapsed ${fmtMs(snapshot.program.elapsedMs)} / remaining ${fmtMs(snapshot.program.remainingMs)}`);
            }

            lines.push('');
            lines.push('DELIVERY (what the TV receives)');
            lines.push('-'.repeat(60));
            if (!snapshot.stream) {
                lines.push('(no stream decision yet)');
            } else {
                const s = snapshot.stream;
                lines.push(`Protocol: ${s.protocol.toUpperCase()}  MIME: ${s.mimeType}`);
                lines.push(`Lineup:    ${s.isDirectPlay ? 'DIRECT PLAY' : 'HLS SESSION REQUESTED (Plex decides copy vs transcode)'}`);
                lines.push(`Target:    ${s.container}  video=${s.videoCodec}  audio=${s.audioCodec}  ${s.width}x${s.height}  ${fmtKbps(s.bitrate)}`);
                lines.push(`Subtitles: ${s.subtitleDelivery}`);

                if (s.serverDecision) {
                    const sd = s.serverDecision;
                    const parts = [
                        sd.videoDecision ? `video=${sd.videoDecision}` : null,
                        sd.audioDecision ? `audio=${sd.audioDecision}` : null,
                        sd.subtitleDecision ? `subtitles=${sd.subtitleDecision}` : null,
                    ].filter(Boolean);
                    if (parts.length > 0) {
                        lines.push(`PMS:       ${parts.join(' ')}`);
                    }
                    if (sd.decisionText) {
                        lines.push(`PMS text:  ${sd.decisionText}`);
                    }
                } else if (!s.isDirectPlay) {
                    lines.push('PMS:       (decision not fetched; press Refresh again)');
                }

                if (s.directPlay && s.directPlay.reasons.length > 0) {
                    lines.push('');
                    lines.push(`Direct Play blocked by: ${s.directPlay.reasons.join(', ')}`);
                }

                lines.push('');
                lines.push('SOURCE (selected Plex media version)');
                lines.push('-'.repeat(60));
                if (s.source) {
                    lines.push(`Source: ${s.source.container}  video=${s.source.videoCodec}  audio=${s.source.audioCodec}  ${s.source.width}x${s.source.height}  ${fmtKbps(s.source.bitrate)}`);
                } else {
                    lines.push('(unknown)');
                }

                lines.push('');
                lines.push('TRACKS');
                lines.push('-'.repeat(60));
                lines.push(`Audio:    ${s.selectedAudio ? `${s.selectedAudio.codec ?? 'unknown'}${typeof s.selectedAudio.channels === 'number' ? ` ${s.selectedAudio.channels}ch` : ''}${s.selectedAudio.language ? ` (${s.selectedAudio.language})` : ''}` : '(none)'}`);
                lines.push(`Subtitle: ${s.selectedSubtitle ? `${s.selectedSubtitle.codec ?? 'unknown'}${s.selectedSubtitle.language ? ` (${s.selectedSubtitle.language})` : ''}` : '(none)'}`);
                if (s.audioFallback) {
                    lines.push(`Fallback: ${s.audioFallback.fromCodec} -> ${s.audioFallback.toCodec} (${s.audioFallback.reason})`);
                }

                if (s.transcodeRequest) {
                    lines.push('');
                    lines.push('REQUEST (Lineup -> PMS)');
                    lines.push('-'.repeat(60));
                    lines.push(`Session: ${s.transcodeRequest.sessionId}`);
                    lines.push(`Max BR:  ${fmtKbps(s.transcodeRequest.maxBitrate)}`);
                    lines.push(`AudioID: ${s.transcodeRequest.audioStreamId ?? '(none)'}`);
                }
            }

            lines.push('');
            lines.push('RAW');
            lines.push('-'.repeat(60));
            lines.push(rawJson);

            pre.textContent = lines.join('\n');
            const rawHeaderIdx = lines.findIndex((l) => l === 'RAW');
            const summary =
                rawHeaderIdx > 0 ? lines.slice(0, Math.max(0, rawHeaderIdx - 1)).join('\n') : pre.textContent;
            pre.dataset.summary = summary ?? '';
            pre.dataset.raw = rawJson;
        } catch (error) {
            pre.textContent = `Failed to load playback info: ${error instanceof Error ? error.message : String(error)}`;
            pre.dataset.summary = '';
            pre.dataset.raw = '';
        }
    }
}
