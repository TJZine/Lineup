import { normalizeToastInput, type ToastInput, type ToastType } from '../../modules/ui/toast/types';

export class AppToastPresenter {
    private _container: HTMLElement | null = null;
    private _fadeStartTimer: number | null = null;
    private _hideCompleteTimer: number | null = null;
    private _lastToastAt = 0;

    private _clearTimers(): void {
        if (this._fadeStartTimer !== null) {
            clearTimeout(this._fadeStartTimer);
            this._fadeStartTimer = null;
        }

        if (this._hideCompleteTimer !== null) {
            clearTimeout(this._hideCompleteTimer);
            this._hideCompleteTimer = null;
        }
    }

    setContainer(container: HTMLElement | null): void {
        this._clearTimers();
        this._container = container;
    }

    show(input: ToastInput): void {
        if (this._container === null) {
            return;
        }

        const now = Date.now();
        if (now - this._lastToastAt < 1500) {
            return;
        }
        this._lastToastAt = now;

        const { message, type } = normalizeToastInput(input);
        const iconByType: Record<ToastType, string> = {
            info: 'ℹ️',
            success: '✓',
            warning: '⚠️',
            error: '❌',
        };

        this._container.dataset.toastType = type;
        this._container.textContent = `${iconByType[type] ?? 'ℹ️'} ${message}`;
        this._container.style.display = 'block';
        this._container.style.opacity = '1';

        this._clearTimers();

        const target = this._container;
        this._fadeStartTimer = window.setTimeout(() => {
            if (!target) {
                return;
            }

            target.style.opacity = '0';
            this._hideCompleteTimer = window.setTimeout(() => {
                target.style.display = 'none';
                this._hideCompleteTimer = null;
            }, 200);

            this._fadeStartTimer = null;
        }, 5000);
    }

    dispose(): void {
        this._clearTimers();
        this._lastToastAt = 0;
        this._container = null;
    }
}
