export const THEME_CLASSES = {
    'ember-steel': 'theme-ember-steel',
    'slate-pine': 'theme-slate-pine',
    swiss: 'theme-swiss',
    directv: 'theme-directv',
} as const;

export type ThemeName = keyof typeof THEME_CLASSES;

export const DEFAULT_THEME: ThemeName = 'ember-steel';

const THEME_LABELS = {
    'ember-steel': 'Ember & Steel',
    'slate-pine': 'Slate & Pine',
    swiss: 'Mint Noir',
    directv: 'Satellite Blue',
} as const satisfies Record<ThemeName, string>;

// IMPORTANT: Keep this list exhaustive. If you add a theme, TypeScript should fail compilation
// until THEME_ORDER includes it (prevents themes silently disappearing from THEME_OPTIONS).
const THEME_ORDER_RAW = ['ember-steel', 'slate-pine', 'swiss', 'directv'] as const satisfies ReadonlyArray<ThemeName>;
const THEME_ORDER = Object.freeze(THEME_ORDER_RAW);

type MissingThemes = Exclude<ThemeName, (typeof THEME_ORDER_RAW)[number]>;
const _assertAllThemesListed: MissingThemes extends never ? true : never = true;
void _assertAllThemesListed;

export const THEME_OPTIONS: ReadonlyArray<Readonly<{ theme: ThemeName; label: string }>> = Object.freeze(
    THEME_ORDER.map((theme) =>
        Object.freeze({
            theme,
            label: THEME_LABELS[theme],
        })
    )
);
