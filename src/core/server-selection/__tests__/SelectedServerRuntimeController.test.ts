import {
    SelectedServerRuntimeController,
    type SelectedServerRuntimeControllerDeps,
} from '../SelectedServerRuntimeController';

const createDeps = (
    overrides: Partial<SelectedServerRuntimeControllerDeps> = {}
): jest.Mocked<SelectedServerRuntimeControllerDeps> => ({
    persistSelection: jest.fn().mockResolvedValue('updated'),
    runPostSelectionRuntimeSwap: jest.fn().mockResolvedValue(undefined),
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

    it('keeps runtime swap delegation unchanged', async () => {
        const deps = createDeps();
        const controller = new SelectedServerRuntimeController(deps);

        await expect(controller.runPostSelectionRuntimeSwap()).resolves.toBeUndefined();

        expect(deps.runPostSelectionRuntimeSwap).toHaveBeenCalledTimes(1);
        expect(deps.persistSelection).not.toHaveBeenCalled();
        expect(deps.clearDiscoverySelection).not.toHaveBeenCalled();
    });
});
