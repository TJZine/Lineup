/**
 * @jest-environment jsdom
 */

import { AuthScreen, type AuthScreenPorts } from '../AuthScreen';
import type { AuthScreenNavigationPort } from '../../../navigation';

import { flushPromises } from '../../../../__tests__/helpers';

jest.mock('qrcode', () => ({
    toCanvas: jest.fn().mockResolvedValue(undefined),
}));

type NavigationMock = AuthScreenNavigationPort & {
    registerFocusable: jest.Mock;
    unregisterFocusable: jest.Mock;
    setFocus: jest.Mock;
    getFocusedElement: jest.Mock;
};

const createNavigationMock = (): NavigationMock => {
    let focusedId: string | null = null;
    return {
        registerFocusable: jest.fn(),
        unregisterFocusable: jest.fn((id: string) => {
            if (focusedId === id) {
                focusedId = null;
            }
        }),
        setFocus: jest.fn((id: string) => {
            focusedId = id;
        }),
        getFocusedElement: jest.fn(() =>
            focusedId
                ? {
                    id: focusedId,
                    element: document.createElement('div'),
                    neighbors: {},
                }
                : null
        ),
    };
};

const createPorts = (
    overrides: Partial<AuthScreenPorts> = {}
): AuthScreenPorts => ({
    requestAuthPin: jest.fn(),
    pollForPin: jest.fn(),
    cancelPin: jest.fn().mockResolvedValue(undefined),
    getNavigation: jest.fn(() => null),
    ...overrides,
});

const click = (container: HTMLElement, selector: string): void => {
    const element = container.querySelector(selector);
    if (!(element instanceof HTMLButtonElement)) {
        throw new Error(`Button not found: ${selector}`);
    }
    element.click();
};

describe('AuthScreen', () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('hide cancels the active PIN and stops polling', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const ports = createPorts({
            requestAuthPin: jest.fn().mockResolvedValue({
                id: 88,
                code: 'ABCD',
                expiresAt: new Date(Date.now() + 60_000),
                authToken: null,
                clientIdentifier: 'client-id',
            }),
            pollForPin: jest.fn().mockImplementation(
                // Never resolves - simulates indefinite polling until the screen is hidden/cancelled.
                () => new Promise(() => undefined)
            ),
        });

        const screen = new AuthScreen(container, ports);
        screen.show();

        click(container, '#btn-auth-request');
        await flushPromises();

        screen.hide();

        expect(ports.cancelPin).toHaveBeenCalledWith(88);
    });

    it('unregisters retry focusable and moves focus when retry disappears', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const nav = createNavigationMock();
        const ports = createPorts({
            requestAuthPin: jest.fn()
                .mockRejectedValueOnce(new Error('first request failed'))
                .mockResolvedValueOnce({
                    id: 101,
                    code: 'WXYZ',
                    expiresAt: new Date(Date.now() + 60_000),
                    authToken: null,
                    clientIdentifier: 'client-id',
                }),
            pollForPin: jest.fn().mockImplementation(
                // Never resolves - simulates ongoing poll.
                () => new Promise(() => undefined)
            ),
            getNavigation: jest.fn(() => nav),
        });

        const screen = new AuthScreen(container, ports);
        screen.show();

        click(container, '#btn-auth-request');
        await flushPromises();

        nav.setFocus('btn-auth-retry');
        click(container, '#btn-auth-retry');
        await flushPromises();

        expect(nav.unregisterFocusable).toHaveBeenCalledWith('btn-auth-retry');
        expect(nav.setFocus).toHaveBeenCalledWith('btn-auth-cancel');
    });

    it('updates the countdown detail from expiresAt', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-02-05T00:00:00.000Z'));

        const container = document.createElement('div');
        document.body.appendChild(container);

        const ports = createPorts({
            requestAuthPin: jest.fn().mockResolvedValue({
                id: 1,
                code: 'ABCD',
                expiresAt: new Date(Date.now() + 5_000),
                authToken: null,
                clientIdentifier: 'client-id',
            }),
            pollForPin: jest.fn().mockImplementation(() => new Promise(() => undefined)),
        });

        const screen = new AuthScreen(container, ports);
        screen.show();

        click(container, '#btn-auth-request');
        await flushPromises();

        jest.advanceTimersByTime(1_000);

        const detail = container.querySelector('.screen-detail');
        expect(detail?.textContent ?? '').toContain('Expires in');
    });

    it('clears PIN and QR when cancel is pressed', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const ports = createPorts({
            requestAuthPin: jest.fn().mockResolvedValue({
                id: 42,
                code: 'ABCD',
                expiresAt: new Date(Date.now() + 5_000),
                authToken: null,
                clientIdentifier: 'client-id',
            }),
            pollForPin: jest.fn().mockImplementation(() => new Promise(() => undefined)),
        });

        const screen = new AuthScreen(container, ports);
        screen.show();

        click(container, '#btn-auth-request');
        await flushPromises();

        click(container, '#btn-auth-cancel');
        await flushPromises();

        const pin = Array.from(container.querySelectorAll('.auth-pin-character'))
            .map((node) => node.textContent)
            .join('');
        const qr = container.querySelector('.auth-qr') as HTMLElement;
        const status = container.querySelector('.screen-status');

        expect(ports.cancelPin).toHaveBeenCalledWith(42);
        expect(pin).toBe('----');
        expect(qr.style.display).toBe('none');
        expect(status?.textContent ?? '').toContain('Cancelled.');
    });

    it('clears PIN and QR when code expires', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-02-05T00:00:00.000Z'));

        const container = document.createElement('div');
        document.body.appendChild(container);

        const ports = createPorts({
            requestAuthPin: jest.fn().mockResolvedValue({
                id: 77,
                code: 'WXYZ',
                expiresAt: new Date(Date.now() + 1_000),
                authToken: null,
                clientIdentifier: 'client-id',
            }),
            pollForPin: jest.fn().mockImplementation(() => new Promise(() => undefined)),
        });

        const screen = new AuthScreen(container, ports);
        screen.show();

        click(container, '#btn-auth-request');
        await flushPromises();

        jest.advanceTimersByTime(1_500);
        await flushPromises();

        const pin = Array.from(container.querySelectorAll('.auth-pin-character'))
            .map((node) => node.textContent)
            .join('');
        const qr = container.querySelector('.auth-qr') as HTMLElement;
        const status = container.querySelector('.screen-status');

        expect(ports.cancelPin).toHaveBeenCalledWith(77);
        expect(pin).toBe('----');
        expect(qr.style.display).toBe('none');
        expect(status?.textContent ?? '').toContain('Code expired.');
    });
});
