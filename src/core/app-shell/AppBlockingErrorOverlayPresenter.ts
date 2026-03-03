import type { LifecycleAppError } from '../../modules/lifecycle/types';
import type { INavigationManager } from '../../modules/navigation';

export interface BlockingErrorOverlayAction {
    label: string;
    isPrimary: boolean;
    action: () => void | Promise<void>;
}

export interface AppBlockingErrorOverlayPresenterOptions {
    getNavigation: () => INavigationManager | null;
    modalId?: string;
}

export class AppBlockingErrorOverlayPresenter {
    private readonly _getNavigation: () => INavigationManager | null;
    private readonly _modalId: string;
    private _container: HTMLElement | null = null;
    private _focusableIds: string[] = [];
    private _preferredFocusId: string | null = null;
    private _modalCloseHandler: ((payload: { modalId: string }) => void) | null = null;

    constructor(options: AppBlockingErrorOverlayPresenterOptions) {
        this._getNavigation = options.getNavigation;
        this._modalId = options.modalId ?? 'modal:error-overlay';
    }

    setContainer(container: HTMLElement | null): void {
        this._container = container;
    }

    private _teardownNavigation(nav: INavigationManager): void {
        if (this._modalCloseHandler) {
            nav.off('modalClose', this._modalCloseHandler);
            this._modalCloseHandler = null;
        }
        for (const id of this._focusableIds) {
            nav.unregisterFocusable(id);
        }
        this._focusableIds = [];
        this._preferredFocusId = null;
    }

    private _render(error: LifecycleAppError, actions: BlockingErrorOverlayAction[]): void {
        if (this._container === null) {
            return;
        }

        this._container.innerHTML = '';

        const content = document.createElement('div');
        content.className = 'error-content';

        const title = document.createElement('h2');
        title.className = 'error-title';
        title.textContent = 'Something went wrong';
        content.appendChild(title);

        const message = document.createElement('p');
        message.className = 'error-message';
        message.textContent = error.userMessage || error.message;
        content.appendChild(message);

        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'error-actions';

        const nav = this._getNavigation();
        if (nav) {
            this._teardownNavigation(nav);
        }

        let primaryButton: HTMLButtonElement | null = null;
        const focusableIds: string[] = [];

        for (const action of actions) {
            const id = `error-overlay-action-${focusableIds.length}`;
            const button = document.createElement('button');
            button.className = action.isPrimary ? 'error-button primary' : 'error-button secondary';
            button.textContent = action.label;
            button.addEventListener('click', () => {
                this.hide();
                void action.action();
            });

            if (action.isPrimary && !primaryButton) {
                primaryButton = button;
            }

            actionsContainer.appendChild(button);

            if (nav) {
                focusableIds.push(id);
                nav.registerFocusable({
                    id,
                    element: button,
                    group: this._modalId,
                    neighbors: {},
                });
            }
        }

        content.appendChild(actionsContainer);
        this._container.appendChild(content);

        (primaryButton ?? actionsContainer.querySelector('button'))?.focus();

        this._focusableIds = focusableIds;
        const primaryIndex = actions.findIndex((action) => action.isPrimary);
        this._preferredFocusId = focusableIds[primaryIndex] ?? focusableIds[0] ?? null;
    }

    show(error: LifecycleAppError, actions: BlockingErrorOverlayAction[]): void {
        if (this._container === null) {
            return;
        }

        const nav = this._getNavigation();
        const modalWasOpen = nav?.isModalOpen(this._modalId) ?? false;
        if (nav && modalWasOpen) {
            if (this._modalCloseHandler) {
                nav.off('modalClose', this._modalCloseHandler);
                this._modalCloseHandler = null;
            }
            nav.closeModal(this._modalId);
        }

        this._render(error, actions);
        this._container.classList.remove('hidden');

        if (nav && this._focusableIds.length > 0) {
            if (this._modalCloseHandler === null) {
                this._modalCloseHandler = ({ modalId }): void => {
                    if (modalId !== this._modalId) {
                        return;
                    }
                    this.hide({ fromModalClose: true });
                };
            }
            nav.on('modalClose', this._modalCloseHandler);
            if (!nav.isModalOpen(this._modalId)) {
                nav.openModal(this._modalId, this._focusableIds);
            }
            const preferred = this._preferredFocusId ?? this._focusableIds[0] ?? null;
            if (preferred) {
                nav.setFocus(preferred, { persist: false });
            }
        }
    }

    hide(options?: { fromModalClose?: boolean }): void {
        if (this._container) {
            this._container.classList.add('hidden');
        }

        const nav = this._getNavigation();
        if (!nav) {
            return;
        }
        if (!options?.fromModalClose) {
            nav.closeModal(this._modalId);
        }
        this._teardownNavigation(nav);
    }

    dispose(): void {
        this.hide();
        this._container = null;
        this._focusableIds = [];
        this._preferredFocusId = null;
        this._modalCloseHandler = null;
    }
}
