import type { SettingsSelectConfig } from './types';

export function createSettingsSelect(config: SettingsSelectConfig): {
    element: HTMLButtonElement;
    update: (value: number) => void;
    setDisabled: (disabled: boolean) => void;
    isDisabled: () => boolean;
    getId: () => string;
    setValue: (value: number) => boolean;
    getOptions: () => SettingsSelectConfig['options'];
    getValue: () => number;
} {
    const button = document.createElement('button');
    button.id = config.id;
    button.className = `setup-toggle setup-toggle--adjustable${config.disabled ? ' disabled' : ''}`;
    button.disabled = config.disabled ?? false;
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-controls', 'settings-dropdown');
    button.setAttribute('aria-expanded', 'false');

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

    const valueEl = document.createElement('span');
    valueEl.className = 'setup-toggle-value';
    valueEl.textContent = resolveOptionLabel(config.options, config.value);

    const chevron = document.createElement('span');
    chevron.className = 'setup-toggle-chevron';
    chevron.textContent = '▾';
    chevron.setAttribute('aria-hidden', 'true');

    state.appendChild(valueEl);
    state.appendChild(chevron);

    button.appendChild(label);
    button.appendChild(meta);
    button.appendChild(state);

    const setValue = (nextValue: number): boolean => {
        if (config.disabled) return false;
        const previousValue = config.value;
        if (!config.options.some((option) => option.value === nextValue)) {
            return false;
        }
        if (nextValue === previousValue) {
            return false;
        }
        update(nextValue);
        applyChange(nextValue, previousValue);
        return true;
    };

    function update(value: number): void {
        config.value = value;
        valueEl.textContent = resolveOptionLabel(config.options, value);
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

    function applyChange(nextValue: number, previousValue: number): void {
        const result = config.onChange(nextValue);
        if (!result.ok) {
            update(result.effectiveValue ?? previousValue);
            meta.textContent = result.message;
            return;
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
        setValue,
        getOptions: (): SettingsSelectConfig['options'] => [...config.options],
        getValue: (): number => config.value,
    };
}

function resolveOptionLabel(options: SettingsSelectConfig['options'], value: number): string {
    const match = options.find((option) => option.value === value);
    return match ? match.label : String(value);
}
