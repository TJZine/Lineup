import type { AppError, IAppLifecycle } from '../../modules/lifecycle';
import { AppErrorCode } from '../../types/app-errors';
import type { ChannelSwitchOutcome } from '../../types/channelSwitch';
import type { INavigationManager } from '../../modules/navigation';
import { type IPlexAuth, isPlexAuthRecoverable } from '../../modules/plex/auth';
import type { IPlexServerDiscovery } from '../../modules/plex/discovery';
import type { IPlexLibrary } from '../../modules/plex/library';
import type { IPlexStreamResolver } from '../../modules/plex/stream';
import type { IChannelManager } from '../../modules/scheduler/channel-manager';
import type { ModuleStatus } from '../orchestrator/contracts/OrchestratorTypes';
import { throwIfStartupAborted } from './InitializationAbort';
import { toRecoverableModuleStatusError } from './RecoverableModuleStatusError';
import type { StartupSignalOptions } from './InitializationAbort';

type UpdateModuleStatus = (
    id: string,
    status: ModuleStatus['status'],
    error?: AppError,
    loadTimeMs?: number
) => void;

type AuthValidationPlexAuth = Pick<
    IPlexAuth,
    'readStoredCredentialsAndClearCorruption' | 'validateToken' | 'getCurrentUser' | 'storeCredentials' | 'getHomeUsers'
>;

type AuthValidationNavigation = Pick<INavigationManager, 'getCurrentScreen' | 'goTo'>;

type AuthValidationLifecycle = Pick<IAppLifecycle, 'setPhase'>;

export interface StartupResumeHandlers {
    registerAuthResume(): void;
    registerServerResume(): void;
    registerProfileResume(): void;
}

export interface AuthValidationPolicyInputs extends StartupSignalOptions {
    startTime: number;
    plexAuth: AuthValidationPlexAuth;
    navigation: AuthValidationNavigation;
    lifecycle: AuthValidationLifecycle | null;
    updateModuleStatus: UpdateModuleStatus;
    configureDiscoveryStorage: () => void;
    readShowProfilePickerOnStartup: () => boolean;
    handlers: Pick<StartupResumeHandlers, 'registerAuthResume' | 'registerProfileResume'>;
}

export interface ServerConnectionPolicyInputs extends StartupSignalOptions {
    startTime: number;
    plexDiscovery: IPlexServerDiscovery;
    plexLibrary: IPlexLibrary;
    plexStreamResolver: IPlexStreamResolver;
    navigation: INavigationManager;
    updateModuleStatus: UpdateModuleStatus;
    handlers: Pick<StartupResumeHandlers, 'registerServerResume'>;
}

export interface PostReadyRoutingInputs extends StartupSignalOptions {
    navigation: Pick<INavigationManager, 'replaceScreen'>;
    channelManager: Pick<IChannelManager, 'getCurrentChannel' | 'getAllChannels'> | null;
    shouldRunAudioSetup: () => boolean;
    shouldRunChannelSetup: () => boolean;
    switchToChannel: (id: string) => Promise<ChannelSwitchOutcome>;
    openServerSelect: () => void;
}

type AuthStoredCredentials = Extract<
    Awaited<ReturnType<AuthValidationPlexAuth['readStoredCredentialsAndClearCorruption']>>,
    { kind: 'available' }
>['credentials'];

