import { AppErrorCode, PlexApiError, type PlexPinRequest } from '../../plex/auth';
import type { AuthScreenNavigationPort } from '../../navigation';
import { getAppErrorCode } from '../../../types/app-errors';
import { setTrustedInlineSvg } from '../../../utils/inlineSvg';
import { createScreenShell } from '../common/ScreenShell';
import type { ScreenError, ScreenStatus, ScreenTone } from '../types/screen-shell';
import { PLEX_LINK_QR_SVG } from './plexLinkQrSvg';

export interface AuthScreenPorts {
    requestAuthPin(): Promise<PlexPinRequest>;
    pollForPin(pinId: number): Promise<PlexPinRequest>;
    cancelPin(pinId: number): Promise<void>;
    getNavigation(): AuthScreenNavigationPort | null;
}

export class AuthScreen {
    private _container: HTMLElement;
    private _ports: AuthScreenPorts;
    private _shellSetStatus: ((status: ScreenStatus | null) => void) | null = null;
    private _shellSetError: ((error: ScreenError | null) => void) | null = null;
    private _pinLiveEl: HTMLElement;
    private _pinBoxesEl: HTMLElement;
    private _qrWrapEl: HTMLElement;
    private _qrCardEl: HTMLElement;
    private _statusEl: HTMLElement;
    private _detailEl: HTMLElement;
    private _requestButton: HTMLButtonElement;
    private _cancelButton: HTMLButtonElement;
    private _retryButton: HTMLButtonElement;
    private _pollToken: number = 0;
    private _expiryTimer: number | null = null;
    private _expiresAt: Date | null = null;
    private _activePinId: number | null = null;
    private _activeCode: string | null = null;
    private _retryFocusableRegistered: boolean = false;
    private _cancelHasRetryNeighbor: boolean = false;
    private _destroyScreenShell: (() => void) | null = null;
    private readonly _handleRequestClick: () => void;
    private readonly _handleCancelClick: () => void;
    private readonly _handleRetryClick: () => void;

    constructor(container: HTMLElement, ports: AuthScreenPorts) {
        this._container = container;
        this._ports = ports;
        this._container.classList.add('screen');

        this._handleRequestClick = (): void => {
            this._runScreenAction(() => this._handleRequestPin(), 'Failed to request PIN.');
        };
        this._handleCancelClick = (): void => {
            this._runScreenAction(() => this._handleCancel(), 'Failed to cancel PIN.');
        };
        this._handleRetryClick = (): void => {
            this._runScreenAction(() => this._handleRequestPin(), 'Failed to request PIN.');
        };

        const shell = createScreenShell(this._container, {
            title: 'Sign in to Plex',
            subtitle: 'Scan the QR code or visit plex.tv/link',
            status: {
                title: 'Ready to request a PIN.',
                tone: 'neutral',
                ariaLive: 'polite',
            },
            actions: [
                {
                    id: 'btn-auth-request',
                    label: 'Request PIN',
                    variant: 'primary',
                    onSelect: this._handleRequestClick,
                },
                {
                    id: 'btn-auth-cancel',
                    label: 'Cancel',
                    variant: 'secondary',
                    onSelect: this._handleCancelClick,
                    disabled: true,
                },
                {
                    id: 'btn-auth-retry',
                    label: 'Retry',
                    variant: 'secondary',
                    onSelect: this._handleRetryClick,
                },
            ],
            error: null,
        });
        this._destroyScreenShell = shell.destroy;
        this._shellSetStatus = shell.setStatus;
        this._shellSetError = shell.setError;

        this._statusEl = shell.statusEl;
        this._detailEl = shell.detailEl;
        shell.errorEl.setAttribute('role', 'alert');
        shell.errorEl.setAttribute('aria-live', 'assertive');

        const qrWrap = document.createElement('div');
        qrWrap.className = 'auth-qr';
        qrWrap.style.display = 'none';

        const qrCard = document.createElement('div');
        qrCard.className = 'auth-qr-card';

        qrWrap.appendChild(qrCard);
        shell.contentEl.insertBefore(qrWrap, this._statusEl);
        this._qrWrapEl = qrWrap;
        this._qrCardEl = qrCard;

        const pinLive = document.createElement('div');
        pinLive.className = 'sr-only';
        pinLive.setAttribute('aria-live', 'polite');
        pinLive.setAttribute('aria-atomic', 'true');
        shell.contentEl.insertBefore(pinLive, this._statusEl);
        this._pinLiveEl = pinLive;

        const pinBoxes = document.createElement('div');
        pinBoxes.className = 'auth-pin-container';
        pinBoxes.setAttribute('aria-hidden', 'true');
        shell.contentEl.insertBefore(pinBoxes, this._statusEl);
        this._pinBoxesEl = pinBoxes;

        // Note: We cache action button references. If ScreenShell actions are ever re-rendered via shell.setActions(),
        // these references must be re-queried.
        const requestButton = shell.actionsEl.querySelector('#btn-auth-request');
        const cancelButton = shell.actionsEl.querySelector('#btn-auth-cancel');
        const retryButton = shell.actionsEl.querySelector('#btn-auth-retry');
        if (
            !(requestButton instanceof HTMLButtonElement)
            || !(cancelButton instanceof HTMLButtonElement)
            || !(retryButton instanceof HTMLButtonElement)
        ) {
            throw new Error('AuthScreen shell actions unavailable');
        }
        retryButton.style.display = 'none';

        this._requestButton = requestButton;
        this._cancelButton = cancelButton;
        this._retryButton = retryButton;
    }

