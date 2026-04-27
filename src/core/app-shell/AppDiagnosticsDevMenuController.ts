import { DebugOverridesStore } from '../../modules/debug/DebugOverridesStore';
import { AudioSettingsStore } from '../../modules/settings/AudioSettingsStore';
import type { ToastInput } from '../../modules/ui/toast/types';
import { safeClearLineupStorage } from '../../utils/storage';
import type { AppShellDiagnosticsRuntimePort } from './AppShellRuntimeContracts';
import {
    type AppDiagnosticsDevMenuElements,
    renderAppDiagnosticsDevMenu,
} from './AppDiagnosticsDevMenuView';
import { formatAppDiagnosticsPlaybackInfo } from './AppDiagnosticsPlaybackInfoFormatter';

export interface AppDiagnosticsDevMenuControllerOptions {
    getDiagnosticsRuntime: () => AppShellDiagnosticsRuntimePort | null;
    showToast: (input: ToastInput) => void;
    debugOverridesStore: DebugOverridesStore;
}

export class AppDiagnosticsDevMenuController {
    private readonly _getDiagnosticsRuntime: () => AppShellDiagnosticsRuntimePort | null;
    private readonly _showToast: (input: ToastInput) => void;
    private readonly _debugOverridesStore: DebugOverridesStore;
    private readonly _audioSettingsStore = new AudioSettingsStore();

    constructor(options: AppDiagnosticsDevMenuControllerOptions) {
        this._getDiagnosticsRuntime = options.getDiagnosticsRuntime;
        this._showToast = options.showToast;
        this._debugOverridesStore = options.debugOverridesStore;
    }

    render(container: HTMLElement): void {
        const view = renderAppDiagnosticsDevMenu(container);
        this._hydrateDevMenuOverrideState(view);
        this._bindDevMenuEvents(view);
        void this._refreshDevPlaybackInfo(view.container);
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
            void this._refreshDevPlaybackInfo(view.container);
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
            this.render(view.container);
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

    private async _refreshDevPlaybackInfo(container: HTMLElement): Promise<void> {
        const runtime = this._getDiagnosticsRuntime();
        if (!runtime) return;
        const pre = container.querySelector('#dev-playback-info') as HTMLPreElement | null;
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
