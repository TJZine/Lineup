import { DEFAULT_CHANNEL_SETUP_MAX, MAX_CHANNELS } from '../../../scheduler/channel-manager/constants';
import { ADVANCED_STRATEGY_KEYS, CONTENT_STRATEGY_KEYS, STEP2_CONTROL_IDS } from './constants';
import type {
    SetupStrategyKey,
    StepRenderContext,
    StrategyCategoryKey,
    StrategyStepDeps,
    StrategyStepMutableState,
} from './types';

const CONTENT_STRATEGY_KEY_SET = new Set<SetupStrategyKey>(CONTENT_STRATEGY_KEYS);
const ADVANCED_STRATEGY_KEY_SET = new Set<SetupStrategyKey>(ADVANCED_STRATEGY_KEYS);

const isContentStrategyKey = (key: SetupStrategyKey): key is (typeof CONTENT_STRATEGY_KEYS)[number] =>
    CONTENT_STRATEGY_KEY_SET.has(key);

const isAdvancedStrategyKey = (key: SetupStrategyKey): key is (typeof ADVANCED_STRATEGY_KEYS)[number] =>
    ADVANCED_STRATEGY_KEY_SET.has(key);

export class StrategyStepController {
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

        const applySettingChange = (focusId: string, mutate: (draft: StrategyStepMutableState) => void): void => {
            deps.applySettingChange(focusId, (draft) => {
                mutate(draft);
            });
        };

        const buildModeButton = document.createElement('button');
        buildModeButton.id = STEP2_CONTROL_IDS.buildMode;
        buildModeButton.className = 'setup-toggle';

        const buildModeLabel = document.createElement('span');
        buildModeLabel.className = 'setup-toggle-label';
        buildModeLabel.textContent = 'Build mode';

        const buildModeMeta = document.createElement('span');
        buildModeMeta.className = 'setup-toggle-meta';
        buildModeMeta.textContent = 'Replace, append, or merge with your lineup.';

        const buildModeState = document.createElement('span');
        buildModeState.className = 'setup-toggle-state';
        buildModeState.textContent = state.buildMode.charAt(0).toUpperCase() + state.buildMode.slice(1);

        buildModeButton.appendChild(buildModeLabel);
        buildModeButton.appendChild(buildModeMeta);
        buildModeButton.appendChild(buildModeState);

        buildModeButton.addEventListener('click', () => {
            applySettingChange(buildModeButton.id, (draft) => {
                const modes: Array<typeof draft.buildMode> = ['replace', 'append', 'merge'];
                const currentIndex = modes.indexOf(draft.buildMode);
                const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % modes.length : 0;
                draft.buildMode = modes[nextIndex] ?? 'replace';
            });
        });

        const combineButton = document.createElement('button');
        combineButton.id = STEP2_CONTROL_IDS.combineMode;
        combineButton.className = 'setup-toggle';

        const combineLabel = document.createElement('span');
        combineLabel.className = 'setup-toggle-label';
        combineLabel.textContent = 'Actor/Studio combine';

        const combineMeta = document.createElement('span');
        combineMeta.className = 'setup-toggle-meta';
        combineMeta.textContent = 'Separate movies + TV or combine together.';

        const combineState = document.createElement('span');
        combineState.className = 'setup-toggle-state';
        combineState.textContent = state.actorStudioCombineMode === 'combined' ? 'Combined' : 'Separate';

        combineButton.appendChild(combineLabel);
        combineButton.appendChild(combineMeta);
        combineButton.appendChild(combineState);

        combineButton.addEventListener('click', () => {
            applySettingChange(combineButton.id, (draft) => {
                draft.actorStudioCombineMode = draft.actorStudioCombineMode === 'combined' ? 'separate' : 'combined';
            });
        });

        const strategyLabels: Array<{ key: SetupStrategyKey; label: string; detail: string }> = [
            { key: 'collections', label: 'Collections', detail: 'One channel per collection.' },
            { key: 'playlists', label: 'Playlists', detail: 'Channels from Plex playlists.' },
            { key: 'recentlyAdded', label: 'Recently added', detail: 'Per library, newest first.' },
            { key: 'genres', label: 'Genres', detail: 'Filter channels by genre (slower on large libraries).' },
            { key: 'directors', label: 'Directors', detail: 'Filter channels by director (slower on large libraries).' },
            { key: 'decades', label: 'Decades', detail: 'Channels by decade (1980s, 1990s...).' },
            { key: 'studios', label: 'Studios', detail: 'Channels by studio (Movies/TV).' },
            { key: 'actors', label: 'Actors', detail: 'Channels by actor (Movies/TV).' },
        ];

