import { createDropdownPopover } from '../common/CreateDropdownPopover';
import type { SettingsSelectOption } from './types';
import type { INavigationManager } from '../../navigation/contracts/interfaces';

export interface SettingsDropdownConfig {
    anchor: HTMLElement;
    container: HTMLElement;
    options: SettingsSelectOption[];
    /** Currently selected value */
    currentValue: number;
    onSelect: (value: number) => void;
    onDismiss: () => void;
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
