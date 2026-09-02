/**
 * @jest-environment jsdom
 */

import { createDropdownPopover } from '../CreateDropdownPopover';
import { NavigationManager } from '../../../navigation';

type StubFocusable = {
    id: string;
    element: HTMLElement;
    neighbors: { up?: string; down?: string; left?: string; right?: string };
    onFocus?: () => void;
    onSelect?: () => void;
};

const createNavigationStub = (): {
    focusables: Map<string, StubFocusable>;
    registerFocusable: (element: StubFocusable) => void;
    unregisterFocusable: (id: string) => void;
    setFocus: jest.Mock;
} => {
    const focusables = new Map<string, StubFocusable>();
    return {
        focusables,
        registerFocusable: (element: StubFocusable): void => {
            focusables.set(element.id, element);
        },
        unregisterFocusable: (id: string): void => {
            focusables.delete(id);
        },
        setFocus: jest.fn((id: string) => {
            focusables.get(id)?.onFocus?.();
        }),
    };
};

const makeOptions = (count: number): Array<{ label: string; value: string }> =>
    Array.from({ length: count }, (_, i) => ({ label: `Option ${i}`, value: String(i) }));

const defineRect = (element: HTMLElement, rect: Partial<DOMRect>): void => {
    Object.defineProperty(element, 'getBoundingClientRect', {
        configurable: true,
        value: () =>
            ({
                x: rect.left ?? 0,
                y: rect.top ?? 0,
                width: rect.width ?? 0,
                height: rect.height ?? 0,
                top: rect.top ?? 0,
                right: rect.right ?? ((rect.left ?? 0) + (rect.width ?? 0)),
                bottom: rect.bottom ?? ((rect.top ?? 0) + (rect.height ?? 0)),
                left: rect.left ?? 0,
                toJSON: () => ({}),
            }) as DOMRect,
    });
};

