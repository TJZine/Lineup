/**
 * @jest-environment node
 */

import { blockFor, declarationValue, read } from './helpers/css-test-utils';

describe('settings selected control styling', () => {
    it('keeps unfocused selected toggles visually neutral across Settings tabs', () => {
        const css = read('src/modules/ui/settings/styles.core.css');
        const selectedBlock = blockFor(
            css,
            '.settings-screen .setup-toggle.selected:not(.focused):not(:focus):not(:focus-visible)'
        );

        expect(declarationValue(selectedBlock, 'background')).toBe('rgba(255, 255, 255, 0.08)');
        expect(declarationValue(selectedBlock, 'border-color')).toBe('rgba(255, 255, 255, 0.08)');
    });
});
