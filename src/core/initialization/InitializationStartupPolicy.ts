import { AppErrorCode, type AppError, type IAppLifecycle } from '../../modules/lifecycle';
import type { INavigationManager } from '../../modules/navigation';
import type { IPlexAuth } from '../../modules/plex/auth';
import type { IPlexServerDiscovery } from '../../modules/plex/discovery';
import type { IPlexLibrary } from '../../modules/plex/library';
import type { IPlexStreamResolver } from '../../modules/plex/stream';
import type { IChannelManager } from '../../modules/scheduler/channel-manager';
import type { IChannelScheduler } from '../../modules/scheduler/scheduler';
import type { IVideoPlayer } from '../../modules/player';
import type { EpgLayoutMode } from '../../modules/settings/EpgPreferencesStore';
import { formatTimeRange } from '../../modules/ui/epg';
import type { IEpgDebugRuntime } from '../../modules/ui/epg';
import { toEpgItemDetails } from '../../modules/ui/epg/adapters';
import type { OrchestratorConfig, ModuleStatus } from '../orchestrator/OrchestratorTypes';
import { summarizeErrorForLog } from '../../utils/errors';

type UpdateModuleStatus = (
    id: string,
    status: ModuleStatus['status'],
    error?: AppError,
    loadTimeMs?: number
) => void;

type Phase2AuthPlexAuth = Pick<
    IPlexAuth,
    'getStoredCredentials' | 'validateToken' | 'getCurrentUser' | 'storeCredentials' | 'getHomeUsers'
>;

type Phase2AuthNavigation = Pick<INavigationManager, 'getCurrentScreen' | 'goTo'>;

type Phase2AuthLifecycle = Pick<IAppLifecycle, 'setPhase'>;

export interface StartupResumeHandlers {
    registerAuthResume(): void;
    registerServerResume(): void;
    registerProfileResume(): void;
}

export interface Phase2AuthGateInputs {
    startTime: number;
    plexAuth: Phase2AuthPlexAuth;
    navigation: Phase2AuthNavigation;
    lifecycle: Phase2AuthLifecycle | null;
    updateModuleStatus: UpdateModuleStatus;
    configureDiscoveryStorage: () => void;
    readShowProfilePickerOnStartup: () => boolean;
    seedSubtitleLanguageFromPlexUser?: () => void;
    handlers: Pick<StartupResumeHandlers, 'registerAuthResume' | 'registerProfileResume'>;
}

export interface Phase3ServerGateInputs {
    startTime: number;
    plexDiscovery: IPlexServerDiscovery;
    plexLibrary: IPlexLibrary;
    plexStreamResolver: IPlexStreamResolver;
    navigation: INavigationManager;
    updateModuleStatus: UpdateModuleStatus;
    handlers: Pick<StartupResumeHandlers, 'registerServerResume'>;
}

export interface PostReadyRoutingInputs {
    navigation: Pick<INavigationManager, 'replaceScreen'>;
    channelManager: Pick<IChannelManager, 'getCurrentChannel' | 'getAllChannels'> | null;
    shouldRunAudioSetup: () => boolean;
    shouldRunChannelSetup: () => boolean;
    switchToChannel: (id: string) => Promise<void>;
    openServerSelect: () => void;
}

export interface EpgStartupConfigInputs {
    epgConfig: OrchestratorConfig['epgConfig'];
    plexLibrary: IPlexLibrary | null;
    videoPlayer: IVideoPlayer | null;
    channelManager: IChannelManager | null;
    scheduler: IChannelScheduler | null;
    buildPlexResourceUrl: (pathOrUrl: string | null) => string | null;
    readEpgLayoutMode: () => EpgLayoutMode;
    readShowNowWatchingBanner: () => boolean;
    debugRuntime: IEpgDebugRuntime | null;
}

export async function applyPostReadyRoutingPolicy(inputs: PostReadyRoutingInputs): Promise<void> {
    const shouldRunAudioSetup = inputs.shouldRunAudioSetup();
    const shouldRunSetup = inputs.shouldRunChannelSetup();

    if (shouldRunAudioSetup && shouldRunSetup) {
        inputs.navigation.replaceScreen('audio-setup');
        return;
    }

    if (shouldRunSetup) {
        inputs.navigation.replaceScreen('channel-setup');
        return;
    }

    if (!inputs.channelManager) {
        inputs.openServerSelect();
        return;
    }

    inputs.navigation.replaceScreen('player');

    let channelToPlay = inputs.channelManager.getCurrentChannel();

    if (!channelToPlay) {
        const allChannels = inputs.channelManager.getAllChannels();
        const firstChannel = allChannels[0];
        if (firstChannel) {
            channelToPlay = firstChannel;
        }
    }

    if (channelToPlay) {
        await inputs.switchToChannel(channelToPlay.id);
        return;
    }

    inputs.openServerSelect();
}

