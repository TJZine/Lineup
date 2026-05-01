import { normalizeToastInput, type ToastInput, type ToastType } from '../../shared/toast';

const TOAST_THROTTLE_MS = 1500;
const TOAST_VISIBLE_MS = 5000;
const TOAST_FADE_MS = 200;
const DEFAULT_TOAST_ICON = 'ℹ️';
const TOAST_ICON_BY_TYPE: Record<ToastType, string> = {
    info: DEFAULT_TOAST_ICON,
    success: '✓',
    warning: '⚠️',
    error: '❌',
};

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

    private _hideContainer(container: HTMLElement | null): void {
        if (container === null) {
            return;
        }

        container.style.display = 'none';
        container.style.opacity = '0';
    }

    setContainer(container: HTMLElement | null): void {
        this._clearTimers();
        this._hideContainer(this._container);
        this._container = container;
        this._lastToastAt = 0;
    }

    show(input: ToastInput): void {
        if (this._container === null) {
            return;
        }

        const now = Date.now();
        if (now - this._lastToastAt < TOAST_THROTTLE_MS) {
            return;
        }
        this._lastToastAt = now;

        const { message, type } = normalizeToastInput(input);

        this._container.dataset.toastType = type;
        this._container.textContent = `${TOAST_ICON_BY_TYPE[type] ?? DEFAULT_TOAST_ICON} ${message}`;
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
            }, TOAST_FADE_MS);

            this._fadeStartTimer = null;
        }, TOAST_VISIBLE_MS);
    }

    dispose(): void {
        this._clearTimers();
        this._hideContainer(this._container);
        this._lastToastAt = 0;
        this._container = null;
    }
}
