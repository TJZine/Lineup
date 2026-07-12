import {
    InitializationSelectedServerTransaction,
} from './InitializationSelectedServerTransaction';
import type {
    InitializationCallbacks,
    InitializationDependencies,
} from './InitializationCoordinator';

export function createInitializationSelectedServerTransaction(options: {
    dependencies: InitializationDependencies;
    callbacks: InitializationCallbacks;
    initializePlaybackRuntime(signal: AbortSignal): Promise<void>;
    ensureCorePlayerUiInitialized(signal: AbortSignal): Promise<void>;
    initializeEpg(signal: AbortSignal): Promise<void>;
    clearResumeHandlers(): void;
}): InitializationSelectedServerTransaction {
    const { dependencies, callbacks } = options;
    return new InitializationSelectedServerTransaction({
        getPlexAuth: () => dependencies.modules.plexAuth,
        isSelectedServerConnected: () => dependencies.modules.plexDiscovery?.isConnected() === true,
        initializePlaybackRuntime: options.initializePlaybackRuntime,
        ensureCorePlayerUiInitialized: options.ensureCorePlayerUiInitialized,
        initializeEpg: options.initializeEpg,
        getNavigation: () => dependencies.modules.navigation,
        getChannelManager: () => dependencies.modules.channelManager,
        shouldRunAudioSetup: callbacks.routing.shouldRunAudioSetup,
        shouldRunChannelSetup: callbacks.routing.shouldRunChannelSetup,
        openServerSelect: callbacks.routing.openServerSelect,
        publishCommitStart: (): void => {
            callbacks.status.updateModuleStatus('plex-auth', 'ready', undefined, 0);
            callbacks.status.updateModuleStatus('plex-server-discovery', 'ready', undefined, 0);
            callbacks.status.updateModuleStatus('plex-library', 'ready', undefined, 0);
            callbacks.status.updateModuleStatus('plex-stream-resolver', 'ready', undefined, 0);
        },
        setupEventWiring: callbacks.state.setupEventWiring,
        setReady: callbacks.state.setReady,
        publishLifecycleReady: () => dependencies.modules.lifecycle?.setPhase('ready'),
        clearResumeHandlers: options.clearResumeHandlers,
    });
}
