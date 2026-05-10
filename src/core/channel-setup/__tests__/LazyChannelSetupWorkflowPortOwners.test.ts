import type { ChannelSetupBuildExecutor } from '../build/ChannelSetupBuildExecutor';
import type { ChannelSetupBuildScratchStore } from '../build/ChannelSetupBuildScratchStore';
import type { ChannelSetupPlanningService } from '../planning/ChannelSetupPlanningService';
import type { ChannelSetupRecordStore } from '../persistence/ChannelSetupRecordStore';
import type { LazyChannelSetupWorkflowPortOwnersDeps } from '../workflow/LazyChannelSetupWorkflowPortOwners';

const mockPlanningServiceConstructor = jest.fn();
const mockBuildCommitterConstructor = jest.fn();
const mockBuildExecutorConstructor = jest.fn();

jest.mock('../planning/ChannelSetupPlanningService', () => ({
    ChannelSetupPlanningService: mockPlanningServiceConstructor,
}));

jest.mock('../build/ChannelSetupBuildCommitter', () => ({
    ChannelSetupBuildCommitter: mockBuildCommitterConstructor,
}));

jest.mock('../build/ChannelSetupBuildExecutor', () => ({
    ChannelSetupBuildExecutor: mockBuildExecutorConstructor,
}));

import { createLazyChannelSetupWorkflowPortOwners } from '../workflow/LazyChannelSetupWorkflowPortOwners';

const flushPromises = async (rounds = 4): Promise<void> => {
    for (let index = 0; index < rounds; index += 1) {
        await Promise.resolve();
    }
};

const createDeps = (): LazyChannelSetupWorkflowPortOwnersDeps => ({
    plexLibrary: {
        getLibraries: jest.fn(),
    } as never,
    channelManager: {
        getAllChannels: jest.fn(() => []),
    } as never,
    scratchStore: {
        createTempKeys: jest.fn(),
        cleanupKeys: jest.fn(),
    } as unknown as ChannelSetupBuildScratchStore,
    recordStore: {
        getRecord: jest.fn(() => null),
        markSetupComplete: jest.fn(),
    } as unknown as ChannelSetupRecordStore,
    ensureEpgInitialized: jest.fn().mockResolvedValue(undefined),
    clearSelectedChannelScheduleSnapshot: jest.fn(),
    primeEpgChannels: jest.fn(),
    refreshEpgSchedules: jest.fn().mockResolvedValue(undefined),
    clearRerunRequest: jest.fn(),
    getSelectedServerId: jest.fn(() => 'server-1'),
    getExistingChannelCount: jest.fn(() => 0),
});

describe('createLazyChannelSetupWorkflowPortOwners', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockBuildCommitterConstructor.mockImplementation(() => ({}));
    });

    it('does not instantiate the planning service when invalidating before lazy load', async () => {
        const owners = createLazyChannelSetupWorkflowPortOwners(createDeps());

        owners.planningService.invalidateFacetSnapshot();
        await flushPromises();

        expect(mockPlanningServiceConstructor).not.toHaveBeenCalled();
    });

    it('invalidates the cached planning service after lazy load', async () => {
        const planningService = {
            getLibrariesForSetup: jest.fn().mockResolvedValue([]),
            invalidateFacetSnapshot: jest.fn(),
        } as unknown as ChannelSetupPlanningService;
        mockPlanningServiceConstructor.mockImplementation(() => planningService);
        const owners = createLazyChannelSetupWorkflowPortOwners(createDeps());

        await owners.planningService.getLibrariesForSetup();
        owners.planningService.invalidateFacetSnapshot();
        await flushPromises();

        expect(planningService.invalidateFacetSnapshot).toHaveBeenCalledTimes(1);
        expect(mockPlanningServiceConstructor).toHaveBeenCalledTimes(1);
    });

    it('retries planning service construction after a failed lazy load attempt', async () => {
        const firstError = new Error('planning chunk failed');
        const recoveredPlanningService = {
            getLibrariesForSetup: jest.fn().mockResolvedValue([{ key: '1' }]),
        } as unknown as ChannelSetupPlanningService;
        mockPlanningServiceConstructor
            .mockImplementationOnce(() => {
                throw firstError;
            })
            .mockImplementationOnce(() => recoveredPlanningService);

        const owners = createLazyChannelSetupWorkflowPortOwners(createDeps());

        await expect(owners.planningService.getLibrariesForSetup()).rejects.toThrow(firstError);
        await expect(owners.planningService.getLibrariesForSetup()).resolves.toEqual([{ key: '1' }]);

        expect(mockPlanningServiceConstructor).toHaveBeenCalledTimes(2);
        expect(recoveredPlanningService.getLibrariesForSetup).toHaveBeenCalledTimes(1);
    });

    it('retries build executor construction after a failed lazy load attempt', async () => {
        const planningService = {
            getLibrariesForSetup: jest.fn(),
        } as unknown as ChannelSetupPlanningService;
        const firstError = new Error('build executor chunk failed');
        const recoveredBuildExecutor = {
            createChannelsFromSetup: jest.fn().mockResolvedValue({
                created: 1,
                skipped: 0,
                reachedMaxChannels: false,
                errorCount: 0,
                canceled: false,
            }),
        } as unknown as ChannelSetupBuildExecutor;
        mockPlanningServiceConstructor.mockImplementation(() => planningService);
        mockBuildExecutorConstructor
            .mockImplementationOnce(() => {
                throw firstError;
            })
            .mockImplementationOnce(() => recoveredBuildExecutor);

        const owners = createLazyChannelSetupWorkflowPortOwners(createDeps());
        const config = { serverId: 'server-1' };

        await expect(owners.buildExecutor.createChannelsFromSetup(config as never)).rejects.toThrow(firstError);
        await expect(owners.buildExecutor.createChannelsFromSetup(config as never)).resolves.toEqual({
            created: 1,
            skipped: 0,
            reachedMaxChannels: false,
            errorCount: 0,
            canceled: false,
        });

        expect(mockPlanningServiceConstructor).toHaveBeenCalledTimes(1);
        expect(mockBuildExecutorConstructor).toHaveBeenCalledTimes(2);
        expect(recoveredBuildExecutor.createChannelsFromSetup).toHaveBeenCalledTimes(1);
    });
});
