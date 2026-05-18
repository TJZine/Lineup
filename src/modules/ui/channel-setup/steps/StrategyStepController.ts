import { MAX_CHANNELS } from '../../../scheduler/channel-manager/constants';
import {
    formatChannelSetupUserCopy,
    formatChannelSetupWarningCopy,
} from '../ChannelSetupUserCopy';
import {
    ADVANCED_STRATEGY_KEYS,
    CONTENT_STRATEGY_KEYS,
    STEP2_CONTROL_IDS,
    STRATEGY_CATEGORIES,
} from './constants';
import type {
    SetupStrategyKey,
    StepRenderContext,
    StrategyCategoryKey,
    StrategyStepDeps,
} from './types';
import {
    getStrategyControlDescriptor,
    type StrategyControlDescriptor,
} from './StrategyStepControlDescriptors';

const CONTENT_STRATEGY_KEY_SET = new Set<SetupStrategyKey>(CONTENT_STRATEGY_KEYS);
const ADVANCED_STRATEGY_KEY_SET = new Set<SetupStrategyKey>(ADVANCED_STRATEGY_KEYS);

const isContentStrategyKey = (key: SetupStrategyKey): key is (typeof CONTENT_STRATEGY_KEYS)[number] =>
    CONTENT_STRATEGY_KEY_SET.has(key);

const isAdvancedStrategyKey = (key: SetupStrategyKey): key is (typeof ADVANCED_STRATEGY_KEYS)[number] =>
    ADVANCED_STRATEGY_KEY_SET.has(key);

const STRATEGY_META = {
    collections: { label: 'Collections', detail: 'One channel per collection.' },
    playlists: { label: 'Playlists', detail: 'Channels from Plex playlists.' },
    recentlyAdded: { label: 'Recently added', detail: 'Per library, newest first.' },
    genres: { label: 'Genres', detail: 'Filter channels by genre (slower on large libraries).' },
    directors: { label: 'Directors', detail: 'Filter channels by director (slower on large libraries).' },
    decades: { label: 'Decades', detail: 'Channels by decade (1980s, 1990s...).' },
    studios: { label: 'Studios', detail: 'Channels by studio (Movies/TV).' },
    actors: { label: 'Actors', detail: 'Channels by actor (Movies/TV).' },
} satisfies Record<SetupStrategyKey, { label: string; detail: string }>;

const ORDERED_PREVIEW_STRATEGY_KEYS: Array<keyof typeof STRATEGY_META> = [
    'collections',
    'recentlyAdded',
    'playlists',
    'genres',
    'directors',
    'decades',
    'studios',
    'actors',
];

const CATEGORY_TITLES: Record<StrategyCategoryKey, string> = {
    'content-sources': 'Content Sources',
    'advanced-sources': 'Advanced Sources',
    'build-options': 'Build Options',
    'series-ordering': 'Series Ordering',
    limits: 'Limits',
    'priority-order': 'Priority Order',
};

export class StrategyStepController {
    private _previewExpanded = false;

    private _categoryHasActiveStrategies(
        category: StrategyCategoryKey,
        state: StrategyStepDeps['state']
    ): boolean {
        if (category === 'content-sources') {
            return CONTENT_STRATEGY_KEYS.some((key) => state.strategies[key].enabled);
        }
        if (category === 'advanced-sources') {
            return ADVANCED_STRATEGY_KEYS.some((key) => state.strategies[key].enabled);
        }
        return false;
    }

    private _createToggleButton(options: {
        id: string;
        className: string;
        label: string;
        meta: string;
        stateText: string;
        onClick: () => void;
        disabled?: boolean;
        showChevron?: boolean;
    }): HTMLButtonElement {
        const button = document.createElement('button');
        button.id = options.id;
        button.type = 'button';
        button.className = options.className;
        button.disabled = options.disabled ?? false;

        const label = document.createElement('span');
        label.className = 'setup-toggle-label';
        label.textContent = options.label;

        const meta = document.createElement('span');
        meta.className = 'setup-toggle-meta';
        meta.textContent = options.meta;

        const state = document.createElement('span');
        state.className = 'setup-toggle-state';
        state.textContent = options.stateText;

        if (options.showChevron) {
            const chevron = document.createElement('span');
            chevron.className = 'setup-toggle-chevron';
            chevron.textContent = '▾';
            chevron.setAttribute('aria-hidden', 'true');
            state.appendChild(chevron);
        }

        button.appendChild(label);
        button.appendChild(meta);
        button.appendChild(state);
        button.addEventListener('click', options.onClick);
        return button;
    }

