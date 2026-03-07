export type RenderCappedWarningsOptions = {
    warnings: string[];
    container: HTMLElement;
    maxItems: number;
    itemClassName: string;
};

export function renderCappedWarnings({
    warnings,
    container,
    maxItems,
    itemClassName,
}: RenderCappedWarningsOptions): void {
    for (const child of Array.from(container.children)) {
        if (
            child instanceof HTMLElement &&
            child.classList.contains(itemClassName) &&
            child.dataset.cappedWarningItem === 'true'
        ) {
            child.remove();
        }
    }

    const cappedWarnings = warnings.slice(0, maxItems);

    for (const warning of cappedWarnings) {
        const item = document.createElement('div');
        item.className = itemClassName;
        item.dataset.cappedWarningItem = 'true';
        item.textContent = warning;
        container.appendChild(item);
    }

    const remaining = warnings.length - cappedWarnings.length;
    if (remaining > 0) {
        const item = document.createElement('div');
        item.className = itemClassName;
        item.dataset.cappedWarningItem = 'true';
        item.textContent = `And ${remaining} more warning${remaining === 1 ? '' : 's'}…`;
        container.appendChild(item);
    }
}
