import fs from 'node:fs';
import path from 'node:path';

describe('focused EPG overflow style contract', () => {
    const cssPath = path.resolve(__dirname, '..', 'styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    it('keeps tiny focused ticker titles unclamped', () => {
        expect(css).toContain('.epg-cell-tier-tiny.focused .epg-cell-title.epg-cell-title-ticker-ready');
        expect(css).toContain('.epg-cell-tier-tiny.focused .epg-cell-title.epg-cell-title-ticker-running');
        expect(css).toContain('-webkit-line-clamp: unset');
        expect(css).toContain('white-space: nowrap');
    });

    it('keeps focused compact selector contract for hiding in-cell time', () => {
        expect(css).toContain('.epg-cell.focused.epg-cell-focused-compact');
        expect(css).toContain('.epg-cell.focused.epg-cell-focused-compact .epg-cell-time');
    });

    it('keeps focused normal narrow/tiny rail selectors', () => {
        expect(css).toContain('.epg-cell.focused:not(.epg-cell-focused-compact).epg-cell-tier-narrow');
        expect(css).toContain('.epg-cell.focused:not(.epg-cell-focused-compact).epg-cell-tier-tiny');
    });

    it('keeps reduced-motion ticker suppression selectors', () => {
        expect(css).toContain('@media (prefers-reduced-motion: reduce)');
        expect(css).toContain('.epg-cell-title.epg-cell-title-ticker-ready');
        expect(css).toContain('.epg-cell-subtitle.epg-cell-subtitle-ticker-running');
    });
});
