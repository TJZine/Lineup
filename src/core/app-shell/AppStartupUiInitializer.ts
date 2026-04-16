import type { INowPlayingInfoOverlay } from '../../modules/ui/now-playing-info';
import type { IPlaybackOptionsModal } from '../../modules/ui/playback-options';
import { ExitConfirmModal, EXIT_CONFIRM_CONTAINER_ID } from '../../modules/ui/exit-confirm';
import type { ModuleStatus, OrchestratorConfig } from '../orchestrator/OrchestratorTypes';
import type { AppError } from '../../modules/lifecycle';
import { toRecoverableModuleStatusError } from '../initialization/RecoverableModuleStatusError';

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

    private _initNowPlayingInfoUI(): Promise<void> {
        return this._initializeOverlay({
            moduleId: 'now-playing-info-ui',
            getPromise: () => this._nowPlayingInfoInitPromise,
            setPromise: (promise) => {
                this._nowPlayingInfoInitPromise = promise;
            },
            isAvailable: () => this._overlays.nowPlayingInfo !== null,
            initialize: () => this._overlays.nowPlayingInfo?.initialize(this._config.nowPlayingInfoConfig),
        });
    }

    private _initPlaybackOptionsUI(): Promise<void> {
        return this._initializeOverlay({
            moduleId: 'playback-options-ui',
            getPromise: () => this._playbackOptionsInitPromise,
            setPromise: (promise) => {
                this._playbackOptionsInitPromise = promise;
            },
            isAvailable: () => this._overlays.playbackOptions !== null,
            initialize: () => this._overlays.playbackOptions?.initialize(this._config.playbackOptionsConfig),
        });
    }

    private _initExitConfirmUI(): Promise<void> {
        return this._initializeOverlay({
            moduleId: 'exit-confirm-ui',
            getPromise: () => this._exitConfirmInitPromise,
            setPromise: (promise) => {
                this._exitConfirmInitPromise = promise;
            },
            isAvailable: () => this._overlays.exitConfirm !== null,
            initialize: () => this._overlays.exitConfirm?.initialize({ containerId: EXIT_CONFIRM_CONTAINER_ID }),
        });
    }

    private _initializeOverlay(options: {
        moduleId: string;
        getPromise: () => Promise<void> | null;
        setPromise: (promise: Promise<void> | null) => void;
        isAvailable: () => boolean;
        initialize: () => void | Promise<void> | undefined;
    }): Promise<void> {
        if (this._status.getModuleStatus(options.moduleId) === 'ready') {
            return Promise.resolve();
        }

        if (!options.isAvailable()) {
            return Promise.resolve();
        }

        const inFlightPromise = options.getPromise();
        if (inFlightPromise) {
            return inFlightPromise;
        }

        const startTime = Date.now();
        this._status.updateModuleStatus(options.moduleId, 'initializing');
        let initResult: void | Promise<void> | undefined;
        try {
            initResult = options.initialize();
        } catch (error) {
            this._status.updateModuleStatus(
                options.moduleId,
                'error',
                toRecoverableModuleStatusError(
                    error,
                    `Startup UI initialization failed for ${options.moduleId}.`
                )
            );
            return Promise.reject(error);
        }

        const initPromise = Promise.resolve(initResult)
            .then(() => {
                this._status.updateModuleStatus(
                    options.moduleId,
                    'ready',
                    undefined,
                    Date.now() - startTime
                );
            })
            .catch((error) => {
                this._status.updateModuleStatus(
                    options.moduleId,
                    'error',
                    toRecoverableModuleStatusError(
                        error,
                        `Startup UI initialization failed for ${options.moduleId}.`
                    )
                );
                throw error;
            })
            .finally(() => {
                options.setPromise(null);
            });

        options.setPromise(initPromise);
        return initPromise;
    }
}
