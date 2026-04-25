import type {
    ChannelExpansionConfig,
    ChannelSetupConfig,
    SeriesOrderingConfig,
    SetupStrategyKey,
} from '../ChannelSetupSessionPorts';

export type { SetupStrategyKey } from '../ChannelSetupSessionPorts';

export const DEFAULT_MIN_ITEMS_PER_CHANNEL = 5;

export const CONTENT_STRATEGY_KEYS = [
    'collections',
    'playlists',
    'recentlyAdded',
] as const satisfies readonly SetupStrategyKey[];

export const ADVANCED_STRATEGY_KEYS = [
    'genres',
    'directors',
    'decades',
    'studios',
    'actors',
] as const satisfies readonly SetupStrategyKey[];

export const STRATEGY_CATEGORIES = [
    'content-sources',
    'advanced-sources',
    'build-options',
    'series-ordering',
    'limits',
    'priority-order',
] as const;

export type StrategyCategoryKey = (typeof STRATEGY_CATEGORIES)[number];

export const STEP2_CONTROL_IDS = {
    buildMode: 'setup-build-mode',
    combineMode: 'setup-combine-mode',
    addAlternateLineups: 'setup-expansion-alternate-lineups',
    alternateLineupCopies: 'setup-expansion-copies',
    seriesBaseMode: 'setup-series-base-mode',
    seriesBaseBlockSize: 'setup-series-base-block-size',
    seriesVariantType: 'setup-series-variant-type',
    seriesVariantBlockSize: 'setup-series-variant-block-size',
    expandLineup: 'setup-expand-lineup',
    maxChannels: 'setup-max-channels',
    minItems: 'setup-min-items',
} as const;

export const STEP2_ADJUSTABLE_CONTROL_IDS = [
    STEP2_CONTROL_IDS.maxChannels,
    STEP2_CONTROL_IDS.minItems,
    STEP2_CONTROL_IDS.alternateLineupCopies,
    STEP2_CONTROL_IDS.seriesBaseBlockSize,
    STEP2_CONTROL_IDS.seriesVariantBlockSize,
] as const;

export const BUILD_MODE_OPTIONS = (['replace', 'append', 'merge'] as const) satisfies readonly ChannelSetupConfig['buildMode'][];

export const COMBINE_MODE_OPTIONS = (['separate', 'combined'] as const) satisfies readonly ChannelSetupConfig['actorStudioCombineMode'][];

export const ALTERNATE_LINEUP_COPY_OPTIONS = [1, 2, 3] as const;

export const SERIES_BASE_MODE_OPTIONS = (['shuffle', 'sequential', 'block'] as const) satisfies readonly SeriesOrderingConfig['basePlaybackMode'][];

export const SERIES_VARIANT_TYPE_OPTIONS = (['none', 'sequential', 'block'] as const) satisfies readonly ChannelExpansionConfig['variantType'][];

export const SERIES_BLOCK_PRESETS = [2, 3, 4, 5] as const;

export const SETUP_STRATEGY_KEYS = [
    'collections',
    'playlists',
    'genres',
    'directors',
    'decades',
    'recentlyAdded',
    'studios',
    'actors',
] as const satisfies readonly SetupStrategyKey[];

export const DEFAULT_STRATEGY_PRIORITIES: Record<SetupStrategyKey, number> = {
    playlists: 1,
    collections: 2,
    recentlyAdded: 3,
    genres: 4,
    studios: 5,
    actors: 6,
    decades: 7,
    directors: 8,
};

export const MIXED_SCOPE_STRATEGY_KEYS = new Set<SetupStrategyKey>([
    'genres',
    'directors',
    'studios',
    'actors',
]);
