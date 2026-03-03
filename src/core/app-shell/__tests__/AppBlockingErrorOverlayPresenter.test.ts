/**
 * @jest-environment jsdom
 */

import type { LifecycleAppError } from '../../../modules/lifecycle/types';
import { AppBlockingErrorOverlayPresenter, type BlockingErrorOverlayAction } from '../AppBlockingErrorOverlayPresenter';

const createOverlayContainer = (): HTMLDivElement => {
    const container = document.createElement('div');
    container.id = 'error-overlay';
    container.className = 'error-overlay hidden';
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

const createNavigation = () => {
    return {
        openModal: jest.fn(),
        closeModal: jest.fn(),
        isModalOpen: jest.fn().mockReturnValue(false),
        registerFocusable: jest.fn(),
        unregisterFocusable: jest.fn(),
        setFocus: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
    };
};

describe('AppBlockingErrorOverlayPresenter', () => {
    it('no-ops when no container is set', () => {
        const presenter = new AppBlockingErrorOverlayPresenter({ getNavigation: () => null });
        expect(() => presenter.show(createError(), createActions())).not.toThrow();
        expect(() => presenter.hide()).not.toThrow();
    });

    it('renders title, message, actions, and unhides the overlay', () => {
        const overlay = createOverlayContainer();
        const presenter = new AppBlockingErrorOverlayPresenter({ getNavigation: () => null });
        presenter.setContainer(overlay);

        presenter.show(createError(), createActions());

        expect(overlay.classList.contains('hidden')).toBe(false);
        expect(overlay.querySelector('.error-title')?.textContent).toBe('Something went wrong');
        expect(overlay.querySelector('.error-message')?.textContent).toBe('Something failed');

        const buttons = overlay.querySelectorAll('button');
        expect(buttons).toHaveLength(2);
        expect(buttons[0]?.classList.contains('error-button')).toBe(true);
        expect(buttons[0]?.classList.contains('primary')).toBe(true);
    });

    it('focuses the primary button even when navigation is unavailable', () => {
        const overlay = createOverlayContainer();
        document.body.appendChild(overlay);
        const presenter = new AppBlockingErrorOverlayPresenter({ getNavigation: () => null });
        presenter.setContainer(overlay);

        presenter.show(createError(), createActions());

        const firstButton = overlay.querySelector('button');
        expect(document.activeElement).toBe(firstButton);
    });

    it('registers focusables, opens the modal, and sets focus when navigation exists', () => {
        const overlay = createOverlayContainer();
        const nav = createNavigation();
        const presenter = new AppBlockingErrorOverlayPresenter({ getNavigation: () => nav as never });
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
        const presenter = new AppBlockingErrorOverlayPresenter({ getNavigation: () => nav as never });
        presenter.setContainer(overlay);

        presenter.show(createError(), createActions());

        nav.closeModal.mockClear();
        nav.openModal.mockClear();
        nav.off.mockClear();
        nav.isModalOpen.mockReset();
        nav.isModalOpen.mockReturnValueOnce(true).mockReturnValueOnce(false).mockReturnValue(false);

        presenter.show(createError(), createActions());

        expect(nav.off).toHaveBeenCalled();
        expect(nav.closeModal).toHaveBeenCalledWith('modal:error-overlay');
        expect(nav.openModal).toHaveBeenCalledWith('modal:error-overlay', [
            'error-overlay-action-0',
            'error-overlay-action-1',
        ]);
    });

    it('hide closes the modal, unregisters focusables, and re-hides the overlay', () => {
        const overlay = createOverlayContainer();
        const nav = createNavigation();
        const presenter = new AppBlockingErrorOverlayPresenter({ getNavigation: () => nav as never });
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
        const presenter = new AppBlockingErrorOverlayPresenter({ getNavigation: () => nav as never });
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
        const presenter = new AppBlockingErrorOverlayPresenter({ getNavigation: () => nav as never });
        presenter.setContainer(overlay);
        presenter.show(createError(), createActions());

        presenter.dispose();

        expect(overlay.classList.contains('hidden')).toBe(true);
        expect(nav.off).toHaveBeenCalled();
        expect(nav.unregisterFocusable).toHaveBeenCalledWith('error-overlay-action-0');
        expect(nav.unregisterFocusable).toHaveBeenCalledWith('error-overlay-action-1');
    });
});
