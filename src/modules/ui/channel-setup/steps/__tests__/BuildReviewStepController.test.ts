/**
 * @jest-environment jsdom
 */

import { BuildReviewStepController } from '../BuildReviewStepController';
import type { BuildReviewDeps, StepRenderContext } from '../types';

const createContext = (): StepRenderContext => ({
    contentEl: document.createElement('div'),
    stepEl: document.createElement('div'),
    statusEl: document.createElement('div'),
    detailEl: document.createElement('div'),
    errorEl: document.createElement('div'),
});

const createDeps = (overrides: Partial<BuildReviewDeps> = {}): BuildReviewDeps => ({
    state: {
        buildMode: 'replace',
        review: null,
        reviewError: null,
        isReviewLoading: false,
        replaceConfirm: false,
        isBuilding: false,
        recordApplied: false,
    },
    onBackToStrategy: jest.fn(),
    onConfirmBuild: jest.fn(),
    onToggleReplaceConfirm: jest.fn(),
    buildPreviewRow: jest.fn((label: string, value: number | string) => {
        const row = document.createElement('div');
        row.textContent = `${label}: ${value}`;
        return row;
    }),
    renderCappedWarnings: jest.fn(),
    registerLinearFocusables: jest.fn(),
    ...overrides,
});

describe('BuildReviewStepController', () => {
    afterEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('shows the loading state before the review is ready', () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const deps = createDeps();
        const controller = new BuildReviewStepController();

        controller.render(ctx, deps);

        expect(ctx.contentEl.querySelector('.setup-preview-loading')?.textContent).toContain('Preparing your review');
        expect(deps.registerLinearFocusables).toHaveBeenCalled();
    });

    it('renders blocked review messaging and keeps confirmation disabled', () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const deps = createDeps({
            state: {
                buildMode: 'append',
                review: {
                    preview: {
                        estimates: {
                            total: 5,
                            collections: 1,
                            playlists: 1,
                            genres: 1,
                            directors: 1,
                            decades: 0,
                            recentlyAdded: 1,
                            studios: 0,
                            actors: 0,
                        },
                        warnings: [],
                        reachedMaxChannels: false,
                        status: 'blocked',
                        message: 'Select at least one library.',
                    },
                    diff: {
                        summary: { created: 5, removed: 0, unchanged: 0 },
                        samples: { created: ['News'], removed: [], unchanged: [] },
                    },
                },
                reviewError: null,
                isReviewLoading: false,
                replaceConfirm: false,
                isBuilding: false,
                recordApplied: true,
            },
        });
        const controller = new BuildReviewStepController();

        controller.render(ctx, deps);

        expect(ctx.contentEl.querySelector('.setup-preview-error')?.textContent).toContain('Action required');
        expect((ctx.contentEl.querySelector('#setup-confirm') as HTMLButtonElement).disabled).toBe(true);
    });

    it('routes the replace-confirm callback id and only confirms when enabled', () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const deps = createDeps({
            state: {
                buildMode: 'replace',
                review: {
                    preview: {
                        estimates: {
                            total: 5,
                            collections: 1,
                            playlists: 1,
                            genres: 1,
                            directors: 1,
                            decades: 0,
                            recentlyAdded: 1,
                            studios: 0,
                            actors: 0,
                        },
                        warnings: [],
                        reachedMaxChannels: false,
                    },
                    diff: {
                        summary: { created: 5, removed: 2, unchanged: 1 },
                        samples: { created: ['News'], removed: ['Sports'], unchanged: ['Kids'] },
                    },
                },
                reviewError: null,
                isReviewLoading: false,
                replaceConfirm: true,
                isBuilding: false,
                recordApplied: true,
            },
        });
        const controller = new BuildReviewStepController();

        controller.render(ctx, deps);

        (ctx.contentEl.querySelector('#setup-replace-confirm') as HTMLButtonElement).click();
        (ctx.contentEl.querySelector('#setup-confirm') as HTMLButtonElement).click();

        expect(deps.onToggleReplaceConfirm).toHaveBeenCalledWith('setup-replace-confirm');
        expect(deps.onConfirmBuild).toHaveBeenCalledTimes(1);
    });

    it('renders slow-review messaging and keeps replace builds disabled until review is ready', () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const deps = createDeps({
            state: {
                buildMode: 'replace',
                review: {
                    preview: {
                        estimates: {
                            total: 5,
                            collections: 1,
                            playlists: 1,
                            genres: 1,
                            directors: 1,
                            decades: 0,
                            recentlyAdded: 1,
                            studios: 0,
                            actors: 0,
                        },
                        warnings: [],
                        reachedMaxChannels: false,
                        status: 'slow',
                        message: 'Preview timed out.',
                    },
                    diff: {
                        summary: { created: 5, removed: 0, unchanged: 0 },
                        samples: { created: ['News'], removed: [], unchanged: [] },
                    },
                },
                reviewError: null,
                isReviewLoading: false,
                replaceConfirm: false,
                isBuilding: false,
                recordApplied: true,
            },
        });
        const controller = new BuildReviewStepController();

        controller.render(ctx, deps);

        expect(ctx.contentEl.querySelector('.setup-preview-error')?.textContent).toContain('Review timed out');
        expect((ctx.contentEl.querySelector('#setup-confirm') as HTMLButtonElement).disabled).toBe(true);
        expect(ctx.contentEl.querySelector('#setup-replace-confirm')).not.toBeNull();
    });
});
