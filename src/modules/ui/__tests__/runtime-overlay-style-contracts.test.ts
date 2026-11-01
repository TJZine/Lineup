/**
 * @jest-environment jsdom
 */

import fs from 'node:fs';
import path from 'node:path';
import {
    blockFor,
    blockWithin,
    declarationValue,
    read,
} from '../../../styles/__tests__/helpers/css-test-utils';
import { THEME_CLASSES } from '../theme/themeDefinitions';

type OverlayContract = {
    file: string;
    selector: string;
};

const OVERLAY_CONTRACTS: OverlayContract[] = [
    {
        file: 'src/modules/ui/channel-badge/styles.css',
        selector: '.channel-badge-content',
    },
    {
        file: 'src/modules/ui/channel-transition/styles.css',
        selector: '.channel-transition-panel',
    },
    {
        file: 'src/modules/ui/channel-number-overlay/styles.css',
        selector: '.channel-number-panel',
    },
];

const THEME_SELECTORS = Object.values(THEME_CLASSES);
const FORCED_COLORS_RULE = '@media (forced-colors: active)';
type ThemeClass = (typeof THEME_CLASSES)[keyof typeof THEME_CLASSES];

const OVERLAY_ALPHA_PROPERTIES = [
    '--runtime-overlay-start-alpha',
    '--runtime-overlay-start-alpha-legacy',
    '--runtime-overlay-end-alpha',
    '--runtime-overlay-end-alpha-legacy',
] as const;

const OVERLAY_TRANSPARENCY_MODES = ['more', 'standard', 'reduced'] as const;
const PLAYER_OVERLAY_ALPHA_PROPERTIES = [
    '--player-overlay-surface-alpha-more',
    '--player-overlay-surface-alpha-more-legacy',
    '--player-overlay-surface-alpha-standard',
    '--player-overlay-surface-alpha-standard-legacy',
    '--player-overlay-surface-alpha-reduced',
    '--player-overlay-surface-alpha-reduced-legacy',
] as const;

const OVERLAY_MODE_PROPERTIES = OVERLAY_TRANSPARENCY_MODES.flatMap((mode) => [
    `--runtime-overlay-start-alpha-${mode}`,
    `--runtime-overlay-start-alpha-${mode}-legacy`,
    `--runtime-overlay-end-alpha-${mode}`,
    `--runtime-overlay-end-alpha-${mode}-legacy`,
]);

const CENTRAL_OVERLAY_PROPERTIES = [
    '--runtime-overlay-tint-rgb',
    '--runtime-overlay-tint-rgb-legacy',
    ...OVERLAY_ALPHA_PROPERTIES,
    ...OVERLAY_MODE_PROPERTIES,
] as const;

const EXPECTED_OVERLAY_THEME = {
    'theme-ember-steel': {
        tint: ['10 9 7', '10, 9, 7'],
        start: { more: ['30%', '0.30'], standard: ['38%', '0.38'], reduced: ['46%', '0.46'] },
        end: { more: ['41%', '0.41'], standard: ['52%', '0.52'], reduced: ['63%', '0.63'] },
    },
    'theme-slate-pine': {
        tint: ['22 24 22', '22, 24, 22'],
        start: { more: ['27%', '0.27'], standard: ['34%', '0.34'], reduced: ['41%', '0.41'] },
        end: { more: ['37%', '0.37'], standard: ['46%', '0.46'], reduced: ['55%', '0.55'] },
    },
    'theme-swiss': {
        tint: ['0 0 0', '0, 0, 0'],
        start: { more: ['27%', '0.27'], standard: ['34%', '0.34'], reduced: ['41%', '0.41'] },
        end: { more: ['37%', '0.37'], standard: ['46%', '0.46'], reduced: ['55%', '0.55'] },
    },
    'theme-directv': {
        tint: ['0 24 48', '0, 24, 48'],
        start: { more: ['33%', '0.33'], standard: ['42%', '0.42'], reduced: ['51%', '0.51'] },
        end: { more: ['45%', '0.45'], standard: ['56%', '0.56'], reduced: ['67%', '0.67'] },
    },
} as const satisfies Record<ThemeClass, {
    tint: readonly [string, string];
    start: Record<typeof OVERLAY_TRANSPARENCY_MODES[number], readonly [string, string]>;
    end: Record<typeof OVERLAY_TRANSPARENCY_MODES[number], readonly [string, string]>;
}>;

