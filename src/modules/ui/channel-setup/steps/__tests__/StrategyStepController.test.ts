/**
 * @jest-environment jsdom
 */

import { MAX_CHANNELS } from '../../../../scheduler/channel-manager/constants';
import { createDefaultStrategyOrder, createDefaultStrategyState } from '../../ChannelSetupSessionState';
import type { EstimateKey, StrategyStepMutableState } from '../../ChannelSetupSessionContracts';
import { StrategyStepController } from '../StrategyStepController';
import { STEP2_CONTROL_IDS } from '../constants';
import { getStrategyControlDescriptor } from '../StrategyStepControlDescriptors';
import type {
    StrategyStepDeps,
    StepRenderContext,
} from '../types';

const INTERNAL_SETUP_COPY_PATTERN =
    /\b(?:stop and re-plan|re-plan|planner|execution|cleanup|slice|blocked plan|plan blocked)\b|partial setup plan/i;

const createContext = (): StepRenderContext => ({
    contentEl: document.createElement('div'),
    stepEl: document.createElement('div'),
    statusEl: document.createElement('div'),
    detailEl: document.createElement('div'),
    errorEl: document.createElement('div'),
});

const createDeps = (overrides: Partial<StrategyStepDeps> = {}): StrategyStepDeps => ({
    state: {
        activeStrategyCategory: 'content-sources',
        strategies: createDefaultStrategyState(),
        strategyOrder: createDefaultStrategyOrder(),
        channelExpansion: {
            addAlternateLineups: false,
            alternateLineupCopies: 1,
            variantType: 'none',
            variantBlockSize: 3,
        },
        seriesOrdering: {
            basePlaybackMode: 'shuffle',
            baseBlockSize: 3,
        },
        buildMode: 'replace',
        actorStudioCombineMode: 'separate',
        maxChannels: 200,
        minItems: 1,
        setupContext: 'unknown',
        previewPanelId: 'preview-panel',
        preview: null,
        previewError: null,
        previewStatus: 'idle',
        isPreviewLoading: false,
    },
    strategyKeys: createDefaultStrategyOrder(),
    categoryButtonId: (category) => `category-${category}`,
    strategyButtonId: (strategy) => `strategy-${strategy}`,
    priorityRowId: (strategy) => `priority-${strategy}`,
    lastReorder: null,
    scopeButtonId: (strategy) => `scope-${strategy}`,
    strategySupportsMixedScope: (strategy) => strategy === 'genres' || strategy === 'directors' || strategy === 'studios' || strategy === 'actors',
    buildPreviewRow: jest.fn((label: string, value: number | string, key?: EstimateKey) => {
        const row = document.createElement('div');
        row.dataset.key = key ?? '';
        row.textContent = `${label}: ${value}`;
        return row;
    }),
    renderCappedWarnings: jest.fn(),
    applyCategoryChange: jest.fn(),
    applySettingChange: jest.fn((_focusId: string, mutate: (state: StrategyStepMutableState) => void) => {
        const draft: StrategyStepMutableState = {
            strategies: createDefaultStrategyState(),
            strategyOrder: createDefaultStrategyOrder(),
            channelExpansion: {
                addAlternateLineups: false,
                alternateLineupCopies: 1,
                variantType: 'none',
                variantBlockSize: 3,
            },
            seriesOrdering: {
                basePlaybackMode: 'shuffle',
                baseBlockSize: 3,
            },
            buildMode: 'replace',
            actorStudioCombineMode: 'separate',
            maxChannels: 200,
            minItems: 1,
        };
        mutate(draft);
    }),
    openAdjustableControl: jest.fn(),
    onBack: jest.fn(),
    onNext: jest.fn(),
    registerStep2Focusables: jest.fn(),
    detailText: 'Detail text',
    schedulePreview: jest.fn(),
    preloadReview: jest.fn(),
    ...overrides,
});

const renderController = (
    overrides: Partial<StrategyStepDeps> = {}
): { ctx: StepRenderContext; deps: StrategyStepDeps; controller: StrategyStepController } => {
    const ctx = createContext();
    document.body.appendChild(ctx.contentEl);
    const deps = createDeps(overrides);
    const controller = new StrategyStepController();
    controller.render(ctx, deps);
    return { ctx, deps, controller };
};

