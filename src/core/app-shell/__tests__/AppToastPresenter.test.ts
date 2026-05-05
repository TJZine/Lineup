/**
 * @jest-environment jsdom
 */

import { AppToastPresenter } from '../chrome/AppToastPresenter';
import { APP_SHELL_CONTAINER_IDS } from '../../../modules/ui/common/appShellContainerIds';

const createToastContainer = (): HTMLDivElement => {
    const container = document.createElement('div');
    container.id = APP_SHELL_CONTAINER_IDS.TOAST;
    container.className = 'app-toast';
    container.style.display = 'none';
    container.style.opacity = '0';
    return container;
};

describe('AppToastPresenter', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('no-ops when no container is set', () => {
        const presenter = new AppToastPresenter();
        expect(() => presenter.show({ message: 'Hello', type: 'info' })).not.toThrow();
        expect(jest.getTimerCount()).toBe(0);
    });

    it('renders the first toast with exact text, type, and visible styles', () => {
        const presenter = new AppToastPresenter();
        const container = createToastContainer();

        presenter.setContainer(container);
        jest.setSystemTime(10_000);
        presenter.show({ message: 'Hello', type: 'info' });

        expect(container.dataset.toastType).toBe('info');
        expect(container.textContent).toBe('ℹ️ Hello');
        expect(container.style.display).toBe('block');
        expect(container.style.opacity).toBe('1');
    });

    it('suppresses a second toast inside the 1500ms throttle window', () => {
        const presenter = new AppToastPresenter();
        const container = createToastContainer();

        presenter.setContainer(container);
        jest.setSystemTime(10_000);
        presenter.show({ message: 'Hello', type: 'info' });
        jest.setSystemTime(10_500);
        presenter.show({ message: 'Suppressed', type: 'success' });

        expect(container.textContent).toContain('Hello');
        expect(container.textContent).not.toContain('Suppressed');
    });

    it('fades after 5000ms and hides 200ms later', () => {
        const presenter = new AppToastPresenter();
        const container = createToastContainer();

        presenter.setContainer(container);
        jest.setSystemTime(10_000);
        presenter.show({ message: 'Hello', type: 'info' });

        jest.advanceTimersByTime(5000);
        expect(container.style.opacity).toBe('0');

        jest.advanceTimersByTime(200);
        expect(container.style.display).toBe('none');
    });

    it('dispose clears both timers and prevents stale callbacks', () => {
        const presenter = new AppToastPresenter();
        const container = createToastContainer();

        presenter.setContainer(container);
        jest.setSystemTime(10_000);
        presenter.show({ message: 'Hello', type: 'info' });
        expect(jest.getTimerCount()).toBeGreaterThan(0);

        jest.advanceTimersByTime(5000);
        expect(jest.getTimerCount()).toBeGreaterThan(0);

        presenter.dispose();
        expect(jest.getTimerCount()).toBe(0);

        jest.advanceTimersByTime(5000);
        expect(container.style.display).toBe('none');
        expect(container.style.opacity).toBe('0');
    });

    it('hides a previous container and clears throttle when container changes', () => {
        const presenter = new AppToastPresenter();
        const firstContainer = createToastContainer();
        const secondContainer = createToastContainer();

        presenter.setContainer(firstContainer);
        jest.setSystemTime(10_000);
        presenter.show({ message: 'First', type: 'info' });
        expect(firstContainer.style.display).toBe('block');

        presenter.setContainer(secondContainer);
        jest.setSystemTime(10_100);
        presenter.show({ message: 'Second', type: 'success' });

        expect(firstContainer.style.display).toBe('none');
        expect(firstContainer.style.opacity).toBe('0');
        expect(secondContainer.textContent).toBe('✓ Second');
        expect(secondContainer.style.display).toBe('block');
        expect(secondContainer.style.opacity).toBe('1');
    });
});
