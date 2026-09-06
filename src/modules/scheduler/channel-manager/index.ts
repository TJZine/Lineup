export { ChannelManager, ChannelError } from './ChannelManager';
export type {
    IChannelManager,
    ChannelCreateOptions,
    ChannelManagerConfig,
    IPlexLibraryMinimal,
    ChannelContentResolutionOptions,
} from './contracts/interfaces';
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
} from './contracts/types';
export type {
    ObserveSourceResolution,
    SourceResolutionDiagnostic,
} from './contracts/SourceResolutionDiagnostic';
export {
    STORAGE_KEY,
    CURRENT_CHANNEL_KEY,
    CACHE_TTL_MS,
    MAX_CHANNELS,
    MIN_CHANNEL_NUMBER,
    MAX_CHANNEL_NUMBER,
} from './constants';
