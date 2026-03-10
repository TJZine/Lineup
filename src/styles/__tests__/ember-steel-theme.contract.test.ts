/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string): string =>
    fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const blockFor = (css: string, selector: string): string => {
    const selectorPattern = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match selector blocks even when the selector is part of a grouped selector list.
    // Keep this resilient to formatting changes (commas/newlines/indentation).
    const match = css.match(new RegExp(`(^|\\n)\\s*${selectorPattern}\\s*(?:,\\s*)?[^\\{]*\\{[\\s\\S]*?\\}`, 'm'));
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

describe('ember-steel theme contract', () => {
    it('defines the neutral steel token block and brighter ember accent', () => {
        const themesCss = read('src/styles/themes.css');
        const block = themesCss.match(/\.theme-ember-steel\s*\{[\s\S]*?\n\}/)?.[0] ?? '';

        expect(block).toContain('--focus-color: #e0782a;');
        expect(block).toContain('--color-primary: #e0782a;');
        expect(block).toContain('--color-bg-deep: #141414;');
        expect(block).toContain('--epg-info-panel-fade-to: var(--panel-surface-2);');
        expect(block).toContain('--panel-inner-glow: linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent);');
        expect(block).toContain('--scrim-tint-rgb: 20 20 20;');
    });

    it('scopes classic-guide Ember overrides to theme-ember-steel selectors', () => {
        const epgCss = read('src/modules/ui/epg/styles.css');
        const genericCellFocused = blockFor(epgCss, '.epg-cell.focused');
        const emberCellFocused = blockFor(epgCss, '.theme-ember-steel .epg-cell.focused');
        const emberClassicCellFocused = blockFor(epgCss, '.theme-ember-steel .epg-container.layout-classic .epg-cell.focused');
        const emberClassicTimeHeader = blockFor(epgCss, '.theme-ember-steel .epg-container.layout-classic .epg-time-header');
        const emberClassicChannelList = blockFor(epgCss, '.theme-ember-steel .epg-container.layout-classic .epg-channel-list');
        const emberClassicCellTitle = blockFor(epgCss, '.theme-ember-steel .epg-container.layout-classic .epg-cell-title');

        expect(declarationValue(emberCellFocused, 'background')).toBe('rgba(var(--focus-color-rgb), 0.18)');
        expect(declarationValue(emberCellFocused, 'box-shadow')).toBe('0 0 0 3px var(--focus-color) inset');

        expect(declarationValue(emberClassicCellFocused, 'background')).toBe('rgba(var(--focus-color-rgb), 0.22)');
        expect(declarationValue(emberClassicCellFocused, 'border-color')).toBe('rgba(var(--focus-color-rgb), 0.18)');
        expect(declarationValue(emberClassicCellFocused, 'box-shadow')).toBe('0 0 0 3px var(--focus-color) inset');

        expect(declarationValue(emberClassicTimeHeader, 'background')).toBe('rgb(var(--scrim-tint-rgb) / 96%)');
        expect(declarationValue(emberClassicChannelList, 'background')).toBe('rgb(var(--scrim-tint-rgb) / 98%)');
        expect(declarationValue(emberClassicCellTitle, 'color')).toBe('var(--color-text-primary)');

        expect(genericCellFocused).toContain('box-shadow: none');
        expect(genericCellFocused).not.toContain('box-shadow: 0 0 0 3px var(--focus-color) inset');
    });

    it('uses theme tokens for ember-scoped visual values and only in ember scope', () => {
        const epgCss = read('src/modules/ui/epg/styles.css');
        const emberBanner = blockFor(epgCss, '.theme-ember-steel .epg-container.layout-classic .epg-time-header-sticky');
        const emberNowPlaying = blockFor(
            epgCss,
            '.theme-ember-steel .epg-container.layout-classic .epg-cell-episode,\n.theme-ember-steel .epg-container.layout-classic .epg-info-quality-badge,\n.theme-ember-steel .epg-container.layout-classic .epg-info-pill'
        );

        expect(declarationValue(emberBanner, 'background')).toContain('var(--scrim-tint-rgb)');
        expect(declarationValue(emberBanner, 'color')).toBe('var(--color-text-primary)');
        expect(declarationValue(emberNowPlaying, 'background')).toContain('var(--scrim-tint-rgb)');
    });

    it('keeps the generic classic-guide palette unchanged outside the ember-specific override block', () => {
        const epgCss = read('src/modules/ui/epg/styles.css');
        const genericClassicTimeHeader = blockFor(epgCss, '.epg-container.layout-classic .epg-time-header');
        const genericClassicStickyHeader = blockFor(epgCss, '.epg-container.layout-classic .epg-time-header-sticky');
        const genericClassicTimeSlot = blockFor(epgCss, '.epg-container.layout-classic .epg-time-slot');
        const genericClassicChannelList = blockFor(epgCss, '.epg-container.layout-classic .epg-channel-list');
        const genericClassicCellTitle = blockFor(epgCss, '.epg-container.layout-classic .epg-cell-title');
        const genericClassicCellMeta = blockFor(epgCss, '.epg-container.layout-classic .epg-cell-time');
        const genericClassicPills = blockFor(epgCss, '.epg-container.layout-classic .epg-cell-episode');

        expect(declarationValue(genericClassicTimeHeader, 'background')).toBe('rgba(12, 15, 24, 0.96)');
        expect(declarationValue(genericClassicStickyHeader, 'color')).toBe('#f4f7ff');
        expect(declarationValue(genericClassicStickyHeader, 'background')).toBe(
            'linear-gradient(to right, rgba(12, 15, 24, 0.97), rgba(12, 15, 24, 0))'
        );
        expect(declarationValue(genericClassicTimeSlot, 'color')).toBe('#d7dcef');
        expect(declarationValue(genericClassicChannelList, 'background')).toBe('rgba(8, 11, 18, 0.98)');
        expect(declarationValue(genericClassicCellTitle, 'color')).toBe('#e7ebfb');
        expect(declarationValue(genericClassicCellMeta, 'color')).toBe('#b8c0d8');
        expect(declarationValue(genericClassicPills, 'background')).toBe('rgba(8, 11, 18, 0.42)');
    });
});
