import type { ChannelSetupPlanDiagnosticsResult } from '../channel-setup/ChannelSetupPlanDiagnostics';
import type { ChannelSetupConfig, ChannelSetupRecord } from '../channel-setup/types';
import { DebugOverridesStore } from '../../modules/debug/DebugOverridesStore';
import { AudioSettingsStore } from '../../modules/settings/AudioSettingsStore';
import { DeveloperSettingsStore } from '../../modules/settings/DeveloperSettingsStore';
import type { ToastInput } from '../../modules/ui/toast/types';
import type { AppShellDiagnosticsRuntimePort } from './AppShellRuntimeContracts';
import {
    safeClearLineupStorage,
} from '../../utils/storage';
import { STORAGE_KEYS } from '../../types';
import { summarizeChannelSetupPlannerDiagnostics } from './AppDiagnosticsChannelSetupSummary';

type DiagnosticsWindow = Window & {
    lineup?: {
        toggleDevMenu: () => void;
        dumpChannelSetupPlannerDiagnostics: (
            configOverride?: ChannelSetupConfig
        ) => Promise<ChannelSetupPlannerDiagnosticsDump>;
        dumpActiveChannelSetupPlannerDiagnostics: () => Promise<ChannelSetupPlannerDiagnosticsDump>;
    };
};

interface ChannelSetupPlannerDiagnosticsDump {
    selectedServerId: string;
    recordSource: 'saved-record' | 'override' | 'active-screen';
    config: ChannelSetupConfig;
    savedRecord: ChannelSetupRecord | null;
    result: ChannelSetupPlanDiagnosticsResult;
}

export interface AppDiagnosticsSurfaceOptions {
    getDiagnosticsRuntime: () => AppShellDiagnosticsRuntimePort | null;
    getActiveChannelSetupConfig?: () => ChannelSetupConfig | null;
    showToast: (input: ToastInput) => void;
    debugOverridesStore: DebugOverridesStore;
}

export class AppDiagnosticsSurface {
    private readonly _getDiagnosticsRuntime: () => AppShellDiagnosticsRuntimePort | null;
    private readonly _getActiveChannelSetupConfig: () => ChannelSetupConfig | null;
    private readonly _showToast: (input: ToastInput) => void;
    private readonly _debugOverridesStore: DebugOverridesStore;
    private readonly _audioSettingsStore = new AudioSettingsStore();
    private readonly _developerSettingsStore = new DeveloperSettingsStore();
    private _container: HTMLElement | null = null;
    private _globalKeydownHandler: ((event: KeyboardEvent) => void) | null = null;

