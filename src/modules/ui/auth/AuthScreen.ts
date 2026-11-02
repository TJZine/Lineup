import { PlexApiError, type PlexPinCancellationResult, type PlexPinRequest } from '../../plex/auth';
import type { AuthScreenNavigationPort } from '../../navigation';
import { AppErrorCode, getAppErrorCode } from '../../../types/app-errors';
import { setTrustedInlineSvg } from '../../../utils/inlineSvg';
import { createScreenShell } from '../common/ScreenShell';
import type { ScreenError, ScreenStatus, ScreenTone } from '../types/screen-shell';
import { createAuthPinLayout, renderAuthCountdownBadge, renderAuthPin, setAuthPinWaiting } from './AuthPinDisplay';
import { PLEX_LINK_QR_SVG } from './plexLinkQrSvg';

export interface AuthScreenPorts {
    requestAuthPin(options?: { signal?: AbortSignal | null }): Promise<PlexPinRequest>;
    pollForPin(pinId: number, options?: { signal?: AbortSignal | null }): Promise<PlexPinRequest>;
    cancelPin(pinId: number): Promise<PlexPinCancellationResult>;
    getNavigation(): AuthScreenNavigationPort | null;
}

type PinCleanupPurpose = 'cancel' | 'expiry' | 'new-request';

type PendingPinCleanup = {
    pinId: number;
    purpose: PinCleanupPurpose;
};

export class AuthScreen {
    private _container: HTMLElement;
    private _ports: AuthScreenPorts;
    private _shellSetStatus: ((status: ScreenStatus | null) => void) | null = null;
    private _shellSetError: ((error: ScreenError | null) => void) | null = null;
    private _pinLiveEl: HTMLElement;
    private _pinBoxesEl: HTMLElement;
    private _qrWrapEl: HTMLElement;
    private _qrCardEl: HTMLElement;
    private _manualActionsEl: HTMLElement;
    private _openBrowserButton: HTMLButtonElement;
    private _copyCodeButton: HTMLButtonElement;
    private _statusEl: HTMLElement;
    private _detailEl: HTMLElement;
    private _requestButton: HTMLButtonElement;
    private _cancelButton: HTMLButtonElement;
    private _retryButton: HTMLButtonElement;
    private _requestToken: number = 0;
    private _pollToken: number = 0;
    private _cleanupToken: number = 0;
    private _expiryTimer: number | null = null;
    private _expiresAt: Date | null = null;
    private _activePinId: number | null = null;
    private _activeCode: string | null = null;
    private _pollAbortController: AbortController | null = null;
    private _pendingPinCleanup: PendingPinCleanup | null = null;
    private _cleanupInFlight: boolean = false;
    private _explicitCancelRequestToken: number | null = null;
    private _activeRequestToken: number | null = null;
    private _retryFocusableRegistered: boolean = false;
    private _cancelHasRetryNeighbor: boolean = false;
    private _cancelHasManualActionNeighbor: boolean = false;
    private _manualActionsVisible: boolean = false;
    private _manualActionsRegistered: boolean = false;
    private _destroyScreenShell: (() => void) | null = null;
    private readonly _handleRequestClick: () => void;
    private readonly _handleCancelClick: () => void;
    private readonly _handleRetryClick: () => void;

