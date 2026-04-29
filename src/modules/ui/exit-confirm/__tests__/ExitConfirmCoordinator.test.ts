/**
 * @jest-environment jsdom
 */

import type { FocusableElement, INavigationManager } from '../../../navigation';
import {
    EXIT_CONFIRM_ACTION_IDS,
    EXIT_CONFIRM_CONTAINER_ID,
    EXIT_CONFIRM_MODAL_ID,
} from '../constants';
import { ExitConfirmCoordinator } from '../ExitConfirmCoordinator';
import { ExitConfirmModal } from '../ExitConfirmModal';

type NavigationMock = Pick<
    INavigationManager,
    'registerFocusable' | 'unregisterFocusable' | 'setFocus' | 'closeModal'
>;

const createNavigation = (): jest.Mocked<NavigationMock> => ({
    registerFocusable: jest.fn(),
    unregisterFocusable: jest.fn(),
    setFocus: jest.fn(),
    closeModal: jest.fn(),
});

const getRegisteredFocusable = (
    navigation: jest.Mocked<NavigationMock>,
    id: string
): FocusableElement => {
    const entry = navigation.registerFocusable.mock.calls
        .map(([focusable]) => focusable)
        .find((focusable) => focusable.id === id);

    if (!entry) {
        throw new Error(`Expected focusable ${id} to be registered`);
    }

    return entry;
};

const setup = (): {
    coordinator: ExitConfirmCoordinator;
    modal: ExitConfirmModal;
    navigation: jest.Mocked<NavigationMock>;
    container: HTMLElement;
} => {
    document.body.innerHTML = `<div id="${EXIT_CONFIRM_CONTAINER_ID}"></div>`;

    const modal = new ExitConfirmModal();
    modal.initialize({ containerId: EXIT_CONFIRM_CONTAINER_ID });
    const navigation = createNavigation();
    const coordinator = new ExitConfirmCoordinator({
        getNavigation: (): INavigationManager => navigation as unknown as INavigationManager,
        getModal: (): ExitConfirmModal => modal,
    });
    const container = document.getElementById(EXIT_CONFIRM_CONTAINER_ID);

    if (!container) {
        throw new Error('Expected exit-confirm container to exist');
    }

    return { coordinator, modal, navigation, container };
};

