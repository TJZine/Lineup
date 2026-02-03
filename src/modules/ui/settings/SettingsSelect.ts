/**
 * @fileoverview Settings select component - focusable multi-value button.
 * @module modules/ui/settings/SettingsSelect
 */

import type { SettingsSelectConfig } from './types';

export function createSettingsSelect(config: SettingsSelectConfig): {
    element: HTMLButtonElement;
    update: (value: number) => void;
    setDisabled: (disabled: boolean) => void;
    isDisabled: () => boolean;
    getId: () => string;
    cyclePrev: () => void;
    cycleNext: () => void;
} {
    const button = document.createElement('button');
    button.id = config.id;
    button.className = `setup-toggle${config.disabled ? ' disabled' : ''}`;
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

    const leftArrow = document.createElement('span');
    leftArrow.className = 'setup-toggle-arrow left';
    leftArrow.textContent = '◀';

    const valueEl = document.createElement('span');
    valueEl.className = 'setup-toggle-value';
    valueEl.textContent = resolveOptionLabel(config.options, config.value);

    const rightArrow = document.createElement('span');
    rightArrow.className = 'setup-toggle-arrow right';
    rightArrow.textContent = '▶';

    state.appendChild(leftArrow);
    state.appendChild(valueEl);
    state.appendChild(rightArrow);

    button.appendChild(label);
    button.appendChild(meta);
    button.appendChild(state);

    button.addEventListener('click', () => {
        if (config.disabled) return;
        const nextValue = getNextValueClamped(config.options, config.value);
        update(nextValue);
        config.onChange(nextValue);
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
        cyclePrev: (): void => {
            if (config.disabled) return;
            const nextValue = getPrevValue(config.options, config.value);
            update(nextValue);
            config.onChange(nextValue);
        },
        cycleNext: (): void => {
            if (config.disabled) return;
            const nextValue = getNextValueClamped(config.options, config.value);
            update(nextValue);
            config.onChange(nextValue);
        },
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
