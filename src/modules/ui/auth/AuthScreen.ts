/**
 * @fileoverview Minimal Plex auth screen for PIN flow in simulator.
 * @module modules/ui/auth/AuthScreen
 * @version 1.0.0
 */

import { AppOrchestrator } from '../../../Orchestrator';
import { AppErrorCode, PlexApiError, type PlexPinRequest } from '../../plex/auth';

type QrCodeModule = {
    toCanvas: (
        canvas: HTMLCanvasElement,
        text: string,
        options?: { width?: number; margin?: number; color?: { dark?: string; light?: string } }
    ) => Promise<void>;
};



export class AuthScreen {
    private _container: HTMLElement;
    private _orchestrator: AppOrchestrator;
    private _pinLiveEl: HTMLElement;
    private _pinBoxesEl: HTMLElement;
    private _qrWrapEl: HTMLElement;
    private _qrCanvasEl: HTMLCanvasElement;
    private _statusEl: HTMLElement;
    private _detailEl: HTMLElement;
    private _errorBoxEl: HTMLElement;
    private _errorTitleEl: HTMLElement;
    private _errorMessageEl: HTMLElement;
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
    private readonly _handleRequestClick: () => void;
    private readonly _handleCancelClick: () => void;
    private readonly _handleRetryClick: () => void;

    constructor(container: HTMLElement, orchestrator: AppOrchestrator) {
        this._container = container;
        this._orchestrator = orchestrator;
        this._container.classList.add('screen');
        this._container.style.position = 'absolute';
        this._container.style.inset = '0';
        this._container.style.display = 'none';
        this._container.style.alignItems = 'center';
        this._container.style.justifyContent = 'center';

        const panel = document.createElement('div');
        panel.className = 'screen-panel';

        const title = document.createElement('h1');
        title.className = 'screen-title';
        title.textContent = 'Sign in to Plex';
        panel.appendChild(title);

        const subtitle = document.createElement('p');
        subtitle.className = 'screen-subtitle';
        subtitle.textContent = 'Scan the QR code or visit plex.tv/link';
        panel.appendChild(subtitle);

        const qrWrap = document.createElement('div');
        qrWrap.className = 'auth-qr';
        qrWrap.style.display = 'none';

        const qrCard = document.createElement('div');
        qrCard.className = 'auth-qr-card';

        const qrCanvas = document.createElement('canvas');
        qrCanvas.className = 'auth-qr-canvas';
        qrCanvas.width = 160;
        qrCanvas.height = 160;
        qrCard.appendChild(qrCanvas);
        qrWrap.appendChild(qrCard);
        panel.appendChild(qrWrap);
        this._qrWrapEl = qrWrap;
        this._qrCanvasEl = qrCanvas;

        const pinLive = document.createElement('div');
        pinLive.className = 'sr-only';
        pinLive.setAttribute('aria-live', 'polite');
        pinLive.setAttribute('aria-atomic', 'true');
        panel.appendChild(pinLive);
        this._pinLiveEl = pinLive;

        const pinBoxes = document.createElement('div');
        pinBoxes.className = 'auth-pin-container';
        pinBoxes.setAttribute('aria-hidden', 'true');
        panel.appendChild(pinBoxes);
        this._pinBoxesEl = pinBoxes;

        const status = document.createElement('div');
        status.className = 'screen-status';
        status.textContent = 'Ready to request a PIN.';
        status.setAttribute('aria-live', 'polite');
        panel.appendChild(status);
        this._statusEl = status;

        const detail = document.createElement('div');
        detail.className = 'screen-detail';
        detail.textContent = '';
        panel.appendChild(detail);
        this._detailEl = detail;

        const errorBox = document.createElement('div');
        errorBox.className = 'inline-error-box';
        errorBox.style.display = 'none';
        errorBox.setAttribute('role', 'alert');
        errorBox.setAttribute('aria-live', 'assertive');

        const errorTitle = document.createElement('div');
        errorTitle.className = 'inline-error-title';
        errorBox.appendChild(errorTitle);
        this._errorTitleEl = errorTitle;

        const errorMessage = document.createElement('div');
        errorMessage.className = 'inline-error-message';
        errorBox.appendChild(errorMessage);
        this._errorMessageEl = errorMessage;

        panel.appendChild(errorBox);
        this._errorBoxEl = errorBox;

        const buttonRow = document.createElement('div');
        buttonRow.className = 'button-row';

        const requestButton = document.createElement('button');
        requestButton.id = 'btn-auth-request';
        requestButton.className = 'screen-button';
        requestButton.textContent = 'Request PIN';
        this._handleRequestClick = (): void => {
            this._handleRequestPin().catch(console.error);
        };
        requestButton.addEventListener('click', this._handleRequestClick);
        buttonRow.appendChild(requestButton);
        this._requestButton = requestButton;


        const cancelButton = document.createElement('button');
        cancelButton.id = 'btn-auth-cancel';
        cancelButton.className = 'screen-button secondary';
        cancelButton.textContent = 'Cancel';
        cancelButton.disabled = true;
        this._handleCancelClick = (): void => {
            this._handleCancel().catch(console.error);
        };
        cancelButton.addEventListener('click', this._handleCancelClick);
        buttonRow.appendChild(cancelButton);
        this._cancelButton = cancelButton;


        const retryButton = document.createElement('button');
        retryButton.id = 'btn-auth-retry';
        retryButton.className = 'screen-button secondary';
        retryButton.textContent = 'Retry';
        retryButton.style.display = 'none';
        this._handleRetryClick = (): void => {
            this._handleRequestPin().catch(console.error);
        };
        retryButton.addEventListener('click', this._handleRetryClick);
        buttonRow.appendChild(retryButton);
        this._retryButton = retryButton;


        panel.appendChild(buttonRow);
        this._container.appendChild(panel);
    }