describe('ExitConfirmCoordinator', () => {
    let closeSpy: jest.SpyInstance<void, []>;

    beforeEach(() => {
        closeSpy = jest.spyOn(window, 'close').mockImplementation(() => undefined);
    });

    afterEach(() => {
        closeSpy.mockRestore();
        document.body.innerHTML = '';
    });

    it('opens the exit confirmation dialog with accessible state and registered actions', () => {
        const { coordinator, modal, navigation, container } = setup();

        coordinator.handleModalOpen(EXIT_CONFIRM_MODAL_ID);

        expect(modal.isVisible()).toBe(true);
        expect(container.classList.contains('visible')).toBe(true);
        expect(container.getAttribute('role')).toBe('dialog');
        expect(container.getAttribute('aria-modal')).toBe('true');
        expect(container.getAttribute('aria-labelledby')).toBe('exit-confirm-title');
        expect(container.getAttribute('aria-describedby')).toBe('exit-confirm-message');
        expect(document.getElementById('exit-confirm-title')?.textContent).toBe('Exit Lineup?');
        expect(document.getElementById('exit-confirm-message')?.textContent).toBe(
            'You will return to the Home screen.'
        );
        expect(document.getElementById(EXIT_CONFIRM_ACTION_IDS.cancel)?.textContent).toBe('Cancel');
        expect(document.getElementById(EXIT_CONFIRM_ACTION_IDS.exit)?.textContent).toBe('Exit');

        const cancelFocusable = getRegisteredFocusable(navigation, EXIT_CONFIRM_ACTION_IDS.cancel);
        const exitFocusable = getRegisteredFocusable(navigation, EXIT_CONFIRM_ACTION_IDS.exit);
        expect(cancelFocusable.element).toBe(document.getElementById(EXIT_CONFIRM_ACTION_IDS.cancel));
        expect(cancelFocusable.neighbors).toEqual({ right: EXIT_CONFIRM_ACTION_IDS.exit });
        expect(exitFocusable.element).toBe(document.getElementById(EXIT_CONFIRM_ACTION_IDS.exit));
        expect(exitFocusable.neighbors).toEqual({ left: EXIT_CONFIRM_ACTION_IDS.cancel });
        expect(navigation.setFocus).toHaveBeenCalledWith(EXIT_CONFIRM_ACTION_IDS.cancel, {
            persist: false,
        });
    });

    it('routes Cancel through navigation close and Exit through window.close', () => {
        const { coordinator, navigation } = setup();

        coordinator.handleModalOpen(EXIT_CONFIRM_MODAL_ID);

        getRegisteredFocusable(navigation, EXIT_CONFIRM_ACTION_IDS.cancel).onSelect?.();
        expect(navigation.closeModal).toHaveBeenCalledWith(EXIT_CONFIRM_MODAL_ID);

        getRegisteredFocusable(navigation, EXIT_CONFIRM_ACTION_IDS.exit).onSelect?.();
        expect(closeSpy).toHaveBeenCalledTimes(1);
    });

    it('unregisters focusables and clears visible modal state on close', () => {
        const { coordinator, modal, navigation, container } = setup();

        coordinator.handleModalOpen(EXIT_CONFIRM_MODAL_ID);
        coordinator.handleModalClose(EXIT_CONFIRM_MODAL_ID);

        expect(navigation.unregisterFocusable).toHaveBeenCalledWith(EXIT_CONFIRM_ACTION_IDS.cancel);
        expect(navigation.unregisterFocusable).toHaveBeenCalledWith(EXIT_CONFIRM_ACTION_IDS.exit);
        expect(modal.isVisible()).toBe(false);
        expect(container.classList.contains('visible')).toBe(false);
        expect(container.hasAttribute('aria-labelledby')).toBe(false);
        expect(container.hasAttribute('aria-describedby')).toBe(false);
        expect(document.getElementById(EXIT_CONFIRM_ACTION_IDS.cancel)).toBeNull();
        expect(document.getElementById(EXIT_CONFIRM_ACTION_IDS.exit)).toBeNull();
    });

    it('re-registers focusables and restores accessible state after close and reopen', () => {
        const { coordinator, modal, navigation, container } = setup();

        coordinator.handleModalOpen(EXIT_CONFIRM_MODAL_ID);
        coordinator.handleModalClose(EXIT_CONFIRM_MODAL_ID);
        coordinator.handleModalOpen(EXIT_CONFIRM_MODAL_ID);

        const cancelRegistrations = navigation.registerFocusable.mock.calls.filter(
            ([focusable]) => focusable.id === EXIT_CONFIRM_ACTION_IDS.cancel
        );
        const exitRegistrations = navigation.registerFocusable.mock.calls.filter(
            ([focusable]) => focusable.id === EXIT_CONFIRM_ACTION_IDS.exit
        );
        expect(cancelRegistrations).toHaveLength(2);
        expect(exitRegistrations).toHaveLength(2);
        expect(navigation.unregisterFocusable).toHaveBeenCalledWith(EXIT_CONFIRM_ACTION_IDS.cancel);
        expect(navigation.unregisterFocusable).toHaveBeenCalledWith(EXIT_CONFIRM_ACTION_IDS.exit);
        expect(modal.isVisible()).toBe(true);
        expect(container.classList.contains('visible')).toBe(true);
        expect(container.getAttribute('role')).toBe('dialog');
        expect(container.getAttribute('aria-modal')).toBe('true');
        expect(container.getAttribute('aria-labelledby')).toBe('exit-confirm-title');
        expect(container.getAttribute('aria-describedby')).toBe('exit-confirm-message');
        expect(document.getElementById(EXIT_CONFIRM_ACTION_IDS.cancel)).not.toBeNull();
        expect(document.getElementById(EXIT_CONFIRM_ACTION_IDS.exit)).not.toBeNull();
    });

    it('destroys the modal without leaving visible dialog content behind', () => {
        const { coordinator, modal, container } = setup();

        coordinator.handleModalOpen(EXIT_CONFIRM_MODAL_ID);
        modal.destroy();

        expect(modal.isVisible()).toBe(false);
        expect(container.classList.contains('visible')).toBe(false);
        expect(container.hasAttribute('aria-labelledby')).toBe(false);
        expect(container.hasAttribute('aria-describedby')).toBe(false);
        expect(container.textContent).toBe('');
    });
});
