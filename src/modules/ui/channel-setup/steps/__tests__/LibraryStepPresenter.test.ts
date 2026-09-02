/**
 * @jest-environment jsdom
 */

jest.mock('../../../../../utils/inlineSvg', () => ({
    setTrustedInlineSvg: jest.fn((target: HTMLElement, svg: string) => {
        target.innerHTML = svg;
    }),
}));

import type { INavigationManager } from '../../../../navigation/contracts/interfaces';
import type { ChannelSetupSessionController } from '../../ChannelSetupSessionController';
import type { ChannelSetupSessionSnapshot } from '../../ChannelSetupSessionContracts';
import { ChannelSetupFocusCoordinator } from '../../focus/ChannelSetupFocusCoordinator';
import { createNavigationMock, makeLibrary } from '../../__tests__/channel-setup-test-helpers';
import { LibraryStepPresenter } from '../LibraryStepPresenter';
import type { StepRenderContext } from '../../stepContracts';

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
    replaceConfirm: false,
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
                getSelectedServerId: jest.fn(() => 'server-1'),
                switchToChannelByNumberWithOutcome: jest.fn().mockResolvedValue({ kind: 'switched' }),
                waitForNextPlaybackStart: jest.fn().mockResolvedValue({ kind: 'started' }),
                openEPG: jest.fn(),
                appendBuilderGuideDiagnostic: jest.fn(),
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
        expect(ctx.detailEl.textContent).toBe('Selected 1 of 2.');
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
            .mockReturnValueOnce(createSnapshot(new Set()));
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
        expect(ctx.detailEl.textContent).toBe('Selected 0 of 2.');
        expect((ctx.contentEl.querySelector('#setup-next') as HTMLButtonElement).disabled).toBe(true);
        expect(setPreferredFocusId).toHaveBeenNthCalledWith(1, 'setup-lib-movies');
        expect(setPreferredFocusId).toHaveBeenNthCalledWith(2, null);
        expect(renderStep).not.toHaveBeenCalled();
    });
});
