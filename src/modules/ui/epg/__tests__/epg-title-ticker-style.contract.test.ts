/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string): string =>
    fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('EPG title ticker style contract', () => {
    it('uses keyframe animation and disables ellipsis clipping while ticker classes are active', () => {
        const css = read('src/modules/ui/epg/styles.css');

        expect(css).toMatch(/@keyframes\s+epg-title-ticker/s);
        expect(css).toMatch(/\.epg-cell-title\.epg-cell-title-ticker-running\s*\{[^}]*animation:/s);
        expect(css).toMatch(
            /\.epg-cell-title\.epg-cell-title-ticker-ready[^{]*\{[^}]*text-overflow:\s*clip;[^}]*\}/s
        );
    });
});
