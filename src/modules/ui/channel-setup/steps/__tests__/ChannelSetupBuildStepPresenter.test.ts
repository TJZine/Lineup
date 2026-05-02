/**
 * @jest-environment jsdom
 */

import { flushPromises } from '../../../../../__tests__/helpers';
import { ChannelSetupBuildStepPresenter } from '../ChannelSetupBuildStepPresenter';
import type { StepRenderContext } from '../types';
import type { ChannelSetupSessionSnapshot } from '../../ChannelSetupSessionContracts';
import { DEFAULT_BUILD_RESULT, DEFAULT_REVIEW } from '../../__tests__/channel-setup-test-helpers';

const createContext = (): StepRenderContext => ({
    contentEl: document.createElement('div'),
    stepEl: document.createElement('div'),
    statusEl: document.createElement('div'),
    detailEl: document.createElement('div'),
    errorEl: document.createElement('div'),
});

const createSnapshot = (
    overrides: Partial<ChannelSetupSessionSnapshot> = {}
): ChannelSetupSessionSnapshot => ({
    step: 3,
    libraries: [],
    selectedLibraryIds: new Set(),
    strategies: {
        collections: { enabled: true, scope: 'per-library' },
        playlists: { enabled: true, scope: 'per-library' },
        genres: { enabled: true, scope: 'per-library' },
        directors: { enabled: true, scope: 'per-library' },
        decades: { enabled: false, scope: 'per-library' },
        recentlyAdded: { enabled: false, scope: 'per-library' },
        studios: { enabled: false, scope: 'per-library' },
        actors: { enabled: false, scope: 'per-library' },
    },
    strategyOrder: ['collections', 'playlists', 'genres', 'directors', 'decades', 'recentlyAdded', 'studios', 'actors'],
    channelExpansion: {
        addAlternateLineups: false,
        alternateLineupCopies: 1,
        variantType: 'sequential',
        variantBlockSize: 2,
    },
    seriesOrdering: {
        basePlaybackMode: 'shuffle',
        baseBlockSize: 2,
    },
    buildMode: 'replace',
    actorStudioCombineMode: 'combined',
    maxChannels: 200,
    minItems: 5,
    setupContext: 'existing',
    isLoading: false,
    preview: null,
    previewError: null,
    previewStatus: 'idle',
    isPreviewLoading: false,
    previewDeltas: {},
    previewDeltaExpiresAtMs: 0,
    review: null,
    reviewError: null,
    isReviewLoading: false,
    replaceConfirm: false,
    isBuilding: false,
    recordApplied: true,
    loadError: null,
    ...overrides,
});

const createDeps = (snapshot: ChannelSetupSessionSnapshot, overrides: Record<string, unknown> = {}) => {
    const session = {
        getSnapshot: jest.fn(() => snapshot),
        ensureReviewLoaded: jest.fn(),
        clearReviewAndReturnToStep2: jest.fn(),
        beginConfirmedBuild: jest.fn(),
        toggleReplaceConfirm: jest.fn(),
        cancelBuild: jest.fn(() => false),
        setStep: jest.fn(),
        beginBuild: jest.fn().mockResolvedValue({ kind: 'success', result: DEFAULT_BUILD_RESULT }),
        ...overrides,
    };
    return {
        session,
        focus: {
            registerLinear: jest.fn(() => false),
            unregisterAll: jest.fn(),
        },
        screenPorts: {
            getNavigation: jest.fn(() => null),
            getSelectedServerId: jest.fn(() => 'server-1'),
            openServerSelect: jest.fn(),
            switchToChannelByNumber: jest.fn().mockResolvedValue(undefined),
            openEPG: jest.fn(),
        },
        getPreferredFocusId: jest.fn(() => null),
        setPreferredFocusId: jest.fn(),
        getVisibilityToken: jest.fn(() => 1),
        renderStep: jest.fn(),
    };
};

describe('ChannelSetupBuildStepPresenter', () => {
    afterEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('owns preview-row delta rendering for strategy and review presenters', () => {
        const presenter = new ChannelSetupBuildStepPresenter();
        const row = presenter.buildPreviewRow(createSnapshot({
            previewDeltas: { total: 4 },
            previewDeltaExpiresAtMs: Date.now() + 1000,
        }), 'Total', 12, 'total');

        expect(row.className).toBe('setup-preview-row');
        expect(row.querySelector('.setup-preview-delta')?.textContent).toBe('(+4)');
        expect(row.querySelector('.setup-preview-delta')?.classList.contains('positive')).toBe(true);
    });

    it('kicks off review loading after rendering without owning screen lifecycle', async () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const snapshot = createSnapshot();
        const deps = createDeps(snapshot);

        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        expect(ctx.contentEl.querySelector('.setup-preview-loading')?.textContent).toContain('Preparing');
        expect(deps.session.ensureReviewLoaded).toHaveBeenCalledWith(deps.renderStep);
    });

    it('applies progress and success UI through the build presenter owner', async () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const snapshot = createSnapshot({ isBuilding: true, review: DEFAULT_REVIEW });
        const beginBuild = jest.fn(async (options) => {
            options.onProgress({
                task: 'create_channels',
                label: 'Writing channels',
                detail: '1 of 2',
                current: 1,
                total: 2,
            });
            return { kind: 'success', result: { ...DEFAULT_BUILD_RESULT, created: 2, skipped: 1 } };
        });
        const deps = createDeps(snapshot, { beginBuild });

        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        expect(beginBuild).toHaveBeenCalled();
        expect(ctx.statusEl.textContent).toBe('Channels ready.');
        expect(ctx.contentEl.querySelector('.setup-progress-task')?.textContent).toBe('Complete');
        expect(ctx.contentEl.querySelector('.setup-progress-detail')?.textContent).toBe('Created 2 channels. Skipped 1.');
        expect((ctx.contentEl.querySelector('#setup-done') as HTMLButtonElement).disabled).toBe(false);
        expect(deps.focus.unregisterAll).toHaveBeenCalled();
    });
});
