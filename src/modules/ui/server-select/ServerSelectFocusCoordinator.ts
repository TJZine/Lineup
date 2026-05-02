import type {
    FocusableElement,
    ServerSelectScreenNavigationPort,
} from '../../navigation';

export const SERVER_SELECT_FOCUS_RESTORE_DELAY_MS = 50;

export type ServerSelectStaticButtons = {
    refreshButton: HTMLButtonElement;
    setupButton: HTMLButtonElement;
    switchProfileButton: HTMLButtonElement;
    clearButton: HTMLButtonElement;
};

export class ServerSelectFocusCoordinator {
    private _registeredServerButtonIds: string[] = [];
    private _restoreFocusTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private _restoreFocusGeneration: number | null = null;

    destroy(): void {
        this.cancelRestoreFocus();
        this._registeredServerButtonIds = [];
    }

    hasPendingRestoreFocus(generation: number): boolean {
        return this._restoreFocusTimeoutId !== null
            && this._restoreFocusGeneration === generation;
    }

    registerFocusables(
        nav: ServerSelectScreenNavigationPort | null,
        buttons: ServerSelectStaticButtons
    ): void {
        if (!nav) return;

        this.registerStaticButtons(nav, buttons, null);
        nav.setFocus('btn-server-refresh', { persist: false });
    }

    unregisterFocusables(nav: ServerSelectScreenNavigationPort | null): void {
        if (!nav) return;

        nav.unregisterFocusable('btn-server-refresh');
        nav.unregisterFocusable('btn-server-setup');
        nav.unregisterFocusable('btn-server-switch-profile');
        nav.unregisterFocusable('btn-server-forget');

        this.unregisterServerListFocusables(nav);
    }

    updateStaticButtonNeighbors(
        nav: ServerSelectScreenNavigationPort | null,
        buttons: ServerSelectStaticButtons,
        firstListFocusableId: string | null
    ): void {
        if (!nav) return;

        this.registerStaticButtons(nav, buttons, firstListFocusableId);
    }

    unregisterServerListFocusables(nav: ServerSelectScreenNavigationPort | null): void {
        if (this._registeredServerButtonIds.length === 0) {
            return;
        }
        if (nav) {
            for (const id of this._registeredServerButtonIds) {
                nav.unregisterFocusable(id);
            }
        }
        this._registeredServerButtonIds = [];
    }

    registerServerButtonFocusables(
        nav: ServerSelectScreenNavigationPort | null,
        buttons: ServerSelectStaticButtons,
        serverButtons: HTMLButtonElement[]
    ): void {
        this.unregisterServerListFocusables(nav);

        const enabledServerButtons = serverButtons.filter((button) => !button.disabled);
        if (nav) {
            for (let i = 0; i < enabledServerButtons.length; i++) {
                const button = enabledServerButtons[i];
                if (!button) continue;
                const neighbors: FocusableElement['neighbors'] = {};
                const upButtonId = i === 0 ? 'btn-server-refresh' : enabledServerButtons[i - 1]?.id;
                const downButtonId = enabledServerButtons[i + 1]?.id;
                if (upButtonId) {
                    neighbors.up = upButtonId;
                }
                if (downButtonId) {
                    neighbors.down = downButtonId;
                }
                nav.registerFocusable({
                    id: button.id,
                    element: button,
                    neighbors,
                    restoreGroup: 'server-select-list',
                    restorePriority: 1000 - i,
                    onFocus: () => {
                        try {
                            button.scrollIntoView({ block: 'nearest' });
                        } catch {
                            button.scrollIntoView();
                        }
                    },
                });
            }
        }
        this._registeredServerButtonIds = enabledServerButtons.map((button) => button.id);

        this.updateStaticButtonNeighbors(nav, buttons, enabledServerButtons[0]?.id ?? null);
    }

    restoreFocus(options: {
        nav: ServerSelectScreenNavigationPort | null;
        generation: number;
        canUpdateUi: (generation: number) => boolean;
        onPending: () => void;
        onSettled: () => void;
    }): void {
        const { nav, generation } = options;
        if (!nav) return;

        this.cancelRestoreFocus();
        this._restoreFocusGeneration = generation;
        this._restoreFocusTimeoutId = setTimeout(() => {
            this._restoreFocusTimeoutId = null;
            this._restoreFocusGeneration = null;
            if (!options.canUpdateUi(generation)) return;
            if (nav.restoreFocusForCurrentScreen()) {
                options.onSettled();
                return;
            }
            nav.setFocus('btn-server-refresh');
            options.onSettled();
        }, SERVER_SELECT_FOCUS_RESTORE_DELAY_MS);
        options.onPending();
    }

    cancelRestoreFocus(): void {
        if (this._restoreFocusTimeoutId !== null) {
            clearTimeout(this._restoreFocusTimeoutId);
            this._restoreFocusTimeoutId = null;
            this._restoreFocusGeneration = null;
        }
    }

    private registerStaticButtons(
        nav: ServerSelectScreenNavigationPort,
        buttons: ServerSelectStaticButtons,
        firstListFocusableId: string | null
    ): void {
        const staticButtons: Array<{
            id: string;
            element: HTMLButtonElement;
            left?: string;
            right?: string;
        }> = [
            {
                id: 'btn-server-refresh',
                element: buttons.refreshButton,
                right: 'btn-server-setup',
            },
            {
                id: 'btn-server-setup',
                element: buttons.setupButton,
                left: 'btn-server-refresh',
                right: 'btn-server-switch-profile',
            },
            {
                id: 'btn-server-switch-profile',
                element: buttons.switchProfileButton,
                left: 'btn-server-setup',
                right: 'btn-server-forget',
            },
            {
                id: 'btn-server-forget',
                element: buttons.clearButton,
                left: 'btn-server-switch-profile',
            },
        ];

        for (const button of staticButtons) {
            const neighbors: FocusableElement['neighbors'] = {};
            if (button.left) {
                neighbors.left = button.left;
            }
            if (button.right) {
                neighbors.right = button.right;
            }
            if (firstListFocusableId) {
                neighbors.down = firstListFocusableId;
            }
            nav.registerFocusable({
                id: button.id,
                element: button.element,
                neighbors,
            });
        }
    }
}