export async function applyPostReadyRoutingPolicy(inputs: PostReadyRoutingInputs): Promise<void> {
    throwIfStartupAborted(inputs.signal);
    const shouldRunAudioSetup = inputs.shouldRunAudioSetup();
    const shouldRunSetup = inputs.shouldRunChannelSetup();
    throwIfStartupAborted(inputs.signal);

    if (shouldRunAudioSetup && shouldRunSetup) {
        throwIfStartupAborted(inputs.signal);
        inputs.navigation.replaceScreen('audio-setup');
        return;
    }

    if (shouldRunSetup) {
        throwIfStartupAborted(inputs.signal);
        inputs.navigation.replaceScreen('channel-setup');
        return;
    }

    if (!inputs.channelManager) {
        throwIfStartupAborted(inputs.signal);
        inputs.openServerSelect();
        return;
    }

    let channelToPlay = inputs.channelManager.getCurrentChannel();

    if (!channelToPlay) {
        const allChannels = inputs.channelManager.getAllChannels();
        const firstChannel = allChannels[0];
        if (firstChannel) {
            channelToPlay = firstChannel;
        }
    }

    if (channelToPlay) {
        throwIfStartupAborted(inputs.signal);
        const outcome = await inputs.switchToChannel(channelToPlay.id);
        throwIfStartupAborted(inputs.signal);
        if (outcome === 'failed') {
            throw new Error(`Initial channel switch failed for ${channelToPlay.id}.`);
        }
        if (outcome === 'aborted') {
            throw new Error(`Initial channel switch aborted for ${channelToPlay.id}.`);
        }
        inputs.navigation.replaceScreen('player');
        return;
    }

    throwIfStartupAborted(inputs.signal);
    inputs.navigation.replaceScreen('player');
    inputs.openServerSelect();
}

function buildSelectedServerByUserId(
    storedCredentials: AuthStoredCredentials,
    activeUserId: string
): AuthStoredCredentials['selectedServerByUserId'] {
    const selectedServerByUserId = {
        ...(storedCredentials.selectedServerByUserId ?? {}),
    };
    if (!selectedServerByUserId[activeUserId]) {
        selectedServerByUserId[activeUserId] = { serverId: null, serverUri: null };
    }
    return selectedServerByUserId;
}

function resolveValidatedToken<TToken extends AuthStoredCredentials['activeToken']>(
    currentToken: TToken | null,
    fallbackToken: TToken
): TToken {
    if (currentToken?.token === fallbackToken.token) {
        return currentToken;
    }
    return fallbackToken;
}

function markAuthReady(inputs: AuthValidationPolicyInputs): void {
    throwIfStartupAborted(inputs.signal);
    inputs.updateModuleStatus(
        'plex-auth',
        'ready',
        undefined,
        Date.now() - inputs.startTime
    );

    if (inputs.lifecycle) {
        throwIfStartupAborted(inputs.signal);
        inputs.lifecycle.setPhase('loading_data');
    }
}

function routeToPendingAuth(inputs: AuthValidationPolicyInputs, error?: AppError): boolean {
    throwIfStartupAborted(inputs.signal);
    if (error) {
        inputs.updateModuleStatus('plex-auth', 'pending', error);
    } else {
        inputs.updateModuleStatus('plex-auth', 'pending');
    }
    throwIfStartupAborted(inputs.signal);
    inputs.handlers.registerAuthResume();
    throwIfStartupAborted(inputs.signal);
    inputs.navigation.goTo('auth');
    return false;
}

async function maybeRouteToProfileSelect(inputs: AuthValidationPolicyInputs): Promise<boolean> {
    throwIfStartupAborted(inputs.signal);
    const currentScreen = inputs.navigation.getCurrentScreen();
    const isAuthScreen = currentScreen === 'auth';
    const showPickerOnStartup = inputs.readShowProfilePickerOnStartup();
    if (!isAuthScreen && !showPickerOnStartup) {
        return true;
    }

    try {
        throwIfStartupAborted(inputs.signal);
        const users = await inputs.plexAuth.getHomeUsers({ signal: inputs.signal ?? null });
        throwIfStartupAborted(inputs.signal);
        if (users.length > 1) {
            inputs.handlers.registerProfileResume();
            throwIfStartupAborted(inputs.signal);
            inputs.navigation.goTo('profile-select');
            return false;
        }
    } catch (error) {
        if (isPlexAuthRecoverable(error)) {
            return routeToPendingAuth(inputs);
        }
        throw error;
    }

    return true;
}

