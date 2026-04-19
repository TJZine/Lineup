/**
 * @jest-environment node
 */

import { read } from '../../../styles/__tests__/helpers/css-test-utils';
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

describe('runtime overlay style contracts', () => {
    it.each(OVERLAY_CONTRACTS)(
        'keeps %s on theme-aware compact overlay scrims',
        ({ file, selector }) => {
            const css = read(file);

            expect(css).toContain('--runtime-overlay-tint-rgb: var(--scrim-tint-rgb, 6 8 10);');
            expect(css).toContain('--runtime-overlay-tint-rgb-legacy: var(--scrim-tint-rgb-legacy, 6, 8, 10);');
            expect(css).toContain('--runtime-overlay-start-alpha-legacy: 0.30;');
            expect(css).toContain('--runtime-overlay-end-alpha-legacy: 0.40;');
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

            for (const themeSelector of THEME_SELECTORS) {
                expect(css).toContain(`.${themeSelector} ${selector}`);
            }
        }
    );

    it.each(OVERLAY_CONTRACTS)(
        'keeps %s scoped to a package-local forced-colors fallback',
        ({ file, selector }) => {
            const css = read(file);

            expect(css).toContain(FORCED_COLORS_RULE);
            expect(css).toContain(selector);
            expect(css).toContain('background: Canvas;');
            expect(css).toContain('CanvasText');
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

        expect(css).toContain(FORCED_COLORS_RULE);
        expect(css).toContain('.playback-options-item.selected');
        expect(css).toContain('.playback-options-item.focused');
        expect(css).toContain('.playback-options-item:focus-visible');
        expect(css).toContain('background: Canvas;');
        expect(css).toContain('border-color: CanvasText;');
        expect(css).toContain('background: Highlight;');
        expect(css).toContain('color: HighlightText;');
        expect(css).toContain('outline: 2px solid Highlight;');
        expect(css).toContain('outline-color: HighlightText;');
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

    it('keeps mini guide forced-colors coverage scoped to focused-row readability', () => {
        const css = read('src/modules/ui/mini-guide/styles.core.css');

        expect(css).toContain(FORCED_COLORS_RULE);
        expect(css).toContain('.mini-guide-row.focused');
        expect(css).toContain('background: Highlight;');
        expect(css).toContain('outline: 2px solid Highlight;');
        expect(css).toContain('.mini-guide-row.focused .mini-guide-channel-num');
        expect(css).toContain('color: HighlightText;');
        expect(css).toContain('.mini-guide-footer-hint');
        expect(css).toContain('.mini-guide-progress-fill');
        expect(css).toContain('background: Canvas;');
    });
});
