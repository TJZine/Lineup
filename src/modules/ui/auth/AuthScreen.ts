/**
 * @fileoverview Minimal Plex auth screen for PIN flow in simulator.
 * @module modules/ui/auth/AuthScreen
 * @version 1.0.0
 */

import { AppOrchestrator } from '../../../Orchestrator';
import { AppErrorCode, PlexApiError, type PlexPinRequest } from '../../plex/auth';
import { summarizeErrorForLog } from '../../../utils/errors';
import { createScreenShell } from '../common/ScreenShell';
import type { ScreenError, ScreenStatus, ScreenTone } from '../types/screen-shell';

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
    private _shellSetStatus: ((status: ScreenStatus | null) => void) | null = null;
    private _shellSetError: ((error: ScreenError | null) => void) | null = null;
    private _pinLiveEl: HTMLElement;
    private _pinBoxesEl: HTMLElement;
    private _qrWrapEl: HTMLElement;
    private _qrCanvasEl: HTMLCanvasElement;
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

    constructor(container: HTMLElement, orchestrator: AppOrchestrator) {
        this._container = container;
        this._orchestrator = orchestrator;
        this._container.classList.add('screen');
        this._container.style.position = 'absolute';
        this._container.style.inset = '0';
        this._container.style.display = 'none';
        this._container.style.alignItems = 'center';
        this._container.style.justifyContent = 'center';

        this._handleRequestClick = (): void => {
            this._handleRequestPin().catch((error: unknown) => {
                console.error('[AuthScreen] Request PIN failed:', summarizeErrorForLog(error));
            });
        };
        this._handleCancelClick = (): void => {
            this._handleCancel().catch((error: unknown) => {
                console.error('[AuthScreen] Cancel PIN failed:', summarizeErrorForLog(error));
            });
        };
        this._handleRetryClick = (): void => {
            this._handleRequestPin().catch((error: unknown) => {
                console.error('[AuthScreen] Retry request PIN failed:', summarizeErrorForLog(error));
            });
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

        const qrCanvas = document.createElement('canvas');
        qrCanvas.className = 'auth-qr-canvas';
        qrCanvas.width = 160;
        qrCanvas.height = 160;
        qrCard.appendChild(qrCanvas);
        qrWrap.appendChild(qrCard);
        shell.contentEl.insertBefore(qrWrap, this._statusEl);
        this._qrWrapEl = qrWrap;
        this._qrCanvasEl = qrCanvas;

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
            void Promise.resolve(this._orchestrator.cancelPin(activePinId)).catch(() => {
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
        this._detailEl.style.color = '';

        if (this._activePinId !== null) {
            // Cancel any in-flight poll and best-effort cancel server-side PIN.
            this._pollToken += 1;
            this._stopExpiryTimer();
            try {
                await this._orchestrator.cancelPin(this._activePinId);
            } catch {
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
        this._setStatus('Waiting for sign-in…', '', { tone: 'loading' });

        try {
            const result = await this._orchestrator.pollForPin(pin.id);
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

        const nav = this._orchestrator.getNavigation();
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
        this._setStatus('Code expired.', 'Request a new PIN to continue.', { tone: 'warning' });
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
