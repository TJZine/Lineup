import type { KeyEvent } from '../../../navigation';
import type { INavigationManager } from '../../../navigation/interfaces';
import type {
    ChannelSetupSessionSnapshot,
    StrategyStepMutableState,
} from '../ChannelSetupSessionContracts';
import {
    ADVANCED_STRATEGY_KEYS,
    ALTERNATE_LINEUP_COPY_OPTIONS,
    BUILD_MODE_OPTIONS,
    COMBINE_MODE_OPTIONS,
    CONTENT_STRATEGY_KEYS,
    SERIES_BASE_MODE_OPTIONS,
    SERIES_BLOCK_PRESETS,
    SERIES_VARIANT_TYPE_OPTIONS,
    STEP2_CONTROL_IDS,
    STRATEGY_CATEGORIES,
    type SetupStrategyKey,
    type StrategyCategoryKey,
} from './constants';
import type { StrategyStepDropdownConfig } from './types';
import type { RegisterStep2FocusOptions } from '../focus/types';

type AdjustableControl = {
    cyclePrev: () => boolean;
    cycleNext: () => boolean;
    isDisabled: () => boolean;
    openDropdown: () => void;
};

type StrategyControlValue = string | number;

type StrategyControlDescriptor = {
    controlId: string;
    options: (adapters: StrategyControlOptionsAdapters) => readonly StrategyControlValue[];
    currentValue: (session: ChannelSetupSessionSnapshot) => StrategyControlValue;
    applyValue: (draft: StrategyStepMutableState, value: StrategyControlValue) => void;
    cycleMode?: 'discrete' | 'preset';
    isDisabled?: (session: ChannelSetupSessionSnapshot) => boolean;
};

type StrategyControlOptionsAdapters = {
    channelLimitOptions: number[];
    minItemsOptions: number[];
};

type StrategyStepInteractionAdapters = {
    deferDropdownRender: () => void;
    dismissDropdown: () => void;
    getPreferredFocusId: () => string | null;
    getSessionSnapshot: () => ChannelSetupSessionSnapshot;
    hasActiveDropdown: () => boolean;
    openDropdown: (config: StrategyStepDropdownConfig) => void;
    registerStep2: (options: RegisterStep2FocusOptions) => boolean;
    renderStep: () => void;
    setPreferredFocusId: (focusId: string | null) => void;
    setPriorityRowGrabbedVisual: (strategy: SetupStrategyKey | null, grabbed: boolean) => void;
    stepPreset: (
        options: number[],
        current: number,
        dir: 'left' | 'right',
        mode: 'clamp' | 'wrap'
    ) => number;
    updatePriorityRowState: (rowId: string, enabled: boolean) => boolean;
    updateStrategyState: (mutate: (draft: StrategyStepMutableState) => void) => void;
};