    private _createAdjustableToggle(options: {
        id: string;
        label: string;
        meta: string;
        stateText: string;
        deps: Pick<StrategyStepDeps, 'openAdjustableControl'>;
        selected?: boolean;
        disabled?: boolean;
        canOpen?: () => boolean;
    }): HTMLButtonElement {
        return this._createToggleButton({
            id: options.id,
            className: `setup-toggle setup-toggle--adjustable${options.selected ? ' selected' : ''}`,
            label: options.label,
            meta: options.meta,
            stateText: options.stateText,
            showChevron: true,
            ...(options.disabled !== undefined ? { disabled: options.disabled } : {}),
            onClick: () => {
                if (options.canOpen && !options.canOpen()) {
                    return;
                }
                options.deps.openAdjustableControl(options.id);
            },
        });
    }

    private _createAdjustableToggleFromDescriptor(
        descriptor: StrategyControlDescriptor,
        state: StrategyStepDeps['state'],
        deps: Pick<StrategyStepDeps, 'openAdjustableControl'>
    ): HTMLButtonElement {
        return this._createAdjustableToggle({
            id: descriptor.controlId,
            label: descriptor.label,
            meta: descriptor.meta,
            stateText: descriptor.stateText(state),
            deps,
            selected: descriptor.isSelected?.(state) ?? false,
            disabled: descriptor.isDisabled?.(state) ?? false,
            canOpen: () => !(descriptor.isDisabled?.(state) ?? false),
        });
    }

    private _requireControlDescriptor(controlId: string): StrategyControlDescriptor {
        const descriptor = getStrategyControlDescriptor(controlId);
        if (!descriptor) {
            throw new Error(`Missing channel setup strategy control descriptor for ${controlId}`);
        }
        return descriptor;
    }

