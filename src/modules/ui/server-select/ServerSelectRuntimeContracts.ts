import type { PlexServer } from '../../plex/discovery/types';
import type {
    ServerSelectDisplayState,
    ServerSelectEmptyStateReason,
} from './types';

export interface ServerSelectRuntimeScreenAdapter {
    showContainer(): void;
    hideContainer(): void;
    isContainerVisible(): boolean;
    registerFocusables(): void;
    unregisterFocusables(): void;
    restoreFocus(generation: number, canUpdateUi: (generation: number) => boolean): void;
    cancelRestoreFocus(): void;
    unregisterServerListFocusables(): void;
    replaceServerListChildren(): void;
    renderServers(
        servers: PlexServer[],
        screenState: ServerSelectDisplayState,
        options?: { savedServerUnavailable?: boolean; emptyStateReason?: ServerSelectEmptyStateReason }
    ): void;
    setServerConnectButtonsDisabled(disabled: boolean): void;
    setControlsDisabled(disabled: boolean): void;
    setClearButtonDisabled(disabled: boolean): void;
    setAutoConnectHintVisible(visible: boolean): void;
    setStatus(status: string, detail: string, tone?: 'neutral' | 'loading' | 'success' | 'warning' | 'error'): void;
    clearError(): void;
    setError(message: string): void;
    setDetail(text: string): void;
    addStatusSpinner(): void;
    removeStatusSpinner(): void;
}
