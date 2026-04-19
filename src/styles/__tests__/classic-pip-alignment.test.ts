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
        const cellsImport = "@import url('./styles.cells.css');";
        const infoPanelImport = "@import url('./styles.info-panel.css');";
        const classicImport = "@import url('./styles.classic.css');";
        const themeImport = "@import url('./styles.theme.css');";
        const motionImport = "@import url('./styles.motion.css');";
        const importOrder = [
            shellImport,
            gridImport,
            cellsImport,
            infoPanelImport,
            classicImport,
            themeImport,
            motionImport,
        ];

        expect(tokensCss).toContain('--classic-guide-pip-width: 672px;');
        expect(tokensCss).not.toContain('--classic-guide-pip-width: clamp(');
        for (const cssImport of importOrder) {
            expect(epgCss).toContain(cssImport);
        }
        for (let index = 0; index < importOrder.length - 1; index += 1) {
            const currentImport = importOrder[index]!;
            const nextImport = importOrder[index + 1]!;
            expect(epgCss.indexOf(currentImport)).toBeLessThan(epgCss.indexOf(nextImport));
        }
        expect(epgCss.replace(/^\s*@import[^;]+;\s*$/gm, '').trim()).toBe('');
        expect(composedEpgCss).toContain('--classic-showcase-pip-width: var(--classic-guide-pip-width);');
        expect(videoCss).toContain('width: var(--classic-guide-pip-width) !important;');
    });
});
