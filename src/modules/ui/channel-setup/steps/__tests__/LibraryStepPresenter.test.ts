/**
 * @jest-environment jsdom
 */

jest.mock('../../../../../utils/inlineSvg', () => ({
    setTrustedInlineSvg: jest.fn((target: HTMLElement, svg: string) => {
        target.innerHTML = svg;
    }),
}));

import type { INavigationManager } from '../../../../navigation/contracts/interfaces';
import { ChannelSetupSessionController } from '../../ChannelSetupSessionController';
import type { ChannelSetupSessionSnapshot } from '../../ChannelSetupSessionContracts';
import { ChannelSetupFocusCoordinator } from '../../focus/ChannelSetupFocusCoordinator';
import { createNavigationMock, createScreenPorts, createWorkflowPort, makeLibrary } from '../../__tests__/channel-setup-test-helpers';
import { LibraryStepPresenter } from '../LibraryStepPresenter';
import type { StepRenderContext } from '../../stepContracts';
import { ChannelSetupPlanningService } from '../../../../../core/channel-setup/planning/ChannelSetupPlanningService';
import { ChannelSetupBuildExecutor } from '../../../../../core/channel-setup/build/ChannelSetupBuildExecutor';
import type { ChannelSetupBuildCommitter } from '../../../../../core/channel-setup/build/ChannelSetupBuildCommitter';
import { createMockPlexLibrary, createFacetPlanningTag } from '../../../../../core/channel-setup/__tests__/ChannelSetupFacetPlanningTestHelpers';
import type { IChannelManager } from '../../../../scheduler/channel-manager';

const createContext = (): StepRenderContext => ({
    contentEl: document.createElement('div'),
    stepEl: document.createElement('div'),
    statusEl: document.createElement('div'),
    detailEl: document.createElement('div'),
    errorEl: document.createElement('div'),
});

const createSnapshot = (selectedLibraryIds = new Set(['movies'])): ChannelSetupSessionSnapshot => ({
    step: 1,
    libraries: [
        makeLibrary({ id: 'movies', title: 'Movies', contentCount: 1200 }),
        makeLibrary({ id: 'shows', title: 'Shows', type: 'show', contentCount: 50, episodeCount: 400 }),
    ],
    selectedLibraryIds,
    inventory: null, isInventoryLoading: false, inventoryError: null,
    acceptedReadyLibraryIds: new Set(), confirmedDeselectedLibraryIds: new Set(), knownReadyLibraryIds: new Set(),
    loadError: null,
    strategies: {} as ChannelSetupSessionSnapshot['strategies'],
    strategyOrder: [],
    channelExpansion: {} as ChannelSetupSessionSnapshot['channelExpansion'],
    seriesOrdering: {} as ChannelSetupSessionSnapshot['seriesOrdering'],
    buildMode: 'replace',
    actorStudioCombineMode: 'separate',
    maxChannels: 200,
    minItems: 1,
    isLoading: false,
    isBuilding: false,
    isPreviewLoading: false,
    isReviewLoading: false,
    replaceConfirm: false, replaceConfirmReviewId: null,
    wholeLineupReplacementConfirm: false, wholeLineupReplacementConfirmReviewId: null,
    preview: null,
    previewError: null,
    previewStatus: 'idle',
    review: null,
    reviewError: null,
    previewDeltas: {},
    previewDeltaExpiresAtMs: 0,
    recordApplied: false,
    setupContext: 'unknown',
});

