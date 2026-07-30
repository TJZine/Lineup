/** @jest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';

import {
    blockFor,
    blockWithin,
    normalizeLineEndings,
    read,
    readComposedCss,
    topLevelBlockForProperty,
} from '../../../../styles/__tests__/helpers/css-test-utils';

describe('focused EPG overflow style contract', () => {
    const cssPath = path.resolve(__dirname, '..', 'styles.css');
    const rawCss = normalizeLineEndings(fs.readFileSync(cssPath, 'utf8'));
    const css = readComposedCss('src/modules/ui/epg/styles.css');
    const cellsCss = read('src/modules/ui/epg/styles.cells.css');
    const gridCss = read('src/modules/ui/epg/styles.grid.css');
    const motionCss = read('src/modules/ui/epg/styles.motion.css');

    it('keeps the stylesheet seam pure and ordered', () => {
        const imports = [
            'styles.shell.css',
            'styles.grid.css',
            'styles.cells.css',
            'styles.info-panel.css',
            'styles.classic.css',
            'styles.theme.css',
            'styles.motion.css',
        ].map((file) => `@import url('./${file}');`);

        expect(
            rawCss.match(/^\s*@import[^;]+;\s*$/gm)?.map((cssImport) => cssImport.trim())
        ).toEqual(imports);
        expect(rawCss.replace(/^\s*@import[^;]+;\s*$/gm, '').trim()).toBe('');
    });

    it.each([
        {
            name: 'compact focus',
            selector: '.epg-cell.focused.epg-cell-focused-compact',
            declarations: ['grid-template-columns: 1fr'],
            railSelector: '.epg-cell.focused.epg-cell-focused-compact .epg-cell-rail',
            railDeclarations: ['position: absolute', 'top: 8px', 'right: 10px', 'pointer-events: none'],
        },
        {
            name: 'tiny movie overlay focus',
            selector: '.epg-cell.focused.epg-cell-focused-movie-overlay.epg-cell-tier-tiny',
            declarations: ['grid-template-columns: 1fr'],
            railSelector: '.epg-cell.focused.epg-cell-focused-movie-overlay .epg-cell-rail',
            railDeclarations: ['position: absolute', 'top: 8px', 'right: 10px', 'pointer-events: none'],
        },
    ])('keeps $name overflow content and rails separate', ({
        selector,
        declarations,
        railSelector,
        railDeclarations,
    }) => {
        const cellBlock = blockFor(css, selector);
        const railBlock = blockFor(css, railSelector);

        declarations.forEach((declaration) => expect(cellBlock).toContain(declaration));
        railDeclarations.forEach((declaration) => expect(railBlock).toContain(declaration));
    });

    it('keeps compact focus time hidden and tiny ticker titles unclamped', () => {
        expect(
            blockFor(css, '.epg-cell.focused.epg-cell-focused-compact .epg-cell-time')
        ).toContain('display: none');

        const ticker = blockFor(
            css,
            '.epg-cell-tier-tiny.focused .epg-cell-title.epg-cell-title-ticker-ready'
        );
        expect(ticker).toContain('display: block');
        expect(ticker).toContain('white-space: nowrap');
        expect(ticker).toContain('text-overflow: clip');
        expect(ticker).toContain('-webkit-line-clamp: unset');
    });

    it('keeps sliver cells on the one-line presentation path', () => {
        const cell = blockFor(css, '.epg-cell.epg-cell-sliver');
        const title = blockFor(css, '.epg-cell.epg-cell-sliver .epg-cell-title');
        const hidden = blockFor(css, '.epg-cell.epg-cell-sliver .epg-cell-time');

        expect(cell).toContain('gap: 0');
        expect(title).toContain('white-space: nowrap');
        expect(title).toContain('text-overflow: ellipsis');
        expect(title).not.toContain('-webkit-line-clamp');
        expect(hidden).toContain('display: none');
    });

    it.each([
        '.epg-channel-name-provenance[hidden]',
        '.epg-channel-name-source[hidden]',
        '.epg-channel-name-category[hidden]',
        '.epg-channel-name-separator[hidden]',
    ])('keeps the explicit %s CSS guard out of layout', (selector) => {
        expect(blockFor(gridCss, selector)).toContain('display: none');
    });

    it.each([
        '.epg-cell.focused.epg-cell-focused-compact .epg-cell-rail',
        '.epg-cell.focused.epg-cell-focused-movie-overlay .epg-cell-rail',
    ])('keeps %s anchored after text-shift rules', (selector) => {
        expect(topLevelBlockForProperty(cellsCss, selector, 'transform')).toContain(
            'transform: none'
        );
    });

    it.each(['narrow', 'tiny'])(
        'keeps later generic %s focus rules from overriding overlay layouts',
        (tier) => {
        const genericCell =
            `.epg-cell.focused:not(.epg-cell-focused-compact):not(.epg-cell-focused-movie-overlay).epg-cell-tier-${tier}`;
        const genericRail = `${genericCell} .epg-cell-rail`;

        expect(blockFor(cellsCss, genericCell)).toContain('grid-template-columns: 1fr auto');
        expect(blockFor(cellsCss, genericRail)).toContain('position: static');
        expect(blockFor(cellsCss, genericRail)).toContain('pointer-events: auto');
        }
    );

    it.each([
        ['base', '.epg-channel-row.focused', 'rgba(var(--focus-color-rgb), 0.12)'],
        [
            'classic',
            '.epg-container.layout-classic .epg-channel-row.focused',
            'rgba(var(--focus-color-rgb), 0.18)',
        ],
        [
            'glass classic',
            '.theme-glass .epg-container.layout-classic .epg-channel-row.focused',
            'background: transparent',
        ],
        [
            'swiss classic',
            '.theme-swiss .epg-container.layout-classic .epg-channel-row.focused',
            'rgba(var(--focus-color-rgb), 0.12)',
        ],
        [
            'DirectV classic',
            '.theme-directv .epg-container.layout-classic .epg-channel-row.focused',
            'var(--directv-focus-fill)',
        ],
    ])('keeps the %s channel-focus cascade', (_name, selector, declaration) => {
        expect(blockFor(css, selector)).toContain(declaration);
    });

    it('keeps reduced-motion suppression for title and subtitle tickers', () => {
        const titleTicker = blockWithin(
            motionCss,
            '@media (prefers-reduced-motion: reduce)',
            '.epg-cell-title.epg-cell-title-ticker-ready .epg-cell-title-text'
        );
        const subtitleTicker = blockWithin(
            motionCss,
            '@media (prefers-reduced-motion: reduce)',
            '.epg-cell-subtitle.epg-cell-subtitle-ticker-running .epg-cell-subtitle-text'
        );

        expect(titleTicker).toContain('animation: none');
        expect(titleTicker).toContain('transform: none');
        expect(subtitleTicker).toContain('animation: none');
        expect(subtitleTicker).toContain('transform: none');
    });

    it('keeps forced-colors focus, progress, and library selection visible', () => {
        const cellFocus = blockWithin(
            cellsCss,
            '@media (forced-colors: active)',
            '.epg-cell.focused'
        );
        const progress = blockWithin(
            cellsCss,
            '@media (forced-colors: active)',
            '.epg-cell-progress-fill'
        );
        const pickerFocus = blockWithin(
            gridCss,
            '@media (forced-colors: active)',
            '.epg-library-picker-item.focused'
        );
        const pillFocus = blockWithin(
            gridCss,
            '@media (forced-colors: active)',
            '.epg-library-pill.focused'
        );
        const pickerSelection = blockWithin(
            gridCss,
            '@media (forced-colors: active)',
            '.epg-library-picker-item.selected:not(.focused)'
        );

        expect(cellFocus).toContain('outline: 3px solid CanvasText');
        expect(progress).toContain('background: Highlight');
        expect(pillFocus).toContain('outline: 2px solid Highlight');
        expect(pickerFocus).toContain('background: Highlight');
        expect(pickerFocus).toContain('color: HighlightText');
        expect(pickerFocus).toContain('outline: 2px solid Highlight');
        expect(pickerSelection).toContain('text-decoration: underline');
    });
});
