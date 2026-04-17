import type { AuthScreen } from '../../modules/ui/auth/AuthScreen';
import type { AudioSetupScreen } from '../../modules/ui/audio-setup/AudioSetupScreen';
import type { ChannelSetupScreen } from '../../modules/ui/channel-setup/ChannelSetupScreen';
import type { ProfileSelectScreen } from '../../modules/ui/profile-select/ProfileSelectScreen';
import type { ProfileSessionStore } from '../../modules/settings/ProfileSessionStore';
import type { ServerSelectScreen } from '../../modules/ui/server-select/ServerSelectScreen';
import type { SettingsScreen } from '../../modules/ui/settings';
import { CHANNEL_SETUP_PREFETCH_DELAY_MS, SETTINGS_PREFETCH_DELAY_MS } from './constants';
import { AppLazyScreenPortFactory } from './AppLazyScreenPortFactory';

export interface AppLazyScreenRegistryContainers {
    authContainer?: HTMLElement | null;
    profileSelectContainer?: HTMLElement | null;
    serverSelectContainer?: HTMLElement | null;
    audioSetupContainer?: HTMLElement | null;
    channelSetupContainer?: HTMLElement | null;
    settingsContainer?: HTMLElement | null;
}

export interface AppLazyScreenRegistryLoaders {
    loadAuthScreen: () => Promise<typeof import('../../modules/ui/auth/AuthScreen')>;
    loadProfileSelectScreen: () => Promise<typeof import('../../modules/ui/profile-select/ProfileSelectScreen')>;
    loadServerSelectScreen: () => Promise<typeof import('../../modules/ui/server-select/ServerSelectScreen')>;
    loadAudioSetupScreen: () => Promise<typeof import('../../modules/ui/audio-setup')>;
    loadChannelSetupScreen: () => Promise<typeof import('../../modules/ui/channel-setup/ChannelSetupScreen')>;
    loadSettingsModule: () => Promise<typeof import('../../modules/ui/settings')>;
}

export interface AppLazyScreenRegistryOptions {
    portFactory: AppLazyScreenPortFactory;
    profileSessionStore: ProfileSessionStore;
    containers: AppLazyScreenRegistryContainers;
    onAudioSetupComplete?: () => void;
    loaders?: Partial<AppLazyScreenRegistryLoaders>;
}

const DEFAULT_LOADERS: AppLazyScreenRegistryLoaders = {
    loadAuthScreen: () => import('../../modules/ui/auth/AuthScreen'),
    loadProfileSelectScreen: () => import('../../modules/ui/profile-select/ProfileSelectScreen'),
    loadServerSelectScreen: () => import('../../modules/ui/server-select/ServerSelectScreen'),
    loadAudioSetupScreen: () => import('../../modules/ui/audio-setup'),
    loadChannelSetupScreen: () => import('../../modules/ui/channel-setup/ChannelSetupScreen'),
    loadSettingsModule: () => import('../../modules/ui/settings'),
};

export class AppLazyScreenRegistry {
    private readonly _portFactory: AppLazyScreenPortFactory;
    private readonly _profileSessionStore: ProfileSessionStore;
    private readonly _containers: AppLazyScreenRegistryContainers;
    private readonly _onAudioSetupComplete: () => void;
    private readonly _loaders: AppLazyScreenRegistryLoaders;
    private _destroyed = false;

    private _authScreen: AuthScreen | null = null;
    private _authScreenLoad: Promise<AuthScreen | null> | null = null;
    private _profileSelectScreen: ProfileSelectScreen | null = null;
    private _profileSelectScreenLoad: Promise<ProfileSelectScreen | null> | null = null;
    private _serverSelectScreen: ServerSelectScreen | null = null;
    private _serverSelectScreenLoad: Promise<ServerSelectScreen | null> | null = null;
    private _audioSetupScreen: AudioSetupScreen | null = null;
    private _audioSetupScreenLoad: Promise<AudioSetupScreen | null> | null = null;
    private _channelSetupScreen: ChannelSetupScreen | null = null;
    private _channelSetupScreenLoad: Promise<ChannelSetupScreen | null> | null = null;
    private _settingsScreen: SettingsScreen | null = null;
    private _settingsScreenLoad: Promise<SettingsScreen | null> | null = null;
    private _settingsPrefetchTimerId: number | null = null;
    private _channelSetupPrefetchTimerId: number | null = null;

    constructor(options: AppLazyScreenRegistryOptions) {
        this._portFactory = options.portFactory;
        this._profileSessionStore = options.profileSessionStore;
        this._containers = options.containers;
        this._onAudioSetupComplete = options.onAudioSetupComplete ?? (() : void => {});
        this._loaders = {
            ...DEFAULT_LOADERS,
            ...options.loaders,
        };
    }

    getAuthScreen(): AuthScreen | null {
        return this._authScreen;
    }

    getProfileSelectScreen(): ProfileSelectScreen | null {
        return this._profileSelectScreen;
    }

