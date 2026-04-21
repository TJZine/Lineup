/**
 * @jest-environment jsdom
 */

import { createDefaultStrategyOrder, createDefaultStrategyState } from '../../ChannelSetupSessionState';
import type { EstimateKey, StrategyStepMutableState } from '../../ChannelSetupSessionContracts';
import { StrategyStepController } from '../StrategyStepController';
import type {
    StrategyStepDeps,
    StepRenderContext,
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
    ...overrides,
});

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
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const deps = createDeps({
            state: {
                ...createDeps().state,
                activeStrategyCategory: 'advanced-sources',
            },
        });
        const controller = new StrategyStepController();

        controller.render(ctx, deps);

        expect(ctx.contentEl.querySelector('#scope-genres')).not.toBeNull();
        expect(ctx.contentEl.querySelector('#scope-collections')).toBeNull();
    });
});
