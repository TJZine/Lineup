import type { AppOrchestrator } from '../../Orchestrator';
import type { AudioSetupScreen } from '../../modules/ui/audio-setup/AudioSetupScreen';
import type { ChannelSetupScreen } from '../../modules/ui/channel-setup/ChannelSetupScreen';
import type { SettingsScreen } from '../../modules/ui/settings/SettingsScreen';

export interface AppLazyScreenRegistryContainers {
    audioSetupContainer?: HTMLElement | null;
    channelSetupContainer?: HTMLElement | null;
    settingsContainer?: HTMLElement | null;
}

export interface AppLazyScreenRegistryLoaders {
    loadAudioSetupScreen: () => Promise<typeof import('../../modules/ui/audio-setup')>;
    loadChannelSetupScreen: () => Promise<typeof import('../../modules/ui/channel-setup/ChannelSetupScreen')>;
    loadSettingsScreen: () => Promise<typeof import('../../modules/ui/settings/SettingsScreen')>;
    loadSettingsStore: () => Promise<typeof import('../../modules/ui/settings/SettingsStore')>;
}

export interface AppLazyScreenRegistryOptions {
    getOrchestrator: () => AppOrchestrator | null;
    containers: AppLazyScreenRegistryContainers;
    onAudioSetupComplete?: () => void;
    loaders?: Partial<AppLazyScreenRegistryLoaders>;
}

const DEFAULT_LOADERS: AppLazyScreenRegistryLoaders = {
    loadAudioSetupScreen: () => import('../../modules/ui/audio-setup'),
    loadChannelSetupScreen: () => import('../../modules/ui/channel-setup/ChannelSetupScreen'),
    loadSettingsScreen: () => import('../../modules/ui/settings/SettingsScreen'),
    loadSettingsStore: () => import('../../modules/ui/settings/SettingsStore'),
};

export class AppLazyScreenRegistry {
    private readonly _getOrchestrator: () => AppOrchestrator | null;
    private readonly _containers: AppLazyScreenRegistryContainers;
    private readonly _onAudioSetupComplete: () => void;
    private readonly _loaders: AppLazyScreenRegistryLoaders;
    private _destroyed = false;

    private _audioSetupScreen: AudioSetupScreen | null = null;
    private _audioSetupScreenLoad: Promise<AudioSetupScreen | null> | null = null;
    private _channelSetupScreen: ChannelSetupScreen | null = null;
    private _channelSetupScreenLoad: Promise<ChannelSetupScreen | null> | null = null;
    private _settingsScreen: SettingsScreen | null = null;
    private _settingsScreenLoad: Promise<SettingsScreen | null> | null = null;
    private _settingsPrefetchTimerId: number | null = null;
    private _channelSetupPrefetchTimerId: number | null = null;

    constructor(options: AppLazyScreenRegistryOptions) {
        this._getOrchestrator = options.getOrchestrator;
        this._containers = options.containers;
        this._onAudioSetupComplete = options.onAudioSetupComplete ?? (() : void => {});
        this._loaders = {
            ...DEFAULT_LOADERS,
            ...options.loaders,
        };
    }

    getAudioSetupScreen(): AudioSetupScreen | null {
        return this._audioSetupScreen;
    }

    getChannelSetupScreen(): ChannelSetupScreen | null {
        return this._channelSetupScreen;
    }

    getSettingsScreen(): SettingsScreen | null {
        return this._settingsScreen;
    }

    cancelSettingsPrefetch(): void {
        if (this._settingsPrefetchTimerId !== null) {
            window.clearTimeout(this._settingsPrefetchTimerId);
            this._settingsPrefetchTimerId = null;
        }
    }

    cancelChannelSetupPrefetch(): void {
        if (this._channelSetupPrefetchTimerId !== null) {
            window.clearTimeout(this._channelSetupPrefetchTimerId);
            this._channelSetupPrefetchTimerId = null;
        }
    }

    scheduleSettingsPrefetch(): void {
        if (this._destroyed) return;
        if (this._settingsScreen || this._settingsScreenLoad) return;
        if (this._settingsPrefetchTimerId !== null) return;

        this._settingsPrefetchTimerId = window.setTimeout(() => {
            this._settingsPrefetchTimerId = null;
            if (this._destroyed) return;
            if (this._settingsScreen || this._settingsScreenLoad) return;
            void Promise.all([
                this._loaders.loadSettingsScreen(),
                this._loaders.loadSettingsStore(),
            ]).catch(() => {
                // Best-effort prefetch only.
            });
        }, 1200);
    }

