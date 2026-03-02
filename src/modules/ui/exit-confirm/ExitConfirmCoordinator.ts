import type { INavigationManager } from '../../navigation';
import { EXIT_CONFIRM_ACTION_IDS, EXIT_CONFIRM_MODAL_ID } from './constants';
import type { ExitConfirmModal } from './ExitConfirmModal';

type ExitConfirmDeps = {
    getNavigation: () => INavigationManager | null;
    getModal: () => ExitConfirmModal | null;
};

export class ExitConfirmCoordinator {
    private readonly _deps: ExitConfirmDeps;
    private _registeredIds: string[] = [];

    constructor(deps: ExitConfirmDeps) {
        this._deps = deps;
    }

    handleModalOpen(modalId: string): void {
        if (modalId !== EXIT_CONFIRM_MODAL_ID) return;
        if (typeof document === 'undefined') return;
        const navigation = this._deps.getNavigation();
        const modal = this._deps.getModal();
        if (!navigation || !modal) return;

        for (const id of this._registeredIds) {
            try {
                navigation.unregisterFocusable(id);
            } catch {
                // ignore cleanup errors
            }
        }
        this._registeredIds = [];

        modal.show({
            title: 'Exit Lineup?',
            message: 'You will return to the Home screen.',
            cancelLabel: 'Cancel',
            exitLabel: 'Exit',
        });

        const cancelEl = document.getElementById(EXIT_CONFIRM_ACTION_IDS.cancel);
        const exitEl = document.getElementById(EXIT_CONFIRM_ACTION_IDS.exit);
        if (!(cancelEl instanceof HTMLElement) || !(exitEl instanceof HTMLElement)) {
            try {
                navigation.closeModal(EXIT_CONFIRM_MODAL_ID);
            } catch {
                // ignore close errors
            }
            return;
        }

        this._registeredIds = [EXIT_CONFIRM_ACTION_IDS.cancel, EXIT_CONFIRM_ACTION_IDS.exit];
        navigation.registerFocusable({
            id: EXIT_CONFIRM_ACTION_IDS.cancel,
            element: cancelEl,
            neighbors: { right: EXIT_CONFIRM_ACTION_IDS.exit },
            onSelect: (): void => {
                navigation.closeModal(EXIT_CONFIRM_MODAL_ID);
            },
        });
        navigation.registerFocusable({
            id: EXIT_CONFIRM_ACTION_IDS.exit,
            element: exitEl,
            neighbors: { left: EXIT_CONFIRM_ACTION_IDS.cancel },
            onSelect: (): void => {
                // webOS packaged apps treat window.close() as an app-exit signal.
                window.close();
            },
        });

        // Default focus to "Cancel" to reduce accidental exits.
        navigation.setFocus(EXIT_CONFIRM_ACTION_IDS.cancel, { persist: false });
    }

    handleModalClose(modalId: string): void {
        if (modalId !== EXIT_CONFIRM_MODAL_ID) return;
        if (typeof document === 'undefined') return;
        const navigation = this._deps.getNavigation();
        const modal = this._deps.getModal();
        if (!modal) return;

        for (const id of this._registeredIds) {
            try {
                navigation?.unregisterFocusable(id);
            } catch {
                // ignore cleanup errors
            }
        }
        this._registeredIds = [];
        modal.hide();
    }
}