const EXPECTED_PLAYER_OVERLAY_ALPHA = {
    more: ['62%', '0.62'],
    standard: ['78%', '0.78'],
    reduced: ['94%', '0.94'],
} as const satisfies Record<typeof OVERLAY_TRANSPARENCY_MODES[number], readonly [string, string]>;

const PLAYER_TRANSPARENCY_ATTRIBUTE = {
    more: 'more-transparent',
    standard: 'standard',
    reduced: 'reduced',
} as const satisfies Record<typeof OVERLAY_TRANSPARENCY_MODES[number], string>;

const declarationValues = (css: string, property: string): string[] => {
    const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [...css.matchAll(new RegExp(
        `^\\s*${escapedProperty}\\s*:\\s*([^;]+);`,
        'gm'
    ))].map((match) => match[1]?.replace(/\s+/g, ' ').trim() ?? '');
};

const cssFilesUnder = (directory: string): string[] =>
    fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return cssFilesUnder(entryPath);
        return entry.isFile() && entry.name.endsWith('.css') ? [entryPath] : [];
    });

describe('runtime overlay style contracts', () => {
    afterEach(() => {
        document.head.replaceChildren();
        document.documentElement.className = '';
        document.documentElement.removeAttribute('data-player-overlay-transparency');
    });

    it.each(OVERLAY_CONTRACTS)(
        'keeps %s on theme-aware compact overlay scrims',
        ({ file }) => {
            const css = read(file);

            expect(css).toContain(
                'rgba(var(--runtime-overlay-tint-rgb-legacy), var(--runtime-overlay-start-alpha-legacy)) 0%'
            );
            expect(css).toContain(
                'rgba(var(--runtime-overlay-tint-rgb-legacy), var(--runtime-overlay-end-alpha-legacy)) 100%'
            );
            expect(css).toContain(
                'rgb(var(--runtime-overlay-tint-rgb) / var(--runtime-overlay-start-alpha)) 0%'
            );
            expect(css).toContain(
                'rgb(var(--runtime-overlay-tint-rgb) / var(--runtime-overlay-end-alpha)) 100%'
            );
            expect(css).not.toContain('rgba(0, 0, 0, 0.30)');
            expect(css).not.toContain('rgba(0, 0, 0, 0.40)');
        }
    );

    it('keeps centralized runtime overlay declarations out of every UI package stylesheet', () => {
        const uiRoot = path.join(process.cwd(), 'src/modules/ui');

        for (const file of cssFilesUnder(uiRoot)) {
            const css = fs.readFileSync(file, 'utf8');
            for (const property of CENTRAL_OVERLAY_PROPERTIES) {
                expect({
                    file: path.relative(process.cwd(), file),
                    property,
                    declarations: declarationValues(css, property),
                }).toEqual({
                    file: path.relative(process.cwd(), file),
                    property,
                    declarations: [],
                });
            }
        }
    });

    it('owns runtime overlay tint and theme alpha tokens once in the global theme surface', () => {
        const css = read('src/styles/themes.css');

        const rootBlock = blockFor(css, ':root');
        expect(declarationValues(rootBlock, '--runtime-overlay-tint-rgb')).toEqual(['10 9 7']);
        expect(declarationValues(rootBlock, '--runtime-overlay-tint-rgb-legacy')).toEqual(['10, 9, 7']);
        expect(OVERLAY_ALPHA_PROPERTIES.map((property) => declarationValues(rootBlock, property)))
            .toEqual([['30%'], ['0.30'], ['40%'], ['0.40']]);
        const tokensCss = read('src/styles/tokens.css');
        const tokensRoot = blockFor(tokensCss, ':root');
        expect(PLAYER_OVERLAY_ALPHA_PROPERTIES.map((property) => declarationValues(tokensRoot, property)))
            .toEqual([['62%'], ['0.62'], ['78%'], ['0.78'], ['94%'], ['0.94']]);

        expect(OVERLAY_TRANSPARENCY_MODES.map((mode) => [
            declarationValues(rootBlock, `--runtime-overlay-start-alpha-${mode}`)[0],
            declarationValues(rootBlock, `--runtime-overlay-start-alpha-${mode}-legacy`)[0],
            declarationValues(rootBlock, `--runtime-overlay-end-alpha-${mode}`)[0],
            declarationValues(rootBlock, `--runtime-overlay-end-alpha-${mode}-legacy`)[0],
        ])).toEqual([
            ['24%', '0.24', '32%', '0.32'],
            ['30%', '0.30', '40%', '0.40'],
            ['36%', '0.36', '48%', '0.48'],
        ]);

        for (const themeSelector of THEME_SELECTORS) {
            const themeBlock = blockFor(css, `.${themeSelector}`);
            const expected = EXPECTED_OVERLAY_THEME[themeSelector];
            expect(declarationValues(themeBlock, '--runtime-overlay-tint-rgb')).toEqual([expected.tint[0]]);
            expect(declarationValues(themeBlock, '--runtime-overlay-tint-rgb-legacy')).toEqual([expected.tint[1]]);
            expect(OVERLAY_ALPHA_PROPERTIES.map((property) => declarationValues(themeBlock, property)))
                .toEqual([
                    [expected.start.standard[0]],
                    [expected.start.standard[1]],
                    [expected.end.standard[0]],
                    [expected.end.standard[1]],
                ]);
            for (const property of PLAYER_OVERLAY_ALPHA_PROPERTIES) {
                expect(declarationValues(themeBlock, property)).toEqual([]);
            }

            for (const mode of OVERLAY_TRANSPARENCY_MODES) {
                expect(declarationValues(themeBlock, `--runtime-overlay-start-alpha-${mode}`))
                    .toEqual([expected.start[mode][0]]);
                expect(declarationValues(themeBlock, `--runtime-overlay-start-alpha-${mode}-legacy`))
                    .toEqual([expected.start[mode][1]]);
                expect(declarationValues(themeBlock, `--runtime-overlay-end-alpha-${mode}`))
                    .toEqual([expected.end[mode][0]]);
                expect(declarationValues(themeBlock, `--runtime-overlay-end-alpha-${mode}-legacy`))
                    .toEqual([expected.end[mode][1]]);
            }
        }

        for (const property of OVERLAY_ALPHA_PROPERTIES) {
            expect(declarationValues(css, property)).toHaveLength(THEME_SELECTORS.length + 1 + 3);
        }
        for (const property of OVERLAY_MODE_PROPERTIES) {
            expect(declarationValues(css, property)).toHaveLength(THEME_SELECTORS.length + 1);
        }
        for (const property of PLAYER_OVERLAY_ALPHA_PROPERTIES) {
            expect(declarationValues(tokensCss, property)).toHaveLength(1);
            expect(declarationValues(css, property)).toHaveLength(0);
        }
        expect(declarationValues(css, '--runtime-overlay-tint-rgb')).toHaveLength(THEME_SELECTORS.length + 1);
        expect(declarationValues(css, '--runtime-overlay-tint-rgb-legacy')).toHaveLength(THEME_SELECTORS.length + 1);
    });

    it('computes Player transparency modes on the same element as its theme class', () => {
        const tokensCss = read('src/styles/tokens.css');
        const themesCss = read('src/styles/themes.css');
        const indexSource = read('src/index.ts');
        expect(indexSource.indexOf("import './styles/tokens.css';"))
            .toBeLessThan(indexSource.indexOf("import './styles/themes.css';"));

        const styleElements = [tokensCss, themesCss].map((css) => {
            const style = document.createElement('style');
            style.textContent = css;
            return style;
        });
        document.head.replaceChildren(...styleElements);

        for (const themeSelector of THEME_SELECTORS) {
            const expectedTheme = EXPECTED_OVERLAY_THEME[themeSelector];
            const root = document.documentElement;
            root.className = themeSelector;

            for (const mode of OVERLAY_TRANSPARENCY_MODES) {
                root.setAttribute('data-player-overlay-transparency', PLAYER_TRANSPARENCY_ATTRIBUTE[mode]);
                const computed = window.getComputedStyle(root);
                const customProperty = (name: string): string => computed.getPropertyValue(name).trim();

                expect(customProperty('--player-overlay-surface-alpha'))
                    .toBe(`var(--player-overlay-surface-alpha-${mode})`);
                expect(customProperty('--player-overlay-surface-alpha-legacy'))
                    .toBe(`var(--player-overlay-surface-alpha-${mode}-legacy)`);
                expect(customProperty(`--player-overlay-surface-alpha-${mode}`))
                    .toBe(EXPECTED_PLAYER_OVERLAY_ALPHA[mode][0]);
                expect(customProperty(`--player-overlay-surface-alpha-${mode}-legacy`))
                    .toBe(EXPECTED_PLAYER_OVERLAY_ALPHA[mode][1]);
                expect(customProperty('--runtime-overlay-start-alpha'))
                    .toBe(`var(--runtime-overlay-start-alpha-${mode})`);
                expect(customProperty('--runtime-overlay-start-alpha-legacy'))
                    .toBe(`var(--runtime-overlay-start-alpha-${mode}-legacy)`);
                expect(customProperty('--runtime-overlay-end-alpha'))
                    .toBe(`var(--runtime-overlay-end-alpha-${mode})`);
                expect(customProperty('--runtime-overlay-end-alpha-legacy'))
                    .toBe(`var(--runtime-overlay-end-alpha-${mode}-legacy)`);
                expect(customProperty(`--runtime-overlay-start-alpha-${mode}-legacy`))
                    .toBe(expectedTheme.start[mode][1]);
                expect(customProperty(`--runtime-overlay-end-alpha-${mode}-legacy`))
                    .toBe(expectedTheme.end[mode][1]);
            }
        }
    });

    it.each(OVERLAY_CONTRACTS)(
        'keeps %s scoped to a package-local forced-colors fallback',
        ({ file, selector }) => {
            const css = read(file);
            const forcedColorsBlock = blockWithin(css, FORCED_COLORS_RULE, selector);

            expect(css).toContain(FORCED_COLORS_RULE);
            expect(forcedColorsBlock).toContain(selector);
            expect(forcedColorsBlock).toContain('background: Canvas;');
            expect(forcedColorsBlock).toContain('CanvasText');
        }
    );

    it('keeps track drawer forced-colors focus within the Player surface', () => {
        const css = read('src/modules/ui/player-osd/styles.surface.css');
        const option = blockWithin(css, FORCED_COLORS_RULE, '.player-osd-track-option.focused');
        expect(option).toContain('background: Highlight;');
        expect(option).toContain('color: HighlightText;');
        expect(option).toContain('outline: 2px solid Highlight;');
    });

    it('covers the viewport with physical Player edges on the webOS 6 CSS floor', () => {
        const css = read('src/modules/ui/player-osd/styles.surface.css');
        const root = blockFor(css, '.player-osd');
        const scrim = blockFor(css, ".player-osd[data-presentation='audio'] .player-osd-panel::before");
        for (const edge of ['top', 'right', 'bottom', 'left']) {
            expect(declarationValue(root, edge)).toBe('0');
            expect(declarationValue(scrim, edge)).toBe('0');
        }
    });

    it('keeps Settings category weight on its shared token', () => {
        const settingsCss = read('src/modules/ui/settings/styles.core.css');
        expect(declarationValue(blockFor(settingsCss, '.settings-category-button'), 'font-weight'))
            .toBe('var(--font-weight-semibold)');
    });

    it('keeps mini guide forced-colors coverage scoped to focused-row readability', () => {
        const css = read('src/modules/ui/mini-guide/styles.core.css');
        const focusedRowBlock = blockWithin(css, FORCED_COLORS_RULE, '.mini-guide-row.focused');
        const channelNumBlock = blockWithin(
            css,
            FORCED_COLORS_RULE,
            '.mini-guide-row.focused .mini-guide-channel-num'
        );
        const footerHintBlock = blockWithin(css, FORCED_COLORS_RULE, '.mini-guide-footer-hint');
        const progressFillBlock = blockWithin(css, FORCED_COLORS_RULE, '.mini-guide-progress-fill');
        const focusedProgressFillBlock = blockWithin(
            css,
            FORCED_COLORS_RULE,
            '.mini-guide-row.focused .mini-guide-progress-fill'
        );

        expect(css).toContain(FORCED_COLORS_RULE);
        expect(focusedRowBlock).toContain('.mini-guide-row.focused');
        expect(focusedRowBlock).toContain('background: Highlight;');
        expect(focusedRowBlock).toContain('outline: 2px solid Highlight;');
        expect(channelNumBlock).toContain('.mini-guide-row.focused .mini-guide-channel-num');
        expect(channelNumBlock).toContain('color: HighlightText;');
        expect(footerHintBlock).toContain('.mini-guide-footer-hint');
        expect(footerHintBlock).toContain('color: CanvasText;');
        expect(progressFillBlock).toContain('.mini-guide-progress-fill');
        expect(progressFillBlock).toContain('background: Highlight;');
        expect(focusedProgressFillBlock).toContain('.mini-guide-row.focused .mini-guide-progress-fill');
        expect(focusedProgressFillBlock).toContain('background: Canvas;');
    });
});
