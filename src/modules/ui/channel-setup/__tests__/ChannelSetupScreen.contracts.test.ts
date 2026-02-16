/**
 * @jest-environment jsdom
 */

import { ChannelSetupScreen } from '../ChannelSetupScreen';
import type { ChannelSetupOrchestrator } from '../ChannelSetupScreen';
import type { PlexLibrary } from '../../../plex/library/types';
import type { FocusableElement, INavigationManager, KeyEvent } from '../../../navigation/interfaces';
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
    createChannelsFromSetup: jest.fn().mockResolvedValue({
        created: 1,
        skipped: 0,
        reachedMaxChannels: false,
        errorCount: 0,
        canceled: false,
        lastTask: 'done',
    }),
    markSetupComplete: jest.fn(),
    getSetupPreview: jest.fn().mockResolvedValue({
        estimates: {
            total: 0,
            collections: 0,
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
    }),
    getSetupReview: jest.fn().mockResolvedValue({
        preview: {
            estimates: {
                total: 0,
                collections: 0,
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
        },
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
    }),
    ...overrides,
} satisfies ChannelSetupOrchestrator);

const clickButton = (container: HTMLElement, selector: string): void => {
    const element = container.querySelector(selector);
    if (!(element instanceof HTMLButtonElement)) {
        throw new Error(`Button not found: ${selector}`);
    }
    element.click();
};

describe('ChannelSetupScreen contracts', () => {
    afterEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('preserves first-pass DOM IDs across all steps', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSetupContextForSelectedServer: jest.fn(() => 'existing'),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();

        expect(container.querySelector('#setup-select-all')).not.toBeNull();
        expect(container.querySelector('#setup-clear-all')).not.toBeNull();
        expect(container.querySelector('#setup-next')).not.toBeNull();

        clickButton(container, '#setup-next');
        await flushPromises();
        expect(container.querySelector('#setup-category-content-sources')).not.toBeNull();
        expect(container.querySelector('#setup-build-mode')).toBeNull();

        clickButton(container, '#setup-category-build-options');
        expect(container.querySelector('#setup-build-mode')).not.toBeNull();

        clickButton(container, '#setup-next');
        await flushPromises();
        await flushPromises();
        expect(container.querySelector('#setup-back')).not.toBeNull();
        expect(container.querySelector('#setup-confirm')).not.toBeNull();
    });

    it('preserves fast-path build screen IDs for first-time setup', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = createOrchestrator({
            getLibrariesForSetup: jest.fn().mockResolvedValue([makeLibrary({ id: 'movies' })]),
            getSetupContextForSelectedServer: jest.fn(() => 'first-time'),
            getSelectedServerId: jest.fn(() => 'server-1'),
        });

        const screen = new ChannelSetupScreen(container, orchestrator);
        screen.show();
        await flushPromises();
        clickButton(container, '#setup-next');
        await flushPromises();
        clickButton(container, '#setup-next');
        await flushPromises();

        expect(container.querySelector('#setup-back')).not.toBeNull();
        expect(container.querySelector('#setup-done')).not.toBeNull();
    });

    it('unregisters previously registered focusables before each rerender', async () => {
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

        clickButton(container, '#setup-select-all');
        expect(nav.unregisterFocusable).toHaveBeenCalled();
    });

    it('preserves Step 2 category->detail transfer behavior', async () => {
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
        clickButton(container, '#setup-next');
        await flushPromises();

        nav.setMockFocus('setup-category-content-sources');
        const event = nav.emitKeyPress('right');
        expect(event.handled).toBe(true);
        expect(nav.setFocus).toHaveBeenLastCalledWith('setup-strategy-collections');
    });
});
