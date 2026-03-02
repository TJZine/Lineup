import { EXIT_CONFIRM_ACTION_IDS } from './constants';

export type ExitConfirmViewModel = {
    title: string;
    message: string;
    cancelLabel?: string;
    exitLabel?: string;
};

export class ExitConfirmModal {
    private _container: HTMLElement | null = null;
    private _isVisible: boolean = false;

    initialize(config: { containerId: string }): void {
        if (typeof document === 'undefined') return;
        if (this._container) return;

        const el = document.getElementById(config.containerId);
        if (!el) {
            throw new Error(`ExitConfirmModal container #${config.containerId} not found`);
        }

        el.className = 'exit-confirm-container';
        el.classList.remove('visible');
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.textContent = '';

        this._container = el;
        this._isVisible = false;
    }

    destroy(): void {
        if (!this._container) return;
        this.hide();
        this._container.textContent = '';
        this._container.classList.remove('visible');
        this._container = null;
        this._isVisible = false;
    }

    isVisible(): boolean {
        return this._isVisible;
    }

    show(viewModel: ExitConfirmViewModel): void {
        if (!this._container) return;
        this._container.textContent = '';

        const titleId = 'exit-confirm-title';
        const messageId = 'exit-confirm-message';
        this._container.setAttribute('aria-labelledby', titleId);
        this._container.setAttribute('aria-describedby', messageId);

        const panel = document.createElement('div');
        panel.className = 'exit-confirm-panel';

        const inner = document.createElement('div');
        inner.className = 'exit-confirm-inner';

        const copy = document.createElement('div');
        copy.className = 'exit-confirm-copy';

        const title = document.createElement('h2');
        title.className = 'exit-confirm-title';
        title.id = titleId;
        title.textContent = viewModel.title;
        copy.appendChild(title);

        const message = document.createElement('p');
        message.className = 'exit-confirm-message';
        message.id = messageId;
        message.textContent = viewModel.message;
        copy.appendChild(message);

        const actions = document.createElement('div');
        actions.className = 'exit-confirm-actions';

        const cancelButton = document.createElement('button');
        cancelButton.id = EXIT_CONFIRM_ACTION_IDS.cancel;
        cancelButton.type = 'button';
        cancelButton.className = 'exit-confirm-action cancel';
        cancelButton.textContent = viewModel.cancelLabel ?? 'Cancel';
        actions.appendChild(cancelButton);

        const exitButton = document.createElement('button');
        exitButton.id = EXIT_CONFIRM_ACTION_IDS.exit;
        exitButton.type = 'button';
        exitButton.className = 'exit-confirm-action exit';
        exitButton.textContent = viewModel.exitLabel ?? 'Exit';
        actions.appendChild(exitButton);

        inner.appendChild(copy);
        inner.appendChild(actions);

        panel.appendChild(inner);
        this._container.appendChild(panel);

        this._container.classList.add('visible');
        this._isVisible = true;
    }

    hide(): void {
        if (!this._container) return;
        this._container.classList.remove('visible');
        this._container.textContent = '';
        this._container.removeAttribute('aria-labelledby');
        this._container.removeAttribute('aria-describedby');
        this._isVisible = false;
    }
}
