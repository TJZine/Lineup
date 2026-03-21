/**
 * @jest-environment node
 */
import { read, blockFor, declarationValue } from './helpers/css-test-utils';

describe('EPG focused theme styles', () => {
    it('keeps Glass focused cells on the fill treatment instead of the old full outline', () => {
        const epgCss = read('src/modules/ui/epg/styles.css');
        const glassCellFocused = blockFor(epgCss, '.theme-glass .epg-cell.focused');

        expect(declarationValue(glassCellFocused, 'background')).toBe('rgba(var(--focus-color-rgb), 0.15)');
        expect(declarationValue(glassCellFocused, 'border')).toBe('1px solid rgba(var(--focus-color-rgb), 0.26)');
        expect(declarationValue(glassCellFocused, 'box-shadow')).toBe('none');
        expect(glassCellFocused).not.toContain('inset');
    });

    it('keeps Ember Steel focused cells on the fill treatment instead of the old full outline', () => {
        const epgCss = read('src/modules/ui/epg/styles.css');
        const emberCellFocused = blockFor(epgCss, '.theme-ember-steel .epg-cell.focused');
        const emberClassicCellFocused = blockFor(epgCss, '.theme-ember-steel .epg-container.layout-classic .epg-cell.focused');

        expect(declarationValue(emberCellFocused, 'background')).toBe('rgba(var(--focus-color-rgb), 0.18)');
        expect(declarationValue(emberCellFocused, 'box-shadow')).toBe('none');
        expect(emberCellFocused).not.toContain('inset');

        expect(declarationValue(emberClassicCellFocused, 'background')).toBe('rgba(var(--focus-color-rgb), 0.22)');
        expect(declarationValue(emberClassicCellFocused, 'border-color')).toBe('rgba(var(--focus-color-rgb), 0.18)');
        expect(declarationValue(emberClassicCellFocused, 'box-shadow')).toBe('none');
        expect(emberClassicCellFocused).not.toContain('inset');
    });

    it('keeps Swiss focused cells on the fill treatment instead of the old full outline', () => {
        const epgCss = read('src/modules/ui/epg/styles.css');
        const swissCellFocused = blockFor(epgCss, '.theme-swiss .epg-cell.focused');
        const swissClassicCellFocused = blockFor(epgCss, '.theme-swiss .epg-container.layout-classic .epg-cell.focused');

        expect(declarationValue(swissCellFocused, 'background')).toBe('rgba(var(--focus-color-rgb), 0.12)');
        expect(declarationValue(swissCellFocused, 'box-shadow')).toBe('none');
        expect(swissCellFocused).not.toContain('inset');

        expect(declarationValue(swissClassicCellFocused, 'background')).toBe('rgba(var(--focus-color-rgb), 0.12)');
        expect(declarationValue(swissClassicCellFocused, 'border-color')).toBe('rgba(var(--focus-color-rgb), 0.12)');
        expect(declarationValue(swissClassicCellFocused, 'box-shadow')).toBe('none');
        expect(swissClassicCellFocused).not.toContain('inset');
    });
});