    getServerSelectScreen(): ServerSelectScreen | null {
        return this._serverSelectScreen;
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
            void this._loaders.loadSettingsModule().catch(() => {
                // Best-effort prefetch only.
            });
        }, SETTINGS_PREFETCH_DELAY_MS);
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
        }, CHANNEL_SETUP_PREFETCH_DELAY_MS);
    }

    async ensureAuthScreen(): Promise<AuthScreen | null> {
        if (this._destroyed) return null;
        if (this._authScreen) return this._authScreen;

        const container = this._containers.authContainer;
        if (!container) return null;

        if (!this._authScreenLoad) {
            this._authScreenLoad = this._loaders.loadAuthScreen()
                .then(({ AuthScreen }) => {
                    if (this._destroyed) return null;
                    const ports = this._portFactory.createAuthScreenPorts();
                    if (!ports) return null;

                    const screen = new AuthScreen(container, ports);

                    if (this._destroyed) {
                        screen.destroy();
                        return null;
                    }

                    this._authScreen = screen;
                    return screen;
                })
                .finally(() => {
                    this._authScreenLoad = null;
                });
        }

        return this._authScreenLoad;
    }

    async ensureProfileSelectScreen(): Promise<ProfileSelectScreen | null> {
        if (this._destroyed) return null;
        if (this._profileSelectScreen) return this._profileSelectScreen;

        const container = this._containers.profileSelectContainer;
        if (!container) return null;

        if (!this._profileSelectScreenLoad) {
            this._profileSelectScreenLoad = this._loaders.loadProfileSelectScreen()
                .then(({ ProfileSelectScreen }) => {
                    if (this._destroyed) return null;
                    const ports = this._portFactory.createProfileSelectScreenPorts();
                    if (!ports) return null;

                    const screen = new ProfileSelectScreen(
                        container,
                        ports,
                        this._profileSessionStore
                    );

                    if (this._destroyed) {
                        screen.destroy();
                        return null;
                    }

                    this._profileSelectScreen = screen;
                    return screen;
                })
                .finally(() => {
                    this._profileSelectScreenLoad = null;
                });
        }

        return this._profileSelectScreenLoad;
    }

    async ensureServerSelectScreen(): Promise<ServerSelectScreen | null> {
        if (this._destroyed) return null;
        if (this._serverSelectScreen) return this._serverSelectScreen;

        const container = this._containers.serverSelectContainer;
        if (!container) return null;

        if (!this._serverSelectScreenLoad) {
            this._serverSelectScreenLoad = this._loaders.loadServerSelectScreen()
                .then(({ ServerSelectScreen }) => {
                    if (this._destroyed) return null;
                    const ports = this._portFactory.createServerSelectScreenPorts();
                    if (!ports) return null;

                    const screen = new ServerSelectScreen(container, ports);

                    if (this._destroyed) {
                        screen.destroy();
                        return null;
                    }

                    this._serverSelectScreen = screen;
                    return screen;
                })
                .finally(() => {
                    this._serverSelectScreenLoad = null;
                });
        }

        return this._serverSelectScreenLoad;
    }

    async ensureAudioSetupScreen(): Promise<AudioSetupScreen | null> {
        if (this._destroyed) return null;
        if (this._audioSetupScreen) return this._audioSetupScreen;

        const getNavigation = (): ReturnType<AppLazyScreenPortFactory['getNavigation']> =>
            this._portFactory.getNavigation();
        const container = this._containers.audioSetupContainer;
        if (!container) return null;

        if (!this._audioSetupScreenLoad) {
            this._audioSetupScreenLoad = this._loaders.loadAudioSetupScreen()
                .then(({ AudioSetupScreen }) => {
                    if (this._destroyed) return null;

                    const screen = new AudioSetupScreen(
                        container,
                        getNavigation,
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

        const container = this._containers.channelSetupContainer;
        if (!container) return null;

        if (!this._channelSetupScreenLoad) {
            this._channelSetupScreenLoad = this._loaders.loadChannelSetupScreen()
                .then(({ ChannelSetupScreen }) => {
                    if (this._destroyed) return null;
                    const channelSetupInput = this._portFactory.createChannelSetupScreenInput();
                    if (!channelSetupInput) return null;

                    const screen = new ChannelSetupScreen(
                        container,
                        channelSetupInput
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

        const container = this._containers.settingsContainer;
        if (!container) return null;

        if (!this._settingsScreenLoad) {
            this._settingsScreenLoad = this._loaders.loadSettingsModule().then(({ SettingsScreen, SettingsStore }) => {
                if (this._destroyed) return null;
                const settingsRuntimePorts = this._portFactory.createSettingsRuntimePorts();
                if (!settingsRuntimePorts) return null;

                const screen = new SettingsScreen(
                    container,
                    settingsRuntimePorts.getNavigation,
                    (mode): void => {
                        if (mode !== 'off') return;
                        void settingsRuntimePorts.clearSubtitleTrack();
                    },
                    (change): void => {
                        settingsRuntimePorts.onGuideSettingChange(change);
                    },
                    settingsRuntimePorts.getActiveUsername,
                    settingsRuntimePorts.getTheme,
                    settingsRuntimePorts.setTheme,
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

        this._authScreen?.destroy();
        this._profileSelectScreen?.destroy();
        this._serverSelectScreen?.destroy();
        this._audioSetupScreen?.destroy();
        this._channelSetupScreen?.destroy();
        this._settingsScreen?.destroy();

        this._authScreen = null;
        this._profileSelectScreen = null;
        this._serverSelectScreen = null;
        this._audioSetupScreen = null;
        this._channelSetupScreen = null;
        this._settingsScreen = null;

        this._authScreenLoad = null;
        this._profileSelectScreenLoad = null;
        this._serverSelectScreenLoad = null;
        this._audioSetupScreenLoad = null;
        this._channelSetupScreenLoad = null;
        this._settingsScreenLoad = null;
    }
}