    destroy(): void {
        this.hide();
        this._destroyScreenShell?.();
        this._destroyScreenShell = null;
    }

    show(): void {
        this._container.style.display = 'flex';
        this._container.classList.add('visible');
        this._registerFocusables();
    }

    hide(): void {
        this._stopExpiryTimer();
        this._pollToken += 1;
        const activePinId = this._activePinId;
        this._activePinId = null;
        this._activeCode = null;
        this._expiresAt = null;
        if (activePinId !== null) {
            void Promise.resolve(this._ports.cancelPin(activePinId)).catch(() => {
                // Best-effort cancellation while hiding screen.
            });
        }
        this._unregisterFocusables();
        this._container.style.display = 'none';
        this._container.classList.remove('visible');
    }

    private async _handleRequestPin(): Promise<void> {
        this._clearError();
        this._setButtons({ request: false, cancel: true, retry: false });
        this._setStatus('Requesting PIN…', '', { tone: 'loading' });
        this._renderPin('----');
        this._qrWrapEl.style.display = 'none';
        this._detailEl.textContent = '';
        this._setCountdownWarningVisible(false);

        if (this._activePinId !== null) {
            // Cancel any in-flight poll and best-effort cancel server-side PIN.
            this._pollToken += 1;
            this._stopExpiryTimer();
            try {
                await this._ports.cancelPin(this._activePinId);
            } catch {
                // Best-effort cancel; ignore errors.
            }
        }
        this._activePinId = null;
        this._activeCode = null;
        this._expiresAt = null;

        try {
            const pin = await this._ports.requestAuthPin();
            this._activePinId = pin.id;
            this._activeCode = pin.code;
            this._expiresAt = pin.expiresAt;
            this._renderPin(pin.code);
            this._renderQr();
            this._startExpiryTimer();
            this._startPolling(pin);
        } catch (error) {
            this._handleError(error, 'Failed to request PIN.');
            this._setButtons({ request: true, cancel: false, retry: true });
        }
    }

    private async _startPolling(pin: PlexPinRequest): Promise<void> {
        this._pollToken += 1;
        const token = this._pollToken;
        this._setStatus('Waiting for sign-in…', '', { tone: 'loading' });

        try {
            const result = await this._ports.pollForPin(pin.id);
            if (token !== this._pollToken) {
                return;
            }
            this._stopExpiryTimer();
            this._setStatus('Signed in.', 'Continuing startup…', { tone: 'success' });
            if (result.authToken) {
                this._renderPin(this._activeCode || pin.code);
            }
            this._setButtons({ request: false, cancel: false, retry: false });
        } catch (error) {
            if (token !== this._pollToken) {
                return;
            }
            this._stopExpiryTimer();
            this._handleError(error, 'PIN polling failed.');
            this._setButtons({ request: true, cancel: false, retry: true });
        }
    }

    private async _handleCancel(): Promise<void> {
        this._pollToken += 1;
        this._stopExpiryTimer();
        if (this._activePinId !== null) {
            try {
                await this._ports.cancelPin(this._activePinId);
            } catch {
                // Best-effort cancellation: user intent is to stop polling UI regardless of network state.
            }
        }
        this._activePinId = null;
        this._activeCode = null;
        this._expiresAt = null;
        this._renderPin('----');
        this._qrWrapEl.style.display = 'none';
        this._setStatus('Cancelled.', 'Request a new PIN to continue.', { tone: 'neutral' });
        this._setButtons({ request: true, cancel: false, retry: false });
    }

