/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';

import { THEME_CLASSES } from '../../modules/ui/theme';

const THEME_CLASS_NAMES = Object.values(THEME_CLASSES) as Array<(typeof THEME_CLASSES)[keyof typeof THEME_CLASSES]>;
const REQUIRED_TOKENS = [
    '--focus-color',
    '--focus-color-rgb',
    '--focus-border-color',
    '--focus-surface',
    '--focus-surface-rgb',
    '--focus-surface-rgb-legacy',
    '--focus-inset-surface',
    '--focus-text-primary',
    '--focus-text-secondary',
    '--focus-text-muted',
    '--color-text-on-focus',
    '--focus-treatment',
    '--color-primary',
    '--color-primary-rgb',
    '--color-primary-rgb-legacy',
    '--color-primary-dark',
    '--color-primary-light',
    '--color-primary-alpha-08',
    '--color-primary-alpha-12',
    '--color-primary-alpha-15',
    '--color-primary-alpha-16',
    '--color-primary-alpha-20',
    '--color-primary-alpha-45',
    '--color-primary-alpha-60',
    '--color-primary-alpha-90',
    '--color-bg-deep',
    '--color-bg-surface',
    '--color-bg-elevated',
    '--color-bg-overlay',
    '--overlay-surface-rgb',
    '--overlay-surface-rgb-legacy',
    '--overlay-surface-alpha',
    '--overlay-surface-alpha-legacy',
    '--panel-surface',
    '--panel-surface-2',
    '--panel-border',
    '--panel-radius',
    '--color-text-primary',
    '--color-text-secondary',
    '--color-text-muted',
    '--color-text-disabled',
    '--color-border-subtle',
    '--color-border-default',
    '--color-border-focus',
    '--color-error',
    '--color-error-text',
    '--selection-surface',
    '--selection-surface-rgb',
    '--selection-surface-rgb-legacy',
    '--selection-border',
    '--tuned-surface',
    '--progress-track',
    '--progress-fill',
    '--scrim-tint-rgb',
    '--scrim-tint-rgb-legacy',
] as const;

