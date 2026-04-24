import { createChannelSetupWorkflowPort } from '../createChannelSetupWorkflowPort';
import {
    CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE,
    type ChannelSetupWorkflowPort,
} from '../ChannelSetupWorkflowPort';
import type { ChannelSetupWorkflow } from '../ChannelSetupWorkflow';
import type { ChannelSetupConfig } from '../types';

const createWorkflowPort = (): ChannelSetupWorkflowPort => createChannelSetupWorkflowPort({
    getChannelSetupWorkflow: jest.fn(() => null),
});

describe('createChannelSetupWorkflowPort', () => {
    it('throws synchronously when void methods run before channel setup is initialized', () => {
        const workflowPort = createWorkflowPort();
        const config = { serverId: 'server-1' } as ChannelSetupConfig;

        expect(() => workflowPort.invalidateFacetSnapshot()).toThrow(CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE);
        expect(() => workflowPort.getChannelSetupRecord('server-1')).toThrow(CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE);
        expect(() => workflowPort.getSetupContextForSelectedServer()).toThrow(CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE);
        expect(() => workflowPort.markSetupComplete('server-1', config)).toThrow(CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE);
    });

    it('rejects promise-returning coordinator methods when channel setup is not initialized', async () => {
        const workflowPort = createWorkflowPort();
        const config = { serverId: 'server-1' } as ChannelSetupConfig;

        await expect(workflowPort.getLibrariesForSetup()).rejects.toThrow(CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE);
        await expect(workflowPort.getSetupPreview(config)).rejects.toThrow(CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE);
        await expect(workflowPort.getSetupReview(config)).rejects.toThrow(CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE);
        await expect(workflowPort.getSetupPlanDiagnostics(config)).rejects.toThrow(CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE);
        await expect(workflowPort.createChannelsFromSetup(config)).rejects.toThrow(CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE);
    });

    it('forwards all methods to the resolved workflow owner', async () => {
        const workflow = {
            invalidateFacetSnapshot: jest.fn(),
            getLibrariesForSetup: jest.fn().mockResolvedValue([]),
            getSetupRecord: jest.fn().mockReturnValue(null),
            getSetupContextForSelectedServer: jest.fn().mockReturnValue('existing'),
            getSetupPreview: jest.fn().mockResolvedValue({ estimates: {}, warnings: [], reachedMaxChannels: false }),
            getSetupReview: jest.fn().mockResolvedValue({ preview: { estimates: {}, warnings: [], reachedMaxChannels: false }, diff: { summary: { created: 0, removed: 0, unchanged: 0 }, samples: { created: [], removed: [], unchanged: [] } } }),
            getSetupPlanDiagnostics: jest.fn().mockResolvedValue({ status: 'ready', diagnostics: null, warnings: [], reachedMaxChannels: false }),
            createChannelsFromSetup: jest.fn().mockResolvedValue({ created: 1, skipped: 0, reachedMaxChannels: false, errorCount: 0, canceled: false }),
            markSetupComplete: jest.fn(),
        } as unknown as jest.Mocked<ChannelSetupWorkflow>;
        const workflowPort = createChannelSetupWorkflowPort({
            getChannelSetupWorkflow: () => workflow,
        });
        const config = { serverId: 'server-1' } as ChannelSetupConfig;

        workflowPort.invalidateFacetSnapshot();
        await workflowPort.getLibrariesForSetup();
        workflowPort.getChannelSetupRecord('server-1');
        workflowPort.getSetupContextForSelectedServer();
        await workflowPort.getSetupPreview(config);
        await workflowPort.getSetupReview(config);
        await workflowPort.getSetupPlanDiagnostics(config);
        await workflowPort.createChannelsFromSetup(config);
        workflowPort.markSetupComplete('server-1', config);

        expect(workflow.invalidateFacetSnapshot).toHaveBeenCalledTimes(1);
        expect(workflow.getLibrariesForSetup).toHaveBeenCalledTimes(1);
        expect(workflow.getSetupRecord).toHaveBeenCalledWith('server-1');
        expect(workflow.getSetupContextForSelectedServer).toHaveBeenCalledTimes(1);
        expect(workflow.getSetupPreview).toHaveBeenCalledWith(config, undefined);
        expect(workflow.getSetupReview).toHaveBeenCalledWith(config, undefined);
        expect(workflow.getSetupPlanDiagnostics).toHaveBeenCalledWith(config, undefined);
        expect(workflow.createChannelsFromSetup).toHaveBeenCalledWith(config, undefined);
        expect(workflow.markSetupComplete).toHaveBeenCalledWith('server-1', config);
    });
});
