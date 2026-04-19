/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';

import { readComposedCss } from './helpers/css-test-utils';

const read = (relativePath: string): string => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('classic PiP alignment contract', () => {
    it('uses one shared width token between classic showcase slot and PiP video footprint', () => {
        const tokensCss = read('src/styles/tokens.css');
        const epgCss = read('src/modules/ui/epg/styles.css');
        const composedEpgCss = readComposedCss('src/modules/ui/epg/styles.css');
        const videoCss = read('src/styles/video.css');
        const shellImport = "@import url('./styles.shell.css');";
        const gridImport = "@import url('./styles.grid.css');";

        expect(tokensCss).toContain('--classic-guide-pip-width: 672px;');
        expect(tokensCss).not.toContain('--classic-guide-pip-width: clamp(');
        expect(epgCss).toContain(shellImport);
        expect(epgCss).toContain(gridImport);
        expect(epgCss.indexOf(shellImport)).toBeLessThan(epgCss.indexOf(gridImport));
        expect(composedEpgCss).toContain('--classic-showcase-pip-width: var(--classic-guide-pip-width);');
        expect(videoCss).toContain('width: var(--classic-guide-pip-width) !important;');
    });
});
