import type {
    ChannelSetupConfig,
    ChannelSetupContext,
    ChannelSetupPreview,
    ChannelSetupReview,
} from '../../../../core/channel-setup/types';
import type { PlexLibrarySection } from '../../../plex/library';
import type {
    EstimateKey,
    StrategyStepMutableState,
} from '../ChannelSetupSessionContracts';
import type { SetupStrategyKey, StrategyCategoryKey } from './constants';

export type { SetupStrategyKey, StrategyCategoryKey } from './constants';

export interface StepRenderContext {
    contentEl: HTMLElement;
    stepEl: HTMLElement;
    statusEl: HTMLElement;
    detailEl: HTMLElement;
    errorEl: HTMLElement;
}

export interface LibraryStepDeps {
    libraries: PlexLibrarySection[];
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
    registerSpatialFocusables: (buttons: HTMLElement[]) => void;
    registerBulkActionNeighbors: (
        selectAllButton: HTMLButtonElement,
        clearAllButton: HTMLButtonElement,
        listButtons: HTMLButtonElement[]
    ) => void;
}

export interface StrategyStepStateSnapshot extends StrategyStepMutableState {
    setupContext: ChannelSetupContext;
    previewPanelId: string;
    preview: ChannelSetupPreview | null;
    previewError: string | null;
    previewStatus: 'idle' | 'loading' | 'ready' | 'blocked' | 'slow' | 'error';
    isPreviewLoading: boolean;
}

export interface StrategyStepDeps {
    state: StrategyStepStateSnapshot;
    strategyKeys: readonly SetupStrategyKey[];
    categoryButtonId: (category: StrategyCategoryKey) => string;
    strategyButtonId: (strategy: SetupStrategyKey) => string;
    priorityRowId: (strategy: SetupStrategyKey) => string;
    lastReorder: { key: SetupStrategyKey; dir: 'up' | 'down' } | null;
    scopeButtonId: (strategy: SetupStrategyKey) => string;
    strategySupportsMixedScope: (strategy: SetupStrategyKey) => boolean;
    buildPreviewRow: (label: string, value: number | string, key?: EstimateKey) => HTMLElement;
    renderCappedWarnings: (warnings: string[], container: HTMLElement) => void;
    applyCategoryChange: (category: StrategyCategoryKey, focusId: string) => void;
    applySettingChange: (
        focusId: string,
        mutate: (state: StrategyStepMutableState) => void
    ) => void;
    openAdjustableControl: (controlId: string) => void;
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

export interface StrategyStepDropdownConfig {
    anchorId: string;
    options: Array<{ label: string; value: string }>;
    currentValue: string;
    onSelect: (value: string) => void;
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
    onBackToStrategy: () => void;
    onConfirmBuild: () => void;
    onToggleReplaceConfirm: (focusId: string) => void;
    buildPreviewRow: (label: string, value: number | string, key?: EstimateKey) => HTMLElement;
    renderCappedWarnings: (warnings: string[], container: HTMLElement) => void;
    registerLinearFocusables: (buttons: HTMLElement[]) => void;
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
    registerLinearFocusables: (buttons: HTMLElement[]) => void;
    onCancelOrBack: (button: HTMLButtonElement) => void;
    onDone: () => void;
    startBuild: (ui: BuildProgressUiRefs) => Promise<void>;
}
