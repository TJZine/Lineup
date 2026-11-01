/**
 * @jest-environment jsdom
 */

import type { ChannelSetupInventory } from '../../../../core/channel-setup/planning/ChannelSetupInventory';
import { ChannelSetupScreen } from '../ChannelSetupScreen';
import type { PlexLibrarySection } from '../../../plex/library/types';
import type { INavigationManager } from '../../../navigation/contracts/interfaces';
import { MAX_CHANNELS } from '../../../scheduler/channel-manager/constants';
import { DEFAULT_MIN_ITEMS_PER_CHANNEL, SETUP_STRATEGY_KEYS, STEP2_CONTROL_IDS } from '../strategyConstants';

import {
    createBodyAppendedTestContainer,
    expectConsoleWarn,
    flushPromises,
} from '../../../../__tests__/helpers';
import { CHANNEL_SETUP_PREVIEW_DEBOUNCE_MS } from '../constants';
import {
    clickButton,
    createNavigationMock,
    createSplitScreenPorts,
    createScreenDeps,
    DEFAULT_BUILD_RESULT,
    DEFAULT_PREVIEW,
    DEFAULT_REVIEW,
    makeLibrary,
} from './channel-setup-test-helpers';

const enterStep2 = async (container: HTMLElement): Promise<void> => {
    clickButton(container, '#setup-scan');
    await flushPromises();
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

    it('relies on shared screen bootstrap while show and hide still own display lifecycle', async () => {
        const container = createBodyAppendedTestContainer();

        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));

        expect(container.style.position).toBe('');
        expect(container.style.inset).toBe('');
        expect(container.style.display).toBe('');
        expect(container.style.alignItems).toBe('');
        expect(container.style.justifyContent).toBe('');

        screen.show();
        await flushPromises();
        expect(container.style.display).toBe('flex');

        screen.hide();
        expect(container.style.display).toBe('none');
    });

    it('shows loading state while libraries are in flight', async () => {
        const container = createBodyAppendedTestContainer();

        let resolveLibraries: (libraries: PlexLibrarySection[]) => void = () => undefined;
        const librariesPromise = new Promise<PlexLibrarySection[]>((resolve) => {
            resolveLibraries = resolve;
        });

        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn(() => librariesPromise),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({
            workflowPort,
            screenPorts,
        }));
        screen.show();

        expect(container.textContent ?? '').toContain('Loading libraries');

        resolveLibraries([makeLibrary({ id: 'movies', title: 'Movies', contentCount: 1200 })]);
        await flushPromises();

        expect(container.textContent ?? '').not.toContain('Loading libraries');
        expect(container.querySelector('#setup-lib-movies')).not.toBeNull();
    });

    it('shows library-load failure state when libraries cannot be fetched', async () => {
        const container = createBodyAppendedTestContainer();

        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockRejectedValue(new Error('library load failed')),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();

        expect(container.textContent ?? '').toContain('Library load failed.');
        expect(container.textContent ?? '').toContain('library load failed');
        expect(container.querySelector('#setup-next')).toBeNull();
    });

    it('renders bulk actions and formatted library metadata', async () => {
        const container = createBodyAppendedTestContainer();

        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([
                makeLibrary({ id: 'movies', title: 'Movies', contentCount: 1234 }),
                makeLibrary({ id: 'shows', title: 'Shows', type: 'show', contentCount: 56, episodeCount: 999 }),
            ]),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
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
        expect(container.querySelector('#setup-lib-movies .setup-toggle-icon svg')).not.toBeNull();
        expect(container.querySelector('#setup-lib-shows .setup-toggle-icon svg')).not.toBeNull();
    });

    it('applies stagger class and delay to library cards', async () => {
        const container = createBodyAppendedTestContainer();

        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([
                makeLibrary({ id: 'movies' }),
                makeLibrary({ id: 'shows', type: 'show' }),
            ]),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();

        const first = container.querySelector('#setup-lib-movies') as HTMLButtonElement | null;
        const second = container.querySelector('#setup-lib-shows') as HTMLButtonElement | null;
        expect(first?.classList.contains('setup-stagger-in')).toBe(true);
        expect(second?.classList.contains('setup-stagger-in')).toBe(true);
        expect(second?.style.animationDelay).toBe('50ms');
    });

    it('supports clear-all and select-all toggles', async () => {
        const container = createBodyAppendedTestContainer();

        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([
                makeLibrary({ id: 'movies' }),
                makeLibrary({ id: 'shows', type: 'show' }),
            ]),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();

        clickButton(container, '#setup-clear-all');
        expect(container.querySelectorAll('.setup-toggle.library-toggle.selected')).toHaveLength(0);
        expect((container.querySelector('#setup-next') as HTMLButtonElement | null)?.disabled).toBe(true);

        clickButton(container, '#setup-select-all');
        expect(container.querySelectorAll('.setup-toggle.library-toggle.selected')).toHaveLength(2);
        expect((container.querySelector('#setup-scan') as HTMLButtonElement | null)?.disabled).toBe(false);
    });

    it('advances after clear-all and selecting a single library', async () => {
        const container = createBodyAppendedTestContainer();

        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([
                makeLibrary({ id: 'movies' }),
                makeLibrary({ id: 'shows', type: 'show' }),
            ]),
            getSetupContextForSelectedServer: jest.fn(() => 'existing'),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();

        clickButton(container, '#setup-clear-all');
        clickButton(container, '#setup-lib-movies');
        expect((container.querySelector('#setup-scan') as HTMLButtonElement | null)?.disabled).toBe(false);

        await enterStep2(container);
        expect(container.textContent ?? '').toContain('2 Configure');
        expect(container.textContent ?? '').toContain('Configure your lineup');
        expect(container.querySelector('#setup-next')?.textContent).toBe('Review channels');
    });

    it('updates library toggle in place without replacing the button node', async () => {
        const container = createBodyAppendedTestContainer();

        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([
                makeLibrary({ id: 'movies' }),
            ]),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
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
        const container = createBodyAppendedTestContainer();

        const nav = createNavigationMock();
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([
                makeLibrary({ id: 'movies' }),
                makeLibrary({ id: 'shows', type: 'show' }),
            ]),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
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
        const container = createBodyAppendedTestContainer();
        const nav = createNavigationMock();
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
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

    it('clears grabbed priority visuals before a reopened session reloads libraries', async () => {
        const container = createBodyAppendedTestContainer();

        let resolveSecondLoad: ((libraries: PlexLibrarySection[]) => void) | undefined;
        const secondLoad = new Promise<PlexLibrarySection[]>((resolve) => {
            resolveSecondLoad = resolve;
        });
        const getLibrariesForSetup = jest.fn()
            .mockResolvedValueOnce([makeLibrary({ id: 'movies' })])
            .mockImplementationOnce(() => secondLoad);

        const nav = createNavigationMock();
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup,
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();
        await enterStep2(container);
        clickButton(container, '#setup-category-priority-order');

        nav.setMockFocus('setup-priority-row-playlists');
        const grab = nav.emitKeyPress('ok');
        expect(grab.handled).toBe(true);
        expect(container.querySelector('.setup-priority-row--grabbed')).not.toBeNull();

        screen.hide();
        screen.show();

        expect(container.textContent ?? '').toContain('Loading libraries...');
        expect(container.querySelector('.setup-priority-row--grabbed')).toBeNull();
        expect(container.querySelector('#setup-priority-row-playlists')).toBeNull();

        resolveSecondLoad?.([makeLibrary({ id: 'movies' })]);
        await flushPromises();
    });

    it('resets the persistent Step 2 panel scroll when sections switch by click', async () => {
        const container = createBodyAppendedTestContainer();

        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();
        await enterStep2(container);

        clickButton(container, '#setup-category-priority-order');

        const panel = container.querySelector('.setup-panel') as HTMLElement | null;
        const detailScroll = container.querySelector('.setup-detail-scroll') as HTMLElement | null;
        const categoryRail = container.querySelector('.setup-category-rail') as HTMLElement | null;
        if (!panel || !detailScroll || !categoryRail) {
            throw new Error('Expected Step 2 scroll containers');
        }
        panel.scrollTop = 360;
        detailScroll.scrollTop = 90;
        categoryRail.scrollTop = 40;

        clickButton(container, '#setup-category-build-options');

        expect(panel.scrollTop).toBe(0);
        expect((container.querySelector('.setup-detail-scroll') as HTMLElement | null)?.scrollTop).toBe(0);
        expect((container.querySelector('.setup-category-rail') as HTMLElement | null)?.scrollTop).toBe(0);
        expect(container.querySelector('.setup-detail-header')?.textContent).toBe('Build Options');
        expect(container.querySelector('#setup-back')).not.toBeNull();
        expect(container.querySelector('#setup-next')).not.toBeNull();
    });

    it('resets Step 2 panel scroll before right-key section switching restores detail focus', async () => {
        const container = createBodyAppendedTestContainer();

        const nav = createNavigationMock();
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();
        await enterStep2(container);

        clickButton(container, '#setup-category-priority-order');
        const panel = container.querySelector('.setup-panel') as HTMLElement | null;
        if (!panel) {
            throw new Error('Expected setup panel');
        }
        panel.scrollTop = 360;

        nav.setMockFocus('setup-category-limits');
        const switchEvent = nav.emitKeyPress('right');

        expect(switchEvent.handled).toBe(true);
        expect(panel.scrollTop).toBe(0);
        expect(container.querySelector('.setup-detail-header')?.textContent).toBe('Limits');
        expect(nav.setFocus).toHaveBeenLastCalledWith('setup-category-limits');
        expect(container.querySelector('#setup-back')).not.toBeNull();
        expect(container.querySelector('#setup-next')).not.toBeNull();

        const enterDetailEvent = nav.emitKeyPress('right');
        expect(enterDetailEvent.handled).toBe(true);
        expect(nav.setFocus).toHaveBeenLastCalledWith(STEP2_CONTROL_IDS.maxChannels);
    });

    it('does not re-register focusables if library loading settles after hide', async () => {
        const container = createBodyAppendedTestContainer();

        let resolveLibraries: ((libraries: PlexLibrarySection[]) => void) | undefined;
        const librariesPromise = new Promise<PlexLibrarySection[]>((resolve) => {
            resolveLibraries = resolve;
        });

        const nav = createNavigationMock();
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn(() => librariesPromise),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
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
        const container = createBodyAppendedTestContainer();

        let resolveLibraries: ((libraries: PlexLibrarySection[]) => void) | undefined;
        const librariesPromise = new Promise<PlexLibrarySection[]>((resolve) => {
            resolveLibraries = resolve;
        });

        const nav = createNavigationMock();
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn(() => librariesPromise),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
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
        const container = createBodyAppendedTestContainer();

        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
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
            'Guide Order',
        ]);
    });

    it('renders only controls for the active Step 2 category', async () => {
        const container = createBodyAppendedTestContainer();

        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();
        await enterStep2(container);

        expect(container.querySelector('#setup-strategy-collections')).not.toBeNull();
        expect(container.querySelector('#setup-build-mode')).toBeNull();

        clickButton(container, '#setup-category-build-options');
        expect(container.querySelector('#setup-build-mode')).not.toBeNull();
        expect(container.querySelector('#setup-strategy-collections')).toBeNull();
    });

    it('keeps Step 2 vertical focus movement inside each pane', async () => {
        const container = createBodyAppendedTestContainer();

        const nav = createNavigationMock();
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();
        await enterStep2(container);

        expect(nav.focusables.get('setup-category-content-sources')?.neighbors.down).toBe('setup-category-advanced-sources');
        expect(nav.focusables.get('setup-category-advanced-sources')?.neighbors.down).toBe('setup-category-build-options');
        expect(nav.focusables.get('setup-category-build-options')?.neighbors.down).toBe('setup-category-series-ordering');
        expect(nav.focusables.get('setup-category-series-ordering')?.neighbors.down).toBe('setup-category-limits');
        expect(nav.focusables.get('setup-category-limits')?.neighbors.down).toBe('setup-category-priority-order');
        expect(nav.focusables.get('setup-category-priority-order')?.neighbors.down).toBe('setup-back');
        expect(nav.focusables.get('setup-strategy-collections')?.neighbors.up).toBe('setup-strategy-collections');
        expect(nav.focusables.get('setup-strategy-recentlyAdded')?.neighbors.down).toBe('setup-next');
        expect(nav.focusables.get('setup-back')?.neighbors.up).toBe('setup-category-priority-order');
        expect(nav.focusables.get('setup-back')?.neighbors.down).toBe('setup-back');
        expect(nav.focusables.get('setup-next')?.neighbors.up).toBe('setup-strategy-recentlyAdded');
        expect(nav.focusables.get('setup-next')?.neighbors.down).toBe('setup-next');
    });

    it('handles category-to-detail right transfer and remembers last focused control per category', async () => {
        const container = createBodyAppendedTestContainer();

        const nav = createNavigationMock();
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();
        await enterStep2(container);

        nav.setMockFocus('setup-category-content-sources');
        const firstTransfer = nav.emitKeyPress('right');
        expect(firstTransfer.handled).toBe(true);
        expect(firstTransfer.originalEvent.preventDefault).toHaveBeenCalled();
        expect(nav.setFocus).toHaveBeenLastCalledWith('setup-strategy-collections');

        clickButton(container, '#setup-strategy-playlists');
        clickButton(container, '#setup-category-build-options');
        clickButton(container, '#setup-category-content-sources');

        nav.setMockFocus('setup-category-content-sources');
        const rememberedTransfer = nav.emitKeyPress('right');
        expect(rememberedTransfer.handled).toBe(true);
        expect(rememberedTransfer.originalEvent.preventDefault).toHaveBeenCalled();
        expect(nav.setFocus).toHaveBeenLastCalledWith('setup-strategy-playlists');
    });

    it('right transfer activates the focused category before a second right moves to detail controls', async () => {
        const container = createBodyAppendedTestContainer();

        const nav = createNavigationMock();
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();
        await enterStep2(container);

        expect(container.querySelector('#setup-build-mode')).toBeNull();

        nav.setMockFocus('setup-category-build-options');
        const transfer = nav.emitKeyPress('right');
        expect(transfer.handled).toBe(true);
        expect(transfer.originalEvent.preventDefault).toHaveBeenCalled();
        expect(container.querySelector('#setup-build-mode')).not.toBeNull();
        expect(nav.setFocus).toHaveBeenLastCalledWith('setup-category-build-options');

        const enterDetail = nav.emitKeyPress('right');
        expect(enterDetail.handled).toBe(true);
        expect(enterDetail.originalEvent.preventDefault).toHaveBeenCalled();
        expect(nav.setFocus).toHaveBeenLastCalledWith('setup-build-mode');
    });

    it('right transfer skips remembered disabled detail controls', async () => {
        const container = createBodyAppendedTestContainer();

        const nav = createNavigationMock();
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();
        await enterStep2(container);

        clickButton(container, '#setup-category-series-ordering');

        clickButton(container, '#setup-playback-block');

        clickButton(container, '#setup-series-base-block-size'); // remember this control
        nav.emitKeyPress('back'); // close the adjustable menu

        clickButton(container, '#setup-playback-shuffle');

        nav.setMockFocus('setup-category-series-ordering');
        const transfer = nav.emitKeyPress('right');
        expect(transfer.handled).toBe(true);
        expect(transfer.originalEvent.preventDefault).toHaveBeenCalled();
        expect(nav.setFocus).not.toHaveBeenLastCalledWith('setup-series-base-block-size');
    });

    it('moves left from non-adjustable detail controls back to active category', async () => {
        const container = createBodyAppendedTestContainer();

        const nav = createNavigationMock();
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();
        await enterStep2(container);

        nav.setMockFocus('setup-strategy-collections');
        const event = nav.emitKeyPress('left');
        expect(event.handled).toBe(true);
        expect(event.originalEvent.preventDefault).toHaveBeenCalled();
        expect(nav.setFocus).toHaveBeenLastCalledWith('setup-category-content-sources');
    });

    it('returns focus to the category rail when left is pressed at the first inline option', async () => {
        const container = createBodyAppendedTestContainer();

        const nav = createNavigationMock();
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();
        await enterStep2(container);

        clickButton(container, '#setup-category-limits');
        clickButton(container, '#setup-min-items');
        clickButton(container, '#setup-dropdown-option-0');
        expect((container.querySelector('#setup-min-items') as HTMLButtonElement | null)?.textContent ?? '').toContain('1');

        nav.setMockFocus('setup-min-items');
        const event = nav.emitKeyPress('left');

        expect(event.handled).toBe(true);
        expect(nav.setFocus).toHaveBeenLastCalledWith('setup-category-limits');
        expect((container.querySelector('#setup-min-items') as HTMLButtonElement | null)?.textContent ?? '').toContain('1');
    });

    it('still opens the dropdown on OK for adjustable controls', async () => {
        const container = createBodyAppendedTestContainer();

        const nav = createNavigationMock();
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();
        await enterStep2(container);

        clickButton(container, '#setup-category-build-options');
        nav.setMockFocus('setup-build-mode');

        const event = nav.emitKeyPress('ok');
        expect(event.handled).toBe(true);
        expect(container.querySelector('#setup-dropdown')).not.toBeNull();
    });

    it('updates adjustable values through dropdown selection', async () => {
        const container = createBodyAppendedTestContainer();

        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();
        await enterStep2(container);

        clickButton(container, '#setup-category-limits');

        const minItemsButton = container.querySelector('#setup-min-items') as HTMLButtonElement | null;
        expect(minItemsButton?.disabled).toBe(false);
        expect(minItemsButton?.textContent ?? '').toContain(String(DEFAULT_MIN_ITEMS_PER_CHANNEL));

        clickButton(container, '#setup-min-items');
        clickButton(container, '#setup-dropdown-option-2');
        expect((container.querySelector('#setup-min-items') as HTMLButtonElement | null)?.textContent ?? '').toContain('10');

        clickButton(container, '#setup-min-items');
        clickButton(container, '#setup-dropdown-option-3');
        expect((container.querySelector('#setup-min-items') as HTMLButtonElement | null)?.textContent ?? '').toContain('20');

        clickButton(container, '#setup-min-items');
        clickButton(container, '#setup-dropdown-option-4');
        expect((container.querySelector('#setup-min-items') as HTMLButtonElement | null)?.textContent ?? '').toContain('50');

        clickButton(container, '#setup-min-items');
        clickButton(container, '#setup-dropdown-option-0');
        expect((container.querySelector('#setup-min-items') as HTMLButtonElement | null)?.textContent ?? '').toContain('1');
    });

    it('returns the active unsaved planner diagnostics config', async () => {
        const container = createBodyAppendedTestContainer();

        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();
        await enterStep2(container);

        clickButton(container, '#setup-category-limits');
        clickButton(container, '#setup-min-items');
        clickButton(container, '#setup-dropdown-option-3');

        expect(screen.getPlannerDiagnosticsConfig()).toEqual(expect.objectContaining({
            serverId: 'server-1',
            selectedLibraryIds: ['movies'],
            minItemsPerChannel: 20,
        }));
    });

    describe('Step 2 dropdown menus', () => {
        it('opens a dropdown when a multi-value control is clicked', async () => {
            const container = createBodyAppendedTestContainer();

            const { workflowPort, screenPorts } = createSplitScreenPorts({
                getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            });

            const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
            screen.show();
            await flushPromises();
            await enterStep2(container);

            clickButton(container, '#setup-category-build-options');
            clickButton(container, '#setup-build-mode');

            expect(container.querySelector('#setup-dropdown')).not.toBeNull();
        });

        it('sets focus to the current-value option on dropdown open', async () => {
            const container = createBodyAppendedTestContainer();

            const nav = createNavigationMock();
            const { workflowPort, screenPorts } = createSplitScreenPorts({
                getNavigation: jest.fn(() => nav as unknown as INavigationManager),
                getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            });

            const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
            screen.show();
            await flushPromises();
            await enterStep2(container);

            clickButton(container, '#setup-category-build-options');
            clickButton(container, '#setup-build-mode');

            expect(nav.setFocus).toHaveBeenLastCalledWith('setup-dropdown-option-0');
        });

        it('calls applySettingChange and closes dropdown on option select', async () => {
            const container = createBodyAppendedTestContainer();

            const { workflowPort, screenPorts } = createSplitScreenPorts({
                getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            });

            const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
            screen.show();
            await flushPromises();
            await enterStep2(container);

            clickButton(container, '#setup-category-build-options');
            clickButton(container, '#setup-build-mode');
            clickButton(container, '#setup-dropdown-option-2');
            await flushPromises();

            expect(container.querySelector('#setup-dropdown')).toBeNull();
            expect((container.querySelector('#setup-build-mode') as HTMLButtonElement | null)?.textContent ?? '').toContain('Merge');
        });

        it('restores focus to the originating control after dismiss', async () => {
            const container = createBodyAppendedTestContainer();

            const nav = createNavigationMock();
            const { workflowPort, screenPorts } = createSplitScreenPorts({
                getNavigation: jest.fn(() => nav as unknown as INavigationManager),
                getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            });

            const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
            screen.show();
            await flushPromises();
            await enterStep2(container);

            clickButton(container, '#setup-category-build-options');
            clickButton(container, '#setup-build-mode');
            nav.setMockFocus('setup-dropdown-option-0');

            nav.emitKeyPress('back');

            expect(nav.setFocus).toHaveBeenLastCalledWith('setup-build-mode');
        });

        it('dismisses dropdown on Back key press', async () => {
            const container = createBodyAppendedTestContainer();

            const nav = createNavigationMock();
            const { workflowPort, screenPorts } = createSplitScreenPorts({
                getNavigation: jest.fn(() => nav as unknown as INavigationManager),
                getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            });

            const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
            screen.show();
            await flushPromises();
            await enterStep2(container);

            clickButton(container, '#setup-category-build-options');
            clickButton(container, '#setup-build-mode');
            nav.setMockFocus('setup-dropdown-option-0');

            const event = nav.emitKeyPress('back');

            expect(event.handled).toBe(true);
            expect(container.querySelector('#setup-dropdown')).toBeNull();
        });

        it('closes the previous dropdown when a new one is opened', async () => {
            const container = createBodyAppendedTestContainer();

            const { workflowPort, screenPorts } = createSplitScreenPorts({
                getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            });

            const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
            screen.show();
            await flushPromises();
            await enterStep2(container);

            clickButton(container, '#setup-category-build-options');
            clickButton(container, '#setup-build-mode');
            expect(container.querySelectorAll('#setup-dropdown')).toHaveLength(1);

            clickButton(container, '#setup-combine-mode');

            expect(container.querySelectorAll('#setup-dropdown')).toHaveLength(1);
            expect(container.querySelector('#setup-dropdown-option-1')?.textContent ?? '').toContain('Combined');
        });

        it('does not open a dropdown for disabled block-size controls', async () => {
            const container = createBodyAppendedTestContainer();

            const { workflowPort, screenPorts } = createSplitScreenPorts({
                getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            });

            const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
            screen.show();
            await flushPromises();
            await enterStep2(container);

            clickButton(container, '#setup-category-series-ordering');
            const blockSizeButton = container.querySelector('#setup-series-base-block-size') as HTMLButtonElement | null;
            expect(blockSizeButton?.disabled).toBe(true);

            clickButton(container, '#setup-series-base-block-size');

            expect(container.querySelector('#setup-dropdown')).toBeNull();
        });

        it('updates a dropdown selection and returns Left to the category rail', async () => {
            const container = createBodyAppendedTestContainer();

            const nav = createNavigationMock();
            const { workflowPort, screenPorts } = createSplitScreenPorts({
                getNavigation: jest.fn(() => nav as unknown as INavigationManager),
                getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
                getSelectedServerId: jest.fn(() => 'server-1'),
            });

            const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
            screen.show();
            await flushPromises();
            await enterStep2(container);

            clickButton(container, '#setup-category-limits');
            clickButton(container, '#setup-min-items');
            clickButton(container, '#setup-dropdown-option-2');
            await flushPromises();
            expect((container.querySelector('#setup-min-items') as HTMLButtonElement | null)?.textContent ?? '').toContain('10');

            nav.setMockFocus('setup-min-items');
            const leftEvent = nav.emitKeyPress('left');

            expect(leftEvent.handled).toBe(true);
            expect(leftEvent.originalEvent.preventDefault).toHaveBeenCalled();
            expect((container.querySelector('#setup-min-items') as HTMLButtonElement | null)?.textContent ?? '').toContain('10');
            expect(nav.setFocus).toHaveBeenLastCalledWith('setup-category-limits');
        });

        it('cleans up dropdown on hide', async () => {
            const container = createBodyAppendedTestContainer();

            const nav = createNavigationMock();
            const { workflowPort, screenPorts } = createSplitScreenPorts({
                getNavigation: jest.fn(() => nav as unknown as INavigationManager),
                getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            });

            const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
            screen.show();
            await flushPromises();
            await enterStep2(container);

            clickButton(container, '#setup-category-build-options');
            clickButton(container, '#setup-build-mode');
            expect(container.querySelector('#setup-dropdown')).not.toBeNull();

            screen.hide();

            expect(container.querySelector('#setup-dropdown')).toBeNull();
            expect(nav.focusables.has('setup-dropdown-option-0')).toBe(false);
        });
    });

    it('shows estimated generated and excluded summary from the preview owner', async () => {
        jest.useFakeTimers();
        const container = createBodyAppendedTestContainer();

        const getSetupPreview = jest.fn().mockResolvedValue(DEFAULT_PREVIEW);
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSetupPreview,
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();
        await enterStep2(container);

        jest.advanceTimersByTime(CHANNEL_SETUP_PREVIEW_DEBOUNCE_MS + 1);
        await flushPromises();

        expect(getSetupPreview).toHaveBeenCalledTimes(1);
        const footer = container.querySelector('.setup-configure-footer');
        expect(footer?.querySelector('.setup-configure-footer-summary')?.textContent).toContain('estimated generated');
        expect(footer?.querySelector('.setup-configure-footer-actions #setup-next')).not.toBeNull();
        expect(container.querySelectorAll('.setup-configure-footer-summary')).toHaveLength(1);
        expect(container.querySelector('.screen-detail')?.textContent ?? '').not.toContain('estimated generated');
        expect(container.querySelector('.setup-preview-strip')).toBeNull();
        expect(container.querySelector('#setup-preview-toggle')).toBeNull();
    });

    it('shows category activity dots only for strategy categories with enabled strategies', async () => {
        const container = createBodyAppendedTestContainer();

        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
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

    it.each(['first-time', 'existing', 'unknown'] as const)(
        'loads authoritative Review before Apply in %s setup', async (setupContext) => {
            const container = createBodyAppendedTestContainer();
            const navigation = createNavigationMock();
            const getSetupReview = jest.fn().mockResolvedValue(DEFAULT_REVIEW);
            const applySetupReview = jest.fn().mockResolvedValue({ kind: 'no-change', summary: {
                ...DEFAULT_BUILD_RESULT, created: 0, noChange: true,
            } });
            const { workflowPort, screenPorts } = createSplitScreenPorts({
                getNavigation: jest.fn(() => navigation as unknown as INavigationManager),
                getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
                getSetupContextForSelectedServer: jest.fn(() => setupContext),
                getSetupReview, applySetupReview,
            });
            const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
            screen.show(); await flushPromises(); await enterStep2(container);
            expect(container.querySelector('#setup-next')?.textContent).toBe('Review channels');
            clickButton(container, '#setup-next'); await flushPromises(); await flushPromises();
            expect(container.textContent).toContain('Review your lineup');
            expect(getSetupReview).toHaveBeenCalledTimes(1);
            expect(applySetupReview).not.toHaveBeenCalled();
            clickButton(container, '#setup-confirm'); await flushPromises();
            expect(applySetupReview).toHaveBeenCalledTimes(1);
            expect(container.textContent).toContain('Lineup unchanged');
            clickButton(container, '#setup-done');
            expect(navigation.replaceScreen).toHaveBeenCalledTimes(1);
            expect(navigation.replaceScreen).toHaveBeenCalledWith('guide');
        }
    );

    it('sanitizes Review failures and supports Refresh Review without losing Configure choices', async () => {
        expectConsoleWarn('Channel setup review failed:');
        const container = createBodyAppendedTestContainer();
        const getSetupReview = jest.fn().mockRejectedValueOnce(new Error('internal o is not a function'))
            .mockResolvedValueOnce(DEFAULT_REVIEW);
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]), getSetupReview,
        });
        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show(); await flushPromises(); await enterStep2(container);
        clickButton(container, '#setup-next'); await flushPromises(); await flushPromises();
        expect(container.textContent).toContain('Unable to prepare your review');
        expect(container.textContent).not.toContain('internal o is not a function');
        clickButton(container, '#setup-refresh-review'); await flushPromises(); await flushPromises();
        expect(getSetupReview).toHaveBeenCalledTimes(2);
        expect(container.textContent).toContain('Review your lineup');
    });

    it('keeps removal consent bound to the prepared Review before Apply', async () => {
        const container = createBodyAppendedTestContainer();
        const removal = { action: 'removed' as const, channelId: 'old-1', number: 7, name: 'Old Films',
            sourceLibraryId: 'movies', sourceLibraryIds: ['movies'], sourceKind: 'library' as const,
            playbackMode: 'shuffle' as const, shuffleSeed: 1, startTimeAnchor: 1, scheduleAnchorMode: 'daily' as const, blockSize: null,
            includeSpecials: true, buildStrategy: null, reason: 'Complete library replaced' };
        const reviewed = { ...DEFAULT_REVIEW, rows: [removal],
            diff: { ...DEFAULT_REVIEW.diff, summary: { created: 0, removed: 1, unchanged: 0 } } };
        const applySetupReview = jest.fn().mockResolvedValue({ kind: 'committed', summary: DEFAULT_BUILD_RESULT });
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSetupReview: jest.fn().mockResolvedValue(reviewed), applySetupReview,
        });
        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show(); await flushPromises(); await enterStep2(container);
        clickButton(container, '#setup-next'); await flushPromises(); await flushPromises();
        expect((container.querySelector('#setup-confirm') as HTMLButtonElement).disabled).toBe(true);
        clickButton(container, '#setup-filter-created');
        expect(container.querySelectorAll('.setup-review-row')).toHaveLength(0);
        clickButton(container, '#setup-replace-confirm');
        clickButton(container, '#setup-confirm'); await flushPromises();
        expect(applySetupReview).toHaveBeenCalledWith('prepared-review-1', expect.any(Object),
            expect.objectContaining({ removalConfirmedForReviewId: 'prepared-review-1' }), expect.any(Object));
    });

    it('keeps blocked Apply unsaved and returns to an out-of-date Review', async () => {
        const container = createBodyAppendedTestContainer();
        const applySetupReview = jest.fn().mockResolvedValue({ kind: 'blocked', reason: 'stale',
            message: 'Base changed. Refresh Review.' });
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]), applySetupReview,
        });
        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show(); await flushPromises(); await enterStep2(container);
        clickButton(container, '#setup-next'); await flushPromises(); await flushPromises();
        clickButton(container, '#setup-confirm'); await flushPromises();
        expect(container.textContent).toContain('Nothing was saved');
        clickButton(container, '#setup-back');
        expect(container.textContent).toContain('Review is out of date');
        expect((container.querySelector('#setup-confirm') as HTMLButtonElement).disabled).toBe(true);
    });

    it('renders blocked and slow Review as disabled Apply with actionable recovery', async () => {
        const container = createBodyAppendedTestContainer();
        const getSetupReview = jest.fn().mockResolvedValue({ ...DEFAULT_REVIEW,
            preview: { ...DEFAULT_PREVIEW, status: 'blocked', message: 'No free channel numbers. Change mode or limit.' } });
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]), getSetupReview,
        });
        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show(); await flushPromises(); await enterStep2(container);
        clickButton(container, '#setup-next'); await flushPromises(); await flushPromises();
        expect((container.querySelector('#setup-confirm') as HTMLButtonElement).disabled).toBe(true);
        expect(container.textContent).toContain('No free channel numbers');
        expect(container.querySelector('#setup-refresh-review')).not.toBeNull();
    });

    it('does not start review loading when backing out before deferred kickoff runs', async () => {
        const container = createBodyAppendedTestContainer();

        const getSetupReview = jest.fn().mockResolvedValue(DEFAULT_REVIEW);
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSetupContextForSelectedServer: jest.fn(() => 'existing'),
            getSetupReview,
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();
        await enterStep2(container);

        clickButton(container, '#setup-next');
        clickButton(container, '#setup-back');

        await flushPromises();

        expect(getSetupReview).not.toHaveBeenCalled();
        expect(container.querySelector('#setup-strategy-collections')).not.toBeNull();
    });

    it('does not start review loading after hide before deferred kickoff runs', async () => {
        const container = createBodyAppendedTestContainer();

        const getSetupReview = jest.fn().mockResolvedValue(DEFAULT_REVIEW);
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSetupContextForSelectedServer: jest.fn(() => 'existing'),
            getSetupReview,
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();
        await enterStep2(container);

        clickButton(container, '#setup-next');
        screen.hide();

        await flushPromises();

        expect(getSetupReview).not.toHaveBeenCalled();
    });

    it('renders scope controls only for strategies that support mixed sources', async () => {
        const container = createBodyAppendedTestContainer();

        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
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

    it('renders guide-order rows without enablement toggle state', async () => {
        const container = createBodyAppendedTestContainer();

        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();
        await enterStep2(container);

        clickButton(container, '#setup-category-priority-order');

        const rowId = '#setup-priority-row-playlists';
        const before = container.querySelector(rowId) as HTMLButtonElement | null;
        expect(before).not.toBeNull();
        const beforeLabel = before?.getAttribute('aria-label');
        expect(beforeLabel).toBe('Guide order 1: Playlists');
        expect(before?.getAttribute('aria-pressed')).toBeNull();
        expect(before?.classList.contains('selected')).toBe(false);
        expect(before?.querySelector('.setup-priority-hint')?.textContent).toBe('↕');

        clickButton(container, rowId);

        const after = container.querySelector(rowId) as HTMLButtonElement | null;
        const afterLabel = after?.getAttribute('aria-label');
        expect(afterLabel).toBe(beforeLabel);
        expect(after?.getAttribute('aria-pressed')).toBeNull();
        expect(after?.classList.contains('selected')).toBe(false);
    });

    it('shows only active strategies in Guide Order after source toggles', async () => {
        const container = createBodyAppendedTestContainer();

        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();
        await enterStep2(container);

        clickButton(container, '#setup-strategy-collections');
        clickButton(container, '#setup-strategy-playlists');
        clickButton(container, '#setup-strategy-recentlyAdded');
        clickButton(container, '#setup-category-priority-order');

        expect(container.querySelector('#setup-priority-row-collections')).toBeNull();
        expect(container.querySelector('#setup-priority-row-playlists')).toBeNull();
        expect(container.querySelector('#setup-priority-row-recentlyAdded')).toBeNull();
        expect(container.querySelector('#setup-priority-row-genres')).not.toBeNull();
        expect(container.querySelector('#setup-category-content-sources .setup-category-dot')).toBeNull();
    });

    it('keeps grabbed guide-order focus trapped on left/right until placed or canceled', async () => {
        const container = createBodyAppendedTestContainer();

        const nav = createNavigationMock();
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
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
        expect(left.originalEvent.preventDefault).toHaveBeenCalled();
        expect(
            (container.querySelector('#setup-priority-row-playlists') as HTMLButtonElement | null)?.classList.contains(
                'setup-priority-row--grabbed'
            )
        ).toBe(true);

        nav.setMockFocus('setup-category-priority-order');
        nav.setFocus.mockClear();
        const right = nav.emitKeyPress('right');
        expect(right.handled).toBe(true);
        expect(right.originalEvent.preventDefault).toHaveBeenCalled();
        expect(nav.setFocus).not.toHaveBeenCalled();

        nav.setMockFocus('setup-priority-row-playlists');
        const moveWithoutGrab = nav.emitKeyPress('down');
        expect(moveWithoutGrab.handled).toBe(true);
    });

    it('preserves grabbed priority visuals across click-triggered rerenders', async () => {
        const container = createBodyAppendedTestContainer();

        const nav = createNavigationMock();
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
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

        clickButton(container, '#setup-priority-row-playlists');
        expect(
            (container.querySelector('#setup-priority-row-playlists') as HTMLButtonElement | null)?.classList.contains(
                'setup-priority-row--grabbed'
            )
        ).toBe(true);

        expect(
            (container.querySelector('#setup-priority-row-playlists') as HTMLButtonElement | null)?.classList.contains(
                'setup-priority-row--grabbed'
            )
        ).toBe(true);
    });

    it('renders strategy toggles and priority rows for every setup strategy key with no extras', async () => {
        const container = createBodyAppendedTestContainer();

        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
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
        const container = createBodyAppendedTestContainer();

        const nav = createNavigationMock();
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
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
        const container = createBodyAppendedTestContainer();

        const nav = createNavigationMock();
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
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

    it('clears grabbed priority state when leaving Step 2 with Back and returning', async () => {
        const container = createBodyAppendedTestContainer();

        const nav = createNavigationMock();
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();
        await enterStep2(container);
        clickButton(container, '#setup-category-priority-order');

        nav.setMockFocus('setup-priority-row-playlists');
        const grab = nav.emitKeyPress('ok');
        expect(grab.handled).toBe(true);

        clickButton(container, '#setup-back');
        await flushPromises();
        await enterStep2(container);
        clickButton(container, '#setup-category-priority-order');
        nav.setMockFocus('setup-priority-row-playlists');

        expect(
            (container.querySelector('#setup-priority-row-playlists') as HTMLButtonElement | null)?.classList.contains(
                'setup-priority-row--grabbed'
            )
        ).toBe(false);
        expect(nav.emitKeyPress('down').handled).toBeFalsy();
    });

    it('clears grabbed priority state when leaving Step 2 with Next and returning', async () => {
        const container = createBodyAppendedTestContainer();

        const nav = createNavigationMock();
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getNavigation: jest.fn(() => nav as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSetupContextForSelectedServer: jest.fn(() => 'first-time'),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();
        await enterStep2(container);
        clickButton(container, '#setup-category-priority-order');

        nav.setMockFocus('setup-priority-row-playlists');
        const grab = nav.emitKeyPress('ok');
        expect(grab.handled).toBe(true);

        clickButton(container, '#setup-next');
        await flushPromises();
        clickButton(container, '#setup-back');
        await flushPromises();

        clickButton(container, '#setup-category-priority-order');
        nav.setMockFocus('setup-priority-row-playlists');

        expect(
            (container.querySelector('#setup-priority-row-playlists') as HTMLButtonElement | null)?.classList.contains(
                'setup-priority-row--grabbed'
            )
        ).toBe(false);
        expect(nav.emitKeyPress('down').handled).toBeFalsy();
    });

    it('returns to server selection instead of loading libraries without a selected server', async () => {
        const container = createBodyAppendedTestContainer();
        const getLibrariesForSetup = jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]);
        const openServerSelect = jest.fn();
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup,
            getSelectedServerId: jest.fn(() => null),
            openServerSelect,
        });

        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show();
        await flushPromises();

        expect(getLibrariesForSetup).not.toHaveBeenCalled();
        expect(openServerSelect).toHaveBeenCalledTimes(1);
        expect(container.textContent ?? '').toContain('Select a server.');
    });

    it('persists Expand Lineup only after Review and committed Apply', async () => {
        const container = createBodyAppendedTestContainer();
        const applySetupReview = jest.fn().mockResolvedValue({ kind: 'committed', summary: DEFAULT_BUILD_RESULT });
        const markSetupComplete = jest.fn((_serverId, config) => ({ ok: true as const,
            record: { ...config, createdAt: 0, updatedAt: 0 } }));
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            applySetupReview, markSetupComplete,
        });
        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show(); await flushPromises(); await enterStep2(container);
        clickButton(container, '#setup-category-limits'); clickButton(container, '#setup-expand-lineup');
        expect(markSetupComplete).not.toHaveBeenCalled();
        clickButton(container, '#setup-next'); await flushPromises(); await flushPromises();
        expect(applySetupReview).not.toHaveBeenCalled();
        clickButton(container, '#setup-confirm'); await flushPromises();
        expect(markSetupComplete).toHaveBeenCalledTimes(1);
        const config = markSetupComplete.mock.calls[0]?.[1] as { maxChannels: number; minItemsPerChannel: number };
        expect(config.maxChannels).toBe(MAX_CHANNELS);
        expect(config.minItemsPerChannel).toBe(1);
    });

    it('passes an explicit ready-subset choice to prepared Review when a second library scan fails', async () => {
        const container = createBodyAppendedTestContainer();
        const getSetupReview = jest.fn().mockResolvedValue(DEFAULT_REVIEW);
        const scanSetupInventory = jest.fn().mockResolvedValue({ scopeKey: 'scope', generation: 1,
            libraries: [
                { libraryId: 'movies', libraryName: 'Movies', requiredFamilies: ['genres'], status: 'ready', generation: 1 },
                { libraryId: 'shows', libraryName: 'Shows', requiredFamilies: ['playlists'], status: 'failed', generation: 1,
                    reason: 'Plex unavailable' },
            ], acceptedReadyLibraryIds: ['movies'], sharedPlaylistsStatus: 'ready' });
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([
                makeLibrary({ id: 'movies', title: 'Movies' }), makeLibrary({ id: 'shows', title: 'Shows', type: 'show' }),
            ]), scanSetupInventory, getSetupReview,
        });
        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show(); await flushPromises();
        clickButton(container, '#setup-scan'); await flushPromises();
        expect(container.textContent).toContain('Plex unavailable');
        expect(container.querySelector('#setup-retry-shows')).not.toBeNull();
        expect((container.querySelector('#setup-next') as HTMLButtonElement).disabled).toBe(false);
        expect(container.querySelector('#setup-ready-movies')?.getAttribute('aria-pressed')).toBe('false');
        clickButton(container, '#setup-ready-movies');
        expect(container.querySelector('#setup-ready-movies')?.getAttribute('aria-pressed')).toBe('true');
        expect(container.textContent).toContain('Excluded until ready: Shows');
        clickButton(container, '#setup-next');
        expect(container.querySelector('#setup-category-content-sources')).not.toBeNull();
        expect(getSetupReview).not.toHaveBeenCalled();
        clickButton(container, '#setup-next'); await flushPromises(); await flushPromises();
        expect(getSetupReview).toHaveBeenCalledTimes(1);
        expect(getSetupReview).toHaveBeenCalledWith(
            expect.objectContaining({ selectedLibraryIds: ['movies', 'shows'] }),
            expect.objectContaining({ acceptedReadyLibraryIds: ['movies'] })
        );
        expect(workflowPort.applySetupReview).not.toHaveBeenCalled();
        screen.hide();
    });

    it('passes explicit complete-library deselection consent to prepared Review', async () => {
        const container = createBodyAppendedTestContainer();
        const getSetupReview = jest.fn().mockResolvedValue(DEFAULT_REVIEW);
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([
                makeLibrary({ id: 'movies', title: 'Movies' }), makeLibrary({ id: 'shows', title: 'Shows', type: 'show' }),
            ]), getSetupReview,
        });
        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show(); await flushPromises();
        clickButton(container, '#setup-scan'); await flushPromises();
        clickButton(container, '#setup-lib-shows');
        expect(container.textContent).toContain('Shows · Keep existing channels');
        clickButton(container, '#setup-deselected-shows');
        clickButton(container, '#setup-scan'); await flushPromises();
        clickButton(container, '#setup-next');
        clickButton(container, '#setup-next'); await flushPromises(); await flushPromises();
        expect(getSetupReview).toHaveBeenCalledWith(expect.objectContaining({ selectedLibraryIds: ['movies'] }),
            expect.objectContaining({ confirmedDeselectedLibraryIds: ['shows'] }));
    });

    it('blocks Configure during a scan and permits it after cancellation', async () => {
        const container = createBodyAppendedTestContainer();
        let resolveScan: (value: ChannelSetupInventory) => void = () => undefined;
        const scanSetupInventory = jest.fn(() => new Promise<ChannelSetupInventory>((resolve) => { resolveScan = resolve; }));
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]), scanSetupInventory,
        });
        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show(); await flushPromises();
        clickButton(container, '#setup-scan');
        expect(container.querySelector('#setup-scan')?.textContent).toBe('Cancel scan');
        expect((container.querySelector('#setup-next') as HTMLButtonElement).disabled).toBe(true);
        clickButton(container, '#setup-scan');
        expect(container.querySelector('#setup-lib-movies.selected')).not.toBeNull();
        expect(container.querySelector('#setup-scan')?.textContent).toBe('Scan selected libraries');
        expect((container.querySelector('#setup-next') as HTMLButtonElement).disabled).toBe(false);
        clickButton(container, '#setup-next');
        expect(container.querySelector('#setup-category-content-sources')).not.toBeNull();
        resolveScan({ scopeKey: 'scope', generation: 1, libraries: [], acceptedReadyLibraryIds: [],
            sharedPlaylistsStatus: 'unused' });
        await flushPromises();
        expect(container.querySelector('#setup-category-content-sources')).not.toBeNull();
        expect(workflowPort.getSetupReview).not.toHaveBeenCalled();
        screen.hide();
    });

    it('permits Configure after a failed scan and retains the selected library when retrying', async () => {
        const container = createBodyAppendedTestContainer();
        const failed = { scopeKey: 'scope', generation: 1, libraries: [
            { libraryId: 'movies', libraryName: 'Movies', requiredFamilies: ['genres'], status: 'failed',
                generation: 1, reason: 'Plex unavailable' } ], acceptedReadyLibraryIds: [], sharedPlaylistsStatus: 'unused' };
        const ready = { ...failed, generation: 2, libraries: [
            { libraryId: 'movies', libraryName: 'Movies', requiredFamilies: ['genres'], status: 'ready', generation: 2 }],
            acceptedReadyLibraryIds: ['movies'] };
        const scanSetupInventory = jest.fn().mockResolvedValueOnce(failed).mockResolvedValueOnce(ready);
        const retrySetupInventory = jest.fn();
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies', title: 'Movies' })]),
            scanSetupInventory, retrySetupInventory,
        });
        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show(); await flushPromises();
        clickButton(container, '#setup-scan'); await flushPromises();
        expect((container.querySelector('#setup-next') as HTMLButtonElement).disabled).toBe(false);
        clickButton(container, '#setup-next');
        expect(container.querySelector('#setup-category-content-sources')).not.toBeNull();
        clickButton(container, '#setup-back');
        expect(container.querySelector('#setup-lib-movies.selected')).not.toBeNull();
        clickButton(container, '#setup-retry-movies'); await flushPromises();
        expect(retrySetupInventory).toHaveBeenCalledWith('movies');
        expect(container.querySelector('#setup-lib-movies.selected')).not.toBeNull();
        expect((container.querySelector('#setup-next') as HTMLButtonElement).disabled).toBe(false);
        expect(container.textContent).toContain('1 ready for Review');
        expect(workflowPort.getSetupReview).not.toHaveBeenCalled();
        screen.hide();
    });

    it('persists Random, lineup seed, start anchor, and specials choices through reviewed Apply', async () => {
        const container = createBodyAppendedTestContainer();
        const markSetupComplete = jest.fn((_serverId, config) => ({ ok: true as const,
            record: { ...config, createdAt: 0, updatedAt: 0 } }));
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            applySetupReview: jest.fn().mockResolvedValue({ kind: 'committed', summary: DEFAULT_BUILD_RESULT }),
            markSetupComplete,
        });
        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show(); await flushPromises(); await enterStep2(container);
        clickButton(container, '#setup-category-series-ordering');
        expect(container.querySelectorAll('.setup-playback-card')).toHaveLength(4);
        clickButton(container, '#setup-playback-random');
        clickButton(container, '#setup-include-specials');
        const seed = container.querySelector<HTMLInputElement>('#setup-lineup-seed');
        if (!seed) throw new Error('seed input missing');
        seed.value = '43018'; seed.dispatchEvent(new Event('change', { bubbles: true }));
        const anchor = container.querySelector<HTMLInputElement>('#setup-start-anchor');
        if (!anchor) throw new Error('anchor input missing');
        anchor.value = '2026-10-31T18:00'; anchor.dispatchEvent(new Event('change', { bubbles: true }));
        const diagnostics = screen.getPlannerDiagnosticsConfig();
        expect(diagnostics?.seriesOrdering).toEqual(expect.objectContaining({
            basePlaybackMode: 'random', includeSpecials: false, lineupSeed: 43018,
            startTimeAnchor: new Date('2026-10-31T18:00').getTime(),
        }));
        clickButton(container, '#setup-next'); await flushPromises(); await flushPromises();
        clickButton(container, '#setup-confirm'); await flushPromises();
        expect(markSetupComplete).toHaveBeenCalledTimes(1);
        expect(markSetupComplete.mock.calls[0]?.[1].seriesOrdering).toEqual(diagnostics?.seriesOrdering);
    });

    it('shows canceled Apply without saving and retains the Review', async () => {
        const container = createBodyAppendedTestContainer();
        const navigation = createNavigationMock();
        const applySetupReview = jest.fn().mockResolvedValue({ kind: 'canceled' });
        const { workflowPort, screenPorts } = createSplitScreenPorts({
            getNavigation: jest.fn(() => navigation as unknown as INavigationManager),
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]), applySetupReview,
        });
        const screen = new ChannelSetupScreen(container, createScreenDeps({ workflowPort, screenPorts }));
        screen.show(); await flushPromises(); await enterStep2(container);
        clickButton(container, '#setup-next'); await flushPromises(); await flushPromises();
        clickButton(container, '#setup-confirm'); await flushPromises();
        expect(container.textContent).toContain('Canceled');
        expect(container.textContent).toContain('Nothing was saved');
        clickButton(container, '#setup-back');
        expect(container.textContent).toContain('Review your lineup');
        expect(navigation.replaceScreen).not.toHaveBeenCalled();
    });

});
