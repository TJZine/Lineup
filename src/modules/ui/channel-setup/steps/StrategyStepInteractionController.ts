import type { KeyEvent } from '../../../navigation';
import type { INavigationManager } from '../../../navigation/contracts/interfaces';
import type {
    ChannelSetupSessionSnapshot,
    StrategyStepMutableState,
} from '../ChannelSetupSessionContracts';
import {
    ADVANCED_STRATEGY_KEYS,
    CONTENT_STRATEGY_KEYS,
    DEFAULT_STRATEGY_PRIORITIES,
    SETUP_STRATEGY_KEYS,
    STEP2_CONTROL_IDS,
    STRATEGY_CATEGORIES,
    type SetupStrategyKey,
    type StrategyCategoryKey,
} from '../strategyConstants';
import type { StrategyStepDropdownConfig } from '../stepContracts';
import type { RegisterStep2FocusOptions } from '../focus/types';
import {
    getStrategyControlDescriptor,
    type StrategyControlDescriptor,
    type StrategyControlValue,
} from './StrategyStepControlDescriptors';

const GUIDE_ORDER_RESET_ID = 'setup-guide-order-reset';

type AdjustableControl = {
    isDisabled: () => boolean;
    openDropdown: () => void;
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
    resetStep2Scroll: () => void;
    setPreferredFocusId: (focusId: string | null) => void;
    setPriorityRowGrabbedVisual: (strategy: SetupStrategyKey | null, grabbed: boolean) => void;
    updateStrategyState: (mutate: (draft: StrategyStepMutableState) => void) => void;
};

