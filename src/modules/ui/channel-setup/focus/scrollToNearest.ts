const findScrollableAncestor = (element: HTMLElement): HTMLElement | null => {
    let current = element.parentElement;
    while (current) {
        const style = window.getComputedStyle(current);
        const overflowY = style.overflowY;
        const canScrollY = (overflowY === 'auto' || overflowY === 'scroll')
            && current.scrollHeight > current.clientHeight;
        if (canScrollY) {
            return current;
        }
        current = current.parentElement;
    }
    return null;
};

export const scrollToNearest = (element: HTMLElement): void => {
    try {
        element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        return;
    } catch {
        // Fall through to compatibility path for browsers that reject options objects.
    }

    const ancestor = findScrollableAncestor(element);
    if (!ancestor) {
        element.scrollIntoView();
        return;
    }

    const elementBounds = element.getBoundingClientRect();
    const ancestorBounds = ancestor.getBoundingClientRect();
    const isAboveViewport = elementBounds.top < ancestorBounds.top;
    const isBelowViewport = elementBounds.bottom > ancestorBounds.bottom;

    if (!isAboveViewport && !isBelowViewport) {
        return;
    }

    element.scrollIntoView(isAboveViewport);
};
