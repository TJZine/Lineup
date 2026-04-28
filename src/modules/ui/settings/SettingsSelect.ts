import type { SettingsSelectConfig } from './types';

export function createSettingsSelect(config: SettingsSelectConfig): {
    element: HTMLButtonElement;
    update: (value: number) => void;
    setDisabled: (disabled: boolean) => void;
    isDisabled: () => boolean;
    getId: () => string;
    cyclePrev: () => boolean;
    cycleNext: () => boolean;
    setValue: (value: number) => boolean;
    getOptions: () => SettingsSelectConfig['options'];
    getValue: () => number;
} {
    const button = document.createElement('button');
    button.id = config.id;
    button.className = `setup-toggle setup-toggle--adjustable${config.disabled ? ' disabled' : ''}`;
    button.disabled = config.disabled ?? false;

    const label = document.createElement('span');
    label.className = 'setup-toggle-label';
    label.textContent = config.label;

    const meta = document.createElement('span');
    meta.className = 'setup-toggle-meta';
    meta.textContent = config.disabled && config.disabledReason
        ? config.disabledReason
        : config.description ?? '';

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

    const cyclePrev = (): boolean => {
        if (config.disabled) return false;
        const previousValue = config.value;
        const nextValue = getPrevValue(config.options, config.value);
        update(nextValue);
        if (nextValue === previousValue) {
            return false;
        }
        config.onChange(nextValue);
        return true;
    };

    const cycleNext = (): boolean => {
        if (config.disabled) return false;
        const previousValue = config.value;
        const nextValue = getNextValueClamped(config.options, config.value);
        update(nextValue);
        if (nextValue === previousValue) {
            return false;
        }
        config.onChange(nextValue);
        return true;
    };

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
        config.onChange(nextValue);
        return true;
    };

    button.addEventListener('click', () => {
        cycleNext();
    });

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
        meta.textContent = disabled && config.disabledReason
            ? config.disabledReason
            : config.description ?? '';
    }

    return {
        element: button,
        update,
        setDisabled,
        isDisabled: (): boolean => config.disabled ?? false,
        getId: (): string => config.id,
        cyclePrev,
        cycleNext,
        setValue,
        getOptions: (): SettingsSelectConfig['options'] => [...config.options],
        getValue: (): number => config.value,
    };
}

function resolveOptionLabel(options: SettingsSelectConfig['options'], value: number): string {
    const match = options.find((option) => option.value === value);
    return match ? match.label : String(value);
}

function getPrevValue(options: SettingsSelectConfig['options'], value: number): number {
    if (options.length === 0) return value;
    const currentIndex = options.findIndex((option) => option.value === value);
    const prevIndex = currentIndex >= 0 ? Math.max(0, currentIndex - 1) : 0;
    return options[prevIndex]?.value ?? value;
}

function getNextValueClamped(options: SettingsSelectConfig['options'], value: number): number {
    if (options.length === 0) return value;
    const currentIndex = options.findIndex((option) => option.value === value);
    const nextIndex = currentIndex >= 0 ? Math.min(options.length - 1, currentIndex + 1) : 0;
    return options[nextIndex]?.value ?? value;
}
