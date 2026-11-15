import type {
    ChannelBuildProgress,
    ChannelBuildSummary,
    ChannelExpansionConfig,
    ChannelSetupConfig,
    ChannelSetupContext,
    ChannelSetupPreview,
    ChannelSetupReview,
    ChannelSetupApplyFailure,
    SeriesOrderingConfig,
    SetupStrategyConfig,
} from '../../../core/channel-setup/types';
import type { PlexLibrarySection } from '../../plex/library';
import type { ChannelSetupInventory } from '../../../core/channel-setup/planning/ChannelSetupInventory';
import type { SetupStrategyKey } from './strategyConstants';

type SetupStrategyStateItem = Pick<SetupStrategyConfig, 'enabled' | 'scope'>;

export type SetupStrategyState = Record<SetupStrategyKey, SetupStrategyStateItem>;

export type ChannelExpansionState = Pick<
    ChannelExpansionConfig,
    'addAlternateLineups' | 'alternateLineupCopies' | 'variantType' | 'variantBlockSize'
>;

export type SeriesOrderingState = SeriesOrderingConfig;

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
    inventory: ChannelSetupInventory | null;
    isInventoryLoading: boolean;
    inventoryError: string | null;
    acceptedReadyLibraryIds: Set<string>;
    confirmedDeselectedLibraryIds: Set<string>;
    knownReadyLibraryIds: Set<string>;
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
    replaceConfirmReviewId: string | null;
    wholeLineupReplacementConfirm: boolean;
    wholeLineupReplacementConfirmReviewId: string | null;
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

type ChannelSetupCompletedBuildOutcome = {
    serverId: string;
    config: ChannelSetupConfig;
    result: ChannelBuildSummary;
    bookkeepingError?: string;
};

export type ChannelSetupBuildOutcome =
    | { kind: 'missing-server' }
    | { kind: 'canceled' }
    | { kind: 'blocked'; message: string; reason?: ChannelSetupApplyFailure }
    | { kind: 'error'; message: string }
    | ({ kind: 'success' } & ChannelSetupCompletedBuildOutcome)
    | ({ kind: 'committed-with-guide-interrupted' } & ChannelSetupCompletedBuildOutcome);

export type ChannelSetupBuildHandlers = {
    onProgress: (progress: ChannelBuildProgress) => void;
    onStateChange: () => void;
};
