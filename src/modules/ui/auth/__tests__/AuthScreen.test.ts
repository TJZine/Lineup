/**
 * @jest-environment jsdom
 */

import { AuthScreen } from '../AuthScreen';

jest.mock('qrcode', () => ({
    toCanvas: jest.fn().mockResolvedValue(undefined),
}));

describe('AuthScreen', () => {
    it('hide() should stop expiry timer and invalidate polling token', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const orchestrator = {
            requestAuthPin: jest.fn(),
            pollForPin: jest.fn(),
            cancelPin: jest.fn(),
            getNavigation: jest.fn(() => null),
        } as unknown as { [key: string]: unknown };

        const screen = new AuthScreen(container, orchestrator as unknown as never);

        const screenAny = screen as unknown as { _pollToken: number; _expiryTimer: number | null };
        screenAny._pollToken = 41;
        screenAny._expiryTimer = window.setInterval(() => undefined, 1000);

        screen.hide();

        expect(screenAny._expiryTimer).toBeNull();
        expect(screenAny._pollToken).toBe(42);

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

        jest.useRealTimers();
        container.remove();
    });
});
