/**
 * @jest-environment jsdom
 */

import { MAX_CHANNELS } from '../../../../scheduler/channel-manager/constants';
import { createDefaultStrategyOrder, createDefaultStrategyState } from '../../ChannelSetupSessionState';
import type { StrategyStepMutableState } from '../../ChannelSetupSessionContracts';
import { StrategyStepController } from '../StrategyStepController';
import { STEP2_CONTROL_IDS } from '../../strategyConstants';
import { getStrategyControlDescriptor } from '../StrategyStepControlDescriptors';
import type { StepRenderContext } from '../../stepContracts';
import type {
    StrategyStepDeps,
} from '../types';

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
    },
    strategyKeys: createDefaultStrategyOrder(),
    categoryButtonId: (category) => `category-${category}`,
    strategyButtonId: (strategy) => `strategy-${strategy}`,
    priorityRowId: (strategy) => `priority-${strategy}`,
    lastReorder: null,
    grabbedPriorityKey: null,
    scopeButtonId: (strategy) => `scope-${strategy}`,
    strategySupportsMixedScope: (strategy) => strategy === 'genres' || strategy === 'directors' || strategy === 'studios' || strategy === 'actors',
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
    resetGuideOrder: jest.fn(),
    openAdjustableControl: jest.fn(),
    onBack: jest.fn(),
    onNext: jest.fn(),
    registerStep2Focusables: jest.fn(),
    detailText: 'Detail text',
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

    it('clears a review failure when returning to the strategy step', () => {
        const ctx = createContext();
        ctx.errorEl.textContent = 'o is not a function';
        document.body.appendChild(ctx.contentEl);

        new StrategyStepController().render(ctx, createDeps());

        expect(ctx.errorEl.textContent).toBe('');
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

    it('describes playback variants as extra base TV channels', () => {
        const descriptor = getStrategyControlDescriptor(STEP2_CONTROL_IDS.seriesVariantType);

        expect(descriptor?.label).toBe('Extra Series Channel');
        expect(descriptor?.meta).toContain('one different playback-order variant per eligible base TV category');
        expect(descriptor?.meta).toContain('excludes actor/director channels and alternate copies');
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

    it('keeps Step 2 configuration-only without estimate UI', () => {
        const { ctx } = renderController();

        expect(ctx.contentEl.querySelector('.setup-preview-strip')).toBeNull();
        expect(ctx.contentEl.querySelector('#setup-preview-toggle')).toBeNull();
        expect(ctx.contentEl.querySelector('.setup-preview-loading')).toBeNull();
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

    it('renders Guide Order rows as active-only reorder controls without toggle state', () => {
        const strategies = createDefaultStrategyState();
        strategies.genres.enabled = false;
        const { ctx, deps } = renderController({
            state: {
                ...createDeps().state,
                activeStrategyCategory: 'priority-order',
                strategies,
            },
        });

        expect(ctx.contentEl.querySelector('.setup-detail-header-title')?.textContent).toBe('Guide Order');
        expect(ctx.contentEl.querySelector('.setup-detail-header #setup-guide-order-reset')).not.toBeNull();
        expect(ctx.contentEl.querySelector('#priority-genres')).toBeNull();

        const row = ctx.contentEl.querySelector('#priority-playlists') as HTMLButtonElement | null;
        expect(row).not.toBeNull();
        expect(row?.getAttribute('aria-pressed')).toBeNull();
        expect(row?.querySelector('.setup-priority-state')).toBeNull();
        expect(row?.querySelector('.setup-priority-grip')).toBeNull();
        expect(row?.querySelector('.setup-priority-arrow-up')).toBeNull();
        expect(row?.querySelector('.setup-priority-hint')?.textContent).toBe('↕');

        row?.click();
        expect(deps.applySettingChange).not.toHaveBeenCalled();
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

    it('renders guide order move, disabled, contextual hint, and reset states', () => {
        const { ctx: upCtx } = renderController({
            state: {
                ...createDeps().state,
                activeStrategyCategory: 'priority-order',
            },
            lastReorder: { key: 'collections', dir: 'up' },
            grabbedPriorityKey: 'collections',
        });

        expect(
            upCtx.contentEl.querySelector('#priority-collections')?.classList.contains('setup-priority-row--move-up')
        ).toBe(true);
        expect(upCtx.contentEl.querySelector('#setup-guide-order-hint')?.textContent).toContain('Back to cancel');
        expect((upCtx.contentEl.querySelector('#setup-guide-order-reset') as HTMLButtonElement).disabled).toBe(true);
        expect(upCtx.contentEl.querySelector('.setup-detail-header #setup-guide-order-reset')).not.toBeNull();

        const { ctx: downCtx, deps: downDeps } = renderController({
            state: {
                ...createDeps().state,
                activeStrategyCategory: 'priority-order',
                strategyOrder: ['collections', 'playlists', 'recentlyAdded', 'genres', 'studios', 'actors', 'decades', 'directors'],
            },
            lastReorder: { key: 'playlists', dir: 'down' },
        });
        expect(
            downCtx.contentEl.querySelector('#priority-playlists')?.classList.contains('setup-priority-row--move-down')
        ).toBe(true);
        const reset = downCtx.contentEl.querySelector('#setup-guide-order-reset') as HTMLButtonElement;
        expect(reset.disabled).toBe(false);
        const registeredDetailButtons = (downDeps.registerStep2Focusables as jest.Mock).mock.calls[0]?.[1] as
            | HTMLButtonElement[]
            | undefined;
        expect(registeredDetailButtons?.map((button) => button.id)).toEqual([
            'setup-guide-order-reset',
            'priority-collections',
            'priority-playlists',
            'priority-recentlyAdded',
            'priority-genres',
            'priority-studios',
            'priority-actors',
            'priority-decades',
            'priority-directors',
            'setup-guide-order-hint',
        ]);
        reset.click();
        expect(downDeps.resetGuideOrder).toHaveBeenCalledWith('setup-guide-order-reset');

        const strategies = createDefaultStrategyState();
        strategies.playlists.enabled = false;
        strategies.genres.enabled = false;
        strategies.directors.enabled = false;
        strategies.decades.enabled = false;
        strategies.recentlyAdded.enabled = false;
        strategies.studios.enabled = false;
        strategies.actors.enabled = false;
        const { ctx: disabledCtx } = renderController({
            state: {
                ...createDeps().state,
                activeStrategyCategory: 'priority-order',
                strategies,
            },
        });
        const onlyRow = disabledCtx.contentEl.querySelector('#priority-collections') as HTMLButtonElement;
        expect(onlyRow.disabled).toBe(true);
        expect(onlyRow.querySelector('.setup-priority-hint')?.textContent).toBe('');
        expect(disabledCtx.contentEl.querySelector('#setup-guide-order-hint')?.textContent).toContain('Enable more categories');
    });
});
