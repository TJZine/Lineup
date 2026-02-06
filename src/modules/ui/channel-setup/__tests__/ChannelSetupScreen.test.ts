/**
 * @jest-environment jsdom
 */

import { ChannelSetupScreen } from '../ChannelSetupScreen';
import type { AppOrchestrator } from '../../../../Orchestrator';
import type { PlexLibrary } from '../../../plex/library/types';

type NavigationStub = {
    focusables: Map<string, { id: string; neighbors: { up?: string; down?: string; left?: string; right?: string } }>;
    registerFocusable: jest.Mock;
    unregisterFocusable: jest.Mock;
    setFocus: jest.Mock;
    getFocusedElement: jest.Mock;
};

const createNavigationStub = (): NavigationStub => {
    const focusables = new Map<string, { id: string; neighbors: { up?: string; down?: string; left?: string; right?: string } }>();
    let focusedId: string | null = null;
    return {
        focusables,
        registerFocusable: jest.fn((focusable: { id: string; neighbors: { up?: string; down?: string; left?: string; right?: string } }) => {
            focusables.set(focusable.id, focusable);
        }),
        unregisterFocusable: jest.fn((id: string) => {
            focusables.delete(id);
        }),
        setFocus: jest.fn((id: string) => {
            focusedId = id;
        }),
        getFocusedElement: jest.fn(() => (focusedId ? ({ id: focusedId } as HTMLElement) : null)),
    };
};

const makeScreen = (): { container: HTMLElement; screen: ChannelSetupScreen } => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const orchestrator = {
        getNavigation: () => null,
    } as unknown as AppOrchestrator;
    const screen = new ChannelSetupScreen(container, orchestrator);
    return { container, screen };
};

const makeScreenWithNav = (): { container: HTMLElement; screen: ChannelSetupScreen; nav: NavigationStub } => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const nav = createNavigationStub();
    const orchestrator = {
        getNavigation: () => nav,
    } as unknown as AppOrchestrator;
    const screen = new ChannelSetupScreen(container, orchestrator);
    return { container, screen, nav };
};

const makeLibrary = (overrides: Partial<PlexLibrary>): PlexLibrary => ({
    id: overrides.id ?? 'lib-1',
    uuid: overrides.uuid ?? 'uuid-1',
    title: overrides.title ?? 'Library',
    type: overrides.type ?? 'movie',
    agent: overrides.agent ?? 'agent',
    scanner: overrides.scanner ?? 'scanner',
    contentCount: overrides.contentCount ?? 0,
    lastScannedAt: overrides.lastScannedAt ?? new Date(0),
    art: overrides.art ?? null,
    thumb: overrides.thumb ?? null,
});

