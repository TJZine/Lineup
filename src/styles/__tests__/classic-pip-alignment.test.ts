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
        const composedEpgCss = readComposedCss('src/modules/ui/epg/styles.css');
        const videoCss = read('src/styles/video.css');

        expect(tokensCss).toContain('--classic-guide-pip-width: 576px;');
        expect(tokensCss).not.toContain('--classic-guide-pip-width: clamp(');
        expect(composedEpgCss).toContain('--classic-showcase-pip-width: var(--classic-guide-pip-width);');
        expect(composedEpgCss).toContain('width: var(--classic-guide-pip-width);');
        expect(composedEpgCss).not.toContain('--classic-guide-pip-width: 576px;');
        expect(videoCss).toContain('width: var(--classic-guide-pip-width) !important;');
        expect(videoCss).not.toContain('--classic-guide-pip-width: 576px;');
    });
});
