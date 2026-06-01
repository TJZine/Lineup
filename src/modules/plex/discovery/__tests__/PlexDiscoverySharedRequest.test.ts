import { PlexDiscoverySharedRequest } from '../PlexDiscoverySharedRequest';

describe('PlexDiscoverySharedRequest', () => {
    it('rejects a signal-aware waiter when snapshot creation throws', async () => {
        const request = new PlexDiscoverySharedRequest(
            Promise.resolve(['server']),
            new AbortController(),
            jest.fn()
        );
        const signal = new AbortController().signal;
        const snapshotError = new Error('snapshot failed');

        await expect(
            request.awaitSnapshot(signal, () => {
                throw snapshotError;
            })
        ).rejects.toBe(snapshotError);
    });
});
