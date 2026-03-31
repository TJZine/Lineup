import { setTrustedInlineSvg } from '../../../utils/inlineSvg';
import { LINEUP_GLYPH_SOURCE_BY_VARIANT, type BrandGlyphVariant } from './brandGlyphSource';

let glyphInstanceCounter = 0;

export function createLineupBrandGlyph(
    options: { variant: BrandGlyphVariant; className: string }
): HTMLSpanElement {
    const host = document.createElement('span');
    host.className = options.className;
    host.setAttribute('aria-hidden', 'true');
    host.setAttribute('role', 'presentation');

    const svgMarkup = LINEUP_GLYPH_SOURCE_BY_VARIANT[options.variant];
    setTrustedInlineSvg(host, scopeSvgIdsForInstance(svgMarkup));

    const svg = host.querySelector('svg');
    if (svg instanceof SVGElement) {
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        svg.style.display = 'block';
        svg.style.width = '100%';
        svg.style.height = '100%';
    }

    return host;
}

function scopeSvgIdsForInstance(svgMarkup: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgMarkup.trim(), 'image/svg+xml');
    const svgRoot = doc.documentElement;

    if (!svgRoot || svgRoot.nodeName.toLowerCase() !== 'svg') {
        return svgMarkup;
    }

    const idElements = Array.from(svgRoot.querySelectorAll('[id]'));
    if (idElements.length === 0) {
        return svgMarkup;
    }

    const instancePrefix = `lineup-glyph-${++glyphInstanceCounter}`;
    const idMap = new Map<string, string>();
    for (const element of idElements) {
        const originalId = element.getAttribute('id');
        if (!originalId || idMap.has(originalId)) {
            continue;
        }
        const nextId = `${instancePrefix}-${originalId}`;
        idMap.set(originalId, nextId);
        element.setAttribute('id', nextId);
    }

    const allElements = [svgRoot, ...Array.from(svgRoot.querySelectorAll('*'))];
    for (const element of allElements) {
        for (const attr of Array.from(element.attributes)) {
            let value = attr.value;
            let changed = false;
            for (const [originalId, nextId] of idMap) {
                const urlPattern = new RegExp(`url\\(#${escapeRegExp(originalId)}\\)`, 'g');
                const replaced = value.replace(urlPattern, `url(#${nextId})`);
                if (replaced !== value) {
                    value = replaced;
                    changed = true;
                }
                if (value === `#${originalId}`) {
                    value = `#${nextId}`;
                    changed = true;
                }
            }
            if (changed) {
                element.setAttribute(attr.name, value);
            }
        }
    }

    return new XMLSerializer().serializeToString(svgRoot);
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
