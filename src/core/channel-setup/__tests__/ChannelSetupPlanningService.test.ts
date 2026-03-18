/**
 * @jest-environment jsdom
 */

import { ChannelSetupPlanningService } from '../ChannelSetupPlanningService';
import type { ChannelSetupConfig, SetupStrategyConfig, SetupStrategyKey } from '../types';
import { DEFAULT_STRATEGY_PRIORITIES, MIXED_SCOPE_STRATEGY_KEYS, SETUP_STRATEGY_KEYS } from '../constants';
import { PLEX_MEDIA_TYPES } from '../../../modules/plex/library';
import type { IPlexLibrary, PlexLibraryType, PlexTagDirectoryItem } from '../../../modules/plex/library';
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

const makeTag = (overrides: Partial<PlexTagDirectoryItem>): PlexTagDirectoryItem => ({
    key: 'tag',
    title: 'Tag One',
    count: 1,
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
    it('uses tag directories and avoids scan truncation warning for show libraries', async () => {
        const plexLibrary = {
            getPlaylists: jest.fn(),
            getCollections: jest.fn(),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn().mockResolvedValue([
                makeTag({ title: 'Comedy', count: 10 }),
            ]),
            getDirectors: jest.fn().mockResolvedValue([
                makeTag({ title: 'Jane Doe', count: 12 }),
            ]),
            getYears: jest.fn().mockResolvedValue([
                makeTag({ title: '1981', count: 3 }),
                makeTag({ title: '1988', count: 2 }),
                makeTag({ title: '1995', count: 4 }),
            ]),
            getActors: jest.fn(),
            getStudios: jest.fn(),
        } as unknown as jest.Mocked<IPlexLibrary>;

        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;

        const service = new ChannelSetupPlanningService({ plexLibrary, channelManager });
        const config = service.normalizeConfig(createConfig({
            selectedLibraryIds: ['shows'],
            minItemsPerChannel: 3,
            strategyConfig: {
                genres: { enabled: true, priority: 1, scope: 'per-library' },
                decades: { enabled: true, priority: 2, scope: 'per-library' },
                directors: { enabled: true, priority: 3, scope: 'per-library' },
            },
        }));

        const libraries = [makeLibrary({
            id: 'shows',
            title: 'Shows',
            type: 'show',
            contentCount: 1200,
        })];
        const result = await service.buildSetupPlan(config, libraries, null);

        expect(result.canceled).toBe(false);
        expect(result.plan).not.toBeNull();
        expect(result.warnings.join('\n')).not.toContain('truncated at 500');
        expect(result.warnings.join('\n')).not.toContain('scan_library_items');
        expect(plexLibrary.getLibraryItems).not.toHaveBeenCalled();
        expect(plexLibrary.getGenres).toHaveBeenCalledWith(
            'shows',
            expect.objectContaining({ type: PLEX_MEDIA_TYPES.SHOW })
        );
        expect(plexLibrary.getDirectors).toHaveBeenCalledWith(
            'shows',
            expect.objectContaining({ type: PLEX_MEDIA_TYPES.EPISODE })
        );
        expect(plexLibrary.getYears).toHaveBeenCalledWith(
            'shows',
            expect.objectContaining({ type: PLEX_MEDIA_TYPES.SHOW })
        );
        expect(result.plan?.pendingChannels.some((c) => c.name.includes('Shows - Comedy'))).toBe(true);
        expect(result.plan?.pendingChannels.some((c) => c.name.includes('Shows - Jane Doe'))).toBe(true);
        expect(result.plan?.pendingChannels.some((c) => c.name.includes('Shows - 1980s'))).toBe(true);
    });
});
