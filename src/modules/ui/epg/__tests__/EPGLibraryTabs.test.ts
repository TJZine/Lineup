/**
 * @jest-environment jsdom
 */
/**
 * @fileoverview EPG library tabs unit tests
 * @module modules/ui/epg/__tests__/EPGLibraryTabs.test
 */

import { EPGLibraryTabs } from '../EPGLibraryTabs';

describe('EPGLibraryTabs', () => {
    let gridElement: HTMLElement;
    let tabs: EPGLibraryTabs;
    let onSelect: jest.Mock;

    beforeEach(() => {
        gridElement = document.createElement('div');
        document.body.appendChild(gridElement);
        onSelect = jest.fn();
        tabs = new EPGLibraryTabs({ onSelect });
        tabs.initialize(gridElement);
    });

    afterEach(() => {
        tabs.destroy();
        gridElement.remove();
    });

    it('renders a focused library pill for multi-library input', () => {
        tabs.update(
            [
                { id: 'lib-1', name: 'Movies' },
                { id: 'lib-2', name: 'Shows' },
            ],
            'lib-2'
        );
        tabs.setFocusedToSelected();

        const pill = gridElement.querySelector('.epg-library-pill') as HTMLButtonElement | null;

        expect(tabs.isVisible()).toBe(true);
        expect(pill?.textContent).toBe('Library: Shows');
        expect(pill?.classList.contains('focused')).toBe(true);
        expect(pill?.getAttribute('aria-expanded')).toBe('false');
    });

    it('opens the picker, moves focus, and selects the focused library', () => {
        tabs.update(
            [
                { id: 'lib-1', name: 'Movies' },
                { id: 'lib-2', name: 'Shows' },
            ],
            'lib-1'
        );
        tabs.setFocusedToSelected();

        tabs.selectFocused();
        expect(tabs.isPickerOpen()).toBe(true);

        tabs.moveFocus(1);

        const focusedItem = gridElement.querySelector('.epg-library-picker-item.focused') as HTMLButtonElement | null;
        expect(focusedItem?.dataset.libraryId).toBe('lib-2');

        tabs.selectFocused();

        expect(onSelect).toHaveBeenCalledWith('lib-2');
        expect(tabs.isPickerOpen()).toBe(false);
    });

    it('hides itself and clears picker state when only one library remains', () => {
        tabs.update(
            [
                { id: 'lib-1', name: 'Movies' },
                { id: 'lib-2', name: 'Shows' },
            ],
            'lib-1'
        );
        tabs.selectFocused();
        expect(tabs.isPickerOpen()).toBe(true);

        tabs.update([{ id: 'lib-1', name: 'Movies' }], 'lib-1');

        expect(tabs.isVisible()).toBe(false);
        expect(tabs.isPickerOpen()).toBe(false);
        expect(gridElement.querySelector('.epg-library-pill')).toBeNull();
        expect(gridElement.querySelector('.epg-library-picker-overlay')).toBeNull();
    });
});
