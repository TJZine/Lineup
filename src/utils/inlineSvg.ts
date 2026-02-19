/**
 * SECURITY NOTE:
 * This helper expects developer-controlled/trusted SVG markup only (e.g., local constants).
 *
 * It performs a few runtime "footgun" checks to reduce accidental unsafe reuse, but it is
 * not a complete SVG sanitizer. Do not pass untrusted/server-provided markup here.
 */
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

    if (hasUnsafeSvgContent(root)) {
        container.replaceChildren();
        return;
    }

    container.replaceChildren(root);
}

function hasUnsafeSvgContent(root: Element): boolean {
    if (root.querySelector('script,foreignObject,iframe,object')) {
        return true;
    }

    const elements = [root, ...Array.from(root.querySelectorAll('*'))];
    for (const element of elements) {
        for (const attr of Array.from(element.attributes)) {
            const name = attr.name.toLowerCase();
            if (name.startsWith('on')) {
                return true;
            }
            if (name === 'href' || name === 'xlink:href' || name === 'src') {
                const value = attr.value.trim();
                if (/^javascript\s*:/i.test(value)) {
                    return true;
                }
            }
        }
    }

    return false;
}
