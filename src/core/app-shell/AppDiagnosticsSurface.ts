import type { ChannelSetupPlanDiagnosticsResult } from '../channel-setup/planning/ChannelSetupPlanDiagnostics';
import type { ChannelSetupConfig, ChannelSetupRecord } from '../channel-setup/types';
import { DebugOverridesStore } from '../../modules/debug/DebugOverridesStore';
import { AudioSettingsStore } from '../../modules/settings/AudioSettingsStore';
import { DeveloperSettingsStore } from '../../modules/settings/DeveloperSettingsStore';
import type { ToastInput } from '../../modules/ui/toast/types';
import type { AppShellDiagnosticsRuntimePort } from './AppShellRuntimeContracts';
import {
    safeClearLineupStorage,
} from '../../utils/storage';
import { summarizeChannelSetupPlannerDiagnostics } from './AppDiagnosticsChannelSetupSummary';
import {
    type AppDiagnosticsDevMenuElements,
    renderAppDiagnosticsDevMenu,
} from './AppDiagnosticsDevMenuView';
import { formatAppDiagnosticsPlaybackInfo } from './AppDiagnosticsPlaybackInfoFormatter';

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
        return this._developerSettingsStore.readDebugLoggingEnabledAndClean(false);
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
        const view = renderAppDiagnosticsDevMenu(this._container);
        this._hydrateDevMenuOverrideState(view);
        this._bindDevMenuEvents(view);
        void this._refreshDevPlaybackInfo();
    }

    private _hydrateDevMenuOverrideState(view: AppDiagnosticsDevMenuElements): void {
        const storedProfileName = this._debugOverridesStore.readTranscodeProfileNameAndClean();
        const isSupportedStoredProfileName = Array.from(view.profileNameSelect.options).some(
            (option) => option.value === storedProfileName
        );
        if (storedProfileName && !isSupportedStoredProfileName) {
            this._debugOverridesStore.clearTranscodeProfileName();
            view.profileNameSelect.value = '';
        } else {
            view.profileNameSelect.value = storedProfileName ?? '';
        }
        view.directPlayAudioFallbackEl.checked =
            this._audioSettingsStore.readDirectPlayAudioFallbackEnabledAndClean();
        view.nowPlayingStreamDebugEl.checked =
            this._debugOverridesStore.readNowPlayingStreamDebugEnabledAndClean();
        view.nowPlayingStreamDebugAutoEl.checked =
            this._debugOverridesStore.readNowPlayingStreamDebugAutoShowEnabledAndClean();
    }

    private _bindDevMenuEvents(view: AppDiagnosticsDevMenuElements): void {
        view.resetButton.addEventListener('click', () => {
            const ok = window.confirm('Reset Lineup storage (channels, overrides)?');
            if (!ok) return;
            safeClearLineupStorage();
            window.location.reload();
        });

        view.closeButton.addEventListener('click', () => {
            view.container.style.display = 'none';
        });

        view.refreshButton.addEventListener('click', () => {
            void this._refreshDevPlaybackInfo();
        });

        view.saveOverridesButton.addEventListener('click', () => {
            this._audioSettingsStore.writeDirectPlayAudioFallbackEnabled(view.directPlayAudioFallbackEl.checked);
            this._debugOverridesStore.writeNowPlayingStreamDebugEnabled(view.nowPlayingStreamDebugEl.checked);
            this._debugOverridesStore.writeNowPlayingStreamDebugAutoShowEnabled(
                view.nowPlayingStreamDebugAutoEl.checked
            );
            this._debugOverridesStore.writeTranscodeProfileName(view.profileNameSelect.value);
            this._showToast({ message: 'Saved overrides', type: 'success' });
        });

        view.clearOverridesButton.addEventListener('click', () => {
            const ok = window.confirm('Clear playback overrides?');
            if (!ok) return;
            this._audioSettingsStore.clearDirectPlayAudioFallbackEnabled();
            this._debugOverridesStore.clearDebugOverrides();
            this._showToast({ message: 'Cleared overrides', type: 'success' });
            this._renderDevMenu();
        });

        view.copySummaryButton.addEventListener('click', async () => {
            const text = view.playbackPre.dataset.summary ?? '';
            if (!text) {
                this._showToast({ message: 'Nothing to copy (refresh first)', type: 'warning' });
                return;
            }
            const ok = await this._copyToClipboard(text);
            this._showToast({ message: ok ? 'Copied summary' : 'Copy not supported', type: ok ? 'success' : 'warning' });
        });

        view.copyRawButton.addEventListener('click', async () => {
            const text = view.playbackPre.dataset.raw ?? '';
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
            const formatted = formatAppDiagnosticsPlaybackInfo(snapshot);
            pre.textContent = formatted.display;
            pre.dataset.summary = formatted.summary;
            pre.dataset.raw = formatted.rawJson;
        } catch (error) {
            pre.textContent = `Failed to load playback info: ${error instanceof Error ? error.message : String(error)}`;
            pre.dataset.summary = '';
            pre.dataset.raw = '';
        }
    }
}
