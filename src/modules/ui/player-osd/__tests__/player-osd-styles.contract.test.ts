/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string): string =>
    fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('player OSD style contract', () => {
    it('removes normal-mode focused glow and up-next border while keeping forced-colors path available', () => {
        const css = read('src/modules/ui/player-osd/styles.css');

        expect(css).toMatch(/\.player-osd-action\.focused\s*\{[^}]*box-shadow:\s*none;/s);
        expect(css).toMatch(/\.player-osd-action\.focused\s*\{[^}]*outline:\s*none;/s);
        expect(css).toMatch(/\.player-osd-up-next\s*\{[^}]*border:\s*(?:none|0);/s);
        expect(css).toMatch(/@media\s*\(forced-colors:\s*active\)/);
    });
});
