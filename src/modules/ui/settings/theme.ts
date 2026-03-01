/**
 * @fileoverview Theme mapping and options source of truth.
 * @module modules/ui/settings/theme
 */

export const THEME_CLASSES = {
    obsidian: '',
    broadcast: 'theme-broadcast',
    swiss: 'theme-swiss',
    directv: 'theme-directv',
    glass: 'theme-glass',
    'ember-steel': 'theme-ember-steel',
} as const;

export type ThemeName = keyof typeof THEME_CLASSES;

export const DEFAULT_THEME: ThemeName = 'obsidian';

const THEME_LABELS = {
    obsidian: 'Obsidian Glass',
    broadcast: 'Broadcast Blue',
    swiss: 'Swiss Minimal',
    directv: 'DirecTV Classic',
    glass: 'Glassmorphism (Premium)',
    'ember-steel': 'Ember & Steel',
} as const satisfies Record<ThemeName, string>;

// IMPORTANT: Keep this list exhaustive. If you add a theme, TypeScript should fail compilation
// until THEME_ORDER includes it (prevents themes silently disappearing from THEME_OPTIONS).
const THEME_ORDER_RAW = ['obsidian', 'broadcast', 'swiss', 'directv', 'glass', 'ember-steel'] as const satisfies ReadonlyArray<ThemeName>;
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
