import { DEFAULT_CHANNEL_SETUP_MAX, MAX_CHANNELS } from '../../../scheduler/channel-manager/constants';
import { ADVANCED_STRATEGY_KEYS, CONTENT_STRATEGY_KEYS, STEP2_CONTROL_IDS } from './constants';
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

export class StrategyStepController {
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

            const priorityId = deps.priorityButtonId(strategy.key);
            const priorityButton = this._createToggleButton({
                id: priorityId,
                className: 'setup-toggle setup-toggle--adjustable',
                label: `${strategy.label} priority`,
                meta: 'Lower numbers are planned earlier.',
                stateText: String(strategyState.priority),
                onClick: () => {
                    deps.applySettingChange(priorityId, (draft) => {
                        const maxPriority = deps.strategyKeys.length;
                        const next = draft.strategies[strategy.key];
                        next.priority = next.priority >= maxPriority ? 1 : next.priority + 1;
                    });
                },
            });

            if (!deps.strategySupportsMixedScope(strategy.key)) {
                return [toggleButton, priorityButton];
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

            return [toggleButton, priorityButton, scopeButton];
        };

        const contentButtons = strategyLabels
            .filter((strategy) => isContentStrategyKey(strategy.key))
            .flatMap(createStrategyControls);
        const advancedButtons = strategyLabels
            .filter((strategy) => isAdvancedStrategyKey(strategy.key))
            .flatMap(createStrategyControls);

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

        const addSequentialVariantsButton = this._createToggleButton({
            id: STEP2_CONTROL_IDS.addSequentialVariants,
            className: `setup-toggle${state.channelExpansion.addSequentialVariants ? ' selected' : ''}`,
            label: 'Add Sequential Channels',
            meta: 'Also create a sequential version for each generated channel.',
            stateText: state.channelExpansion.addSequentialVariants ? 'On' : 'Off',
            onClick: () => {
                deps.applySettingChange(STEP2_CONTROL_IDS.addSequentialVariants, (draft) => {
                    draft.channelExpansion.addSequentialVariants = !draft.channelExpansion.addSequentialVariants;
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
                addSequentialVariantsButton,
            ],
            'limits': [maxButton, minItemsButton, expandLineupButton],
        };
        const categoryButtons = this._renderCategoryRail(left, deps, state);
        const activeControls = controlsByCategory[state.activeStrategyCategory] ?? [];

        const detailScroll = this._renderDetailPane(activeControls);
        const previewPanel = this._renderPreviewPanel(deps, state);

        right.appendChild(detailScroll);
        right.appendChild(previewPanel);
        split.appendChild(left);
        split.appendChild(right);
        ctx.contentEl.appendChild(split);
        this._renderFooterActions(ctx, deps, state, categoryButtons, activeControls);
    }

    private _renderCategoryRail(
        left: HTMLElement,
        deps: StrategyStepDeps,
        state: StrategyStepDeps['state']
    ): HTMLButtonElement[] {
        const categories: Array<{ key: StrategyCategoryKey; title: string }> = [
            { key: 'content-sources', title: 'Content Sources' },
            { key: 'advanced-sources', title: 'Advanced Sources' },
            { key: 'build-options', title: 'Build Options' },
            { key: 'limits', title: 'Limits' },
        ];

        const categoryButtons = categories.map((category) => {
            const button = document.createElement('button');
            button.id = deps.categoryButtonId(category.key);
            button.className = `setup-category-button${state.activeStrategyCategory === category.key ? ' selected' : ''}`;
            button.textContent = category.title;
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

    private _renderDetailPane(activeControls: HTMLButtonElement[]): HTMLElement {
        const detailScroll = document.createElement('div');
        detailScroll.className = 'setup-detail-scroll setup-focus-safe-scroll';

        const detailControls = document.createElement('div');
        detailControls.className = 'setup-list';
        for (const button of activeControls) {
            detailControls.appendChild(button);
        }
        detailScroll.appendChild(detailControls);
        return detailScroll;
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
