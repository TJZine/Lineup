import type { AppError, IAppLifecycle } from '../../modules/lifecycle';
import { AppErrorCode } from '../../types/app-errors';
import type { ChannelSwitchOutcome } from '../../types/channelSwitch';
import type { INavigationManager } from '../../modules/navigation';
import {
    type IPlexAuth,
    type PlexAuthValidationGuard,
    isPlexAuthOperationSupersededError,
    isPlexAuthRecoverable,
} from '../../modules/plex/auth';
import type { IPlexServerDiscovery, PlexSavedServerRestoreResult } from '../../modules/plex/discovery';
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
    'validateStoredCredentials' | 'getHomeUsers'
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

export type AuthValidationPolicyResult =
    | { kind: 'stop' }
    | { kind: 'continue'; guard: PlexAuthValidationGuard };

function createSavedServerRestoreError(restoreResult: PlexSavedServerRestoreResult): AppError | undefined {
    if (restoreResult.kind !== 'selection_failed') {
        return undefined;
    }
    const message = restoreResult.reason === 'server_not_found'
        ? 'Saved Plex server is no longer available.'
        : restoreResult.reason === 'auth_required'
            ? 'Saved Plex server requires authentication.'
            : restoreResult.reason === 'access_denied'
                ? 'Saved Plex server access was denied.'
                : 'Saved Plex server is unreachable.';
    return {
        code: restoreResult.reason === 'auth_required'
            ? AppErrorCode.AUTH_REQUIRED
            : restoreResult.reason === 'access_denied'
                ? AppErrorCode.ACCESS_DENIED
                : AppErrorCode.SERVER_UNREACHABLE,
        message,
        recoverable: true,
        context: {
            serverId: restoreResult.serverId,
            reason: restoreResult.reason,
        },
    };
}

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
        switch (outcome.kind) {
            case 'switched':
                inputs.navigation.replaceScreen('player');
                return;
            case 'aborted':
                throw new Error(`Initial channel switch aborted for ${channelToPlay.id}.`);
            case 'failed': {
                const reason = outcome.reason;
                switch (reason) {
                    case 'missing_channel':
                        inputs.navigation.replaceScreen('channel-setup');
                        return;
                    case 'missing_dependencies':
                    case 'content_unavailable':
                    case 'playback_start_failed':
                        throw new Error(`Initial channel switch failed for ${channelToPlay.id}: ${reason}.`);
                    default:
                        return assertUnhandledChannelSwitchOutcome(reason);
                }
            }
            default:
                return assertUnhandledChannelSwitchOutcome(outcome);
        }
    }

    throwIfStartupAborted(inputs.signal);
    inputs.openServerSelect();
}

function assertUnhandledChannelSwitchOutcome(value: never): never {
    throw new Error(`Unhandled initial channel switch outcome: ${String(value)}`);
}

function assertAuthCurrent(
    inputs: AuthValidationPolicyInputs,
    guard: PlexAuthValidationGuard
): void {
    throwIfStartupAborted(inputs.signal);
    guard.assertCurrent();
}

function markAuthReady(inputs: AuthValidationPolicyInputs, guard: PlexAuthValidationGuard): void {
    assertAuthCurrent(inputs, guard);
    inputs.updateModuleStatus(
        'plex-auth',
        'ready',
        undefined,
        Date.now() - inputs.startTime
    );

    if (inputs.lifecycle) {
        assertAuthCurrent(inputs, guard);
        inputs.lifecycle.setPhase('loading_data');
    }
}

function routeToPendingAuth(
    inputs: AuthValidationPolicyInputs,
    guard: PlexAuthValidationGuard,
    error?: AppError
): AuthValidationPolicyResult {
    assertAuthCurrent(inputs, guard);
    if (error) {
        inputs.updateModuleStatus('plex-auth', 'pending', error);
    } else {
        inputs.updateModuleStatus('plex-auth', 'pending');
    }
    assertAuthCurrent(inputs, guard);
    inputs.handlers.registerAuthResume();
    assertAuthCurrent(inputs, guard);
    inputs.navigation.goTo('auth');
    return { kind: 'stop' };
}