const STRATEGY_CONTROL_DESCRIPTORS: readonly StrategyControlDescriptor[] = [
    {
        controlId: STEP2_CONTROL_IDS.buildMode,
        options: (): readonly StrategyControlValue[] => BUILD_MODE_OPTIONS,
        currentValue: (session): StrategyControlValue => session.buildMode,
        applyValue: (draft, value): void => {
            draft.buildMode = value as typeof draft.buildMode;
        },
    },
    {
        controlId: STEP2_CONTROL_IDS.combineMode,
        options: (): readonly StrategyControlValue[] => COMBINE_MODE_OPTIONS,
        currentValue: (session): StrategyControlValue => session.actorStudioCombineMode,
        applyValue: (draft, value): void => {
            draft.actorStudioCombineMode = value as typeof draft.actorStudioCombineMode;
        },
    },
    {
        controlId: STEP2_CONTROL_IDS.alternateLineupCopies,
        options: (): readonly StrategyControlValue[] => ALTERNATE_LINEUP_COPY_OPTIONS,
        currentValue: (session): StrategyControlValue => session.channelExpansion.alternateLineupCopies,
        applyValue: (draft, value): void => {
            draft.channelExpansion.alternateLineupCopies = Number(value);
        },
        isDisabled: (session): boolean => !session.channelExpansion.addAlternateLineups,
    },
    {
        controlId: STEP2_CONTROL_IDS.seriesBaseMode,
        options: (): readonly StrategyControlValue[] => SERIES_BASE_MODE_OPTIONS,
        currentValue: (session): StrategyControlValue => session.seriesOrdering.basePlaybackMode,
        applyValue: (draft, value): void => {
            draft.seriesOrdering.basePlaybackMode = value as typeof draft.seriesOrdering.basePlaybackMode;
        },
    },
    {
        controlId: STEP2_CONTROL_IDS.seriesBaseBlockSize,
        options: (): readonly StrategyControlValue[] => SERIES_BLOCK_PRESETS,
        currentValue: (session): StrategyControlValue => session.seriesOrdering.baseBlockSize,
        applyValue: (draft, value): void => {
            draft.seriesOrdering.baseBlockSize = Number(value);
        },
        isDisabled: (session): boolean => session.seriesOrdering.basePlaybackMode !== 'block',
    },
    {
        controlId: STEP2_CONTROL_IDS.seriesVariantType,
        options: (): readonly StrategyControlValue[] => SERIES_VARIANT_TYPE_OPTIONS,
        currentValue: (session): StrategyControlValue => session.channelExpansion.variantType,
        applyValue: (draft, value): void => {
            draft.channelExpansion.variantType = value as typeof draft.channelExpansion.variantType;
        },
    },
    {
        controlId: STEP2_CONTROL_IDS.seriesVariantBlockSize,
        options: (): readonly StrategyControlValue[] => SERIES_BLOCK_PRESETS,
        currentValue: (session): StrategyControlValue => session.channelExpansion.variantBlockSize,
        applyValue: (draft, value): void => {
            draft.channelExpansion.variantBlockSize = Number(value);
        },
        isDisabled: (session): boolean => session.channelExpansion.variantType !== 'block',
    },
    {
        controlId: STEP2_CONTROL_IDS.maxChannels,
        options: (adapters): readonly StrategyControlValue[] => adapters.channelLimitOptions,
        currentValue: (session): StrategyControlValue => session.maxChannels,
        applyValue: (draft, value): void => {
            draft.maxChannels = Number(value);
        },
        cycleMode: 'preset',
    },
    {
        controlId: STEP2_CONTROL_IDS.minItems,
        options: (adapters): readonly StrategyControlValue[] => adapters.minItemsOptions,
        currentValue: (session): StrategyControlValue => session.minItems,
        applyValue: (draft, value): void => {
            draft.minItems = Number(value);
        },
        cycleMode: 'preset',
    },
];

export class StrategyStepInteractionController {
    private _activeStrategyCategory: StrategyCategoryKey = 'content-sources';
    private _rememberedDetailFocusByCategory: Partial<Record<StrategyCategoryKey, string>> = {};
    private _lastReorder: { key: SetupStrategyKey; dir: 'up' | 'down' } | null = null;
    private _grabbedPriorityKey: SetupStrategyKey | null = null;

    constructor(
        private readonly _deps: {
            strategySupportsMixedScope: (strategy: SetupStrategyKey) => boolean;
            toDomId: (raw: string) => string;
        }
    ) {}

    reset(): void {
        this._activeStrategyCategory = 'content-sources';
        this._rememberedDetailFocusByCategory = {};
        this._lastReorder = null;
        this._grabbedPriorityKey = null;
    }

    getActiveStrategyCategory(): StrategyCategoryKey {
        return this._activeStrategyCategory;
    }

    getLastReorder(): { key: SetupStrategyKey; dir: 'up' | 'down' } | null {
        return this._lastReorder;
    }

    getGrabbedPriorityKey(): SetupStrategyKey | null {
        return this._grabbedPriorityKey;
    }