export class StrategyStepInteractionController {
    private _activeStrategyCategory: StrategyCategoryKey = 'content-sources';
    private _rememberedDetailFocusByCategory: Partial<Record<StrategyCategoryKey, string>> = {};
    private _lastReorder: { key: SetupStrategyKey; dir: 'up' | 'down' } | null = null;
    private _grabbedPriorityKey: SetupStrategyKey | null = null;
    private _grabbedOriginalStrategyOrder: SetupStrategyKey[] | null = null;

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
        this._grabbedOriginalStrategyOrder = null;
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
        return `setup-strategy-${this._strategyDomId(strategy)}`;
    }

    priorityRowId(strategy: SetupStrategyKey): string {
        return `setup-priority-row-${this._strategyDomId(strategy)}`;
    }

    scopeButtonId(strategy: SetupStrategyKey): string {
        return `setup-scope-${this._strategyDomId(strategy)}`;
    }

    applyCategoryChange(
        category: StrategyCategoryKey,
        focusId: string,
        adapters: Pick<
            StrategyStepInteractionAdapters,
            'renderStep' | 'resetStep2Scroll' | 'setPreferredFocusId' | 'setPriorityRowGrabbedVisual'
        >
    ): void {
        if (category !== 'priority-order') {
            this._clearGrabbedPriority(adapters.setPriorityRowGrabbedVisual);
        }
        this._activeStrategyCategory = category;
        adapters.setPreferredFocusId(focusId);
        adapters.resetStep2Scroll();
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
            | 'updateStrategyState'
        >
    ): void {
        adapters.setPreferredFocusId(focusId);
        this._rememberActiveDetailFocus(focusId, adapters.getSessionSnapshot());
        adapters.updateStrategyState((draft: StrategyStepMutableState) => {
            mutate(draft);
        });
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
            | 'updateStrategyState'
        > & {
            channelLimitOptions: number[];
            minItemsOptions: number[];
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
                return;
            }
        }

        if (this._activeStrategyCategory === 'priority-order' && this._grabbedPriorityKey !== null) {
            event.handled = true;
            event.originalEvent.preventDefault();

            if (event.button === 'ok') {
                const strategy = this._grabbedPriorityKey;
                const focusId = this.priorityRowId(strategy);
                adapters.setPriorityRowGrabbedVisual(strategy, false);
                this._grabbedPriorityKey = null;
                this._grabbedOriginalStrategyOrder = null;
                adapters.setPreferredFocusId(focusId);
                this._rememberedDetailFocusByCategory['priority-order'] = focusId;
                adapters.renderStep();
                return;
            }

            if (event.button === 'back') {
                const strategy = this._grabbedPriorityKey;
                const originalOrder = this._grabbedOriginalStrategyOrder;
                adapters.updateStrategyState((draft) => {
                    if (originalOrder) {
                        draft.strategyOrder = [...originalOrder];
                    }
                });
                this._grabbedPriorityKey = null;
                this._grabbedOriginalStrategyOrder = null;
                this._lastReorder = null;
                adapters.setPreferredFocusId(this.priorityRowId(strategy));
                this._rememberedDetailFocusByCategory['priority-order'] = this.priorityRowId(strategy);
                adapters.renderStep();
                adapters.setPriorityRowGrabbedVisual(strategy, false);
                return;
            }

            if (event.button === 'left' || event.button === 'right') {
                return;
            }

            if (event.button !== 'up' && event.button !== 'down') {
                return;
            }

            if (event.isRepeat || event.isLongPress) {
                return;
            }

            const strategy = this._grabbedPriorityKey;
            const activeOrder = this._getActiveStrategyOrder(session);
            const currentIndex = activeOrder.indexOf(strategy);
            if (currentIndex < 0) {
                return;
            }

            const targetIndex = event.button === 'up' ? currentIndex - 1 : currentIndex + 1;
            if (targetIndex < 0 || targetIndex >= activeOrder.length) {
                return;
            }

            const targetKey = activeOrder[targetIndex];
            if (!targetKey) {
                return;
            }

            adapters.updateStrategyState((draft) => {
                const nextActiveOrder = [...activeOrder];
                nextActiveOrder[currentIndex] = targetKey;
                nextActiveOrder[targetIndex] = strategy;
                draft.strategyOrder = this._mergeActiveOrder(draft.strategyOrder, draft.strategies, nextActiveOrder);
            });
            this._lastReorder = { key: strategy, dir: event.button === 'up' ? 'up' : 'down' };
            const focusId = this.priorityRowId(strategy);
            adapters.setPreferredFocusId(focusId);
            this._rememberedDetailFocusByCategory['priority-order'] = focusId;
            adapters.renderStep();
            this._lastReorder = null;
            adapters.setPriorityRowGrabbedVisual(strategy, true);
            return;
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
            const activeOrder = this._getActiveStrategyOrder(session);
            if (!activeOrder.includes(strategy) || activeOrder.length < 2) {
                return;
            }

            this._grabbedPriorityKey = strategy;
            this._grabbedOriginalStrategyOrder = [...session.strategyOrder];
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
                adapters.setPreferredFocusId(this.categoryButtonId(focusedCategory));
                adapters.resetStep2Scroll();
                adapters.renderStep();
                event.handled = true;
                event.originalEvent.preventDefault();
                return;
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

    resetGuideOrder(
        _focusId: string,
        adapters: Pick<
            StrategyStepInteractionAdapters,
            'getSessionSnapshot' | 'renderStep' | 'setPreferredFocusId' | 'updateStrategyState'
        >
    ): void {
        const session = adapters.getSessionSnapshot();
        const activeOrder = this._getActiveStrategyOrder(session);
        if (activeOrder.length < 2 || !this._canResetActiveOrder(activeOrder)) {
            return;
        }
        const defaultActiveOrder = this._sortByDefaultPriority(activeOrder);
        const preferredStrategy = defaultActiveOrder[0];
        if (!preferredStrategy) {
            return;
        }
        adapters.setPreferredFocusId(this.priorityRowId(preferredStrategy));
        adapters.updateStrategyState((draft) => {
            draft.strategyOrder = this._mergeActiveOrder(draft.strategyOrder, draft.strategies, defaultActiveOrder);
        });
        adapters.renderStep();
    }

    registerStep2Focusables(
        categoryButtons: HTMLButtonElement[],
        detailButtons: HTMLButtonElement[],
        backButton: HTMLButtonElement,
        nextButton: HTMLButtonElement,
        adapters: Pick<
            StrategyStepInteractionAdapters,
            'getPreferredFocusId' | 'getSessionSnapshot' | 'registerStep2' | 'setPreferredFocusId'
        >,
        options: {
            onFocus?: (id: string) => void;
            onDetailFocus?: (id: string) => void;
        } = {}
    ): void {
        const activeCategoryButtonId = this.categoryButtonId(this._activeStrategyCategory);
        const detailIds = detailButtons.filter((button) => !button.disabled).map((button) => button.id);
        const detailFocusTarget = this._resolveDetailFocusTarget(
            this._activeStrategyCategory,
            detailIds,
            adapters.getSessionSnapshot()
        );
        const registerOptions: RegisterStep2FocusOptions = {
            categoryButtons,
            detailButtons,
            footerButtons: [backButton, nextButton],
            activeCategoryId: activeCategoryButtonId,
            detailFocusTarget,
            preferredFocusId: adapters.getPreferredFocusId(),
            onDetailFocus: (id) => {
                this._rememberActiveDetailFocus(id, adapters.getSessionSnapshot());
                options.onDetailFocus?.(id);
            },
        };
        if (options.onFocus) {
            registerOptions.onFocus = options.onFocus;
        }
        const preferredApplied = adapters.registerStep2(registerOptions);
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
        this._grabbedOriginalStrategyOrder = null;
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
            | 'updateStrategyState'
        > & {
            channelLimitOptions: number[];
            minItemsOptions: number[];
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
            | 'updateStrategyState'
        > & {
            channelLimitOptions: number[];
            minItemsOptions: number[];
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
            isDisabled: () => this._isDescriptorDisabled(descriptor, session),
            openDropdown,
        };
    }

    private _getControlDescriptor(controlId: string): StrategyControlDescriptor | null {
        return getStrategyControlDescriptor(controlId);
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
            return [
                GUIDE_ORDER_RESET_ID,
                ...this._getActiveStrategyOrder(session).map((key) => this.priorityRowId(key)),
            ];
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
        if (category === 'priority-order' && enabledIds.includes(GUIDE_ORDER_RESET_ID)) {
            return GUIDE_ORDER_RESET_ID;
        }
        const remembered = this._rememberedDetailFocusByCategory[category];
        if (remembered && enabledIds.includes(remembered)) {
            return remembered;
        }
        return enabledIds[0] ?? null;
    }

    private _isDetailControlEnabled(
        category: StrategyCategoryKey,
        controlId: string,
        session: ChannelSetupSessionSnapshot
    ): boolean {
        if (category === 'priority-order') {
            const activeOrder = this._getActiveStrategyOrder(session);
            if (controlId === GUIDE_ORDER_RESET_ID) {
                return this._canResetActiveOrder(activeOrder);
            }
            if (controlId.startsWith('setup-priority-row-')) {
                const strategy = this._strategyKeyFromControlId(controlId, 'setup-priority-row-');
                return strategy !== null && activeOrder.length >= 2 && activeOrder.includes(strategy);
            }
        }

        const descriptor = this._getControlDescriptor(controlId);
        if (descriptor) {
            return !this._isDescriptorDisabled(descriptor, session);
        }
        return true;
    }

    private _getActiveStrategyOrder(session: Pick<ChannelSetupSessionSnapshot, 'strategies' | 'strategyOrder'>): SetupStrategyKey[] {
        return session.strategyOrder.filter((key) => session.strategies[key]?.enabled);
    }

    private _mergeActiveOrder(
        fullOrder: SetupStrategyKey[],
        strategies: ChannelSetupSessionSnapshot['strategies'],
        activeOrder: SetupStrategyKey[]
    ): SetupStrategyKey[] {
        const remainingActive = [...activeOrder];
        return fullOrder.map((key) => {
            if (!strategies[key]?.enabled) {
                return key;
            }
            return remainingActive.shift() ?? key;
        });
    }

    private _canResetActiveOrder(activeOrder: SetupStrategyKey[]): boolean {
        const defaultOrder = this._sortByDefaultPriority(activeOrder);
        return activeOrder.some((key, index) => key !== defaultOrder[index]);
    }

    private _sortByDefaultPriority(keys: SetupStrategyKey[]): SetupStrategyKey[] {
        return [...keys].sort((a, b) => {
            const diff = DEFAULT_STRATEGY_PRIORITIES[a] - DEFAULT_STRATEGY_PRIORITIES[b];
            if (diff !== 0) return diff;
            return a < b ? -1 : a > b ? 1 : 0;
        });
    }

    private _strategyKeyFromControlId(controlId: string, prefix: string): SetupStrategyKey | null {
        if (!controlId.startsWith(prefix)) return null;
        const suffix = controlId.slice(prefix.length);
        return SETUP_STRATEGY_KEYS.find((strategy) => this._strategyDomId(strategy) === suffix) ?? null;
    }

    private _strategyDomId(strategy: SetupStrategyKey): string {
        return this._deps.toDomId(String(strategy));
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

    private _capitalize(value: string): string {
        return value.charAt(0).toUpperCase() + value.slice(1);
    }

    private _formatDropdownLabel(value: StrategyControlValue): string {
        return typeof value === 'string' ? this._capitalize(value) : String(value);
    }
}
