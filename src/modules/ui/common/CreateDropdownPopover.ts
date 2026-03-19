import type { FocusableElement, INavigationManager } from '../../navigation/interfaces';

export interface DropdownPopoverOption {
    label: string;
    value: string;
}

export interface DropdownPopoverConfig {
    anchor: HTMLElement;
    container: HTMLElement;
    options: DropdownPopoverOption[];
    currentValue: string;
    onSelect: (value: string) => void;
    onDismiss: () => void;
    nav: Pick<INavigationManager, 'registerFocusable' | 'unregisterFocusable' | 'setFocus'> | null;
    cssClass: string;
    optionCssClass: string;
}

export function createDropdownPopover(config: DropdownPopoverConfig): {
    destroy: () => void;
    dismiss: () => void;
} {
    const overlayId = config.cssClass;
    const optionIdPrefix = `${config.cssClass}-option-`;
    const existing = config.container.querySelector<HTMLElement>(`#${overlayId}`);

    if (existing && config.nav) {
        const oldOptions = existing.querySelectorAll<HTMLElement>(`[id^="${optionIdPrefix}"]`);
        for (const option of oldOptions) {
            config.nav.unregisterFocusable(option.id);
        }
    }
    existing?.remove();

    const overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.className = config.cssClass;
    overlay.setAttribute('role', 'listbox');
    overlay.setAttribute('aria-label', 'Select an option');

    const anchorRect = config.anchor.getBoundingClientRect();
    const containerRect = config.container.getBoundingClientRect();
    const topOffset = anchorRect.bottom - containerRect.top + 4;
    const leftOffset = anchorRect.left - containerRect.left;
    const dropdownWidth = Math.max(anchorRect.width, 200);

    overlay.style.top = `${topOffset}px`;
    overlay.style.left = `${leftOffset}px`;
    overlay.style.width = `${dropdownWidth}px`;

    const optionIds: string[] = [];
    const optionElements: HTMLElement[] = [];
    const selectedClassName = `${config.optionCssClass}--selected`;
    const focusedClassName = 'focused';

    const setFocusedOption = (focusedId: string | null): void => {
        for (const element of optionElements) {
            element.classList.toggle(focusedClassName, element.id === focusedId);
        }
    };

    for (let i = 0; i < config.options.length; i += 1) {
        const option = config.options[i];
        if (!option) continue;
        const optionId = `${optionIdPrefix}${i}`;
        optionIds.push(optionId);

        const item = document.createElement('button');
        item.id = optionId;
        item.type = 'button';
        item.className = config.optionCssClass;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', option.value === config.currentValue ? 'true' : 'false');

        if (option.value === config.currentValue) {
            item.classList.add(selectedClassName);
        }

        const labelSpan = document.createElement('span');
        labelSpan.className = `${config.optionCssClass}-label`;
        labelSpan.textContent = option.label;

        const checkSpan = document.createElement('span');
        checkSpan.className = `${config.optionCssClass}-check`;
        checkSpan.textContent = option.value === config.currentValue ? '✓' : '';
        checkSpan.setAttribute('aria-hidden', 'true');

        item.appendChild(labelSpan);
        item.appendChild(checkSpan);
        item.addEventListener('focus', () => setFocusedOption(optionId));
        item.addEventListener('click', () => {
            config.onSelect(option.value);
        });

        optionElements.push(item);
        overlay.appendChild(item);
    }

    config.container.appendChild(overlay);

    const overlayRect = overlay.getBoundingClientRect();
    if (overlayRect.bottom > window.innerHeight - 20) {
        const flippedTop = anchorRect.top - containerRect.top - overlayRect.height - 4;
        if (flippedTop > 0) {
            overlay.style.top = `${flippedTop}px`;
        }
    }

    if (config.nav) {
        for (let i = 0; i < optionIds.length; i += 1) {
            const optionId = optionIds[i];
            const element = optionElements[i];
            if (!optionId || !element) continue;

            const neighbors: { up?: string; down?: string; left?: string; right?: string } = {
                left: optionId,
                right: optionId,
            };
            const upId = i > 0 ? optionIds[i - 1] : undefined;
            const downId = i < optionIds.length - 1 ? optionIds[i + 1] : undefined;
            if (upId) neighbors.up = upId;
            if (downId) neighbors.down = downId;

            const focusable: FocusableElement = {
                id: optionId,
                element,
                neighbors,
                onFocus: () => {
                    setFocusedOption(optionId);
                },
                onSelect: () => {
                    const option = config.options[i];
                    if (option) {
                        config.onSelect(option.value);
                    }
                },
            };

            config.nav.registerFocusable(focusable);
        }

        const currentIndex = config.options.findIndex((option) => option.value === config.currentValue);
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
            for (const optionId of optionIds) {
                config.nav.unregisterFocusable(optionId);
            }
        }
        overlay.remove();
    };

    const dismiss = (): void => {
        if (dismissed || destroyed) return;
        dismissed = true;
        try {
            config.onDismiss();
        } finally {
            destroy();
        }
    };

    return { destroy, dismiss };
}