    clearTransientState(
        setPriorityRowGrabbedVisual: (strategy: SetupStrategyKey | null, grabbed: boolean) => void
    ): void {
        this._lastReorder = null;
        this._clearGrabbedPriority(setPriorityRowGrabbedVisual);
    }

    categoryButtonId(category: StrategyCategoryKey): string {
        return `setup-category-${category}`;
    }

    strategyButtonId(strategy: SetupStrategyKey): string {
        return `setup-strategy-${this._deps.toDomId(String(strategy))}`;
    }

    priorityRowId(strategy: SetupStrategyKey): string {
        return `setup-priority-row-${this._deps.toDomId(String(strategy))}`;
    }

    scopeButtonId(strategy: SetupStrategyKey): string {
        return `setup-scope-${this._deps.toDomId(String(strategy))}`;
    }

    applyCategoryChange(
        category: StrategyCategoryKey,
        focusId: string,
        adapters: Pick<
            StrategyStepInteractionAdapters,
            'renderStep' | 'setPreferredFocusId' | 'setPriorityRowGrabbedVisual'
        >
    ): void {
        if (category !== 'priority-order') {
            this._clearGrabbedPriority(adapters.setPriorityRowGrabbedVisual);
        }
        this._activeStrategyCategory = category;
        adapters.setPreferredFocusId(focusId);
        adapters.renderStep();
    }

    applySettingChange(
        focusId: string,
        mutate: (state: StrategyStepMutableState) => void,
        adapters: Pick<
            StrategyStepInteractionAdapters,
            | 'deferDropdownRender'
            | 'getSessionSnapshot'
            | 'hasActiveDropdown'
            | 'renderStep'
            | 'setPreferredFocusId'
            | 'updatePriorityRowState'
            | 'updateStrategyState'
        > & {
            schedulePreview: () => void;
        }
    ): void {
        adapters.setPreferredFocusId(focusId);
        this._rememberActiveDetailFocus(focusId, adapters.getSessionSnapshot());
        adapters.updateStrategyState((draft: StrategyStepMutableState) => {
            mutate(draft);
        });
        adapters.schedulePreview();

        if (focusId.startsWith('setup-priority-row-')) {
            const strategy = this._strategyKeyFromControlId(focusId, 'setup-priority-row-');
            if (strategy) {
                const updatedSession = adapters.getSessionSnapshot();
                const updated = adapters.updatePriorityRowState(
                    this.priorityRowId(strategy),
                    updatedSession.strategies[strategy].enabled
                );
                if (updated) {
                    adapters.setPreferredFocusId(null);
                }
            }
        }

        if (adapters.hasActiveDropdown()) {
            adapters.deferDropdownRender();
            return;
        }

        adapters.renderStep();
    }

    openAdjustableControl(
        controlId: string,
        adapters: Pick<
            StrategyStepInteractionAdapters,
            | 'deferDropdownRender'
            | 'getSessionSnapshot'
            | 'hasActiveDropdown'
            | 'openDropdown'
            | 'renderStep'
            | 'setPreferredFocusId'
            | 'updatePriorityRowState'
            | 'updateStrategyState'
        > & {
            channelLimitOptions: number[];
            minItemsOptions: number[];
            schedulePreview: () => void;
        }
    ): void {
        const config = this._buildDropdownConfig(controlId, adapters);
        if (config) {
            adapters.openDropdown(config);
        }
    }

