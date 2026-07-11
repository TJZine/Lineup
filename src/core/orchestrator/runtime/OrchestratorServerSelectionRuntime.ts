import type { IPlexAuth } from '../../../modules/plex/auth';
import {
    type PlexDiscoverySignalOptions,
    type IPlexServerDiscovery,
    type PlexServerSelectionResult,
    isPlexDiscoverySelectionSupersededError,
} from '../../../modules/plex/discovery';
import type {
    EPGCoordinator,
    IEPGComponent,
} from '../../../modules/ui/epg';
import {
    InitializationCoordinator,
    STARTUP_PHASE,
} from '../../initialization/InitializationCoordinator';
import {
    ServerSelectionCoordinator,
} from '../../server-selection/ServerSelectionCoordinator';
import {
    SelectedServerPersistenceAdapter,
} from '../../server-selection/SelectedServerPersistenceAdapter';
import {
    SelectedServerRuntimeController,
} from '../../server-selection/SelectedServerRuntimeController';
import {
    isSelectionAbortError,
    throwIfSelectionAborted,
} from '../../server-selection/ServerSelectionAbort';
import type {
    DiscoverySelectedServerSnapshot,
    OrchestratorServerSelectionReadiness,
    OrchestratorServerSelectionResult,
    PersistedSelectedServerSnapshot,
    SelectedServerPersistenceResult,
    SelectedServerStartupResumeResult,
} from '../../server-selection/ServerSelectionTypes';
import {
    captureRecoverableRuntimeResultAsync,
} from './OrchestratorRecoverableRuntimeResult';
import type {
    EpgScheduleRefreshOutcome,
    EpgScheduleRefreshResult,
} from '../../../shared/epgRefresh';

function toEpgScheduleRefreshOutcome(result: EpgScheduleRefreshResult): EpgScheduleRefreshOutcome {
    switch (result.readiness) {
        case 'ready':
            return { kind: 'succeeded', result: { ...result, readiness: result.readiness } };
        case 'superseded':
            return { kind: 'superseded', result: { ...result, readiness: result.readiness } };
        case 'skipped':
        case 'partial':
        case 'failed':
            return { kind: 'degraded', result: { ...result, readiness: result.readiness } };
        default:
            return assertUnhandledEpgRefreshReadiness(result.readiness);
    }
}

function assertUnhandledEpgRefreshReadiness(readiness: never): never {
    throw new Error(`Unhandled EPG refresh readiness: ${String(readiness)}`);
}

export interface OrchestratorServerSelectionRuntimeDeps {
    assertNotShutdown(method: string): void;
    getPlexAuth(): IPlexAuth | null;
    getPlexDiscovery(): IPlexServerDiscovery | null;
    getInitializationCoordinator(): InitializationCoordinator | null;
    getEpg(): IEPGComponent | null;
    getEpgCoordinator(): EPGCoordinator | null;
    isReady(): boolean;
    reportError(event: string, message: string, error: unknown, data?: Record<string, unknown>): void;
    throwModuleInitPreconditionError(
        message: string,
        context: Record<string, unknown>
    ): never;
}

export class OrchestratorServerSelectionRuntime {
    private readonly _selectedServerPersistenceAdapter: SelectedServerPersistenceAdapter;
    private readonly _selectedServerRuntimeController: SelectedServerRuntimeController;
    private readonly _serverSelectionCoordinator: ServerSelectionCoordinator;
    private _serverSwapEpgRollbackPending = false;

