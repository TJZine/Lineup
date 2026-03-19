/**
 * @fileoverview Theme-aware dropdown popover wrapper for settings select controls.
 * @module modules/ui/settings/SettingsDropdown
 */

import { createDropdownPopover } from '../common/CreateDropdownPopover';
import type { SettingsSelectOption } from './types';
import type { INavigationManager } from '../../navigation/interfaces';

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
    nav: Pick<INavigationManager, 'registerFocusable' | 'unregisterFocusable' | 'setFocus'> | null;
}

export function createSettingsDropdown(config: SettingsDropdownConfig): {
    destroy: () => void;
    dismiss: () => void;
} {
    return createDropdownPopover({
        anchor: config.anchor,
        container: config.container,
        options: config.options.map((option) => ({
            label: option.label,
            value: String(option.value),
        })),
        currentValue: String(config.currentValue),
        onSelect: (value) => {
            config.onSelect(Number(value));
        },
        onDismiss: config.onDismiss,
        nav: config.nav,
        cssClass: 'settings-dropdown',
        optionCssClass: 'settings-dropdown-option',
    });
}
