import type { PlexLibrary as PlexLibraryType } from '../../../plex/library/types';
import type { FocusableElement, KeyEvent } from '../../../navigation/interfaces';
import { PLEX_DISCOVERY_CONSTANTS } from '../../../plex/discovery/constants';
import type { ChannelSetupOrchestrator } from '../ChannelSetupScreen';

type Focusable = Pick<FocusableElement, 'id' | 'neighbors'>;

export type NavigationMock = {
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

export const makeLibrary = (overrides: Partial<PlexLibraryType>): PlexLibraryType => {
    const lib: PlexLibraryType = {
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
    };

    if (overrides.episodeCount !== undefined) {
        lib.episodeCount = overrides.episodeCount;
    }

    return lib;
};

export const DEFAULT_PREVIEW = {
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
};

export const DEFAULT_REVIEW = {
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

export const DEFAULT_BUILD_RESULT = {
    created: 1,
    skipped: 0,
    reachedMaxChannels: false,
    errorCount: 0,
    canceled: false,
    lastTask: 'done',
};

export const createNavigationMock = (): NavigationMock => {
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
                handled: false,
            };
            keyPressHandler?.(event);
            return event;
        },
        setMockFocus: (id: string | null): void => {
            focusedId = id;
        },
    };
};

export const createOrchestrator = (
    overrides: Partial<ChannelSetupOrchestrator> = {}
): ChannelSetupOrchestrator => ({
    getNavigation: jest.fn(() => null),
    getLibrariesForSetup: jest.fn().mockResolvedValue([]),
    getChannelSetupRecord: jest.fn(() => null),
    getSetupContextForSelectedServer: jest.fn(() => 'unknown'),
    getSelectedServerStorageKey: jest.fn(() => PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY),
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
export const clickButton = (container: HTMLElement, selector: string): void => {
    const element = container.querySelector(selector);
    if (!(element instanceof HTMLButtonElement)) {
        throw new Error(`Button not found: ${selector}`);
    }
    element.click();
};
