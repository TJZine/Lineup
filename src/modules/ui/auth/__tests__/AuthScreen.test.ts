/**
 * @jest-environment jsdom
 */

import { AuthScreen, type AuthScreenPorts } from '../AuthScreen';
import type { AuthScreenNavigationPort } from '../../../navigation';
import { PlexApiError } from '../../../plex/auth';
import { AppErrorCode } from '../../../../types/app-errors';
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
    cancelPin: jest.fn().mockResolvedValue({ kind: 'canceled' }),
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
                return Promise.resolve({ kind: 'canceled' as const });
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

    it('cancel before requestAuthPin resolves cancels the returned PIN without polling', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const pinDeferred = createDeferred<{
            id: number;
            code: string;
            expiresAt: Date;
            authToken: string | null;
            clientIdentifier: string;
        }>();
        const ports = createPorts({
            requestAuthPin: jest.fn().mockImplementation(() => pinDeferred.promise),
            pollForPin: jest.fn().mockResolvedValue({
                id: 55,
                code: 'LATE',
                expiresAt: new Date(Date.now() + 60_000),
                authToken: 'auth-token',
                clientIdentifier: 'client-id',
            }),
        });

        const screen = new AuthScreen(container, ports);
        screen.show();

        click(container, '#btn-auth-request');
        await flushPromises();
        click(container, '#btn-auth-cancel');
        await flushPromises();

        pinDeferred.resolve({
            id: 55,
            code: 'LATE',
            expiresAt: new Date(Date.now() + 60_000),
            authToken: null,
            clientIdentifier: 'client-id',
        });
        await flushPromises();

        expect(ports.cancelPin).toHaveBeenCalledWith(55);
        expect(ports.pollForPin).not.toHaveBeenCalled();
    });

    it('hide before requestAuthPin resolves cancels the returned PIN without polling', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const pinDeferred = createDeferred<{
            id: number;
            code: string;
            expiresAt: Date;
            authToken: string | null;
            clientIdentifier: string;
        }>();
        const ports = createPorts({
            requestAuthPin: jest.fn().mockImplementation(() => pinDeferred.promise),
            pollForPin: jest.fn().mockResolvedValue({
                id: 77,
                code: 'HIDE',
                expiresAt: new Date(Date.now() + 60_000),
                authToken: 'auth-token',
                clientIdentifier: 'client-id',
            }),
        });

        const screen = new AuthScreen(container, ports);
        screen.show();

        click(container, '#btn-auth-request');
        await flushPromises();
        screen.hide();

        pinDeferred.resolve({
            id: 77,
            code: 'HIDE',
            expiresAt: new Date(Date.now() + 60_000),
            authToken: null,
            clientIdentifier: 'client-id',
        });
        await flushPromises();

        expect(ports.cancelPin).toHaveBeenCalledWith(77);
        expect(ports.pollForPin).not.toHaveBeenCalled();
    });

    it('hide before requestAuthPin rejects suppresses stale request failure UI', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const pinDeferred = createDeferred<{
            id: number;
            code: string;
            expiresAt: Date;
            authToken: string | null;
            clientIdentifier: string;
        }>();
        const ports = createPorts({
            requestAuthPin: jest.fn().mockImplementation(() => pinDeferred.promise),
        });

        const screen = new AuthScreen(container, ports);
        screen.show();

        click(container, '#btn-auth-request');
        await flushPromises();
        screen.hide();

        pinDeferred.reject(new Error('late request failure'));
        await flushPromises();

        const error = container.querySelector('.screen-error') as HTMLElement | null;
        const retryButton = container.querySelector('#btn-auth-retry') as HTMLButtonElement | null;
        expect(error?.textContent ?? '').toBe('');
        expect(retryButton?.style.display).toBe('none');
    });

    it('retry after a polling failure cancels the old PIN and starts polling the new PIN', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const ports = createPorts({
            requestAuthPin: jest.fn()
                .mockResolvedValueOnce({
                    id: 11,
                    code: 'FAIL',
                    expiresAt: new Date(Date.now() + 60_000),
                    authToken: null,
                    clientIdentifier: 'client-id',
                })
                .mockResolvedValueOnce({
                    id: 12,
                    code: 'NEXT',
                    expiresAt: new Date(Date.now() + 60_000),
                    authToken: null,
                    clientIdentifier: 'client-id',
                }),
            pollForPin: jest.fn()
                .mockRejectedValueOnce(new PlexApiError(
                    AppErrorCode.SERVER_UNREACHABLE,
                    'Temporary network issue',
                    undefined,
                    true
                ))
                .mockImplementation(() => new Promise(() => undefined)),
        });

        const screen = new AuthScreen(container, ports);
        screen.show();

        click(container, '#btn-auth-request');
        await flushPromises();

        click(container, '#btn-auth-retry');
        await flushPromises();

        expect(ports.cancelPin).toHaveBeenCalledWith(11);
        expect(ports.pollForPin).toHaveBeenNthCalledWith(1, 11, { signal: expect.any(AbortSignal) });
        expect(ports.pollForPin).toHaveBeenNthCalledWith(2, 12, { signal: expect.any(AbortSignal) });

        const pollForPinMock = ports.pollForPin as jest.MockedFunction<AuthScreenPorts['pollForPin']>;
        const firstPollOptions = pollForPinMock.mock.calls[0]?.[1];
        const secondPollOptions = pollForPinMock.mock.calls[1]?.[1];
        expect(firstPollOptions?.signal).toBeInstanceOf(AbortSignal);
        expect(secondPollOptions?.signal).toBeInstanceOf(AbortSignal);
        expect(secondPollOptions?.signal).not.toBe(firstPollOptions?.signal);
        expect(secondPollOptions?.signal?.aborted).toBe(false);
    });

    it('hide restores idle UI state before the screen is shown again', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const pinDeferred = createDeferred<{
            id: number;
            code: string;
            expiresAt: Date;
            authToken: string | null;
            clientIdentifier: string;
        }>();
        const ports = createPorts({
            requestAuthPin: jest.fn().mockImplementation(() => pinDeferred.promise),
            pollForPin: jest.fn().mockImplementation(() => new Promise(() => undefined)),
        });

        const screen = new AuthScreen(container, ports);
        screen.show();

        click(container, '#btn-auth-request');
        await flushPromises();

        const requestButton = container.querySelector('#btn-auth-request') as HTMLButtonElement | null;
        const cancelButton = container.querySelector('#btn-auth-cancel') as HTMLButtonElement | null;
        const retryButton = container.querySelector('#btn-auth-retry') as HTMLButtonElement | null;
        const qr = container.querySelector('.auth-qr') as HTMLElement | null;
        expect(requestButton?.disabled).toBe(true);
        expect(cancelButton?.disabled).toBe(false);

        screen.hide();
        pinDeferred.resolve({
            id: 31,
            code: 'LATE',
            expiresAt: new Date(Date.now() + 60_000),
            authToken: null,
            clientIdentifier: 'client-id',
        });
        await flushPromises();

        screen.show();

        const pin = Array.from(container.querySelectorAll('.auth-pin-character'))
            .map((node) => node.textContent)
            .join('');
        const status = container.querySelector('.screen-status');
        const detail = container.querySelector('.screen-detail') as HTMLElement | null;

        expect(requestButton?.disabled).toBe(false);
        expect(cancelButton?.disabled).toBe(true);
        expect(retryButton?.style.display).toBe('none');
        expect(qr?.style.display).toBe('none');
        expect(pin).toBe('----');
        expect(status?.textContent ?? '').toContain('Ready to request a PIN.');
        expect(detail?.textContent ?? '').toBe('');
        expect(detail?.classList.contains('screen-detail--warning')).toBe(false);
    });

    it('hide during retry cleanup prevents requesting and polling a new PIN', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const oldCancelDeferred = createDeferred<{ kind: 'canceled' }>();
        const ports = createPorts({
            requestAuthPin: jest.fn()
                .mockResolvedValueOnce({
                    id: 21,
                    code: 'FAIL',
                    expiresAt: new Date(Date.now() + 60_000),
                    authToken: null,
                    clientIdentifier: 'client-id',
                })
                .mockResolvedValueOnce({
                    id: 22,
                    code: 'NEXT',
                    expiresAt: new Date(Date.now() + 60_000),
                    authToken: null,
                    clientIdentifier: 'client-id',
                }),
            pollForPin: jest.fn()
                .mockRejectedValueOnce(new PlexApiError(
                    AppErrorCode.SERVER_UNREACHABLE,
                    'Temporary network issue',
                    undefined,
                    true
                ))
                .mockImplementation(() => new Promise(() => undefined)),
            cancelPin: jest.fn((pinId: number) => {
                if (pinId === 21) {
                    return oldCancelDeferred.promise;
                }
                return Promise.resolve({ kind: 'canceled' as const });
            }),
        });

        const screen = new AuthScreen(container, ports);
        screen.show();

        click(container, '#btn-auth-request');
        await flushPromises();

        click(container, '#btn-auth-retry');
        await flushPromises();
        screen.hide();
        oldCancelDeferred.resolve({ kind: 'canceled' });
        await flushPromises();

        expect(ports.cancelPin).toHaveBeenCalledWith(21);
        expect(ports.requestAuthPin).toHaveBeenCalledTimes(1);
        expect(ports.pollForPin).toHaveBeenCalledTimes(1);
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
        expect((container.querySelector('.auth-link-actions') as HTMLElement).hidden).toBe(true);
    });

    it('does not render cancelled state when cancel completes after hide', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const cancelDeferred = createDeferred<{ kind: 'canceled' }>();
        const ports = createPorts({
            requestAuthPin: jest.fn().mockResolvedValue({
                id: 42,
                code: 'ABCD',
                expiresAt: new Date(Date.now() + 60_000),
                authToken: null,
                clientIdentifier: 'client-id',
            }),
            pollForPin: jest.fn().mockImplementation(() => new Promise(() => undefined)),
            cancelPin: jest.fn().mockImplementation(() => cancelDeferred.promise),
        });

        const screen = new AuthScreen(container, ports);
        screen.show();

        click(container, '#btn-auth-request');
        await flushPromises();
        click(container, '#btn-auth-cancel');
        await flushPromises();

        screen.hide();
        cancelDeferred.resolve({ kind: 'canceled' });
        await flushPromises();

        const status = container.querySelector('.screen-status');
        expect(status?.textContent ?? '').not.toContain('Cancelled.');
        expect(status?.textContent ?? '').toContain('Ready to request a PIN.');
        expect(container.style.display).toBe('none');
    });

    it('does not let stale cancel completion overwrite a newer PIN request', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const cancelDeferred = createDeferred<{ kind: 'canceled' }>();
        const ports = createPorts({
            requestAuthPin: jest.fn()
                .mockResolvedValueOnce({
                    id: 42,
                    code: 'ABCD',
                    expiresAt: new Date(Date.now() + 60_000),
                    authToken: null,
                    clientIdentifier: 'client-id',
                })
                .mockResolvedValueOnce({
                    id: 43,
                    code: 'WXYZ',
                    expiresAt: new Date(Date.now() + 60_000),
                    authToken: null,
                    clientIdentifier: 'client-id',
                }),
            pollForPin: jest.fn().mockImplementation(() => new Promise(() => undefined)),
            cancelPin: jest.fn((pinId: number) => {
                if (pinId === 42) {
                    return cancelDeferred.promise;
                }
                return Promise.resolve({ kind: 'canceled' as const });
            }),
        });

        const screen = new AuthScreen(container, ports);
        screen.show();

        click(container, '#btn-auth-request');
        await flushPromises();
        click(container, '#btn-auth-cancel');
        await flushPromises();
        screen.hide();
        screen.show();
        click(container, '#btn-auth-request');
        await flushPromises();

        cancelDeferred.resolve({ kind: 'canceled' });
        await flushPromises();

        const pin = Array.from(container.querySelectorAll('.auth-pin-character'))
            .map((node) => node.textContent)
            .join('');
        const status = container.querySelector('.screen-status');

        expect(pin).toBe('WXYZ');
        expect(status?.textContent ?? '').not.toContain('Cancelled.');
        expect(ports.pollForPin).toHaveBeenCalledTimes(2);
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

    it('shows manual entry and a fallback when the browser action is blocked', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const navigation = createNavigationMock();
        const ports = createPorts({
            requestAuthPin: jest.fn().mockResolvedValue({
                id: 91,
                code: 'ABCD',
                expiresAt: new Date(Date.now() + 60_000),
                authToken: null,
                clientIdentifier: 'client-id',
            }),
            pollForPin: jest.fn().mockImplementation(() => new Promise(() => undefined)),
            getNavigation: () => navigation,
        });
        const openSpy = jest.spyOn(window, 'open').mockReturnValue(null);
        const screen = new AuthScreen(container, ports);

        try {
            screen.show();
            click(container, '#btn-auth-request');
            await flushPromises();

            const manualActions = container.querySelector('.auth-link-actions') as HTMLElement;
            const displayedCode = Array.from(container.querySelectorAll('.auth-pin-character'))
                .map((node) => node.textContent)
                .join('');
            expect(manualActions.hidden).toBe(false);
            expect(container.querySelector('.auth-manual-hint')?.textContent).toContain('plex.tv/link');
            expect(displayedCode).toBe('ABCD');
            expect(navigation.registerFocusable).toHaveBeenCalledWith(expect.objectContaining({
                id: 'btn-auth-open-browser',
            }));
            expect(navigation.registerFocusable).toHaveBeenCalledWith(expect.objectContaining({
                id: 'btn-auth-copy-code',
            }));

            click(container, '#btn-auth-open-browser');

            expect(openSpy).toHaveBeenCalledWith('https://plex.tv/link', '_blank');
            expect(container.querySelector('.screen-status')?.textContent).toContain('Open plex.tv/link');
            expect(displayedCode).toBe('ABCD');
        } finally {
            screen.destroy();
            openSpy.mockRestore();
        }
    });

    it('copies the active code only after an explicit user action', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const ports = createPorts({
            requestAuthPin: jest.fn().mockResolvedValue({
                id: 92,
                code: 'WXYZ',
                expiresAt: new Date(Date.now() + 60_000),
                authToken: null,
                clientIdentifier: 'client-id',
            }),
            pollForPin: jest.fn().mockImplementation(() => new Promise(() => undefined)),
        });
        const clipboard = { writeText: jest.fn().mockResolvedValue(undefined) };
        const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: clipboard,
        });
        const screen = new AuthScreen(container, ports);

        try {
            screen.show();
            click(container, '#btn-auth-request');
            await flushPromises();
            click(container, '#btn-auth-copy-code');
            await flushPromises();

            expect(clipboard.writeText).toHaveBeenCalledWith('WXYZ');
            expect(container.querySelector('.screen-status')?.textContent).toContain('Code copied.');
        } finally {
            screen.destroy();
            if (clipboardDescriptor) {
                Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
            } else {
                Reflect.deleteProperty(navigator, 'clipboard');
            }
        }
    });

    it('retires code actions on successful sign-in and ignores a late clipboard completion', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const pollDeferred = createDeferred<{
            id: number;
            code: string;
            expiresAt: Date;
            authToken: string | null;
            clientIdentifier: string;
        }>();
        const copyDeferred = createDeferred<void>();
        const ports = createPorts({
            requestAuthPin: jest.fn().mockResolvedValue({
                id: 93,
                code: 'LMNO',
                expiresAt: new Date(Date.now() + 60_000),
                authToken: null,
                clientIdentifier: 'client-id',
            }),
            pollForPin: jest.fn().mockImplementation(() => pollDeferred.promise),
        });
        const clipboard = { writeText: jest.fn(() => copyDeferred.promise) };
        const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: clipboard,
        });
        const screen = new AuthScreen(container, ports);

        try {
            screen.show();
            click(container, '#btn-auth-request');
            await flushPromises();
            click(container, '#btn-auth-copy-code');

            pollDeferred.resolve({
                id: 93,
                code: 'LMNO',
                expiresAt: new Date(Date.now() + 60_000),
                authToken: 'auth-token',
                clientIdentifier: 'client-id',
            });
            await flushPromises();
            copyDeferred.resolve();
            await flushPromises();

            expect((container.querySelector('.auth-link-actions') as HTMLElement).hidden).toBe(true);
            expect(container.querySelector('.screen-status')?.textContent).toContain('Signed in.');
            screen.hide();
            await flushPromises();
            expect(ports.cancelPin).not.toHaveBeenCalled();
        } finally {
            screen.destroy();
            if (clipboardDescriptor) {
                Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
            } else {
                Reflect.deleteProperty(navigator, 'clipboard');
            }
        }
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
        const manualActions = container.querySelector('.auth-link-actions') as HTMLElement;

        expect(ports.cancelPin).toHaveBeenCalledWith(77);
        expect(pin).toBe('----');
        expect(qr.style.display).toBe('none');
        expect(status?.textContent ?? '').toContain('Code expired.');
        expect(detail?.classList.contains('screen-detail--warning')).toBe(false);
        expect(manualActions.hidden).toBe(true);
    });

    it('does not render expired state when expiry cancellation completes after hide', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-02-05T00:00:00.000Z'));

        const container = document.createElement('div');
        document.body.appendChild(container);

        const cancelDeferred = createDeferred<{ kind: 'canceled' }>();
        const ports = createPorts({
            requestAuthPin: jest.fn().mockResolvedValue({
                id: 77,
                code: 'WXYZ',
                expiresAt: new Date(Date.now() + 1_000),
                authToken: null,
                clientIdentifier: 'client-id',
            }),
            pollForPin: jest.fn().mockImplementation(() => new Promise(() => undefined)),
            cancelPin: jest.fn().mockImplementation(() => cancelDeferred.promise),
        });

        const screen = new AuthScreen(container, ports);
        screen.show();

        click(container, '#btn-auth-request');
        await flushPromises();

        jest.advanceTimersByTime(1_500);
        await flushPromises();
        screen.hide();
        cancelDeferred.resolve({ kind: 'canceled' });
        await flushPromises();

        const status = container.querySelector('.screen-status');
        expect(status?.textContent ?? '').not.toContain('Code expired.');
        expect(status?.textContent ?? '').toContain('Ready to request a PIN.');
        expect(container.style.display).toBe('none');
    });

    it('does not let stale expiry cancellation overwrite a newer PIN request', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-02-05T00:00:00.000Z'));

        const container = document.createElement('div');
        document.body.appendChild(container);

        const cancelDeferred = createDeferred<{ kind: 'canceled' }>();
        const ports = createPorts({
            requestAuthPin: jest.fn()
                .mockResolvedValueOnce({
                    id: 77,
                    code: 'WXYZ',
                    expiresAt: new Date(Date.now() + 1_000),
                    authToken: null,
                    clientIdentifier: 'client-id',
                })
                .mockResolvedValueOnce({
                    id: 78,
                    code: 'NEXT',
                    expiresAt: new Date(Date.now() + 60_000),
                    authToken: null,
                    clientIdentifier: 'client-id',
                }),
            pollForPin: jest.fn().mockImplementation(() => new Promise(() => undefined)),
            cancelPin: jest.fn((pinId: number) => {
                if (pinId === 77) {
                    return cancelDeferred.promise;
                }
                return Promise.resolve({ kind: 'canceled' as const });
            }),
        });

        const screen = new AuthScreen(container, ports);
        screen.show();

        click(container, '#btn-auth-request');
        await flushPromises();
        jest.advanceTimersByTime(1_500);
        await flushPromises();

        screen.hide();
        screen.show();
        click(container, '#btn-auth-request');
        await flushPromises();
        cancelDeferred.resolve({ kind: 'canceled' });
        await flushPromises();

        const pin = Array.from(container.querySelectorAll('.auth-pin-character'))
            .map((node) => node.textContent)
            .join('');
        const status = container.querySelector('.screen-status');

        expect(pin).toBe('NEXT');
        expect(status?.textContent ?? '').not.toContain('Code expired.');
        expect(ports.pollForPin).toHaveBeenCalledTimes(2);
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

    it('keeps a retryable polling failure active through the real expiry deadline', async () => {
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

        pollDeferred.reject(new PlexApiError(
            AppErrorCode.SERVER_UNREACHABLE,
            'Temporary network issue',
            undefined,
            true
        ));
        await flushPromises();

        const cancelButton = container.querySelector('#btn-auth-cancel') as HTMLButtonElement;
        const requestButton = container.querySelector('#btn-auth-request') as HTMLButtonElement;
        const retryButton = container.querySelector('#btn-auth-retry') as HTMLButtonElement;
        const manualActions = container.querySelector('.auth-link-actions') as HTMLElement;
        const activePin = Array.from(container.querySelectorAll('.auth-pin-character'))
            .map((node) => node.textContent)
            .join('');

        expect(detail?.classList.contains('screen-detail--warning')).toBe(true);
        expect(activePin).toBe('ABCD');
        expect(manualActions.hidden).toBe(false);
        expect(requestButton.disabled).toBe(true);
        expect(cancelButton.disabled).toBe(false);
        expect(retryButton.style.display).toBe('inline-flex');
        expect(ports.cancelPin).not.toHaveBeenCalled();

        jest.advanceTimersByTime(90_000);
        await flushPromises();

        const retiredPin = Array.from(container.querySelectorAll('.auth-pin-character'))
            .map((node) => node.textContent)
            .join('');
        expect(ports.cancelPin).toHaveBeenCalledWith(1);
        expect(retiredPin).toBe('----');
        expect(manualActions.hidden).toBe(true);
        expect(container.querySelector('.screen-status')?.textContent).toContain('Code expired.');
    });

    it('retires the PIN immediately after a terminal polling failure', async () => {
        jest.useFakeTimers();
        const container = document.createElement('div');
        document.body.appendChild(container);
        const ports = createPorts({
            requestAuthPin: jest.fn().mockResolvedValue({
                id: 2,
                code: 'TERM',
                expiresAt: new Date(Date.now() + 300_000),
                authToken: null,
                clientIdentifier: 'client-id',
            }),
            pollForPin: jest.fn().mockRejectedValue(new PlexApiError(
                AppErrorCode.AUTH_REQUIRED,
                'PIN is no longer valid',
                undefined,
                false
            )),
        });

        const screen = new AuthScreen(container, ports);
        screen.show();
        click(container, '#btn-auth-request');
        await flushPromises();

        const pin = Array.from(container.querySelectorAll('.auth-pin-character'))
            .map((node) => node.textContent)
            .join('');
        const manualActions = container.querySelector('.auth-link-actions') as HTMLElement;
        const detail = container.querySelector('.screen-detail') as HTMLElement;
        const requestButton = container.querySelector('#btn-auth-request') as HTMLButtonElement;

        expect(pin).toBe('----');
        expect(manualActions.hidden).toBe(true);
        expect(requestButton.disabled).toBe(false);
        expect(detail.textContent).toContain('Request a new PIN');
        expect(ports.cancelPin).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(0);
    });

    it('keeps explicit cancellation truthful when remote cleanup fails and can be retried', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const ports = createPorts({
            requestAuthPin: jest.fn().mockResolvedValue({
                id: 3,
                code: 'CANC',
                expiresAt: new Date(Date.now() + 60_000),
                authToken: null,
                clientIdentifier: 'client-id',
            }),
            pollForPin: jest.fn().mockImplementation(() => new Promise(() => undefined)),
            cancelPin: jest.fn()
                .mockResolvedValueOnce({ kind: 'cleanup-failed' })
                .mockResolvedValueOnce({ kind: 'canceled' }),
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
        const retry = container.querySelector('#btn-auth-retry') as HTMLButtonElement;
        expect(pin).toBe('----');
        expect(container.querySelector('.screen-status')?.textContent).not.toContain('Cancelled.');
        expect(retry.textContent).toBe('Retry cleanup');
        expect(retry.style.display).toBe('inline-flex');

        retry.click();
        await flushPromises();
        expect(ports.cancelPin).toHaveBeenCalledTimes(2);
        expect(container.querySelector('.screen-status')?.textContent).toContain('Cancelled.');
    });

    it('blocks a new code when prior-code cleanup fails, then retries cleanup before requesting', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const ports = createPorts({
            requestAuthPin: jest.fn()
                .mockResolvedValueOnce({
                    id: 4,
                    code: 'OLD1',
                    expiresAt: new Date(Date.now() + 60_000),
                    authToken: null,
                    clientIdentifier: 'client-id',
                })
                .mockResolvedValueOnce({
                    id: 5,
                    code: 'NEW2',
                    expiresAt: new Date(Date.now() + 60_000),
                    authToken: null,
                    clientIdentifier: 'client-id',
                }),
            pollForPin: jest.fn()
                .mockRejectedValueOnce(new PlexApiError(
                    AppErrorCode.SERVER_UNREACHABLE,
                    'Temporary network issue',
                    undefined,
                    true
                ))
                .mockImplementation(() => new Promise(() => undefined)),
            cancelPin: jest.fn()
                .mockResolvedValueOnce({ kind: 'cleanup-failed' })
                .mockResolvedValueOnce({ kind: 'canceled' }),
        });

        const screen = new AuthScreen(container, ports);
        screen.show();
        click(container, '#btn-auth-request');
        await flushPromises();
        click(container, '#btn-auth-retry');
        await flushPromises();

        expect(ports.requestAuthPin).toHaveBeenCalledTimes(1);
        expect(container.querySelector('#btn-auth-retry')?.textContent).toBe('Retry cleanup');

        click(container, '#btn-auth-retry');
        await flushPromises();
        const pin = Array.from(container.querySelectorAll('.auth-pin-character'))
            .map((node) => node.textContent)
            .join('');
        expect(ports.cancelPin).toHaveBeenCalledTimes(2);
        expect(ports.requestAuthPin).toHaveBeenCalledTimes(2);
        expect(pin).toBe('NEW2');
    });

    it('keeps expiry local when remote cleanup fails and shows expired only after cleanup succeeds', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-02-05T00:00:00.000Z'));
        const container = document.createElement('div');
        document.body.appendChild(container);
        const ports = createPorts({
            requestAuthPin: jest.fn().mockResolvedValue({
                id: 6,
                code: 'EXPR',
                expiresAt: new Date(Date.now() + 1_000),
                authToken: null,
                clientIdentifier: 'client-id',
            }),
            pollForPin: jest.fn().mockImplementation(() => new Promise(() => undefined)),
            cancelPin: jest.fn()
                .mockResolvedValueOnce({ kind: 'cleanup-failed' })
                .mockResolvedValueOnce({ kind: 'canceled' }),
        });

        const screen = new AuthScreen(container, ports);
        screen.show();
        click(container, '#btn-auth-request');
        await flushPromises();
        jest.advanceTimersByTime(1_000);
        await flushPromises();

        expect(container.querySelector('.screen-status')?.textContent).toContain('cleanup is unconfirmed');
        expect(container.querySelector('.screen-status')?.textContent).not.toBe('Code expired.');
        expect(container.querySelector('#btn-auth-retry')?.textContent).toBe('Retry cleanup');

        click(container, '#btn-auth-retry');
        await flushPromises();
        expect(container.querySelector('.screen-status')?.textContent).toContain('Code expired.');
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