        const createStrategyControls = (strategy: typeof strategyLabels[number]): HTMLButtonElement[] => {
            const strategyState = state.strategies[strategy.key];

            const toggleButton = document.createElement('button');
            toggleButton.id = deps.strategyButtonId(strategy.key);
            toggleButton.className = `setup-toggle${strategyState.enabled ? ' selected' : ''}`;

            const toggleLabel = document.createElement('span');
            toggleLabel.className = 'setup-toggle-label';
            toggleLabel.textContent = strategy.label;

            const toggleMeta = document.createElement('span');
            toggleMeta.className = 'setup-toggle-meta';
            toggleMeta.textContent = strategy.detail;

            const toggleState = document.createElement('span');
            toggleState.className = 'setup-toggle-state';
            toggleState.textContent = strategyState.enabled ? 'On' : 'Off';

            toggleButton.appendChild(toggleLabel);
            toggleButton.appendChild(toggleMeta);
            toggleButton.appendChild(toggleState);
            toggleButton.addEventListener('click', () => {
                applySettingChange(toggleButton.id, (draft) => {
                    draft.strategies[strategy.key].enabled = !draft.strategies[strategy.key].enabled;
                });
            });

            const priorityButton = document.createElement('button');
            priorityButton.id = deps.priorityButtonId(strategy.key);
            priorityButton.className = 'setup-toggle setup-toggle--adjustable';

            const priorityLabel = document.createElement('span');
            priorityLabel.className = 'setup-toggle-label';
            priorityLabel.textContent = `${strategy.label} priority`;

            const priorityMeta = document.createElement('span');
            priorityMeta.className = 'setup-toggle-meta';
            priorityMeta.textContent = 'Lower numbers are planned earlier.';

            const priorityState = document.createElement('span');
            priorityState.className = 'setup-toggle-state';
            priorityState.textContent = String(strategyState.priority);

            priorityButton.appendChild(priorityLabel);
            priorityButton.appendChild(priorityMeta);
            priorityButton.appendChild(priorityState);
            priorityButton.addEventListener('click', () => {
                applySettingChange(priorityButton.id, (draft) => {
                    const maxPriority = deps.strategyKeys.length;
                    const next = draft.strategies[strategy.key];
                    next.priority = next.priority >= maxPriority ? 1 : next.priority + 1;
                });
            });

            if (!deps.strategySupportsMixedScope(strategy.key)) {
                return [toggleButton, priorityButton];
            }

            const scopeButton = document.createElement('button');
            scopeButton.id = deps.scopeButtonId(strategy.key);
            scopeButton.className = `setup-toggle${strategyState.scope === 'cross-library' ? ' selected' : ''}`;

            const scopeLabel = document.createElement('span');
            scopeLabel.className = 'setup-toggle-label';
            scopeLabel.textContent = `${strategy.label} scope`;

            const scopeMeta = document.createElement('span');
            scopeMeta.className = 'setup-toggle-meta';
            scopeMeta.textContent = 'Per-library by default. Mixed is experimental.';

            const scopeState = document.createElement('span');
            scopeState.className = 'setup-toggle-state';
            scopeState.textContent = strategyState.scope === 'cross-library' ? 'Mixed' : 'Per Library';

            scopeButton.appendChild(scopeLabel);
            scopeButton.appendChild(scopeMeta);
            scopeButton.appendChild(scopeState);
            scopeButton.addEventListener('click', () => {
                applySettingChange(scopeButton.id, (draft) => {
                    const next = draft.strategies[strategy.key];
                    next.scope = next.scope === 'cross-library' ? 'per-library' : 'cross-library';
                });
            });

            return [toggleButton, priorityButton, scopeButton];
        };

        const contentButtons = strategyLabels
            .filter((strategy) => isContentStrategyKey(strategy.key))
            .flatMap(createStrategyControls);
        const advancedButtons = strategyLabels
            .filter((strategy) => isAdvancedStrategyKey(strategy.key))
            .flatMap(createStrategyControls);

        const addAlternateLineupsButton = document.createElement('button');
        addAlternateLineupsButton.id = STEP2_CONTROL_IDS.addAlternateLineups;
        addAlternateLineupsButton.className = `setup-toggle${state.channelExpansion.addAlternateLineups ? ' selected' : ''}`;

        const addAlternateLineupsLabel = document.createElement('span');
        addAlternateLineupsLabel.className = 'setup-toggle-label';
        addAlternateLineupsLabel.textContent = 'Add Alternate Lineups';

        const addAlternateLineupsMeta = document.createElement('span');
        addAlternateLineupsMeta.className = 'setup-toggle-meta';
        addAlternateLineupsMeta.textContent = 'Create extra channels from the same category with different deterministic shuffle lineups.';

