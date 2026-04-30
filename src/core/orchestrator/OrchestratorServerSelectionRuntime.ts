import type { IPlexAuth } from '../../modules/plex/auth';
import type {
    IPlexServerDiscovery,
    PlexServerSelectionResult,
} from '../../modules/plex/discovery';
import type {
    EPGCoordinator,
    IEPGComponent,
} from '../../modules/ui/epg';
import {
    InitializationCoordinator,
    STARTUP_PHASE,
} from '../initialization/InitializationCoordinator';
import {
    ServerSelectionCoordinator,
} from '../server-selection/ServerSelectionCoordinator';
import {
    SelectedServerPersistenceAdapter,
} from '../server-selection/SelectedServerPersistenceAdapter';
import {
    SelectedServerRuntimeController,
} from '../server-selection/SelectedServerRuntimeController';
import type {
    DiscoverySelectedServerSnapshot,
    OrchestratorServerSelectionReadiness,
    OrchestratorServerSelectionResult,
    PersistedSelectedServerSnapshot,
    SelectedServerPersistenceResult,
    SelectedServerStartupResumeResult,
} from '../server-selection/ServerSelectionTypes';
import {
    captureRecoverableRuntimeResultAsync,
} from './OrchestratorRecoverableRuntimeResult';

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
            resumeStartupAfterSelection: (): Promise<SelectedServerStartupResumeResult> =>
                this._resumeStartupAfterSelectedServerChange(),
            clearDiscoverySelection: (): void => {
                this._deps.getPlexDiscovery()?.clearSelection();
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
            selectServer: async (serverId: string): Promise<PlexServerSelectionResult> => {
                const plexDiscovery = this._requirePlexDiscovery('selectServer');
                return plexDiscovery.selectServer(serverId);
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
            resumeStartupAfterSelection: (): Promise<SelectedServerStartupResumeResult> =>
                this._selectedServerRuntimeController.resumeStartupAfterSelection(),
            getReadiness: (): OrchestratorServerSelectionReadiness =>
                (this._deps.isReady() ? 'ready' : 'startup_pending'),
        });
    }

    getSelectedServerId(): string | null {
        const plexDiscovery = this._deps.getPlexDiscovery();
        if (!plexDiscovery) {
            return null;
        }
        const server = plexDiscovery.getSelectedServer();
        return server ? server.id : null;
    }

    async selectServer(serverId: string): Promise<OrchestratorServerSelectionResult> {
        this._requirePlexDiscovery('selectServer');
        return this._serverSelectionCoordinator.selectServer(serverId);
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

    private async _resumeStartupAfterSelectedServerChange(): Promise<SelectedServerStartupResumeResult> {
        const initCoordinator = this._deps.getInitializationCoordinator();
        if (!initCoordinator) {
            return {
                startup: 'skipped_no_coordinator',
                epgRefresh: { kind: 'skipped_no_coordinator' },
            };
        }

        let step = 'runStartup';

        try {
            await initCoordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);

            const epg = this._deps.getEpg();
            if (epg) {
                const epgCoordinator = this._deps.getEpgCoordinator();

                step = 'clearSelectedChannelScheduleSnapshot';
                epgCoordinator?.clearSelectedChannelScheduleSnapshot();

                step = 'clearScheduleCaches';
                epgCoordinator?.clearScheduleCaches();

                step = 'clearSchedules';
                epg.clearSchedules();

                step = 'primeEpgChannels';
                epgCoordinator?.primeEpgChannels();
            }

            const epgCoordinator = this._deps.getEpgCoordinator();
            if (!epgCoordinator) {
                return {
                    startup: 'completed',
                    epgRefresh: { kind: 'skipped_no_coordinator' },
                };
            }

            step = 'refreshEpgSchedules';
            const refreshResult = await captureRecoverableRuntimeResultAsync(
                async () => epgCoordinator.refreshEpgSchedules({ reason: 'server-swap' })
            );
            if (!refreshResult.ok) {
                this._deps.reportError(
                    'orchestrator.serverSwap.refreshEpgSchedules',
                    'Post-selection EPG refresh failed',
                    refreshResult.error,
                    { step }
                );
                return {
                    startup: 'completed',
                    epgRefresh: { kind: 'failed', error: refreshResult.error },
                };
            }
            return {
                startup: 'completed',
                epgRefresh: { kind: 'succeeded' },
            };
        } catch (error) {
            this._deps.reportError(
                'orchestrator.serverSwap.runStartup',
                'Post-selection runtime swap failed',
                error,
                { step }
            );
            throw error;
        }
    }
}