const createPresenter = (
    ctx: StepRenderContext,
    overrides: {
        nav?: ReturnType<typeof createNavigationMock>;
        snapshot?: ChannelSetupSessionSnapshot;
        getSnapshot?: jest.Mock;
        setPreferredFocusId?: jest.Mock;
        renderStep?: jest.Mock;
    } = {}
): {
    presenter: LibraryStepPresenter;
    session: {
        clearAllLibraries: jest.Mock;
        getSnapshot: jest.Mock;
        selectAllLibraries: jest.Mock;
        setStep: jest.Mock;
        toggleLibrary: jest.Mock;
        scanInventory: jest.Mock; retryInventory: jest.Mock;
        acceptReadySubset: jest.Mock; confirmDeselectedLibraries: jest.Mock; cancelInventory: jest.Mock;
    };
    renderStep: jest.Mock;
    setPreferredFocusId: jest.Mock;
    nav: ReturnType<typeof createNavigationMock>;
} => {
    const nav = overrides.nav ?? createNavigationMock();
    const snapshot = overrides.snapshot ?? createSnapshot();
    const getSnapshot = overrides.getSnapshot ?? jest.fn(() => snapshot);
    const session = {
        clearAllLibraries: jest.fn(),
        getSnapshot,
        selectAllLibraries: jest.fn(),
        setStep: jest.fn(),
        toggleLibrary: jest.fn((_libraryId: string) => false),
        scanInventory: jest.fn().mockResolvedValue(undefined), retryInventory: jest.fn().mockResolvedValue(undefined),
        acceptReadySubset: jest.fn(() => true), confirmDeselectedLibraries: jest.fn(), cancelInventory: jest.fn(),
    };
    const focus = new ChannelSetupFocusCoordinator({
        getNavigation: (): INavigationManager => nav as unknown as INavigationManager,
    });
    const setPreferredFocusId = overrides.setPreferredFocusId ?? jest.fn();
    const renderStep = overrides.renderStep ?? jest.fn();

    return {
        presenter: new LibraryStepPresenter({
            session: session as unknown as ChannelSetupSessionController,
            focus,
            screenPorts: {
                getNavigation: () => nav as unknown as INavigationManager,
                openServerSelect: jest.fn(),
                goBackFromLibraries: jest.fn(),
                openCustomChannelStudio: jest.fn(),
                getSelectedServerId: jest.fn(() => 'server-1'),
            },
            contentEl: ctx.contentEl,
            getPreferredFocusId: jest.fn(() => null),
            setPreferredFocusId,
            renderStep,
        }),
        session,
        renderStep,
        setPreferredFocusId,
        nav,
    };
};