    destroy(): void {
        this.hide();
        this._requestButton.removeEventListener('click', this._handleRequestClick);
        this._cancelButton.removeEventListener('click', this._handleCancelClick);
        this._retryButton.removeEventListener('click', this._handleRetryClick);
    }

    show(): void {
        this._container.style.display = 'flex';
        this._container.classList.add('visible');
        this._registerFocusables();
    }

    hide(): void {
        this._stopExpiryTimer();
        this._pollToken += 1;
        this._unregisterFocusables();
        this._container.style.display = 'none';
        this._container.classList.remove('visible');
    }


    private async _handleRequestPin(): Promise<void> {
        this._clearError();
        this._setButtons({ request: false, cancel: true, retry: false });
        this._setStatus('Requesting PIN…', '');
        this._renderPin('----');
        this._qrWrapEl.style.display = 'none';
        this._detailEl.textContent = '';
        this._detailEl.style.color = '';

        if (this._activePinId !== null) {
            // Cancel any in-flight poll and best-effort cancel server-side PIN.
            this._pollToken += 1;
            this._stopExpiryTimer();
            try {
                await this._orchestrator.cancelPin(this._activePinId);
            } catch (error) {
                console.warn('[AuthScreen] Failed to cancel PIN before requesting a new one:', error);
            }
        }
        this._activePinId = null;
        this._activeCode = null;
        this._expiresAt = null;

        try {
            const pin = await this._orchestrator.requestAuthPin();
            this._activePinId = pin.id;
            this._activeCode = pin.code;
            this._expiresAt = pin.expiresAt;
            this._renderPin(pin.code);
            void this._renderQrBestEffort();
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
        this._setStatus('Waiting for sign-in…', '');

        try {
            const result = await this._orchestrator.pollForPin(pin.id);
            if (token !== this._pollToken) {
                return;
            }
            this._stopExpiryTimer();
            this._setStatus('Signed in.', 'Continuing startup…');
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
                await this._orchestrator.cancelPin(this._activePinId);
            } catch {
                // Best-effort cancellation: user intent is to stop polling UI regardless of network state.
            }
        }
        this._activePinId = null;
        this._activeCode = null;
        this._expiresAt = null;
        this._renderPin('----');
        this._qrWrapEl.style.display = 'none';
        this._detailEl.style.color = '';
        this._setStatus('Cancelled.', 'Request a new PIN to continue.');
        this._setButtons({ request: true, cancel: false, retry: false });
    }

