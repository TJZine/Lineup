import { createChannelSetupWorkflowPort } from '../workflow/createChannelSetupWorkflowPort';
import {
    CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE,
    type ChannelSetupWorkflowPort,
} from '../workflow/ChannelSetupWorkflowPort';
import type { ChannelSetupWorkflowPortOwners } from '../workflow/createChannelSetupWorkflowPort';
import type { ChannelSetupConfig } from '../types';

const createWorkflowPort = (): ChannelSetupWorkflowPort => createChannelSetupWorkflowPort({
    getOwners: jest.fn(() => null),
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

    it('forwards all methods to the resolved workflow port owners', async () => {
        const planningService = {
            invalidateFacetSnapshot: jest.fn(),
            getLibrariesForSetup: jest.fn().mockResolvedValue([]),
            getSetupPreview: jest.fn().mockResolvedValue({ estimates: {}, warnings: [], reachedMaxChannels: false }),
            getSetupReview: jest.fn().mockResolvedValue({ preview: { estimates: {}, warnings: [], reachedMaxChannels: false }, diff: { summary: { created: 0, removed: 0, unchanged: 0 }, samples: { created: [], removed: [], unchanged: [] } } }),
            getSetupPlanDiagnostics: jest.fn().mockResolvedValue({ status: 'ready', diagnostics: null, warnings: [], reachedMaxChannels: false }),
        };
        const buildExecutor = {
            createChannelsFromSetup: jest.fn().mockResolvedValue({ created: 1, skipped: 0, reachedMaxChannels: false, errorCount: 0, canceled: false }),
        };
        const recordStore = {
            getRecord: jest.fn().mockReturnValue(null),
        };
        const completionTracker = {
            markSetupComplete: jest.fn(),
        };
        const owners = {
            planningService,
            buildExecutor,
            recordStore,
            completionTracker,
            getSelectedServerId: jest.fn(() => 'server-1'),
            getExistingChannelCount: jest.fn(() => 2),
        } as unknown as jest.Mocked<ChannelSetupWorkflowPortOwners>;
        const workflowPort = createChannelSetupWorkflowPort({
            getOwners: () => owners,
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

        expect(planningService.invalidateFacetSnapshot).toHaveBeenCalledTimes(1);
        expect(planningService.getLibrariesForSetup).toHaveBeenCalledTimes(1);
        expect(recordStore.getRecord).toHaveBeenCalledWith('server-1');
        expect(owners.getSelectedServerId).toHaveBeenCalledTimes(1);
        expect(owners.getExistingChannelCount).toHaveBeenCalledTimes(1);
        expect(planningService.getSetupPreview).toHaveBeenCalledWith(config, undefined);
        expect(planningService.getSetupReview).toHaveBeenCalledWith(config, undefined);
        expect(planningService.getSetupPlanDiagnostics).toHaveBeenCalledWith(config, undefined);
        expect(buildExecutor.createChannelsFromSetup).toHaveBeenCalledWith(config, undefined);
        expect(completionTracker.markSetupComplete).toHaveBeenCalledWith('server-1', config);
    });
});