describe('LibraryStepPresenter', () => {
    afterEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('renders Step 1 through stable DOM ids, selected count, icons, and bulk focus neighbors', () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const { presenter, nav } = createPresenter(ctx);

        presenter.render(ctx);

        expect(ctx.stepEl.textContent).toBe('Step 1 of 3');
        expect(ctx.detailEl.textContent).toBe('Selected 1 of 2. 0 ready for Review.');
        expect(ctx.contentEl.querySelector('#setup-select-all')).not.toBeNull();
        expect(ctx.contentEl.querySelector('#setup-clear-all')).not.toBeNull();
        expect(ctx.contentEl.querySelector('#setup-lib-movies .setup-toggle-icon svg')).not.toBeNull();
        expect(ctx.contentEl.querySelector('#setup-lib-shows .setup-toggle-icon svg')).not.toBeNull();
        expect(nav.focusables.get('setup-select-all')?.neighbors).toMatchObject({
            right: 'setup-clear-all',
            down: 'setup-lib-movies',
        });
        expect(nav.focusables.get('setup-clear-all')?.neighbors).toMatchObject({
            left: 'setup-select-all',
            down: 'setup-lib-movies',
        });
    });

    it('keeps the library type label when counts are unknown without rendering bogus counts', () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const snapshot = createSnapshot(new Set(['movies']));
        snapshot.libraries = [
            makeLibrary({ id: 'movies', title: 'Movies', type: 'movie', contentCount: null }),
            makeLibrary({ id: 'shows', title: 'Shows', type: 'show', contentCount: null }),
        ];
        const { presenter } = createPresenter(ctx, { snapshot });

        presenter.render(ctx);

        expect(ctx.contentEl.querySelector('#setup-lib-movies .setup-toggle-meta')?.textContent).toBe('Movies');
        expect(ctx.contentEl.querySelector('#setup-lib-shows .setup-toggle-meta')?.textContent).toBe('Shows');
        expect(ctx.contentEl.querySelectorAll('.setup-toggle-count')).toHaveLength(0);
    });

    it('updates a library toggle in place and refreshes selected detail plus next disabled state', () => {
        const ctx = createContext();
        document.body.appendChild(ctx.contentEl);
        const getSnapshot = jest.fn()
            .mockReturnValueOnce(createSnapshot(new Set(['movies'])))
            .mockReturnValue(createSnapshot(new Set()));
        const { presenter, session, renderStep, setPreferredFocusId } = createPresenter(ctx, {
            getSnapshot,
        });

        presenter.render(ctx);
        const before = ctx.contentEl.querySelector('#setup-lib-movies') as HTMLButtonElement;
        before.click();

        const after = ctx.contentEl.querySelector('#setup-lib-movies') as HTMLButtonElement;
        expect(after).toBe(before);
        expect(session.toggleLibrary).toHaveBeenCalledWith('movies');
        expect(after.getAttribute('aria-pressed')).toBe('false');
        expect(ctx.detailEl.textContent).toBe('Selected 0 of 2. 0 ready for Review.');
        expect((ctx.contentEl.querySelector('#setup-next') as HTMLButtonElement).disabled).toBe(true);
        expect(setPreferredFocusId).toHaveBeenNthCalledWith(1, 'setup-lib-movies');
        expect(setPreferredFocusId).toHaveBeenNthCalledWith(2, null);
        expect(renderStep).not.toHaveBeenCalled();
    });

    it('enables Configure when the first library is selected without a scan', () => {
        const ctx = createContext();
        const snapshot = createSnapshot(new Set());
        const { presenter, session, renderStep } = createPresenter(ctx, { snapshot });
        session.toggleLibrary.mockImplementation(libraryId => {
            snapshot.selectedLibraryIds.add(libraryId);
            return true;
        });
        presenter.render(ctx);
        expect(ctx.contentEl.querySelector<HTMLButtonElement>('#setup-next')?.disabled).toBe(true);

        ctx.contentEl.querySelector<HTMLButtonElement>('#setup-lib-movies')?.click();

        expect(ctx.contentEl.querySelector<HTMLButtonElement>('#setup-next')?.disabled).toBe(false);
        expect(renderStep).not.toHaveBeenCalled();
    });

    it('recovers from an optional facet failure through Configure while incomplete Review remains blocked', async () => {
        const libraries = [makeLibrary({ id: 'movies', title: 'Movies', contentCount: 10 })];
        const tags = [createFacetPlanningTag({ count: 10 })];
        const plexLibrary = createMockPlexLibrary({
            getLibraries: jest.fn().mockResolvedValue(libraries),
            getPlaylists: jest.fn().mockResolvedValue([]),
            getCollections: jest.fn().mockResolvedValue([]),
            getGenres: jest.fn().mockResolvedValue(tags),
            getDirectors: jest.fn().mockResolvedValue(tags),
            getYears: jest.fn().mockResolvedValue([createFacetPlanningTag({ key: '2020', title: '2020', count: 10 })]),
            getStudios: jest.fn().mockResolvedValue(tags),
            getActors: jest.fn(async (_libraryId, options) => {
                options?.onUnsupported?.('empty');
                return [];
            }),
        });
        const manager = { getAllChannels: jest.fn(() => []),
            getStructuralBase: jest.fn(() => ({ generation: 1, revision: 0 })),
            getLastLoadOutcome: jest.fn(() => ({ kind: 'valid-empty', generation: 1, revision: 0, channelCount: 0 })),
        } as unknown as IChannelManager;
        const planning = new ChannelSetupPlanningService({ plexLibrary, channelManager: manager });
        const commitPreparedCandidate = jest.fn();
        const executor = new ChannelSetupBuildExecutor({ channelManager: manager, planningService: planning,
            buildCommitter: { commitPreparedCandidate } as unknown as ChannelSetupBuildCommitter });
        const workflowPort = createWorkflowPort({
            getLibrariesForSetup: () => planning.getLibrariesForSetup(),
            scanSetupInventory: (config, options) => planning.scanSetupInventory(config, options),
            getSetupReview: (config, options) => executor.prepareSetupReview(config, options),
            cancelPreparedReview: () => executor.cancelPreparedReview(),
            invalidateSessionData: () => planning.invalidateSessionData(),
        });
        const session = new ChannelSetupSessionController({ workflowPort, getSelectedServerId: (): string => 'server-1' });
        const ctx = createContext();
        const presenter = new LibraryStepPresenter({ session,
            focus: new ChannelSetupFocusCoordinator({ getNavigation: (): INavigationManager | null => null }),
            screenPorts: createScreenPorts(), contentEl: ctx.contentEl,
            getPreferredFocusId: (): string | null => null, setPreferredFocusId: jest.fn(), renderStep: jest.fn(),
        });
        session.beginSession();
        try {
            await session.loadLibraries();
            await session.scanInventory(jest.fn());
            expect(session.getSnapshot().inventory?.libraries[0]?.status).toBe('failed');
            presenter.render(ctx);
            ctx.contentEl.querySelector<HTMLButtonElement>('#setup-next')?.click();
            expect(session.getSnapshot().step).toBe(2);

            session.setStep(3);
            await session.ensureReviewLoaded(jest.fn());
            expect(session.getSnapshot().review?.preview.status).toBe('blocked');
            expect(session.getSnapshot().review?.preparedId).toBeUndefined();
            expect(commitPreparedCandidate).not.toHaveBeenCalled();

            session.clearReviewAndReturnToStep2();
            session.updateStrategyState(draft => { draft.strategies.actors.enabled = false; });
            expect(session.getSnapshot().inventory).toBeNull();
            await session.scanInventory(jest.fn());
            expect(session.getSnapshot().inventory?.acceptedReadyLibraryIds).toEqual(['movies']);
            session.setStep(3);
            await session.ensureReviewLoaded(jest.fn());
            expect(session.getSnapshot().review?.preview.status).toBe('ready');
            expect(session.getSnapshot().review?.preparedId).toBeDefined();
        } finally {
            session.endSession();
        }
    });
});
