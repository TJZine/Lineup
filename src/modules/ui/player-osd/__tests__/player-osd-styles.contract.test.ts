/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string): string =>
    fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('player OSD style contract', () => {
    it('keeps focused actions flat in normal mode and preserves forced-colors fallback', () => {
        const css = read('src/modules/ui/player-osd/styles.css');

        expect(css).toMatch(/\.player-osd-action\.focused\s*\{[^}]*box-shadow:\s*none;/s);
        expect(css).toMatch(/\.player-osd-action\.focused\s*\{[^}]*outline:\s*none;/s);
        expect(css).toMatch(/\.player-osd-up-next\s*\{[^}]*border:\s*(?:none|0);/s);
        expect(css).toMatch(/@media\s*\(forced-colors:\s*active\)/);
    });

    it('animates the inner tray instead of the full root container', () => {
        const css = read('src/modules/ui/player-osd/styles.css');

        expect(css).toMatch(/\.player-osd\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*display:\s*flex;[^}]*align-items:\s*flex-end;/s);
        expect(css).not.toMatch(/\.player-osd\s*\{[^}]*transform:\s*translateY\(100%\);/s);
        expect(css).toMatch(/\.player-osd-panel\s*\{[^}]*transform:\s*translateY\(100%\);/s);
        expect(css).toMatch(/\.player-osd\.visible\s+\.player-osd-panel\s*\{[^}]*transform:\s*translateY\(0\);/s);
    });

    it('disables tray transform motion under reduced-motion preferences', () => {
        const css = read('src/modules/ui/player-osd/styles.css');

        expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*\.player-osd-panel\s*\{[^}]*transition:\s*none;/s);
    });
});
