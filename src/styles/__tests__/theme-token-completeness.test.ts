/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';

import { THEME_CLASSES } from '../../modules/ui/settings/theme';

const THEME_CLASS_NAMES = Object.values(THEME_CLASSES) as Array<(typeof THEME_CLASSES)[keyof typeof THEME_CLASSES]>;
const REQUIRED_TOKENS = [
    '--focus-color',
    '--focus-color-rgb',
    '--color-primary',
    '--color-primary-rgb',
    '--color-primary-dark',
    '--color-primary-light',
    '--color-bg-deep',
    '--color-bg-surface',
    '--color-bg-elevated',
    '--color-bg-overlay',
    '--panel-surface',
    '--panel-surface-2',
    '--panel-border',
    '--panel-radius',
    '--scrim-tint-rgb',
] as const;

const stylesDir = path.join(process.cwd(), 'src', 'styles');

function readText(relativeToStylesDir: string): string {
    const filePath = path.join(stylesDir, relativeToStylesDir);
    return fs.readFileSync(filePath, 'utf8');
}

function extractThemeBlock(css: string, themeName: string): string {
    const classPattern = themeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\.${classPattern}\\s*\\{([\\s\\S]*?)\\}`, 'm');
    const match = css.match(re);
    if (!match?.[0]) {
        throw new Error(`Theme block not found: .${themeName} { ... }`);
    }
    return match[0];
}

describe('theme tokens', () => {
    it('each .theme-* block defines the required tokens', () => {
        const themesCss = readText('themes.css');

        for (const themeClassName of THEME_CLASS_NAMES) {
            const block = extractThemeBlock(themesCss, themeClassName);
            for (const token of REQUIRED_TOKENS) {
                expect(block).toContain(`${token}:`);
            }
        }
    });

    it('enforces RGB delimiter conventions per comments in themes.css', () => {
        const themesCss = readText('themes.css');

        for (const themeClassName of THEME_CLASS_NAMES) {
            const block = extractThemeBlock(themesCss, themeClassName);

            // --focus-color-rgb must be comma-separated (rgba(var(--focus-color-rgb), a))
            expect(block).toMatch(/--focus-color-rgb\s*:\s*\d+\s*,\s*\d+\s*,\s*\d+\s*;/);

            // --color-primary-rgb must be space-separated (rgb(var(--color-primary-rgb) / a))
            expect(block).toMatch(/--color-primary-rgb\s*:\s*\d+\s+\d+\s+\d+\s*;/);
        }
    });
});