export async function applyPhase2AuthGatePolicy(inputs: Phase2AuthGateInputs): Promise<boolean> {
    const storedCredentials = await inputs.plexAuth.getStoredCredentials();
    if (storedCredentials) {
        try {
            const activeValid = await inputs.plexAuth.validateToken(
                storedCredentials.activeToken.token
            );

            if (activeValid) {
                const currentToken =
                    inputs.plexAuth.getCurrentUser() ?? storedCredentials.activeToken;
                const activeUserId = storedCredentials.activeUserId || currentToken.userId;
                const accountToken = storedCredentials.accountToken.token === currentToken.token
                    ? currentToken
                    : storedCredentials.accountToken;
                const selectedServerByUserId = {
                    ...(storedCredentials.selectedServerByUserId ?? {}),
                };
                if (!selectedServerByUserId[activeUserId]) {
                    selectedServerByUserId[activeUserId] = { serverId: null, serverUri: null };
                }
                await inputs.plexAuth.storeCredentials({
                    accountToken,
                    activeToken: currentToken,
                    activeUserId,
                    selectedServerByUserId,
                    deviceKey: storedCredentials.deviceKey ?? null,
                });
                inputs.configureDiscoveryStorage();
                inputs.seedSubtitleLanguageFromPlexUser?.();
                inputs.updateModuleStatus(
                    'plex-auth',
                    'ready',
                    undefined,
                    Date.now() - inputs.startTime
                );

                if (inputs.lifecycle) {
                    inputs.lifecycle.setPhase('loading_data');
                }

                const currentScreen = inputs.navigation.getCurrentScreen();
                const isAuthScreen = currentScreen === 'auth';
                const showPickerOnStartup = inputs.readShowProfilePickerOnStartup();
                if (isAuthScreen || showPickerOnStartup) {
                    try {
                        const users = await inputs.plexAuth.getHomeUsers();
                        if (users.length > 1) {
                            inputs.handlers.registerProfileResume();
                            inputs.navigation.goTo('profile-select');
                            return false;
                        }
                    } catch (error) {
                        const code = (error as { code?: string }).code;
                        if (
                            code === AppErrorCode.AUTH_REQUIRED ||
                            code === AppErrorCode.AUTH_INVALID
                        ) {
                            inputs.updateModuleStatus('plex-auth', 'pending');
                            inputs.handlers.registerAuthResume();
                            inputs.navigation.goTo('auth');
                            return false;
                        }
                    }
                }

                return true;
            }

            const accountValid = await inputs.plexAuth.validateToken(
                storedCredentials.accountToken.token
            );
            if (accountValid) {
                const selectedServerByUserId = {
                    ...(storedCredentials.selectedServerByUserId ?? {}),
                };
                if (!selectedServerByUserId[storedCredentials.activeUserId]) {
                    selectedServerByUserId[storedCredentials.activeUserId] = {
                        serverId: null,
                        serverUri: null,
                    };
                }
                await inputs.plexAuth.storeCredentials({
                    accountToken: storedCredentials.accountToken,
                    activeToken: storedCredentials.activeToken,
                    activeUserId: storedCredentials.activeUserId,
                    selectedServerByUserId,
                    deviceKey: storedCredentials.deviceKey ?? null,
                });

                inputs.updateModuleStatus(
                    'plex-auth',
                    'ready',
                    undefined,
                    Date.now() - inputs.startTime
                );
                inputs.handlers.registerProfileResume();
                inputs.navigation.goTo('profile-select');
                return false;
            }
        } catch (error) {
            const code = (error as { code?: string }).code;
            if (
                code === AppErrorCode.AUTH_REQUIRED ||
                code === AppErrorCode.AUTH_INVALID
            ) {
                inputs.updateModuleStatus('plex-auth', 'pending');
                inputs.handlers.registerAuthResume();
                inputs.navigation.goTo('auth');
                return false;
            }

            console.error('Phase 2 auth gate failed:', summarizeErrorForLog(error));
            throw error;
        }
    }

    inputs.updateModuleStatus('plex-auth', 'pending');
    inputs.handlers.registerAuthResume();
    inputs.navigation.goTo('auth');
    return false;
}

