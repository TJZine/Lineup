import type { PlexLibrarySection as PlexLibraryModel } from '../../../plex/library/types';
import type { FocusableElement, KeyEvent } from '../../../navigation/contracts/interfaces';
import type {
    ChannelBuildSummary,
} from '../../../../core/channel-setup/types';
import type { ChannelSetupScreenWorkflowPort } from '../../../../core/channel-setup/workflow/ChannelSetupScreenWorkflowPort';
import type { ChannelSetupScreenPorts } from '../ChannelSetupScreenPorts';
import type { ChannelSetupScreen } from '../ChannelSetupScreen';

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

export const makeLibrary = (overrides: Partial<PlexLibraryModel> = {}): PlexLibraryModel => {
    const defaults: PlexLibraryModel = {
        id: 'lib-1',
        uuid: 'uuid-1',
        title: 'Library',
        type: 'movie',
        agent: 'agent',
        scanner: 'scanner',
        contentCount: 0,
        lastScannedAt: new Date(0),
        art: null,
        thumb: null,
    };
    const { episodeCount, ...rest } = overrides;
    return {
        ...defaults,
        ...rest,
        ...(episodeCount !== undefined ? { episodeCount } : {}),
    };
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

export const DEFAULT_BUILD_RESULT: ChannelBuildSummary = {
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
            const originalEvent = {
                preventDefault: jest.fn(),
            } as unknown as KeyboardEvent;
            const event: KeyEvent = {
                button,
                isRepeat: false,
                isLongPress: false,
                timestamp: Date.now(),
                originalEvent,
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
    overrides: Partial<ChannelSetupScreenWorkflowPort & ChannelSetupScreenPorts> = {}
): ChannelSetupScreenWorkflowPort & ChannelSetupScreenPorts => ({
    ...createWorkflowPort(overrides),
    ...createScreenPorts(overrides),
});

export const createWorkflowPort = (
    overrides: Partial<ChannelSetupScreenWorkflowPort> = {}
): ChannelSetupScreenWorkflowPort => ({
    getLibrariesForSetup: jest.fn().mockResolvedValue([]),
    getChannelSetupRecord: jest.fn(() => null),
    getSetupContextForSelectedServer: jest.fn(() => 'unknown'),
    invalidateFacetSnapshot: jest.fn(),
    createChannelsFromSetup: jest.fn().mockResolvedValue(DEFAULT_BUILD_RESULT),
    markSetupComplete: jest.fn(),
    getSetupPreview: jest.fn().mockResolvedValue(DEFAULT_PREVIEW),
    getSetupReview: jest.fn().mockResolvedValue(DEFAULT_REVIEW),
    ...overrides,
});

export const createScreenPorts = (
    overrides: Partial<ChannelSetupScreenPorts> = {}
): ChannelSetupScreenPorts => ({
    getNavigation: jest.fn(() => null),
    getSelectedServerId: jest.fn(() => null),
    openServerSelect: jest.fn(),
    switchToChannelByNumber: jest.fn(),
    openEPG: jest.fn(),
    ...overrides,
});

export type SplitScreenTestPorts = {
    workflowPort: ChannelSetupScreenWorkflowPort;
    screenPorts: ChannelSetupScreenPorts;
    orchestrator: ChannelSetupScreenWorkflowPort & ChannelSetupScreenPorts;
};

export const createSplitScreenPorts = (
    overrides: Partial<ChannelSetupScreenWorkflowPort & ChannelSetupScreenPorts> = {}
): SplitScreenTestPorts => {
    const workflowPort = createWorkflowPort(overrides);
    const screenPorts = createScreenPorts(overrides);
    return {
        workflowPort,
        screenPorts,
        orchestrator: { ...workflowPort, ...screenPorts } satisfies ChannelSetupScreenWorkflowPort & ChannelSetupScreenPorts,
    };
};

export const createScreenDeps = (
    input: { workflowPort: ChannelSetupScreenWorkflowPort; screenPorts: ChannelSetupScreenPorts }
): ConstructorParameters<typeof ChannelSetupScreen>[1] => ({
    workflowPort: input.workflowPort,
    screenPorts: input.screenPorts,
});

// Intentionally button-only to enforce accessible remote-first UI semantics.
export const clickButton = (container: HTMLElement, selector: string): void => {
    const element = container.querySelector(selector);
    if (!(element instanceof HTMLButtonElement)) {
        throw new Error(`Button not found: ${selector}`);
    }
    element.click();
};
