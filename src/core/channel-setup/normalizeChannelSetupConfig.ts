import { DEFAULT_CHANNEL_SETUP_MAX, MAX_CHANNELS } from '../../modules/scheduler/channel-manager/constants';
import type {
    ChannelSetupConfig,
    ChannelExpansionConfig,
    SeriesOrderingConfig,
    SetupStrategyConfig,
    SetupStrategyKey,
} from './types';
import {
    DEFAULT_CHANNEL_EXPANSION,
    DEFAULT_MIN_ITEMS_PER_CHANNEL,
    DEFAULT_SERIES_ORDERING,
    DEFAULT_STRATEGY_PRIORITIES,
    MIXED_SCOPE_STRATEGY_KEYS,
    SETUP_STRATEGY_KEYS,
} from './constants';

const normalizeChannelExpansion = (expansion: ChannelExpansionConfig | undefined): ChannelExpansionConfig => {
    const addAlternateLineups = expansion?.addAlternateLineups === true;
    const alternateLineupCopies = Number.isFinite(expansion?.alternateLineupCopies)
        ? Math.min(3, Math.max(1, Math.floor(Number(expansion?.alternateLineupCopies))))
        : DEFAULT_CHANNEL_EXPANSION.alternateLineupCopies;
    const variantType =
        expansion?.variantType === 'sequential' || expansion?.variantType === 'block'
            ? expansion.variantType
            : 'none';
    const variantBlockSize = Number.isFinite(expansion?.variantBlockSize)
        ? Math.min(5, Math.max(2, Math.floor(Number(expansion?.variantBlockSize))))
        : DEFAULT_CHANNEL_EXPANSION.variantBlockSize;
    return {
        addAlternateLineups,
        alternateLineupCopies,
        variantType,
        variantBlockSize,
    };
};

const normalizeSeriesOrdering = (value: SeriesOrderingConfig | undefined): SeriesOrderingConfig => {
    const basePlaybackMode =
        value?.basePlaybackMode === 'sequential' || value?.basePlaybackMode === 'block'
            ? value.basePlaybackMode
            : 'shuffle';
    const baseBlockSize = Number.isFinite(value?.baseBlockSize)
        ? Math.min(5, Math.max(2, Math.floor(Number(value?.baseBlockSize))))
        : DEFAULT_SERIES_ORDERING.baseBlockSize;
    return {
        basePlaybackMode,
        baseBlockSize,
    };
};

export const normalizeChannelSetupConfig = (config: ChannelSetupConfig): ChannelSetupConfig => {
    const maxChannels = Number.isFinite(config.maxChannels)
        ? Math.min(Math.max(Math.floor(config.maxChannels), 1), MAX_CHANNELS)
        : DEFAULT_CHANNEL_SETUP_MAX;
    const minItemsPerChannel = Number.isFinite(config.minItemsPerChannel)
        ? Math.max(1, Math.floor(config.minItemsPerChannel))
        : DEFAULT_MIN_ITEMS_PER_CHANNEL;
    const buildMode =
        config.buildMode === 'append' || config.buildMode === 'merge' || config.buildMode === 'replace'
            ? config.buildMode
            : 'replace';
    const actorStudioCombineMode =
        config.actorStudioCombineMode === 'combined' || config.actorStudioCombineMode === 'separate'
            ? config.actorStudioCombineMode
            : 'separate';
    const strategySource = (config.strategyConfig ?? {}) as Partial<Record<SetupStrategyKey, SetupStrategyConfig>>;
    const strategyConfig = SETUP_STRATEGY_KEYS.reduce<Record<SetupStrategyKey, SetupStrategyConfig>>((acc, key) => {
        const candidate = strategySource[key];
        const enabled = typeof candidate?.enabled === 'boolean' ? candidate.enabled : true;
        const rawPriority = candidate?.priority;
        const priority = Number.isFinite(rawPriority)
            ? Math.max(1, Math.floor(Number(rawPriority)))
            : DEFAULT_STRATEGY_PRIORITIES[key];
        const scope = MIXED_SCOPE_STRATEGY_KEYS.has(key) && candidate?.scope === 'cross-library'
            ? 'cross-library'
            : 'per-library';
        acc[key] = { enabled, priority, scope };
        return acc;
    }, {} as Record<SetupStrategyKey, SetupStrategyConfig>);

    return {
        ...config,
        maxChannels,
        minItemsPerChannel,
        buildMode,
        actorStudioCombineMode,
        strategyConfig,
        channelExpansion: normalizeChannelExpansion(config.channelExpansion),
        seriesOrdering: normalizeSeriesOrdering(config.seriesOrdering),
    };
};
