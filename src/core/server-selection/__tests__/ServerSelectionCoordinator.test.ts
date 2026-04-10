import { ServerSelectionCoordinator } from '../ServerSelectionCoordinator';

describe('ServerSelectionCoordinator', () => {
    it('returns selection_failed without persistence or runtime swap when discovery cannot select a server', async () => {
        const deps = {
            selectServer: jest.fn(async () => ({ kind: 'server_not_found' as const })),
            getSelectedServerUri: jest.fn(() => null),
            persistSelection: jest.fn(async () => 'updated' as const),
            runPostSelectionRuntimeSwap: jest.fn(async () => undefined),
            getReadiness: jest.fn(() => 'startup_pending' as const),
        };
        const coordinator = new ServerSelectionCoordinator(deps);

        await expect(coordinator.selectServer('missing-server')).resolves.toEqual({
            kind: 'selection_failed',
            reason: 'server_not_found',
        });
        expect(deps.persistSelection).not.toHaveBeenCalled();
        expect(deps.runPostSelectionRuntimeSwap).not.toHaveBeenCalled();
    });

    it('persists the selection, runs the runtime swap, and returns the app-facing selected result', async () => {
        const deps = {
            selectServer: jest.fn(async () => ({ kind: 'selected' as const })),
            getSelectedServerUri: jest.fn(() => 'http://example.com'),
            persistSelection: jest.fn(async () => 'updated' as const),
            runPostSelectionRuntimeSwap: jest.fn(async () => undefined),
            getReadiness: jest.fn(() => 'ready' as const),
        };
        const coordinator = new ServerSelectionCoordinator(deps);

        await expect(coordinator.selectServer('server-1')).resolves.toEqual({
            kind: 'selected',
            readiness: 'ready',
            persistedSelection: 'updated',
        });
        expect(deps.persistSelection).toHaveBeenCalledWith('server-1', 'http://example.com');
        expect(deps.persistSelection).toHaveBeenCalledTimes(1);
        expect(deps.runPostSelectionRuntimeSwap).toHaveBeenCalledTimes(1);
    });
});
