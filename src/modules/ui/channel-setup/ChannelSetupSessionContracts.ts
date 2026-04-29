import type {
    ChannelBuildProgress,
    ChannelBuildSummary,
    ChannelExpansionConfig,
    ChannelSetupConfig,
    ChannelSetupContext,
    ChannelSetupPreview,
    ChannelSetupReview,
    SeriesOrderingConfig,
    SetupStrategyConfig,
} from '../../../core/channel-setup/types';
import type { PlexLibrarySection } from '../../plex/library';
import type { SetupStrategyKey } from './steps/constants';

type SetupStrategyStateItem = Pick<SetupStrategyConfig, 'enabled' | 'scope'>;

export type SetupStrategyState = Record<SetupStrategyKey, SetupStrategyStateItem>;

export type ChannelExpansionState = Pick<
    ChannelExpansionConfig,
    'addAlternateLineups' | 'alternateLineupCopies' | 'variantType' | 'variantBlockSize'
>;

export type SeriesOrderingState = Pick<SeriesOrderingConfig, 'basePlaybackMode' | 'baseBlockSize'>;

export type StrategyStepMutableState = {
    strategies: SetupStrategyState;
    strategyOrder: SetupStrategyKey[];
    channelExpansion: ChannelExpansionState;
    seriesOrdering: SeriesOrderingState;
    buildMode: ChannelSetupConfig['buildMode'];
    actorStudioCombineMode: ChannelSetupConfig['actorStudioCombineMode'];
    maxChannels: number;
    minItems: number;
};

export type EstimateKey = keyof ChannelSetupPreview['estimates'];

export type SetupStep = 1 | 2 | 3;

export type ChannelSetupPreviewUiStatus = 'idle' | 'loading' | 'ready' | 'blocked' | 'slow' | 'error';

export type ChannelSetupSessionSnapshot = {
    step: SetupStep;
    libraries: PlexLibrarySection[];
    selectedLibraryIds: Set<string>;
    loadError: string | null;
    strategies: SetupStrategyState;
    strategyOrder: SetupStrategyKey[];
    channelExpansion: ChannelExpansionState;
    seriesOrdering: SeriesOrderingState;
    buildMode: ChannelSetupConfig['buildMode'];
    actorStudioCombineMode: ChannelSetupConfig['actorStudioCombineMode'];
    maxChannels: number;
    minItems: number;
    isLoading: boolean;
    isBuilding: boolean;
    isPreviewLoading: boolean;
    isReviewLoading: boolean;
    replaceConfirm: boolean;
    preview: ChannelSetupPreview | null;
    previewError: string | null;
    previewStatus: ChannelSetupPreviewUiStatus;
    review: ChannelSetupReview | null;
    reviewError: string | null;
    previewDeltas: Partial<Record<EstimateKey, number>>;
    previewDeltaExpiresAtMs: number;
    recordApplied: boolean;
    setupContext: ChannelSetupContext;
};

export type ChannelSetupBuildOutcome =
    | { kind: 'missing-server' }
    | { kind: 'canceled' }
    | { kind: 'blocked'; message: string }
    | { kind: 'error'; message: string }
    | {
        kind: 'success';
        serverId: string;
        config: ChannelSetupConfig;
        result: ChannelBuildSummary;
        bookkeepingError?: string;
    };

export type ChannelSetupBuildHandlers = {
    onProgress: (progress: ChannelBuildProgress) => void;
    onStateChange: () => void;
};