    private _setStatus(
        status: string,
        detail: string,
        options?: { tone?: ScreenTone; ariaLive?: ScreenStatus['ariaLive'] }
    ): void {
        if (!this._shellSetStatus) {
            this._statusEl.textContent = status;
            this._detailEl.textContent = detail;
            return;
        }
        if (status.length === 0) {
            this._shellSetStatus(null);
            return;
        }
        const next: ScreenStatus = { title: status, detail, tone: options?.tone ?? 'neutral' };
        if (options?.ariaLive) {
            next.ariaLive = options.ariaLive;
        }
        this._shellSetStatus(next);
    }

    private _setButtons(state: { request: boolean; cancel: boolean; retry: boolean }): void {
        this._requestButton.disabled = !state.request;
        this._cancelButton.disabled = !state.cancel;
        this._retryButton.style.display = state.retry ? 'inline-flex' : 'none';

        const nav = this._ports.getNavigation();
        if (!nav) {
            return;
        }

        const focusedIdBefore = nav.getFocusedElement()?.id ?? null;
        const retryWasRegistered = this._retryFocusableRegistered;

        if (state.retry) {
            if (!this._retryFocusableRegistered) {
                // Ensure we don't double-register and leak click handlers.
                nav.unregisterFocusable('btn-auth-retry');
                nav.registerFocusable({
                    id: 'btn-auth-retry',
                    element: this._retryButton,
                    neighbors: {
                        left: 'btn-auth-cancel',
                    },
                });
                this._retryFocusableRegistered = true;
            }
        } else if (this._retryFocusableRegistered) {
            const hadFocus = focusedIdBefore === 'btn-auth-retry';
            nav.unregisterFocusable('btn-auth-retry');
            this._retryFocusableRegistered = false;
            if (hadFocus) {
                if (state.request) {
                    nav.setFocus('btn-auth-request');
                } else if (state.cancel) {
                    nav.setFocus('btn-auth-cancel');
                }
            }
        }

        const shouldHaveRetryNeighbor = this._retryFocusableRegistered;
        if (this._cancelHasRetryNeighbor !== shouldHaveRetryNeighbor) {
            const focusedId = nav.getFocusedElement()?.id ?? null;
            nav.unregisterFocusable('btn-auth-cancel');
            nav.registerFocusable({
                id: 'btn-auth-cancel',
                element: this._cancelButton,
                neighbors: {
                    left: 'btn-auth-request',
                    ...(shouldHaveRetryNeighbor ? { right: 'btn-auth-retry' } : {}),
                },
            });
            if (focusedId === 'btn-auth-cancel') {
                nav.setFocus('btn-auth-cancel');
            }
            this._cancelHasRetryNeighbor = shouldHaveRetryNeighbor;
        }

        if (state.retry && !retryWasRegistered) {
            // Only auto-focus retry when it first appears AND focus is currently unset.
            // This avoids stealing focus from an explicitly focused request/cancel button.
            const focusedIdAfter = nav.getFocusedElement()?.id ?? null;
            if (!focusedIdAfter) {
                nav.setFocus('btn-auth-retry');
            }
        }
    }

    private _renderPin(code: string): void {
        this._pinLiveEl.textContent = `PIN code: ${code}`;
        this._pinBoxesEl.replaceChildren();
        for (const ch of code) {
            const box = document.createElement('div');
            box.className = 'auth-pin-character';
            box.textContent = ch;
            box.setAttribute('aria-hidden', 'true');
            this._pinBoxesEl.appendChild(box);
        }
    }

    private _clearError(): void {
        this._shellSetError?.(null);
    }

    private _runScreenAction(action: () => Promise<void>, fallbackMessage: string): void {
        void action().catch((error: unknown) => {
            this._handleError(error, fallbackMessage);
        });
    }

    private _handleError(error: unknown, fallback: string): void {
        const code = this._getAppErrorCode(error);
        if (
            code === AppErrorCode.SERVER_UNREACHABLE ||
            code === AppErrorCode.NETWORK_TIMEOUT ||
            code === AppErrorCode.NETWORK_UNAVAILABLE ||
            code === AppErrorCode.NETWORK_OFFLINE
        ) {
            this._showError('Connection error', 'Check your internet connection and try again.');
            return;
        }
        if (code === AppErrorCode.AUTH_RATE_LIMITED || code === AppErrorCode.RATE_LIMITED) {
            this._showError('Too many attempts', 'Please wait a moment and try again.');
            return;
        }
        const message = error instanceof Error ? error.message : fallback;
        this._showError('Something went wrong', message || fallback);
    }

