/**
 * @jest-environment jsdom
 */

import { ChannelSetupScreen } from '../ChannelSetupScreen';
import type { ChannelSetupOrchestrator } from '../ChannelSetupScreen';
import type { PlexLibrary } from '../../../plex/library/types';
import type { INavigationManager, KeyEvent } from '../../../navigation/interfaces';
import type { FocusableElement } from '../../../navigation/interfaces';

import { flushPromises } from '../../../../__tests__/helpers';

type Focusable = Pick<FocusableElement, 'id' | 'neighbors'>;

type NavigationMock = {
    focusables: Map<string, Focusable>;
    registerFocusable: jest.Mock;
    unregisterFocusable: jest.Mock;
    setFocus: jest.Mock;
    getFocusedElement: jest.Mock;
    on: jest.Mock;
    off: jest.Mock;
    emitKeyPress: (button: KeyEvent['button']) => KeyEvent;
    setMockFocus: (id: string | null) => void;
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

const DEFAULT_PREVIEW = {
    estimates: {
        total: 0,
        collections: 0,
        libraryFallback: 0,
        playlists: 0,
        genres: 0,
        directors: 0,
        decades: 0,
        recentlyAdded: 0,
        studios: 0,
        actors: 0,
    },
    warnings: [],
    reachedMaxChannels: false,
};

const DEFAULT_REVIEW = {
    preview: DEFAULT_PREVIEW,
    diff: {
        summary: {
            created: 0,
            removed: 0,
            unchanged: 0,
        },
        samples: {
            created: [],
            removed: [],
            unchanged: [],
        },
    },
};

const DEFAULT_BUILD_RESULT = {
    created: 1,
    skipped: 0,
    reachedMaxChannels: false,
    errorCount: 0,
    canceled: false,
    lastTask: 'done',
};

const createNavigationMock = (): NavigationMock => {
    const focusables = new Map<string, Focusable>();
    let focusedId: string | null = null;
    let keyPressHandler: ((event: KeyEvent) => void) | null = null;

    return {
        focusables,
        registerFocusable: jest.fn((focusable: Focusable) => {
            focusables.set(focusable.id, focusable);
        }),
        unregisterFocusable: jest.fn((id: string) => {
            focusables.delete(id);
        }),
        setFocus: jest.fn((id: string) => {
            focusedId = id;
        }),
        getFocusedElement: jest.fn(() => (focusedId ? ({ id: focusedId } as HTMLElement) : null)),
        on: jest.fn((event: string, handler: (payload: KeyEvent) => void) => {
            if (event === 'keyPress') {
                keyPressHandler = handler;
            }
        }),
        off: jest.fn((event: string, handler: (payload: KeyEvent) => void) => {
            if (event === 'keyPress' && keyPressHandler === handler) {
                keyPressHandler = null;
            }
        }),
        emitKeyPress: (button: KeyEvent['button']): KeyEvent => {
            const event: KeyEvent = {
                button,
                isRepeat: false,
                isLongPress: false,
                timestamp: Date.now(),
                originalEvent: new KeyboardEvent('keydown'),
            };
            keyPressHandler?.(event);
            return event;
        },
        setMockFocus: (id: string | null): void => {
            focusedId = id;
        },
    };
};

const createOrchestrator = (
    overrides: Partial<ChannelSetupOrchestrator> = {}
): ChannelSetupOrchestrator => ({
    getNavigation: jest.fn(() => null),
    getLibrariesForSetup: jest.fn().mockResolvedValue([]),
    getChannelSetupRecord: jest.fn(() => null),
    getSetupContextForSelectedServer: jest.fn(() => 'unknown'),
    getSelectedServerStorageKey: jest.fn(() => 'retune-selected-server-id'),
    getSelectedServerId: jest.fn(() => null),
    openServerSelect: jest.fn(),
    switchToChannelByNumber: jest.fn(),
    openEPG: jest.fn(),
    createChannelsFromSetup: jest.fn().mockResolvedValue(DEFAULT_BUILD_RESULT),
    markSetupComplete: jest.fn(),
    getSetupPreview: jest.fn().mockResolvedValue(DEFAULT_PREVIEW),
    getSetupReview: jest.fn().mockResolvedValue(DEFAULT_REVIEW),
    ...overrides,
} satisfies ChannelSetupOrchestrator);

// Intentionally button-only to enforce accessible remote-first UI semantics.
const clickButton = (container: HTMLElement, selector: string): void => {
    const element = container.querySelector(selector);
    if (!(element instanceof HTMLButtonElement)) {
        throw new Error(`Button not found: ${selector}`);
    }
    element.click();
};

const enterStep2 = async (container: HTMLElement): Promise<void> => {
    clickButton(container, '#setup-next');
    await flushPromises();
};

describe('ChannelSetupScreen', () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
        document.body.innerHTML = '';
    });

    it('shows loading state while libraries are in flight', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        let resolveLibraries: (libraries: PlexLibrary[]) => void = () => undefined;
        const librariesPromise = new Promise<PlexLibrary[]>((resolve) => {
            resolveLibraries = resolve;
        });

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn(() => librariesPromise),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();

        expect(container.textContent ?? '').toContain('Loading libraries');

        resolveLibraries([makeLibrary({ id: 'movies', title: 'Movies', contentCount: 1200 })]);
        await flushPromises();

        expect(container.textContent ?? '').not.toContain('Loading libraries');
        expect(container.querySelector('#setup-lib-movies')).not.toBeNull();
    });

    it('renders bulk actions and formatted library metadata', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([
                makeLibrary({ id: 'movies', title: 'Movies', contentCount: 1234 }),
                makeLibrary({ id: 'shows', title: 'Shows', type: 'show', contentCount: 56 }),
            ]),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();

        expect(container.querySelector('#setup-select-all')).not.toBeNull();
        expect(container.querySelector('#setup-clear-all')).not.toBeNull();

        const meta = container.querySelector('#setup-lib-movies .setup-toggle-meta');
        const formattedCount = new Intl.NumberFormat().format(1234);
        expect(meta?.textContent ?? '').toContain(`Movies • ${formattedCount} titles`);
    });

    it('supports clear-all and select-all toggles', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([
                makeLibrary({ id: 'movies' }),
                makeLibrary({ id: 'shows', type: 'show' }),
            ]),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();

        clickButton(container, '#setup-clear-all');
        expect(container.querySelectorAll('.setup-toggle.library-toggle.selected')).toHaveLength(0);
        expect((container.querySelector('#setup-next') as HTMLButtonElement | null)?.disabled).toBe(true);

        clickButton(container, '#setup-select-all');
        expect(container.querySelectorAll('.setup-toggle.library-toggle.selected')).toHaveLength(2);
        expect((container.querySelector('#setup-next') as HTMLButtonElement | null)?.disabled).toBe(false);
    });

    it('wires bulk-action focus neighbors to each other and first tile', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationMock();
        const orchestrator = createOrchestrator({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([
                makeLibrary({ id: 'movies' }),
                makeLibrary({ id: 'shows', type: 'show' }),
            ]),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();

        const selectAll = nav.focusables.get('setup-select-all');
        const clearAll = nav.focusables.get('setup-clear-all');

        expect(selectAll?.neighbors.right).toBe('setup-clear-all');
        expect(selectAll?.neighbors.down).toBe('setup-lib-movies');
        expect(clearAll?.neighbors.left).toBe('setup-select-all');
        expect(clearAll?.neighbors.down).toBe('setup-lib-movies');
    });

    it('renders Step 2 category rail in fixed order', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        const categoryRail = container.querySelector('.setup-category-rail');
        expect(categoryRail?.classList.contains('setup-focus-safe-scroll')).toBe(true);

        const labels = Array.from(container.querySelectorAll('.setup-category-rail button'))
            .map((button) => button.textContent?.trim());

        expect(labels).toEqual([
            'Content Sources',
            'Advanced Sources',
            'Build Options',
            'Limits',
        ]);
    });

    it('renders only controls for the active Step 2 category', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        expect(container.querySelector('#setup-strategy-collections')).not.toBeNull();
        expect(container.querySelector('#setup-build-mode')).toBeNull();

        clickButton(container, '#setup-category-build-options');
        expect(container.querySelector('#setup-build-mode')).not.toBeNull();
        expect(container.querySelector('#setup-strategy-collections')).toBeNull();
    });

    it('registers Step 2 focusables in deterministic category-detail-footer order', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationMock();
        const orchestrator = createOrchestrator({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        expect(nav.focusables.get('setup-category-content-sources')?.neighbors.down).toBe('setup-category-advanced-sources');
        expect(nav.focusables.get('setup-category-advanced-sources')?.neighbors.down).toBe('setup-category-build-options');
        expect(nav.focusables.get('setup-category-build-options')?.neighbors.down).toBe('setup-category-limits');
        expect(nav.focusables.get('setup-category-limits')?.neighbors.down).toBe('setup-strategy-collections');
        expect(nav.focusables.get('setup-strategy-recentlyAdded')?.neighbors.down).toBe('setup-back');
        expect(nav.focusables.get('setup-back')?.neighbors.down).toBe('setup-next');
        expect(nav.focusables.get('setup-next')?.neighbors.up).toBe('setup-back');
    });

    it('handles category-to-detail right transfer and remembers last focused control per category', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationMock();
        const orchestrator = createOrchestrator({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        nav.setMockFocus('setup-category-content-sources');
        const firstTransfer = nav.emitKeyPress('right');
        expect(firstTransfer.handled).toBe(true);
        expect(nav.setFocus).toHaveBeenLastCalledWith('setup-strategy-collections');

        clickButton(container, '#setup-strategy-playlists');
        clickButton(container, '#setup-category-build-options');
        clickButton(container, '#setup-category-content-sources');

        nav.setMockFocus('setup-category-content-sources');
        const rememberedTransfer = nav.emitKeyPress('right');
        expect(rememberedTransfer.handled).toBe(true);
        expect(nav.setFocus).toHaveBeenLastCalledWith('setup-strategy-playlists');
    });

    it('moves left from non-adjustable detail controls back to active category', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationMock();
        const orchestrator = createOrchestrator({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        nav.setMockFocus('setup-strategy-collections');
        const event = nav.emitKeyPress('left');
        expect(event.handled).toBe(true);
        expect(nav.setFocus).toHaveBeenLastCalledWith('setup-category-content-sources');
    });

    it('moves left from adjustable controls to category when value is already at clamp minimum', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationMock();
        const orchestrator = createOrchestrator({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        clickButton(container, '#setup-category-limits');

        nav.setMockFocus('setup-min-items');
        nav.emitKeyPress('left'); // 10 -> 5
        nav.setMockFocus('setup-min-items');
        nav.emitKeyPress('left'); // 5 -> 1
        nav.setMockFocus('setup-min-items');
        const event = nav.emitKeyPress('left'); // 1 -> clamp + transfer

        expect(event.handled).toBe(true);
        expect(nav.setFocus).toHaveBeenLastCalledWith('setup-category-limits');
    });

    it('uses Build Channels fast-path for first-time setup without loading review', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const createChannelsFromSetup = jest.fn().mockResolvedValue(DEFAULT_BUILD_RESULT);
        const getSetupReview = jest.fn().mockResolvedValue(DEFAULT_REVIEW);
        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSetupContextForSelectedServer: jest.fn(() => 'first-time'),
            createChannelsFromSetup,
            getSetupReview,
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        const nextButton = container.querySelector('#setup-next') as HTMLButtonElement | null;
        expect(nextButton?.textContent).toBe('Build Channels');

        clickButton(container, '#setup-next');
        expect(container.textContent ?? '').toContain('Building channels');
        await flushPromises();

        expect(createChannelsFromSetup).toHaveBeenCalledTimes(1);
        expect(getSetupReview).not.toHaveBeenCalled();
    });

    it('uses Review route for existing setup context', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const getSetupReview = jest.fn().mockResolvedValue(DEFAULT_REVIEW);
        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSetupContextForSelectedServer: jest.fn(() => 'existing'),
            getSetupReview,
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        const nextButton = container.querySelector('#setup-next') as HTMLButtonElement | null;
        expect(nextButton?.textContent).toBe('Review');

        clickButton(container, '#setup-next');
        await flushPromises();
        await flushPromises();

        expect(container.textContent ?? '').toContain('Review changes before building');
        expect(getSetupReview).toHaveBeenCalledTimes(1);
    });

    it('uses Review route for unknown setup context', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSetupContextForSelectedServer: jest.fn(() => 'unknown'),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        const nextButton = container.querySelector('#setup-next') as HTMLButtonElement | null;
        expect(nextButton?.textContent).toBe('Review');
    });

    it('keeps build progress stable when a delayed preview resolves after fast-path transition', async () => {
        jest.useFakeTimers();
        const container = document.createElement('div');
        document.body.appendChild(container);

        let resolvePreview: ((value: typeof DEFAULT_PREVIEW | PromiseLike<typeof DEFAULT_PREVIEW>) => void) | undefined;
        const getSetupPreview = jest.fn().mockImplementation(() => new Promise<typeof DEFAULT_PREVIEW>((resolve) => {
            resolvePreview = resolve;
        }));
        let resolveBuild: ((value: typeof DEFAULT_BUILD_RESULT | PromiseLike<typeof DEFAULT_BUILD_RESULT>) => void) | undefined;
        const createChannelsFromSetup = jest.fn().mockImplementation(() => new Promise<typeof DEFAULT_BUILD_RESULT>((resolve) => {
            resolveBuild = resolve;
        }));

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSetupContextForSelectedServer: jest.fn(() => 'first-time'),
            getSetupPreview,
            createChannelsFromSetup,
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        jest.advanceTimersByTime(450);
        await flushPromises();
        expect(getSetupPreview).toHaveBeenCalledTimes(1);

        clickButton(container, '#setup-next');
        await flushPromises();
        expect(container.textContent ?? '').toContain('Building channels');

        if (!resolvePreview) {
            throw new Error('Expected preview resolver to be set');
        }
        resolvePreview(DEFAULT_PREVIEW);
        await flushPromises();

        expect(container.textContent ?? '').toContain('Building channels');
        expect(createChannelsFromSetup).toHaveBeenCalledTimes(1);

        if (!resolveBuild) {
            throw new Error('Expected build resolver to be set');
        }
        resolveBuild(DEFAULT_BUILD_RESULT);
        await flushPromises();
    });
});