    render(ctx: StepRenderContext, deps: StrategyStepDeps): void {
        const state = deps.state;
        ctx.stepEl.textContent = 'Step 2 of 3';
        ctx.statusEl.textContent = 'Choose channel types to build.';

        const split = document.createElement('div');
        split.className = 'setup-split';

        const left = document.createElement('div');
        left.className = 'setup-category-rail setup-focus-safe-scroll';

        const right = document.createElement('div');
        right.className = 'setup-detail-pane';

        const buildModeButton = this._createAdjustableToggleFromDescriptor(
            this._requireControlDescriptor(STEP2_CONTROL_IDS.buildMode),
            state,
            deps
        );
        const combineButton = this._createAdjustableToggleFromDescriptor(
            this._requireControlDescriptor(STEP2_CONTROL_IDS.combineMode),
            state,
            deps
        );

        const strategyLabels: Array<{ key: SetupStrategyKey; label: string; detail: string }> = deps.strategyKeys.map((key) => ({
            key,
            ...STRATEGY_META[key],
        }));

        const createStrategyControls = (strategy: typeof strategyLabels[number]): HTMLButtonElement[] => {
            const strategyState = state.strategies[strategy.key];

            const toggleId = deps.strategyButtonId(strategy.key);
            const toggleButton = this._createToggleButton({
                id: toggleId,
                className: `setup-toggle${strategyState.enabled ? ' selected' : ''}`,
                label: strategy.label,
                meta: strategy.detail,
                stateText: strategyState.enabled ? 'On' : 'Off',
                onClick: () => {
                    deps.applySettingChange(toggleId, (draft) => {
                        draft.strategies[strategy.key].enabled = !draft.strategies[strategy.key].enabled;
                    });
                },
            });

            if (!deps.strategySupportsMixedScope(strategy.key)) {
                return [toggleButton];
            }

            const scopeId = deps.scopeButtonId(strategy.key);
            const scopeButton = this._createToggleButton({
                id: scopeId,
                className: `setup-toggle${strategyState.scope === 'cross-library' ? ' selected' : ''}`,
                label: `${strategy.label} scope`,
                meta: 'Per-library by default. Mixed is experimental.',
                stateText: strategyState.scope === 'cross-library' ? 'Mixed' : 'Per Library',
                onClick: () => {
                    deps.applySettingChange(scopeId, (draft) => {
                        const next = draft.strategies[strategy.key];
                        next.scope = next.scope === 'cross-library' ? 'per-library' : 'cross-library';
                    });
                },
            });

            return [toggleButton, scopeButton];
        };

        const contentButtons = strategyLabels
            .filter((strategy) => isContentStrategyKey(strategy.key))
            .flatMap(createStrategyControls);
        const advancedButtons = strategyLabels
            .filter((strategy) => isAdvancedStrategyKey(strategy.key))
            .flatMap(createStrategyControls);
        const priorityRowButtons = this._renderPriorityReorderList(deps, state, strategyLabels);

        const addAlternateLineupsButton = this._createToggleButton({
            id: STEP2_CONTROL_IDS.addAlternateLineups,
            className: `setup-toggle${state.channelExpansion.addAlternateLineups ? ' selected' : ''}`,
            label: 'Add Alternate Lineups',
            meta: 'Create extra channels from the same category with different deterministic shuffle lineups.',
            stateText: state.channelExpansion.addAlternateLineups ? 'On' : 'Off',
            onClick: () => {
                deps.applySettingChange(STEP2_CONTROL_IDS.addAlternateLineups, (draft) => {
                    draft.channelExpansion.addAlternateLineups = !draft.channelExpansion.addAlternateLineups;
                });
            },
        });

        const alternateCopiesButton = this._createAdjustableToggleFromDescriptor(
            this._requireControlDescriptor(STEP2_CONTROL_IDS.alternateLineupCopies),
            state,
            deps
        );
        const baseModeButton = this._createAdjustableToggleFromDescriptor(
            this._requireControlDescriptor(STEP2_CONTROL_IDS.seriesBaseMode),
            state,
            deps
        );
        const baseBlockSizeButton = this._createAdjustableToggleFromDescriptor(
            this._requireControlDescriptor(STEP2_CONTROL_IDS.seriesBaseBlockSize),
            state,
            deps
        );
        const variantTypeButton = this._createAdjustableToggleFromDescriptor(
            this._requireControlDescriptor(STEP2_CONTROL_IDS.seriesVariantType),
            state,
            deps
        );
        const variantBlockSizeButton = this._createAdjustableToggleFromDescriptor(
            this._requireControlDescriptor(STEP2_CONTROL_IDS.seriesVariantBlockSize),
            state,
            deps
        );
        const maxButton = this._createAdjustableToggleFromDescriptor(
            this._requireControlDescriptor(STEP2_CONTROL_IDS.maxChannels),
            state,
            deps
        );
        const minItemsButton = this._createAdjustableToggleFromDescriptor(
            this._requireControlDescriptor(STEP2_CONTROL_IDS.minItems),
            state,
            deps
        );

        const expandLineupButton = this._createToggleButton({
            id: STEP2_CONTROL_IDS.expandLineup,
            className: 'setup-toggle',
            label: 'Expand Lineup',
            meta: 'Quick action: set max channels to the cap and min items to 1.',
            stateText: 'Apply',
            onClick: () => {
                deps.applySettingChange(STEP2_CONTROL_IDS.expandLineup, (draft) => {
                    draft.maxChannels = MAX_CHANNELS;
                    draft.minItems = 1;
                });
            },
        });

        const controlsByCategory: Record<StrategyCategoryKey, HTMLButtonElement[]> = {
            'content-sources': contentButtons,
            'advanced-sources': advancedButtons,
            'build-options': [
                buildModeButton,
                combineButton,
                addAlternateLineupsButton,
                alternateCopiesButton,
            ],
            'series-ordering': [baseModeButton, baseBlockSizeButton, variantTypeButton, variantBlockSizeButton],
            'limits': [maxButton, minItemsButton, expandLineupButton],
            'priority-order': priorityRowButtons,
        };
        const categoryButtons = this._renderCategoryRail(left, deps, state);
        const activeControls = controlsByCategory[state.activeStrategyCategory] ?? [];
        const activeCategoryTitle = CATEGORY_TITLES[state.activeStrategyCategory];

        const detailScroll = this._renderDetailPane(activeControls, activeCategoryTitle);
        const previewPanel = this._renderPreviewPanel(deps, state);

        right.appendChild(detailScroll);
        split.appendChild(left);
        split.appendChild(right);
        ctx.contentEl.appendChild(split);

        const previewStrip = document.createElement('section');
        previewStrip.className = 'setup-preview-strip is-collapsed';
        previewStrip.setAttribute('aria-label', 'Estimate summary');

        const previewSummary = document.createElement('div');
        previewSummary.className = 'setup-preview-strip-summary';

        const previewSummaryText = document.createElement('span');
        previewSummaryText.className = 'setup-preview-strip-summary-text';
        const totalEstimate = state.preview?.estimates.total;
        previewSummaryText.textContent = Number.isFinite(totalEstimate)
            ? `Est. ${totalEstimate} channels`
            : 'Estimate pending';

        const previewToggle = document.createElement('button');
        previewToggle.id = 'setup-preview-toggle';
        previewToggle.type = 'button';
        previewToggle.className = 'screen-button secondary setup-preview-strip-toggle';
        previewToggle.setAttribute('aria-controls', state.previewPanelId);

        const setExpanded = (expanded: boolean): void => {
            this._previewExpanded = expanded;
            previewStrip.classList.toggle('is-collapsed', !expanded);
            previewToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            previewToggle.textContent = expanded ? 'Hide Details' : 'Show Details';
            previewPanel.hidden = !expanded;
        };

        setExpanded(this._previewExpanded);
        previewToggle.addEventListener('click', () => {
            setExpanded(!this._previewExpanded);
        });

        previewSummary.appendChild(previewSummaryText);
        previewSummary.appendChild(previewToggle);
        previewStrip.appendChild(previewSummary);
        previewStrip.appendChild(previewPanel);
        ctx.contentEl.appendChild(previewStrip);

        const detailFocusables = [...activeControls, previewToggle];
        this._renderFooterActions(ctx, deps, state, categoryButtons, detailFocusables);
    }

