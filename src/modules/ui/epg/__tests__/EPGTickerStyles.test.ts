/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string): string =>
    fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('EPG ticker styles', () => {
    it('uses keyframe animation and disables ellipsis clipping while ticker classes are active', () => {
        const epgCss = read('src/modules/ui/epg/styles.css');

        expect(epgCss).toMatch(/@keyframes\s+epg-title-ticker/s);
        expect(epgCss).toMatch(
            /\.epg-cell-title\.epg-cell-title-ticker-running\s+\.epg-cell-title-text\s*\{[^}]*animation:/s
        );
        expect(epgCss).toMatch(
            /\.epg-cell-title\.epg-cell-title-ticker-ready[^{]*\{[^}]*text-overflow:\s*clip;[^}]*\}/s
        );
        expect(epgCss).toMatch(
            /@keyframes\s+epg-subtitle-ticker\s*\{[\s\S]*var\(--epg-subtitle-ticker-distance-px,\s*0px\)/s
        );
        expect(epgCss).toMatch(
            /\.epg-cell-subtitle\.epg-cell-subtitle-ticker-running\s+\.epg-cell-subtitle-text\s*\{[^}]*animation:\s*epg-subtitle-ticker var\(--epg-subtitle-ticker-duration-ms,\s*2400ms\) linear infinite;/s
        );
    });

    it('overrides tiny-tier line clamp while focused ticker classes are active', () => {
        const css = read('src/modules/ui/epg/styles.css');

        expect(css).toMatch(
            /\.epg-cell-tier-tiny\.focused\s+\.epg-cell-title\.epg-cell-title-ticker-ready,\s*\.epg-cell-tier-tiny\.focused\s+\.epg-cell-title\.epg-cell-title-ticker-running\s*\{[^}]*display:\s*block;[^}]*white-space:\s*nowrap;[^}]*text-overflow:\s*clip;[^}]*-webkit-line-clamp:\s*unset;[^}]*\}/s
        );
    });

    it('switches focused cells to the full-width two-line layout and hides the in-cell time rail', () => {
        const css = read('src/modules/ui/epg/styles.css');

        expect(css).toMatch(
            /\.epg-cell\.focused\s*\{[^}]*grid-template-columns:\s*1fr;[^}]*\}/s
        );
        expect(css).toMatch(
            /\.epg-cell\.focused\s+\.epg-cell-time\s*\{[^}]*display:\s*none;[^}]*\}/s
        );
        expect(css).toMatch(
            /\.epg-cell\.focused\s+\.epg-cell-rail\s*\{[^}]*position:\s*absolute;[^}]*\}/s
        );
    });

    it('limits the dynamic bleed wash to bleed mode only', () => {
        const css = read('src/modules/ui/epg/styles.css');

        expect(css).toMatch(
            /\.epg-info-panel\.epg-info-mode-artwork\s+\.epg-info-gradient-a,\s*\.epg-info-panel\.epg-info-mode-artwork\s+\.epg-info-gradient-b,\s*\.epg-info-panel\.epg-info-mode-theme-default\s+\.epg-info-gradient-a,\s*\.epg-info-panel\.epg-info-mode-theme-default\s+\.epg-info-gradient-b\s*\{[^}]*opacity:\s*0;[^}]*\}/s
        );
    });
});
