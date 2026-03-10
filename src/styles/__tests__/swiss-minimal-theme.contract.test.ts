/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string): string =>
    fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('swiss minimal theme contract', () => {
    it('defines the sharp Swiss token set', () => {
        const themesCss = read('src/styles/themes.css');
        const block = themesCss.match(/\.theme-swiss\s*\{[\s\S]*?\n\}/)?.[0] ?? '';

        expect(block).toContain('--color-bg-deep: #020202;');
        expect(block).toContain('--panel-radius: 0px;');
        expect(block).toContain('--shadow-sm: none;');
        expect(block).toContain('--shadow-md: none;');
        expect(block).toContain('--shadow-lg: none;');
        expect(block).toContain('--font-family-display: "Helvetica Neue", helvetica, "Avenir Next", arial, sans-serif;');
    });

    it('preserves Swiss density exclusions and sharpens classic EPG surfaces', () => {
        const epgCss = read('src/modules/ui/epg/styles.css');

        expect(epgCss).toContain('.theme-swiss .epg-cell-meta,');
        expect(epgCss).toContain('.theme-swiss .epg-info-tags {');
        expect(epgCss).toMatch(
            /\.theme-swiss\s+\.epg-container\.layout-classic\s*\{[^}]*--classic-cell-radius:\s*0px;/s
        );
        expect(epgCss).toMatch(
            /\.theme-swiss\s+\.epg-container\.layout-classic\s+\.epg-cell\.focused\s*\{[^}]*box-shadow:\s*0 0 0 4px var\(--focus-color\) inset;/s
        );
    });

    it('adds explicit Swiss settings sharpness overrides', () => {
        const settingsCss = read('src/modules/ui/settings/styles.css');

        expect(settingsCss).toMatch(
            /\.theme-swiss\s+\.settings-categories\s*\{[^}]*border-radius:\s*0;/s
        );
        expect(settingsCss).toMatch(
            /\.theme-swiss\s+\.settings-category-button,\s*\.theme-swiss\s+\.settings-profile-row\s*\{[^}]*border-radius:\s*0;/s
        );
        expect(settingsCss).toMatch(
            /\.theme-swiss\s+\.settings-dropdown,\s*\.theme-swiss\s+\.settings-dropdown-option\s*\{[^}]*border-radius:\s*0;/s
        );
    });
});
