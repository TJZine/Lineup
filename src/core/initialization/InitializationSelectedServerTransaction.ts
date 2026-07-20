import {
    isPlexAuthOperationSupersededError,
    isPlexAuthRecoverable,
    type IPlexAuth,
} from '../../modules/plex/auth';
import type { INavigationManager } from '../../modules/navigation';
import type { IChannelManager } from '../../modules/scheduler/channel-manager';
import type { ChannelSwitchOutcome } from '../../types/channelSwitch';
import type { OperationContextUpstream } from '../../utils/RetainedOperationContext';
import type { ChannelInitialTuneLineage } from '../channel-tuning/ChannelInitialTuneAuthority';
import type { EpgScheduleRefreshOutcome, EpgScheduleRefreshResult } from '../../shared/epgRefresh';
import { applyPostReadyRoutingPolicy } from './InitializationStartupPolicy';
import { createStartupPassValidity } from './InitializationAbort';

export type SelectedServerInitializationResult =
    | { kind: 'completed'; payload: { epgRefresh: EpgScheduleRefreshOutcome } }
    | { kind: 'stopped'; reason: 'auth_required' | 'server_unavailable' | 'superseded' }
    | { kind: 'failed'; error: unknown };

export interface SelectedServerInitializationRequest {
    lineage: ChannelInitialTuneLineage;
    signal: AbortSignal;
    assertCurrent(): void;
    commitOperation: OperationContextUpstream & { signal: AbortSignal };
    beforeCommit(operation: OperationContextUpstream): Promise<EpgScheduleRefreshResult>;
    initialTune(channelId: string, lineage: ChannelInitialTuneLineage): Promise<ChannelSwitchOutcome>;
}

export interface InitializationSelectedServerTransactionDeps {
    getPlexAuth(): Pick<IPlexAuth, 'validateStoredCredentials'> | null;
    isSelectedServerConnected(): boolean;
    initializePlaybackRuntime(signal: AbortSignal): Promise<void>;
    ensureCorePlayerUiInitialized(signal: AbortSignal): Promise<void>;
    initializeEpg(signal: AbortSignal): Promise<void>;
    getNavigation(): Pick<INavigationManager, 'replaceScreen'> | null;
    getChannelManager(): Pick<IChannelManager, 'getCurrentChannel' | 'getAllChannels'> | null;
    shouldRunAudioSetup(): boolean;
    shouldRunChannelSetup(): boolean;
    openServerSelect(): void;
    publishCommitStart(): void;
    setupEventWiring(): boolean;
    disposeEventWiring(): void;
    setReady(ready: boolean): void;
    publishLifecycleReady(): void;
    clearResumeHandlers(): void;
}

export class InitializationSelectedServerTransaction {
    constructor(private readonly _deps: InitializationSelectedServerTransactionDeps) {}

    async run(request: SelectedServerInitializationRequest): Promise<SelectedServerInitializationResult> {
        let establishedEventWiring = false;
        try {
            request.assertCurrent();
            const plexAuth = this._deps.getPlexAuth();
            if (!plexAuth) return { kind: 'stopped', reason: 'auth_required' };
            const auth = await plexAuth.validateStoredCredentials({ signal: request.signal });
            request.assertCurrent();
            auth.guard.assertCurrent();
            if (auth.kind !== 'active_valid') {
                return { kind: 'stopped', reason: 'auth_required' };
            }
            if (!this._deps.isSelectedServerConnected()) {
                return { kind: 'stopped', reason: 'server_unavailable' };
            }

            let validity = createStartupPassValidity(undefined, auth.guard, {
                signal: request.signal,
                assertCurrent: request.assertCurrent,
            });
            try {
                validity.assertCurrent();
                this._deps.setReady(false);
                await this._deps.initializePlaybackRuntime(validity.signal);
                validity.assertCurrent();
                await this._deps.ensureCorePlayerUiInitialized(validity.signal);
                validity.assertCurrent();
                await this._deps.initializeEpg(validity.signal);
                validity.assertCurrent();

                const epgRefresh = await this._runEpgBeforeCommit(request, validity);
                validity.assertCurrent();
                this._deps.publishCommitStart();
                validity.assertCurrent();
                validity.dispose();
                validity = createStartupPassValidity(
                    undefined,
                    auth.guard,
                    request.commitOperation
                );
                validity.assertCurrent();
                establishedEventWiring = this._deps.setupEventWiring();
                validity.assertCurrent();
                const navigation = this._deps.getNavigation();
                if (navigation) {
                    await applyPostReadyRoutingPolicy({
                        navigation,
                        channelManager: this._deps.getChannelManager(),
                        shouldRunAudioSetup: this._deps.shouldRunAudioSetup,
                        shouldRunChannelSetup: this._deps.shouldRunChannelSetup,
                        switchToChannel: (channelId) => request.initialTune(channelId, request.lineage),
                        openServerSelect: this._deps.openServerSelect,
                        signal: validity.signal,
                    });
                    validity.assertCurrent();
                }
                this._deps.setReady(true);
                validity.assertCurrent();
                this._deps.publishLifecycleReady();
                validity.assertCurrent();
                this._deps.clearResumeHandlers();
                validity.assertCurrent();
                return { kind: 'completed', payload: { epgRefresh } };
            } finally {
                validity.dispose();
            }
        } catch (error: unknown) {
            if (establishedEventWiring) {
                try {
                    this._deps.disposeEventWiring();
                } catch {
                    // Best-effort transaction compensation must preserve the primary failure.
                }
            }
            try {
                request.assertCurrent();
            } catch {
                return { kind: 'stopped', reason: 'superseded' };
            }
            if (isPlexAuthOperationSupersededError(error)) {
                return { kind: 'stopped', reason: 'superseded' };
            }
            if (isPlexAuthRecoverable(error)) {
                return { kind: 'stopped', reason: 'auth_required' };
            }
            return { kind: 'failed', error };
        }
    }

    private async _runEpgBeforeCommit(
        request: SelectedServerInitializationRequest,
        operation: OperationContextUpstream
    ): Promise<EpgScheduleRefreshOutcome> {
        try {
            operation.assertCurrent();
            const result = await request.beforeCommit(operation);
            operation.assertCurrent();
            switch (result.readiness) {
                case 'ready':
                    return { kind: 'succeeded', result: { ...result, readiness: 'ready' } };
                case 'superseded':
                    return { kind: 'superseded', result: { ...result, readiness: 'superseded' } };
                case 'skipped':
                case 'partial':
                case 'failed':
                    return { kind: 'degraded', result: { ...result, readiness: result.readiness } };
                default:
                    return assertUnhandledEpgRefreshReadiness(result.readiness);
            }
        } catch (error: unknown) {
            operation.assertCurrent();
            return { kind: 'failed', error };
        }
    }
}

function assertUnhandledEpgRefreshReadiness(readiness: never): never {
    throw new Error(`Unhandled EPG refresh readiness: ${String(readiness)}`);
}
