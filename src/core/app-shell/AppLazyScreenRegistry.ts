import type { ChannelSetupWorkflowPort } from '../channel-setup/ChannelSetupWorkflowPort';
import type { PlexHomeUser, PlexPinRequest } from '../../modules/plex/auth/interfaces';
import type { PlexServer } from '../../modules/plex/discovery/types';
import type { AuthScreen, AuthScreenPorts } from '../../modules/ui/auth/AuthScreen';
import type { AudioSetupScreen } from '../../modules/ui/audio-setup/AudioSetupScreen';
import type { ChannelSetupScreen } from '../../modules/ui/channel-setup/ChannelSetupScreen';
import type { ChannelSetupScreenPorts } from '../../modules/ui/channel-setup/ChannelSetupScreenPorts';
import type { INavigationManager } from '../../modules/navigation';
import type { ProfileSelectScreen, ProfileSelectScreenPorts } from '../../modules/ui/profile-select/ProfileSelectScreen';
import type { ProfileSessionStore } from '../../modules/settings/ProfileSessionStore';
import type { ServerSelectScreen, ServerSelectScreenPorts } from '../../modules/ui/server-select/ServerSelectScreen';
import type { SettingsScreen } from '../../modules/ui/settings/SettingsScreen';
import type { GuideSettingChange } from '../../modules/ui/settings/types';
import { CHANNEL_SETUP_PREFETCH_DELAY_MS, SETTINGS_PREFETCH_DELAY_MS } from './constants';

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
    loadSettingsScreen: () => Promise<typeof import('../../modules/ui/settings/SettingsScreen')>;
    loadSettingsStore: () => Promise<typeof import('../../modules/ui/settings/SettingsStore')>;
}

export interface AppLazyScreenRegistryRuntimeFacade {
    requestAuthPin(): Promise<PlexPinRequest>;
    pollForPin(pinId: number): Promise<PlexPinRequest>;
    cancelPin(pinId: number): Promise<void>;
    getHomeUsers(): Promise<PlexHomeUser[]>;
    switchHomeUser(userId: string, pin?: string): Promise<void>;
    useMainAccountProfile(): Promise<void>;
    signOutPlex(): Promise<void>;
    discoverServers(forceRefresh?: boolean): Promise<PlexServer[]>;
    selectServer(serverId: string): Promise<boolean>;
    clearSelectedServer(): void;
    getSelectedServerStorageKey(): string;
    getServerHealthStorageKey(): string;
    getChannelSetupWorkflowPort(): ChannelSetupWorkflowPort;
    createChannelSetupScreenPorts(): ChannelSetupScreenPorts;
    requestChannelSetupRerun(): void;
    setSubtitleTrack(trackId: string | null): Promise<void>;
    onGuideSettingChange(change: GuideSettingChange): void;
    getActiveUsername(): string | null;
    getNavigation(): INavigationManager | null;
}

export interface AppLazyScreenRegistryOptions {
    getRuntimeFacade: () => AppLazyScreenRegistryRuntimeFacade | null;
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
    loadSettingsScreen: () => import('../../modules/ui/settings/SettingsScreen'),
    loadSettingsStore: () => import('../../modules/ui/settings/SettingsStore'),
};