function persistValidatedActiveCredentials(
    inputs: AuthValidationPolicyInputs,
    storedCredentials: AuthStoredCredentials
): void {
    throwIfStartupAborted(inputs.signal);
    const validatedActiveToken = resolveValidatedToken(
        inputs.plexAuth.getCurrentUser(),
        storedCredentials.activeToken
    );
    const activeUserId = storedCredentials.activeUserId || validatedActiveToken.userId;
    const accountToken = storedCredentials.accountToken.token === validatedActiveToken.token
        ? validatedActiveToken
        : storedCredentials.accountToken;

    throwIfStartupAborted(inputs.signal);
    inputs.plexAuth.storeCredentials({
        accountToken,
        activeToken: validatedActiveToken,
        activeUserId,
        selectedServerByUserId: buildSelectedServerByUserId(storedCredentials, activeUserId),
        deviceKey: storedCredentials.deviceKey ?? null,
    });
}

function persistValidatedAccountFallback(
    inputs: AuthValidationPolicyInputs,
    storedCredentials: AuthStoredCredentials
): void {
    throwIfStartupAborted(inputs.signal);
    const validatedAccountToken = resolveValidatedToken(
        inputs.plexAuth.getCurrentUser(),
        storedCredentials.accountToken
    );

    throwIfStartupAborted(inputs.signal);
    inputs.plexAuth.storeCredentials({
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

export async function applyAuthValidationPolicy(inputs: AuthValidationPolicyInputs): Promise<boolean> {
    throwIfStartupAborted(inputs.signal);
    const storedReadResult = inputs.plexAuth.readStoredCredentialsAndClearCorruption();
    throwIfStartupAborted(inputs.signal);
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
        throwIfStartupAborted(inputs.signal);
        const activeValid = await inputs.plexAuth.validateToken(
            storedCredentials.activeToken.token,
            { signal: inputs.signal ?? null }
        );
        throwIfStartupAborted(inputs.signal);
        if (activeValid) {
            persistValidatedActiveCredentials(inputs, storedCredentials);
            throwIfStartupAborted(inputs.signal);
            inputs.configureDiscoveryStorage();
            throwIfStartupAborted(inputs.signal);
            markAuthReady(inputs);
            return maybeRouteToProfileSelect(inputs);
        }

        throwIfStartupAborted(inputs.signal);
        const accountValid = await inputs.plexAuth.validateToken(
            storedCredentials.accountToken.token,
            { signal: inputs.signal ?? null }
        );
        throwIfStartupAborted(inputs.signal);
        if (!accountValid) {
            return routeToPendingAuth(inputs);
        }

        persistValidatedAccountFallback(inputs, storedCredentials);
        throwIfStartupAborted(inputs.signal);
        markAuthReady(inputs);
        throwIfStartupAborted(inputs.signal);
        inputs.handlers.registerProfileResume();
        throwIfStartupAborted(inputs.signal);
        inputs.navigation.goTo('profile-select');
        return false;
    } catch (error) {
        if (isPlexAuthRecoverable(error)) {
            return routeToPendingAuth(inputs);
        }

        throw error;
    }
}

export async function applyServerConnectionPolicy(inputs: ServerConnectionPolicyInputs): Promise<boolean> {
    throwIfStartupAborted(inputs.signal);
    inputs.updateModuleStatus('plex-server-discovery', 'initializing');
    try {
        await inputs.plexDiscovery.initialize({ signal: inputs.signal ?? null });
        throwIfStartupAborted(inputs.signal);
    } catch (error) {
        if (isPlexAuthRecoverable(error)) {
            throw error;
        }
        throwIfStartupAborted(inputs.signal);
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
    throwIfStartupAborted(inputs.signal);

    if (!isConnected) {
        inputs.updateModuleStatus('plex-server-discovery', 'pending', undefined, elapsedMs);
        inputs.updateModuleStatus('plex-library', 'pending', undefined, elapsedMs);
        inputs.updateModuleStatus('plex-stream-resolver', 'pending', undefined, elapsedMs);
        throwIfStartupAborted(inputs.signal);
        inputs.handlers.registerServerResume();
        throwIfStartupAborted(inputs.signal);
        inputs.navigation.goTo('server-select');
        return false;
    }

    throwIfStartupAborted(inputs.signal);
    inputs.updateModuleStatus('plex-server-discovery', 'ready', undefined, elapsedMs);
    inputs.updateModuleStatus('plex-library', 'ready', undefined, elapsedMs);
    inputs.updateModuleStatus('plex-stream-resolver', 'ready', undefined, elapsedMs);
    return true;
}
