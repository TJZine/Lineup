/**
 * @jest-environment node
 */

import { blockFor, declarationValue, read } from './helpers/css-test-utils';

describe('onboarding button focus styling', () => {
    it('uses the semantic focus text and surface roles for focused buttons', () => {
        const css = read('src/styles/shell.onboarding.shared-shell.css');
        const focusedBlock = blockFor(css, '.screen-button.focused');

        expect(declarationValue(focusedBlock, 'color')).toBe('var(--focus-text-primary)');
        expect(declarationValue(focusedBlock, 'background')).toBe('var(--focus-surface)');
    });

    it('uses theme roles for unfocused primary, secondary, and destructive buttons', () => {
        const css = read('src/styles/shell.onboarding.shared-shell.css');

        expect(declarationValue(blockFor(css, '.screen-button'), 'color')).toBe('var(--color-text-on-focus)');
        expect(declarationValue(blockFor(css, '.screen-button.secondary'), 'color')).toBe('var(--color-text-primary)');
        expect(declarationValue(blockFor(css, '.screen-button.destructive'), 'color')).toBe('var(--color-text-on-focus)');
    });
});
