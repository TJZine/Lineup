import { ServerSelectionCoordinator } from '../ServerSelectionCoordinator';
import type {
    DiscoverySelectedServerSnapshot,
    PersistedSelectedServerSnapshot,
} from '../ServerSelectionTypes';

const discoverySnapshot: DiscoverySelectedServerSnapshot = {
    server: null,
    connection: null,
    storedServerId: null,
};

const persistedSnapshot: PersistedSelectedServerSnapshot = {
    kind: 'available',
    selection: { serverId: 'server-prev', serverUri: 'http://previous.example' },
};

const startupResumeSucceeded = {
    startup: 'completed',
    epgRefresh: { kind: 'succeeded' },
} as const;

describe('ServerSelectionCoordinator', () => {
    it('returns selection_failed without persistence or runtime swap when discovery cannot select a server', async () => {
        const deps = {
            captureDiscoverySelectionSnapshot: jest.fn(() => discoverySnapshot),
            restoreDiscoverySelectionSnapshot: jest.fn(),
            capturePersistedSelectionSnapshot: jest.fn(async () => persistedSnapshot),
            selectServer: jest.fn(async () => ({ kind: 'server_not_found' as const })),
            getSelectedServerUri: jest.fn(() => null),
            persistSelection: jest.fn(async () => 'updated' as const),
            restorePersistedSelectionSnapshot: jest.fn(async () => 'updated' as const),
            resumeStartupAfterSelection: jest.fn(async () => startupResumeSucceeded),
            getReadiness: jest.fn(() => 'startup_pending' as const),
        };
        const coordinator = new ServerSelectionCoordinator(deps);

        await expect(coordinator.selectServer('missing-server')).resolves.toEqual({
            kind: 'selection_failed',
            reason: 'server_not_found',
        });
        expect(deps.capturePersistedSelectionSnapshot).not.toHaveBeenCalled();
        expect(deps.persistSelection).not.toHaveBeenCalled();
        expect(deps.resumeStartupAfterSelection).not.toHaveBeenCalled();
        expect(deps.restoreDiscoverySelectionSnapshot).not.toHaveBeenCalled();
        expect(deps.restorePersistedSelectionSnapshot).not.toHaveBeenCalled();
    });

    it('persists the selection, resumes startup, and returns the app-facing selected result', async () => {
        const deps = {
            captureDiscoverySelectionSnapshot: jest.fn(() => discoverySnapshot),
            restoreDiscoverySelectionSnapshot: jest.fn(),
            capturePersistedSelectionSnapshot: jest.fn(async () => persistedSnapshot),
            selectServer: jest.fn(async () => ({ kind: 'selected' as const })),
            getSelectedServerUri: jest.fn(() => 'http://example.com'),
            persistSelection: jest.fn(async () => 'updated' as const),
            restorePersistedSelectionSnapshot: jest.fn(async () => 'updated' as const),
            resumeStartupAfterSelection: jest.fn(async () => startupResumeSucceeded),
            getReadiness: jest.fn(() => 'ready' as const),
        };
        const coordinator = new ServerSelectionCoordinator(deps);

        await expect(coordinator.selectServer('server-1')).resolves.toEqual({
            kind: 'selected',
            readiness: 'ready',
            persistedSelection: 'updated',
            startupResume: startupResumeSucceeded,
        });
        expect(deps.capturePersistedSelectionSnapshot).toHaveBeenCalledTimes(1);
        expect(deps.persistSelection).toHaveBeenCalledWith('server-1', 'http://example.com');
        expect(deps.persistSelection).toHaveBeenCalledTimes(1);
        expect(deps.resumeStartupAfterSelection).toHaveBeenCalledTimes(1);
        expect(deps.restoreDiscoverySelectionSnapshot).not.toHaveBeenCalled();
        expect(deps.restorePersistedSelectionSnapshot).not.toHaveBeenCalled();
    });

    it('restores discovery runtime state without touching persisted selection when persistence rejects', async () => {
        const persistenceError = new Error('persist failed');
        const deps = {
            captureDiscoverySelectionSnapshot: jest.fn(() => discoverySnapshot),
            restoreDiscoverySelectionSnapshot: jest.fn(),
            capturePersistedSelectionSnapshot: jest.fn(async () => persistedSnapshot),
            selectServer: jest.fn(async () => ({ kind: 'selected' as const })),
            getSelectedServerUri: jest.fn(() => 'http://example.com'),
            persistSelection: jest.fn(async () => {
                throw persistenceError;
            }),
            restorePersistedSelectionSnapshot: jest.fn(async () => 'updated' as const),
            resumeStartupAfterSelection: jest.fn(async () => startupResumeSucceeded),
            getReadiness: jest.fn(() => 'ready' as const),
        };
        const coordinator = new ServerSelectionCoordinator(deps);

        await expect(coordinator.selectServer('server-1')).rejects.toBe(persistenceError);

        expect(deps.capturePersistedSelectionSnapshot).toHaveBeenCalledTimes(1);
        expect(deps.restoreDiscoverySelectionSnapshot).toHaveBeenCalledWith(discoverySnapshot);
        expect(deps.restorePersistedSelectionSnapshot).not.toHaveBeenCalled();
        expect(deps.resumeStartupAfterSelection).not.toHaveBeenCalled();
    });

    it('restores discovery runtime state when persisted snapshot capture rejects', async () => {
        const snapshotError = new Error('read stored credentials failed');
        const deps = {
            captureDiscoverySelectionSnapshot: jest.fn(() => discoverySnapshot),
            restoreDiscoverySelectionSnapshot: jest.fn(),
            capturePersistedSelectionSnapshot: jest.fn(async () => {
                throw snapshotError;
            }),
            selectServer: jest.fn(async () => ({ kind: 'selected' as const })),
            getSelectedServerUri: jest.fn(() => 'http://example.com'),
            persistSelection: jest.fn(async () => 'updated' as const),
            restorePersistedSelectionSnapshot: jest.fn(async () => 'updated' as const),
            resumeStartupAfterSelection: jest.fn(async () => startupResumeSucceeded),
            getReadiness: jest.fn(() => 'ready' as const),
        };
        const coordinator = new ServerSelectionCoordinator(deps);

        await expect(coordinator.selectServer('server-1')).rejects.toBe(snapshotError);

        expect(deps.capturePersistedSelectionSnapshot).toHaveBeenCalledTimes(1);
        expect(deps.restoreDiscoverySelectionSnapshot).toHaveBeenCalledWith(discoverySnapshot);
        expect(deps.persistSelection).not.toHaveBeenCalled();
        expect(deps.restorePersistedSelectionSnapshot).not.toHaveBeenCalled();
        expect(deps.resumeStartupAfterSelection).not.toHaveBeenCalled();
    });

    it('preserves persistence failure when discovery rollback also fails', async () => {
        const persistenceError = new Error('persist failed');
        const rollbackError = new Error('discovery rollback failed');
        const deps = {
            captureDiscoverySelectionSnapshot: jest.fn(() => discoverySnapshot),
            restoreDiscoverySelectionSnapshot: jest.fn(() => {
                throw rollbackError;
            }),
            capturePersistedSelectionSnapshot: jest.fn(async () => persistedSnapshot),
            selectServer: jest.fn(async () => ({ kind: 'selected' as const })),
            getSelectedServerUri: jest.fn(() => 'http://example.com'),
            persistSelection: jest.fn(async () => {
                throw persistenceError;
            }),
            restorePersistedSelectionSnapshot: jest.fn(async () => 'updated' as const),
            resumeStartupAfterSelection: jest.fn(async () => startupResumeSucceeded),
            getReadiness: jest.fn(() => 'ready' as const),
        };
        const coordinator = new ServerSelectionCoordinator(deps);

        await expect(coordinator.selectServer('server-1')).rejects.toBe(persistenceError);

        expect(deps.restoreDiscoverySelectionSnapshot).toHaveBeenCalledWith(discoverySnapshot);
        expect(deps.restorePersistedSelectionSnapshot).not.toHaveBeenCalled();
        expect(deps.resumeStartupAfterSelection).not.toHaveBeenCalled();
    });

    it('restores discovery runtime state and the prior persisted record when startup resume fails', async () => {
        const resumeError = new Error('startup resume failed');
        const deps = {
            captureDiscoverySelectionSnapshot: jest.fn(() => discoverySnapshot),
            restoreDiscoverySelectionSnapshot: jest.fn(),
            capturePersistedSelectionSnapshot: jest.fn(async () => persistedSnapshot),
            selectServer: jest.fn(async () => ({ kind: 'selected' as const })),
            getSelectedServerUri: jest.fn(() => 'http://example.com'),
            persistSelection: jest.fn(async () => 'updated' as const),
            restorePersistedSelectionSnapshot: jest.fn(async () => 'updated' as const),
            resumeStartupAfterSelection: jest.fn(async () => {
                throw resumeError;
            }),
            getReadiness: jest.fn(() => 'ready' as const),
        };
        const coordinator = new ServerSelectionCoordinator(deps);

        await expect(coordinator.selectServer('server-1')).rejects.toBe(resumeError);

        expect(deps.capturePersistedSelectionSnapshot).toHaveBeenCalledTimes(1);
        expect(deps.persistSelection).toHaveBeenCalledWith('server-1', 'http://example.com');
        expect(deps.resumeStartupAfterSelection).toHaveBeenCalledTimes(1);
        expect(deps.restoreDiscoverySelectionSnapshot).toHaveBeenCalledWith(discoverySnapshot);
        expect(deps.restorePersistedSelectionSnapshot).toHaveBeenCalledWith(persistedSnapshot);
    });

    it('preserves startup resume failure when both rollback attempts fail', async () => {
        const resumeError = new Error('startup resume failed');
        const discoveryRollbackError = new Error('discovery rollback failed');
        const persistedRollbackError = new Error('persisted rollback failed');
        const deps = {
            captureDiscoverySelectionSnapshot: jest.fn(() => discoverySnapshot),
            restoreDiscoverySelectionSnapshot: jest.fn(() => {
                throw discoveryRollbackError;
            }),
            capturePersistedSelectionSnapshot: jest.fn(async () => persistedSnapshot),
            selectServer: jest.fn(async () => ({ kind: 'selected' as const })),
            getSelectedServerUri: jest.fn(() => 'http://example.com'),
            persistSelection: jest.fn(async () => 'updated' as const),
            restorePersistedSelectionSnapshot: jest.fn(async () => {
                throw persistedRollbackError;
            }),
            resumeStartupAfterSelection: jest.fn(async () => {
                throw resumeError;
            }),
            getReadiness: jest.fn(() => 'ready' as const),
        };
        const coordinator = new ServerSelectionCoordinator(deps);

        await expect(coordinator.selectServer('server-1')).rejects.toBe(resumeError);

        expect(deps.restoreDiscoverySelectionSnapshot).toHaveBeenCalledWith(discoverySnapshot);
        expect(deps.restorePersistedSelectionSnapshot).toHaveBeenCalledWith(persistedSnapshot);
    });

    it('returns recoverable startup-resume details with the selected result', async () => {
        const startupResume = {
            startup: 'completed',
            epgRefresh: { kind: 'failed', error: new Error('refresh failed') },
        } as const;
        const deps = {
            captureDiscoverySelectionSnapshot: jest.fn(() => discoverySnapshot),
            restoreDiscoverySelectionSnapshot: jest.fn(),
            capturePersistedSelectionSnapshot: jest.fn(async () => persistedSnapshot),
            selectServer: jest.fn(async () => ({ kind: 'selected' as const })),
            getSelectedServerUri: jest.fn(() => 'http://example.com'),
            persistSelection: jest.fn(async () => 'updated' as const),
            restorePersistedSelectionSnapshot: jest.fn(async () => 'updated' as const),
            resumeStartupAfterSelection: jest.fn(async () => startupResume),
            getReadiness: jest.fn(() => 'ready' as const),
        };
        const coordinator = new ServerSelectionCoordinator(deps);

        await expect(coordinator.selectServer('server-1')).resolves.toEqual({
            kind: 'selected',
            readiness: 'ready',
            persistedSelection: 'updated',
            startupResume,
        });
    });
});