    constructor(private readonly _deps: OrchestratorServerSelectionRuntimeDeps) {
        this._selectedServerPersistenceAdapter = new SelectedServerPersistenceAdapter({
            getCredentialsPort: (): IPlexAuth | null => this._deps.getPlexAuth(),
        });
        this._selectedServerRuntimeController = new SelectedServerRuntimeController({
            capturePersistedSelectionSnapshot: (): Promise<PersistedSelectedServerSnapshot> =>
                this._selectedServerPersistenceAdapter.capturePersistedSelectionSnapshot(),
            persistSelection: (
                serverId: string | null,
                serverUri: string | null
            ): Promise<SelectedServerPersistenceResult> =>
                this._selectedServerPersistenceAdapter.persistSelection(serverId, serverUri),
            restorePersistedSelectionSnapshot: (
                snapshot: PersistedSelectedServerSnapshot
            ): Promise<SelectedServerPersistenceResult> =>
                this._selectedServerPersistenceAdapter.restorePersistedSelectionSnapshot(snapshot),
            resumeStartupAfterSelection: (
                options?: PlexDiscoverySignalOptions
            ): Promise<SelectedServerStartupResumeResult> =>
                this._resumeStartupAfterSelectedServerChange(options),
            clearDiscoverySelection: (): void => {
                const plexDiscovery = this._deps.getPlexDiscovery();
                if (!plexDiscovery) {
                    this._deps.throwModuleInitPreconditionError(
                        'IPlexServerDiscovery not initialized while clearing selected server',
                        {
                            method: 'clearSelectedServer',
                            dependency: 'IPlexServerDiscovery',
                        }
                    );
                }
                try {
                    plexDiscovery.clearSelection();
                } catch (error) {
                    if (!isPlexDiscoverySelectionSupersededError(error)) throw error;
                }
            },
        });
        this._serverSelectionCoordinator = new ServerSelectionCoordinator({
            captureDiscoverySelectionSnapshot: (): DiscoverySelectedServerSnapshot =>
                this._captureDiscoverySelectedServerSnapshot(),
            restoreDiscoverySelectionSnapshot: (snapshot: DiscoverySelectedServerSnapshot): void => {
                this._restoreDiscoverySelectedServerSnapshot(snapshot);
            },
            capturePersistedSelectionSnapshot: (): Promise<PersistedSelectedServerSnapshot> =>
                this._selectedServerRuntimeController.capturePersistedSelectionSnapshot(),
            selectServer: async (
                serverId: string,
                options?: PlexDiscoverySignalOptions
            ): Promise<PlexServerSelectionResult> => {
                this._deps.getInitializationCoordinator()?.clearServerResume();
                const plexDiscovery = this._requirePlexDiscovery('selectServer');
                return plexDiscovery.selectServer(serverId, options);
            },
            getSelectedServerUri: (): string | null =>
                this._deps.getPlexDiscovery()?.getServerUri() ?? null,
            persistSelection: async (
                serverId: string,
                serverUri: string | null
            ): Promise<SelectedServerPersistenceResult> =>
                this._selectedServerRuntimeController.persistSelection(serverId, serverUri),
            restorePersistedSelectionSnapshot: (
                snapshot: PersistedSelectedServerSnapshot
            ): Promise<SelectedServerPersistenceResult> =>
                this._selectedServerRuntimeController.restorePersistedSelectionSnapshot(snapshot),
            resumeStartupAfterSelection: (
                options?: PlexDiscoverySignalOptions
            ): Promise<SelectedServerStartupResumeResult> =>
                this._selectedServerRuntimeController.resumeStartupAfterSelection(options),
            rollbackStartupAfterSelectionFailure: (): void => {
                this._rollbackServerSwapEpgSideEffects();
            },
            getReadiness: (): OrchestratorServerSelectionReadiness =>
                (this._deps.isReady() ? 'ready' : 'startup_pending'),
        });
    }

    getSelectedServerId(): string | null {
        const plexDiscovery = this._deps.getPlexDiscovery();
        if (!plexDiscovery) {
            return null;
        }
        if (!plexDiscovery.isConnected() || !plexDiscovery.getSelectedConnection()) {
            return null;
        }
        const server = plexDiscovery.getSelectedServer();
        return server ? server.id : null;
    }

    async selectServer(
        serverId: string,
        options?: PlexDiscoverySignalOptions
    ): Promise<OrchestratorServerSelectionResult> {
        this._requirePlexDiscovery('selectServer');
        return this._serverSelectionCoordinator.selectServer(serverId, options);
    }

    async clearSelectedServer(): Promise<void> {
        this._requirePlexDiscovery('clearSelectedServer');
        await this._selectedServerRuntimeController.clearSelection();
    }

