import { DEFAULT_CHANNEL_SETUP_MAX } from '../../../modules/scheduler/channel-manager/constants';
import { DEFAULT_MIN_ITEMS_PER_CHANNEL, DEFAULT_STRATEGY_PRIORITIES, SETUP_STRATEGY_KEYS } from '../constants';
import { normalizeChannelSetupConfig } from '../config/normalizeChannelSetupConfig';
import type {
    ChannelSetupConfig,
    ChannelSetupRecord,
    SetupStrategyConfig,
    SetupStrategyKey,
} from '../types';

const createStrategyConfig = (): Record<SetupStrategyKey, SetupStrategyConfig> => (
    SETUP_STRATEGY_KEYS.reduce<Record<SetupStrategyKey, SetupStrategyConfig>>((acc, key) => {
        acc[key] = {
            enabled: true,
            priority: DEFAULT_STRATEGY_PRIORITIES[key],
            scope: 'per-library',
        };
        return acc;
    }, {} as Record<SetupStrategyKey, SetupStrategyConfig>)
);

const createConfig = (overrides?: Partial<ChannelSetupConfig>): ChannelSetupConfig => ({
    serverId: 'server-1',
    selectedLibraryIds: ['lib-1'],
    maxChannels: DEFAULT_CHANNEL_SETUP_MAX,
    buildMode: 'replace',
    strategyConfig: createStrategyConfig(),
    actorStudioCombineMode: 'separate',
    minItemsPerChannel: DEFAULT_MIN_ITEMS_PER_CHANNEL,
    ...overrides,
});

describe('normalizeChannelSetupConfig', () => {
    it('normalizes non-array selectedLibraryIds to an empty array', () => {
        const normalized = normalizeChannelSetupConfig({
            ...createConfig(),
            selectedLibraryIds: null,
        } as unknown as ChannelSetupConfig);

        expect(normalized.selectedLibraryIds).toEqual([]);
    });

    it('filters non-string selectedLibraryIds while preserving valid order', () => {
        const normalized = normalizeChannelSetupConfig({
            ...createConfig(),
            selectedLibraryIds: ['lib-1', 42, 'lib-2', null],
        } as unknown as ChannelSetupConfig);

        expect(normalized.selectedLibraryIds).toEqual(['lib-1', 'lib-2']);
    });

    it('falls back to default strategy entries when strategyConfig is missing', () => {
        const normalized = normalizeChannelSetupConfig({
            ...createConfig(),
            strategyConfig: undefined,
        } as unknown as ChannelSetupConfig);

        expect(normalized.strategyConfig.collections).toEqual({
            enabled: true,
            priority: DEFAULT_STRATEGY_PRIORITIES.collections,
            scope: 'per-library',
        });
        expect(normalized.strategyConfig.actors).toEqual({
            enabled: true,
            priority: DEFAULT_STRATEGY_PRIORITIES.actors,
            scope: 'per-library',
        });
    });

    it('normalizes invalid mode fields to canonical defaults', () => {
        const normalized = normalizeChannelSetupConfig({
            ...createConfig(),
            buildMode: 'invalid-mode',
            actorStudioCombineMode: 'invalid-mode',
        } as unknown as ChannelSetupConfig);

        expect(normalized.buildMode).toBe('replace');
        expect(normalized.actorStudioCombineMode).toBe('separate');
    });

    it('preserves record metadata while returning normalized nested config objects', () => {
        const record: ChannelSetupRecord = {
            ...createConfig(),
            createdAt: 1_000,
            updatedAt: 2_000,
        };

        const normalized = normalizeChannelSetupConfig(record);
        const roundTripRecord: ChannelSetupRecord = normalized;

        expect(roundTripRecord.createdAt).toBe(1_000);
        expect(roundTripRecord.updatedAt).toBe(2_000);
        expect(roundTripRecord.channelExpansion).toEqual({
            addAlternateLineups: false,
            alternateLineupCopies: 1,
            variantType: 'none',
            variantBlockSize: 3,
        });
        expect(roundTripRecord.seriesOrdering).toEqual({
            basePlaybackMode: 'shuffle',
            baseBlockSize: 3,
        });
    });
});