    constructor(options: AppDiagnosticsSurfaceOptions) {
        this._getDiagnosticsRuntime = options.getDiagnosticsRuntime;
        this._getActiveChannelSetupConfig = options.getActiveChannelSetupConfig ?? (() : ChannelSetupConfig | null => null);
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
                this._getDiagnosticsRuntime()?.toggleServerSelect();
            }
            if (this._isDebugSurfaceEnabled() && event.code === 'KeyD' && event.ctrlKey && event.shiftKey) {
                this._toggleDevMenu();
            }
        };
        document.addEventListener('keydown', this._globalKeydownHandler);

        if (this._isDebugSurfaceEnabled()) {
            (window as DiagnosticsWindow).lineup = {
                toggleDevMenu: (): void => this._toggleDevMenu(),
                dumpChannelSetupPlannerDiagnostics: async (
                    configOverride?: ChannelSetupConfig
                ): Promise<ChannelSetupPlannerDiagnosticsDump> => this._dumpChannelSetupPlannerDiagnostics(configOverride),
                dumpActiveChannelSetupPlannerDiagnostics: async (): Promise<ChannelSetupPlannerDiagnosticsDump> =>
                    this._dumpActiveChannelSetupPlannerDiagnostics(),
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

    private async _dumpChannelSetupPlannerDiagnostics(
        configOverride?: ChannelSetupConfig
    ): Promise<ChannelSetupPlannerDiagnosticsDump> {
        const runtime = this._getDiagnosticsRuntime();
        if (!runtime) {
            throw new Error('Diagnostics runtime is unavailable');
        }
        const workflowPort = runtime.getChannelSetupWorkflowPort();
        const selectedServerId = runtime.getSelectedServerId();
        if (!selectedServerId) {
            throw new Error('No Plex server is currently selected');
        }

        const savedRecord = workflowPort.getChannelSetupRecord(selectedServerId);
        const config = configOverride ?? savedRecord;
        if (!config) {
            throw new Error(
                'No saved channel setup record exists for the selected server. Complete setup once or pass a config override.'
            );
        }

        const result = await workflowPort.getSetupPlanDiagnostics(config);
        const dump: ChannelSetupPlannerDiagnosticsDump = {
            selectedServerId,
            recordSource: configOverride ? 'override' : 'saved-record',
            config,
            savedRecord,
            result,
        };

        this._logChannelSetupPlannerDiagnostics(runtime.getSelectedServerStorageKey(), dump);
        return dump;
    }

    private async _dumpActiveChannelSetupPlannerDiagnostics(): Promise<ChannelSetupPlannerDiagnosticsDump> {
        const runtime = this._getDiagnosticsRuntime();
        if (!runtime) {
            throw new Error('Diagnostics runtime is unavailable');
        }
        const selectedServerId = runtime.getSelectedServerId();
        if (!selectedServerId) {
            throw new Error('No Plex server is currently selected');
        }

        const config = this._getActiveChannelSetupConfig();
        if (!config) {
            throw new Error(
                'No active channel setup draft is available. Open Channel Setup and return to Step 2 before dumping diagnostics.'
            );
        }

        const workflowPort = runtime.getChannelSetupWorkflowPort();
        const savedRecord = workflowPort.getChannelSetupRecord(selectedServerId);
        const result = await workflowPort.getSetupPlanDiagnostics(config);
        const dump: ChannelSetupPlannerDiagnosticsDump = {
            selectedServerId,
            recordSource: 'active-screen',
            config,
            savedRecord,
            result,
        };

        this._logChannelSetupPlannerDiagnostics(runtime.getSelectedServerStorageKey(), dump);
        return dump;
    }

    /* eslint-disable no-console */
    private _logChannelSetupPlannerDiagnostics(
        selectedServerStorageKey: string,
        dump: ChannelSetupPlannerDiagnosticsDump
    ): void {
        const summary = summarizeChannelSetupPlannerDiagnostics(dump.result);

        console.groupCollapsed('[lineup] Channel setup planner diagnostics');
        console.info('Selected server:', dump.selectedServerId);
        console.info('Selected server storage key:', selectedServerStorageKey);
        console.info('Record source:', dump.recordSource);
        console.info('Planner summary:', summary.overview);
        if (summary.familySummaries.length > 0) {
            console.info('Planner facet families:', summary.familySummaries);
        }
        if (summary.warnings.length > 0) {
            console.info('Planner warnings:', summary.warnings);
        }
        if (summary.notes.length > 0) {
            console.info('Planner notes:', summary.notes);
        }
        console.groupEnd();
    }
    /* eslint-enable no-console */

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

    private _createElement<K extends keyof HTMLElementTagNameMap>(
        tagName: K,
        options?: {
            id?: string;
            className?: string;
            textContent?: string;
            cssText?: string;
            attributes?: Record<string, string>;
        }
    ): HTMLElementTagNameMap[K] {
        const element = document.createElement(tagName);
        if (options?.id) {
            element.id = options.id;
        }
        if (options?.className) {
            element.className = options.className;
        }
        if (typeof options?.textContent === 'string') {
            element.textContent = options.textContent;
        }
        if (options?.cssText) {
            element.style.cssText = options.cssText;
        }
        if (options?.attributes) {
            for (const [name, value] of Object.entries(options.attributes)) {
                element.setAttribute(name, value);
            }
        }
        return element;
    }

    private _renderDevMenu(): void {
        if (!this._container) return;
        const container = this._container;

        const heading = this._createElement('h2', {
            textContent: 'Dev Menu',
            cssText: 'margin-top:0;border-bottom:1px solid #444;padding-bottom:10px;',
        });

        const storageInfo = this._createElement('div', {
            cssText: 'margin-bottom:15px;color:#aaa;font-size:13px;',
        });
        storageInfo.append('Storage keys: ');
        const channelsKey = this._createElement('code', { id: 'dev-storage-key-channels' });
        const currentChannelKey = this._createElement('code', { id: 'dev-storage-key-current' });
        storageInfo.append(channelsKey, ', ', currentChannelKey);

        const stack = this._createElement('div', {
            cssText: 'display:flex;flex-direction:column;gap:10px;',
        });

        const overridesSection = this._createElement('details', {
            cssText: 'border:1px solid #333;border-radius:8px;padding:10px;',
        });
        overridesSection.append(
            this._createElement('summary', {
                textContent: 'Plex Debug Overrides',
                cssText: 'cursor:pointer;color:#ddd;',
            })
        );
        const overridesBody = this._createElement('div', {
            cssText: 'display:flex;flex-direction:column;gap:8px;margin-top:10px;',
        });

        const directPlayLabel = this._createElement('label', {
            cssText: 'font-size:13px;color:#aaa;',
        });
        const directPlayAudioFallbackEl = this._createElement('input', {
            id: 'dev-directplay-audio-fallback',
        });
        directPlayAudioFallbackEl.type = 'checkbox';
        directPlayLabel.append(
            directPlayAudioFallbackEl,
            ' Try Direct Play using fallback audio track (lineup_direct_play_audio_fallback=1)'
        );

        const streamDebugHeader = this._createElement('div', {
            textContent: 'Now Playing Stream Debug (overlay)',
            cssText: 'margin-top:6px;font-size:12px;color:#888;',
        });

        const nowPlayingStreamDebugLabel = this._createElement('label', {
            cssText: 'font-size:13px;color:#aaa;',
        });
        const nowPlayingStreamDebugEl = this._createElement('input', {
            id: 'dev-nowplaying-stream-debug',
        });
        nowPlayingStreamDebugEl.type = 'checkbox';
        nowPlayingStreamDebugLabel.append(
            nowPlayingStreamDebugEl,
            ' Show stream decision in Show Info overlay (lineup_now_playing_stream_debug=1)'
        );

        const nowPlayingStreamDebugAutoLabel = this._createElement('label', {
            cssText: 'font-size:13px;color:#aaa;',
        });
        const nowPlayingStreamDebugAutoEl = this._createElement('input', {
            id: 'dev-nowplaying-stream-debug-auto',
        });
        nowPlayingStreamDebugAutoEl.type = 'checkbox';
        nowPlayingStreamDebugAutoLabel.append(
            nowPlayingStreamDebugAutoEl,
            ' Auto-open Show Info on tune when debug is enabled (lineup_now_playing_stream_debug_auto_show=1)'
        );

        const profileLabel = this._createElement('label', {
            textContent: 'Forced Client Profile Name',
            cssText: 'font-size:13px;color:#aaa;',
        });
        const profileNameSelect = this._createElement('select', {
            id: 'dev-transcode-profile-name',
            cssText: 'margin-left:8px;padding:6px;',
        });
        for (const [value, label] of [
            ['', '(default)'],
            ['HTML TV App', 'HTML TV App'],
            ['Generic', 'Generic'],
        ] as const) {
            const option = this._createElement('option', {
                textContent: label,
                attributes: { value },
            });
            profileNameSelect.append(option);
        }
        profileLabel.append(' ', profileNameSelect);

        const overrideButtons = this._createElement('div', {
            cssText: 'display:flex;gap:10px;margin-top:6px;',
        });
        const saveOverridesButton = this._createElement('button', {
            id: 'dev-transcode-save',
            textContent: 'Save Overrides',
            cssText: 'padding:8px;cursor:pointer;',
        });
        const clearOverridesButton = this._createElement('button', {
            id: 'dev-transcode-clear',
            textContent: 'Clear Overrides',
            cssText: 'padding:8px;cursor:pointer;background:#500;color:#fff;border:none;',
        });
        overrideButtons.append(saveOverridesButton, clearOverridesButton);

        const overrideNote = this._createElement('div', {
            textContent: 'Forced profile affects only transcode URL generation. Tokens are never shown.',
            cssText: 'font-size:12px;color:#888;margin-top:6px;',
        });
        overridesBody.append(
            directPlayLabel,
            streamDebugHeader,
            nowPlayingStreamDebugLabel,
            nowPlayingStreamDebugAutoLabel,
            profileLabel,
            overrideButtons,
            overrideNote
        );
        overridesSection.append(overridesBody);

        const playbackSection = this._createElement('details', {
            cssText: 'border:1px solid #333;border-radius:8px;padding:10px;',
        });
        playbackSection.append(
            this._createElement('summary', {
                textContent: 'Playback Info (PMS Decision)',
                cssText: 'cursor:pointer;color:#ddd;',
            })
        );
        const playbackBody = this._createElement('div', {
            cssText: 'display:flex;flex-direction:column;gap:8px;margin-top:10px;',
        });
        const playbackActions = this._createElement('div', {
            cssText: 'display:flex;gap:10px;align-items:center;',
        });
        const refreshButton = this._createElement('button', {
            id: 'dev-playback-refresh',
            textContent: 'Refresh',
            cssText: 'padding:8px;cursor:pointer;',
        });
        const copySummaryButton = this._createElement('button', {
            id: 'dev-playback-copy-summary',
            textContent: 'Copy Summary',
            cssText: 'padding:8px;cursor:pointer;',
        });
        const copyRawButton = this._createElement('button', {
            id: 'dev-playback-copy-raw',
            textContent: 'Copy Raw',
            cssText: 'padding:8px;cursor:pointer;',
        });
        const playbackTip = this._createElement('span', {
            textContent: 'Tip: Ctrl+Shift+D (desktop) or run window.lineup.toggleDevMenu() in the console',
            cssText: 'font-size:12px;color:#888;',
        });
        playbackActions.append(refreshButton, copySummaryButton, copyRawButton, playbackTip);

        const playbackPre = this._createElement('pre', {
            id: 'dev-playback-info',
            cssText: 'margin:0;max-height:260px;overflow:auto;background:#111;border:1px solid #333;border-radius:6px;padding:10px;color:#ddd;font-size:12px;line-height:1.35;white-space:pre-wrap;',
        });
        const playbackNote = this._createElement('div', {
            textContent: "Shows Lineup's local decision and (when transcoding) the server's universal transcode decision.",
            cssText: 'font-size:12px;color:#888;',
        });
        playbackBody.append(playbackActions, playbackPre, playbackNote);
        playbackSection.append(playbackBody);

        const resetButton = this._createElement('button', {
            id: 'dev-reset-app',
            textContent: 'Reset Lineup Storage',
            cssText: 'padding:10px;cursor:pointer;background:#500;color:#fff;border:none;',
        });
        const closeButton = this._createElement('button', {
            id: 'dev-close',
            textContent: 'Close',
            cssText: 'padding:10px;cursor:pointer;margin-top:10px;',
        });

        stack.append(overridesSection, playbackSection, resetButton, closeButton);
        container.replaceChildren(heading, storageInfo, stack);

        channelsKey.textContent = STORAGE_KEYS.CHANNELS_REAL;
        currentChannelKey.textContent = STORAGE_KEYS.CURRENT_CHANNEL;

        // Bind events
        resetButton.addEventListener('click', () => {
            const ok = window.confirm('Reset Lineup storage (channels, overrides)?');
            if (!ok) return;
            safeClearLineupStorage();
            window.location.reload();
        });

        closeButton.addEventListener('click', () => {
            container.style.display = 'none';
        });

        refreshButton.addEventListener('click', () => {
            void this._refreshDevPlaybackInfo();
        });
        void this._refreshDevPlaybackInfo();

        // Transcode override controls (real mode only)
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
        directPlayAudioFallbackEl.checked = this._audioSettingsStore.readDirectPlayAudioFallbackEnabled();
        nowPlayingStreamDebugEl.checked = this._debugOverridesStore.readNowPlayingStreamDebugEnabled();
        nowPlayingStreamDebugAutoEl.checked = this._debugOverridesStore.readNowPlayingStreamDebugAutoShowEnabled();

        saveOverridesButton.addEventListener('click', () => {
            this._audioSettingsStore.writeDirectPlayAudioFallbackEnabled(directPlayAudioFallbackEl.checked);
            this._debugOverridesStore.writeNowPlayingStreamDebugEnabled(nowPlayingStreamDebugEl.checked);
            this._debugOverridesStore.writeNowPlayingStreamDebugAutoShowEnabled(
                nowPlayingStreamDebugAutoEl.checked
            );
            this._debugOverridesStore.writeTranscodeProfileName(profileNameSelect.value);
            this._showToast({ message: 'Saved overrides', type: 'success' });
        });

        clearOverridesButton.addEventListener('click', () => {
            const ok = window.confirm('Clear playback overrides?');
            if (!ok) return;
            this._audioSettingsStore.clearDirectPlayAudioFallbackEnabled();
            this._debugOverridesStore.clearDebugOverrides();
            this._showToast({ message: 'Cleared overrides', type: 'success' });
            // Re-render to reflect cleared state
            this._renderDevMenu();
        });

        copySummaryButton.addEventListener('click', async () => {
            const text = playbackPre.dataset.summary ?? '';
            if (!text) {
                this._showToast({ message: 'Nothing to copy (refresh first)', type: 'warning' });
                return;
            }
            const ok = await this._copyToClipboard(text);
            this._showToast({ message: ok ? 'Copied summary' : 'Copy not supported', type: ok ? 'success' : 'warning' });
        });

        copyRawButton.addEventListener('click', async () => {
            const text = playbackPre.dataset.raw ?? '';
            if (!text) {
                this._showToast({ message: 'Nothing to copy (refresh first)', type: 'warning' });
                return;
            }
            const ok = await this._copyToClipboard(text);
            this._showToast({ message: ok ? 'Copied raw JSON' : 'Copy not supported', type: ok ? 'success' : 'warning' });
        });
    }

    private async _refreshDevPlaybackInfo(): Promise<void> {
        const runtime = this._getDiagnosticsRuntime();
        if (!this._container || !runtime) return;
        const pre = this._container.querySelector('#dev-playback-info') as HTMLPreElement | null;
        if (!pre) return;

        pre.textContent = 'Loading...';
        pre.dataset.summary = '';
        pre.dataset.raw = '';
        try {
            const snapshot = await runtime.refreshPlaybackInfoSnapshot();
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
