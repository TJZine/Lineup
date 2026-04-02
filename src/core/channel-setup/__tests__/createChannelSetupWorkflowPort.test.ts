import { createChannelSetupWorkflowPort } from '../createChannelSetupWorkflowPort';
import type { ChannelSetupWorkflowPort } from '../ChannelSetupWorkflowPort';
import type { ChannelSetupConfig } from '../types';

const createWorkflowPort = (): ChannelSetupWorkflowPort => createChannelSetupWorkflowPort({
    getChannelSetupCoordinator: jest.fn(() => null),
});

describe('createChannelSetupWorkflowPort', () => {
    it('throws synchronously when void mutating methods run before channel setup is initialized', () => {
        const workflowPort = createWorkflowPort();
        const config = { serverId: 'server-1' } as ChannelSetupConfig;

        expect(() => workflowPort.invalidateFacetSnapshot()).toThrow('Channel setup not initialized');
        expect(() => workflowPort.markSetupComplete('server-1', config)).toThrow('Channel setup not initialized');
    });

    it('rejects promise-returning coordinator methods when channel setup is not initialized', async () => {
        const workflowPort = createWorkflowPort();
        const config = { serverId: 'server-1' } as ChannelSetupConfig;

        await expect(workflowPort.getLibrariesForSetup()).rejects.toThrow('Channel setup not initialized');
        await expect(workflowPort.getSetupPreview(config)).rejects.toThrow('Channel setup not initialized');
        await expect(workflowPort.getSetupReview(config)).rejects.toThrow('Channel setup not initialized');
        await expect(workflowPort.getSetupPlanDiagnostics(config)).rejects.toThrow('Channel setup not initialized');
        await expect(workflowPort.createChannelsFromSetup(config)).rejects.toThrow('Channel setup not initialized');
    });
});
