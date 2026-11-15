import type {
    ChannelSetupConfig,
    ChannelSetupContext,
    ChannelSetupReview,
} from '../../../../core/channel-setup/types';
import type { ChannelSetupInventory } from '../../../../core/channel-setup/planning/ChannelSetupInventory';
import type { PlexLibrarySection } from '../../../plex/library';
import type {
    StrategyStepMutableState,
} from '../ChannelSetupSessionContracts';
import type { SetupStrategyKey, StrategyCategoryKey } from '../strategyConstants';

export interface LibraryStepDeps {
    libraries: PlexLibrarySection[];
    selectedLibraryIds: Set<string>;
    inventory: ChannelSetupInventory | null;
    isInventoryLoading: boolean;
    inventoryError: string | null;
    acceptedReadyLibraryIds: Set<string>;
    knownReadyLibraryIds: Set<string>;
    confirmedDeselectedLibraryIds: Set<string>;
    formatCount: (value: number) => string;
    movieSvg: string;
    showSvg: string;
    toDomId: (raw: string) => string;
    onToggleLibrary: (libraryId: string, focusId: string) => void;
    onSelectAll: (focusId: string | null) => void;
    onClearAll: (focusId: string | null) => void;
    onBack: () => void;
    onNext: () => void;
    onScan: () => void;
    onCancelScan: () => void;
    onRetry: (libraryId: string, focusId: string) => void;
    onToggleReady: (libraryId: string, focusId: string) => void;
    onToggleDeselectedConsent: (libraryId: string, focusId: string) => void;
    registerStepFocusables: (
        selectAllButton: HTMLButtonElement,
        clearAllButton: HTMLButtonElement,
        listButtons: HTMLButtonElement[],
        footerButtons: HTMLButtonElement[]
    ) => void;
}

export interface StrategyStepStateSnapshot extends StrategyStepMutableState {
    activeStrategyCategory: StrategyCategoryKey;
    setupContext: ChannelSetupContext;
}

export interface StrategyStepDeps {
    state: StrategyStepStateSnapshot;
    strategyKeys: readonly SetupStrategyKey[];
    categoryButtonId: (category: StrategyCategoryKey) => string;
    strategyButtonId: (strategy: SetupStrategyKey) => string;
    priorityRowId: (strategy: SetupStrategyKey) => string;
    lastReorder: { key: SetupStrategyKey; dir: 'up' | 'down' } | null;
    grabbedPriorityKey: SetupStrategyKey | null;
    scopeButtonId: (strategy: SetupStrategyKey) => string;
    strategySupportsMixedScope: (strategy: SetupStrategyKey) => boolean;
    applyCategoryChange: (category: StrategyCategoryKey, focusId: string) => void;
    applySettingChange: (
        focusId: string,
        mutate: (state: StrategyStepMutableState) => void
    ) => void;
    resetGuideOrder: (focusId: string) => void;
    openAdjustableControl: (controlId: string) => void;
    onBack: () => void;
    onNext: () => void;
    registerStep2Focusables: (
        categoryButtons: HTMLButtonElement[],
        detailButtons: HTMLElement[],
        backButton: HTMLButtonElement,
        nextButton: HTMLButtonElement,
        options?: {
            onFocus?: (id: string) => void;
            onDetailFocus?: (id: string) => void;
        }
    ) => void;
    detailText: string;
}

export interface BuildReviewStateSnapshot {
    buildMode: ChannelSetupConfig['buildMode'];
    review: ChannelSetupReview | null;
    reviewError: string | null;
    isReviewLoading: boolean;
    replaceConfirm: boolean;
    wholeLineupReplacementConfirm: boolean;
    isStale: boolean;
    isBuilding: boolean;
    recordApplied: boolean;
}

export interface BuildReviewDeps {
    state: BuildReviewStateSnapshot;
    onBackToStrategy: () => void;
    onConfirmBuild: () => void;
    onToggleReplaceConfirm: (focusId: string) => void;
    onToggleWholeLineupReplacementConfirm: (focusId: string) => void;
    onRefreshReview: () => void;
    renderStep: () => void;
    setPreferredFocusId: (focusId: string | null) => void;
    renderCappedWarnings: (warnings: string[], container: HTMLElement) => void;
    registerLinearFocusables: (buttons: HTMLElement[]) => void;
}

export interface BuildProgressUiRefs {
    cancelButton: HTMLButtonElement;
    doneButton: HTMLButtonElement;
    addCustomButton: HTMLButtonElement;
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
    onDone: (button: HTMLButtonElement) => void;
    onAddCustom: (button: HTMLButtonElement) => void;
    startBuild: (ui: BuildProgressUiRefs) => Promise<void>;
}
