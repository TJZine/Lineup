/**
 * @jest-environment node
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

const CENTRAL_OVERLAY_PROPERTIES = [
    '--runtime-overlay-tint-rgb',
    '--runtime-overlay-tint-rgb-legacy',
    ...OVERLAY_ALPHA_PROPERTIES,
] as const;

const EXPECTED_OVERLAY_ALPHA = {
    'theme-slate-pine': ['34%', '0.34', '46%', '0.46'],
    'theme-swiss': ['34%', '0.34', '46%', '0.46'],
    'theme-directv': ['42%', '0.42', '56%', '0.56'],
    'theme-glass': ['38%', '0.38', '52%', '0.52'],
    'theme-ember-steel': ['38%', '0.38', '52%', '0.52'],
} as const satisfies Record<ThemeClass, readonly [string, string, string, string]>;

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
        expect(declarationValues(rootBlock, '--runtime-overlay-tint-rgb'))
            .toEqual(['var(--scrim-tint-rgb, 6 8 10)']);
        expect(declarationValues(rootBlock, '--runtime-overlay-tint-rgb-legacy'))
            .toEqual(['var(--scrim-tint-rgb-legacy, 6, 8, 10)']);
        expect(OVERLAY_ALPHA_PROPERTIES.map((property) => declarationValues(rootBlock, property)))
            .toEqual([['30%'], ['0.30'], ['40%'], ['0.40']]);

        for (const themeSelector of THEME_SELECTORS) {
            const themeBlock = blockFor(css, `.${themeSelector}`);
            const expected = EXPECTED_OVERLAY_ALPHA[themeSelector];
            OVERLAY_ALPHA_PROPERTIES.forEach((property, index) => {
                expect(declarationValues(themeBlock, property)).toEqual([expected[index]]);
            });
        }

        for (const property of OVERLAY_ALPHA_PROPERTIES) {
            expect(declarationValues(css, property)).toHaveLength(THEME_SELECTORS.length + 1);
        }
        expect(declarationValues(css, '--runtime-overlay-tint-rgb')).toHaveLength(1);
        expect(declarationValues(css, '--runtime-overlay-tint-rgb-legacy')).toHaveLength(1);
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

    it('keeps playback options theme tuning local to the panel surface', () => {
        const coreCss = read('src/modules/ui/playback-options/styles.core.css');
        const themeCss = read('src/modules/ui/playback-options/styles.theme.css');

        expect(coreCss).toContain('--playback-rail-tint-rgb: var(--scrim-tint-rgb, 8 11 18);');
        expect(coreCss).toContain('--playback-rail-tint-rgb-legacy: var(--scrim-tint-rgb-legacy, 8, 11, 18);');
        expect(coreCss).toContain('--playback-rail-start-alpha-legacy: 0.44;');
        expect(coreCss).toContain('--playback-rail-end-alpha-legacy: 0.62;');
        expect(coreCss).toContain(
            'rgba(var(--playback-rail-tint-rgb-legacy), var(--playback-rail-start-alpha-legacy)) 0%'
        );
        expect(coreCss).toContain(
            'rgba(var(--playback-rail-tint-rgb-legacy), var(--playback-rail-end-alpha-legacy)) 100%'
        );
        expect(coreCss).toContain(
            'rgb(var(--playback-rail-tint-rgb) / var(--playback-rail-start-alpha)) 0%'
        );
        expect(coreCss).toContain(
            'rgb(var(--playback-rail-tint-rgb) / var(--playback-rail-end-alpha)) 100%'
        );

        for (const themeSelector of THEME_SELECTORS) {
            expect(themeCss).toContain(`.${themeSelector} .playback-options-panel`);
        }
    });

    it('keeps playback options forced-colors coverage scoped to focused and selected items', () => {
        const css = read('src/modules/ui/playback-options/styles.core.css');
        const panelBlock = blockWithin(css, FORCED_COLORS_RULE, '.playback-options-panel');
        const selectedBlock = blockWithin(css, FORCED_COLORS_RULE, '.playback-options-item.selected');
        const selectedLabelBlock = blockWithin(
            css,
            FORCED_COLORS_RULE,
            '.playback-options-item.selected .playback-options-item-label'
        );
        const focusedBlock = blockWithin(css, FORCED_COLORS_RULE, '.playback-options-item.focused');
        const focusVisibleBlock = blockWithin(css, FORCED_COLORS_RULE, '.playback-options-item:focus-visible');
        const selectedFocusVisibleBlock = blockWithin(
            css,
            FORCED_COLORS_RULE,
            '.playback-options-item.selected:focus-visible'
        );

        expect(css).toContain(FORCED_COLORS_RULE);
        expect(panelBlock).toContain('background: Canvas;');
        expect(panelBlock).toContain('color: CanvasText;');
        expect(selectedBlock).toContain('.playback-options-item.selected');
        expect(selectedBlock).toContain('background: Highlight;');
        expect(selectedBlock).toContain('border-color: Highlight;');
        expect(selectedLabelBlock).toContain('color: HighlightText;');
        expect(focusedBlock).toContain('border-color: Highlight;');
        expect(focusVisibleBlock).toContain('outline: 2px solid Highlight;');
        expect(selectedFocusVisibleBlock).toContain('outline-color: HighlightText;');
    });

    it('keeps exit confirm theme tuning local to the overlay surface', () => {
        const css = read('src/modules/ui/exit-confirm/styles.css');

        expect(css).toContain('--exit-confirm-overlay-mid-alpha: 34%;');
        expect(css).toContain('--exit-confirm-panel-mid-alpha: 78%;');
        expect(css).toContain(
            'rgb(var(--scrim-tint-rgb) / var(--exit-confirm-overlay-bottom-alpha)) 100%'
        );
        expect(css).toContain(
            'rgb(var(--scrim-tint-rgb) / var(--exit-confirm-panel-bottom-alpha)) 100%'
        );

        for (const themeSelector of THEME_SELECTORS) {
            expect(css).toContain(`.${themeSelector} .exit-confirm-panel`);
        }
    });

    it('keeps the settings and playback polish cleanup scoped to the approved CSS contracts', () => {
        const settingsCss = read('src/modules/ui/settings/styles.core.css');
        const playbackCss = read('src/modules/ui/playback-options/styles.core.css');
        const exitConfirmCss = read('src/modules/ui/exit-confirm/styles.css');

        expect(declarationValue(blockFor(settingsCss, '.settings-category-button'), 'font-weight')).toBe(
            'var(--font-weight-semibold)'
        );
        expect(settingsCss).not.toContain('font-weight: 560;');

        expect(declarationValue(blockFor(exitConfirmCss, '.exit-confirm-panel'), 'border-radius')).toBe(
            'var(--radius-xl) var(--radius-xl) 0 0'
        );
        expect(exitConfirmCss).not.toContain('border-radius: 18px 18px 0 0;');

        const delayedItemsMatch = playbackCss.match(
            /\.playback-options-item:nth-child\(n\s*\+\s*6\)\s*\{([^}]*)\}/
        );

        expect(delayedItemsMatch?.[0]).toBeDefined();
        expect(delayedItemsMatch?.[1]).toMatch(/animation-delay:\s*180ms;/);
        expect(delayedItemsMatch?.[1]).not.toMatch(/animation-delay:\s*(210|240|270|300|330|360)ms;/);
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
