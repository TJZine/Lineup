import type { LifecycleAppError } from '../../../modules/lifecycle/types';
import type { INavigationManager, NavigationModalPolicy } from '../../../modules/navigation';
import { emitBestEffortWarning, summarizeErrorForLog } from '../../../utils/errors';

export interface BlockingErrorOverlayAction {
    id?: string;
    label: string;
    isPrimary: boolean;
    action: () => void | Promise<void>;
}

export interface BlockingErrorOverlayPresentationOptions {
    modalPolicy?: NavigationModalPolicy;
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
    private _presentationVersion = 0;
    private _actionPending = false;
    private _modalPolicy: NavigationModalPolicy | undefined;

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

        this._container.replaceChildren();

        const content = document.createElement('div');
        content.className = 'error-content';
        const accessibleIdPrefix = this._container.id || 'app-blocking-error-overlay';

        const title = document.createElement('h2');
        title.id = `${accessibleIdPrefix}-title`;
        title.className = 'error-title';
        title.textContent = 'Something went wrong';
        content.appendChild(title);

        const message = document.createElement('p');
        message.id = `${accessibleIdPrefix}-message`;
        message.className = 'error-message';
        message.textContent = error.userMessage || error.message;
        content.appendChild(message);

        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'error-actions';

        const status = document.createElement('p');
        status.className = 'error-recovery-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');

        const nav = this._getNavigation();
        if (nav) {
            this._teardownNavigation(nav);
        }

        let primaryButton: HTMLButtonElement | null = null;
        const focusableIds: string[] = [];

        for (const action of actions) {
            const id = `error-overlay-action-${focusableIds.length}`;
            const button = document.createElement('button');
            button.id = id;
            button.dataset.action = action.id ?? this._toStableActionId(action.label);
            button.className = action.isPrimary ? 'error-button primary' : 'error-button secondary';
            button.textContent = action.label;
            button.addEventListener('click', () => {
                void this._runAction(action, status, button);
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
        content.appendChild(status);
        this._container.appendChild(content);
        this._container.removeAttribute('aria-label');
        this._container.setAttribute('aria-labelledby', title.id);
        this._container.setAttribute('aria-describedby', message.id);

        (primaryButton ?? actionsContainer.querySelector('button'))?.focus();

        this._focusableIds = focusableIds;
        const primaryIndex = actions.findIndex((action) => action.isPrimary);
        this._preferredFocusId = focusableIds[primaryIndex] ?? focusableIds[0] ?? null;
    }

    show(
        error: LifecycleAppError,
        actions: BlockingErrorOverlayAction[],
        options?: BlockingErrorOverlayPresentationOptions
    ): void {
        if (this._container === null) {
            return;
        }

        const nav = this._getNavigation();
        nav?.cancelPendingChannelInput();
        this._presentationVersion += 1;
        this._actionPending = false;
        this._modalPolicy = options?.modalPolicy;
        this._container.removeAttribute('aria-busy');
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
                if (this._modalPolicy) {
                    nav.openModal(this._modalId, this._focusableIds, this._modalPolicy);
                } else {
                    nav.openModal(this._modalId, this._focusableIds);
                }
            }
            const preferred = this._preferredFocusId ?? this._focusableIds[0] ?? null;
            if (preferred) {
                nav.setFocus(preferred, { persist: false });
            }
        }
    }

    hide(options?: { fromModalClose?: boolean }): void {
        this._presentationVersion += 1;
        this._actionPending = false;
        if (this._container) {
            this._container.classList.add('hidden');
            this._container.removeAttribute('aria-busy');
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
        this._modalPolicy = undefined;
    }

    private async _runAction(
        action: BlockingErrorOverlayAction,
        status: HTMLElement,
        selectedButton: HTMLButtonElement
    ): Promise<void> {
        if (this._actionPending) {
            return;
        }
        this._actionPending = true;
        const version = this._presentationVersion;
        this._setActionsDisabled(true);
        this._container?.setAttribute('aria-busy', 'true');
        status.textContent = `${action.label} in progress…`;

        try {
            await action.action();
            if (version !== this._presentationVersion) {
                return;
            }
            this.hide();
        } catch (error: unknown) {
            emitBestEffortWarning('Blocking error overlay action failed', {
                action: action.id ?? this._toStableActionId(action.label),
                error: summarizeErrorForLog(error),
            });
            if (version !== this._presentationVersion) {
                return;
            }
            this._actionPending = false;
            this._container?.removeAttribute('aria-busy');
            this._setActionsDisabled(false);
            status.textContent = `${action.label} failed. Please try again.`;
            const selectedButtonIsAvailable =
                this._container?.contains(selectedButton) === true && !selectedButton.disabled;
            const focusTarget = selectedButtonIsAvailable
                ? selectedButton
                : this._container?.querySelector<HTMLButtonElement>('[data-action="retry"]');
            if (!focusTarget) {
                return;
            }
            const navigation = this._getNavigation();
            if (navigation && focusTarget.id) {
                navigation.setFocus(focusTarget.id, { persist: false });
            } else {
                focusTarget.focus();
            }
        }
    }

    private _setActionsDisabled(disabled: boolean): void {
        const buttons = this._container?.querySelectorAll<HTMLButtonElement>('.error-actions button') ?? [];
        for (const button of buttons) {
            button.disabled = disabled;
        }
    }

    private _toStableActionId(label: string): string {
        const id = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return id || 'action';
    }
}
