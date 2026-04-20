import { blockFor } from './css-test-utils';

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
});
