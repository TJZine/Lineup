import {
    SelectedServerRuntimeController,
    type SelectedServerRuntimeControllerDeps,
} from '../SelectedServerRuntimeController';
import type { PersistedSelectedServerSnapshot } from '../ServerSelectionTypes';

const createDeps = (
    overrides: Partial<SelectedServerRuntimeControllerDeps> = {}
): jest.Mocked<SelectedServerRuntimeControllerDeps> => ({
    capturePersistedSelectionSnapshot: jest.fn().mockResolvedValue({
        kind: 'available',
        selection: { serverId: null, serverUri: null },
    } satisfies PersistedSelectedServerSnapshot),
    persistSelection: jest.fn().mockResolvedValue('updated'),
    restorePersistedSelectionSnapshot: jest.fn().mockResolvedValue('updated'),
    resumeStartupAfterSelection: jest.fn().mockResolvedValue(undefined),
    clearDiscoverySelection: jest.fn(),
    ...overrides,
} as jest.Mocked<SelectedServerRuntimeControllerDeps>);

describe('SelectedServerRuntimeController', () => {
    it('persists a cleared selection before clearing discovery runtime state', async () => {
        const callOrder: string[] = [];
        const deps = createDeps({
            persistSelection: jest.fn(async () => {
                callOrder.push('persistSelection');
                return 'updated';
            }),
            clearDiscoverySelection: jest.fn(() => {
                callOrder.push('clearDiscoverySelection');
            }),
        });
        const controller = new SelectedServerRuntimeController(deps);

        await expect(controller.clearSelection()).resolves.toBe('updated');

        expect(deps.persistSelection).toHaveBeenCalledTimes(1);
        expect(deps.persistSelection).toHaveBeenCalledWith(null, null);
        expect(deps.clearDiscoverySelection).toHaveBeenCalledTimes(1);
        expect(callOrder).toEqual(['persistSelection', 'clearDiscoverySelection']);
    });

    it('does not clear discovery runtime state when cleared-selection persistence fails', async () => {
        const persistenceError = new Error('selected-server persistence failed');
        const deps = createDeps({
            persistSelection: jest.fn().mockRejectedValue(persistenceError),
        });
        const controller = new SelectedServerRuntimeController(deps);

        await expect(controller.clearSelection()).rejects.toBe(persistenceError);

        expect(deps.persistSelection).toHaveBeenCalledTimes(1);
        expect(deps.persistSelection).toHaveBeenCalledWith(null, null);
        expect(deps.clearDiscoverySelection).not.toHaveBeenCalled();
    });

    it('keeps selected-server persistence delegation unchanged for explicit selections', async () => {
        const deps = createDeps();
        const controller = new SelectedServerRuntimeController(deps);

        await expect(controller.persistSelection('server-1', 'http://127.0.0.1:32400')).resolves.toBe('updated');

        expect(deps.persistSelection).toHaveBeenCalledTimes(1);
        expect(deps.persistSelection).toHaveBeenCalledWith('server-1', 'http://127.0.0.1:32400');
        expect(deps.clearDiscoverySelection).not.toHaveBeenCalled();
    });

    it('captures persisted selection snapshots through the explicit controller seam', async () => {
        const deps = createDeps();
        const controller = new SelectedServerRuntimeController(deps);

        await expect(controller.capturePersistedSelectionSnapshot()).resolves.toEqual({
            kind: 'available',
            selection: { serverId: null, serverUri: null },
        });

        expect(deps.capturePersistedSelectionSnapshot).toHaveBeenCalledTimes(1);
        expect(deps.persistSelection).not.toHaveBeenCalled();
        expect(deps.clearDiscoverySelection).not.toHaveBeenCalled();
    });

    it('restores persisted selection snapshots through the explicit controller seam', async () => {
        const deps = createDeps();
        const controller = new SelectedServerRuntimeController(deps);
        const snapshot: PersistedSelectedServerSnapshot = {
            kind: 'available',
            selection: { serverId: 'server-1', serverUri: 'http://127.0.0.1:32400' },
        };

        await expect(controller.restorePersistedSelectionSnapshot(snapshot)).resolves.toBe('updated');

        expect(deps.restorePersistedSelectionSnapshot).toHaveBeenCalledWith(snapshot);
        expect(deps.persistSelection).not.toHaveBeenCalled();
        expect(deps.clearDiscoverySelection).not.toHaveBeenCalled();
    });

    it('keeps startup-resume delegation unchanged for selected-server swaps', async () => {
        const deps = createDeps();
        const controller = new SelectedServerRuntimeController(deps);

        await expect(controller.resumeStartupAfterSelection()).resolves.toBeUndefined();

        expect(deps.resumeStartupAfterSelection).toHaveBeenCalledTimes(1);
        expect(deps.persistSelection).not.toHaveBeenCalled();
        expect(deps.clearDiscoverySelection).not.toHaveBeenCalled();
    });
});