    handleKeyPress(
        event: KeyEvent,
        nav: INavigationManager,
        adapters: StrategyStepInteractionAdapters & {
            channelLimitOptions: number[];
            minItemsOptions: number[];
            schedulePreview: () => void;
        }
    ): void {
        if (event.handled) {
            return;
        }

        if (adapters.hasActiveDropdown() && event.button === 'back') {
            event.handled = true;
            event.originalEvent.preventDefault();
            adapters.dismissDropdown();
            return;
        }

        const focusedId = nav.getFocusedElement()?.id ?? null;
        if (!focusedId) {
            return;
        }

        const session = adapters.getSessionSnapshot();
        const activeCategoryButtonId = this.categoryButtonId(this._activeStrategyCategory);
        const adjustableControl = this._getAdjustableControl(focusedId, adapters, session);
        if (adjustableControl && !adjustableControl.isDisabled()) {
            if (event.button === 'ok') {
                event.handled = true;
                event.originalEvent.preventDefault();
                adjustableControl.openDropdown();
                return;
            }
            if (event.button === 'right') {
                event.handled = true;
                event.originalEvent.preventDefault();
                adjustableControl.cycleNext();
                return;
            }
            if (event.button === 'left') {
                event.handled = true;
                event.originalEvent.preventDefault();
                const changed = adjustableControl.cyclePrev();
                if (!changed) {
                    adapters.setPreferredFocusId(activeCategoryButtonId);
                    nav.setFocus(activeCategoryButtonId);
                }
                return;
            }
        }

        if (
            this._activeStrategyCategory === 'priority-order'
            && focusedId.startsWith('setup-priority-row-')
            && event.button === 'ok'
        ) {
            event.handled = true;
            event.originalEvent.preventDefault();
            const strategy = this._strategyKeyFromControlId(focusedId, 'setup-priority-row-');
            if (!strategy) {
                return;
            }

            if (this._grabbedPriorityKey === strategy) {
                adapters.setPriorityRowGrabbedVisual(strategy, false);
                this._grabbedPriorityKey = null;
            } else {
                if (this._grabbedPriorityKey) {
                    adapters.setPriorityRowGrabbedVisual(this._grabbedPriorityKey, false);
                }
                this._grabbedPriorityKey = strategy;
                adapters.setPriorityRowGrabbedVisual(strategy, true);
            }
            return;
        }

        if (
            this._activeStrategyCategory === 'priority-order'
            && focusedId.startsWith('setup-priority-row-')
            && this._grabbedPriorityKey !== null
            && (event.button === 'up' || event.button === 'down')
        ) {
            if (event.isRepeat || event.isLongPress) {
                event.handled = true;
                event.originalEvent.preventDefault();
                return;
            }

            const strategy = this._grabbedPriorityKey;
            const currentIndex = session.strategyOrder.indexOf(strategy);
            if (currentIndex < 0) {
                event.handled = true;
                event.originalEvent.preventDefault();
                return;
            }

            const targetIndex = event.button === 'up' ? currentIndex - 1 : currentIndex + 1;
            if (targetIndex < 0 || targetIndex >= session.strategyOrder.length) {
                event.handled = true;
                event.originalEvent.preventDefault();
                return;
            }

            const targetKey = session.strategyOrder[targetIndex];
            if (!targetKey) {
                event.handled = true;
                event.originalEvent.preventDefault();
                return;
            }

            event.handled = true;
            event.originalEvent.preventDefault();
            adapters.updateStrategyState((draft) => {
                draft.strategyOrder[currentIndex] = targetKey;
                draft.strategyOrder[targetIndex] = strategy;
            });
            this._lastReorder = { key: strategy, dir: event.button === 'up' ? 'up' : 'down' };
            const focusId = this.priorityRowId(strategy);
            adapters.setPreferredFocusId(focusId);
            this._rememberedDetailFocusByCategory['priority-order'] = focusId;
            adapters.schedulePreview();
            adapters.renderStep();
            this._lastReorder = null;
            adapters.setPriorityRowGrabbedVisual(strategy, true);
            return;
        }

        const direction = event.button === 'left'
            ? 'left'
            : event.button === 'right'
                ? 'right'
                : null;
        if (!direction) {
            return;
        }

        const activeDetailIds = this._getDetailControlIdsForCategory(this._activeStrategyCategory, session);
        const focusedCategory = this._categoryFromButtonId(focusedId);

        if (focusedCategory && direction === 'right') {
            if (focusedCategory !== this._activeStrategyCategory) {
                if (focusedCategory !== 'priority-order') {
                    this._clearGrabbedPriority(adapters.setPriorityRowGrabbedVisual);
                }
                this._activeStrategyCategory = focusedCategory;
            }
            const detailIds = this._getDetailControlIdsForCategory(focusedCategory, session);
            const target = this._resolveDetailFocusTarget(focusedCategory, detailIds, session);
            if (target) {
                event.handled = true;
                event.originalEvent.preventDefault();
                adapters.setPreferredFocusId(target);
                this._rememberedDetailFocusByCategory[focusedCategory] = target;
                adapters.renderStep();
            }
            return;
        }

        if (direction === 'left' && activeDetailIds.includes(focusedId)) {
            event.handled = true;
            event.originalEvent.preventDefault();
            this._clearGrabbedPriority(adapters.setPriorityRowGrabbedVisual);
            adapters.setPreferredFocusId(activeCategoryButtonId);
            nav.setFocus(activeCategoryButtonId);
        }
    }

