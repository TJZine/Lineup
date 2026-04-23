import { AppErrorCode, type AppError, type IAppLifecycle } from '../../modules/lifecycle';
import type { INavigationManager } from '../../modules/navigation';
import type { IPlexAuth } from '../../modules/plex/auth';
import type { IPlexServerDiscovery } from '../../modules/plex/discovery';
import type { IPlexLibrary } from '../../modules/plex/library';
import type { IPlexStreamResolver } from '../../modules/plex/stream';
import type { IChannelManager } from '../../modules/scheduler/channel-manager';
import type { ModuleStatus } from '../orchestrator/OrchestratorTypes';
import { toRecoverableModuleStatusError } from './RecoverableModuleStatusError';

type UpdateModuleStatus = (
    id: string,
    status: ModuleStatus['status'],
    error?: AppError,
    loadTimeMs?: number
) => void;

type Phase2AuthPlexAuth = Pick<
    IPlexAuth,
    'readStoredCredentialsAndClearCorruption' | 'validateToken' | 'getCurrentUser' | 'storeCredentials' | 'getHomeUsers'
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

type Phase2StoredCredentials = Extract<
    Awaited<ReturnType<Phase2AuthPlexAuth['readStoredCredentialsAndClearCorruption']>>,
    { kind: 'available' }
>['credentials'];

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

function buildSelectedServerByUserId(
    storedCredentials: Phase2StoredCredentials,
    activeUserId: string
): Phase2StoredCredentials['selectedServerByUserId'] {
    const selectedServerByUserId = {
        ...(storedCredentials.selectedServerByUserId ?? {}),
    };
    if (!selectedServerByUserId[activeUserId]) {
        selectedServerByUserId[activeUserId] = { serverId: null, serverUri: null };
    }
    return selectedServerByUserId;
}

function resolveValidatedToken<TToken extends Phase2StoredCredentials['activeToken']>(
    currentToken: TToken | null,
    fallbackToken: TToken
): TToken {
    if (currentToken?.token === fallbackToken.token) {
        return currentToken;
    }
    return fallbackToken;
}

function isDiscoveryAuthRecoveryError(error: unknown): boolean {
    const code = (error as { code?: string } | null)?.code;
    return (
        code === AppErrorCode.AUTH_REQUIRED
        || code === AppErrorCode.AUTH_INVALID
        || code === AppErrorCode.AUTH_EXPIRED
    );
}

function markAuthReady(inputs: Phase2AuthGateInputs): void {
    inputs.updateModuleStatus(
        'plex-auth',
        'ready',
        undefined,
        Date.now() - inputs.startTime
    );

    if (inputs.lifecycle) {
        inputs.lifecycle.setPhase('loading_data');
    }
}

async function routeToPendingAuth(inputs: Phase2AuthGateInputs, error?: AppError): Promise<boolean> {
    if (error) {
        inputs.updateModuleStatus('plex-auth', 'pending', error);
    } else {
        inputs.updateModuleStatus('plex-auth', 'pending');
    }
    inputs.handlers.registerAuthResume();
    inputs.navigation.goTo('auth');
    return false;
}

async function maybeRouteToProfileSelect(inputs: Phase2AuthGateInputs): Promise<boolean> {
    const currentScreen = inputs.navigation.getCurrentScreen();
    const isAuthScreen = currentScreen === 'auth';
    const showPickerOnStartup = inputs.readShowProfilePickerOnStartup();
    if (!isAuthScreen && !showPickerOnStartup) {
        return true;
    }

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
            return routeToPendingAuth(inputs);
        }
        throw error;
    }

    return true;
}

async function persistValidatedActiveCredentials(
    inputs: Phase2AuthGateInputs,
    storedCredentials: Phase2StoredCredentials
): Promise<void> {
    const validatedActiveToken = resolveValidatedToken(
        inputs.plexAuth.getCurrentUser(),
        storedCredentials.activeToken
    );
    const activeUserId = storedCredentials.activeUserId || validatedActiveToken.userId;
    const accountToken = storedCredentials.accountToken.token === validatedActiveToken.token
        ? validatedActiveToken
        : storedCredentials.accountToken;

    await inputs.plexAuth.storeCredentials({
        accountToken,
        activeToken: validatedActiveToken,
        activeUserId,
        selectedServerByUserId: buildSelectedServerByUserId(storedCredentials, activeUserId),
        deviceKey: storedCredentials.deviceKey ?? null,
    });
}

async function persistValidatedAccountFallback(
    inputs: Phase2AuthGateInputs,
    storedCredentials: Phase2StoredCredentials
): Promise<void> {
    const validatedAccountToken = resolveValidatedToken(
        inputs.plexAuth.getCurrentUser(),
        storedCredentials.accountToken
    );

    await inputs.plexAuth.storeCredentials({
        accountToken: validatedAccountToken,
        activeToken: validatedAccountToken,
        activeUserId: validatedAccountToken.userId,
        selectedServerByUserId: buildSelectedServerByUserId(
            storedCredentials,
            validatedAccountToken.userId
        ),
        deviceKey: storedCredentials.deviceKey ?? null,
    });
}

export async function applyPhase2AuthGatePolicy(inputs: Phase2AuthGateInputs): Promise<boolean> {
    const storedReadResult = await inputs.plexAuth.readStoredCredentialsAndClearCorruption();
    if (storedReadResult.kind === 'corrupted') {
        return routeToPendingAuth(inputs, {
            code: AppErrorCode.STORAGE_CORRUPTED,
            message: 'Stored Plex auth credentials were invalid and were cleared.',
            recoverable: true,
        });
    }

    if (storedReadResult.kind !== 'available') {
        return routeToPendingAuth(inputs);
    }

    const storedCredentials = storedReadResult.credentials;

    try {
        const activeValid = await inputs.plexAuth.validateToken(
            storedCredentials.activeToken.token
        );
        if (activeValid) {
            await persistValidatedActiveCredentials(inputs, storedCredentials);
            inputs.configureDiscoveryStorage();
            inputs.seedSubtitleLanguageFromPlexUser?.();
            markAuthReady(inputs);
            return maybeRouteToProfileSelect(inputs);
        }

        const accountValid = await inputs.plexAuth.validateToken(
            storedCredentials.accountToken.token
        );
        if (!accountValid) {
            return routeToPendingAuth(inputs);
        }

        await persistValidatedAccountFallback(inputs, storedCredentials);
        markAuthReady(inputs);
        inputs.handlers.registerProfileResume();
        inputs.navigation.goTo('profile-select');
        return false;
    } catch (error) {
        const code = (error as { code?: string }).code;
        if (
            code === AppErrorCode.AUTH_REQUIRED ||
            code === AppErrorCode.AUTH_INVALID
        ) {
            return routeToPendingAuth(inputs);
        }

        throw error;
    }
}

export async function applyPhase3ServerGatePolicy(inputs: Phase3ServerGateInputs): Promise<boolean> {
    inputs.updateModuleStatus('plex-server-discovery', 'initializing');
    try {
        await inputs.plexDiscovery.initialize();
    } catch (error) {
        if (isDiscoveryAuthRecoveryError(error)) {
            throw error;
        }
        inputs.updateModuleStatus(
            'plex-server-discovery',
            'error',
            toRecoverableModuleStatusError(error, 'Server discovery failed during startup.')
        );
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
