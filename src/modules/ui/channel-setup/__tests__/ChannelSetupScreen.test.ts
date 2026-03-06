/**
 * @jest-environment jsdom
 */

import { ChannelSetupScreen } from '../ChannelSetupScreen';
import type { PlexLibrary } from '../../../plex/library/types';
import type { INavigationManager } from '../../../navigation/interfaces';
import { MAX_CHANNELS } from '../../../scheduler/channel-manager/constants';
import { DEFAULT_MIN_ITEMS_PER_CHANNEL, SETUP_STRATEGY_KEYS } from '../../../../core/channel-setup/constants';

import { flushPromises } from '../../../../__tests__/helpers';
import {
    clickButton,
    createNavigationMock,
    createOrchestrator,
    DEFAULT_BUILD_RESULT,
    DEFAULT_PREVIEW,
    DEFAULT_REVIEW,
    makeLibrary,
} from './channel-setup-test-helpers';

const enterStep2 = async (container: HTMLElement): Promise<void> => {
    const next = container.querySelector('#setup-next');
    if (!(next instanceof HTMLButtonElement)) {
        throw new Error('Next button not found');
    }
    if (next.disabled) {
        throw new Error('Expected Next button to be enabled before entering Step 2');
    }
    next.click();
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

    it('shows library-load failure state when libraries cannot be fetched', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockRejectedValue(new Error('library load failed')),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();

        expect(container.textContent ?? '').toContain('Library load failed.');
        expect(container.textContent ?? '').toContain('library load failed');
        expect(container.querySelector('#setup-next')).toBeNull();
    });

    it('renders bulk actions and formatted library metadata', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([
                makeLibrary({ id: 'movies', title: 'Movies', contentCount: 1234 }),
                makeLibrary({ id: 'shows', title: 'Shows', type: 'show', contentCount: 56, episodeCount: 999 }),
            ]),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();

        expect(container.querySelector('#setup-select-all')).not.toBeNull();
        expect(container.querySelector('#setup-clear-all')).not.toBeNull();

        const formattedMovieCount = new Intl.NumberFormat().format(1234);
        const formattedShowCount = new Intl.NumberFormat().format(56);
        const formattedEpisodeCount = new Intl.NumberFormat().format(999);

        const moviesMeta = container.querySelector('#setup-lib-movies .setup-toggle-meta');
        expect(moviesMeta?.textContent ?? '').toContain(`Movies • ${formattedMovieCount} movies`);

        const showsMeta = container.querySelector('#setup-lib-shows .setup-toggle-meta');
        expect(showsMeta?.textContent ?? '').toContain(
            `Shows • ${formattedShowCount} series • ${formattedEpisodeCount} episodes`
        );
    });

    it('applies stagger class and delay to library cards', async () => {
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

        const first = container.querySelector('#setup-lib-movies') as HTMLButtonElement | null;
        const second = container.querySelector('#setup-lib-shows') as HTMLButtonElement | null;
        expect(first?.classList.contains('setup-stagger-in')).toBe(true);
        expect(second?.classList.contains('setup-stagger-in')).toBe(true);
        expect(second?.style.animationDelay).toBe('50ms');
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

    it('updates library toggle in place without replacing the button node', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([
                makeLibrary({ id: 'movies' }),
            ]),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();

        const before = container.querySelector('#setup-lib-movies') as HTMLButtonElement | null;
        expect(before).not.toBeNull();
        expect(before?.getAttribute('aria-pressed')).toBe('true');

        clickButton(container, '#setup-lib-movies');

        const after = container.querySelector('#setup-lib-movies') as HTMLButtonElement | null;
        expect(after).toBe(before);
        expect(after?.getAttribute('aria-pressed')).toBe('false');
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

    it('cleans up keyPress handlers and focus registrations across show/hide/destroy cycles', async () => {
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

        expect(nav.on).toHaveBeenCalledTimes(1);
        expect(nav.focusables.size).toBeGreaterThan(0);

        screen.hide();
        expect(nav.off).toHaveBeenCalledTimes(1);
        expect(nav.focusables.size).toBe(0);
        const unregisterCallsAfterHide = nav.unregisterFocusable.mock.calls.length;
        expect(unregisterCallsAfterHide).toBeGreaterThan(0);

        screen.show();
        await flushPromises();
        expect(nav.on).toHaveBeenCalledTimes(2);
        expect(nav.focusables.size).toBeGreaterThan(0);

        screen.destroy();
        expect(nav.off).toHaveBeenCalledTimes(2);
        expect(nav.focusables.size).toBe(0);
        expect(nav.unregisterFocusable.mock.calls.length).toBeGreaterThan(unregisterCallsAfterHide);
    });

    it('does not re-register focusables if library loading settles after hide', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        let resolveLibraries: ((libraries: PlexLibrary[]) => void) | undefined;
        const librariesPromise = new Promise<PlexLibrary[]>((resolve) => {
            resolveLibraries = resolve;
        });

        const nav = createNavigationMock();
        const orchestrator = createOrchestrator({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn(() => librariesPromise),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        screen.hide();

        if (!resolveLibraries) {
            throw new Error('Expected library resolver to be set');
        }
        resolveLibraries([makeLibrary({ id: 'movies' })]);
        await flushPromises();

        expect(nav.focusables.size).toBe(0);
        expect(container.style.display).toBe('none');
    });

    it('does not re-render or re-register focusables when library loading resolves after hide', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        let resolveLibraries: ((libraries: PlexLibrary[]) => void) | undefined;
        const librariesPromise = new Promise<PlexLibrary[]>((resolve) => {
            resolveLibraries = resolve;
        });

        const nav = createNavigationMock();
        const orchestrator = createOrchestrator({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn(() => librariesPromise),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        screen.hide();

        if (!resolveLibraries) {
            throw new Error('Expected library resolver to be set');
        }
        resolveLibraries([makeLibrary({ id: 'movies' })]);
        await flushPromises();

        expect(container.style.display).toBe('none');
        expect(nav.focusables.size).toBe(0);
        expect(container.querySelector('#setup-lib-movies')).toBeNull();
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
            'Series Ordering',
            'Limits',
            'Priority Order',
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
        expect(nav.focusables.get('setup-category-build-options')?.neighbors.down).toBe('setup-category-series-ordering');
        expect(nav.focusables.get('setup-category-series-ordering')?.neighbors.down).toBe('setup-category-limits');
        expect(nav.focusables.get('setup-category-limits')?.neighbors.down).toBe('setup-category-priority-order');
        expect(nav.focusables.get('setup-category-priority-order')?.neighbors.down).toBe('setup-strategy-collections');
        expect(nav.focusables.get('setup-strategy-recentlyAdded')?.neighbors.down).toBe('setup-preview-toggle');
        expect(nav.focusables.get('setup-preview-toggle')?.neighbors.down).toBe('setup-back');
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

    it('right transfer activates the focused category before moving to detail controls', async () => {
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

        expect(container.querySelector('#setup-build-mode')).toBeNull();

        nav.setMockFocus('setup-category-build-options');
        const transfer = nav.emitKeyPress('right');
        expect(transfer.handled).toBe(true);
        expect(container.querySelector('#setup-build-mode')).not.toBeNull();
        expect(nav.setFocus).toHaveBeenLastCalledWith('setup-build-mode');
    });

    it('right transfer skips remembered disabled detail controls', async () => {
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

        clickButton(container, '#setup-category-series-ordering');

        // Enter block mode so base block size is enabled, then click it to remember focus.
        clickButton(container, '#setup-series-base-mode'); // shuffle -> sequential
        clickButton(container, '#setup-series-base-mode'); // sequential -> block
        clickButton(container, '#setup-series-base-block-size'); // remembers this control for the category

        // Switch away from block mode; block size control becomes disabled.
        clickButton(container, '#setup-series-base-mode'); // block -> shuffle

        nav.setMockFocus('setup-category-series-ordering');
        const transfer = nav.emitKeyPress('right');
        expect(transfer.handled).toBe(true);
        expect(nav.setFocus).toHaveBeenLastCalledWith('setup-series-base-mode');
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

    it('moves left from adjustable controls to active category without mutating value', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationMock();
        const orchestrator = createOrchestrator({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        clickButton(container, '#setup-category-limits');
        const minItemsButtonBefore = container.querySelector('#setup-min-items') as HTMLButtonElement | null;
        const minItemsTextBefore = minItemsButtonBefore?.textContent;

        nav.setMockFocus('setup-min-items');
        const event = nav.emitKeyPress('left');

        expect(event.handled).toBe(true);
        expect(nav.setFocus).toHaveBeenLastCalledWith('setup-category-limits');
        const minItemsButtonAfter = container.querySelector('#setup-min-items') as HTMLButtonElement | null;
        expect(minItemsButtonAfter?.textContent).toBe(minItemsTextBefore);
    });

    it('cycles adjustable values on click with wrap behavior', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        clickButton(container, '#setup-category-limits');

        const minItemsButton = container.querySelector('#setup-min-items') as HTMLButtonElement | null;
        expect(minItemsButton?.disabled).toBe(false);
        expect(minItemsButton?.textContent ?? '').toContain(String(DEFAULT_MIN_ITEMS_PER_CHANNEL));

        clickButton(container, '#setup-min-items');
        expect((container.querySelector('#setup-min-items') as HTMLButtonElement | null)?.textContent ?? '').toContain('10');

        clickButton(container, '#setup-min-items');
        expect((container.querySelector('#setup-min-items') as HTMLButtonElement | null)?.textContent ?? '').toContain('20');

        clickButton(container, '#setup-min-items');
        expect((container.querySelector('#setup-min-items') as HTMLButtonElement | null)?.textContent ?? '').toContain('50');

        clickButton(container, '#setup-min-items');
        expect((container.querySelector('#setup-min-items') as HTMLButtonElement | null)?.textContent ?? '').toContain('1');
    });

    it('renders preview strip below split and collapsed by default', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        const split = container.querySelector('.setup-split');
        const strip = container.querySelector('.setup-preview-strip');
        expect(split).not.toBeNull();
        expect(strip).not.toBeNull();
        expect(split?.nextElementSibling).toBe(strip);

        expect(container.querySelector('.setup-detail-pane #setup-preview-panel')).toBeNull();
        const previewPanel = strip?.querySelector('#setup-preview-panel') as HTMLElement | null;
        expect(previewPanel).not.toBeNull();

        const toggle = container.querySelector('#setup-preview-toggle') as HTMLButtonElement | null;
        expect(toggle?.getAttribute('aria-expanded')).toBe('false');
        expect(toggle?.getAttribute('aria-controls')).toBe('setup-preview-panel');
        expect(strip?.classList.contains('is-collapsed')).toBe(true);
        expect(previewPanel?.hidden).toBe(true);
    });

    it('toggles preview strip details with the preview toggle button', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        const strip = container.querySelector('.setup-preview-strip');
        const toggle = container.querySelector('#setup-preview-toggle') as HTMLButtonElement | null;
        const previewPanel = container.querySelector('#setup-preview-panel') as HTMLElement | null;

        expect(strip?.classList.contains('is-collapsed')).toBe(true);
        expect(toggle?.getAttribute('aria-expanded')).toBe('false');
        expect(previewPanel?.hidden).toBe(true);

        clickButton(container, '#setup-preview-toggle');
        expect(strip?.classList.contains('is-collapsed')).toBe(false);
        expect(toggle?.getAttribute('aria-expanded')).toBe('true');
        expect(previewPanel?.hidden).toBe(false);

        clickButton(container, '#setup-preview-toggle');
        expect(strip?.classList.contains('is-collapsed')).toBe(true);
        expect(toggle?.getAttribute('aria-expanded')).toBe('false');
        expect(previewPanel?.hidden).toBe(true);
    });

    it('keeps preview strip expanded across Step 2 re-renders', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        clickButton(container, '#setup-preview-toggle');
        expect(container.querySelector('.setup-preview-strip')?.classList.contains('is-collapsed')).toBe(false);
        expect(container.querySelector('#setup-preview-toggle')?.getAttribute('aria-expanded')).toBe('true');
        expect((container.querySelector('#setup-preview-panel') as HTMLElement | null)?.hidden).toBe(false);

        // Trigger a Step 2 re-render via a setting change.
        clickButton(container, '#setup-strategy-collections');
        await flushPromises();

        expect(container.querySelector('.setup-preview-strip')?.classList.contains('is-collapsed')).toBe(false);
        expect(container.querySelector('#setup-preview-toggle')?.getAttribute('aria-expanded')).toBe('true');
        expect((container.querySelector('#setup-preview-panel') as HTMLElement | null)?.hidden).toBe(false);
    });

    it('registers preview toggle in Step 2 focusables', async () => {
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

        expect(nav.focusables.has('setup-preview-toggle')).toBe(true);
        expect(nav.focusables.get('setup-preview-toggle')?.neighbors.down).toBe('setup-back');
    });

    it('shows category activity dots only for strategy categories with enabled strategies', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        expect(container.querySelector('#setup-category-content-sources .setup-category-dot')).not.toBeNull();
        expect(container.querySelector('#setup-category-advanced-sources .setup-category-dot')).not.toBeNull();
        expect(container.querySelector('#setup-category-limits .setup-category-dot')).toBeNull();

        clickButton(container, '#setup-strategy-collections');
        clickButton(container, '#setup-strategy-playlists');
        clickButton(container, '#setup-strategy-recentlyAdded');

        expect(container.querySelector('#setup-category-content-sources .setup-category-dot')).toBeNull();
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

    it('starts build progress after confirming review for existing setup context', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        let resolveBuild: ((value: typeof DEFAULT_BUILD_RESULT | PromiseLike<typeof DEFAULT_BUILD_RESULT>) => void) | undefined;
        const createChannelsFromSetup = jest.fn().mockImplementation(() => new Promise<typeof DEFAULT_BUILD_RESULT>((resolve) => {
            resolveBuild = resolve;
        }));
        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSetupContextForSelectedServer: jest.fn(() => 'existing'),
            getSetupReview: jest.fn().mockResolvedValue(DEFAULT_REVIEW),
            createChannelsFromSetup,
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        clickButton(container, '#setup-next');
        await flushPromises();
        await flushPromises();

        clickButton(container, '#setup-replace-confirm');
        clickButton(container, '#setup-confirm');
        await flushPromises();

        expect(container.textContent ?? '').toContain('Building channels');
        expect(createChannelsFromSetup).toHaveBeenCalledTimes(1);

        if (!resolveBuild) {
            throw new Error('Expected build resolver to be set');
        }
        resolveBuild(DEFAULT_BUILD_RESULT);
        await flushPromises();
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

    it('treats abort-like build failures as canceled (not error)', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const createChannelsFromSetup = jest.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));
        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSetupContextForSelectedServer: jest.fn(() => 'first-time'),
            getSelectedServerId: jest.fn(() => 'server-1'),
            createChannelsFromSetup,
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        clickButton(container, '#setup-next');
        await flushPromises();
        await flushPromises();

        expect(container.textContent ?? '').toContain('Canceled');
        expect(container.textContent ?? '').toContain('No changes were applied');
        expect(container.textContent ?? '').not.toContain('Build failed');
    });

    it('disables Confirm & Replace until replace confirmation is toggled', async () => {
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

        clickButton(container, '#setup-next');
        await flushPromises();
        await flushPromises();

        const confirm = container.querySelector('#setup-confirm') as HTMLButtonElement | null;
        expect(confirm?.disabled).toBe(true);

        clickButton(container, '#setup-replace-confirm');
        const toggledConfirm = container.querySelector('#setup-confirm') as HTMLButtonElement | null;
        expect(toggledConfirm?.disabled).toBe(false);
    });

    it('shows review loading state before review payload resolves', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        let resolveReview: ((value: typeof DEFAULT_REVIEW | PromiseLike<typeof DEFAULT_REVIEW>) => void) | undefined;
        const getSetupReview = jest.fn().mockImplementation(() => new Promise<typeof DEFAULT_REVIEW>((resolve) => {
            resolveReview = resolve;
        }));

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

        clickButton(container, '#setup-next');
        await flushPromises();
        expect(container.textContent ?? '').toContain('Preparing your review');

        if (!resolveReview) {
            throw new Error('Expected review resolver to be set');
        }
        resolveReview(DEFAULT_REVIEW);
        await flushPromises();
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

    it('renders scope controls only for strategies that support mixed sources', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        // Content-source strategies: scope has no effect today, so control should not be shown.
        expect(container.querySelector('#setup-scope-collections')).toBeNull();
        expect(container.querySelector('#setup-scope-playlists')).toBeNull();
        expect(container.querySelector('#setup-scope-recentlyAdded')).toBeNull();

        // Advanced strategies: only the mixed-capable category strategies should show scope controls.
        clickButton(container, '#setup-category-advanced-sources');

        expect(container.querySelector('#setup-scope-genres')).toBeTruthy();
        expect(container.querySelector('#setup-scope-directors')).toBeTruthy();
        expect(container.querySelector('#setup-scope-studios')).toBeTruthy();
        expect(container.querySelector('#setup-scope-actors')).toBeTruthy();

        // Decades currently does not support cross-library mixing.
        expect(container.querySelector('#setup-scope-decades')).toBeNull();
    });

    it('updates priority row enabled state in place without replacing the row node', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        clickButton(container, '#setup-category-priority-order');

        const rowId = '#setup-priority-row-playlists';
        const before = container.querySelector(rowId) as HTMLButtonElement | null;
        expect(before).not.toBeNull();
        const beforeLabel = before?.getAttribute('aria-label');
        expect(beforeLabel).toContain(', On');
        expect(before?.classList.contains('selected')).toBe(true);

        clickButton(container, rowId);

        const after = container.querySelector(rowId) as HTMLButtonElement | null;
        expect(after).toBe(before);
        const afterLabel = after?.getAttribute('aria-label');
        expect(afterLabel).toContain(', Off');
        expect(after?.classList.contains('selected')).toBe(false);
    });

    it('drops grabbed priority state when moving left back to the category rail', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationMock();
        const orchestrator = createOrchestrator({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);
        clickButton(container, '#setup-category-priority-order');

        nav.setMockFocus('setup-priority-row-playlists');
        const grab = nav.emitKeyPress('ok');
        expect(grab.handled).toBe(true);
        expect(
            (container.querySelector('#setup-priority-row-playlists') as HTMLButtonElement | null)?.classList.contains(
                'setup-priority-row--grabbed'
            )
        ).toBe(true);

        const left = nav.emitKeyPress('left');
        expect(left.handled).toBe(true);
        expect(
            (container.querySelector('#setup-priority-row-playlists') as HTMLButtonElement | null)?.classList.contains(
                'setup-priority-row--grabbed'
            )
        ).toBe(false);

        nav.setMockFocus('setup-category-priority-order');
        const right = nav.emitKeyPress('right');
        expect(right.handled).toBe(true);

        nav.setMockFocus('setup-priority-row-playlists');
        const moveWithoutGrab = nav.emitKeyPress('down');
        expect(moveWithoutGrab.handled).toBeFalsy();
    });

    it('does not snap focus back to a stale priority row during preview rerenders', async () => {
        jest.useFakeTimers();
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationMock();
        const getSetupPreview = jest.fn().mockResolvedValue(DEFAULT_PREVIEW);
        const orchestrator = createOrchestrator({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSelectedServerId: jest.fn(() => 'server-1'),
            getSetupPreview,
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        clickButton(container, '#setup-category-priority-order');
        nav.setFocus.mockClear();

        clickButton(container, '#setup-priority-row-playlists');
        nav.setMockFocus('setup-category-priority-order');

        jest.advanceTimersByTime(450);
        await flushPromises();

        expect(getSetupPreview).toHaveBeenCalled();
        const lastFocused = nav.setFocus.mock.calls.at(-1)?.[0];
        expect(lastFocused).toBe('setup-category-priority-order');
    });

    it('renders strategy toggles and priority rows for every setup strategy key with no extras', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        const observedStrategies = new Set<string>();
        const observedPriorityRows = new Set<string>();
        const collectVisibleStrategyControls = (): void => {
            const strategyButtons = Array.from(
                container.querySelectorAll<HTMLButtonElement>('[id^="setup-strategy-"]')
            );
            for (const button of strategyButtons) {
                observedStrategies.add(button.id.replace('setup-strategy-', ''));
            }
        };

        collectVisibleStrategyControls();
        clickButton(container, '#setup-category-advanced-sources');
        collectVisibleStrategyControls();
        clickButton(container, '#setup-category-priority-order');
        const priorityRows = Array.from(
            container.querySelectorAll<HTMLButtonElement>('[id^="setup-priority-row-"]')
        );
        for (const row of priorityRows) {
            observedPriorityRows.add(row.id.replace('setup-priority-row-', ''));
        }

        const expected = [...SETUP_STRATEGY_KEYS].sort();
        expect([...observedStrategies].sort()).toEqual(expected);
        expect([...observedPriorityRows].sort()).toEqual(expected);
    });

    it('reorders priority rows only while grabbed with OK + up/down', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationMock();
        const orchestrator = createOrchestrator({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        clickButton(container, '#setup-category-priority-order');
        const orderFromRows = (): string[] =>
            Array.from(container.querySelectorAll<HTMLButtonElement>('[id^=\"setup-priority-row-\"]'))
                .map((row) => row.id.replace('setup-priority-row-', ''));

        const beforeOrder = orderFromRows();
        const moveIndex = Math.min(1, beforeOrder.length - 2);
        const movedKey = beforeOrder[moveIndex];
        const swappedKey = beforeOrder[moveIndex + 1];
        expect(movedKey).toBeTruthy();
        expect(swappedKey).toBeTruthy();

        nav.setMockFocus(`setup-priority-row-${movedKey}`);

        const dpadDownBeforeGrab = nav.emitKeyPress('down');
        expect(dpadDownBeforeGrab.handled).toBeFalsy();
        expect(orderFromRows()).toEqual(beforeOrder);

        const grab = nav.emitKeyPress('ok');
        expect(grab.handled).toBe(true);

        const dpadDown = nav.emitKeyPress('down');
        expect(dpadDown.handled).toBe(true);

        const afterDownOrder = orderFromRows();
        expect(afterDownOrder[moveIndex]).toBe(swappedKey);
        expect(afterDownOrder[moveIndex + 1]).toBe(movedKey);

        const drop = nav.emitKeyPress('ok');
        expect(drop.handled).toBe(true);

        const dpadUpAfterDrop = nav.emitKeyPress('up');
        expect(dpadUpAfterDrop.handled).toBeFalsy();
    });

    it('clears grabbed priority state when leaving and re-entering priority category', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationMock();
        const orchestrator = createOrchestrator({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);
        clickButton(container, '#setup-category-priority-order');

        const beforeOrder = Array.from(
            container.querySelectorAll<HTMLButtonElement>('[id^="setup-priority-row-"]')
        ).map((row) => row.id.replace('setup-priority-row-', ''));
        const focusKey = beforeOrder[1] ?? beforeOrder[0];
        expect(focusKey).toBeTruthy();

        nav.setMockFocus(`setup-priority-row-${focusKey}`);
        const grab = nav.emitKeyPress('ok');
        expect(grab.handled).toBe(true);

        // Leave priority-order category, then come back.
        clickButton(container, '#setup-category-content-sources');
        clickButton(container, '#setup-category-priority-order');
        nav.setMockFocus(`setup-priority-row-${focusKey}`);

        // Should not move unless grabbed again.
        const moveWithoutRegrab = nav.emitKeyPress('down');
        expect(moveWithoutRegrab.handled).toBeFalsy();
        const afterOrder = Array.from(
            container.querySelectorAll<HTMLButtonElement>('[id^="setup-priority-row-"]')
        ).map((row) => row.id.replace('setup-priority-row-', ''));
        expect(afterOrder).toEqual(beforeOrder);
    });

    it('applies Expand Lineup values only after successful build completion', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const createChannelsFromSetup = jest.fn().mockResolvedValue(DEFAULT_BUILD_RESULT);
        const markSetupComplete = jest.fn();
        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSetupContextForSelectedServer: jest.fn(() => 'first-time'),
            getSelectedServerId: jest.fn(() => 'server-1'),
            createChannelsFromSetup,
            markSetupComplete,
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        clickButton(container, '#setup-category-limits');
        clickButton(container, '#setup-expand-lineup');
        expect(markSetupComplete).not.toHaveBeenCalled();

        clickButton(container, '#setup-next');
        await flushPromises();
        await flushPromises();

        expect(createChannelsFromSetup).toHaveBeenCalledTimes(1);
        expect(markSetupComplete).toHaveBeenCalledTimes(1);
        const savedConfig = markSetupComplete.mock.calls[0]?.[1] as { maxChannels: number; minItemsPerChannel: number };
        expect(savedConfig.maxChannels).toBe(MAX_CHANNELS);
        expect(savedConfig.minItemsPerChannel).toBe(1);
    });

    it('transitions cancel button to Canceling during in-flight build abort', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        let resolveBuild: ((value: typeof DEFAULT_BUILD_RESULT | PromiseLike<typeof DEFAULT_BUILD_RESULT>) => void) | undefined;
        const createChannelsFromSetup = jest.fn().mockImplementation(() => new Promise<typeof DEFAULT_BUILD_RESULT>((resolve) => {
            resolveBuild = resolve;
        }));

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSetupContextForSelectedServer: jest.fn(() => 'first-time'),
            createChannelsFromSetup,
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);

        clickButton(container, '#setup-next');
        await flushPromises();
        clickButton(container, '#setup-back');
        expect((container.querySelector('#setup-back') as HTMLButtonElement | null)?.textContent).toBe('Canceling...');

        if (!resolveBuild) {
            throw new Error('Expected build resolver to be set');
        }
        resolveBuild(DEFAULT_BUILD_RESULT);
        await flushPromises();
    });

    it('shows no-server-selected error when entering build without server id', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSetupContextForSelectedServer: jest.fn(() => 'first-time'),
            getSelectedServerId: jest.fn(() => null),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);
        clickButton(container, '#setup-next');
        await flushPromises();

        expect(container.textContent ?? '').toContain('No server selected.');
        expect((container.querySelector('#setup-done') as HTMLButtonElement | null)?.disabled).toBe(true);
    });

    it('returns to Step 2 when backing out of build progress with no server selected', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSetupContextForSelectedServer: jest.fn(() => 'first-time'),
            getSelectedServerId: jest.fn(() => null),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        await enterStep2(container);
        clickButton(container, '#setup-next');
        await flushPromises();

        expect(container.textContent ?? '').toContain('No server selected.');

        clickButton(container, '#setup-back');
        await flushPromises();

        expect(container.querySelector('#setup-category-content-sources')).not.toBeNull();
        expect((container.querySelector('#setup-next') as HTMLButtonElement | null)?.textContent).toBe('Build Channels');
        expect((container.querySelector('#setup-back') as HTMLButtonElement | null)?.textContent).toBe('Back');
    });

});
