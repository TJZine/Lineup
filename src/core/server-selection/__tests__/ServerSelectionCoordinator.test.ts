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

function createDeferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason: unknown) => void;
} {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((promiseResolve, promiseReject) => {
        resolve = promiseResolve;
        reject = promiseReject;
    });
    return { promise, resolve, reject };
}

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
            rollbackStartupAfterSelectionFailure: jest.fn(),
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
        expect(deps.restoreDiscoverySelectionSnapshot).toHaveBeenCalledWith(discoverySnapshot);
        expect(deps.restorePersistedSelectionSnapshot).not.toHaveBeenCalled();
    });

    it('restores discovery state when Plex selection rejects', async () => {
        const selectionError = new Error('selection failed');
        const deps = {
            captureDiscoverySelectionSnapshot: jest.fn(() => discoverySnapshot),
            restoreDiscoverySelectionSnapshot: jest.fn(),
            capturePersistedSelectionSnapshot: jest.fn(async () => persistedSnapshot),
            selectServer: jest.fn(async () => {
                throw selectionError;
            }),
            getSelectedServerUri: jest.fn(() => null),
            persistSelection: jest.fn(async () => 'updated' as const),
            restorePersistedSelectionSnapshot: jest.fn(async () => 'updated' as const),
            resumeStartupAfterSelection: jest.fn(async () => startupResumeSucceeded),
            rollbackStartupAfterSelectionFailure: jest.fn(),
            getReadiness: jest.fn(() => 'startup_pending' as const),
        };
        const coordinator = new ServerSelectionCoordinator(deps);

        await expect(coordinator.selectServer('server-1')).rejects.toBe(selectionError);

        expect(deps.restoreDiscoverySelectionSnapshot).toHaveBeenCalledWith(discoverySnapshot);
        expect(deps.capturePersistedSelectionSnapshot).not.toHaveBeenCalled();
        expect(deps.persistSelection).not.toHaveBeenCalled();
        expect(deps.resumeStartupAfterSelection).not.toHaveBeenCalled();
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
            rollbackStartupAfterSelectionFailure: jest.fn(),
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

    it('passes caller discovery options through the selection transaction', async () => {
        const deps = {
            captureDiscoverySelectionSnapshot: jest.fn(() => discoverySnapshot),
            restoreDiscoverySelectionSnapshot: jest.fn(),
            capturePersistedSelectionSnapshot: jest.fn(async () => persistedSnapshot),
            selectServer: jest.fn(async () => ({ kind: 'selected' as const })),
            getSelectedServerUri: jest.fn(() => 'http://example.com'),
            persistSelection: jest.fn(async () => 'updated' as const),
            restorePersistedSelectionSnapshot: jest.fn(async () => 'updated' as const),
            resumeStartupAfterSelection: jest.fn(async () => startupResumeSucceeded),
            rollbackStartupAfterSelectionFailure: jest.fn(),
            getReadiness: jest.fn(() => 'ready' as const),
        };
        const coordinator = new ServerSelectionCoordinator(deps);
        const options = { signal: new AbortController().signal };

        await expect(coordinator.selectServer('server-1', options)).resolves.toEqual({
            kind: 'selected',
            readiness: 'ready',
            persistedSelection: 'updated',
            startupResume: startupResumeSucceeded,
        });

        expect(deps.selectServer).toHaveBeenCalledWith('server-1', options);
        expect(deps.resumeStartupAfterSelection).toHaveBeenCalledWith(options);
    });

    it('rejects without side effects when the caller aborts before selection starts', async () => {
        const abortReason = new DOMException('selection hidden', 'AbortError');
        const controller = new AbortController();
        controller.abort(abortReason);
        const deps = {
            captureDiscoverySelectionSnapshot: jest.fn(() => discoverySnapshot),
            restoreDiscoverySelectionSnapshot: jest.fn(),
            capturePersistedSelectionSnapshot: jest.fn(async () => persistedSnapshot),
            selectServer: jest.fn(async () => ({ kind: 'selected' as const })),
            getSelectedServerUri: jest.fn(() => 'http://example.com'),
            persistSelection: jest.fn(async () => 'updated' as const),
            restorePersistedSelectionSnapshot: jest.fn(async () => 'updated' as const),
            resumeStartupAfterSelection: jest.fn(async () => startupResumeSucceeded),
            rollbackStartupAfterSelectionFailure: jest.fn(),
            getReadiness: jest.fn(() => 'ready' as const),
        };
        const coordinator = new ServerSelectionCoordinator(deps);

        await expect(
            coordinator.selectServer('server-1', { signal: controller.signal })
        ).rejects.toBe(abortReason);

        expect(deps.captureDiscoverySelectionSnapshot).not.toHaveBeenCalled();
        expect(deps.selectServer).not.toHaveBeenCalled();
        expect(deps.capturePersistedSelectionSnapshot).not.toHaveBeenCalled();
        expect(deps.persistSelection).not.toHaveBeenCalled();
        expect(deps.resumeStartupAfterSelection).not.toHaveBeenCalled();
    });

    it('rolls back discovery state when the caller aborts after Plex selection succeeds', async () => {
        const abortReason = new DOMException('selection hidden', 'AbortError');
        const controller = new AbortController();
        const deps = {
            captureDiscoverySelectionSnapshot: jest.fn(() => discoverySnapshot),
            restoreDiscoverySelectionSnapshot: jest.fn(),
            capturePersistedSelectionSnapshot: jest.fn(async () => persistedSnapshot),
            selectServer: jest.fn(async () => {
                controller.abort(abortReason);
                return { kind: 'selected' as const };
            }),
            getSelectedServerUri: jest.fn(() => 'http://example.com'),
            persistSelection: jest.fn(async () => 'updated' as const),
            restorePersistedSelectionSnapshot: jest.fn(async () => 'updated' as const),
            resumeStartupAfterSelection: jest.fn(async () => startupResumeSucceeded),
            rollbackStartupAfterSelectionFailure: jest.fn(),
            getReadiness: jest.fn(() => 'ready' as const),
        };
        const coordinator = new ServerSelectionCoordinator(deps);

        await expect(
            coordinator.selectServer('server-1', { signal: controller.signal })
        ).rejects.toBe(abortReason);

        expect(deps.restoreDiscoverySelectionSnapshot).toHaveBeenCalledWith(discoverySnapshot);
        expect(deps.capturePersistedSelectionSnapshot).not.toHaveBeenCalled();
        expect(deps.persistSelection).not.toHaveBeenCalled();
        expect(deps.resumeStartupAfterSelection).not.toHaveBeenCalled();
    });

    it('rolls back discovery and persisted state when the caller aborts after persistence', async () => {
        const abortReason = new DOMException('selection hidden', 'AbortError');
        const controller = new AbortController();
        const deps = {
            captureDiscoverySelectionSnapshot: jest.fn(() => discoverySnapshot),
            restoreDiscoverySelectionSnapshot: jest.fn(),
            capturePersistedSelectionSnapshot: jest.fn(async () => persistedSnapshot),
            selectServer: jest.fn(async () => ({ kind: 'selected' as const })),
            getSelectedServerUri: jest.fn(() => 'http://example.com'),
            persistSelection: jest.fn(async () => {
                controller.abort(abortReason);
                return 'updated' as const;
            }),
            restorePersistedSelectionSnapshot: jest.fn(async () => 'updated' as const),
            resumeStartupAfterSelection: jest.fn(async () => startupResumeSucceeded),
            rollbackStartupAfterSelectionFailure: jest.fn(),
            getReadiness: jest.fn(() => 'ready' as const),
        };
        const coordinator = new ServerSelectionCoordinator(deps);

        await expect(
            coordinator.selectServer('server-1', { signal: controller.signal })
        ).rejects.toBe(abortReason);

        expect(deps.persistSelection).toHaveBeenCalledWith('server-1', 'http://example.com');
        expect(deps.restoreDiscoverySelectionSnapshot).toHaveBeenCalledWith(discoverySnapshot);
        expect(deps.restorePersistedSelectionSnapshot).toHaveBeenCalledWith(persistedSnapshot);
        expect(deps.resumeStartupAfterSelection).not.toHaveBeenCalled();
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
            rollbackStartupAfterSelectionFailure: jest.fn(),
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
            rollbackStartupAfterSelectionFailure: jest.fn(),
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
            rollbackStartupAfterSelectionFailure: jest.fn(),
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
            rollbackStartupAfterSelectionFailure: jest.fn(),
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

    it('serializes overlapping selections so a failed earlier transaction rolls back before the next starts', async () => {
        const discoverySnapshotA: DiscoverySelectedServerSnapshot = {
            server: null,
            connection: null,
            storedServerId: 'server-a-previous',
        };
        const discoverySnapshotB: DiscoverySelectedServerSnapshot = {
            server: null,
            connection: null,
            storedServerId: 'server-b-previous',
        };
        const persistedSnapshotA: PersistedSelectedServerSnapshot = {
            kind: 'available',
            selection: { serverId: 'server-a-previous', serverUri: 'http://a-previous.example' },
        };
        const persistedSnapshotB: PersistedSelectedServerSnapshot = {
            kind: 'available',
            selection: { serverId: 'server-b-previous', serverUri: 'http://b-previous.example' },
        };
        const resumeError = new Error('startup resume failed');
        const startupResumeDeferred = createDeferred<typeof startupResumeSucceeded>();
        const firstResumeStarted = createDeferred<void>();
        const events: string[] = [];
        let discoverySnapshotCaptureCount = 0;
        let persistedSnapshotCaptureCount = 0;
        let resumeCallCount = 0;

        const deps = {
            captureDiscoverySelectionSnapshot: jest.fn(() => {
                discoverySnapshotCaptureCount += 1;
                events.push(`capture-discovery:${discoverySnapshotCaptureCount}`);
                return discoverySnapshotCaptureCount === 1 ? discoverySnapshotA : discoverySnapshotB;
            }),
            restoreDiscoverySelectionSnapshot: jest.fn(
                (snapshot: DiscoverySelectedServerSnapshot) => {
                    events.push(`restore-discovery:${snapshot.storedServerId ?? 'none'}`);
                }
            ),
            capturePersistedSelectionSnapshot: jest.fn(async () => {
                persistedSnapshotCaptureCount += 1;
                events.push(`capture-persisted:${persistedSnapshotCaptureCount}`);
                return persistedSnapshotCaptureCount === 1 ? persistedSnapshotA : persistedSnapshotB;
            }),
            selectServer: jest.fn(async (serverId: string) => {
                events.push(`select:${serverId}`);
                return { kind: 'selected' as const };
            }),
            getSelectedServerUri: jest.fn(() => 'http://selected.example'),
            persistSelection: jest.fn(async (serverId: string) => {
                events.push(`persist:${serverId}`);
                return 'updated' as const;
            }),
            restorePersistedSelectionSnapshot: jest.fn(
                async (snapshot: PersistedSelectedServerSnapshot) => {
                    events.push(
                        `restore-persisted:${
                            snapshot.kind === 'available' ? snapshot.selection.serverId : snapshot.kind
                        }`
                    );
                    return 'updated' as const;
                }
            ),
            resumeStartupAfterSelection: jest.fn(() => {
                resumeCallCount += 1;
                events.push(`resume:${resumeCallCount}`);
                if (resumeCallCount === 1) {
                    firstResumeStarted.resolve();
                    return startupResumeDeferred.promise;
                }
                return Promise.resolve(startupResumeSucceeded);
            }),
            rollbackStartupAfterSelectionFailure: jest.fn(),
            getReadiness: jest.fn(() => 'ready' as const),
        };
        const coordinator = new ServerSelectionCoordinator(deps);

        const selectionA = coordinator.selectServer('server-a');
        await firstResumeStarted.promise;

        expect(deps.persistSelection).toHaveBeenCalledWith('server-a', 'http://selected.example');
        expect(deps.resumeStartupAfterSelection).toHaveBeenCalledTimes(1);

        const selectionB = coordinator.selectServer('server-b');
        await Promise.resolve();

        expect(deps.selectServer).toHaveBeenCalledTimes(1);
        expect(deps.selectServer.mock.calls[0]?.[0]).toBe('server-a');

        startupResumeDeferred.reject(resumeError);
        await expect(selectionA).rejects.toBe(resumeError);

        expect(deps.restoreDiscoverySelectionSnapshot).toHaveBeenCalledWith(discoverySnapshotA);
        expect(deps.restorePersistedSelectionSnapshot).toHaveBeenCalledWith(persistedSnapshotA);

        await expect(selectionB).resolves.toEqual({
            kind: 'selected',
            readiness: 'ready',
            persistedSelection: 'updated',
            startupResume: startupResumeSucceeded,
        });
        expect(deps.selectServer).toHaveBeenCalledTimes(2);
        expect(deps.selectServer.mock.calls[1]?.[0]).toBe('server-b');
        expect(deps.persistSelection).toHaveBeenNthCalledWith(
            2,
            'server-b',
            'http://selected.example'
        );
        expect(deps.resumeStartupAfterSelection).toHaveBeenCalledTimes(2);

        const expectEventIndex = (event: string): number => {
            const index = events.indexOf(event);
            expect(index).toBeGreaterThanOrEqual(0);
            return index;
        };
        const restoreDiscoveryIndex = expectEventIndex('restore-discovery:server-a-previous');
        const captureDiscoveryIndex = expectEventIndex('capture-discovery:2');
        const restorePersistedIndex = expectEventIndex('restore-persisted:server-a-previous');
        const capturePersistedIndex = expectEventIndex('capture-persisted:2');
        const selectServerBIndex = expectEventIndex('select:server-b');

        expect(restoreDiscoveryIndex).toBeLessThan(captureDiscoveryIndex);
        expect(restorePersistedIndex).toBeLessThan(capturePersistedIndex);
        expect(restoreDiscoveryIndex).toBeLessThan(selectServerBIndex);
        expect(restorePersistedIndex).toBeLessThan(selectServerBIndex);
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
            rollbackStartupAfterSelectionFailure: jest.fn(),
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
            rollbackStartupAfterSelectionFailure: jest.fn(),
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
