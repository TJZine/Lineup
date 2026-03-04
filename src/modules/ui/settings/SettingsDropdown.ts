/**
 * @fileoverview Theme-aware dropdown popover for settings select controls.
 * @module modules/ui/settings/SettingsDropdown
 */

import type { SettingsSelectOption } from './types';

export interface SettingsDropdownConfig {
    /** Anchor element to position the dropdown relative to */
    anchor: HTMLElement;
    /** Container element to append the dropdown to (should be settings root) */
    container: HTMLElement;
    /** Available options */
    options: SettingsSelectOption[];
    /** Currently selected value */
    currentValue: number;
    /** Callback when an option is selected */
    onSelect: (value: number) => void;
    /** Callback when the dropdown is dismissed without selection */
    onDismiss: () => void;
    /** Navigation manager for focus registration */
    nav: {
        registerFocusable: (element: {
            id: string;
            element: HTMLElement;
            neighbors: { up?: string; down?: string; left?: string; right?: string };
            onFocus?: () => void;
            onSelect?: () => void;
        }) => void;
        unregisterFocusable: (id: string) => void;
        setFocus: (id: string) => void;
    } | null;
}

const DROPDOWN_ID_PREFIX = 'settings-dropdown-option-';
const DROPDOWN_CONTAINER_ID = 'settings-dropdown';

export function createSettingsDropdown(config: SettingsDropdownConfig): {
    destroy: () => void;
    dismiss: () => void;
} {
    // Remove any existing dropdown first.
    const existing = config.container.querySelector(`#${DROPDOWN_CONTAINER_ID}`);
    existing?.remove();

    const overlay = document.createElement('div');
    overlay.id = DROPDOWN_CONTAINER_ID;
    overlay.className = 'settings-dropdown';
    overlay.setAttribute('role', 'listbox');
    overlay.setAttribute('aria-label', 'Select an option');

    // Position relative to the anchor element.
    const anchorRect = config.anchor.getBoundingClientRect();
    const containerRect = config.container.getBoundingClientRect();
    const topOffset = anchorRect.bottom - containerRect.top + 4;
    const leftOffset = anchorRect.left - containerRect.left;
    const dropdownWidth = Math.max(anchorRect.width, 200);

    overlay.style.top = `${topOffset}px`;
    overlay.style.left = `${leftOffset}px`;
    overlay.style.width = `${dropdownWidth}px`;

    const optionIds: string[] = [];

    for (let i = 0; i < config.options.length; i++) {
        const option = config.options[i];
        if (!option) continue;
        const optionId = `${DROPDOWN_ID_PREFIX}${i}`;
        optionIds.push(optionId);

        const item = document.createElement('button');
        item.id = optionId;
        item.className = 'settings-dropdown-option';
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', option.value === config.currentValue ? 'true' : 'false');

        if (option.value === config.currentValue) {
            item.classList.add('settings-dropdown-option--selected');
        }

        const labelSpan = document.createElement('span');
        labelSpan.className = 'settings-dropdown-option-label';
        labelSpan.textContent = option.label;

        const checkSpan = document.createElement('span');
        checkSpan.className = 'settings-dropdown-option-check';
        checkSpan.textContent = option.value === config.currentValue ? '✓' : '';
        checkSpan.setAttribute('aria-hidden', 'true');

        item.appendChild(labelSpan);
        item.appendChild(checkSpan);

        item.addEventListener('click', () => {
            config.onSelect(option.value);
        });

        overlay.appendChild(item);
    }

    config.container.appendChild(overlay);

    // Check if dropdown goes below viewport and flip above anchor if needed.
    const overlayRect = overlay.getBoundingClientRect();
    if (overlayRect.bottom > window.innerHeight - 20) {
        const flippedTop = anchorRect.top - containerRect.top - overlayRect.height - 4;
        if (flippedTop > 0) {
            overlay.style.top = `${flippedTop}px`;
        }
    }

    // Register focusables for D-pad navigation.
    if (config.nav) {
        for (let i = 0; i < optionIds.length; i++) {
            const optionId = optionIds[i];
            if (!optionId) continue;
            const element = overlay.querySelector(`#${optionId}`) as HTMLElement | null;
            if (!element) continue;

            const neighbors: { up?: string; down?: string } = {};
            const upId = i > 0 ? optionIds[i - 1] : undefined;
            const downId = i < optionIds.length - 1 ? optionIds[i + 1] : undefined;
            if (upId) neighbors.up = upId;
            if (downId) neighbors.down = downId;

            config.nav.registerFocusable({
                id: optionId,
                element,
                neighbors,
                onSelect: () => {
                    const option = config.options[i];
                    if (option) config.onSelect(option.value);
                },
            });
        }

        // Focus the currently selected option.
        const currentIndex = config.options.findIndex((o) => o.value === config.currentValue);
        const focusId = optionIds[currentIndex >= 0 ? currentIndex : 0];
        if (focusId) {
            config.nav.setFocus(focusId);
        }
    }

    let destroyed = false;
    let dismissed = false;

    const destroy = (): void => {
        if (destroyed) return;
        destroyed = true;
        if (config.nav) {
            for (const id of optionIds) {
                config.nav.unregisterFocusable(id);
            }
        }
        overlay.remove();
    };

    const dismiss = (): void => {
        if (dismissed || destroyed) return;
        dismissed = true;
        config.onDismiss();
        destroy();
    };

    return { destroy, dismiss };
}
