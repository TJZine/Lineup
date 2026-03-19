/**
 * @jest-environment jsdom
 */

import { createDropdownPopover } from '../CreateDropdownPopover';

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
    beforeEach(() => {
        Object.defineProperty(window, 'innerHeight', {
            configurable: true,
            value: 720,
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.restoreAllMocks();
    });

    it('renders options with role="option" and container with role="listbox"', () => {
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

        expect(container.querySelector('#settings-dropdown')?.getAttribute('role')).toBe('listbox');
        expect(container.querySelectorAll('.settings-dropdown-option[role="option"]')).toHaveLength(3);
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
