import { blockFor, blockWithin, topLevelBlockForProperty } from './css-test-utils';

describe('css-test-utils', () => {
    it('returns the full grouped selector block when the requested selector is not first', () => {
        const css = `
@media (forced-colors: active) {
  .playback-options-item.selected.focused,
  .playback-options-item.selected:focus,
  .playback-options-item.selected:focus-visible {
    outline-color: HighlightText;
  }
}
`;

        expect(blockFor(css, '.playback-options-item.selected:focus-visible')).toContain(
            '.playback-options-item.selected.focused'
        );
        expect(blockFor(css, '.playback-options-item.selected:focus-visible')).toContain(
            '.playback-options-item.selected:focus'
        );
        expect(blockFor(css, '.playback-options-item.selected:focus-visible')).toContain(
            '.playback-options-item.selected:focus-visible'
        );
    });

    it('matches grouped selectors that contain commas inside functional pseudo-classes', () => {
        const css = `
.settings-item:is(.focused, :focus-visible),
.settings-item[data-state="active"] {
  color: var(--color-text-primary);
}
`;

        expect(blockFor(css, '.settings-item:is(.focused, :focus-visible)')).toContain(
            '.settings-item[data-state="active"]'
        );
    });

    it('returns a nested selector block from a specific at-rule container', () => {
        const css = `
.settings-item {
  color: var(--color-text-primary);
}

@media (forced-colors: active) {
  .settings-item {
    color: CanvasText;
  }
}
`;

        expect(blockWithin(css, '@media (forced-colors: active)', '.settings-item')).toContain(
            'color: CanvasText;'
        );
    });

    it('normalizes container selector whitespace before matching nested blocks', () => {
        const css = `
@media   (forced-colors: active) {
  .settings-item {
    color: CanvasText;
  }
}
`;

        expect(blockWithin(css, '@media (forced-colors: active)', '.settings-item')).toContain(
            'color: CanvasText;'
        );
    });

    it('ignores container text that appears inside comments before the real at-rule', () => {
        const css = `
/* @media (forced-colors: active) { .settings-item { color: bogus; } } */

@media (forced-colors: active) {
  .settings-item {
    color: CanvasText;
  }
}
`;

        expect(blockWithin(css, '@media (forced-colors: active)', '.settings-item')).toContain(
            'color: CanvasText;'
        );
    });

    it('keeps unscoped property lookup at the top level only', () => {
        const css = `
.settings-item {
  color: var(--color-text-primary);
}

@media (forced-colors: active) {
  .settings-item {
    color: CanvasText;
  }

  .settings-only-mobile {
    gap: var(--space-1);
  }
}
`;

        expect(topLevelBlockForProperty(css, '.settings-item', 'color')).toContain(
            'color: var(--color-text-primary);'
        );
        expect(() => topLevelBlockForProperty(css, '.settings-only-mobile', 'gap')).toThrow(
            'Top-level selector block with property not found: .settings-only-mobile -> gap'
        );
    });
});