    private _setStatus(status: string, detail: string): void {
        this._statusEl.textContent = status;
        this._detailEl.textContent = detail;
    }

    private _setButtons(state: { request: boolean; cancel: boolean; retry: boolean }): void {
        this._requestButton.disabled = !state.request;
        this._cancelButton.disabled = !state.cancel;
        this._retryButton.style.display = state.retry ? 'inline-flex' : 'none';

        const nav = this._orchestrator.getNavigation();
        if (!nav) {
            return;
        }

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
            nav.unregisterFocusable('btn-auth-retry');
            this._retryFocusableRegistered = false;
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

        if (state.retry) {
            nav.setFocus('btn-auth-retry');
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
        this._errorBoxEl.style.display = 'none';
        this._errorTitleEl.textContent = '';
        this._errorMessageEl.textContent = '';
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
        this._errorBoxEl.style.display = 'flex';
        this._errorTitleEl.textContent = title;
        this._errorMessageEl.textContent = message;
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
        this._detailEl.style.color = remainingMs <= 120000 ? 'var(--color-warning)' : '';
        return true;
    }

    private _stopExpiryTimer(): void {
        if (this._expiryTimer !== null) {
            clearInterval(this._expiryTimer);
            this._expiryTimer = null;
        }
    }

    private async _handleExpiredPin(): Promise<void> {
        this._stopExpiryTimer();
        this._pollToken += 1;

        if (this._activePinId !== null) {
            try {
                await this._orchestrator.cancelPin(this._activePinId);
            } catch {
                // best effort
            }
        }

        this._activePinId = null;
        this._activeCode = null;
        this._expiresAt = null;
        this._renderPin('----');
        this._qrWrapEl.style.display = 'none';
        this._detailEl.style.color = '';
        this._setStatus('Code expired.', 'Request a new PIN to continue.');
        this._setButtons({ request: true, cancel: false, retry: false });
    }

    private _getAppErrorCode(error: unknown): AppErrorCode | null {
        if (error instanceof PlexApiError) {
            const plexCode = error.code;
            if (Object.values(AppErrorCode).includes(plexCode as AppErrorCode)) {
                return plexCode as AppErrorCode;
            }
        }
        if (error && typeof error === 'object' && 'code' in error) {
            const code = (error as { code?: unknown }).code;
            if (typeof code === 'string' && Object.values(AppErrorCode).includes(code as AppErrorCode)) {
                return code as AppErrorCode;
            }
        }
        return null;
    }

    private async _renderQrBestEffort(): Promise<void> {
        try {
            const mod = (await import('qrcode')) as unknown as QrCodeModule;
            await mod.toCanvas(this._qrCanvasEl, 'https://plex.tv/link', {
                width: 160,
                margin: 1,
                color: { dark: '#000000', light: '#ffffff' },
            });
            this._qrWrapEl.style.display = 'flex';
        } catch {
            this._qrWrapEl.style.display = 'none';
        }
    }

    private _registerFocusables(): void {
        const nav = this._orchestrator.getNavigation();
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
        const nav = this._orchestrator.getNavigation();
        if (!nav) return;

        nav.unregisterFocusable('btn-auth-request');
        nav.unregisterFocusable('btn-auth-cancel');
        nav.unregisterFocusable('btn-auth-retry');
        this._retryFocusableRegistered = false;
        this._cancelHasRetryNeighbor = false;
    }
}