    registerStep2Focusables(
        categoryButtons: HTMLButtonElement[],
        detailButtons: HTMLButtonElement[],
        backButton: HTMLButtonElement,
        nextButton: HTMLButtonElement,
        adapters: Pick<
            StrategyStepInteractionAdapters,
            'getPreferredFocusId' | 'getSessionSnapshot' | 'registerStep2' | 'setPreferredFocusId'
        >
    ): void {
        const activeCategoryButtonId = this.categoryButtonId(this._activeStrategyCategory);
        const detailIds = detailButtons.filter((button) => !button.disabled).map((button) => button.id);
        const detailFocusTarget = this._resolveDetailFocusTarget(
            this._activeStrategyCategory,
            detailIds,
            adapters.getSessionSnapshot()
        );
        const preferredApplied = adapters.registerStep2({
            categoryButtons,
            detailButtons,
            footerButtons: [backButton, nextButton],
            activeCategoryId: activeCategoryButtonId,
            detailFocusTarget,
            preferredFocusId: adapters.getPreferredFocusId(),
            onDetailFocus: (id) => {
                this._rememberActiveDetailFocus(id, adapters.getSessionSnapshot());
            },
        });
        if (preferredApplied) {
            adapters.setPreferredFocusId(null);
        }
    }

    private _clearGrabbedPriority(
        setPriorityRowGrabbedVisual: (strategy: SetupStrategyKey | null, grabbed: boolean) => void
    ): void {
        if (!this._grabbedPriorityKey) {
            return;
        }
        setPriorityRowGrabbedVisual(this._grabbedPriorityKey, false);
        this._grabbedPriorityKey = null;
    }

    private _buildDropdownConfig(
        controlId: string,
        adapters: Pick<
            StrategyStepInteractionAdapters,
            | 'deferDropdownRender'
            | 'getSessionSnapshot'
            | 'hasActiveDropdown'
            | 'openDropdown'
            | 'renderStep'
            | 'setPreferredFocusId'
            | 'updatePriorityRowState'
            | 'updateStrategyState'
        > & {
            channelLimitOptions: number[];
            minItemsOptions: number[];
            schedulePreview: () => void;
        }
    ): StrategyStepDropdownConfig | null {
        const session = adapters.getSessionSnapshot();
        const descriptor = this._getControlDescriptor(controlId);
        if (!descriptor || this._isDescriptorDisabled(descriptor, session)) {
            return null;
        }

        return {
            anchorId: controlId,
            options: descriptor.options(adapters).map((value) => ({
                label: this._formatDropdownLabel(value),
                value: String(value),
            })),
            currentValue: String(descriptor.currentValue(session)),
            onSelect: (value): void => {
                this.applySettingChange(controlId, (draft) => {
                    descriptor.applyValue(draft, value);
                }, adapters);
            },
        };
    }