    scheduleChannelSetupPrefetch(): void {
        if (this._destroyed) return;
        if (this._channelSetupScreen || this._channelSetupScreenLoad) return;
        if (this._channelSetupPrefetchTimerId !== null) return;

        this._channelSetupPrefetchTimerId = window.setTimeout(() => {
            this._channelSetupPrefetchTimerId = null;
            if (this._destroyed) return;
            if (this._channelSetupScreen || this._channelSetupScreenLoad) return;
            void this._loaders.loadChannelSetupScreen().catch(() => {
                // Best-effort prefetch only.
            });
        }, 500);
    }

    async ensureAudioSetupScreen(): Promise<AudioSetupScreen | null> {
        if (this._destroyed) return null;
        if (this._audioSetupScreen) return this._audioSetupScreen;

        const orchestrator = this._getOrchestrator();
        const container = this._containers.audioSetupContainer;
        if (!orchestrator || !container) return null;

        if (!this._audioSetupScreenLoad) {
            this._audioSetupScreenLoad = this._loaders.loadAudioSetupScreen()
                .then(({ AudioSetupScreen }) => {
                    if (this._destroyed) return null;

                    const screen = new AudioSetupScreen(
                        container,
                        () => this._getOrchestrator()?.getNavigation() ?? null,
                        () => this._onAudioSetupComplete()
                    );

                    if (this._destroyed) {
                        screen.destroy();
                        return null;
                    }

                    this._audioSetupScreen = screen;
                    return screen;
                })
                .finally(() => {
                    this._audioSetupScreenLoad = null;
                });
        }

        return this._audioSetupScreenLoad;
    }

    async ensureChannelSetupScreen(): Promise<ChannelSetupScreen | null> {
        if (this._destroyed) return null;
        if (this._channelSetupScreen) return this._channelSetupScreen;

        const orchestrator = this._getOrchestrator();
        const container = this._containers.channelSetupContainer;
        if (!orchestrator || !container) return null;

        if (!this._channelSetupScreenLoad) {
            this._channelSetupScreenLoad = this._loaders.loadChannelSetupScreen()
                .then(({ ChannelSetupScreen }) => {
                    if (this._destroyed) return null;

                    const latestOrchestrator = this._getOrchestrator();
                    if (!latestOrchestrator) return null;

                    const screen = new ChannelSetupScreen(
                        container,
                        latestOrchestrator.getChannelSetupSessionGateway()
                    );

                    if (this._destroyed) {
                        screen.destroy();
                        return null;
                    }

                    this._channelSetupScreen = screen;
                    return screen;
                })
                .finally(() => {
                    this._channelSetupScreenLoad = null;
                });
        }

        return this._channelSetupScreenLoad;
    }

    async ensureSettingsScreen(): Promise<SettingsScreen | null> {
        if (this._destroyed) return null;
        if (this._settingsScreen) return this._settingsScreen;

        const orchestrator = this._getOrchestrator();
        const container = this._containers.settingsContainer;
        if (!orchestrator || !container) return null;

        if (!this._settingsScreenLoad) {
            this._settingsScreenLoad = Promise.all([
                this._loaders.loadSettingsScreen(),
                this._loaders.loadSettingsStore(),
            ]).then(([{ SettingsScreen }, { SettingsStore }]) => {
                if (this._destroyed) return null;

                const screen = new SettingsScreen(
                    container,
                    () => this._getOrchestrator()?.getNavigation() ?? null,
                    (mode): void => {
                        if (mode !== 'off') return;
                        void this._getOrchestrator()?.setSubtitleTrack(null);
                    },
                    (change): void => {
                        this._getOrchestrator()?.onGuideSettingChange(change);
                    },
                    (): string | null => this._getOrchestrator()?.getActiveUsername() ?? null,
                    new SettingsStore()
                );

                if (this._destroyed) {
                    screen.destroy();
                    return null;
                }

                this._settingsScreen = screen;
                return screen;
            })
                .finally(() => {
                    this._settingsScreenLoad = null;
                });
        }

        return this._settingsScreenLoad;
    }

    destroy(): void {
        this._destroyed = true;

        this.cancelSettingsPrefetch();
        this.cancelChannelSetupPrefetch();

        this._audioSetupScreen?.destroy();
        this._channelSetupScreen?.destroy();
        this._settingsScreen?.destroy();

        this._audioSetupScreen = null;
        this._channelSetupScreen = null;
        this._settingsScreen = null;

        this._audioSetupScreenLoad = null;
        this._channelSetupScreenLoad = null;
        this._settingsScreenLoad = null;
    }
}
