import type { ChannelExpansionConfig, SetupStrategyKey } from './types';

export const DEFAULT_MIN_ITEMS_PER_CHANNEL = 5;

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

export const DEFAULT_CHANNEL_EXPANSION: ChannelExpansionConfig = {
    addAlternateLineups: false,
    alternateLineupCopies: 1,
    addSequentialVariants: false,
};

