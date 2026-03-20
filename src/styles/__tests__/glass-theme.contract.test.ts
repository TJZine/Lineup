/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string): string =>
    fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const GLASS_STYLE_FILES = [
    'src/modules/ui/epg/styles.css',
    'src/modules/ui/settings/styles.css',
    'src/modules/ui/mini-guide/styles.css',
    'src/modules/ui/now-playing-info/styles.css',
    'src/modules/ui/exit-confirm/styles.css',
] as const;

const glassBlocks = (css: string): string[] =>
    Array.from(css.matchAll(/\.theme-glass[^{]*\{[\s\S]*?\}/g), (match) => match[0]);

describe('glass theme contract', () => {
    it('neutralizes the shared blur tokens and locks the cyan accent', () => {
        const themesCss = read('src/styles/themes.css');
        const block = themesCss.match(/\.theme-glass\s*\{[\s\S]*?\n\}/)?.[0] ?? '';

        expect(block).toContain('--glass-backdrop-filter: none;');
        expect(block).toContain('--glass-backdrop-filter-strong: none;');
        expect(block).toContain('--focus-color: #00e5ff;');
        expect(block).toContain('--color-primary: #00e5ff;');
    });

    it('forbids backdrop blur declarations inside current glass surface blocks', () => {
        for (const relativePath of GLASS_STYLE_FILES) {
            const blocks = glassBlocks(read(relativePath));
            expect(blocks.length).toBeGreaterThan(0);

            for (const block of blocks) {
                expect(block).not.toMatch(/(^|[\s{;])backdrop-filter\s*:/m);
                expect(block).not.toMatch(/(^|[\s{;])-webkit-backdrop-filter\s*:/m);
                expect(block).not.toMatch(/blur\(/);
            }
        }
    });

    it('locks the Glass EPG focus and time-indicator accent to theme tokens', () => {
        const epgCss = read('src/modules/ui/epg/styles.css');

        expect(epgCss).toMatch(/\.theme-glass\s+\.epg-cell\.focused\s*\{[^}]*background:\s*rgba\(var\(--focus-color-rgb\), 0\.15\);/s);
        expect(epgCss).toMatch(/\.theme-glass\s+\.epg-cell\.focused\s*\{[^}]*border:\s*1px solid rgba\(var\(--focus-color-rgb\), 0\.26\);/s);
        expect(epgCss).toMatch(/\.theme-glass\s+\.epg-cell\.focused\s*\{[^}]*box-shadow:\s*none;/s);
        expect(epgCss).toMatch(/\.theme-glass\s+\.epg-time-indicator\s*\{[^}]*background:\s*var\(--color-primary\);/s);
    });
});
