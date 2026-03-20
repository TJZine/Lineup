/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string): string =>
    fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('EPG ticker styles', () => {
    it('uses a subtitle-specific travel distance for the subtitle marquee', () => {
        const epgCss = read('src/modules/ui/epg/styles.css');

        expect(epgCss).toMatch(
            /@keyframes\s+epg-subtitle-ticker\s*\{[\s\S]*var\(--epg-subtitle-ticker-distance-px,\s*0px\)/s
        );
        expect(epgCss).toMatch(
            /\.epg-cell-subtitle\.epg-cell-subtitle-ticker-running\s+\.epg-cell-subtitle-text\s*\{[^}]*animation:\s*epg-subtitle-ticker var\(--epg-subtitle-ticker-duration-ms,\s*2400ms\) linear infinite;/s
        );
    });
});