    private _showError(title: string, message: string): void {
        this._shellSetError?.({
            title,
            message,
        });
    }

    private _startExpiryTimer(): void {
        this._stopExpiryTimer();
        if (!this._updateExpiryDetail()) {
            return;
        }
        this._expiryTimer = window.setInterval(() => {
            this._updateExpiryDetail();
        }, 1000);
    }

    private _updateExpiryDetail(): boolean {
        if (!this._expiresAt) {
            return false;
        }
        const remainingMs = Math.max(0, this._expiresAt.getTime() - Date.now());
        const totalSeconds = Math.floor(remainingMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        if (remainingMs <= 0) {
            void this._handleExpiredPin();
            return false;
        }

        this._detailEl.textContent = `Expires in ${formatted}`;
        this._setCountdownWarningVisible(remainingMs <= 120000);
        return true;
    }

    private _stopExpiryTimer(): void {
        if (this._expiryTimer !== null) {
            clearInterval(this._expiryTimer);
            this._expiryTimer = null;
        }
        this._setCountdownWarningVisible(false);
    }

    private async _handleExpiredPin(): Promise<void> {
        this._stopExpiryTimer();
        this._pollToken += 1;

        if (this._activePinId !== null) {
            try {
                await this._ports.cancelPin(this._activePinId);
            } catch {
                // best effort
            }
        }

        this._activePinId = null;
        this._activeCode = null;
        this._expiresAt = null;
        this._renderPin('----');
        this._qrWrapEl.style.display = 'none';
        this._setStatus('Code expired.', 'Request a new PIN to continue.', { tone: 'warning' });
        this._setButtons({ request: true, cancel: false, retry: false });
    }

    private _setCountdownWarningVisible(isVisible: boolean): void {
        this._detailEl.classList.toggle('screen-detail--warning', isVisible);
    }

    private _getAppErrorCode(error: unknown): AppErrorCode | null {
        if (error instanceof PlexApiError) {
            return getAppErrorCode(error.code);
        }
        if (error && typeof error === 'object' && 'code' in error) {
            return getAppErrorCode((error as { code?: unknown }).code);
        }
        return null;
    }

    private _renderQr(): void {
        setTrustedInlineSvg(this._qrCardEl, PLEX_LINK_QR_SVG);
        const svg = this._qrCardEl.querySelector('svg');
        if (svg instanceof SVGSVGElement) {
            svg.classList.add('auth-qr-canvas');
            this._qrWrapEl.style.display = 'flex';
            return;
        }

        this._qrWrapEl.style.display = 'none';
    }

    private _registerFocusables(): void {
        const nav = this._ports.getNavigation();
        if (!nav) return;

        nav.registerFocusable({
            id: 'btn-auth-request',
            element: this._requestButton,
            neighbors: {
                right: 'btn-auth-cancel',
            },
        });

        const retryVisible = this._retryButton.style.display !== 'none';
        nav.registerFocusable({
            id: 'btn-auth-cancel',
            element: this._cancelButton,
            neighbors: {
                left: 'btn-auth-request',
                ...(retryVisible ? { right: 'btn-auth-retry' } : {}),
            },
        });
        this._cancelHasRetryNeighbor = retryVisible;

        if (retryVisible) {
            nav.registerFocusable({
                id: 'btn-auth-retry',
                element: this._retryButton,
                neighbors: {
                    left: 'btn-auth-cancel',
                },
            });
            this._retryFocusableRegistered = true;
        } else {
            nav.unregisterFocusable('btn-auth-retry');
            this._retryFocusableRegistered = false;
        }

        // Set initial focus
        if (!this._requestButton.disabled) {
            nav.setFocus('btn-auth-request');
        } else if (!this._cancelButton.disabled) {
            nav.setFocus('btn-auth-cancel');
        }
    }

    private _unregisterFocusables(): void {
        const nav = this._ports.getNavigation();
        if (!nav) return;

        nav.unregisterFocusable('btn-auth-request');
        nav.unregisterFocusable('btn-auth-cancel');
        nav.unregisterFocusable('btn-auth-retry');
        this._retryFocusableRegistered = false;
        this._cancelHasRetryNeighbor = false;
    }
}
