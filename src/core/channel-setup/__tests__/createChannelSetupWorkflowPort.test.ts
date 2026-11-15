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
        expect(() => workflowPort.invalidateSessionData()).toThrow(CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE);
        expect(() => workflowPort.getChannelSetupRecord('server-1')).toThrow(CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE);
        expect(() => workflowPort.getSetupContextForSelectedServer()).toThrow(CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE);
        expect(() => workflowPort.markSetupComplete('server-1', config, 'scope-key')).toThrow(CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE);
    });

    it('rejects promise-returning coordinator methods when channel setup is not initialized', async () => {
        const workflowPort = createWorkflowPort();
        const config = { serverId: 'server-1' } as ChannelSetupConfig;

        await expect(workflowPort.getLibrariesForSetup()).rejects.toThrow(CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE);
        await expect(workflowPort.getSetupPreview(config)).rejects.toThrow(CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE);
        await expect(workflowPort.getSetupReview(config)).rejects.toThrow(CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE);
        await expect(workflowPort.getSetupPlanDiagnostics(config)).rejects.toThrow(CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE);
        await expect(workflowPort.applySetupReview('review-1', config,
            { removalConfirmedForReviewId: null, wholeLineupReplacementConfirmedForReviewId: null }))
            .rejects.toThrow(CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE);
    });

    it('forwards all methods to the resolved workflow port owners', async () => {
        const planningService = {
            invalidateFacetSnapshot: jest.fn(),
            invalidateSessionData: jest.fn(),
            getLibrariesForSetup: jest.fn().mockResolvedValue([]),
            scanSetupInventory: jest.fn().mockResolvedValue({ scopeKey: '', generation: 0, libraries: [], acceptedReadyLibraryIds: [] }),
            retrySetupInventory: jest.fn(),
            getSetupPreview: jest.fn().mockResolvedValue({ estimates: {}, warnings: [], reachedMaxChannels: false }),
            getSetupPlanDiagnostics: jest.fn().mockResolvedValue({ status: 'ready', diagnostics: null, warnings: [], reachedMaxChannels: false }),
        };
        const buildExecutor = {
            prepareSetupReview: jest.fn().mockResolvedValue({ preview: { estimates: {}, warnings: [], reachedMaxChannels: false }, diff: { summary: { created: 0, removed: 0, unchanged: 0 }, samples: { created: [], removed: [], unchanged: [] } } }),
            applySetupReview: jest.fn().mockResolvedValue({ kind: 'committed', summary: { created: 1, skipped: 0, reachedMaxChannels: false, errorCount: 0, canceled: false } }),
            cancelPreparedReview: jest.fn(),
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
        workflowPort.invalidateSessionData();
        await workflowPort.getLibrariesForSetup();
        workflowPort.getChannelSetupRecord('server-1');
        workflowPort.getSetupContextForSelectedServer();
        await workflowPort.getSetupPreview(config);
        await workflowPort.getSetupReview(config);
        await workflowPort.getSetupPlanDiagnostics(config);
        await workflowPort.applySetupReview('review-1', config,
            { removalConfirmedForReviewId: 'review-1', wholeLineupReplacementConfirmedForReviewId: null });
        workflowPort.markSetupComplete('server-1', config, 'scope-key');

        expect(planningService.invalidateFacetSnapshot).toHaveBeenCalledTimes(1);
        expect(planningService.invalidateSessionData).toHaveBeenCalledTimes(1);
        expect(planningService.getLibrariesForSetup).toHaveBeenCalledTimes(1);
        expect(recordStore.getRecord).toHaveBeenCalledWith('server-1');
        expect(owners.getSelectedServerId).toHaveBeenCalledTimes(1);
        expect(owners.getExistingChannelCount).toHaveBeenCalledTimes(1);
        expect(planningService.getSetupPreview).toHaveBeenCalledWith(config, undefined);
        expect(buildExecutor.prepareSetupReview).toHaveBeenCalledWith(config, undefined);
        expect(planningService.getSetupPlanDiagnostics).toHaveBeenCalledWith(config, undefined);
        expect(buildExecutor.applySetupReview).toHaveBeenCalledWith('review-1', config,
            { removalConfirmedForReviewId: 'review-1', wholeLineupReplacementConfirmedForReviewId: null }, undefined);
        expect(completionTracker.markSetupComplete).toHaveBeenCalledWith('server-1', config, 'scope-key');
    });
});