export class AppLazyScreenRegistry {
    private readonly _getRuntimeFacade: () => AppLazyScreenRegistryRuntimeFacade | null;
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
        this._getRuntimeFacade = options.getRuntimeFacade;
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
            void Promise.all([
                this._loaders.loadSettingsScreen(),
                this._loaders.loadSettingsStore(),
            ]).catch(() => {
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

        const runtimeFacade = this._getRuntimeFacade();
        const container = this._containers.authContainer;
        if (!runtimeFacade || !container) return null;

        if (!this._authScreenLoad) {
            this._authScreenLoad = this._loaders.loadAuthScreen()
                .then(({ AuthScreen }) => {
                    if (this._destroyed) return null;

                    const latestRuntimeFacade = this._getRuntimeFacade();
                    if (!latestRuntimeFacade) return null;

                    const ports: AuthScreenPorts = {
                        requestAuthPin: () => latestRuntimeFacade.requestAuthPin(),
                        pollForPin: (pinId: number) => latestRuntimeFacade.pollForPin(pinId),
                        cancelPin: (pinId: number) => latestRuntimeFacade.cancelPin(pinId),
                        getNavigation: () => this._getRuntimeFacade()?.getNavigation() ?? null,
                    };

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

        const runtimeFacade = this._getRuntimeFacade();
        const container = this._containers.profileSelectContainer;
        if (!runtimeFacade || !container) return null;

        if (!this._profileSelectScreenLoad) {
            this._profileSelectScreenLoad = this._loaders.loadProfileSelectScreen()
                .then(({ ProfileSelectScreen }) => {
                    if (this._destroyed) return null;

                    const latestRuntimeFacade = this._getRuntimeFacade();
                    if (!latestRuntimeFacade) return null;

                    const ports: ProfileSelectScreenPorts = {
                        getHomeUsers: () => latestRuntimeFacade.getHomeUsers(),
                        switchHomeUser: (userId: string, pin?: string) => latestRuntimeFacade.switchHomeUser(userId, pin),
                        useMainAccountProfile: () => latestRuntimeFacade.useMainAccountProfile(),
                        signOutPlex: () => latestRuntimeFacade.signOutPlex(),
                        getNavigation: () => this._getRuntimeFacade()?.getNavigation() ?? null,
                    };

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

        const runtimeFacade = this._getRuntimeFacade();
        const container = this._containers.serverSelectContainer;
        if (!runtimeFacade || !container) return null;

        if (!this._serverSelectScreenLoad) {
            this._serverSelectScreenLoad = this._loaders.loadServerSelectScreen()
                .then(({ ServerSelectScreen }) => {
                    if (this._destroyed) return null;

                    const latestRuntimeFacade = this._getRuntimeFacade();
                    if (!latestRuntimeFacade) return null;

                    const ports: ServerSelectScreenPorts = {
                        discoverServers: (forceRefresh?: boolean) => latestRuntimeFacade.discoverServers(forceRefresh),
                        selectServer: (serverId: string) => latestRuntimeFacade.selectServer(serverId),
                        clearSelectedServer: () => latestRuntimeFacade.clearSelectedServer(),
                        getSelectedServerStorageKey: () => latestRuntimeFacade.getSelectedServerStorageKey(),
                        getServerHealthStorageKey: () => latestRuntimeFacade.getServerHealthStorageKey(),
                        requestChannelSetupRerun: () => latestRuntimeFacade.requestChannelSetupRerun(),
                        getNavigation: () => this._getRuntimeFacade()?.getNavigation() ?? null,
                    };

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

        const runtimeFacade = this._getRuntimeFacade();
        const container = this._containers.audioSetupContainer;
        if (!runtimeFacade || !container) return null;

        if (!this._audioSetupScreenLoad) {
            this._audioSetupScreenLoad = this._loaders.loadAudioSetupScreen()
                .then(({ AudioSetupScreen }) => {
                    if (this._destroyed) return null;

                    const screen = new AudioSetupScreen(
                        container,
                        () => this._getRuntimeFacade()?.getNavigation() ?? null,
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

        const runtimeFacade = this._getRuntimeFacade();
        const container = this._containers.channelSetupContainer;
        if (!runtimeFacade || !container) return null;

        if (!this._channelSetupScreenLoad) {
            this._channelSetupScreenLoad = this._loaders.loadChannelSetupScreen()
                .then(({ ChannelSetupScreen }) => {
                    if (this._destroyed) return null;

                    const latestRuntimeFacade = this._getRuntimeFacade();
                    if (!latestRuntimeFacade) return null;

                    const screenPorts = latestRuntimeFacade.createChannelSetupScreenPorts();
                    const screen = new ChannelSetupScreen(
                        container,
                        {
                            workflowPort: latestRuntimeFacade.getChannelSetupWorkflowPort(),
                            screenPorts,
                        }
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

        const runtimeFacade = this._getRuntimeFacade();
        const container = this._containers.settingsContainer;
        if (!runtimeFacade || !container) return null;

        if (!this._settingsScreenLoad) {
            this._settingsScreenLoad = Promise.all([
                this._loaders.loadSettingsScreen(),
                this._loaders.loadSettingsStore(),
            ]).then(([{ SettingsScreen }, { SettingsStore }]) => {
                if (this._destroyed) return null;

                const screen = new SettingsScreen(
                    container,
                    () => this._getRuntimeFacade()?.getNavigation() ?? null,
                    (mode): void => {
                        if (mode !== 'off') return;
                        void this._getRuntimeFacade()?.setSubtitleTrack(null);
                    },
                    (change): void => {
                        this._getRuntimeFacade()?.onGuideSettingChange(change);
                    },
                    (): string | null => this._getRuntimeFacade()?.getActiveUsername() ?? null,
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
