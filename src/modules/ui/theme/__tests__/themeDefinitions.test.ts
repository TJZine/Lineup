import { DEFAULT_THEME, THEME_OPTIONS } from '../themeDefinitions';

describe('theme settings source of truth', () => {
    it('sets ember-steel as the default theme', () => {
        expect(DEFAULT_THEME).toBe('ember-steel');
    });

    it('exposes the four upstream themes in their approved order and labels', () => {
        expect(THEME_OPTIONS).toEqual([
            { theme: 'ember-steel', label: 'Ember & Steel' },
            { theme: 'slate-pine', label: 'Slate & Pine' },
            { theme: 'swiss', label: 'Mint Noir' },
            { theme: 'directv', label: 'Satellite Blue' },
        ]);
    });
});
