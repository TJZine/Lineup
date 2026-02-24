import type { SetupStrategyKey } from '../../../../core/channel-setup/types';

export type { SetupStrategyKey } from '../../../../core/channel-setup/types';

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

export const SERIES_BLOCK_PRESETS = [2, 3, 4, 5] as const;