    private _renderCategoryRail(
        left: HTMLElement,
        deps: StrategyStepDeps,
        state: StrategyStepDeps['state']
    ): HTMLButtonElement[] {
        const categories: Array<{ key: StrategyCategoryKey; title: string }> = STRATEGY_CATEGORIES.map((key) => ({
            key,
            title: CATEGORY_TITLES[key],
        }));

        const categoryButtons = categories.map((category) => {
            const button = document.createElement('button');
            button.id = deps.categoryButtonId(category.key);
            button.className = `setup-category-button${state.activeStrategyCategory === category.key ? ' selected' : ''}`;

            const label = document.createElement('span');
            label.className = 'setup-category-label';
            label.textContent = category.title;
            button.appendChild(label);

            if (this._categoryHasActiveStrategies(category.key, state)) {
                const dot = document.createElement('span');
                dot.className = 'setup-category-dot';
                dot.setAttribute('aria-hidden', 'true');
                button.appendChild(dot);
            }

            button.addEventListener('click', () => {
                deps.applyCategoryChange(category.key, button.id);
            });
            return button;
        });

        for (const button of categoryButtons) {
            left.appendChild(button);
        }

        return categoryButtons;
    }

    private _renderDetailPane(activeControls: HTMLButtonElement[], activeCategoryTitle: string): HTMLElement {
        const detailScroll = document.createElement('div');
        detailScroll.className = 'setup-detail-scroll setup-focus-safe-scroll';
        const header = document.createElement('div');
        header.className = 'setup-detail-header';
        header.textContent = activeCategoryTitle;
        detailScroll.appendChild(header);

        const detailControls = document.createElement('div');
        detailControls.className = 'setup-list';
        for (const button of activeControls) {
            detailControls.appendChild(button);
        }
        detailScroll.appendChild(detailControls);
        return detailScroll;
    }

