/**
 * @jest-environment jsdom
 */

import { BuildReviewStepController } from '../BuildReviewStepController';
import type { StepRenderContext } from '../../stepContracts';
import type { BuildReviewDeps } from '../types';

const INTERNAL_SETUP_COPY_PATTERN =
    /\b(?:stop and re-plan|re-plan|planner|execution|cleanup|slice|blocked plan|plan blocked)\b|partial setup plan/i;

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
                        warnings: [
                            'Required studios tag directory (type=4) failed for Movies (Directory must be an array); stop and re-plan.',
                            'Partial setup plan (fetch_playlists): fetch_playlists failed (playlist endpoint failed)',
                        ],
                        reachedMaxChannels: false,
                        status: 'blocked',
                        message: 'Required genres tag directory (type=2) is unsupported for Shows; stop and re-plan.',
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

        const blockedCopy = ctx.contentEl.querySelector('.setup-preview-error')?.textContent ?? '';
        expect(blockedCopy).toContain('Plex does not provide usable genres data for Shows.');
        expect(blockedCopy).toContain('Try again later, disable that source, or continue with supported channel types.');
        expect(blockedCopy).not.toMatch(INTERNAL_SETUP_COPY_PATTERN);
        expect(deps.renderCappedWarnings).toHaveBeenCalledWith(
            [
                'Plex could not read studios data for Movies. Try again later, disable that source, or continue with supported channel types.',
                'Playlists could not be included: playlist endpoint failed. Try again later, disable that source, or continue with supported channel types.',
            ],
            expect.any(HTMLDivElement)
        );
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

        const replaceConfirm = ctx.contentEl.querySelector('#setup-replace-confirm') as HTMLButtonElement;
        expect(replaceConfirm.classList.contains('setup-replace-confirm')).toBe(true);
        expect(replaceConfirm.getAttribute('aria-pressed')).toBe('true');
        expect(replaceConfirm.querySelector('.setup-replace-confirm-state')?.textContent).toBe('Confirmed');

        replaceConfirm.click();
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

    it('renders impact totals, summary chips, and sorted non-total category chips', () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const deps = createDeps({
            state: {
                buildMode: 'replace',
                review: {
                    preview: {
                        estimates: {
                            total: 18,
                            collections: 4,
                            playlists: 0,
                            genres: 9,
                            directors: 0,
                            decades: 2,
                            recentlyAdded: 3,
                            studios: 0,
                            actors: 0,
                        },
                        warnings: [],
                        reachedMaxChannels: false,
                    },
                    diff: {
                        summary: { created: 7, removed: 5, unchanged: 10 },
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

        const counts = Array.from(ctx.contentEl.querySelectorAll('.setup-impact-count')).map((el) => el.textContent);
        expect(counts).toEqual(['15', '17']);
        expect(ctx.contentEl.querySelector('.setup-impact-bar')?.getAttribute('aria-label'))
            .toBe('10 channels staying, 5 leaving, 7 new');
        expect(Array.from(ctx.contentEl.querySelectorAll('.setup-impact-chip')).map((el) => el.textContent))
            .toEqual(['10 stay', '5 leave', '7 new']);
        expect(Array.from(ctx.contentEl.querySelectorAll('.setup-impact-category')).map((el) => el.textContent))
            .toEqual(['Genres · 9', 'Collections · 4', 'Recently Added · 3', 'Decades · 2']);
        expect(ctx.contentEl.textContent).not.toContain('Sample creates');
        expect(ctx.contentEl.textContent).not.toContain('18');
    });

    it('omits zero-valued leave impact for append builds', () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const deps = createDeps({
            state: {
                buildMode: 'append',
                review: {
                    preview: {
                        estimates: {
                            total: 6,
                            collections: 0,
                            playlists: 0,
                            genres: 6,
                            directors: 0,
                            decades: 0,
                            recentlyAdded: 0,
                            studios: 0,
                            actors: 0,
                        },
                        warnings: [],
                        reachedMaxChannels: false,
                    },
                    diff: {
                        summary: { created: 6, removed: 0, unchanged: 12 },
                        samples: { created: ['News'], removed: [], unchanged: ['Kids'] },
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

        expect(ctx.contentEl.querySelector('.setup-impact-leave')).toBeNull();
        expect(ctx.contentEl.querySelector('.setup-impact-leave-chip')).toBeNull();
        expect(Array.from(ctx.contentEl.querySelectorAll('.setup-impact-chip')).map((el) => el.textContent))
            .toEqual(['12 stay', '6 new']);
        expect((ctx.contentEl.querySelector('#setup-confirm') as HTMLButtonElement).textContent).toBe('Confirm & Build');
    });
});
