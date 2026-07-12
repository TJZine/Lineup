import {
    SelectedServerRuntimeController,
    type SelectedServerRuntimeControllerDeps,
} from '../SelectedServerRuntimeController';

const createDeps = (): jest.Mocked<SelectedServerRuntimeControllerDeps> => ({
    clearPersistedSelection: jest.fn().mockResolvedValue('updated'),
    clearDiscoverySelection: jest.fn(),
});

describe('SelectedServerRuntimeController', () => {
    it('clears persistence before discovery selection', async () => {
        const deps = createDeps();
        const controller = new SelectedServerRuntimeController(deps);

        await expect(controller.clearSelection()).resolves.toBe('updated');

        expect(deps.clearPersistedSelection).toHaveBeenCalledTimes(1);
        expect(deps.clearDiscoverySelection).toHaveBeenCalledTimes(1);
        expect(deps.clearPersistedSelection.mock.invocationCallOrder[0])
            .toBeLessThan(deps.clearDiscoverySelection.mock.invocationCallOrder[0]!);
    });

    it('does not clear discovery when persistence fails', async () => {
        const deps = createDeps();
        const error = new Error('persistence failed');
        deps.clearPersistedSelection.mockRejectedValue(error);
        const controller = new SelectedServerRuntimeController(deps);

        await expect(controller.clearSelection()).rejects.toBe(error);
        expect(deps.clearDiscoverySelection).not.toHaveBeenCalled();
    });
});
