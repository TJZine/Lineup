/**
 * @jest-environment jsdom
 */

import { createLineupBrandGlyph } from '../brandGlyph';

describe('createLineupBrandGlyph', () => {
    it('creates a monochrome inline glyph host with trusted SVG semantics', () => {
        const host = createLineupBrandGlyph({ variant: 'monochrome', className: 'probe-glyph' });

        expect(host.classList.contains('probe-glyph')).toBe(true);
        expect(host.getAttribute('aria-hidden')).toBe('true');

        const svg = host.querySelector('svg');
        expect(svg).not.toBeNull();
        expect(svg?.getAttribute('aria-hidden')).toBe('true');
        expect(svg?.getAttribute('focusable')).toBe('false');
        expect(svg?.outerHTML).toContain('currentColor');
    });

    it('creates a color inline glyph host with the final branded gradients', () => {
        const host = createLineupBrandGlyph({ variant: 'color', className: 'probe-glyph' });

        const svg = host.querySelector('svg');
        expect(svg).not.toBeNull();
        expect(svg?.outerHTML).toContain('gold-face');
    });
});
