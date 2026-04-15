import type { INowPlayingInfoOverlay } from '../../modules/ui/now-playing-info';
import type { IPlaybackOptionsModal } from '../../modules/ui/playback-options';
import { ExitConfirmModal, EXIT_CONFIRM_CONTAINER_ID } from '../../modules/ui/exit-confirm';
import type { ModuleStatus, OrchestratorConfig } from '../orchestrator/OrchestratorTypes';
import type { AppError } from '../../modules/lifecycle';

type StatusCallbacks = {
    updateModuleStatus: (
        id: string,
        status: ModuleStatus['status'],
        error?: AppError,
        loadTimeMs?: number
    ) => void;
    getModuleStatus: (id: string) => ModuleStatus['status'] | undefined;
};

export class AppStartupUiInitializer {
    private _nowPlayingInfoInitPromise: Promise<void> | null = null;
    private _playbackOptionsInitPromise: Promise<void> | null = null;
    private _exitConfirmInitPromise: Promise<void> | null = null;

    constructor(
        private readonly _config: OrchestratorConfig,
        private readonly _overlays: {
            nowPlayingInfo: INowPlayingInfoOverlay | null;
            playbackOptions: IPlaybackOptionsModal | null;
            exitConfirm: ExitConfirmModal | null;
        },
        private readonly _status: StatusCallbacks
    ) { }

    async ensureCorePlayerUiInitialized(): Promise<void> {
        await this._initNowPlayingInfoUI();
        await this._initPlaybackOptionsUI();
        await this._initExitConfirmUI();
    }

    private async _initNowPlayingInfoUI(): Promise<void> {
        if (this._status.getModuleStatus('now-playing-info-ui') === 'ready') {
            return;
        }
        if (this._nowPlayingInfoInitPromise) {
            await this._nowPlayingInfoInitPromise;
            return;
        }
        if (!this._overlays.nowPlayingInfo) {
            return;
        }

        const startTime = Date.now();
        this._status.updateModuleStatus('now-playing-info-ui', 'initializing');
        const init = async (): Promise<void> => {
            this._overlays.nowPlayingInfo!.initialize(this._config.nowPlayingInfoConfig);
            this._status.updateModuleStatus(
                'now-playing-info-ui',
                'ready',
                undefined,
                Date.now() - startTime
            );
        };
        this._nowPlayingInfoInitPromise = init()
            .catch((e) => {
                this._status.updateModuleStatus('now-playing-info-ui', 'error');
                throw e;
            })
            .finally(() => {
                this._nowPlayingInfoInitPromise = null;
            });

        await this._nowPlayingInfoInitPromise;
    }

    private async _initPlaybackOptionsUI(): Promise<void> {
        if (this._status.getModuleStatus('playback-options-ui') === 'ready') {
            return;
        }
        if (this._playbackOptionsInitPromise) {
            await this._playbackOptionsInitPromise;
            return;
        }
        if (!this._overlays.playbackOptions) {
            return;
        }

        const startTime = Date.now();
        this._status.updateModuleStatus('playback-options-ui', 'initializing');
        const init = async (): Promise<void> => {
            this._overlays.playbackOptions!.initialize(this._config.playbackOptionsConfig);
            this._status.updateModuleStatus(
                'playback-options-ui',
                'ready',
                undefined,
                Date.now() - startTime
            );
        };
        this._playbackOptionsInitPromise = init()
            .catch((e) => {
                this._status.updateModuleStatus('playback-options-ui', 'error');
                throw e;
            })
            .finally(() => {
                this._playbackOptionsInitPromise = null;
            });

        await this._playbackOptionsInitPromise;
    }

    private async _initExitConfirmUI(): Promise<void> {
        if (this._status.getModuleStatus('exit-confirm-ui') === 'ready') {
            return;
        }
        if (this._exitConfirmInitPromise) {
            await this._exitConfirmInitPromise;
            return;
        }
        if (!this._overlays.exitConfirm) {
            return;
        }

        const startTime = Date.now();
        this._status.updateModuleStatus('exit-confirm-ui', 'initializing');
        const init = async (): Promise<void> => {
            this._overlays.exitConfirm!.initialize({ containerId: EXIT_CONFIRM_CONTAINER_ID });
            this._status.updateModuleStatus(
                'exit-confirm-ui',
                'ready',
                undefined,
                Date.now() - startTime
            );
        };
        this._exitConfirmInitPromise = init()
            .catch((e) => {
                this._status.updateModuleStatus('exit-confirm-ui', 'error');
                throw e;
            })
            .finally(() => {
                this._exitConfirmInitPromise = null;
            });

        await this._exitConfirmInitPromise;
    }
}