    private _getAdjustableControl(
        controlId: string,
        adapters: Pick<
            StrategyStepInteractionAdapters,
            | 'deferDropdownRender'
            | 'getSessionSnapshot'
            | 'hasActiveDropdown'
            | 'openDropdown'
            | 'renderStep'
            | 'setPreferredFocusId'
            | 'stepPreset'
            | 'updatePriorityRowState'
            | 'updateStrategyState'
        > & {
            channelLimitOptions: number[];
            minItemsOptions: number[];
            schedulePreview: () => void;
        },
        session: ChannelSetupSessionSnapshot
    ): AdjustableControl | null {
        const openDropdown = (): void => {
            this.openAdjustableControl(controlId, adapters);
        };

        const descriptor = this._getControlDescriptor(controlId);
        if (!descriptor) {
            return null;
        }

        return {
            cyclePrev: (): boolean => this._cycleDescriptorOption(controlId, descriptor, session, 'left', adapters),
            cycleNext: (): boolean => this._cycleDescriptorOption(controlId, descriptor, session, 'right', adapters),
            isDisabled: () => this._isDescriptorDisabled(descriptor, session),
            openDropdown,
        };
    }

    private _cycleDescriptorOption(
        controlId: string,
        descriptor: StrategyControlDescriptor,
        session: ChannelSetupSessionSnapshot,
        direction: 'left' | 'right',
        adapters: Pick<
            StrategyStepInteractionAdapters,
            | 'deferDropdownRender'
            | 'getSessionSnapshot'
            | 'hasActiveDropdown'
            | 'renderStep'
            | 'setPreferredFocusId'
            | 'stepPreset'
            | 'updatePriorityRowState'
            | 'updateStrategyState'
        > & {
            channelLimitOptions: number[];
            minItemsOptions: number[];
            schedulePreview: () => void;
        }
    ): boolean {
        if (this._isDescriptorDisabled(descriptor, session)) {
            return false;
        }

        const options = descriptor.options(adapters);
        const current = descriptor.currentValue(session);
        const next = descriptor.cycleMode === 'preset'
            ? adapters.stepPreset(options.map(Number), Number(current), direction, 'clamp')
            : this._stepOption(options, current, direction);
        if (next === current) {
            return false;
        }
        this.applySettingChange(controlId, (draft) => descriptor.applyValue(draft, next), adapters);
        return true;
    }

    private _getControlDescriptor(controlId: string): StrategyControlDescriptor | null {
        return STRATEGY_CONTROL_DESCRIPTORS.find((descriptor) => descriptor.controlId === controlId) ?? null;
    }

    private _isDescriptorDisabled(
        descriptor: StrategyControlDescriptor,
        session: ChannelSetupSessionSnapshot
    ): boolean {
        return descriptor.isDisabled?.(session) ?? false;
    }

    private _categoryFromButtonId(buttonId: string): StrategyCategoryKey | null {
        const match = STRATEGY_CATEGORIES.find((category) => this.categoryButtonId(category) === buttonId);
        return match ?? null;
    }

