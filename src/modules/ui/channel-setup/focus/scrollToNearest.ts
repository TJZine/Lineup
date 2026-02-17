export const scrollToNearest = (element: HTMLElement): void => {
    try {
        element.scrollIntoView({ block: 'nearest' });
    } catch {
        element.scrollIntoView();
    }
};

