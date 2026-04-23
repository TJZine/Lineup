/**
 * @fileoverview Public exports for Channel Manager module.
 * @module modules/scheduler/channel-manager
 * @version 1.0.0
 */

// Export main class and error
export { ChannelManager, ChannelError } from './ChannelManager';
export { ContentResolver } from './ContentResolver';
export type { IChannelManager, ChannelManagerConfig, IPlexLibraryMinimal } from './interfaces';
export type {
    ChannelConfig,
    ChannelCreateInput,
    ChannelContentSource,
    LibraryContentSource,
    CollectionContentSource,
    ShowContentSource,
    PlaylistContentSource,
    ManualContentSource,
    MixedContentSource,
    ManualContentItem,
    ContentFilter,
    FilterOperator,
    FilterField,
    ResolvedChannelContent,
    ResolvedContentItem,
    PlaybackMode,
    BuildStrategy,
    SortOrder,
    ImportResult,
    ChannelManagerEventMap,
    ChannelUpdateInput,
} from './types';
export {
    STORAGE_KEY,
    CURRENT_CHANNEL_KEY,
    CACHE_TTL_MS,
    MAX_CHANNELS,
    MIN_CHANNEL_NUMBER,
    MAX_CHANNEL_NUMBER,
} from './constants';
