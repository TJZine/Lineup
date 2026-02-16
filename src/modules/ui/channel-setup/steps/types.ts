import type {
    ChannelSetupConfig,
    ChannelSetupContext,
    ChannelSetupPreview,
    ChannelSetupReview,
} from '../../../../Orchestrator';
import type { PlexLibraryType } from '../../../plex/library';
import type { FocusRegistrationMode } from '../focus/types';

export interface StepRenderContext {
    contentEl: HTMLElement;
    stepEl: HTMLElement;
    statusEl: HTMLElement;
    detailEl: HTMLElement;
    errorEl: HTMLElement;
}

export type StrategyCategoryKey = 'content-sources' | 'advanced-sources' | 'build-options' | 'limits';
export type StrategyScope = 'per-library' | 'cross-library';

export interface StrategyStateItem {
    enabled: boolean;
    priority: number;
    scope: StrategyScope;
}

export type StrategyStateMap = Record<string, StrategyStateItem>;

export interface ChannelExpansionState {
    addAlternateLineups: boolean;
    alternateLineupCopies: number;
    addSequentialVariants: boolean;
}

export interface LibraryStepDeps {
    libraries: PlexLibraryType[];
    selectedLibraryIds: Set<string>;
    formatCount: (value: number) => string;
    movieSvg: string;
    showSvg: string;
    toDomId: (raw: string) => string;
    onToggleLibrary: (libraryId: string, focusId: string) => void;
    onSelectAll: (focusId: string | null) => void;
    onClearAll: (focusId: string | null) => void;
    onBack: () => void;
    onNext: () => void;
    registerFocusables: (buttons: HTMLElement[], mode: FocusRegistrationMode) => void;
    registerBulkActionNeighbors: (
        selectAllButton: HTMLButtonElement,
        clearAllButton: HTMLButtonElement,
        listButtons: HTMLButtonElement[]
    ) => void;
}

export type StrategyStepMutableState = {
    activeStrategyCategory: StrategyCategoryKey;
    strategies: StrategyStateMap;
    channelExpansion: ChannelExpansionState;
    buildMode: ChannelSetupConfig['buildMode'];
    actorStudioCombineMode: ChannelSetupConfig['actorStudioCombineMode'];
    maxChannels: number;
    minItems: number;
};

export type EstimateKey = keyof ChannelSetupPreview['estimates'];

export interface StrategyStepStateSnapshot extends StrategyStepMutableState {
    setupContext: ChannelSetupContext;
    previewPanelId: string;
    preview: ChannelSetupPreview | null;
    previewError: string | null;
    isPreviewLoading: boolean;
}

export interface StrategyStepDeps {
    state: StrategyStepStateSnapshot;
    stepPreset: (options: number[], current: number, dir: 'left' | 'right', mode: 'clamp' | 'wrap') => number;
    channelLimitOptions: number[];
    minItemsOptions: number[];
    strategyKeys: readonly string[];
    categoryButtonId: (category: StrategyCategoryKey) => string;
    strategyButtonId: (strategy: string) => string;
    priorityButtonId: (strategy: string) => string;
    scopeButtonId: (strategy: string) => string;
    strategySupportsMixedScope: (strategy: string) => boolean;
    rememberDetailFocus: (controlId: string) => void;
    buildPreviewRow: (label: string, value: number | string, key?: EstimateKey) => HTMLElement;
    renderCappedWarnings: (warnings: string[], container: HTMLElement) => void;
    applyCategoryChange: (category: StrategyCategoryKey, focusId: string) => void;
    applySettingChange: (
        focusId: string,
        mutate: (state: StrategyStepMutableState) => void
    ) => void;
    onBack: () => void;
    onNext: () => void;
    registerStep2Focusables: (
        categoryButtons: HTMLButtonElement[],
        detailButtons: HTMLButtonElement[],
        backButton: HTMLButtonElement,
        nextButton: HTMLButtonElement
    ) => void;
    detailText: string;
    schedulePreview: () => void;
}

export interface BuildReviewStateSnapshot {
    buildMode: ChannelSetupConfig['buildMode'];
    review: ChannelSetupReview | null;
    reviewError: string | null;
    isReviewLoading: boolean;
    replaceConfirm: boolean;
    isBuilding: boolean;
    recordApplied: boolean;
}

export interface BuildReviewDeps {
    state: BuildReviewStateSnapshot;
    getState: () => BuildReviewStateSnapshot;
    loadReview: () => Promise<void>;
    onBackToStrategy: () => void;
    onConfirmBuild: () => void;
    onToggleReplaceConfirm: (focusId: string) => void;
    buildPreviewRow: (label: string, value: number | string, key?: EstimateKey) => HTMLElement;
    renderCappedWarnings: (warnings: string[], container: HTMLElement) => void;
    registerFocusables: (buttons: HTMLElement[], mode: FocusRegistrationMode) => void;
    renderBuildReviewLoading: (container: HTMLElement) => void;
    getVisibilityToken: () => number;
}

export interface BuildProgressUiRefs {
    cancelButton: HTMLButtonElement;
    doneButton: HTMLButtonElement;
    barFill: HTMLElement;
    taskLabel: HTMLElement;
    detailLabel: HTMLElement;
}

export interface BuildProgressStateSnapshot {
    isBuilding: boolean;
}

export interface BuildProgressDeps {
    state: BuildProgressStateSnapshot;
    registerFocusables: (buttons: HTMLElement[], mode: FocusRegistrationMode) => void;
    onCancelOrBack: (button: HTMLButtonElement) => void;
    onDone: () => void;
    startBuild: (ui: BuildProgressUiRefs) => Promise<void>;
}