        const addAlternateLineupsState = document.createElement('span');
        addAlternateLineupsState.className = 'setup-toggle-state';
        addAlternateLineupsState.textContent = state.channelExpansion.addAlternateLineups ? 'On' : 'Off';

        addAlternateLineupsButton.appendChild(addAlternateLineupsLabel);
        addAlternateLineupsButton.appendChild(addAlternateLineupsMeta);
        addAlternateLineupsButton.appendChild(addAlternateLineupsState);
        addAlternateLineupsButton.addEventListener('click', () => {
            applySettingChange(addAlternateLineupsButton.id, (draft) => {
                draft.channelExpansion.addAlternateLineups = !draft.channelExpansion.addAlternateLineups;
            });
        });

        const alternateCopiesButton = document.createElement('button');
        alternateCopiesButton.id = STEP2_CONTROL_IDS.alternateLineupCopies;
        alternateCopiesButton.className = 'setup-toggle setup-toggle--adjustable';
        alternateCopiesButton.disabled = !state.channelExpansion.addAlternateLineups;

        const alternateCopiesLabel = document.createElement('span');
        alternateCopiesLabel.className = 'setup-toggle-label';
        alternateCopiesLabel.textContent = 'Alternate Lineup Copies';

        const alternateCopiesMeta = document.createElement('span');
        alternateCopiesMeta.className = 'setup-toggle-meta';
        alternateCopiesMeta.textContent = 'How many extra copies per generated channel.';

        const alternateCopiesState = document.createElement('span');
        alternateCopiesState.className = 'setup-toggle-state';
        alternateCopiesState.textContent = String(state.channelExpansion.alternateLineupCopies);

        alternateCopiesButton.appendChild(alternateCopiesLabel);
        alternateCopiesButton.appendChild(alternateCopiesMeta);
        alternateCopiesButton.appendChild(alternateCopiesState);
        alternateCopiesButton.addEventListener('click', () => {
            if (!state.channelExpansion.addAlternateLineups) {
                return;
            }
            applySettingChange(alternateCopiesButton.id, (draft) => {
                draft.channelExpansion.alternateLineupCopies = deps.stepPreset(
                    [1, 2, 3],
                    draft.channelExpansion.alternateLineupCopies,
                    'right',
                    'wrap'
                );
            });
        });

        const addSequentialVariantsButton = document.createElement('button');
        addSequentialVariantsButton.id = STEP2_CONTROL_IDS.addSequentialVariants;
        addSequentialVariantsButton.className = `setup-toggle${state.channelExpansion.addSequentialVariants ? ' selected' : ''}`;

        const addSequentialLabel = document.createElement('span');
        addSequentialLabel.className = 'setup-toggle-label';
        addSequentialLabel.textContent = 'Add Sequential Channels';

        const addSequentialMeta = document.createElement('span');
        addSequentialMeta.className = 'setup-toggle-meta';
        addSequentialMeta.textContent = 'Also create a sequential version for each generated channel.';

        const addSequentialState = document.createElement('span');
        addSequentialState.className = 'setup-toggle-state';
        addSequentialState.textContent = state.channelExpansion.addSequentialVariants ? 'On' : 'Off';

        addSequentialVariantsButton.appendChild(addSequentialLabel);
        addSequentialVariantsButton.appendChild(addSequentialMeta);
        addSequentialVariantsButton.appendChild(addSequentialState);
        addSequentialVariantsButton.addEventListener('click', () => {
            applySettingChange(addSequentialVariantsButton.id, (draft) => {
                draft.channelExpansion.addSequentialVariants = !draft.channelExpansion.addSequentialVariants;
            });
        });

        const maxButton = document.createElement('button');
        maxButton.id = STEP2_CONTROL_IDS.maxChannels;
        maxButton.className = 'setup-toggle setup-toggle--adjustable';

        const maxLabel = document.createElement('span');
        maxLabel.className = 'setup-toggle-label';
        maxLabel.textContent = 'Max channels';

        const maxMeta = document.createElement('span');
        maxMeta.className = 'setup-toggle-meta';
        maxMeta.textContent = `Default ${DEFAULT_CHANNEL_SETUP_MAX}. Limit up to ${MAX_CHANNELS}.`;

        const maxState = document.createElement('span');
        maxState.className = 'setup-toggle-state';
        maxState.textContent = String(state.maxChannels);

        maxButton.appendChild(maxLabel);
        maxButton.appendChild(maxMeta);
        maxButton.appendChild(maxState);

