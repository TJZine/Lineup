/**
 * @jest-environment jsdom
 */

import { createSettingsDropdown } from '../SettingsDropdown';

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
    setFocus: (id: string) => void;
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
        setFocus: (id: string): void => {
            focusables.get(id)?.onFocus?.();
        },
    };
};

const makeOptions = (count: number): Array<{ label: string; value: number }> =>
    Array.from({ length: count }, (_, i) => ({ label: `Option ${i}`, value: i }));

describe('createSettingsDropdown', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('destroys dropdown in finally when onDismiss throws', () => {
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        document.body.appendChild(container);
        container.appendChild(anchor);
        const nav = createNavigationStub();

        const dropdown = createSettingsDropdown({
            anchor,
            container,
            options: makeOptions(3),
            currentValue: 0,
            onSelect: () => {},
            onDismiss: () => {
                throw new Error('boom');
            },
            nav,
        });

        expect(container.querySelector('#settings-dropdown')).not.toBeNull();
        expect([...nav.focusables.keys()].filter((id) => id.startsWith('settings-dropdown-option-')).length).toBe(3);

        try {
            dropdown.dismiss();
        } catch {
            // Expected.
        }

        expect(container.querySelector('#settings-dropdown')).toBeNull();
        expect([...nav.focusables.keys()].some((id) => id.startsWith('settings-dropdown-option-'))).toBe(false);
    });

    it('unregisters orphaned option focusables before removing an existing overlay', () => {
        const container = document.createElement('div');
        const anchor = document.createElement('button');
        document.body.appendChild(container);
        container.appendChild(anchor);
        const nav = createNavigationStub();

        createSettingsDropdown({
            anchor,
            container,
            options: makeOptions(5),
            currentValue: 0,
            onSelect: () => {},
            onDismiss: () => {},
            nav,
        });

        expect([...nav.focusables.keys()].some((id) => id === 'settings-dropdown-option-4')).toBe(true);

        createSettingsDropdown({
            anchor,
            container,
            options: makeOptions(2),
            currentValue: 0,
            onSelect: () => {},
            onDismiss: () => {},
            nav,
        });

        expect([...nav.focusables.keys()].some((id) => id === 'settings-dropdown-option-4')).toBe(false);
    });
});