const REQUIRED_SHARED_TOKENS = [
    '--font-family-sans',
    '--font-family-display',
    '--font-family-mono',
    '--text-page-title',
    '--text-section-title',
    '--type-page-title-family',
    '--type-page-title-size',
    '--type-page-title-weight',
    '--type-page-title-stretch',
    '--type-page-title-letter-spacing',
    '--type-page-title-line-height',
    '--type-section-title-family',
    '--type-section-title-size',
    '--type-section-title-weight',
    '--type-section-title-stretch',
    '--type-section-title-letter-spacing',
    '--type-section-title-line-height',
    '--text-body',
    '--text-control',
    '--text-action',
    '--text-xs',
    '--space-screen-inset',
    '--space-section-gap',
    '--focus-ring-width',
    '--focus-ring-width-large',
    '--motion-duration-fast',
    '--motion-duration-standard',
    '--motion-distance-scale',
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

            // --color-primary-rgb-legacy must be comma-separated (rgba(var(--color-primary-rgb-legacy), a))
            expect(block).toMatch(/--color-primary-rgb-legacy\s*:\s*\d+\s*,\s*\d+\s*,\s*\d+\s*;/);

            // --scrim-tint-rgb must be space-separated (rgb(var(--scrim-tint-rgb) / a))
            expect(block).toMatch(/--scrim-tint-rgb\s*:\s*\d+\s+\d+\s+\d+\s*;/);

            // --scrim-tint-rgb-legacy must be comma-separated (rgba(var(--scrim-tint-rgb-legacy), a))
            expect(block).toMatch(/--scrim-tint-rgb-legacy\s*:\s*\d+\s*,\s*\d+\s*,\s*\d+\s*;/);

            // Color aliases are consumed through var(), so keep their values valid in older engines.
            expect(block).toMatch(
                /--color-primary-alpha-16\s*:\s*rgba\(var\(--color-primary-rgb-legacy\),\s*0\.16\);/
            );
        }
    });

    it('keeps the four supported palettes free of retired Glass selectors', () => {
        const themesCss = readText('themes.css');

        expect(THEME_CLASS_NAMES).toHaveLength(4);
        expect(themesCss).not.toMatch(/\.theme-glass\b/);
    });

    it('defines shared type, layout, focus, and motion roles with bundled fonts', () => {
        const tokensCss = readText('tokens.css');
        const themesCss = readText('themes.css');

        for (const token of REQUIRED_SHARED_TOKENS) {
            expect(tokensCss).toContain(`${token}:`);
        }

        expect(tokensCss).toContain('--text-page-title: 44px;');
        expect(tokensCss).toContain('--text-section-title: 24px;');
        expect(tokensCss).toContain('--font-display-width-title: 92%;');
        expect(tokensCss).toContain('--type-page-title-letter-spacing: -0.01em;');
        expect(tokensCss).toContain('--type-page-title-line-height: 1.08;');
        expect(tokensCss).toContain('--type-section-title-stretch: var(--font-display-width-title);');
        expect(tokensCss).toContain('--type-section-title-letter-spacing: -0.01em;');
        expect(tokensCss).toContain('--type-section-title-line-height: normal;');

        expect(tokensCss).toContain("font-family: Inter;");
        expect(tokensCss).toContain("font-family: 'Instrument Sans';");
        expect(tokensCss).toContain('font-weight: 400 700;');
        expect(tokensCss).toContain('font-stretch: 75% 100%;');
        expect(fs.existsSync(path.join(stylesDir, '..', 'assets', 'fonts', 'inter-variable.ttf'))).toBe(true);
        expect(fs.existsSync(path.join(stylesDir, '..', 'assets', 'fonts', 'instrument-sans-variable.ttf'))).toBe(true);
        expect(themesCss).toContain("[data-player-overlay-transparency='more-transparent']");
        expect(themesCss).toContain("[data-player-overlay-transparency='standard']");
        expect(themesCss).toContain("[data-player-overlay-transparency='reduced']");
        expect(tokensCss).toContain(
            '--player-overlay-surface: rgba(var(--overlay-surface-rgb-legacy), var(--player-overlay-surface-alpha-legacy));'
        );
        expect(tokensCss).toContain(
            '--player-overlay-surface-alpha-legacy: var(--player-overlay-surface-alpha-standard-legacy);'
        );
        expect(tokensCss).toContain("[data-large-focus='true']");
        expect(tokensCss).toContain("[data-motion='reduced']");
        expect(tokensCss).toContain('@media (prefers-reduced-motion: reduce)');
        expect(tokensCss).toContain('@media (forced-colors: active)');
    });

    it('consumes full page and section title roles in the shared specimen', () => {
        const specimenPath = path.join(
            process.cwd(),
            'docs/analysis/2026-10-31-webos-alignment-execution/u1/index.html'
        );
        const specimen = fs.readFileSync(specimenPath, 'utf8');

        for (const role of ['page', 'section'] as const) {
            for (const property of [
                'family',
                'size',
                'weight',
                'stretch',
                'letter-spacing',
                'line-height',
            ]) {
                const token = `--type-${role}-title-${property}`;
                expect(specimen).toContain(`var(${token})`);
            }
        }
    });

    it('applies forced-colors semantic roles over every active theme class', () => {
        const themesCss = readText('themes.css');
        const forcedColorsIndex = themesCss.indexOf('@media (forced-colors: active)');
        const forcedColorsBlock = themesCss.slice(forcedColorsIndex);

        expect(forcedColorsIndex).toBeGreaterThanOrEqual(0);
        for (const themeClassName of THEME_CLASS_NAMES) {
            expect(forcedColorsBlock).toContain(`.${themeClassName}`);
        }
        expect(forcedColorsBlock).toContain('--focus-color: Highlight;');
        expect(forcedColorsBlock).toContain('--focus-text-primary: CanvasText;');
        expect(forcedColorsBlock).toContain('--selection-border: Highlight;');
    });
});
