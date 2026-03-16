/**
 * @jest-environment jsdom
 */

import { ChannelSetupPlanningService } from '../ChannelSetupPlanningService';
import type { ChannelSetupConfig, SetupStrategyConfig, SetupStrategyKey } from '../types';
import { DEFAULT_STRATEGY_PRIORITIES, MIXED_SCOPE_STRATEGY_KEYS, SETUP_STRATEGY_KEYS } from '../constants';
import type { IPlexLibrary, PlexLibraryType, PlexMediaItem } from '../../../modules/plex/library';
import type { IChannelManager } from '../../../modules/scheduler/channel-manager';

const makeLibrary = (overrides: Partial<PlexLibraryType>): PlexLibraryType => ({
    id: 'lib1',
    uuid: 'uuid-1',
    title: 'Shows',
    type: 'show',
    agent: 'agent',
    scanner: 'scanner',
    contentCount: 0,
    lastScannedAt: new Date(0),
    art: null,
    thumb: null,
    ...overrides,
});

const makeMediaItem = (overrides: Partial<PlexMediaItem>): PlexMediaItem => ({
    ratingKey: overrides.ratingKey ?? 'rk1',
    key: overrides.key ?? '/library/metadata/1',
    type: overrides.type ?? 'show',
    title: overrides.title ?? 'Item',
    sortTitle: overrides.sortTitle ?? 'Item',
    summary: overrides.summary ?? '',
    year: overrides.year ?? 2000,
    durationMs: overrides.durationMs ?? 0,
    addedAt: overrides.addedAt ?? new Date(0),
    updatedAt: overrides.updatedAt ?? new Date(0),
    thumb: overrides.thumb ?? null,
    art: overrides.art ?? null,
    media: overrides.media ?? [],
    ...overrides,
});

const createConfig = (
    overrides: Omit<Partial<ChannelSetupConfig>, 'strategyConfig'> & {
        strategyConfig?: Partial<Record<SetupStrategyKey, Partial<SetupStrategyConfig>>>;
    }
): ChannelSetupConfig => {
    const { strategyConfig: strategyOverrides, ...rest } = overrides;
    const strategyConfig = SETUP_STRATEGY_KEYS.reduce<ChannelSetupConfig['strategyConfig']>((acc, key) => {
        const candidate = strategyOverrides?.[key];
        acc[key] = {
            enabled: candidate?.enabled ?? false,
            priority: candidate?.priority ?? DEFAULT_STRATEGY_PRIORITIES[key],
            scope: MIXED_SCOPE_STRATEGY_KEYS.has(key) && candidate?.scope === 'cross-library' ? 'cross-library' : 'per-library',
        };
        return acc;
    }, {} as ChannelSetupConfig['strategyConfig']);

    return {
        serverId: 'server-1',
        selectedLibraryIds: [],
        maxChannels: 25,
        buildMode: 'replace',
        strategyConfig,
        actorStudioCombineMode: 'separate',
        minItemsPerChannel: 5,
        ...rest,
    };
};

describe('ChannelSetupPlanningService', () => {
    it('preserves tagItems when episode scan fails for show libraries', async () => {
        const plexLibrary = {
            getPlaylists: jest.fn(),
            getCollections: jest.fn(),
            getLibraryItems: jest
                .fn()
                .mockResolvedValueOnce([
                    makeMediaItem({ ratingKey: 'rk1', genres: ['Comedy'] }),
                    makeMediaItem({ ratingKey: 'rk2', genres: ['Comedy'] }),
                    makeMediaItem({ ratingKey: 'rk3', genres: ['Comedy'] }),
                    makeMediaItem({ ratingKey: 'rk4', genres: ['Comedy'] }),
                    makeMediaItem({ ratingKey: 'rk5', genres: ['Comedy'] }),
                ])
                .mockRejectedValueOnce(new Error('episode scan failed')),
            getActors: jest.fn(),
            getStudios: jest.fn(),
        } as unknown as jest.Mocked<IPlexLibrary>;

        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;

        const service = new ChannelSetupPlanningService({ plexLibrary, channelManager });
        const config = service.normalizeConfig(createConfig({
            selectedLibraryIds: ['shows'],
            minItemsPerChannel: 5,
            strategyConfig: {
                genres: { enabled: true, priority: 1, scope: 'per-library' },
                decades: { enabled: true, priority: 2, scope: 'per-library' },
            },
        }));

        const libraries = [makeLibrary({ id: 'shows', title: 'Shows', type: 'show' })];
        const result = await service.buildSetupPlan(config, libraries, null);

        expect(result.canceled).toBe(false);
        expect(result.plan).not.toBeNull();
        expect(result.warnings.join('\n')).toContain('Partial setup plan (scan_library_items)');
        expect(result.plan?.pendingChannels.some((c) => c.name.includes('Comedy'))).toBe(true);
    });
});
