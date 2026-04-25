/**
 * @jest-environment jsdom
 */

import { ChannelSetupBuildExecutor } from '../build/ChannelSetupBuildExecutor';
import type { ChannelSetupPlanningService } from '../planning/ChannelSetupPlanningService';
import type { ChannelSetupBuildCommitter } from '../build/ChannelSetupBuildCommitter';
import type { IChannelManager } from '../../../modules/scheduler/channel-manager';
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

describe('ChannelSetupBuildExecutor', () => {
    it('preserves empty blocked messages and planning warnings in blocked summaries', async () => {
        const planningService = {
            getLibrariesForSetup: jest.fn().mockResolvedValue([]),
            buildSetupPlan: jest.fn().mockResolvedValue({
                plan: null,
                warnings: ['tag counts were recovered from fallback'],
                canceled: false,
                blockedMessage: '',
                lastTask: 'build_pending',
                errorsTotal: 2,
                playlistMs: 0,
                collectionsMs: 0,
                libraryQueryMs: 0,
            }),
        } as unknown as jest.Mocked<ChannelSetupPlanningService>;
        const channelManager = {
            getAllChannels: jest.fn(),
        } as unknown as jest.Mocked<IChannelManager>;
        const buildCommitter = {
            commitBuild: jest.fn(),
        } as unknown as jest.Mocked<ChannelSetupBuildCommitter>;
        const executor = new ChannelSetupBuildExecutor({
            channelManager,
            planningService,
            buildCommitter,
        });

        const result = await executor.createChannelsFromSetup(createConfig());

        expect(result).toEqual({
            created: 0,
            skipped: 0,
            reachedMaxChannels: false,
            errorCount: 2,
            canceled: false,
            blockedMessage: '',
            lastTask: 'build_pending',
            warnings: ['tag counts were recovered from fallback'],
        });
        expect(buildCommitter.commitBuild).not.toHaveBeenCalled();
        expect(channelManager.getAllChannels).not.toHaveBeenCalled();
    });

    it('captures progress callback failures as warnings without aborting the build', async () => {
        const planningService = {
            getLibrariesForSetup: jest.fn().mockResolvedValue([]),
            buildSetupPlan: jest.fn().mockResolvedValue({
                plan: {
                    pendingChannels: [],
                    skipped: 0,
                    reachedMaxChannels: false,
                    warnings: [],
                    estimates: {
                        total: 0,
                        collections: 0,
                        playlists: 0,
                        genres: 0,
                        directors: 0,
                        decades: 0,
                        recentlyAdded: 0,
                        studios: 0,
                        actors: 0,
                    },
                },
                warnings: [],
                canceled: false,
                errorsTotal: 0,
                playlistMs: 0,
                collectionsMs: 0,
                libraryQueryMs: 0,
            }),
            getPendingChannelsForMode: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<ChannelSetupPlanningService>;
        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;
        const buildCommitter = {
            commitBuild: jest.fn().mockResolvedValue({
                summary: {
                    created: 0,
                    skipped: 0,
                    reachedMaxChannels: false,
                    errorCount: 0,
                    canceled: false,
                    lastTask: 'done',
                },
                epgRefreshFailed: false,
            }),
        } as unknown as jest.Mocked<ChannelSetupBuildCommitter>;
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const executor = new ChannelSetupBuildExecutor({
            channelManager,
            planningService,
            buildCommitter,
        });
        let hasThrown = false;

        const result = await executor.createChannelsFromSetup(createConfig(), {
            onProgress: (): void => {
                if (!hasThrown) {
                    hasThrown = true;
                    throw new Error('progress listener blew up');
                }
            },
        });

        expect(result.warnings).toEqual([
            '[ChannelSetup] progress callback failed: progress listener blew up',
        ]);
        expect(buildCommitter.commitBuild).toHaveBeenCalledTimes(1);
        expect(warnSpy).not.toHaveBeenCalled();

        warnSpy.mockRestore();
    });

    it('preserves planning warnings on successful builds', async () => {
        const planningService = {
            getLibrariesForSetup: jest.fn().mockResolvedValue([]),
            buildSetupPlan: jest.fn().mockResolvedValue({
                plan: {
                    pendingChannels: [],
                    skipped: 0,
                    reachedMaxChannels: false,
                    warnings: [],
                    estimates: {
                        total: 0,
                        collections: 0,
                        playlists: 0,
                        genres: 0,
                        directors: 0,
                        decades: 0,
                        recentlyAdded: 0,
                        studios: 0,
                        actors: 0,
                    },
                },
                warnings: ['recovered missing tag counts'],
                canceled: false,
                errorsTotal: 0,
                playlistMs: 0,
                collectionsMs: 0,
                libraryQueryMs: 0,
            }),
            getPendingChannelsForMode: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<ChannelSetupPlanningService>;
        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;
        const buildCommitter = {
            commitBuild: jest.fn().mockResolvedValue({
                summary: {
                    created: 1,
                    skipped: 0,
                    reachedMaxChannels: false,
                    errorCount: 0,
                    canceled: false,
                    lastTask: 'done',
                },
                epgRefreshFailed: false,
            }),
        } as unknown as jest.Mocked<ChannelSetupBuildCommitter>;
        const executor = new ChannelSetupBuildExecutor({
            channelManager,
            planningService,
            buildCommitter,
        });

        const result = await executor.createChannelsFromSetup(createConfig());

        expect(result.warnings).toEqual(['recovered missing tag counts']);
    });

    it('formats object-only progress callback failures with a structured fallback', async () => {
        const planningService = {
            getLibrariesForSetup: jest.fn().mockResolvedValue([]),
            buildSetupPlan: jest.fn().mockResolvedValue({
                plan: {
                    pendingChannels: [],
                    skipped: 0,
                    reachedMaxChannels: false,
                    warnings: [],
                    estimates: {
                        total: 0,
                        collections: 0,
                        playlists: 0,
                        genres: 0,
                        directors: 0,
                        decades: 0,
                        recentlyAdded: 0,
                        studios: 0,
                        actors: 0,
                    },
                },
                warnings: [],
                canceled: false,
                errorsTotal: 0,
                playlistMs: 0,
                collectionsMs: 0,
                libraryQueryMs: 0,
            }),
            getPendingChannelsForMode: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<ChannelSetupPlanningService>;
        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;
        const buildCommitter = {
            commitBuild: jest.fn().mockResolvedValue({
                summary: {
                    created: 0,
                    skipped: 0,
                    reachedMaxChannels: false,
                    errorCount: 0,
                    canceled: false,
                    lastTask: 'done',
                },
                epgRefreshFailed: false,
            }),
        } as unknown as jest.Mocked<ChannelSetupBuildCommitter>;
        const executor = new ChannelSetupBuildExecutor({
            channelManager,
            planningService,
            buildCommitter,
        });
        let hasThrown = false;

        const result = await executor.createChannelsFromSetup(createConfig(), {
            onProgress: (): void => {
                if (!hasThrown) {
                    hasThrown = true;
                    throw { summary: { reason: 'bad-progress' } };
                }
            },
        });

        expect(result.warnings).toEqual([
            '[ChannelSetup] progress callback failed: {}',
        ]);
    });
});
