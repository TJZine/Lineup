/**
 * @jest-environment jsdom
 */

import type { LifecycleAppError } from '../../../modules/lifecycle/types';
import { APP_SHELL_CONTAINER_IDS } from '../../../modules/ui/common/appShellContainerIds';
import { AppBlockingErrorOverlayPresenter, type BlockingErrorOverlayAction } from '../chrome/AppBlockingErrorOverlayPresenter';

const createOverlayContainer = (): HTMLDivElement => {
    const container = document.createElement('div');
    container.id = APP_SHELL_CONTAINER_IDS.ERROR_OVERLAY;
    container.className = 'error-overlay hidden';
    container.setAttribute('role', 'dialog');
    container.setAttribute('aria-modal', 'true');
    container.setAttribute('aria-label', 'Error');
    return container;
};

const createError = (): LifecycleAppError => ({
    code: 'TEST_ERROR' as LifecycleAppError['code'],
    message: 'Boom',
    userMessage: 'Something failed',
    recoverable: true,
    phase: 'error',
    timestamp: 0,
    actions: [],
});

const createActions = (primaryAction?: jest.Mock): BlockingErrorOverlayAction[] => [
    {
        label: 'Retry',
        isPrimary: true,
        action: primaryAction ?? jest.fn(),
    },
    {
        label: 'Cancel',
        isPrimary: false,
        action: jest.fn(),
    },
];

const createNavigation = (): {
    openModal: jest.Mock;
    closeModal: jest.Mock;
    isModalOpen: jest.Mock;
    registerFocusable: jest.Mock;
    unregisterFocusable: jest.Mock;
    setFocus: jest.Mock;
    on: jest.Mock;
    off: jest.Mock;
    cancelPendingChannelInput: jest.Mock;
} => {
    return {
        openModal: jest.fn(),
        closeModal: jest.fn(),
        isModalOpen: jest.fn().mockReturnValue(false),
        registerFocusable: jest.fn(),
        unregisterFocusable: jest.fn(),
        setFocus: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        cancelPendingChannelInput: jest.fn(),
    };
};

