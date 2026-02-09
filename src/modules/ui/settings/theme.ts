/**
 * @fileoverview Theme mapping and options source of truth.
 * @module modules/ui/settings/theme
 */

export const THEME_CLASSES = {
    obsidian: '',
    broadcast: 'theme-broadcast',
    swiss: 'theme-swiss',
    directv: 'theme-directv',
} as const;

export type ThemeName = keyof typeof THEME_CLASSES;

export const DEFAULT_THEME: ThemeName = 'obsidian';

const THEME_LABELS = {
    obsidian: 'Obsidian Glass',
    broadcast: 'Broadcast Blue',
    swiss: 'Swiss Minimal',
    directv: 'DirecTV Classic',
} as const satisfies Record<ThemeName, string>;

const THEME_ORDER = Object.freeze(
    ['obsidian', 'broadcast', 'swiss', 'directv'] as const satisfies ReadonlyArray<ThemeName>
);

export const THEME_OPTIONS: ReadonlyArray<Readonly<{ theme: ThemeName; label: string }>> = Object.freeze(
    THEME_ORDER.map((theme) =>
        Object.freeze({
            theme,
            label: THEME_LABELS[theme],
        })
    )
);
