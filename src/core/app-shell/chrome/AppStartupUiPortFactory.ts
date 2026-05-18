import type { ExitConfirmModal } from '../../../modules/ui/exit-confirm';
import type { INowPlayingInfoOverlay } from '../../../modules/ui/now-playing-info';
import type { IPlaybackOptionsModal } from '../../../modules/ui/playback-options';
import type { InitializationStartupUiPort } from '../../initialization/InitializationCoordinator';
import type { ModuleStatus, OrchestratorConfig } from '../../orchestrator/contracts/OrchestratorTypes';
import type { AppError } from '../../../modules/lifecycle';
import { AppStartupUiInitializer } from './AppStartupUiInitializer';

type StatusCallbacks = {
    updateModuleStatus: (
        id: string,
        status: ModuleStatus['status'],
        error?: AppError,
        loadTimeMs?: number
    ) => void;
    getModuleStatus: (id: string) => ModuleStatus['status'] | undefined;
};

export function createAppStartupUiInitializer(
    config: OrchestratorConfig,
    overlays: {
        nowPlayingInfo: INowPlayingInfoOverlay | null;
        playbackOptions: IPlaybackOptionsModal | null;
        exitConfirm: ExitConfirmModal | null;
    },
    status: StatusCallbacks
): InitializationStartupUiPort {
    return new AppStartupUiInitializer(config, overlays, status);
}