async function maybeRouteToProfileSelect(
    inputs: AuthValidationPolicyInputs,
    guard: PlexAuthValidationGuard
): Promise<AuthValidationPolicyResult> {
    assertAuthCurrent(inputs, guard);
    const currentScreen = inputs.navigation.getCurrentScreen();
    const isAuthScreen = currentScreen === 'auth';
    const showPickerOnStartup = inputs.readShowProfilePickerOnStartup();
    if (!isAuthScreen && !showPickerOnStartup) {
        return { kind: 'continue', guard };
    }

    try {
        assertAuthCurrent(inputs, guard);
        const users = await inputs.plexAuth.getHomeUsers({ signal: inputs.signal ?? null });
        assertAuthCurrent(inputs, guard);
        if (users.length > 1) {
            assertAuthCurrent(inputs, guard);
            inputs.handlers.registerProfileResume();
            assertAuthCurrent(inputs, guard);
            inputs.navigation.goTo('profile-select');
            return { kind: 'stop' };
        }
    } catch (error) {
        assertAuthCurrent(inputs, guard);
        if (isPlexAuthRecoverable(error)) {
            return routeToPendingAuth(inputs, guard);
        }
        throw error;
    }

    return { kind: 'continue', guard };
}

export async function applyAuthValidationPolicy(
    inputs: AuthValidationPolicyInputs
): Promise<AuthValidationPolicyResult> {
    throwIfStartupAborted(inputs.signal);
    try {
        const result = await inputs.plexAuth.validateStoredCredentials({
            signal: inputs.signal ?? null,
        });
        assertAuthCurrent(inputs, result.guard);
        if (result.kind === 'corrupted') {
            return routeToPendingAuth(inputs, result.guard, {
                code: AppErrorCode.STORAGE_CORRUPTED,
                message: 'Stored Plex auth credentials were invalid and were cleared.',
                recoverable: true,
            });
        }
        if (result.kind === 'missing' || result.kind === 'invalid') {
            return routeToPendingAuth(inputs, result.guard);
        }
        if (result.kind === 'active_valid') {
            assertAuthCurrent(inputs, result.guard);
            inputs.configureDiscoveryStorage();
            markAuthReady(inputs, result.guard);
            return maybeRouteToProfileSelect(inputs, result.guard);
        }
        markAuthReady(inputs, result.guard);
        assertAuthCurrent(inputs, result.guard);
        inputs.handlers.registerProfileResume();
        assertAuthCurrent(inputs, result.guard);
        inputs.navigation.goTo('profile-select');
        return { kind: 'stop' };
    } catch (error) {
        if (isPlexAuthOperationSupersededError(error)) return { kind: 'stop' };
        if (isPlexAuthRecoverable(error)) {
            // A current owner-created invalid result routes above; thrown auth failures have no safe guard.
            throw error;
        }
        throw error;
    }
}

export async function applyServerConnectionPolicy(inputs: ServerConnectionPolicyInputs): Promise<boolean> {
    throwIfStartupAborted(inputs.signal);
    inputs.updateModuleStatus('plex-server-discovery', 'initializing');
    let savedServerRestore: PlexSavedServerRestoreResult;
    try {
        savedServerRestore = await inputs.plexDiscovery.initialize({ signal: inputs.signal ?? null });
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
        const restoreError = createSavedServerRestoreError(savedServerRestore);
        inputs.updateModuleStatus('plex-server-discovery', 'pending', undefined, elapsedMs);
        inputs.updateModuleStatus('plex-library', 'pending', restoreError, elapsedMs);
        inputs.updateModuleStatus('plex-stream-resolver', 'pending', restoreError, elapsedMs);
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
