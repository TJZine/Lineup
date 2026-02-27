import { DEFAULT_CHANNEL_SETUP_MAX, MAX_CHANNELS } from '../../../scheduler/channel-manager/constants';
import { ADVANCED_STRATEGY_KEYS, CONTENT_STRATEGY_KEYS, SERIES_BLOCK_PRESETS, STEP2_CONTROL_IDS, STRATEGY_CATEGORIES } from './constants';
import type {
    SetupStrategyKey,
    StepRenderContext,
    StrategyCategoryKey,
    StrategyStepDeps,
} from './types';

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

        button.appendChild(label);
        button.appendChild(meta);
        button.appendChild(state);
        button.addEventListener('click', options.onClick);
        return button;
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

        const buildModeButton = this._createToggleButton({
            id: STEP2_CONTROL_IDS.buildMode,
            className: 'setup-toggle',
            label: 'Build mode',
            meta: 'Replace, append, or merge with your lineup.',
            stateText: state.buildMode.charAt(0).toUpperCase() + state.buildMode.slice(1),
            onClick: () => {
                deps.applySettingChange(STEP2_CONTROL_IDS.buildMode, (draft) => {
                    const modes: Array<typeof draft.buildMode> = ['replace', 'append', 'merge'];
                    const currentIndex = modes.indexOf(draft.buildMode);
                    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % modes.length : 0;
                    draft.buildMode = modes[nextIndex] ?? 'replace';
                });
            },
        });

        const combineButton = this._createToggleButton({
            id: STEP2_CONTROL_IDS.combineMode,
            className: 'setup-toggle',
            label: 'Actor/Studio combine',
            meta: 'Separate movies + TV or combine together.',
            stateText: state.actorStudioCombineMode === 'combined' ? 'Combined' : 'Separate',
            onClick: () => {
                deps.applySettingChange(STEP2_CONTROL_IDS.combineMode, (draft) => {
                    draft.actorStudioCombineMode = draft.actorStudioCombineMode === 'combined' ? 'separate' : 'combined';
                });
            },
        });

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

        const alternateCopiesButton = this._createToggleButton({
            id: STEP2_CONTROL_IDS.alternateLineupCopies,
            className: 'setup-toggle setup-toggle--adjustable',
            disabled: !state.channelExpansion.addAlternateLineups,
            label: 'Alternate Lineup Copies',
            meta: 'How many extra copies per generated channel.',
            stateText: String(state.channelExpansion.alternateLineupCopies),
            onClick: () => {
                if (!state.channelExpansion.addAlternateLineups) {
                    return;
                }
                deps.applySettingChange(STEP2_CONTROL_IDS.alternateLineupCopies, (draft) => {
                    draft.channelExpansion.alternateLineupCopies = deps.stepPreset(
                        [1, 2, 3],
                        draft.channelExpansion.alternateLineupCopies,
                        'right',
                        'wrap'
                    );
                });
            },
        });

        const baseModeOptions: Array<typeof state.seriesOrdering.basePlaybackMode> = ['shuffle', 'sequential', 'block'];
        const variantTypeOptions: Array<typeof state.channelExpansion.variantType> = ['none', 'sequential', 'block'];
        const blockSizeOptions = [...SERIES_BLOCK_PRESETS];

        const baseModeStateText = state.seriesOrdering.basePlaybackMode === 'block'
            ? `Block • ${state.seriesOrdering.baseBlockSize}`
            : state.seriesOrdering.basePlaybackMode.charAt(0).toUpperCase() + state.seriesOrdering.basePlaybackMode.slice(1);

        const baseModeButton = this._createToggleButton({
            id: STEP2_CONTROL_IDS.seriesBaseMode,
            className: `setup-toggle${state.seriesOrdering.basePlaybackMode !== 'shuffle' ? ' selected' : ''}`,
            label: 'Base Series Mode',
            meta: 'Default playback mode for TV-derived channels.',
            stateText: baseModeStateText,
            onClick: () => {
                deps.applySettingChange(STEP2_CONTROL_IDS.seriesBaseMode, (draft) => {
                    const index = baseModeOptions.indexOf(draft.seriesOrdering.basePlaybackMode);
                    const nextIndex = index >= 0 ? (index + 1) % baseModeOptions.length : 0;
                    draft.seriesOrdering.basePlaybackMode = baseModeOptions[nextIndex] ?? 'shuffle';
                });
            },
        });

        const baseBlockSizeButton = this._createToggleButton({
            id: STEP2_CONTROL_IDS.seriesBaseBlockSize,
            className: 'setup-toggle setup-toggle--adjustable',
            disabled: state.seriesOrdering.basePlaybackMode !== 'block',
            label: 'Base Block Size',
            meta: 'Episodes per show before switching in block mode.',
            stateText: String(state.seriesOrdering.baseBlockSize),
            onClick: () => {
                if (state.seriesOrdering.basePlaybackMode !== 'block') {
                    return;
                }
                deps.applySettingChange(STEP2_CONTROL_IDS.seriesBaseBlockSize, (draft) => {
                    draft.seriesOrdering.baseBlockSize = deps.stepPreset(
                        blockSizeOptions,
                        draft.seriesOrdering.baseBlockSize,
                        'right',
                        'wrap'
                    );
                });
            },
        });

        const variantTypeStateText = state.channelExpansion.variantType === 'none'
            ? 'None'
            : state.channelExpansion.variantType === 'sequential'
                ? 'Sequential'
                : `Block • ${state.channelExpansion.variantBlockSize}`;

        const variantTypeButton = this._createToggleButton({
            id: STEP2_CONTROL_IDS.seriesVariantType,
            className: `setup-toggle${state.channelExpansion.variantType !== 'none' ? ' selected' : ''}`,
            label: 'Variant Type',
            meta: 'Optional extra series channel mode.',
            stateText: variantTypeStateText,
            onClick: () => {
                deps.applySettingChange(STEP2_CONTROL_IDS.seriesVariantType, (draft) => {
                    const index = variantTypeOptions.indexOf(draft.channelExpansion.variantType);
                    const nextIndex = index >= 0 ? (index + 1) % variantTypeOptions.length : 0;
                    draft.channelExpansion.variantType = variantTypeOptions[nextIndex] ?? 'none';
                });
            },
        });

        const variantBlockSizeButton = this._createToggleButton({
            id: STEP2_CONTROL_IDS.seriesVariantBlockSize,
            className: 'setup-toggle setup-toggle--adjustable',
            disabled: state.channelExpansion.variantType !== 'block',
            label: 'Variant Block Size',
            meta: 'Block size for generated block variants.',
            stateText: String(state.channelExpansion.variantBlockSize),
            onClick: () => {
                if (state.channelExpansion.variantType !== 'block') {
                    return;
                }
                deps.applySettingChange(STEP2_CONTROL_IDS.seriesVariantBlockSize, (draft) => {
                    draft.channelExpansion.variantBlockSize = deps.stepPreset(
                        blockSizeOptions,
                        draft.channelExpansion.variantBlockSize,
                        'right',
                        'wrap'
                    );
                });
            },
        });

        const maxButton = this._createToggleButton({
            id: STEP2_CONTROL_IDS.maxChannels,
            className: 'setup-toggle setup-toggle--adjustable',
            label: 'Max channels',
            meta: `Default ${DEFAULT_CHANNEL_SETUP_MAX}. Limit up to ${MAX_CHANNELS}.`,
            stateText: String(state.maxChannels),
            onClick: () => {
                deps.applySettingChange(STEP2_CONTROL_IDS.maxChannels, (draft) => {
                    draft.maxChannels = deps.stepPreset(
                        deps.channelLimitOptions,
                        draft.maxChannels,
                        'right',
                        'wrap'
                    );
                });
            },
        });

        const minItemsButton = this._createToggleButton({
            id: STEP2_CONTROL_IDS.minItems,
            className: 'setup-toggle setup-toggle--adjustable',
            label: 'Min items',
            meta: 'Minimum content items per channel.',
            stateText: String(state.minItems),
            onClick: () => {
                deps.applySettingChange(STEP2_CONTROL_IDS.minItems, (draft) => {
                    draft.minItems = deps.stepPreset(
                        deps.minItemsOptions,
                        draft.minItems,
                        'right',
                        'wrap'
                    );
                });
            },
        });

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
            previewStrip.classList.toggle('is-collapsed', !expanded);
            previewToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            previewToggle.textContent = expanded ? 'Hide Details' : 'Show Details';
            previewPanel.hidden = !expanded;
        };

        setExpanded(false);
        previewToggle.addEventListener('click', () => {
            const expanded = previewToggle.getAttribute('aria-expanded') !== 'true';
            setExpanded(expanded);
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

            button.appendChild(rank);
            button.appendChild(label);
            button.appendChild(rowState);
            button.addEventListener('click', () => {
                deps.applySettingChange(rowId, (draft) => {
                    draft.strategies[key].enabled = !draft.strategies[key].enabled;
                });
            });
            return button;
        });
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
            error.textContent = state.previewError;
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
                deps.renderCappedWarnings(warnings, warningList);
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