    private _renderPriorityReorderList(
        deps: StrategyStepDeps,
        state: StrategyStepDeps['state'],
        strategyLabels: Array<{ key: SetupStrategyKey; label: string; detail: string }>
    ): HTMLButtonElement[] {
        return state.strategyOrder.map((key, index) => {
            const strategy = strategyLabels.find((item) => item.key === key);
            const strategyState = state.strategies[key];
            const rowId = deps.priorityRowId(key);
            const button = document.createElement('button');
            button.id = rowId;
            button.className = 'setup-toggle setup-priority-row';
            button.classList.toggle('selected', strategyState.enabled);
            const labelText = strategy?.label ?? String(key);
            const stateText = strategyState.enabled ? 'On' : 'Off';
            button.setAttribute('aria-label', `Priority ${index + 1}: ${labelText}, ${stateText}`);
            button.setAttribute('aria-pressed', strategyState.enabled ? 'true' : 'false');
            if (deps.lastReorder?.key === key && deps.lastReorder.dir === 'up') {
                button.classList.add('setup-priority-row--move-up');
            } else if (deps.lastReorder?.key === key && deps.lastReorder.dir === 'down') {
                button.classList.add('setup-priority-row--move-down');
            }

            const rank = document.createElement('span');
            rank.className = 'setup-priority-rank';
            rank.textContent = String(index + 1);
            rank.setAttribute('aria-hidden', 'true');

            const label = document.createElement('span');
            label.className = 'setup-priority-label';
            label.textContent = labelText;
            label.setAttribute('aria-hidden', 'true');

            const rowState = document.createElement('span');
            rowState.className = 'setup-priority-state';
            rowState.textContent = stateText;
            rowState.setAttribute('aria-hidden', 'true');

            const grip = document.createElement('span');
            grip.className = 'setup-priority-grip';
            grip.textContent = '⠿';
            grip.setAttribute('aria-hidden', 'true');

            const arrows = document.createElement('span');
            arrows.className = 'setup-priority-arrows';
            const arrowUp = document.createElement('span');
            arrowUp.className = 'setup-priority-arrow-up';
            arrowUp.textContent = '▲';
            if (index === 0) arrowUp.classList.add('setup-priority-arrow--hidden');
            const arrowDown = document.createElement('span');
            arrowDown.className = 'setup-priority-arrow-down';
            arrowDown.textContent = '▼';
            if (index === state.strategyOrder.length - 1) arrowDown.classList.add('setup-priority-arrow--hidden');
            arrows.appendChild(arrowUp);
            arrows.appendChild(arrowDown);
            arrows.setAttribute('aria-hidden', 'true');

            button.appendChild(rank);
            button.appendChild(label);
            button.appendChild(rowState);
            button.appendChild(grip);
            button.appendChild(arrows);
            button.addEventListener('click', () => {
                deps.applySettingChange(rowId, (draft) => {
                    draft.strategies[key].enabled = !draft.strategies[key].enabled;
                });
            });
            return button;
        });
    }

    updatePriorityRowState(
        container: HTMLElement,
        rowId: string,
        enabled: boolean
    ): HTMLButtonElement | null {
        const row = container.querySelector(`#${rowId}`) as HTMLButtonElement | null;
        if (!row) return null;

        row.classList.toggle('selected', enabled);
        row.setAttribute('aria-pressed', enabled ? 'true' : 'false');

        const stateEl = row.querySelector('.setup-priority-state') as HTMLElement | null;
        if (stateEl) {
            stateEl.textContent = enabled ? 'On' : 'Off';
        }

        const rankText = row.querySelector('.setup-priority-rank')?.textContent?.trim();
        const labelText = row.querySelector('.setup-priority-label')?.textContent?.trim();
        if (rankText && labelText) {
            const stateText = enabled ? 'On' : 'Off';
            row.setAttribute('aria-label', `Priority ${rankText}: ${labelText}, ${stateText}`);
        }
        return row;
    }