    constructor(container: HTMLElement, ports: AuthScreenPorts) {
        this._container = container;
        this._ports = ports;
        this._container.classList.add('screen', 'onboarding-screen', 'auth-screen');

        this._handleRequestClick = (): void => {
            this._runScreenAction(() => this._handleRequestPin(), 'Failed to request PIN.');
        };
        this._handleCancelClick = (): void => {
            this._runScreenAction(() => this._handleCancel(), 'Failed to cancel PIN.');
        };
        this._handleRetryClick = (): void => {
            this._runScreenAction(() => this._handleRetry(), 'Failed to retry PIN operation.');
        };

        const shell = createScreenShell(this._container, {
            variant: 'onboarding',
            title: 'Sign in to Plex',
            subtitle: 'Scan with your phone, or enter the code at plex.tv/link.',
            status: {
                title: 'Ready to request a PIN.',
                tone: 'neutral',
                ariaLive: 'polite',
            },
            actions: [
                {
                    id: 'btn-auth-request',
                    label: 'Request sign-in code',
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

        const pinLayout = createAuthPinLayout(shell.contentEl, this._statusEl);
        this._qrWrapEl = pinLayout.qrWrapEl;
        this._qrCardEl = pinLayout.qrCardEl;
        this._pinLiveEl = pinLayout.pinLiveEl;
        this._pinBoxesEl = pinLayout.pinBoxesEl;
        this._manualActionsEl = pinLayout.manualActionsEl;
        this._openBrowserButton = pinLayout.openBrowserButton;
        this._copyCodeButton = pinLayout.copyCodeButton;
        this._openBrowserButton.addEventListener('click', () => this._handleOpenBrowser());
        this._copyCodeButton.addEventListener('click', () => {
            void this._handleCopyCode();
        });
        this._renderPin('----');

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
        const pinIdToCancel = this._activePinId ?? this._pendingPinCleanup?.pinId ?? null;
        const cleanupAlreadyInFlight = this._cleanupInFlight;
        this._requestToken += 1;
        this._pollToken += 1;
        this._cleanupToken += 1;
        this._activeRequestToken = null;
        this._explicitCancelRequestToken = null;
        this._pendingPinCleanup = null;
        this._cleanupInFlight = false;
        this._abortActivePolling();
        this._retireActivePinLocally();
        this._restoreIdleState();
        if (pinIdToCancel !== null && !cleanupAlreadyInFlight) {
            this._cancelPinBestEffort(pinIdToCancel);
        }
        this._unregisterFocusables();
        this._container.style.display = 'none';
        this._container.classList.remove('visible');
    }

    private async _handleRequestPin(): Promise<void> {
        if (this._pendingPinCleanup || this._cleanupInFlight) return;
        this._retryButton.textContent = 'Retry';
        this._requestToken += 1;
        const requestToken = this._requestToken;
        this._explicitCancelRequestToken = null;
        this._clearError();
        this._pollToken += 1;
        const pollToken = this._pollToken;
        this._abortActivePolling();
        const previousPinId = this._activePinId;
        this._retireActivePinLocally();

        if (previousPinId !== null) {
            this._setButtons({ request: false, cancel: false, retry: false });
            this._setStatus('Removing the previous sign-in code…', '', { tone: 'loading' });
            await this._attemptPinCleanup(
                { pinId: previousPinId, purpose: 'new-request' },
                requestToken,
                pollToken
            );
            return;
        }

        await this._requestNewPin(requestToken);
    }

    private async _requestNewPin(requestToken: number): Promise<void> {
        const pollToken = this._pollToken;
        if (!this._isCurrentAuthUiOperation(requestToken, pollToken)) return;
        this._setButtons({ request: false, cancel: true, retry: false });
        this._setStatus('Requesting PIN…', '', { tone: 'loading' });
        this._detailEl.textContent = '';
        this._setCountdownWarningVisible(false);
        this._activeRequestToken = requestToken;

        try {
            const pin = await this._ports.requestAuthPin();
            if (this._activeRequestToken === requestToken) {
                this._activeRequestToken = null;
            }
            if (requestToken !== this._requestToken || !this._isVisible()) {
                if (this._explicitCancelRequestToken === this._requestToken && this._isVisible()) {
                    this._explicitCancelRequestToken = null;
                    await this._attemptPinCleanup(
                        { pinId: pin.id, purpose: 'cancel' },
                        this._requestToken,
                        this._pollToken
                    );
                } else {
                    this._cancelPinBestEffort(pin.id);
                }
                return;
            }
            this._activePinId = pin.id;
            this._activeCode = pin.code;
            this._expiresAt = pin.expiresAt;
            this._renderPin(pin.code, { idle: false });
            this._renderQr();
            this._setManualActionsAvailable(true);
            this._startExpiryTimer();
            this._startPolling(pin);
        } catch (error) {
            if (this._activeRequestToken === requestToken) {
                this._activeRequestToken = null;
            }
            if (requestToken !== this._requestToken || !this._isVisible()) {
                if (this._explicitCancelRequestToken === this._requestToken && this._isVisible()) {
                    this._explicitCancelRequestToken = null;
                    this._showCancelledState();
                }
                return;
            }
            this._handleError(error, 'Failed to request PIN.');
            this._setButtons({ request: true, cancel: false, retry: true });
        }
    }

    private async _startPolling(pin: PlexPinRequest): Promise<void> {
        const token = this._pollToken;
        const requestToken = this._requestToken;
        this._abortActivePolling();
        const abortController = new AbortController();
        this._pollAbortController = abortController;
        this._setStatus('Waiting for sign-in…', '', { tone: 'loading' });
        setAuthPinWaiting(this._pinBoxesEl, true);

        try {
            const result = await this._ports.pollForPin(pin.id, { signal: abortController.signal });
            if (
                !this._isCurrentAuthUiOperation(requestToken, token)
                || this._activePinId !== pin.id
            ) {
                return;
            }
            if (this._pollAbortController === abortController) {
                this._pollAbortController = null;
            }
            this._stopExpiryTimer();
            this._setManualActionsAvailable(false);
            this._setStatus('Signed in.', 'Continuing startup…', { tone: 'success' });
            setAuthPinWaiting(this._pinBoxesEl, false);
            if (result.authToken) {
                this._renderPin(this._activeCode || pin.code, { idle: false });
            }
            this._activePinId = null;
            this._activeCode = null;
            this._expiresAt = null;
            this._setButtons({ request: false, cancel: false, retry: false });
        } catch (error) {
            if (
                !this._isCurrentAuthUiOperation(requestToken, token)
                || this._activePinId !== pin.id
            ) {
                return;
            }
            if (this._pollAbortController === abortController) {
                this._pollAbortController = null;
            }
            setAuthPinWaiting(this._pinBoxesEl, false);
            this._handleError(error, 'PIN polling failed.');
            if (error instanceof PlexApiError && error.retryable) {
                this._setStatus(
                    'Sign-in status check paused.',
                    'The code remains active until the countdown expires.',
                    { tone: 'warning' }
                );
                this._setButtons({ request: false, cancel: true, retry: true });
                return;
            }

            this._retireActivePinLocally();
            this._setStatus('Sign-in code is no longer active.', 'Request a new PIN to continue.', { tone: 'error' });
            this._setButtons({ request: true, cancel: false, retry: false });
        }
    }

    private async _handleCancel(): Promise<void> {
        const activeRequestToken = this._activeRequestToken;
        this._requestToken += 1;
        this._pollToken += 1;
        const requestToken = this._requestToken;
        const pollToken = this._pollToken;
        this._explicitCancelRequestToken = activeRequestToken !== null ? requestToken : null;
        this._abortActivePolling();
        const activePinId = this._activePinId;
        this._retireActivePinLocally();
        this._clearError();

        if (activePinId !== null) {
            await this._attemptPinCleanup({ pinId: activePinId, purpose: 'cancel' }, requestToken, pollToken);
            return;
        }

        if (!this._isCurrentAuthUiOperation(requestToken, pollToken)) {
            return;
        }

        if (activeRequestToken !== null) {
            this._setStatus('Stopping the PIN request…', 'Waiting for the request to finish so its code can be removed.', { tone: 'loading' });
            this._setButtons({ request: false, cancel: false, retry: false });
            return;
        }
        this._showCancelledState();
    }

    private async _handleRetry(): Promise<void> {
        if (this._pendingPinCleanup) {
            const pending = this._pendingPinCleanup;
            await this._attemptPinCleanup(pending, this._requestToken, this._pollToken);
            return;
        }
        await this._handleRequestPin();
    }

    private async _attemptPinCleanup(
        pending: PendingPinCleanup,
        requestToken: number,
        pollToken: number
    ): Promise<void> {
        const cleanupToken = ++this._cleanupToken;
        this._pendingPinCleanup = pending;
        this._cleanupInFlight = true;
        this._clearError();
        this._setButtons({ request: false, cancel: false, retry: false });
        this._setStatus(
            pending.purpose === 'new-request'
                ? 'Removing the previous sign-in code…'
                : pending.purpose === 'expiry'
                    ? 'Code expired. Confirming cleanup…'
                    : 'Cancelling sign-in code…',
            '',
            { tone: 'loading' }
        );

        let result: PlexPinCancellationResult;
        try {
            result = await this._ports.cancelPin(pending.pinId);
        } catch {
            result = { kind: 'cleanup-failed' };
        }

        if (
            cleanupToken !== this._cleanupToken
            || !this._isCurrentAuthUiOperation(requestToken, pollToken)
            || this._pendingPinCleanup?.pinId !== pending.pinId
        ) {
            return;
        }
        this._cleanupInFlight = false;

        if (result.kind === 'cleanup-failed') {
            this._setStatus(
                pending.purpose === 'expiry'
                    ? 'Code expired locally; cleanup is unconfirmed.'
                    : 'Cleanup is unconfirmed.',
                'The remote code may still be active. Retry cleanup before requesting another code.',
                { tone: 'error' }
            );
            this._showError('Unable to confirm code cleanup', 'The remote sign-in code may still be active. Retry cleanup to confirm it is removed.');
            this._retryButton.textContent = 'Retry cleanup';
            this._setButtons({ request: false, cancel: false, retry: true });
            return;
        }

        this._pendingPinCleanup = null;
        this._retryButton.textContent = 'Retry';
        this._clearError();
        if (pending.purpose === 'new-request') {
            await this._requestNewPin(requestToken);
            return;
        }
        if (pending.purpose === 'expiry') {
            this._setStatus('Code expired.', 'Request a new PIN to continue.', { tone: 'warning' });
            this._setButtons({ request: true, cancel: false, retry: false });
            return;
        }
        this._showCancelledState();
    }

    private _showCancelledState(): void {
        this._explicitCancelRequestToken = null;
        this._retireActivePinLocally();
        this._setStatus('Cancelled.', 'Request a new PIN to continue.', { tone: 'neutral' });
        this._setButtons({ request: true, cancel: false, retry: false });
    }

    private _retireActivePinLocally(): void {
        this._stopExpiryTimer();
        this._setManualActionsAvailable(false);
        this._activePinId = null;
        this._activeCode = null;
        this._expiresAt = null;
        setAuthPinWaiting(this._pinBoxesEl, false);
        this._renderPin('----');
        this._qrWrapEl.style.display = 'none';
        this._detailEl.textContent = '';
    }

    private _cancelPinBestEffort(pinId: number): void {
        try {
            void this._ports.cancelPin(pinId).catch(() => {
                // A stale or hidden screen cannot present cleanup state; retain best-effort remote cleanup.
            });
        } catch {
            // A stale or hidden screen cannot present cleanup state; retain best-effort remote cleanup.
        }
    }

    private _restoreIdleState(): void {
        this._setManualActionsAvailable(false);
        this._retryButton.textContent = 'Retry';
        this._clearError();
        setAuthPinWaiting(this._pinBoxesEl, false);
        this._renderPin('----');
        this._qrWrapEl.style.display = 'none';
        this._detailEl.textContent = '';
        this._setCountdownWarningVisible(false);
        this._setStatus('Ready to request a PIN.', '', { tone: 'neutral', ariaLive: 'polite' });
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
                    ...(this._cancelHasManualActionNeighbor ? { up: 'btn-auth-open-browser' } : {}),
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

        if (focusedIdBefore === 'btn-auth-request' && !state.request && state.cancel) {
            nav.setFocus('btn-auth-cancel');
        } else if (focusedIdBefore === 'btn-auth-cancel' && !state.cancel) {
            if (state.retry) {
                nav.setFocus('btn-auth-retry');
            } else if (state.request) {
                nav.setFocus('btn-auth-request');
            }
        }
    }

    private _handleOpenBrowser(): void {
        if (!this._activeCode) return;
        let opened = false;
        try {
            const browser = window.open('https://plex.tv/link', '_blank');
            opened = browser !== null;
            if (browser) {
                browser.opener = null;
            }
        } catch {
            opened = false;
        }

        if (opened) {
            this._setStatus('Plex sign-in opened.', 'Enter the code shown on this screen.', { tone: 'neutral', ariaLive: 'polite' });
        } else {
            this._setStatus('Open plex.tv/link on another device.', 'Enter the code shown on this screen to finish signing in.', { tone: 'warning', ariaLive: 'polite' });
        }
    }

    private async _handleCopyCode(): Promise<void> {
        const code = this._activeCode;
        const pinId = this._activePinId;
        if (!code || pinId === null) return;

        try {
            const clipboard = navigator.clipboard;
            if (!clipboard || typeof clipboard.writeText !== 'function') {
                throw new Error('Clipboard unavailable');
            }
            await clipboard.writeText(code);
            if (this._activePinId !== pinId || this._activeCode !== code || !this._isVisible()) return;
            this._setStatus('Code copied.', 'Enter it at plex.tv/link to finish signing in.', { tone: 'success', ariaLive: 'polite' });
        } catch {
            if (this._activePinId !== pinId || this._activeCode !== code || !this._isVisible()) return;
            this._setStatus('Code is visible on this screen.', 'Clipboard is unavailable. Enter it manually at plex.tv/link.', { tone: 'warning', ariaLive: 'polite' });
        }
    }

    private _setManualActionsAvailable(available: boolean): void {
        const isAvailable = available && this._activeCode !== null && this._activePinId !== null;
        this._manualActionsVisible = isAvailable;
        this._manualActionsEl.hidden = !isAvailable;
        this._openBrowserButton.disabled = !isAvailable;
        this._copyCodeButton.disabled = !isAvailable;
        this._syncManualActionFocusables();
    }

    private _syncManualActionFocusables(): void {
        const nav = this._ports.getNavigation();
        if (!nav) return;
        const shouldRegister = this._manualActionsVisible && this._isVisible();
        if (shouldRegister === this._manualActionsRegistered) return;

        if (!shouldRegister) {
            const focusedId = nav.getFocusedElement()?.id ?? null;
            nav.unregisterFocusable('btn-auth-open-browser');
            nav.unregisterFocusable('btn-auth-copy-code');
            this._manualActionsRegistered = false;
            this._syncCancelManualActionNeighbor();
            if (this._isVisible() && (focusedId === 'btn-auth-open-browser' || focusedId === 'btn-auth-copy-code')) {
                if (!this._cancelButton.disabled) {
                    nav.setFocus('btn-auth-cancel');
                } else if (!this._requestButton.disabled) {
                    nav.setFocus('btn-auth-request');
                } else if (this._retryFocusableRegistered) {
                    nav.setFocus('btn-auth-retry');
                }
            }
            return;
        }

        nav.unregisterFocusable('btn-auth-open-browser');
        nav.unregisterFocusable('btn-auth-copy-code');
        nav.registerFocusable({
            id: 'btn-auth-open-browser',
            element: this._openBrowserButton,
            neighbors: {
                right: 'btn-auth-copy-code',
                down: 'btn-auth-cancel',
            },
        });
        nav.registerFocusable({
            id: 'btn-auth-copy-code',
            element: this._copyCodeButton,
            neighbors: {
                left: 'btn-auth-open-browser',
                down: 'btn-auth-cancel',
            },
        });
        this._manualActionsRegistered = true;
        this._syncCancelManualActionNeighbor();
    }

    private _syncCancelManualActionNeighbor(): void {
        const shouldAddManualNeighbor = this._manualActionsRegistered;
        if (shouldAddManualNeighbor === this._cancelHasManualActionNeighbor) return;
        const nav = this._ports.getNavigation();
        if (!nav) return;

        const focusedId = nav.getFocusedElement()?.id ?? null;
        nav.unregisterFocusable('btn-auth-cancel');
        nav.registerFocusable({
            id: 'btn-auth-cancel',
            element: this._cancelButton,
            neighbors: {
                left: 'btn-auth-request',
                ...(this._cancelHasRetryNeighbor ? { right: 'btn-auth-retry' } : {}),
                ...(shouldAddManualNeighbor ? { up: 'btn-auth-open-browser' } : {}),
            },
        });
        this._cancelHasManualActionNeighbor = shouldAddManualNeighbor;
        if (focusedId === 'btn-auth-cancel') {
            nav.setFocus('btn-auth-cancel');
        }
    }

    private _renderPin(code: string, options?: { idle?: boolean }): void {
        renderAuthPin(this._pinLiveEl, this._pinBoxesEl, code, options);
    }

    private _clearError(): void {
        this._shellSetError?.(null);
    }

    private _runScreenAction(action: () => Promise<void>, fallbackMessage: string): void {
        const operation = action();
        const requestToken = this._requestToken;
        const pollToken = this._pollToken;
        const cleanupToken = this._cleanupToken;
        void operation.catch((error: unknown) => {
            if (
                !this._isCurrentAuthUiOperation(requestToken, pollToken)
                || cleanupToken !== this._cleanupToken
            ) {
                return;
            }
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
        const pinId = this._activePinId;
        if (pinId === null) {
            return;
        }
        const requestToken = this._requestToken;
        const pollToken = this._pollToken;
        if (!this._updateExpiryDetail(pinId, requestToken, pollToken)) return;
        this._expiryTimer = window.setInterval(() => {
            this._updateExpiryDetail(pinId, requestToken, pollToken);
        }, 1000);
    }

    private _updateExpiryDetail(pinId: number, requestToken: number, pollToken: number): boolean {
        if (
            this._activePinId !== pinId
            || !this._expiresAt
            || !this._isCurrentAuthUiOperation(requestToken, pollToken)
        ) {
            return false;
        }
        const remainingMs = Math.max(0, this._expiresAt.getTime() - Date.now());
        const totalSeconds = Math.floor(remainingMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        if (remainingMs <= 0) {
            void this._handleExpiredPin(pinId, requestToken, pollToken);
            return false;
        }

        renderAuthCountdownBadge(this._detailEl, remainingMs, formatted);
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

    private _abortActivePolling(): void {
        const controller = this._pollAbortController;
        this._pollAbortController = null;
        if (!controller || controller.signal.aborted) {
            return;
        }
        controller.abort();
    }

    private async _handleExpiredPin(pinId: number, previousRequestToken: number, previousPollToken: number): Promise<void> {
        if (
            this._activePinId !== pinId
            || !this._isCurrentAuthUiOperation(previousRequestToken, previousPollToken)
        ) {
            return;
        }
        this._stopExpiryTimer();
        this._requestToken += 1;
        this._pollToken += 1;
        const requestToken = this._requestToken;
        const pollToken = this._pollToken;
        this._abortActivePolling();
        this._retireActivePinLocally();
        await this._attemptPinCleanup({ pinId, purpose: 'expiry' }, requestToken, pollToken);
    }

    private _isCurrentAuthUiOperation(requestToken: number, pollToken: number): boolean {
        return requestToken === this._requestToken
            && pollToken === this._pollToken
            && this._isVisible();
    }

    private _isVisible(): boolean {
        return this._container.classList.contains('visible')
            && this._container.style.display !== 'none';
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

        this._syncManualActionFocusables();

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
        nav.unregisterFocusable('btn-auth-open-browser');
        nav.unregisterFocusable('btn-auth-copy-code');
        this._retryFocusableRegistered = false;
        this._cancelHasRetryNeighbor = false;
        this._manualActionsRegistered = false;
        this._cancelHasManualActionNeighbor = false;
    }
}
