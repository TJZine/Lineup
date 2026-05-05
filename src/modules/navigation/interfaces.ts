import type { PlatformRemoteButton } from '../../platform/services';
import type { IDisposable } from '../../utils/interfaces';

// Navigation module interfaces - local definitions matching the app's shared type surface.

export interface INavigationManager {
    initialize(config: NavigationConfig): void;
    destroy(): void;

    goTo(screen: 'server-select', params: ServerSelectNavigationParams): void;
    goTo(screen: 'server-select'): void;
    goTo(screen: Exclude<Screen, 'server-select'>): void;
    /**
     * Navigate back to the previous screen.
     * @returns true if navigation occurred, false if already at root screen
     */
    goBack(): boolean;
    replaceScreen(screen: Screen): void;
    getServerSelectParams(): ServerSelectNavigationParams | null;

    setFocus(elementId: string, options?: SetFocusOptions): void;
    restoreFocusForCurrentScreen(): boolean;
    getFocusedElement(): FocusableElement | null;
    /**
     * Move focus in the specified direction.
     * @returns true if focus moved, false if no neighbor found or movement blocked
     */
    moveFocus(direction: Direction): boolean;

    registerFocusable(element: FocusableElement): void;
    unregisterFocusable(elementId: string): void;
    registerFocusGroup(group: FocusGroup): void;
    unregisterFocusGroup(groupId: string): void;

    openModal(modalId: string, focusableIds?: string[]): void;
    /**
     * Close a modal.
     * @param modalId - ID of modal to close, or omit to close the topmost modal
     */
    closeModal(modalId?: string): void;
    /**
     * Check if a modal is open.
     * @param modalId - ID of modal to check, or omit to check if any modal is open
     * @returns true if the specified modal (or any modal) is open
     */
    isModalOpen(modalId?: string): boolean;

    blockInput(): void;
    unblockInput(): void;
    isInputBlocked(): boolean;

    getCurrentScreen(): Screen;
    getState(): NavigationState;

    on<K extends keyof NavigationEventMap>(
        event: K,
        handler: (payload: NavigationEventMap[K]) => void
    ): IDisposable;
    off<K extends keyof NavigationEventMap>(
        event: K,
        handler: (payload: NavigationEventMap[K]) => void
    ): void;

    handleLongPress(button: RemoteButton, callback: () => void): void;
    cancelLongPress(): void;
}

interface SetFocusOptions {
    /**
     * Persist focus memory for the current screen.
     * Defaults to true. Note: focus is never persisted while a modal is open.
     */
    persist?: boolean;
}

export interface IFocusManager {
    /**
     * Set focus on an element.
     * @returns true if focus was set successfully, false if element not found
     */
    focus(elementId: string): boolean;
    blur(): void;
    getElement(elementId: string): FocusableElement | null;
    findNeighbor(fromId: string, direction: Direction): string | null;
    saveFocusState(screenId: string): void;
    /**
     * Restore saved focus state for a screen.
     * @returns true if focus was restored, false if no saved state exists
     */
    restoreFocusState(screenId: string): boolean;
    updateFocusRing(elementId: string): void;
    hideFocusRing(): void;
}

export type RemoteButton = PlatformRemoteButton;

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface KeyEvent {
    button: RemoteButton;
    isRepeat: boolean;
    isLongPress: boolean;
    timestamp: number;
    originalEvent: KeyboardEvent;
    /** Whether a handler consumed the event (prevents NavigationManager default handling) */
    handled?: boolean;
}

export type NavigationAsyncFailureReporter = (
    event: string,
    message: string,
    error: unknown
) => void;

export type Screen =
    | 'splash'
    | 'auth'
    | 'profile-select'
    | 'server-select'
    | 'audio-setup'
    | 'channel-setup'
    | 'home'
    | 'player'
    | 'guide'
    | 'channel-edit'
    | 'settings'
    | 'error';

export interface ServerSelectNavigationParams {
    allowAutoConnect: boolean;
}

export interface NavigationConfig {
    /** Enable Magic Remote pointer mode */
    enablePointerMode: boolean;
    keyRepeatDelayMs: number;
    keyRepeatIntervalMs: number;
    focusMemoryEnabled: boolean;
    debugMode: boolean;
}

export interface NavigationState {
    currentScreen: Screen;
    screenStack: Screen[];
    focusedElementId: string | null;
    modalStack: string[];
    isPointerActive: boolean;
}

export interface FocusableElement {
    id: string;
    element: HTMLElement;
    group?: string;
    /** Relative precedence for restore fallback within a restore group (higher values are restored first). */
    restorePriority?: number;
    /** Restore group identifier used when saved focus id no longer exists */
    restoreGroup?: string;
    neighbors: {
        up?: string;
        down?: string;
        left?: string;
        right?: string;
    };
    onFocus?: () => void;
    onBlur?: () => void;
    onSelect?: () => void;
}

export interface FocusGroup {
    id: string;
    elements: string[];
    wrapAround: boolean;
    orientation: 'horizontal' | 'vertical' | 'grid';
    columns?: number;
}

export interface NavigationEventMap {
    keyPress: KeyEvent;
    keyUp: { button: RemoteButton };
    screenChange: { from: Screen; to: Screen };
    focusChange: { from: string | null; to: string };
    modalOpen: { modalId: string };
    modalClose: { modalId: string };
    pointerModeChange: { active: boolean };
    channelInputUpdate: { digits: string; isComplete: boolean };
    channelNumberEntered: { channelNumber: number };
    guide: undefined;
    settings: undefined;
}