describe('StrategyStepController', () => {
    afterEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('routes category-rail selection callbacks through the active category buttons', () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const deps = createDeps();
        const controller = new StrategyStepController();

        controller.render(ctx, deps);
        (ctx.contentEl.querySelector('#category-advanced-sources') as HTMLButtonElement).click();

        expect(deps.applyCategoryChange).toHaveBeenCalledWith('advanced-sources', 'category-advanced-sources');
    });

    it('keeps block-size controls disabled when series mode and variant mode are not block', () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const deps = createDeps({
            state: {
                ...createDeps().state,
                activeStrategyCategory: 'series-ordering',
            },
        });
        const controller = new StrategyStepController();

        controller.render(ctx, deps);

        expect((ctx.contentEl.querySelector('#setup-series-base-block-size') as HTMLButtonElement).disabled).toBe(true);
        expect((ctx.contentEl.querySelector('#setup-series-variant-block-size') as HTMLButtonElement).disabled).toBe(true);
    });

    it('renders adjustable build controls from the shared descriptor contract', () => {
        const deps = createDeps({
            state: {
                ...createDeps().state,
                activeStrategyCategory: 'build-options',
                actorStudioCombineMode: 'combined',
                channelExpansion: {
                    addAlternateLineups: true,
                    alternateLineupCopies: 3,
                    variantType: 'none',
                    variantBlockSize: 3,
                },
            },
        });
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const controller = new StrategyStepController();

        controller.render(ctx, deps);

        for (const controlId of [
            STEP2_CONTROL_IDS.buildMode,
            STEP2_CONTROL_IDS.combineMode,
            STEP2_CONTROL_IDS.alternateLineupCopies,
        ]) {
            const descriptor = getStrategyControlDescriptor(controlId);
            const button = ctx.contentEl.querySelector(`#${controlId}`) as HTMLButtonElement | null;
            expect(descriptor).not.toBeNull();
            expect(button?.querySelector('.setup-toggle-label')?.textContent).toBe(descriptor?.label);
            expect(button?.querySelector('.setup-toggle-meta')?.textContent).toBe(descriptor?.meta);
            expect(button?.querySelector('.setup-toggle-state')?.childNodes[0]?.textContent).toBe(
                descriptor?.stateText(deps.state)
            );
            expect(button?.disabled).toBe(descriptor?.isDisabled?.(deps.state) ?? false);
        }
    });

    it('toggles the preview strip details in place', () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const deps = createDeps({
            state: {
                ...createDeps().state,
                preview: {
                    estimates: {
                        total: 8,
                        collections: 1,
                        playlists: 1,
                        genres: 1,
                        directors: 1,
                        decades: 1,
                        recentlyAdded: 1,
                        studios: 1,
                        actors: 1,
                    },
                    warnings: [],
                    reachedMaxChannels: false,
                },
            },
        });
        const controller = new StrategyStepController();

        controller.render(ctx, deps);
        const toggle = ctx.contentEl.querySelector('#setup-preview-toggle') as HTMLButtonElement;
        const previewPanel = ctx.contentEl.querySelector('#preview-panel') as HTMLElement;

        expect(previewPanel.hidden).toBe(true);
        toggle.click();
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(previewPanel.hidden).toBe(false);
    });

    it('routes adjustable controls through the interaction owner hook', () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const deps = createDeps({
            state: {
                ...createDeps().state,
                activeStrategyCategory: 'build-options',
            },
        });
        const controller = new StrategyStepController();

        controller.render(ctx, deps);
        (ctx.contentEl.querySelector('#setup-build-mode') as HTMLButtonElement).click();

        expect(deps.openAdjustableControl).toHaveBeenCalledWith('setup-build-mode');
    });

    it('updates priority rows in place without a full rerender', () => {
        const ctx = createContext();
        const deps = createDeps({
            state: {
                ...createDeps().state,
                activeStrategyCategory: 'priority-order',
            },
        });
        const controller = new StrategyStepController();

        controller.render(ctx, deps);
        const row = controller.updatePriorityRowState(ctx.contentEl, 'priority-playlists', false);

        expect(row).not.toBeNull();
        expect(row?.classList.contains('selected')).toBe(false);
        expect(row?.getAttribute('aria-pressed')).toBe('false');
        expect(row?.getAttribute('aria-label')).toContain('Off');
    });

    it('renders mixed-scope controls only for supported strategies', () => {
        const { ctx } = renderController({
            state: {
                ...createDeps().state,
                activeStrategyCategory: 'advanced-sources',
            },
        });

        expect(ctx.contentEl.querySelector('#scope-genres')).not.toBeNull();
        expect(ctx.contentEl.querySelector('#scope-collections')).toBeNull();
    });

    it('renders active-category dots, footer actions, and first-time next label', () => {
        const baseState = createDeps().state;
        const strategies = createDefaultStrategyState();
        strategies.collections.enabled = true;
        strategies.genres.enabled = true;

        const { ctx, deps } = renderController({
            state: {
                ...baseState,
                setupContext: 'first-time',
                strategies,
            },
        });

        expect(
            ctx.contentEl.querySelector('#category-content-sources .setup-category-dot')
        ).not.toBeNull();
        expect(
            ctx.contentEl.querySelector('#category-advanced-sources .setup-category-dot')
        ).not.toBeNull();
        expect((ctx.contentEl.querySelector('#setup-next') as HTMLButtonElement).textContent).toBe('Build Channels');

        (ctx.contentEl.querySelector('#setup-back') as HTMLButtonElement).click();
        (ctx.contentEl.querySelector('#setup-next') as HTMLButtonElement).click();

        expect(deps.onBack).toHaveBeenCalledTimes(1);
        expect(deps.onNext).toHaveBeenCalledTimes(1);
        expect(deps.registerStep2Focusables).toHaveBeenCalledTimes(1);
        expect(deps.schedulePreview).toHaveBeenCalledTimes(1);
        expect(ctx.detailEl.textContent).toBe('Detail text');
    });

    it('routes strategy and scope toggles through applySettingChange mutations', () => {
        const { ctx: contentCtx, deps: contentDeps } = renderController();

        (contentCtx.contentEl.querySelector('#strategy-playlists') as HTMLButtonElement).click();

        const contentApplySettingChange = contentDeps.applySettingChange as jest.Mock;
        const disablePlaylists = contentApplySettingChange.mock.calls[0]?.[1] as
            | ((state: StrategyStepMutableState) => void)
            | undefined;
        const contentDraft: StrategyStepMutableState = {
            strategies: createDefaultStrategyState(),
            strategyOrder: createDefaultStrategyOrder(),
            channelExpansion: {
                addAlternateLineups: false,
                alternateLineupCopies: 1,
                variantType: 'none',
                variantBlockSize: 3,
            },
            seriesOrdering: {
                basePlaybackMode: 'shuffle',
                baseBlockSize: 3,
            },
            buildMode: 'replace',
            actorStudioCombineMode: 'separate',
            maxChannels: 200,
            minItems: 1,
        };
        disablePlaylists?.(contentDraft);
        expect(contentDraft.strategies.playlists.enabled).toBe(false);

        const strategies = createDefaultStrategyState();
        strategies.genres.scope = 'cross-library';
        const { ctx: advancedCtx, deps: advancedDeps } = renderController({
            state: {
                ...createDeps().state,
                activeStrategyCategory: 'advanced-sources',
                strategies,
            },
        });

        (advancedCtx.contentEl.querySelector('#scope-genres') as HTMLButtonElement).click();

        const advancedApplySettingChange = advancedDeps.applySettingChange as jest.Mock;
        const toggleGenresScope = advancedApplySettingChange.mock.calls[0]?.[1] as
            | ((state: StrategyStepMutableState) => void)
            | undefined;
        const advancedDraft: StrategyStepMutableState = {
            strategies,
            strategyOrder: createDefaultStrategyOrder(),
            channelExpansion: {
                addAlternateLineups: false,
                alternateLineupCopies: 1,
                variantType: 'none',
                variantBlockSize: 3,
            },
            seriesOrdering: {
                basePlaybackMode: 'shuffle',
                baseBlockSize: 3,
            },
            buildMode: 'replace',
            actorStudioCombineMode: 'separate',
            maxChannels: 200,
            minItems: 1,
        };
        toggleGenresScope?.(advancedDraft);
        expect(advancedDraft.strategies.genres.scope).toBe('per-library');
    });

    it('routes adjustable and quick-action controls through the strategy interaction hooks', () => {
        const { ctx, deps } = renderController({
            state: {
                ...createDeps().state,
                activeStrategyCategory: 'build-options',
                channelExpansion: {
                    addAlternateLineups: true,
                    alternateLineupCopies: 2,
                    variantType: 'none',
                    variantBlockSize: 3,
                },
            },
        });

        (ctx.contentEl.querySelector(`#${STEP2_CONTROL_IDS.combineMode}`) as HTMLButtonElement).click();
        (ctx.contentEl.querySelector(`#${STEP2_CONTROL_IDS.addAlternateLineups}`) as HTMLButtonElement).click();
        (ctx.contentEl.querySelector(`#${STEP2_CONTROL_IDS.alternateLineupCopies}`) as HTMLButtonElement).click();

        expect(deps.openAdjustableControl).toHaveBeenCalledWith(STEP2_CONTROL_IDS.combineMode);
        expect(deps.openAdjustableControl).toHaveBeenCalledWith(STEP2_CONTROL_IDS.alternateLineupCopies);

        const buildApplySettingChange = deps.applySettingChange as jest.Mock;
        const toggleAlternateLineups = buildApplySettingChange.mock.calls[0]?.[1] as
            | ((state: StrategyStepMutableState) => void)
            | undefined;
        const buildDraft: StrategyStepMutableState = {
            strategies: createDefaultStrategyState(),
            strategyOrder: createDefaultStrategyOrder(),
            channelExpansion: {
                addAlternateLineups: true,
                alternateLineupCopies: 2,
                variantType: 'none',
                variantBlockSize: 3,
            },
            seriesOrdering: {
                basePlaybackMode: 'shuffle',
                baseBlockSize: 3,
            },
            buildMode: 'replace',
            actorStudioCombineMode: 'separate',
            maxChannels: 200,
            minItems: 1,
        };
        toggleAlternateLineups?.(buildDraft);
        expect(buildDraft.channelExpansion.addAlternateLineups).toBe(false);

        const { ctx: disabledCtx, deps: disabledDeps } = renderController({
            state: {
                ...createDeps().state,
                activeStrategyCategory: 'build-options',
            },
        });
        const disabledCopies = disabledCtx.contentEl.querySelector(
            `#${STEP2_CONTROL_IDS.alternateLineupCopies}`
        ) as HTMLButtonElement;
        disabledCopies.disabled = false;
        disabledCopies.click();
        expect(disabledDeps.openAdjustableControl).not.toHaveBeenCalled();

        const { ctx: seriesCtx, deps: seriesDeps } = renderController({
            state: {
                ...createDeps().state,
                activeStrategyCategory: 'series-ordering',
                seriesOrdering: {
                    basePlaybackMode: 'block',
                    baseBlockSize: 4,
                },
                channelExpansion: {
                    addAlternateLineups: false,
                    alternateLineupCopies: 1,
                    variantType: 'block',
                    variantBlockSize: 5,
                },
            },
        });

        (seriesCtx.contentEl.querySelector(`#${STEP2_CONTROL_IDS.seriesBaseMode}`) as HTMLButtonElement).click();
        (seriesCtx.contentEl.querySelector(`#${STEP2_CONTROL_IDS.seriesBaseBlockSize}`) as HTMLButtonElement).click();
        (seriesCtx.contentEl.querySelector(`#${STEP2_CONTROL_IDS.seriesVariantType}`) as HTMLButtonElement).click();
        (seriesCtx.contentEl.querySelector(`#${STEP2_CONTROL_IDS.seriesVariantBlockSize}`) as HTMLButtonElement).click();

        expect(seriesDeps.openAdjustableControl).toHaveBeenCalledWith(STEP2_CONTROL_IDS.seriesBaseMode);
        expect(seriesDeps.openAdjustableControl).toHaveBeenCalledWith(STEP2_CONTROL_IDS.seriesBaseBlockSize);
        expect(seriesDeps.openAdjustableControl).toHaveBeenCalledWith(STEP2_CONTROL_IDS.seriesVariantType);
        expect(seriesDeps.openAdjustableControl).toHaveBeenCalledWith(STEP2_CONTROL_IDS.seriesVariantBlockSize);

        const { ctx: disabledSeriesCtx, deps: disabledSeriesDeps } = renderController({
            state: {
                ...createDeps().state,
                activeStrategyCategory: 'series-ordering',
            },
        });
        const disabledBase = disabledSeriesCtx.contentEl.querySelector(
            `#${STEP2_CONTROL_IDS.seriesBaseBlockSize}`
        ) as HTMLButtonElement;
        disabledBase.disabled = false;
        disabledBase.click();
        const disabledVariant = disabledSeriesCtx.contentEl.querySelector(
            `#${STEP2_CONTROL_IDS.seriesVariantBlockSize}`
        ) as HTMLButtonElement;
        disabledVariant.disabled = false;
        disabledVariant.click();
        expect(disabledSeriesDeps.openAdjustableControl).not.toHaveBeenCalled();

        const { ctx: limitsCtx, deps: limitsDeps } = renderController({
            state: {
                ...createDeps().state,
                activeStrategyCategory: 'limits',
            },
        });

        (limitsCtx.contentEl.querySelector(`#${STEP2_CONTROL_IDS.maxChannels}`) as HTMLButtonElement).click();
        (limitsCtx.contentEl.querySelector(`#${STEP2_CONTROL_IDS.minItems}`) as HTMLButtonElement).click();
        (limitsCtx.contentEl.querySelector(`#${STEP2_CONTROL_IDS.expandLineup}`) as HTMLButtonElement).click();

        expect(limitsDeps.openAdjustableControl).toHaveBeenCalledWith(STEP2_CONTROL_IDS.maxChannels);
        expect(limitsDeps.openAdjustableControl).toHaveBeenCalledWith(STEP2_CONTROL_IDS.minItems);

        const limitsApplySettingChange = limitsDeps.applySettingChange as jest.Mock;
        const expandLineup = limitsApplySettingChange.mock.calls[0]?.[1] as
            | ((state: StrategyStepMutableState) => void)
            | undefined;
        const limitsDraft: StrategyStepMutableState = {
            strategies: createDefaultStrategyState(),
            strategyOrder: createDefaultStrategyOrder(),
            channelExpansion: {
                addAlternateLineups: false,
                alternateLineupCopies: 1,
                variantType: 'none',
                variantBlockSize: 3,
            },
            seriesOrdering: {
                basePlaybackMode: 'shuffle',
                baseBlockSize: 3,
            },
            buildMode: 'replace',
            actorStudioCombineMode: 'separate',
            maxChannels: 100,
            minItems: 5,
        };
        expandLineup?.(limitsDraft);
        expect(limitsDraft.maxChannels).toBe(MAX_CHANNELS);
        expect(limitsDraft.minItems).toBe(1);
    });

    it('renders preview warnings, loading states, and detailed estimate rows', () => {
        const { ctx: blockedCtx } = renderController({
            state: {
                ...createDeps().state,
                previewError: 'Required genres tag directory (type=2) is unsupported for Shows; stop and re-plan.',
                previewStatus: 'blocked',
            },
        });
        const blockedCopy = blockedCtx.contentEl.querySelector('.setup-preview-warning')?.textContent ?? '';
        expect(blockedCopy).toContain('Plex does not provide usable genres data for Shows.');
        expect(blockedCopy).toContain('Try again later, disable that source, or continue with supported channel types.');
        expect(blockedCopy).not.toMatch(INTERNAL_SETUP_COPY_PATTERN);

        const { ctx: slowCtx } = renderController({
            state: {
                ...createDeps().state,
                previewError: 'Timed out',
                previewStatus: 'slow',
            },
        });
        expect(slowCtx.contentEl.querySelector('.setup-preview-warning')?.textContent).toContain('Preview timed out');

        const warnings = [
            'Required studios tag directory (type=4) failed for Movies (Directory must be an array); stop and re-plan.',
            'Partial setup plan (fetch_collections): fetch_collections failed for Shows (collections endpoint failed)',
        ];
        const { ctx: previewCtx, deps: previewDeps } = renderController({
            state: {
                ...createDeps().state,
                isPreviewLoading: true,
                preview: {
                    estimates: {
                        total: 8,
                        collections: 1,
                        playlists: 1,
                        genres: 1,
                        directors: 1,
                        decades: 1,
                        recentlyAdded: 1,
                        studios: 1,
                        actors: 1,
                    },
                    warnings,
                    reachedMaxChannels: true,
                },
            },
        });

        expect(previewDeps.buildPreviewRow).toHaveBeenCalledTimes(9);
        expect(previewDeps.renderCappedWarnings).toHaveBeenCalledWith(
            [
                'Plex could not read studios data for Movies. Try again later, disable that source, or continue with supported channel types.',
                'Collections could not be included for Shows: collections endpoint failed. Try again later, disable that source, or continue with supported channel types.',
            ],
            expect.any(HTMLDivElement)
        );
        expect(previewCtx.contentEl.querySelector('.setup-preview-updating')?.textContent).toContain('Updating');
        expect(previewCtx.contentEl.querySelectorAll('.setup-preview-warning')).toHaveLength(1);
        expect(previewCtx.contentEl.querySelector('.setup-preview-strip-summary-text')?.textContent).toBe('Est. 8 channels');

        const { ctx: loadingCtx } = renderController({
            state: {
                ...createDeps().state,
                isPreviewLoading: true,
                preview: null,
            },
        });
        expect(loadingCtx.contentEl.querySelector('.setup-preview-loading')?.textContent).toContain('Estimating');
    });

    it('renders priority row move states and updates row buttons in place', () => {
        const { ctx: upCtx, deps: upDeps, controller: upController } = renderController({
            state: {
                ...createDeps().state,
                activeStrategyCategory: 'priority-order',
            },
            lastReorder: { key: 'collections', dir: 'up' },
        });
        const priorityOrder = createDefaultStrategyOrder();
        const firstPriority = priorityOrder[0];
        const lastPriority = priorityOrder[priorityOrder.length - 1];

        expect(
            upCtx.contentEl.querySelector('#priority-collections')?.classList.contains('setup-priority-row--move-up')
        ).toBe(true);
        expect(
            upCtx.contentEl.querySelector(`#priority-${firstPriority} .setup-priority-arrow-up`)?.classList.contains(
                'setup-priority-arrow--hidden'
            )
        ).toBe(true);

        (upCtx.contentEl.querySelector('#priority-playlists') as HTMLButtonElement).click();
        const priorityApplySettingChange = upDeps.applySettingChange as jest.Mock;
        const togglePriority = priorityApplySettingChange.mock.calls[0]?.[1] as
            | ((state: StrategyStepMutableState) => void)
            | undefined;
        const draft: StrategyStepMutableState = {
            strategies: createDefaultStrategyState(),
            strategyOrder: createDefaultStrategyOrder(),
            channelExpansion: {
                addAlternateLineups: false,
                alternateLineupCopies: 1,
                variantType: 'none',
                variantBlockSize: 3,
            },
            seriesOrdering: {
                basePlaybackMode: 'shuffle',
                baseBlockSize: 3,
            },
            buildMode: 'replace',
            actorStudioCombineMode: 'separate',
            maxChannels: 200,
            minItems: 1,
        };
        togglePriority?.(draft);
        expect(draft.strategies.playlists.enabled).toBe(false);

        const updated = upController.updatePriorityRowState(upCtx.contentEl, 'priority-playlists', true);
        expect(updated?.getAttribute('aria-pressed')).toBe('true');
        expect(updated?.getAttribute('aria-label')).toContain('On');

        const { ctx: downCtx } = renderController({
            state: {
                ...createDeps().state,
                activeStrategyCategory: 'priority-order',
            },
            lastReorder: { key: 'playlists', dir: 'down' },
        });
        expect(
            downCtx.contentEl.querySelector('#priority-playlists')?.classList.contains('setup-priority-row--move-down')
        ).toBe(true);
        expect(
            downCtx.contentEl.querySelector(`#priority-${lastPriority} .setup-priority-arrow-down`)?.classList.contains(
                'setup-priority-arrow--hidden'
            )
        ).toBe(true);
    });
});
