import { DEFAULT_THEME, THEME_OPTIONS } from '../theme';

describe('theme settings source of truth', () => {
    it('sets ember-steel as the default theme', () => {
        expect(DEFAULT_THEME).toBe('ember-steel');
    });

    it('lists ember-steel as the first selectable theme', () => {
        expect(THEME_OPTIONS[0]?.theme).toBe('ember-steel');
    });
});
