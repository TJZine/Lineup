/**
 * @jest-environment jsdom
 */

import { AuthScreen } from '../AuthScreen';

jest.mock('qrcode', () => ({
    toCanvas: jest.fn().mockResolvedValue(undefined),
}));

describe('AuthScreen', () => {
    it('hide() should stop expiry timer, invalidate polling token, and best-effort cancel active pin', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = {
            requestAuthPin: jest.fn(),
            pollForPin: jest.fn(),
            cancelPin: jest.fn(),
            getNavigation: jest.fn(() => null),
        } as unknown as { [key: string]: unknown };

        const screen = new AuthScreen(container, orchestrator as unknown as never);

        const screenAny = screen as unknown as {
            _pollToken: number;
            _expiryTimer: number | null;
            _activePinId: number | null;
        };
        screenAny._pollToken = 41;
        screenAny._expiryTimer = window.setInterval(() => undefined, 1000);
        screenAny._activePinId = 88;

        screen.hide();

        expect(screenAny._expiryTimer).toBeNull();
        expect(screenAny._pollToken).toBe(42);
        expect(orchestrator.cancelPin).toHaveBeenCalledWith(88);

        container.remove();
    });

    it('should unregister retry focusable when retry is hidden', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = {
            registerFocusable: jest.fn(),
            unregisterFocusable: jest.fn(),
            setFocus: jest.fn(),
            getFocusedElement: jest.fn(() => null),
        };

        const orchestrator = {
            requestAuthPin: jest.fn(),
            pollForPin: jest.fn(),
            cancelPin: jest.fn(),
            getNavigation: jest.fn(() => nav),
        } as unknown as { [key: string]: unknown };

        const screen = new AuthScreen(container, orchestrator as unknown as never);
        const screenAny = screen as unknown as { _renderQrBestEffort: () => Promise<void> };
        screenAny._renderQrBestEffort = jest.fn().mockResolvedValue(undefined);
        screen.show();

        // Hide retry and ensure it is unregistered (prevents focusing hidden element).
        (screen as unknown as { _setButtons: (s: { request: boolean; cancel: boolean; retry: boolean }) => void })
            ._setButtons({ request: true, cancel: false, retry: false });

        expect(nav.unregisterFocusable).toHaveBeenCalledWith('btn-auth-retry');

        container.remove();
    });

    it('moves focus off retry when retry is hidden while focused', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        let focusedId: string | null = null;
        const nav = {
            registerFocusable: jest.fn(),
            unregisterFocusable: jest.fn((id: string) => {
                if (focusedId === id) focusedId = null;
            }),
            setFocus: jest.fn((id: string) => {
                focusedId = id;
            }),
            getFocusedElement: jest.fn(() => (focusedId ? { id: focusedId } : null)),
        };

        const orchestrator = {
            requestAuthPin: jest.fn(),
            pollForPin: jest.fn(),
            cancelPin: jest.fn(),
            getNavigation: jest.fn(() => nav),
        } as unknown as { [key: string]: unknown };

        const screen = new AuthScreen(container, orchestrator as unknown as never);
        screen.show();

        const screenAny = screen as unknown as { _setButtons: (s: { request: boolean; cancel: boolean; retry: boolean }) => void };

        screenAny._setButtons({ request: true, cancel: false, retry: true });
        expect(focusedId).toBe('btn-auth-request');

        // Simulate user moved focus to retry while it is visible.
        focusedId = 'btn-auth-retry';

        screenAny._setButtons({ request: true, cancel: false, retry: false });
        expect(focusedId).toBe('btn-auth-request');

        container.remove();
    });

    it('uses expiresAt to update the countdown detail', async () => {
        jest.useFakeTimers();
        const now = new Date('2026-02-05T00:00:00.000Z');
        jest.setSystemTime(now);

        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = {
            requestAuthPin: jest.fn().mockResolvedValue({
                id: 1,
                code: 'ABCD',
                expiresAt: new Date(Date.now() + 5000),
                authToken: null,
                clientIdentifier: 'x',
            }),
            pollForPin: jest.fn().mockImplementation(() => new Promise(() => undefined)),
            cancelPin: jest.fn(),
            getNavigation: jest.fn(() => null),
        } as unknown as { [key: string]: unknown };

        const screen = new AuthScreen(container, orchestrator as unknown as never);
        screen.show();

        const requestButton = container.querySelector('#btn-auth-request') as HTMLButtonElement;
        requestButton.click();

        await Promise.resolve();

        jest.advanceTimersByTime(1000);

        const detail = container.querySelector('.screen-detail') as HTMLElement;
        expect(detail.textContent).toContain('Expires in');
        expect(detail.getAttribute('aria-live')).toBeNull();

        jest.useRealTimers();
        container.remove();
    });

    it('clears PIN and hides QR when canceling an active PIN', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = {
            requestAuthPin: jest.fn(),
            pollForPin: jest.fn(),
            cancelPin: jest.fn().mockResolvedValue(undefined),
            getNavigation: jest.fn(() => null),
        } as unknown as { [key: string]: unknown };

        const screen = new AuthScreen(container, orchestrator as unknown as never);
        const screenAny = screen as unknown as {
            _activePinId: number | null;
            _activeCode: string | null;
            _expiresAt: Date | null;
            _detailEl: HTMLElement;
            _qrWrapEl: HTMLElement;
            _renderPin: (code: string) => void;
            _handleCancel: () => Promise<void>;
        };

        screenAny._activePinId = 99;
        screenAny._activeCode = 'ABCD';
        screenAny._expiresAt = new Date(Date.now() + 60_000);
        screenAny._renderPin('ABCD');
        screenAny._qrWrapEl.style.display = 'flex';
        screenAny._detailEl.style.color = 'var(--color-warning)';

        await screenAny._handleCancel();

        const pin = Array.from(container.querySelectorAll('.auth-pin-character'))
            .map((node) => node.textContent)
            .join('');
        const qr = container.querySelector('.auth-qr') as HTMLElement;
        const status = container.querySelector('.screen-status') as HTMLElement;
        const detail = container.querySelector('.screen-detail') as HTMLElement;

        expect(orchestrator.cancelPin).toHaveBeenCalledWith(99);
        expect(pin).toBe('----');
        expect(qr.style.display).toBe('none');
        expect(status.textContent).toContain('Cancelled.');
        expect(detail.style.color).toBe('');
    });

    it('clears PIN and hides QR when PIN expires', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = {
            requestAuthPin: jest.fn(),
            pollForPin: jest.fn(),
            cancelPin: jest.fn().mockResolvedValue(undefined),
            getNavigation: jest.fn(() => null),
        } as unknown as { [key: string]: unknown };

        const screen = new AuthScreen(container, orchestrator as unknown as never);
        const screenAny = screen as unknown as {
            _activePinId: number | null;
            _activeCode: string | null;
            _expiresAt: Date | null;
            _detailEl: HTMLElement;
            _qrWrapEl: HTMLElement;
            _renderPin: (code: string) => void;
            _handleExpiredPin: () => Promise<void>;
        };

        screenAny._activePinId = 101;
        screenAny._activeCode = 'WXYZ';
        screenAny._expiresAt = new Date(Date.now() - 1_000);
        screenAny._renderPin('WXYZ');
        screenAny._qrWrapEl.style.display = 'flex';
        screenAny._detailEl.style.color = 'var(--color-warning)';

        await screenAny._handleExpiredPin();

        const pin = Array.from(container.querySelectorAll('.auth-pin-character'))
            .map((node) => node.textContent)
            .join('');
        const qr = container.querySelector('.auth-qr') as HTMLElement;
        const status = container.querySelector('.screen-status') as HTMLElement;
        const detail = container.querySelector('.screen-detail') as HTMLElement;

        expect(orchestrator.cancelPin).toHaveBeenCalledWith(101);
        expect(pin).toBe('----');
        expect(qr.style.display).toBe('none');
        expect(status.textContent).toContain('Code expired.');
        expect(detail.style.color).toBe('');
    });

    it('expired PIN state leaves only Request PIN as the primary available action', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = {
            requestAuthPin: jest.fn(),
            pollForPin: jest.fn(),
            cancelPin: jest.fn().mockResolvedValue(undefined),
            getNavigation: jest.fn(() => null),
        } as unknown as { [key: string]: unknown };

        const screen = new AuthScreen(container, orchestrator as unknown as never);
        const screenAny = screen as unknown as {
            _activePinId: number | null;
            _expiresAt: Date | null;
            _handleExpiredPin: () => Promise<void>;
        };
        screenAny._activePinId = 77;
        screenAny._expiresAt = new Date(Date.now() - 1);

        await screenAny._handleExpiredPin();

        const request = container.querySelector('#btn-auth-request') as HTMLButtonElement;
        const cancel = container.querySelector('#btn-auth-cancel') as HTMLButtonElement;
        const retry = container.querySelector('#btn-auth-retry') as HTMLButtonElement;
        expect(request.disabled).toBe(false);
        expect(cancel.disabled).toBe(true);
        expect(retry.style.display).toBe('none');
    });
});