describe('AppBlockingErrorOverlayPresenter', () => {
    it('no-ops when no container is set', () => {
        const presenter = new AppBlockingErrorOverlayPresenter({ getNavigation: (): null => null });
        expect(() => presenter.show(createError(), createActions())).not.toThrow();
        expect(() => presenter.hide()).not.toThrow();
    });

    it('renders title, message, actions, and unhides the overlay', () => {
        const overlay = createOverlayContainer();
        const presenter = new AppBlockingErrorOverlayPresenter({ getNavigation: (): null => null });
        presenter.setContainer(overlay);

        presenter.show(createError(), createActions());

        expect(overlay.classList.contains('hidden')).toBe(false);
        const title = overlay.querySelector('.error-title');
        const message = overlay.querySelector('.error-message');
        expect(title?.textContent).toBe('Something went wrong');
        expect(message?.textContent).toBe('Something failed');
        expect(title?.id).toBe(`${APP_SHELL_CONTAINER_IDS.ERROR_OVERLAY}-title`);
        expect(message?.id).toBe(`${APP_SHELL_CONTAINER_IDS.ERROR_OVERLAY}-message`);
        expect(overlay.getAttribute('aria-labelledby')).toBe(title?.id);
        expect(overlay.getAttribute('aria-describedby')).toBe(message?.id);
        expect(overlay.hasAttribute('aria-label')).toBe(false);
        expect(overlay.querySelectorAll('[role="dialog"]')).toHaveLength(0);
        expect(overlay.querySelector('.error-content')?.hasAttribute('aria-modal')).toBe(false);

        const buttons = overlay.querySelectorAll('button');
        expect(buttons).toHaveLength(2);
        expect(buttons[0]?.classList.contains('error-button')).toBe(true);
        expect(buttons[0]?.classList.contains('primary')).toBe(true);
    });

    it('focuses the primary button even when navigation is unavailable', () => {
        const overlay = createOverlayContainer();
        document.body.appendChild(overlay);
        const presenter = new AppBlockingErrorOverlayPresenter({ getNavigation: (): null => null });
        presenter.setContainer(overlay);

        presenter.show(createError(), createActions());

        const firstButton = overlay.querySelector('button');
        expect(document.activeElement).toBe(firstButton);
    });

    it('registers focusables, opens the modal, and sets focus when navigation exists', () => {
        const overlay = createOverlayContainer();
        const nav = createNavigation();
        const presenter = new AppBlockingErrorOverlayPresenter({ getNavigation: (): never => nav as never });
        presenter.setContainer(overlay);

        presenter.show(createError(), createActions());

        expect(nav.registerFocusable).toHaveBeenCalledTimes(2);
        expect(nav.registerFocusable).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ group: 'modal:error-overlay' })
        );
        expect(nav.registerFocusable).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ group: 'modal:error-overlay' })
        );
        expect(nav.openModal).toHaveBeenCalledWith('modal:error-overlay', [
            'error-overlay-action-0',
            'error-overlay-action-1',
        ]);
        expect(nav.setFocus).toHaveBeenCalledWith('error-overlay-action-0', { persist: false });
        expect(nav.on).toHaveBeenCalledTimes(1);
        expect(nav.on).toHaveBeenCalledWith('modalClose', expect.any(Function));
    });

    it('refreshes modal membership when show is called again while the modal is already open', () => {
        const overlay = createOverlayContainer();
        const nav = createNavigation();
        const presenter = new AppBlockingErrorOverlayPresenter({ getNavigation: (): never => nav as never });
        presenter.setContainer(overlay);

        presenter.show(createError(), createActions());

        nav.closeModal.mockClear();
        nav.openModal.mockClear();
        nav.off.mockClear();
        nav.isModalOpen.mockReset();
        nav.isModalOpen.mockReturnValueOnce(true).mockReturnValueOnce(false).mockReturnValue(false);

        presenter.show(createError(), createActions());

        expect(nav.off).toHaveBeenCalledTimes(1);
        expect(nav.closeModal).toHaveBeenCalledWith('modal:error-overlay');
        expect(nav.openModal).toHaveBeenCalledWith('modal:error-overlay', [
            'error-overlay-action-0',
            'error-overlay-action-1',
        ]);
    });

    it('hide closes the modal, unregisters focusables, and re-hides the overlay', () => {
        const overlay = createOverlayContainer();
        const nav = createNavigation();
        const presenter = new AppBlockingErrorOverlayPresenter({ getNavigation: (): never => nav as never });
        presenter.setContainer(overlay);
        presenter.show(createError(), createActions());

        presenter.hide();

        expect(overlay.classList.contains('hidden')).toBe(true);
        expect(nav.closeModal).toHaveBeenCalledWith('modal:error-overlay');
        expect(nav.unregisterFocusable).toHaveBeenCalledWith('error-overlay-action-0');
        expect(nav.unregisterFocusable).toHaveBeenCalledWith('error-overlay-action-1');
    });

    it('modalClose hides without recursively closing the modal', () => {
        const overlay = createOverlayContainer();
        const nav = createNavigation();
        const presenter = new AppBlockingErrorOverlayPresenter({ getNavigation: (): never => nav as never });
        presenter.setContainer(overlay);
        presenter.show(createError(), createActions());

        const modalCloseHandler = nav.on.mock.calls.find(
            ([eventName]: [string, unknown]) => eventName === 'modalClose'
        )?.[1] as ((payload: { modalId: string }) => void) | undefined;
        expect(modalCloseHandler).toBeDefined();

        const closeCallCountBefore = nav.closeModal.mock.calls.length;
        modalCloseHandler?.({ modalId: 'modal:error-overlay' });

        expect(nav.closeModal).toHaveBeenCalledTimes(closeCallCountBefore);
        expect(overlay.classList.contains('hidden')).toBe(true);
    });

    it('dispose hides, removes listeners, and clears focusable registrations', () => {
        const overlay = createOverlayContainer();
        const nav = createNavigation();
        const presenter = new AppBlockingErrorOverlayPresenter({ getNavigation: (): never => nav as never });
        presenter.setContainer(overlay);
        presenter.show(createError(), createActions());

        presenter.dispose();

        expect(overlay.classList.contains('hidden')).toBe(true);
        expect(nav.off).toHaveBeenCalled();
        expect(nav.unregisterFocusable).toHaveBeenCalledWith('error-overlay-action-0');
        expect(nav.unregisterFocusable).toHaveBeenCalledWith('error-overlay-action-1');
    });

    it('keeps a protected overlay open and deduplicates actions while recovery is pending', async () => {
        const overlay = createOverlayContainer();
        const nav = createNavigation();
        let resolveRecovery: (() => void) | undefined;
        const action = jest.fn(() => new Promise<void>((resolve) => {
            resolveRecovery = resolve;
        }));
        const presenter = new AppBlockingErrorOverlayPresenter({ getNavigation: (): never => nav as never });
        presenter.setContainer(overlay);

        presenter.show(createError(), [{ id: 'retry', label: 'Retry', isPrimary: true, action }], {
            modalPolicy: { dismissOnBack: false, blocksBackgroundCommands: true },
        });
        const button = overlay.querySelector('button') as HTMLButtonElement;
        button.click();
        button.click();

        expect(nav.cancelPendingChannelInput.mock.invocationCallOrder[0]).toBeLessThan(
            nav.openModal.mock.invocationCallOrder[0] as number
        );
        expect(nav.openModal).toHaveBeenCalledWith(
            'modal:error-overlay',
            ['error-overlay-action-0'],
            { dismissOnBack: false, blocksBackgroundCommands: true }
        );
        expect(button.disabled).toBe(true);
        expect(overlay.classList.contains('hidden')).toBe(false);
        expect(action).toHaveBeenCalledTimes(1);

        resolveRecovery?.();
        await Promise.resolve();
        await Promise.resolve();
        expect(overlay.classList.contains('hidden')).toBe(true);
    });

    it('keeps the overlay gated on rejection and restores Retry focus with sanitized status', async () => {
        const overlay = createOverlayContainer();
        const nav = createNavigation();
        const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const actionError = Object.assign(new Error('X-Plex-Token=secret-value'), {
            code: 'X-Plex-Token=code-secret',
        });
        const presenter = new AppBlockingErrorOverlayPresenter({ getNavigation: (): never => nav as never });
        presenter.setContainer(overlay);
        presenter.show(createError(), [{
            id: 'retry',
            label: 'Retry',
            isPrimary: true,
            action: (): Promise<void> => Promise.reject(actionError),
        }], { modalPolicy: { dismissOnBack: false, blocksBackgroundCommands: true } });

        try {
            const button = overlay.querySelector('button') as HTMLButtonElement;
            button.click();
            await Promise.resolve();
            await Promise.resolve();

            expect(overlay.classList.contains('hidden')).toBe(false);
            expect(button.disabled).toBe(false);
            expect(overlay.querySelector('[role="status"]')?.textContent).toBe('Retry failed. Please try again.');
            expect(overlay.textContent).not.toContain('secret-value');
            expect(nav.setFocus).toHaveBeenLastCalledWith('error-overlay-action-0', { persist: false });
            expect(warning).toHaveBeenCalledWith(
                'Blocking error overlay action failed',
                {
                    action: 'retry',
                    error: {
                        name: 'Error',
                        code: expect.not.stringContaining('code-secret'),
                        message: expect.not.stringContaining('secret-value'),
                    },
                }
            );
        } finally {
            warning.mockRestore();
        }
    });

    it('restores focus to a failed non-retry action when Retry is available', async () => {
        const overlay = createOverlayContainer();
        const nav = createNavigation();
        const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const actionError = new Error('X-Plex-Token=secret-value');
        const retryAction = jest.fn();
        const exitAction = jest.fn((): Promise<void> => Promise.reject(actionError));
        const presenter = new AppBlockingErrorOverlayPresenter({ getNavigation: (): never => nav as never });
        presenter.setContainer(overlay);
        presenter.show(createError(), [
            {
                id: 'retry',
                label: 'Retry',
                isPrimary: true,
                action: retryAction,
            },
            {
                id: 'exit',
                label: 'Exit',
                isPrimary: false,
                action: exitAction,
            },
        ]);

        try {
            const exitButton = overlay.querySelector<HTMLButtonElement>('[data-action="exit"]');
            expect(exitButton).not.toBeNull();
            if (!exitButton) {
                throw new Error('Expected the Exit action to be rendered.');
            }

            exitButton.click();
            await Promise.resolve();
            await Promise.resolve();

            expect(exitAction).toHaveBeenCalledTimes(1);
            expect(retryAction).not.toHaveBeenCalled();
            expect(overlay.classList.contains('hidden')).toBe(false);
            expect(exitButton.disabled).toBe(false);
            expect(overlay.querySelector('[role="status"]')?.textContent).toBe('Exit failed. Please try again.');
            expect(overlay.textContent).not.toContain('secret-value');
            expect(exitButton.id).toBe('error-overlay-action-1');
            expect(nav.setFocus).toHaveBeenLastCalledWith(exitButton.id, { persist: false });
        } finally {
            warning.mockRestore();
        }
    });

    it('ignores stale action completion after disposal', async () => {
        const overlay = createOverlayContainer();
        const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        let rejectRecovery: ((error: Error) => void) | undefined;
        const presenter = new AppBlockingErrorOverlayPresenter({ getNavigation: (): null => null });
        presenter.setContainer(overlay);
        presenter.show(createError(), [{
            id: 'retry',
            label: 'Retry',
            isPrimary: true,
            action: (): Promise<void> => new Promise<void>((_resolve, reject) => { rejectRecovery = reject; }),
        }]);
        (overlay.querySelector('button') as HTMLButtonElement).click();
        presenter.dispose();

        try {
            rejectRecovery?.(new Error('late'));
            await Promise.resolve();
            await Promise.resolve();
            expect(overlay.querySelector('[role="status"]')?.textContent).toBe('Retry in progress…');
            expect(warning).toHaveBeenCalledWith(
                'Blocking error overlay action failed',
                expect.objectContaining({
                    action: 'retry',
                    error: expect.objectContaining({ message: 'late' }),
                })
            );
        } finally {
            warning.mockRestore();
        }
    });
});