export async function applyPhase3ServerGatePolicy(inputs: Phase3ServerGateInputs): Promise<boolean> {
    inputs.updateModuleStatus('plex-server-discovery', 'initializing');
    try {
        await inputs.plexDiscovery.initialize();
    } catch (error) {
        console.error('Server discovery failed:', summarizeErrorForLog(error));
        inputs.updateModuleStatus('plex-server-discovery', 'error');
        inputs.navigation.goTo('server-select');
        return false;
    }

    const elapsedMs = Date.now() - inputs.startTime;
    const isConnected = inputs.plexDiscovery.isConnected();

    if (!isConnected) {
        inputs.updateModuleStatus('plex-server-discovery', 'pending', undefined, elapsedMs);
        inputs.updateModuleStatus('plex-library', 'pending', undefined, elapsedMs);
        inputs.updateModuleStatus('plex-stream-resolver', 'pending', undefined, elapsedMs);
        inputs.handlers.registerServerResume();
        inputs.navigation.goTo('server-select');
        return false;
    }

    inputs.updateModuleStatus('plex-server-discovery', 'ready', undefined, elapsedMs);
    inputs.updateModuleStatus('plex-library', 'ready', undefined, elapsedMs);
    inputs.updateModuleStatus('plex-stream-resolver', 'ready', undefined, elapsedMs);
    return true;
}

export function buildEpgConfigWithStartupPolicy(
    inputs: EpgStartupConfigInputs
): OrchestratorConfig['epgConfig'] {
    const layoutMode = inputs.readEpgLayoutMode();
    const showNowWatchingBanner = inputs.readShowNowWatchingBanner();
    const previousOnLayoutModeChange = inputs.epgConfig.onLayoutModeChange ?? null;

    return {
        ...inputs.epgConfig,
        layoutMode,
        showNowWatchingBanner,
        debugRuntime: inputs.debugRuntime,
        fetchItemDetails: async (
            ratingKey: string,
            options?: { signal?: AbortSignal | null }
        ) =>
            toEpgItemDetails(await (inputs.plexLibrary?.getItem(
                ratingKey,
                { signal: options?.signal ?? null }
            ) ?? Promise.resolve(null))),
        resolveThumbUrl: (
            pathOrUrl: string | null,
            width?: number,
            height?: number
        ): string | null => {
            if (!pathOrUrl) return null;
            if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
                return pathOrUrl;
            }
            const plexLibrary = inputs.plexLibrary;
            if (plexLibrary) {
                const resized = plexLibrary.getImageUrl(pathOrUrl, width, height);
                if (resized) return resized;
            }
            return inputs.buildPlexResourceUrl(pathOrUrl);
        },
        isVideoPlaying: (): boolean => inputs.videoPlayer?.isPlaying?.() ?? false,
        getCurrentChannelInfo: (): {
            channelNumber: number;
            channelName: string;
            programTitle: string;
            timeLabel: string;
        } | null => {
            const channel = inputs.channelManager?.getCurrentChannel();
            const scheduler = inputs.scheduler;
            if (!channel || !scheduler) return null;
            let program;
            try {
                program = scheduler.getCurrentProgram();
            } catch {
                return null;
            }
            if (!program) return null;
            const programTitle =
                program.item?.title ?? program.item?.fullTitle ?? 'Unknown';
            const startTime = program.scheduledStartTime;
            const endTime = program.scheduledEndTime;
            const hasValidTimes =
                Number.isFinite(startTime) &&
                Number.isFinite(endTime) &&
                endTime >= startTime;
            return {
                channelNumber: channel.number,
                channelName: channel.name,
                programTitle,
                timeLabel: hasValidTimes ? formatTimeRange(startTime, endTime) : '',
            };
        },
        onLayoutModeChange: (mode: EpgLayoutMode): void => {
            if (previousOnLayoutModeChange) {
                previousOnLayoutModeChange(mode);
            }
            const videoContainer = document.getElementById('video-container');
            if (!videoContainer) return;
            if (mode === 'classic') {
                videoContainer.classList.add('epg-pip-active');
            } else {
                videoContainer.classList.remove('epg-pip-active');
            }
        },
    };
}