describe('ChannelSetupScreen', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    it('renders a loading placeholder while setup record is not applied', () => {
        const { container, screen } = makeScreen();
        const screenAny = screen as unknown as {
            _recordApplied: boolean;
            _review: unknown;
            _isReviewLoading: boolean;
            _reviewError: string | null;
            _loadReview: jest.Mock;
            _renderBuildReview: () => void;
        };

        screenAny._recordApplied = false;
        screenAny._review = null;
        screenAny._isReviewLoading = false;
        screenAny._reviewError = null;
        screenAny._loadReview = jest.fn().mockResolvedValue(undefined);

        screenAny._renderBuildReview();

        const loading = container.querySelector('.setup-preview-loading') as HTMLElement | null;
        expect(loading?.textContent).toContain('Preparing your review');
        expect(screenAny._loadReview).not.toHaveBeenCalled();
    });

    it('loads review once the setup record is applied', () => {
        const { screen } = makeScreen();
        const screenAny = screen as unknown as {
            _recordApplied: boolean;
            _review: unknown;
            _isReviewLoading: boolean;
            _reviewError: string | null;
            _loadReview: jest.Mock;
            _renderBuildReview: () => void;
        };

        screenAny._recordApplied = true;
        screenAny._review = null;
        screenAny._isReviewLoading = false;
        screenAny._reviewError = null;
        screenAny._loadReview = jest.fn().mockResolvedValue(undefined);

        screenAny._renderBuildReview();

        expect(screenAny._loadReview).toHaveBeenCalled();
    });

    it('renders library meta with formatted content counts', () => {
        const { container, screen } = makeScreen();
        const screenAny = screen as unknown as {
            _libraries: PlexLibrary[];
            _selectedLibraryIds: Set<string>;
            _renderLibraryStep: () => void;
        };

        screenAny._libraries = [
            makeLibrary({ id: 'movies', title: 'Movies', type: 'movie', contentCount: 1234 }),
            makeLibrary({ id: 'shows', title: 'Shows', type: 'show', contentCount: 56 }),
        ];
        screenAny._selectedLibraryIds = new Set(['movies']);

        screenAny._renderLibraryStep();

        const meta = container.querySelector('#setup-lib-movies .setup-toggle-meta') as HTMLElement | null;
        const formattedCount = new Intl.NumberFormat().format(1234);
        expect(meta?.textContent).toContain(`Movies • ${formattedCount} titles`);
    });

    it('renders select-all and clear-all bulk action buttons', () => {
        const { container, screen } = makeScreen();
        const screenAny = screen as unknown as {
            _libraries: PlexLibrary[];
            _selectedLibraryIds: Set<string>;
            _renderLibraryStep: () => void;
        };

        screenAny._libraries = [makeLibrary({ id: 'movies' }), makeLibrary({ id: 'shows', type: 'show' })];
        screenAny._selectedLibraryIds = new Set(['movies']);

        screenAny._renderLibraryStep();

        expect(container.querySelector('#setup-select-all')).not.toBeNull();
        expect(container.querySelector('#setup-clear-all')).not.toBeNull();
    });

    it('applies clear-all and select-all behavior for library tiles', () => {
        const { container, screen } = makeScreen();
        const screenAny = screen as unknown as {
            _libraries: PlexLibrary[];
            _selectedLibraryIds: Set<string>;
            _renderLibraryStep: () => void;
        };

        screenAny._libraries = [makeLibrary({ id: 'movies' }), makeLibrary({ id: 'shows', type: 'show' })];
        screenAny._selectedLibraryIds = new Set(['movies']);

        screenAny._renderLibraryStep();

        const clearAll = container.querySelector('#setup-clear-all') as HTMLButtonElement | null;
        const selectAll = container.querySelector('#setup-select-all') as HTMLButtonElement | null;
        expect(clearAll).not.toBeNull();
        expect(selectAll).not.toBeNull();

        clearAll?.click();
        expect(container.querySelectorAll('.setup-toggle.library-toggle.selected')).toHaveLength(0);
        expect((container.querySelector('#setup-next') as HTMLButtonElement | null)?.disabled).toBe(true);

        (container.querySelector('#setup-select-all') as HTMLButtonElement | null)?.click();
        expect(container.querySelectorAll('.setup-toggle.library-toggle.selected')).toHaveLength(2);
        expect((container.querySelector('#setup-next') as HTMLButtonElement | null)?.disabled).toBe(false);
    });

    it('renders selected library tiles with a checkmark icon', () => {
        const { container, screen } = makeScreen();
        const screenAny = screen as unknown as {
            _libraries: PlexLibrary[];
            _selectedLibraryIds: Set<string>;
            _renderLibraryStep: () => void;
        };

        screenAny._libraries = [makeLibrary({ id: 'movies', title: 'Movies' })];
        screenAny._selectedLibraryIds = new Set(['movies']);

        screenAny._renderLibraryStep();

        const selectedIcon = container.querySelector('#setup-lib-movies .setup-toggle-state-icon');
        expect(selectedIcon).not.toBeNull();
        const srOnlyText = container.querySelector('#setup-lib-movies .setup-toggle-state .sr-only') as HTMLElement | null;
        expect(srOnlyText?.textContent).toBe('Selected');
    });

    it('wires bulk action focus neighbors to each other and the first library tile', () => {
        const { screen, nav } = makeScreenWithNav();
        const screenAny = screen as unknown as {
            _libraries: PlexLibrary[];
            _selectedLibraryIds: Set<string>;
            _renderLibraryStep: () => void;
        };

        screenAny._libraries = [makeLibrary({ id: 'movies' }), makeLibrary({ id: 'shows', type: 'show' })];
        screenAny._selectedLibraryIds = new Set(['movies']);
        screenAny._renderLibraryStep();

        const selectAll = nav.focusables.get('setup-select-all');
        const clearAll = nav.focusables.get('setup-clear-all');
        expect(selectAll?.neighbors.right).toBe('setup-clear-all');
        expect(selectAll?.neighbors.down).toBe('setup-lib-movies');
        expect(clearAll?.neighbors.left).toBe('setup-select-all');
        expect(clearAll?.neighbors.down).toBe('setup-lib-movies');
    });

    it('renders and expires preview deltas in preview rows', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

        const { screen } = makeScreen();
        const screenAny = screen as unknown as {
            _previewDeltas: Partial<Record<string, number>>;
            _previewDeltaExpiresAtMs: number;
            _buildPreviewRow: (label: string, value: number, deltaKey: string) => HTMLElement;
        };

        screenAny._previewDeltas = { total: 5 };
        screenAny._previewDeltaExpiresAtMs = Date.now() + 3000;

        const rowWithDelta = screenAny._buildPreviewRow('Total planned', 45, 'total');
        expect(rowWithDelta.textContent).toContain('(+5)');
        expect(rowWithDelta.querySelector('.setup-preview-delta.positive')).not.toBeNull();

        jest.advanceTimersByTime(3001);
        const rowAfterExpiry = screenAny._buildPreviewRow('Total planned', 45, 'total');
        expect(rowAfterExpiry.querySelector('.setup-preview-delta')).toBeNull();
    });
});
