/**
 * @jest-environment jsdom
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createLineupBrandGlyph } from '../brandGlyph';
import { LINEUP_GLYPH_SOURCE_BY_VARIANT } from '../brandGlyphSource';

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

    it('scopes internal SVG ids per instance to avoid collisions', () => {
        const a = createLineupBrandGlyph({ variant: 'color', className: 'probe-glyph-a' });
        const b = createLineupBrandGlyph({ variant: 'color', className: 'probe-glyph-b' });

        const idsA = new Set(
            Array.from(a.querySelectorAll('[id]'))
                .map((el) => el.getAttribute('id'))
                .filter((id): id is string => typeof id === 'string')
        );
        const idsB = new Set(
            Array.from(b.querySelectorAll('[id]'))
                .map((el) => el.getAttribute('id'))
                .filter((id): id is string => typeof id === 'string')
        );

        expect(idsA.size).toBeGreaterThan(0);
        expect(idsB.size).toBe(idsA.size);
        for (const id of idsA) {
            expect(idsB.has(id)).toBe(false);
        }

        const refsA = Array.from(a.querySelectorAll('[fill],[filter],[stroke]'))
            .map((el) => [el.getAttribute('fill'), el.getAttribute('filter'), el.getAttribute('stroke')].join(' '));
        expect(refsA.some((value) => /url\(#lineup-glyph-\d+-gold-face\)/.test(value))).toBe(true);
    });

    it('uses a scoped SVG filter reference for the ambient rim blur instead of invalid inline blur syntax', () => {
        expect(LINEUP_GLYPH_SOURCE_BY_VARIANT.color).toContain('<filter id="rim-blur"');
        expect(LINEUP_GLYPH_SOURCE_BY_VARIANT.color).toContain('filter="url(#rim-blur)"');
        expect(LINEUP_GLYPH_SOURCE_BY_VARIANT.color).not.toContain('filter="blur(1px)"');

        const host = createLineupBrandGlyph({ variant: 'color', className: 'probe-glyph-filter' });
        const svg = host.querySelector('svg');
        expect(svg).not.toBeNull();

        const filteredRect = Array.from(svg!.querySelectorAll('rect'))
            .find((element) => element.getAttribute('stroke') === '#ffe5a0');

        expect(filteredRect).toBeDefined();
        expect(filteredRect?.getAttribute('filter')).toMatch(/^url\(#lineup-glyph-\d+-rim-blur\)$/);
    });

    it('keeps branding asset files synchronized to the canonical source module', () => {
        const repoRoot = path.resolve(__dirname, '../../../../..');
        const monoAssetPath = path.join(repoRoot, 'assets/branding/lineup-glyph.svg');
        const colorAssetPath = path.join(repoRoot, 'assets/branding/lineup-glyph-color.svg');

        const monoAsset = readFileSync(monoAssetPath, 'utf8');
        const colorAsset = readFileSync(colorAssetPath, 'utf8');

        expect(normalizeSvg(monoAsset)).toBe(normalizeSvg(LINEUP_GLYPH_SOURCE_BY_VARIANT.monochrome));
        expect(normalizeSvg(colorAsset)).toBe(normalizeSvg(LINEUP_GLYPH_SOURCE_BY_VARIANT.color));
    });
});

function normalizeSvg(svg: string): string {
    return svg.trim().replace(/\r\n/g, '\n');
}