        maxButton.addEventListener('click', () => {
            applySettingChange(maxButton.id, (draft) => {
                draft.maxChannels = deps.stepPreset(
                    deps.channelLimitOptions,
                    draft.maxChannels,
                    'right',
                    'wrap'
                );
            });
        });

        const minItemsButton = document.createElement('button');
        minItemsButton.id = STEP2_CONTROL_IDS.minItems;
        minItemsButton.className = 'setup-toggle setup-toggle--adjustable';

        const minItemsLabel = document.createElement('span');
        minItemsLabel.className = 'setup-toggle-label';
        minItemsLabel.textContent = 'Min items';

        const minItemsMeta = document.createElement('span');
        minItemsMeta.className = 'setup-toggle-meta';
        minItemsMeta.textContent = 'Minimum content items per channel.';

        const minItemsState = document.createElement('span');
        minItemsState.className = 'setup-toggle-state';
        minItemsState.textContent = String(state.minItems);

        minItemsButton.appendChild(minItemsLabel);
        minItemsButton.appendChild(minItemsMeta);
        minItemsButton.appendChild(minItemsState);

        minItemsButton.addEventListener('click', () => {
            applySettingChange(minItemsButton.id, (draft) => {
                draft.minItems = deps.stepPreset(
                    deps.minItemsOptions,
                    draft.minItems,
                    'right',
                    'wrap'
                );
            });
        });

        const expandLineupButton = document.createElement('button');
        expandLineupButton.id = STEP2_CONTROL_IDS.expandLineup;
        expandLineupButton.className = 'setup-toggle';

        const expandLineupLabel = document.createElement('span');
        expandLineupLabel.className = 'setup-toggle-label';
        expandLineupLabel.textContent = 'Expand Lineup';

        const expandLineupMeta = document.createElement('span');
        expandLineupMeta.className = 'setup-toggle-meta';
        expandLineupMeta.textContent = 'Quick action: set max channels to the cap and min items to 1.';

        const expandLineupState = document.createElement('span');
        expandLineupState.className = 'setup-toggle-state';
        expandLineupState.textContent = 'Apply';

        expandLineupButton.appendChild(expandLineupLabel);
        expandLineupButton.appendChild(expandLineupMeta);
        expandLineupButton.appendChild(expandLineupState);
        expandLineupButton.addEventListener('click', () => {
            applySettingChange(expandLineupButton.id, (draft) => {
                draft.maxChannels = MAX_CHANNELS;
                draft.minItems = 1;
            });
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

        const detailScroll = document.createElement('div');
        detailScroll.className = 'setup-detail-scroll setup-focus-safe-scroll';

        const detailControls = document.createElement('div');
        detailControls.className = 'setup-list';
        const activeControls = controlsByCategory[state.activeStrategyCategory] ?? [];
        for (const button of activeControls) {
            detailControls.appendChild(button);
        }
        detailScroll.appendChild(detailControls);

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
        } else if (state.preview) {
            const { estimates, warnings, reachedMaxChannels } = state.preview;

            const rows = document.createElement('div');
            rows.className = 'setup-preview-rows';
            rows.appendChild(deps.buildPreviewRow('Total planned', estimates.total, 'total'));
            rows.appendChild(deps.buildPreviewRow('Collections', estimates.collections, 'collections'));
            rows.appendChild(deps.buildPreviewRow('Recently added', estimates.recentlyAdded, 'recentlyAdded'));
            rows.appendChild(deps.buildPreviewRow('Playlists', estimates.playlists, 'playlists'));
            rows.appendChild(deps.buildPreviewRow('Genres', estimates.genres, 'genres'));
            rows.appendChild(deps.buildPreviewRow('Directors', estimates.directors, 'directors'));
            rows.appendChild(deps.buildPreviewRow('Decades', estimates.decades, 'decades'));
            rows.appendChild(deps.buildPreviewRow('Studios', estimates.studios, 'studios'));
            rows.appendChild(deps.buildPreviewRow('Actors', estimates.actors, 'actors'));
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
        } else if (state.isPreviewLoading) {
            const loading = document.createElement('div');
            loading.className = 'setup-preview-loading';
            loading.classList.add('panel-spinner');
            loading.textContent = 'Estimating channels...';
            previewPanel.appendChild(loading);
        } else {
            const empty = document.createElement('div');
            empty.className = 'setup-preview-empty';
            empty.textContent = 'Estimates will appear after a short pause.';
            previewPanel.appendChild(empty);
        }

        right.appendChild(detailScroll);
        right.appendChild(previewPanel);
        split.appendChild(left);
        split.appendChild(right);
        ctx.contentEl.appendChild(split);

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
