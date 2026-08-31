import type { SettingsToggleConfig } from './types';

export function createSettingsToggle(config: SettingsToggleConfig): {
    element: HTMLButtonElement;
    update: (value: boolean) => void;
    setDisabled: (disabled: boolean) => void;
    isDisabled: () => boolean;
    getId: () => string;
    activate: () => void;
} {
    const button = document.createElement('button');
    button.id = config.id;
    button.className = `setup-toggle${config.value ? ' selected' : ''}${config.disabled ? ' disabled' : ''}`;
    button.disabled = config.disabled ?? false;

    const label = document.createElement('span');
    label.className = 'setup-toggle-label';
    label.textContent = config.label;

    const meta = document.createElement('span');
    meta.className = 'setup-toggle-meta';
    meta.setAttribute('role', 'status');
    meta.setAttribute('aria-live', 'polite');
    restoreMetadata();

    const state = document.createElement('span');
    state.className = 'setup-toggle-state';
    state.textContent = config.value ? 'On' : 'Off';

    button.appendChild(label);
    button.appendChild(meta);
    button.appendChild(state);

    function activate(): void {
        if (config.disabled) return;
        const previousValue = config.value;
        const newValue = !config.value;
        update(newValue);
        const result = config.onChange(newValue);
        if (!result.ok) {
            update(result.effectiveValue ?? previousValue);
            meta.textContent = result.message;
            return;
        }
        restoreMetadata();
    }

    function update(value: boolean): void {
        config.value = value;
        if (value) {
            button.classList.add('selected');
        } else {
            button.classList.remove('selected');
        }
        state.textContent = value ? 'On' : 'Off';
    }

    function setDisabled(disabled: boolean): void {
        config.disabled = disabled;
        button.disabled = disabled;
        if (disabled) {
            button.classList.add('disabled');
        } else {
            button.classList.remove('disabled');
        }
        restoreMetadata();
    }

    function restoreMetadata(): void {
        meta.textContent = config.disabled && config.disabledReason
            ? config.disabledReason
            : config.description ?? '';
    }

    return {
        element: button,
        update,
        setDisabled,
        isDisabled: (): boolean => config.disabled ?? false,
        getId: (): string => config.id,
        activate,
    };
}
