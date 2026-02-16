import { SETUP_STRATEGY_KEYS } from '../../../../core/channel-setup/constants';

export type SetupStrategyKey = (typeof SETUP_STRATEGY_KEYS)[number];

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
    'limits',
] as const;

export type StrategyCategoryKey = (typeof STRATEGY_CATEGORIES)[number];

export const STEP2_CONTROL_IDS = {
    buildMode: 'setup-build-mode',
    combineMode: 'setup-combine-mode',
    addAlternateLineups: 'setup-expansion-alternate-lineups',
    alternateLineupCopies: 'setup-expansion-copies',
    addSequentialVariants: 'setup-expansion-sequential',
    expandLineup: 'setup-expand-lineup',
    maxChannels: 'setup-max-channels',
    minItems: 'setup-min-items',
} as const;

export const STEP2_ADJUSTABLE_CONTROL_IDS = [
    STEP2_CONTROL_IDS.maxChannels,
    STEP2_CONTROL_IDS.minItems,
    STEP2_CONTROL_IDS.alternateLineupCopies,
] as const;

