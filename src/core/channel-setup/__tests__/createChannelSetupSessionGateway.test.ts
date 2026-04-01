import { createChannelSetupSessionGateway } from '../createChannelSetupSessionGateway';
import type { ChannelSetupSessionGateway } from '../ChannelSetupSessionGateway';
import type { ChannelSetupConfig } from '../types';

const createGateway = (): ChannelSetupSessionGateway => createChannelSetupSessionGateway({
    getNavigation: jest.fn(() => null),
    getSelectedServerStorageKey: jest.fn(() => 'selected-server-key'),
    getServerHealthStorageKey: jest.fn(() => 'server-health-key'),
    getSelectedServerId: jest.fn(() => null),
    openServerSelect: jest.fn(),
    switchToChannelByNumber: jest.fn(async () => {}),
    openEPG: jest.fn(),
    getChannelSetupCoordinator: jest.fn(() => null),
});

describe('createChannelSetupSessionGateway', () => {
    it('throws synchronously when void mutating gateway methods run before channel setup is initialized', () => {
        const gateway = createGateway();
        const config = { serverId: 'server-1' } as ChannelSetupConfig;

        expect(() => gateway.invalidateFacetSnapshot()).toThrow('Channel setup not initialized');
        expect(() => gateway.requestChannelSetupRerun()).toThrow('Channel setup not initialized');
        expect(() => gateway.markSetupComplete('server-1', config)).toThrow('Channel setup not initialized');
    });

    it('rejects promise-returning coordinator methods when channel setup is not initialized', async () => {
        const gateway = createGateway();
        const config = { serverId: 'server-1' } as ChannelSetupConfig;

        await expect(gateway.getLibrariesForSetup()).rejects.toThrow('Channel setup not initialized');
        await expect(gateway.getSetupPreview(config)).rejects.toThrow('Channel setup not initialized');
        await expect(gateway.getSetupReview(config)).rejects.toThrow('Channel setup not initialized');
        await expect(gateway.createChannelsFromSetup(config)).rejects.toThrow('Channel setup not initialized');
    });
});
