import { createChannelSetupSessionGateway } from '../createChannelSetupSessionGateway';
import type { ChannelSetupConfig } from '../types';

describe('createChannelSetupSessionGateway', () => {
    it('throws when mutating gateway methods run before channel setup is initialized', () => {
        const gateway = createChannelSetupSessionGateway({
            getNavigation: jest.fn(() => null),
            getSelectedServerStorageKey: jest.fn(() => 'selected-server-key'),
            getServerHealthStorageKey: jest.fn(() => 'server-health-key'),
            getSelectedServerId: jest.fn(() => null),
            openServerSelect: jest.fn(),
            switchToChannelByNumber: jest.fn(async () => {}),
            openEPG: jest.fn(),
            getChannelSetupCoordinator: jest.fn(() => null),
        });
        const config = { serverId: 'server-1' } as ChannelSetupConfig;

        expect(() => gateway.invalidateFacetSnapshot()).toThrow('Channel setup not initialized');
        expect(() => gateway.requestChannelSetupRerun()).toThrow('Channel setup not initialized');
        expect(() => gateway.markSetupComplete('server-1', config)).toThrow('Channel setup not initialized');
    });
});
