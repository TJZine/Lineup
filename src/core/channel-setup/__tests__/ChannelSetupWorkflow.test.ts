import { ChannelSetupWorkflow } from '../ChannelSetupWorkflow';
import type { ChannelSetupConfig } from '../types';

const createConfig = (overrides?: Partial<ChannelSetupConfig>): ChannelSetupConfig => ({
    serverId: 'server-1',
    selectedLibraryIds: [],
    maxChannels: 10,
    buildMode: 'replace',
    strategyConfig: {
        collections: { enabled: true, priority: 1, scope: 'per-library' },
        playlists: { enabled: true, priority: 2, scope: 'per-library' },
        genres: { enabled: true, priority: 3, scope: 'per-library' },
        directors: { enabled: true, priority: 4, scope: 'per-library' },
        decades: { enabled: true, priority: 5, scope: 'per-library' },
        recentlyAdded: { enabled: true, priority: 6, scope: 'per-library' },
        studios: { enabled: true, priority: 7, scope: 'per-library' },
        actors: { enabled: true, priority: 8, scope: 'per-library' },
    },
    actorStudioCombineMode: 'separate',
    minItemsPerChannel: 1,
    ...overrides,
});

describe('ChannelSetupWorkflow', () => {
    it('forwards planning/build/record methods to collaborators', async () => {
        const planningService = {
            invalidateFacetSnapshot: jest.fn(),
            getLibrariesForSetup: jest.fn().mockResolvedValue([]),
            getSetupPreview: jest.fn().mockResolvedValue({
                estimates: { total: 0, collections: 0, playlists: 0, genres: 0, directors: 0, decades: 0, recentlyAdded: 0, studios: 0, actors: 0 },
                warnings: [],
                reachedMaxChannels: false,
            }),
            getSetupReview: jest.fn().mockResolvedValue({
                preview: {
                    estimates: { total: 0, collections: 0, playlists: 0, genres: 0, directors: 0, decades: 0, recentlyAdded: 0, studios: 0, actors: 0 },
                    warnings: [],
                    reachedMaxChannels: false,
                },
                diff: { summary: { created: 0, removed: 0, unchanged: 0 }, samples: { created: [], removed: [], unchanged: [] } },
            }),
            getSetupPlanDiagnostics: jest.fn().mockResolvedValue({
                status: 'ready',
                diagnostics: null,
                warnings: [],
                reachedMaxChannels: false,
            }),
        };
        const buildExecutor = {
            createChannelsFromSetup: jest.fn().mockResolvedValue({
                created: 1,
                skipped: 0,
                reachedMaxChannels: false,
                errorCount: 0,
                canceled: false,
            }),
        };
        const recordStore = { getRecord: jest.fn().mockReturnValue(null) };
        const completionTracker = { markSetupComplete: jest.fn() };
        const workflow = new ChannelSetupWorkflow({
            planningService: planningService as never,
            buildExecutor: buildExecutor as never,
            recordStore: recordStore as never,
            completionTracker: completionTracker as never,
            getSelectedServerId: (): string | null => 'server-1',
            getExistingChannelCount: (): number => 2,
        });
        const config = createConfig();

        workflow.invalidateFacetSnapshot();
        await workflow.getLibrariesForSetup();
        workflow.getSetupRecord('server-1');
        expect(workflow.getSetupContextForSelectedServer()).toBe('existing');
        await workflow.getSetupPreview(config);
        await workflow.getSetupReview(config);
        await workflow.getSetupPlanDiagnostics(config);
        await workflow.createChannelsFromSetup(config);

        expect(planningService.invalidateFacetSnapshot).toHaveBeenCalledTimes(1);
        expect(planningService.getLibrariesForSetup).toHaveBeenCalledTimes(1);
        expect(recordStore.getRecord).toHaveBeenCalledWith('server-1');
        expect(planningService.getSetupPreview).toHaveBeenCalledWith(config, undefined);
        expect(planningService.getSetupReview).toHaveBeenCalledWith(config, undefined);
        expect(planningService.getSetupPlanDiagnostics).toHaveBeenCalledWith(config, undefined);
        expect(buildExecutor.createChannelsFromSetup).toHaveBeenCalledWith(config, undefined);
        expect(completionTracker.markSetupComplete).not.toHaveBeenCalled();
    });

    it('keeps completion explicit and separate from createChannelsFromSetup', async () => {
        const completionTracker = { markSetupComplete: jest.fn() };
        const workflow = new ChannelSetupWorkflow({
            planningService: {
                invalidateFacetSnapshot: jest.fn(),
                getLibrariesForSetup: jest.fn().mockResolvedValue([]),
                getSetupPreview: jest.fn(),
                getSetupReview: jest.fn(),
                getSetupPlanDiagnostics: jest.fn(),
            } as never,
            buildExecutor: {
                createChannelsFromSetup: jest.fn().mockResolvedValue({
                    created: 1,
                    skipped: 0,
                    reachedMaxChannels: false,
                    errorCount: 0,
                    canceled: false,
                }),
            } as never,
            recordStore: { getRecord: jest.fn().mockReturnValue(null) } as never,
            completionTracker: completionTracker as never,
            getSelectedServerId: (): string | null => 'server-1',
            getExistingChannelCount: (): number => 0,
        });
        const config = createConfig();

        await workflow.createChannelsFromSetup(config);
        expect(completionTracker.markSetupComplete).not.toHaveBeenCalled();

        workflow.markSetupComplete('server-1', config);
        expect(completionTracker.markSetupComplete).toHaveBeenCalledWith('server-1', config);
    });
});
