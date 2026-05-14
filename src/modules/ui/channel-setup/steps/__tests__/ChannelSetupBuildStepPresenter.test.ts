/**
 * @jest-environment jsdom
 */

import { flushPromises } from '../../../../../__tests__/helpers';
import { ChannelSetupBuildStepPresenter } from '../ChannelSetupBuildStepPresenter';
import type { StepRenderContext } from '../types';
import type { ChannelSetupSessionSnapshot } from '../../ChannelSetupSessionContracts';
import { DEFAULT_BUILD_RESULT, DEFAULT_REVIEW } from '../../__tests__/channel-setup-test-helpers';

const INTERNAL_SETUP_COPY_PATTERN =
    /\b(?:stop and re-plan|re-plan|planner|execution|cleanup|slice|blocked plan|plan blocked)\b|partial setup plan/i;

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

type BuildStepPresenterTestDeps = {
    session: {
        getSnapshot: jest.Mock;
        ensureReviewLoaded: jest.Mock;
        clearReviewAndReturnToStep2: jest.Mock;
        beginConfirmedBuild: jest.Mock;
        toggleReplaceConfirm: jest.Mock;
        cancelBuild: jest.Mock;
        setStep: jest.Mock;
        beginBuild: jest.Mock;
    };
    focus: {
        registerLinear: jest.Mock;
        unregisterAll: jest.Mock;
    };
    screenPorts: {
        getNavigation: jest.Mock;
        getSelectedServerId: jest.Mock;
        openServerSelect: jest.Mock;
        switchToChannelByNumber: jest.Mock;
        openEPG: jest.Mock;
    };
    getPreferredFocusId: jest.Mock;
    setPreferredFocusId: jest.Mock;
    getVisibilityToken: jest.Mock;
    renderStep: jest.Mock;
};

const createDeps = (
    snapshot: ChannelSetupSessionSnapshot,
    overrides: Partial<BuildStepPresenterTestDeps['session']> = {}
): BuildStepPresenterTestDeps => {
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

    it('renders blocked build outcomes with user-safe recovery copy', async () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const snapshot = createSnapshot({ isBuilding: true, review: DEFAULT_REVIEW });
        const deps = createDeps(snapshot, {
            beginBuild: jest.fn().mockResolvedValue({
                kind: 'blocked',
                message: 'Required genres tag directory (type=2) is unsupported for Shows; stop and re-plan.',
            }),
        });

        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        const visibleText = [
            ctx.statusEl.textContent,
            ctx.detailEl.textContent,
            ctx.errorEl.textContent,
            ctx.contentEl.textContent,
        ].join('\n');
        expect(visibleText).toContain('Setup needs attention.');
        expect(visibleText).toContain('Build paused');
        expect(visibleText).toContain('Plex does not provide usable genres data for Shows.');
        expect(visibleText).toContain('Try again later, disable that source, or continue with supported channel types.');
        expect(visibleText).not.toMatch(INTERNAL_SETUP_COPY_PATTERN);
        expect((ctx.contentEl.querySelector('#setup-done') as HTMLButtonElement).disabled).toBe(true);
    });

    it('opens player playback and EPG from the completed build Done action', async () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const snapshot = createSnapshot({ isBuilding: true, review: DEFAULT_REVIEW });
        const deps = createDeps(snapshot, {
            beginBuild: jest.fn().mockResolvedValue({
                kind: 'success',
                result: { ...DEFAULT_BUILD_RESULT, created: 2, skipped: 0 },
            }),
        });
        const replaceScreen = jest.fn();
        (deps.screenPorts.getNavigation as jest.Mock).mockReturnValue({
            replaceScreen,
            setFocus: jest.fn(),
        });

        new ChannelSetupBuildStepPresenter().render(ctx, deps as never);
        await flushPromises();

        (ctx.contentEl.querySelector('#setup-done') as HTMLButtonElement).click();
        await flushPromises();

        expect(replaceScreen).toHaveBeenCalledWith('player');
        expect(deps.screenPorts.switchToChannelByNumber).toHaveBeenCalledWith(1);
        expect(deps.screenPorts.openEPG).toHaveBeenCalledTimes(1);
        const switchOrder = deps.screenPorts.switchToChannelByNumber.mock.invocationCallOrder[0];
        const epgOrder = deps.screenPorts.openEPG.mock.invocationCallOrder[0];
        expect(switchOrder).toBeDefined();
        expect(epgOrder).toBeDefined();
        if (switchOrder === undefined || epgOrder === undefined) {
            throw new Error('Expected switch and EPG calls to be recorded');
        }
        expect(switchOrder).toBeLessThan(epgOrder);
    });
});
