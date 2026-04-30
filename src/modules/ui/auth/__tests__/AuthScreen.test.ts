/**
 * @jest-environment jsdom
 */

import { AuthScreen, type AuthScreenPorts } from '../AuthScreen';
import type { AuthScreenNavigationPort } from '../../../navigation';
import * as inlineSvg from '../../../../utils/inlineSvg';

import { flushPromises } from '../../../../__tests__/helpers';

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

type Deferred<T> = {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (error?: unknown) => void;
};

const createDeferred = <T>(): Deferred<T> => {
    let resolve!: (value: T) => void;
    let reject!: (error?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

describe('AuthScreen', () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('relies on shared screen bootstrap while show and hide still own display lifecycle', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new AuthScreen(container, createPorts());

        expect(container.style.position).toBe('');
        expect(container.style.inset).toBe('');
        expect(container.style.display).toBe('');
        expect(container.style.alignItems).toBe('');
        expect(container.style.justifyContent).toBe('');

        screen.show();
        expect(container.style.display).toBe('flex');

        screen.hide();
        expect(container.style.display).toBe('none');
    });

    it('hide cancels the active PIN and stops polling', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        let pollSignal: AbortSignal | undefined;
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
                (_pinId: number, options?: { signal?: AbortSignal | null }) => {
                    pollSignal = options?.signal ?? undefined;
                    return new Promise(() => undefined);
                }
            ),
        });

        const screen = new AuthScreen(container, ports);
        screen.show();

        click(container, '#btn-auth-request');
        await flushPromises();

        screen.hide();

        expect(ports.pollForPin).toHaveBeenCalledWith(88, { signal: expect.any(AbortSignal) });
        expect(pollSignal?.aborted).toBe(true);
        expect(ports.cancelPin).toHaveBeenCalledWith(88);
    });

    it('cancel aborts the active poll before cancelling the server-side PIN', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const order: string[] = [];
        let pollSignal: AbortSignal | undefined;
        const ports = createPorts({
            requestAuthPin: jest.fn().mockResolvedValue({
                id: 42,
                code: 'ABCD',
                expiresAt: new Date(Date.now() + 60_000),
                authToken: null,
                clientIdentifier: 'client-id',
            }),
            pollForPin: jest.fn().mockImplementation(
                (_pinId: number, options?: { signal?: AbortSignal | null }) => {
                    pollSignal = options?.signal ?? undefined;
                    pollSignal?.addEventListener('abort', () => {
                        order.push('abort');
                    });
                    return new Promise(() => undefined);
                }
            ),
            cancelPin: jest.fn().mockImplementation(() => {
                order.push('cancelPin');
                return Promise.resolve();
            }),
        });

        const screen = new AuthScreen(container, ports);
        screen.show();

        click(container, '#btn-auth-request');
        await flushPromises();

        click(container, '#btn-auth-cancel');
        await flushPromises();

        expect(pollSignal?.aborted).toBe(true);
        expect(order).toEqual(['abort', 'cancelPin']);
        expect(ports.cancelPin).toHaveBeenCalledWith(42);
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

    it('toggles the countdown warning class and clears it on fresh requests and cancel', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-02-05T00:00:00.000Z'));

        const container = document.createElement('div');
        document.body.appendChild(container);

        const ports = createPorts({
            requestAuthPin: jest.fn()
                .mockResolvedValueOnce({
                    id: 1,
                    code: 'ABCD',
                    expiresAt: new Date(Date.now() + 90_000),
                    authToken: null,
                    clientIdentifier: 'client-id',
                })
                .mockResolvedValueOnce({
                    id: 2,
                    code: 'WXYZ',
                    expiresAt: new Date(Date.now() + 300_000),
                    authToken: null,
                    clientIdentifier: 'client-id',
                }),
            pollForPin: jest.fn().mockImplementation(() => new Promise(() => undefined)),
        });

        const screen = new AuthScreen(container, ports);
        screen.show();

        click(container, '#btn-auth-request');
        await flushPromises();

        const detail = container.querySelector('.screen-detail') as HTMLElement | null;
        expect(detail?.classList.contains('screen-detail--warning')).toBe(true);

        click(container, '#btn-auth-cancel');
        await flushPromises();
        expect(detail?.classList.contains('screen-detail--warning')).toBe(false);

        click(container, '#btn-auth-request');
        await flushPromises();
        expect(detail?.classList.contains('screen-detail--warning')).toBe(false);
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

    it('renders the Plex link QR as a trusted inline SVG with the existing canvas styling hook', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const ports = createPorts({
            requestAuthPin: jest.fn().mockResolvedValue({
                id: 9,
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

        const qrWrap = container.querySelector('.auth-qr') as HTMLElement | null;
        const qrSvg = container.querySelector('.auth-qr-card svg');

        expect(qrWrap?.style.display).toBe('flex');
        expect(qrSvg).toBeInstanceOf(SVGSVGElement);
        expect(qrSvg?.classList.contains('auth-qr-canvas')).toBe(true);
    });

    it('keeps the QR wrapper hidden when trusted inline SVG rendering leaves no svg element', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const inlineSvgSpy = jest.spyOn(inlineSvg, 'setTrustedInlineSvg').mockImplementation((host) => {
            host.replaceChildren();
        });

        const ports = createPorts({
            requestAuthPin: jest.fn().mockResolvedValue({
                id: 9,
                code: 'ABCD',
                expiresAt: new Date(Date.now() + 5_000),
                authToken: null,
                clientIdentifier: 'client-id',
            }),
            pollForPin: jest.fn().mockImplementation(() => new Promise(() => undefined)),
        });

        try {
            const screen = new AuthScreen(container, ports);
            screen.show();

            click(container, '#btn-auth-request');
            await flushPromises();

            const qrWrap = container.querySelector('.auth-qr') as HTMLElement | null;
            const qrSvg = container.querySelector('.auth-qr-card svg');

            expect(qrWrap?.style.display).toBe('none');
            expect(qrSvg).toBeNull();
        } finally {
            inlineSvgSpy.mockRestore();
        }
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
        const detail = container.querySelector('.screen-detail') as HTMLElement | null;

        expect(ports.cancelPin).toHaveBeenCalledWith(77);
        expect(pin).toBe('----');
        expect(qr.style.display).toBe('none');
        expect(status?.textContent ?? '').toContain('Code expired.');
        expect(detail?.classList.contains('screen-detail--warning')).toBe(false);
    });

    it('clears the countdown warning class when polling succeeds after the warning threshold', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-02-05T00:00:00.000Z'));

        const container = document.createElement('div');
        document.body.appendChild(container);

        const pollDeferred = createDeferred<{
            id: number;
            code: string;
            expiresAt: Date;
            authToken: string | null;
            clientIdentifier: string;
        }>();

        const ports = createPorts({
            requestAuthPin: jest.fn().mockResolvedValue({
                id: 1,
                code: 'ABCD',
                expiresAt: new Date(Date.now() + 90_000),
                authToken: null,
                clientIdentifier: 'client-id',
            }),
            pollForPin: jest.fn().mockImplementation(() => pollDeferred.promise),
        });

        const screen = new AuthScreen(container, ports);
        screen.show();

        click(container, '#btn-auth-request');
        await flushPromises();

        const detail = container.querySelector('.screen-detail') as HTMLElement | null;
        expect(detail?.classList.contains('screen-detail--warning')).toBe(true);

        pollDeferred.resolve({
            id: 1,
            code: 'ABCD',
            expiresAt: new Date(Date.now() + 90_000),
            authToken: 'auth-token',
            clientIdentifier: 'client-id',
        });
        await flushPromises();

        expect(detail?.textContent).toContain('Continuing startup…');
        expect(detail?.classList.contains('screen-detail--warning')).toBe(false);
    });

    it('clears the countdown warning class when polling fails after the warning threshold', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-02-05T00:00:00.000Z'));

        const container = document.createElement('div');
        document.body.appendChild(container);

        const pollDeferred = createDeferred<never>();

        const ports = createPorts({
            requestAuthPin: jest.fn().mockResolvedValue({
                id: 1,
                code: 'ABCD',
                expiresAt: new Date(Date.now() + 90_000),
                authToken: null,
                clientIdentifier: 'client-id',
            }),
            pollForPin: jest.fn().mockImplementation(() => pollDeferred.promise),
        });

        const screen = new AuthScreen(container, ports);
        screen.show();

        click(container, '#btn-auth-request');
        await flushPromises();

        const detail = container.querySelector('.screen-detail') as HTMLElement | null;
        expect(detail?.classList.contains('screen-detail--warning')).toBe(true);

        pollDeferred.reject(new Error('poll failed'));
        await flushPromises();

        expect(detail?.classList.contains('screen-detail--warning')).toBe(false);
    });

    it('surfaces request failures through screen error UI without console logging', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const container = document.createElement('div');
        document.body.appendChild(container);

        const ports = createPorts({
            requestAuthPin: jest.fn().mockRejectedValue({
                code: 'NETWORK_TIMEOUT',
                message: 'timed out',
            }),
        });

        try {
            const screen = new AuthScreen(container, ports);
            screen.show();

            click(container, '#btn-auth-request');
            await flushPromises();

            const error = container.querySelector('.screen-error') as HTMLElement | null;
            expect(error?.textContent ?? '').toContain('Connection error');
            expect(error?.textContent ?? '').toContain('Check your internet connection and try again.');
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });
});
