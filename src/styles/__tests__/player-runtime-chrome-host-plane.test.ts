/**
 * @jest-environment node
 */

import { blockFor, declarationValue, read, readComposedCss } from './helpers/css-test-utils';

describe('player runtime chrome host plane', () => {
    it('styles the runtime chrome host as a bounded shell plane only', () => {
        const css = read('src/styles/shell.player-runtime-chrome.css');
        const block = blockFor(css, '.runtime-chrome-host');

        expect(declarationValue(block, 'position')).toBe('absolute');
        for (const edge of ['top', 'right', 'bottom', 'left']) {
            expect(declarationValue(block, edge)).toBe('0');
        }
        expect(declarationValue(block, 'pointer-events')).toBe('none');
        expect(block).not.toContain('z-index');
        expect(block).not.toContain('display');
        expect(block).not.toMatch(/\b(?:color|background|font|padding|margin)\s*:/);
    });

    it('keeps the host stylesheet in the composed shell bundle', () => {
        const shellCss = read('src/styles/shell.css');
        const composedShellCss = readComposedCss('src/styles/shell.css');

        expect(shellCss).toContain("@import url('./shell.player-runtime-chrome.css');");
        expect(composedShellCss).toContain('.runtime-chrome-host');
    });
});