    private _renderPreviewPanel(deps: StrategyStepDeps, state: StrategyStepDeps['state']): HTMLElement {
        const previewPanel = document.createElement('div');
        previewPanel.id = state.previewPanelId;
        previewPanel.className = 'setup-preview';
        previewPanel.setAttribute('role', 'region');

        const previewTitleId = `${state.previewPanelId}-title`;
        previewPanel.setAttribute('aria-labelledby', previewTitleId);

        const previewTitle = document.createElement('div');
        previewTitle.id = previewTitleId;
        previewTitle.className = 'setup-preview-title';
        previewTitle.textContent = 'Estimate';
        previewPanel.appendChild(previewTitle);

        if (state.previewError) {
            const error = document.createElement('div');
            error.className = 'setup-preview-warning';
            if (state.previewStatus === 'blocked') {
                error.textContent = formatChannelSetupUserCopy(state.previewError, 'estimate');
            } else if (state.previewStatus === 'slow') {
                error.textContent = `Preview timed out: ${formatChannelSetupUserCopy(state.previewError, 'estimate')}`;
            } else {
                error.textContent = formatChannelSetupUserCopy(state.previewError, 'estimate');
            }
            previewPanel.appendChild(error);
            return previewPanel;
        }

        if (state.preview) {
            const { estimates, warnings, reachedMaxChannels } = state.preview;

            const rows = document.createElement('div');
            rows.className = 'setup-preview-rows';
            rows.appendChild(deps.buildPreviewRow('Total planned', estimates.total, 'total'));
            for (const key of ORDERED_PREVIEW_STRATEGY_KEYS) {
                rows.appendChild(deps.buildPreviewRow(STRATEGY_META[key].label, estimates[key], key));
            }
            previewPanel.appendChild(rows);

            if (state.isPreviewLoading) {
                const updating = document.createElement('div');
                updating.className = 'setup-preview-updating';
                updating.classList.add('panel-spinner');
                updating.textContent = 'Updating...';
                previewPanel.appendChild(updating);
            }

            if (reachedMaxChannels) {
                const cap = document.createElement('div');
                cap.className = 'setup-preview-warning';
                cap.textContent = 'Reached max channel limit; extra channels will be skipped.';
                previewPanel.appendChild(cap);
            }

            if (warnings.length > 0) {
                const warningList = document.createElement('div');
                warningList.className = 'setup-preview-warnings';
                deps.renderCappedWarnings(warnings.map(formatChannelSetupWarningCopy), warningList);
                previewPanel.appendChild(warningList);
            }

            return previewPanel;
        }

        if (state.isPreviewLoading) {
            const loading = document.createElement('div');
            loading.className = 'setup-preview-loading';
            loading.classList.add('panel-spinner');
            loading.textContent = 'Estimating channels...';
            previewPanel.appendChild(loading);
            return previewPanel;
        }

        const empty = document.createElement('div');
        empty.className = 'setup-preview-empty';
        empty.textContent = 'Estimates will appear after a short pause.';
        previewPanel.appendChild(empty);
        return previewPanel;
    }

    private _renderFooterActions(
        ctx: StepRenderContext,
        deps: StrategyStepDeps,
        state: StrategyStepDeps['state'],
        categoryButtons: HTMLButtonElement[],
        activeControls: HTMLButtonElement[]
    ): void {
        const actions = document.createElement('div');
        actions.className = 'button-row';

        const backButton = document.createElement('button');
        backButton.id = 'setup-back';
        backButton.className = 'screen-button secondary';
        backButton.textContent = 'Back';
        backButton.addEventListener('click', () => {
            deps.onBack();
        });
        actions.appendChild(backButton);

        const nextButton = document.createElement('button');
        nextButton.id = 'setup-next';
        nextButton.className = 'screen-button';
        nextButton.textContent = state.setupContext === 'first-time' ? 'Build Channels' : 'Review';
        nextButton.addEventListener('click', () => {
            deps.onNext();
        });
        actions.appendChild(nextButton);

        ctx.contentEl.appendChild(actions);
        deps.registerStep2Focusables(categoryButtons, activeControls, backButton, nextButton);

        ctx.detailEl.textContent = deps.detailText;
        deps.schedulePreview();
    }
}