    private _getDetailControlIdsForCategory(
        category: StrategyCategoryKey,
        session: ChannelSetupSessionSnapshot
    ): string[] {
        if (category === 'content-sources') {
            return CONTENT_STRATEGY_KEYS.flatMap((key) => {
                const ids = [this.strategyButtonId(key)];
                if (this._deps.strategySupportsMixedScope(key)) {
                    ids.push(this.scopeButtonId(key));
                }
                return ids;
            });
        }
        if (category === 'advanced-sources') {
            return ADVANCED_STRATEGY_KEYS.flatMap((key) => {
                const ids = [this.strategyButtonId(key)];
                if (this._deps.strategySupportsMixedScope(key)) {
                    ids.push(this.scopeButtonId(key));
                }
                return ids;
            });
        }
        if (category === 'build-options') {
            return [
                STEP2_CONTROL_IDS.buildMode,
                STEP2_CONTROL_IDS.combineMode,
                STEP2_CONTROL_IDS.addAlternateLineups,
                STEP2_CONTROL_IDS.alternateLineupCopies,
            ];
        }
        if (category === 'series-ordering') {
            return [
                STEP2_CONTROL_IDS.seriesBaseMode,
                STEP2_CONTROL_IDS.seriesBaseBlockSize,
                STEP2_CONTROL_IDS.seriesVariantType,
                STEP2_CONTROL_IDS.seriesVariantBlockSize,
            ];
        }
        if (category === 'priority-order') {
            return session.strategyOrder.map((key) => this.priorityRowId(key));
        }
        return [STEP2_CONTROL_IDS.maxChannels, STEP2_CONTROL_IDS.minItems, STEP2_CONTROL_IDS.expandLineup];
    }

    private _resolveDetailFocusTarget(
        category: StrategyCategoryKey,
        availableIds: string[],
        session: ChannelSetupSessionSnapshot
    ): string | null {
        if (availableIds.length === 0) {
            return null;
        }
        const enabledIds = availableIds.filter((id) => this._isDetailControlEnabled(category, id, session));
        if (enabledIds.length === 0) {
            return null;
        }
        const remembered = this._rememberedDetailFocusByCategory[category];
        if (remembered && enabledIds.includes(remembered)) {
            return remembered;
        }
        return enabledIds[0] ?? null;
    }

    private _isDetailControlEnabled(
        _category: StrategyCategoryKey,
        controlId: string,
        session: ChannelSetupSessionSnapshot
    ): boolean {
        const descriptor = this._getControlDescriptor(controlId);
        if (descriptor) {
            return !this._isDescriptorDisabled(descriptor, session);
        }
        return true;
    }

    private _strategyKeyFromControlId(controlId: string, prefix: string): SetupStrategyKey | null {
        if (!controlId.startsWith(prefix)) {
            return null;
        }
        const raw = controlId.slice(prefix.length).toLowerCase();
        const match = [...CONTENT_STRATEGY_KEYS, ...ADVANCED_STRATEGY_KEYS].find(
            (strategy) => strategy.toLowerCase() === raw
        );
        return match ?? null;
    }

    private _rememberActiveDetailFocus(
        controlId: string,
        session: ChannelSetupSessionSnapshot
    ): void {
        const activeIds = this._getDetailControlIdsForCategory(this._activeStrategyCategory, session);
        if (!activeIds.includes(controlId)) {
            return;
        }
        this._rememberedDetailFocusByCategory[this._activeStrategyCategory] = controlId;
    }

    private _stepOption<T extends string | number>(
        options: readonly T[],
        current: T,
        direction: 'left' | 'right'
    ): T {
        if (options.length === 0) {
            return current;
        }
        const currentIndex = options.indexOf(current);
        let baseIndex = currentIndex;
        if (baseIndex < 0) {
            if (typeof current === 'number' && options.every((option) => typeof option === 'number')) {
                baseIndex = 0;
                let smallestDiff = Math.abs((options[0] as number) - current);
                for (let index = 1; index < options.length; index += 1) {
                    const option = options[index] as number;
                    const diff = Math.abs(option - current);
                    if (diff < smallestDiff) {
                        baseIndex = index;
                        smallestDiff = diff;
                    }
                }
            } else {
                baseIndex = 0;
            }
        }
        const nextIndex = direction === 'left'
            ? Math.max(0, baseIndex - 1)
            : Math.min(options.length - 1, baseIndex + 1);
        return options[nextIndex] ?? current;
    }

    private _capitalize(value: string): string {
        return value.charAt(0).toUpperCase() + value.slice(1);
    }

    private _formatDropdownLabel(value: StrategyControlValue): string {
        return typeof value === 'string' ? this._capitalize(value) : String(value);
    }
}
