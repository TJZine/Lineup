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
    const cappedWarnings = warnings.slice(0, maxItems);

    for (const warning of cappedWarnings) {
        const item = document.createElement('div');
        item.className = itemClassName;
        item.textContent = warning;
        container.appendChild(item);
    }

    const remaining = warnings.length - cappedWarnings.length;
    if (remaining > 0) {
        const item = document.createElement('div');
        item.className = itemClassName;
        item.textContent = `And ${remaining} more warning${remaining === 1 ? '' : 's'}…`;
        container.appendChild(item);
    }
}