describe('createDropdownPopover', () => {
    const navigationManagers: NavigationManager[] = [];

    beforeEach(() => {
        Object.defineProperty(window, 'innerHeight', {
            configurable: true,
            value: 720,
        });
    });

    afterEach(() => {
        for (const navigation of navigationManagers) {
            navigation.destroy();
        }
        navigationManagers.length = 0;
        document.body.innerHTML = '';
        jest.restoreAllMocks();
    });

    const createRealNavigation = (): NavigationManager => {
        const navigation = new NavigationManager();
        navigation.initialize({
            enablePointerMode: true,
            keyRepeatDelayMs: 500,
            keyRepeatIntervalMs: 100,
            focusMemoryEnabled: true,
            debugMode: false,
        });
        navigationManagers.push(navigation);
        return navigation;
    };

    it('renders options with role="option" and container with role="listbox"', () => {
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        anchor.id = 'settings-layout';
        document.body.append(container);
        container.append(anchor);

        const dropdown = createDropdownPopover({
            anchor,
            container,
            options: makeOptions(3),
            currentValue: '1',
            onSelect: () => {},
            onDismiss: () => {},
            nav: null,
            cssClass: 'settings-dropdown',
            optionCssClass: 'settings-dropdown-option',
        });

        expect(container.querySelector('#settings-dropdown')?.getAttribute('role')).toBe('listbox');
        expect(container.querySelectorAll('.settings-dropdown-option[role="option"]')).toHaveLength(3);
        expect(container.querySelector('#settings-dropdown')?.id).toBe('settings-dropdown');
        expect(anchor.getAttribute('aria-haspopup')).toBe('listbox');
        expect(anchor.getAttribute('aria-controls')).toBe('settings-dropdown');
        expect(anchor.getAttribute('aria-expanded')).toBe('true');

        dropdown.destroy();
        expect(anchor.getAttribute('aria-expanded')).toBe('false');
    });

    it('marks current value with aria-selected and selected css modifier', () => {
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        document.body.append(container);
        container.append(anchor);

        createDropdownPopover({
            anchor,
            container,
            options: makeOptions(3),
            currentValue: '1',
            onSelect: () => {},
            onDismiss: () => {},
            nav: null,
            cssClass: 'settings-dropdown',
            optionCssClass: 'settings-dropdown-option',
        });

        const selected = container.querySelector('#settings-dropdown-option-1');
        expect(selected?.getAttribute('aria-selected')).toBe('true');
        expect(selected?.classList.contains('settings-dropdown-option--selected')).toBe(true);
    });

    it('calls onSelect with clicked option value', () => {
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        const onSelect = jest.fn();
        document.body.append(container);
        container.append(anchor);

        createDropdownPopover({
            anchor,
            container,
            options: makeOptions(3),
            currentValue: '0',
            onSelect,
            onDismiss: () => {},
            nav: null,
            cssClass: 'settings-dropdown',
            optionCssClass: 'settings-dropdown-option',
        });

        const option = container.querySelector('#settings-dropdown-option-2');
        if (!(option instanceof HTMLButtonElement)) {
            throw new Error('Expected option button');
        }

        option.click();
        expect(onSelect).toHaveBeenCalledWith('2');
    });

    it('uses NavigationManager activation exactly once for a pointer option click', () => {
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        anchor.id = 'settings-layout';
        const nav = createRealNavigation();
        const onSelect = jest.fn();
        document.body.append(container);
        container.append(anchor);

        nav.registerFocusable({ id: anchor.id, element: anchor, neighbors: {} });
        nav.setFocus(anchor.id);
        const dropdown = createDropdownPopover({
            anchor,
            container,
            options: makeOptions(2),
            currentValue: '0',
            onSelect,
            onDismiss: () => {},
            nav,
            cssClass: 'settings-dropdown',
            optionCssClass: 'settings-dropdown-option',
        });

        const option = container.querySelector('#settings-dropdown-option-1');
        if (!(option instanceof HTMLButtonElement)) {
            throw new Error('Expected option button');
        }
        option.click();

        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect).toHaveBeenCalledWith('1');
        dropdown.destroy();
    });

    it('contains background pointer activation and restores the anchor on dismissal', () => {
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        anchor.id = 'settings-layout';
        const background = document.createElement('button');
        background.id = 'settings-background';
        const backgroundSelect = jest.fn();
        const onDismiss = jest.fn();
        const nav = createRealNavigation();
        document.body.append(container);
        container.append(anchor, background);

        nav.registerFocusable({ id: anchor.id, element: anchor, neighbors: {} });
        nav.registerFocusable({
            id: background.id,
            element: background,
            neighbors: {},
            onSelect: backgroundSelect,
        });
        nav.setFocus(anchor.id);
        const closeModalSpy = jest.spyOn(nav, 'closeModal');
        const dropdown = createDropdownPopover({
            anchor,
            container,
            options: makeOptions(2),
            currentValue: '0',
            onSelect: () => {},
            onDismiss,
            nav,
            cssClass: 'settings-dropdown',
            optionCssClass: 'settings-dropdown-option',
        });

        expect(nav.isModalOpen('settings-dropdown-modal')).toBe(true);
        expect(nav.getState().focusedElementId).toBe('settings-dropdown-option-0');

        background.click();

        expect(backgroundSelect).not.toHaveBeenCalled();
        expect(nav.getState().focusedElementId).toBe('settings-dropdown-option-0');

        dropdown.dismiss();

        expect(onDismiss).toHaveBeenCalledTimes(1);
        expect(closeModalSpy).toHaveBeenCalledTimes(1);
        expect(nav.isModalOpen('settings-dropdown-modal')).toBe(false);
        expect(nav.getState().focusedElementId).toBe(anchor.id);
        expect(anchor.getAttribute('aria-expanded')).toBe('false');

        dropdown.destroy();
        expect(closeModalSpy).toHaveBeenCalledTimes(1);
    });

    it('does not open an expanded popup when options are empty', () => {
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        const onDismiss = jest.fn();
        document.body.append(container);
        container.append(anchor);

        const dropdown = createDropdownPopover({
            anchor,
            container,
            options: [],
            currentValue: '',
            onSelect: jest.fn(),
            onDismiss,
            nav: null,
            cssClass: 'settings-dropdown',
            optionCssClass: 'settings-dropdown-option',
        });

        expect(container.querySelector('#settings-dropdown')).toBeNull();
        expect(anchor.getAttribute('aria-expanded')).not.toBe('true');
        dropdown.dismiss();
        expect(onDismiss).not.toHaveBeenCalled();
    });

    it('leaves a same-class replacement intact when the stale handle is destroyed', () => {
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        const nav = createNavigationStub();
        const firstDismiss = jest.fn();
        document.body.append(container);
        container.append(anchor);

        const first = createDropdownPopover({
            anchor,
            container,
            options: makeOptions(2),
            currentValue: '0',
            onSelect: () => {},
            onDismiss: firstDismiss,
            nav,
            cssClass: 'settings-dropdown',
            optionCssClass: 'settings-dropdown-option',
        });
        const replacement = createDropdownPopover({
            anchor,
            container,
            options: makeOptions(3),
            currentValue: '2',
            onSelect: () => {},
            onDismiss: () => {},
            nav,
            cssClass: 'settings-dropdown',
            optionCssClass: 'settings-dropdown-option',
        });

        first.destroy();
        first.dismiss();

        expect(firstDismiss).not.toHaveBeenCalled();
        expect(container.querySelectorAll('#settings-dropdown-option-2')).toHaveLength(1);
        expect(nav.focusables.has('settings-dropdown-option-2')).toBe(true);
        expect(anchor.getAttribute('aria-expanded')).toBe('true');

        replacement.destroy();
        expect(container.querySelector('#settings-dropdown')).toBeNull();
    });

    it('does not let a stale handle close a replacement modal', () => {
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        anchor.id = 'settings-layout';
        const nav = createRealNavigation();
        document.body.append(container);
        container.append(anchor);
        nav.registerFocusable({ id: anchor.id, element: anchor, neighbors: {} });
        nav.setFocus(anchor.id);

        const first = createDropdownPopover({
            anchor,
            container,
            options: makeOptions(2),
            currentValue: '0',
            onSelect: () => {},
            onDismiss: () => {},
            nav,
            cssClass: 'settings-dropdown',
            optionCssClass: 'settings-dropdown-option',
        });
        const closeModalSpy = jest.spyOn(nav, 'closeModal');
        const replacement = createDropdownPopover({
            anchor,
            container,
            options: makeOptions(2),
            currentValue: '1',
            onSelect: () => {},
            onDismiss: () => {},
            nav,
            cssClass: 'settings-dropdown',
            optionCssClass: 'settings-dropdown-option',
        });

        expect(closeModalSpy).toHaveBeenCalledTimes(1);
        first.destroy();
        expect(closeModalSpy).toHaveBeenCalledTimes(1);
        expect(nav.isModalOpen('settings-dropdown-modal')).toBe(true);
        expect(nav.getState().focusedElementId).toBe('settings-dropdown-option-1');

        replacement.destroy();
        expect(closeModalSpy).toHaveBeenCalledTimes(2);
    });

    it('registers D-pad focusables when nav is provided', () => {
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        const nav = createNavigationStub();
        document.body.append(container);
        container.append(anchor);

        createDropdownPopover({
            anchor,
            container,
            options: makeOptions(3),
            currentValue: '1',
            onSelect: () => {},
            onDismiss: () => {},
            nav,
            cssClass: 'settings-dropdown',
            optionCssClass: 'settings-dropdown-option',
        });

        expect(nav.focusables.size).toBe(3);
        expect(nav.focusables.get('settings-dropdown-option-1')?.neighbors.up).toBe('settings-dropdown-option-0');
        expect(nav.focusables.get('settings-dropdown-option-1')?.neighbors.down).toBe('settings-dropdown-option-2');
        expect(nav.setFocus).toHaveBeenCalledWith('settings-dropdown-option-1');
    });

    it('self-loops vertical edges so focus cannot escape the dropdown', () => {
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        const nav = createNavigationStub();
        document.body.append(container);
        container.append(anchor);

        createDropdownPopover({
            anchor,
            container,
            options: makeOptions(3),
            currentValue: '1',
            onSelect: () => {},
            onDismiss: () => {},
            nav,
            cssClass: 'settings-dropdown',
            optionCssClass: 'settings-dropdown-option',
        });

        expect(nav.focusables.get('settings-dropdown-option-0')?.neighbors.up)
            .toBe('settings-dropdown-option-0');
        expect(nav.focusables.get('settings-dropdown-option-2')?.neighbors.down)
            .toBe('settings-dropdown-option-2');
    });

    it('keeps left and right navigation trapped on the focused dropdown option', () => {
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        const nav = createNavigationStub();
        document.body.append(container);
        container.append(anchor);

        createDropdownPopover({
            anchor,
            container,
            options: makeOptions(3),
            currentValue: '1',
            onSelect: () => {},
            onDismiss: () => {},
            nav,
            cssClass: 'settings-dropdown',
            optionCssClass: 'settings-dropdown-option',
        });

        expect(nav.focusables.get('settings-dropdown-option-1')?.neighbors.left).toBe('settings-dropdown-option-1');
        expect(nav.focusables.get('settings-dropdown-option-1')?.neighbors.right).toBe('settings-dropdown-option-1');
    });

    it('unregisters all focusables on destroy', () => {
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        const nav = createNavigationStub();
        document.body.append(container);
        container.append(anchor);

        const dropdown = createDropdownPopover({
            anchor,
            container,
            options: makeOptions(4),
            currentValue: '0',
            onSelect: () => {},
            onDismiss: () => {},
            nav,
            cssClass: 'settings-dropdown',
            optionCssClass: 'settings-dropdown-option',
        });

        dropdown.destroy();
        expect(nav.focusables.size).toBe(0);
        expect(container.querySelector('#settings-dropdown')).toBeNull();
    });

    it('calls onDismiss then destroys when dismiss is called', () => {
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        const onDismiss = jest.fn();
        const nav = createNavigationStub();
        document.body.append(container);
        container.append(anchor);

        const dropdown = createDropdownPopover({
            anchor,
            container,
            options: makeOptions(2),
            currentValue: '0',
            onSelect: () => {},
            onDismiss,
            nav,
            cssClass: 'settings-dropdown',
            optionCssClass: 'settings-dropdown-option',
        });

        dropdown.dismiss();

        expect(onDismiss).toHaveBeenCalledTimes(1);
        expect(container.querySelector('#settings-dropdown')).toBeNull();
        expect(nav.focusables.size).toBe(0);
    });

    it('handles onDismiss throwing and still destroys cleanly', () => {
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        const nav = createNavigationStub();
        document.body.append(container);
        container.append(anchor);

        const dropdown = createDropdownPopover({
            anchor,
            container,
            options: makeOptions(3),
            currentValue: '0',
            onSelect: () => {},
            onDismiss: () => {
                throw new Error('boom');
            },
            nav,
            cssClass: 'settings-dropdown',
            optionCssClass: 'settings-dropdown-option',
        });

        expect(() => dropdown.dismiss()).toThrow('boom');
        expect(container.querySelector('#settings-dropdown')).toBeNull();
        expect(nav.focusables.size).toBe(0);
    });

    it('auto-flips above anchor when dropdown would exceed viewport bottom', () => {
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        document.body.append(container);
        container.append(anchor);

        defineRect(container, { top: 0, left: 0, width: 500, height: 500 });
        defineRect(anchor, { top: 680, left: 20, width: 180, height: 40, bottom: 720 });

        const rectSpy = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
        rectSpy.mockImplementation(function mockRect(this: HTMLElement): DOMRect {
            if (this === anchor) {
                return {
                    x: 20,
                    y: 680,
                    width: 180,
                    height: 40,
                    top: 680,
                    right: 200,
                    bottom: 720,
                    left: 20,
                    toJSON: () => ({}),
                } as DOMRect;
            }
            if (this === container) {
                return {
                    x: 0,
                    y: 0,
                    width: 500,
                    height: 500,
                    top: 0,
                    right: 500,
                    bottom: 500,
                    left: 0,
                    toJSON: () => ({}),
                } as DOMRect;
            }
            if (this.id === 'settings-dropdown') {
                return {
                    x: 20,
                    y: 724,
                    width: 200,
                    height: 120,
                    top: 724,
                    right: 220,
                    bottom: 844,
                    left: 20,
                    toJSON: () => ({}),
                } as DOMRect;
            }
            return {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                toJSON: () => ({}),
            } as DOMRect;
        });

        createDropdownPopover({
            anchor,
            container,
            options: makeOptions(3),
            currentValue: '1',
            onSelect: () => {},
            onDismiss: () => {},
            nav: null,
            cssClass: 'settings-dropdown',
            optionCssClass: 'settings-dropdown-option',
        });

        expect((container.querySelector('#settings-dropdown') as HTMLElement | null)?.style.top).toBe('556px');
    });

    it('applies provided cssClass and optionCssClass to dom elements', () => {
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        document.body.append(container);
        container.append(anchor);

        createDropdownPopover({
            anchor,
            container,
            options: makeOptions(2),
            currentValue: '1',
            onSelect: () => {},
            onDismiss: () => {},
            nav: null,
            cssClass: 'setup-dropdown',
            optionCssClass: 'setup-dropdown-option',
        });

        expect(container.querySelector('#setup-dropdown')?.className).toBe('setup-dropdown');
        expect(container.querySelector('#setup-dropdown-option-0')?.className).toBe('setup-dropdown-option');
    });

    it('is safe to call destroy multiple times', () => {
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        const nav = createNavigationStub();
        document.body.append(container);
        container.append(anchor);

        const dropdown = createDropdownPopover({
            anchor,
            container,
            options: makeOptions(2),
            currentValue: '0',
            onSelect: () => {},
            onDismiss: () => {},
            nav,
            cssClass: 'settings-dropdown',
            optionCssClass: 'settings-dropdown-option',
        });

        expect(() => {
            dropdown.destroy();
            dropdown.destroy();
        }).not.toThrow();
        expect(nav.focusables.size).toBe(0);
    });
});
