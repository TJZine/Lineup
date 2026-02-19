export function setTrustedInlineSvg(container: HTMLElement, svgMarkup: string): void {
    const trimmed = svgMarkup.trim();
    if (trimmed.length === 0) {
        container.replaceChildren();
        return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(trimmed, 'image/svg+xml');
    const root = doc.documentElement;

    if (!root || root.nodeName.toLowerCase() !== 'svg') {
        container.replaceChildren();
        return;
    }

    if (root.querySelector('script')) {
        container.replaceChildren();
        return;
    }

    container.replaceChildren(root);
}
