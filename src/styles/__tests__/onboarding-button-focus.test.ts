/**
 * @jest-environment node
 */

import { blockFor, declarationValue, read } from './helpers/css-test-utils';

describe('onboarding button focus styling', () => {
    it('uses white text when the focused button fill changes to the dark focus surface', () => {
        const css = read('src/styles/shell.onboarding.shared-shell.css');
        const focusedBlock = blockFor(css, '.screen-button.focused');

        expect(declarationValue(focusedBlock, 'color')).toBe('#ffffff');
        expect(declarationValue(focusedBlock, 'background')).toContain('var(--onboarding-focus-bg');
    });

    it('keeps the intended unfocused button text colors for primary, secondary, and destructive variants', () => {
        const css = read('src/styles/shell.onboarding.shared-shell.css');

        expect(declarationValue(blockFor(css, '.screen-button'), 'color')).toBe('#0e1017');
        expect(declarationValue(blockFor(css, '.screen-button.secondary'), 'color')).toBe('var(--onboarding-text)');
        expect(declarationValue(blockFor(css, '.screen-button.destructive'), 'color')).toBe('#ffffff');
    });
});