    private _requirePlexDiscovery(method: 'selectServer' | 'clearSelectedServer'): IPlexServerDiscovery {
        this._deps.assertNotShutdown(method);
        const plexDiscovery = this._deps.getPlexDiscovery();
        if (!plexDiscovery) {
            this._deps.throwModuleInitPreconditionError('PlexServerDiscovery not initialized', {
                method,
                dependency: 'PlexServerDiscovery',
            });
        }
        return plexDiscovery;
    }

    private _captureDiscoverySelectedServerSnapshot(): DiscoverySelectedServerSnapshot {
        const plexDiscovery = this._deps.getPlexDiscovery();
        if (!plexDiscovery) {
            return {
                server: null,
                connection: null,
                storedServerId: null,
            };
        }

        return plexDiscovery.captureSelectedServerSnapshot();
    }

    private _restoreDiscoverySelectedServerSnapshot(snapshot: DiscoverySelectedServerSnapshot): void {
        this._deps.getPlexDiscovery()?.restoreSelectedServerSnapshot(snapshot);
    }

    private async _resumeStartupAfterSelectedServerChange(
        options?: PlexDiscoverySignalOptions
    ): Promise<SelectedServerStartupResumeResult> {
        this._serverSwapEpgRollbackPending = false;
        const signal = options?.signal;
        const initCoordinator = this._deps.getInitializationCoordinator();
        if (!initCoordinator) {
            return {
                startup: 'skipped_no_coordinator',
                epgRefresh: { kind: 'skipped_no_coordinator' },
            };
        }

        let step = 'runStartup';

        try {
            throwIfSelectionAborted(signal);
            await initCoordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION, options);
            throwIfSelectionAborted(signal);

            const epgCoordinator = this._deps.getEpgCoordinator();
            if (!epgCoordinator) {
                return {
                    startup: 'completed',
                    epgRefresh: { kind: 'skipped_no_coordinator' },
                };
            }
            const epg = this._deps.getEpg();

            step = 'clearSelectedChannelScheduleSnapshot';
            throwIfSelectionAborted(signal);
            this._serverSwapEpgRollbackPending = true;
            epgCoordinator.clearSelectedChannelScheduleSnapshot();

            step = 'clearScheduleCaches';
            epgCoordinator.clearScheduleCaches();

            if (epg) {
                step = 'clearSchedules';
                epg.clearSchedules();
            }

            step = 'primeEpgChannels';
            epgCoordinator.primeEpgChannels();

            step = 'refreshEpgSchedules';
            const refreshOptions = signal
                ? { reason: 'server-swap', signal }
                : { reason: 'server-swap' };
            const refreshResult = await captureRecoverableRuntimeResultAsync(
                async () => epgCoordinator.refreshEpgSchedules(refreshOptions)
            );
            if (!refreshResult.ok) {
                if (isSelectionAbortError(refreshResult.error, signal)) {
                    throw refreshResult.error;
                }
                this._deps.reportError(
                    'orchestrator.serverSwap.refreshEpgSchedules',
                    'Post-selection EPG refresh failed',
                    refreshResult.error,
                    { step }
                );
                this._serverSwapEpgRollbackPending = false;
                return {
                    startup: 'completed',
                    epgRefresh: { kind: 'failed', error: refreshResult.error },
                };
            }
            this._serverSwapEpgRollbackPending = false;
            return {
                startup: 'completed',
                epgRefresh: toEpgScheduleRefreshOutcome(refreshResult.value),
            };
        } catch (error) {
            if (isSelectionAbortError(error, signal)) {
                throw error;
            }
            this._deps.reportError(
                'orchestrator.serverSwap.runStartup',
                'Post-selection runtime swap failed',
                error,
                { step }
            );
            throw error;
        }
    }

    private _rollbackServerSwapEpgSideEffects(): void {
        if (!this._serverSwapEpgRollbackPending) {
            return;
        }
        this._serverSwapEpgRollbackPending = false;
        const epgCoordinator = this._deps.getEpgCoordinator();
        const epg = this._deps.getEpg();
        epgCoordinator?.clearSelectedChannelScheduleSnapshot();
        epgCoordinator?.clearScheduleCaches();
        epg?.clearSchedules();
    }
}
