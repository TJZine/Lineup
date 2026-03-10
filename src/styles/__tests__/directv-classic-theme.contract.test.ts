/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string): string =>
    fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const blockFor = (css: string, selector: string): string => {
    const selectorPattern = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = css.match(new RegExp(`${selectorPattern}\\s*\\{[\\s\\S]*?\\}`, 'm'));
    if (!match) {
        throw new Error(`Selector block not found: ${selector}`);
    }
    return match[0];
};

const declarationValue = (block: string, property: string): string => {
    const regex = new RegExp(`${property}\\s*:\\s*([^;]+);`);
    const match = block.match(regex);
    if (!match || typeof match[1] !== 'string') {
        throw new Error(`Property not found: ${property}`);
    }
    return match[1].replace(/\s+/g, ' ').trim();
};

describe('directv-classic theme contract', () => {
    it('keeps shared DirecTV tokens valid while reserving yellow for EPG-only helper tokens', () => {
        const themesCss = read('src/styles/themes.css');
        const block = themesCss.match(/\.theme-directv\s*\{[\s\S]*?\n\}/)?.[0] ?? '';

        expect(block).toContain('--focus-color: #00a6d6;');
        expect(block).toContain('--panel-surface: rgba(0, 28, 56, 0.94);');
        expect(block).toContain('--directv-focus-fill: #ffcc00;');
        expect(block).toContain('--directv-grid-border: #00a6d6;');
        expect(block).not.toContain('--panel-surface: linear-gradient');
    });

    it('scopes retro gradients and yellow fill to DirecTV classic-guide selectors', () => {
        const epgCss = read('src/modules/ui/epg/styles.css');
        const classicCell = blockFor(epgCss, '.theme-directv .epg-container.layout-classic .epg-cell');
        const classicFocus = blockFor(epgCss, '.theme-directv .epg-container.layout-classic .epg-cell.focused');
        const infoPanel = blockFor(
            epgCss,
            '.theme-directv .epg-info-panel,\n.theme-directv .epg-info-panel.epg-info-mode-artwork,\n.theme-directv .epg-info-panel.epg-info-mode-theme-default'
        );
        const infoBackdrop = blockFor(
            epgCss,
            '.theme-directv .epg-info-panel.epg-info-mode-artwork .epg-info-backdrop,\n.theme-directv .epg-info-panel.epg-info-mode-theme-default .epg-info-backdrop'
        );

        expect(declarationValue(classicCell, 'background')).toContain('var(--directv-panel-gradient-start)');
        expect(declarationValue(classicCell, 'border-color')).toBe('rgb(var(--color-primary-rgb) / 82%)');
        expect(declarationValue(classicFocus, 'background')).toBe('var(--directv-focus-fill)');
        expect(declarationValue(classicFocus, 'border-color')).toBe('var(--directv-focus-border)');
        expect(declarationValue(infoPanel, 'background')).toContain('var(--directv-panel-gradient-strong-end)');
        expect(declarationValue(infoPanel, 'border-color')).toBe('rgb(var(--color-primary-rgb) / 82%)');
        expect(declarationValue(infoBackdrop, 'background')).toContain('var(--directv-panel-gradient-strong-end)');
    });

    it('keeps Swiss as the only minimal-density theme and removes DirecTV !important suppression', () => {
        const epgCss = read('src/modules/ui/epg/styles.css');
        const minimalText = blockFor(epgCss, '.theme-swiss .epg-cell-meta,\n.theme-swiss .epg-cell-subtitle');
        const minimalInfo = blockFor(epgCss, '.theme-swiss .epg-info-backdrop,\n.theme-swiss .epg-info-tags');
        const minimalTitle = blockFor(epgCss, '.theme-swiss .epg-cell-title');

        expect(minimalText).not.toContain('.theme-directv');
        expect(minimalInfo).not.toContain('.theme-directv');
        expect(minimalTitle).not.toContain('.theme-directv');
    });
});
