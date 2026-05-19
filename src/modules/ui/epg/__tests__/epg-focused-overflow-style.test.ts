/** @jest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';

import { normalizeLineEndings, readComposedCss } from '../../../../styles/__tests__/helpers/css-test-utils';

describe('focused EPG overflow style contract', () => {
    const cssPath = path.resolve(__dirname, '..', 'styles.css');
    const rawCss = normalizeLineEndings(fs.readFileSync(cssPath, 'utf8'));
    let css = '';
    let injectedStyle: HTMLStyleElement | null = null;
    const getBlockFromIndex = (start: number): string => {
        const open = css.indexOf('{', start);
        expect(open).toBeGreaterThanOrEqual(0);

        let depth = 1;
        let cursor = open + 1;
        while (cursor < css.length && depth > 0) {
            const char = css[cursor];
            if (char === '{') depth += 1;
            if (char === '}') depth -= 1;
            cursor += 1;
        }
        expect(depth).toBe(0);
        return css.slice(open + 1, cursor - 1);
    };
    const getBlock = (selectorOrAtRule: string): string => {
        const start = css.indexOf(selectorOrAtRule);
        expect(start).toBeGreaterThanOrEqual(0);
        return getBlockFromIndex(start);
    };
    const getExactRuleBlock = (selector: string): string => {
        let cursor = 0;
        while (cursor < css.length) {
            const start = css.indexOf(selector, cursor);
            if (start < 0) break;

            const open = css.indexOf('{', start);
            expect(open).toBeGreaterThanOrEqual(0);
            const previousClose = css.lastIndexOf('}', start);
            const prefix = css.slice(previousClose + 1, start).trim();
            const suffix = css.slice(start + selector.length, open).trim();
            if (prefix === '' && suffix === '') {
                return getBlockFromIndex(start);
            }
            cursor = start + selector.length;
        }

        throw new Error(`Expected standalone CSS rule for ${selector}`);
    };
    const getAtRuleBlocks = (atRule: string): string[] => {
        const blocks: string[] = [];
        let cursor = 0;
        while (cursor < css.length) {
            const start = css.indexOf(atRule, cursor);
            if (start < 0) break;
            blocks.push(getBlockFromIndex(start));
            cursor = start + atRule.length;
        }
        return blocks;
    };

    beforeAll(() => {
        const shellImport = "@import url('./styles.shell.css');";
        const gridImport = "@import url('./styles.grid.css');";
        const cellsImport = "@import url('./styles.cells.css');";
        const infoPanelImport = "@import url('./styles.info-panel.css');";
        const classicImport = "@import url('./styles.classic.css');";
        const themeImport = "@import url('./styles.theme.css');";
        const motionImport = "@import url('./styles.motion.css');";
        const importOrder = [
            shellImport,
            gridImport,
            cellsImport,
            infoPanelImport,
            classicImport,
            themeImport,
            motionImport,
        ];

        for (const cssImport of importOrder) {
            expect(rawCss).toContain(cssImport);
        }

        for (let index = 0; index < importOrder.length - 1; index += 1) {
            const currentImport = importOrder[index]!;
            const nextImport = importOrder[index + 1]!;
            expect(rawCss.indexOf(currentImport)).toBeLessThan(rawCss.indexOf(nextImport));
        }

        const seamResidual = rawCss.replace(/^\s*@import[^;]+;\s*$/gm, '').trim();
        expect(seamResidual).toBe('');

        css = readComposedCss('src/modules/ui/epg/styles.css');
        injectedStyle = document.createElement('style');
        injectedStyle.textContent = css;
        document.head.appendChild(injectedStyle);
    });

    afterAll(() => {
        injectedStyle?.remove();
        injectedStyle = null;
    });

    afterEach(() => {
        document.body.innerHTML = '';
        document.body.className = '';
    });

    it('keeps tiny focused ticker titles unclamped', () => {
        const block = getBlock(
            '.epg-cell-tier-tiny.focused .epg-cell-title.epg-cell-title-ticker-ready,\n' +
            '.epg-cell-tier-tiny.focused .epg-cell-title.epg-cell-title-ticker-running'
        );
        expect(block).toContain('display: block');
        expect(block).toContain('white-space: nowrap');
        expect(block).toContain('text-overflow: clip');
        expect(block).toContain('-webkit-line-clamp: unset');
        expect(block).toContain('-webkit-box-orient: initial');
    });

    it('keeps focused compact selector contract for hiding in-cell time', () => {
        const block = getBlock('.epg-cell.focused.epg-cell-focused-compact .epg-cell-time');
        expect(block).toContain('display: none');
    });

    it('keeps hidden generated-channel provenance spans out of layout', () => {
        const container = document.createElement('div');
        container.className = 'epg-container';
        const provenance = document.createElement('span');
        provenance.className = 'epg-channel-name-provenance';
        provenance.hidden = true;
        const source = document.createElement('span');
        source.className = 'epg-channel-name-source';
        source.hidden = true;
        const category = document.createElement('span');
        category.className = 'epg-channel-name-category';
        category.hidden = true;
        const separator = document.createElement('span');
        separator.className = 'epg-channel-name-separator';
        separator.hidden = true;

        provenance.append(category, separator, source);
        container.appendChild(provenance);
        document.body.appendChild(container);

        for (const element of [provenance, source, category, separator]) {
            expect(getComputedStyle(element).display).toBe('none');
        }
    });

    it('keeps the base time lane bottom-anchored via auto margin', () => {
        const block = getBlock('\n.epg-cell-time {');
        expect(block).toContain('margin-top: auto');
    });

    it('keeps focused compact selector contract for overlay rail semantics', () => {
        const layoutBlock = getBlock('.epg-cell.focused.epg-cell-focused-compact');
        expect(layoutBlock).toContain('grid-template-columns: 1fr');

        const railBlock = getBlock(
            '.epg-cell.focused.epg-cell-focused-compact .epg-cell-rail'
        );
        expect(railBlock).toContain('position: absolute');
        expect(railBlock).toContain('top: 8px');
        expect(railBlock).toContain('right: 10px');
    });

    it('keeps focused movie overlay selector contract for non-compact narrow/tiny cells', () => {
        const layoutBlock = getBlock(
            '.epg-cell.focused.epg-cell-focused-movie-overlay.epg-cell-tier-narrow,\n' +
            '.epg-cell.focused.epg-cell-focused-movie-overlay.epg-cell-tier-tiny'
        );
        expect(layoutBlock).toContain('grid-template-columns: 1fr');

        const railBlock = getBlock(
            '.epg-cell.focused.epg-cell-focused-movie-overlay .epg-cell-rail'
        );
        expect(railBlock).toContain('position: absolute');
        expect(railBlock).toContain('top: 8px');
        expect(railBlock).toContain('right: 10px');
    });

    it('keeps sliver cells in a compact one-line presentation contract', () => {
        const block = getBlock('.epg-cell.epg-cell-sliver');
        expect(block).toContain('padding: var(--space-1) var(--space-local-6)');
        expect(block).toContain('gap: 0');

        const hiddenBlock = getBlock(
            '.epg-cell.epg-cell-sliver .epg-cell-time,\n' +
            '.epg-cell.epg-cell-sliver .epg-cell-subtitle,\n' +
            '.epg-cell.epg-cell-sliver .epg-cell-meta'
        );
        expect(hiddenBlock).toContain('display: none');

        const titleBlock = getBlock('.epg-cell.epg-cell-sliver .epg-cell-title');
        expect(titleBlock).toContain('display: block');
        expect(titleBlock).toContain('overflow: hidden');
        expect(titleBlock).toContain('font-size: var(--text-sm)');
        expect(titleBlock).toContain('white-space: nowrap');
        expect(titleBlock).toContain('text-overflow: ellipsis');
        expect(titleBlock).not.toContain('-webkit-line-clamp');
        expect(titleBlock).not.toContain('-webkit-box-orient');
    });

    it('keeps the channel name rail as a stack with child-owned truncation', () => {
        const stackBlock = getBlock('\n.epg-channel-name {');
        expect(stackBlock).toContain('display: flex');
        expect(stackBlock).toContain('flex-direction: column');
        expect(stackBlock).toContain('overflow: hidden');
        expect(stackBlock).not.toContain('-webkit-line-clamp');
        expect(stackBlock).not.toContain('-webkit-box-orient');

        const childBlock = getBlock(
            '.epg-channel-name-primary,\n' +
            '.epg-channel-name-source,\n' +
            '.epg-channel-name-category,\n' +
            '.epg-channel-name-separator'
        );
        expect(childBlock).toContain('display: block');
        expect(childBlock).toContain('white-space: nowrap');
        expect(childBlock).toContain('overflow: hidden');
        expect(childBlock).toContain('text-overflow: ellipsis');

        const provenanceBlock = getExactRuleBlock('.epg-channel-name-provenance');
        expect(provenanceBlock).toContain('display: flex');
        expect(provenanceBlock).toContain('align-items: baseline');
        expect(provenanceBlock).toContain('font-size: var(--text-xs)');
        expect(provenanceBlock).toContain('color: var(--color-text-muted)');

        const sourceBlock = getExactRuleBlock('.epg-channel-name-source');
        expect(sourceBlock).toContain('flex: 1 1 auto');

        const categoryBlock = getExactRuleBlock('.epg-channel-name-category');
        expect(categoryBlock).toContain('flex: 0 0 auto');
        expect(categoryBlock).toContain('color: var(--color-text-muted)');

        const separatorBlock = getExactRuleBlock('.epg-channel-name-separator');
        expect(separatorBlock).toContain('flex: 0 0 auto');
        expect(separatorBlock).toContain('color: var(--color-text-muted)');
    });

    it('keeps classic and DirectV channel-name cascade pointed at the child spans', () => {
        const classicStackBlock = getBlock('.epg-container.layout-classic .epg-channel-name');
        expect(classicStackBlock).toContain('color: var(--color-text-primary)');
        expect(classicStackBlock).not.toContain('-webkit-line-clamp');

        const classicPrimaryBlock = getBlock('.epg-container.layout-classic .epg-channel-name-primary');
        expect(classicPrimaryBlock).toContain('font-size: var(--classic-channel-name-size)');
        expect(classicPrimaryBlock).toContain('font-weight: 600');

        const classicProvenanceBlock = getBlock('.epg-container.layout-classic .epg-channel-name-provenance');
        expect(classicProvenanceBlock).toContain('font-size: var(--text-xs)');
        expect(classicProvenanceBlock).toContain('color: var(--color-text-muted)');

        const classicCategoryBlock = getBlock('.epg-container.layout-classic .epg-channel-name-category');
        expect(classicCategoryBlock).toContain('color: var(--color-text-muted)');

        const directvFocusBlock = getBlock(
            '.theme-directv .epg-container.layout-classic .epg-channel-row.focused .epg-channel-number,\n' +
            '.theme-directv .epg-container.layout-classic .epg-channel-row.focused .epg-channel-name,\n' +
            '.theme-directv .epg-container.layout-classic .epg-channel-row.focused .epg-channel-name-primary,\n' +
            '.theme-directv .epg-container.layout-classic .epg-channel-row.focused .epg-channel-name-provenance,\n' +
            '.theme-directv .epg-container.layout-classic .epg-channel-row.focused .epg-channel-name-source,\n' +
            '.theme-directv .epg-container.layout-classic .epg-channel-row.focused .epg-channel-name-category'
        );
        expect(directvFocusBlock).toContain('color: var(--directv-focus-text)');
    });

    it('keeps occluded time-slot labels transparent after classic theme overrides', () => {
        const classicBlock = getBlock(
            '.epg-container.layout-classic .epg-time-slot.epg-time-slot-occluded'
        );
        const emberBlock = getBlock(
            '.theme-ember-steel .epg-container.layout-classic .epg-time-slot.epg-time-slot-occluded'
        );
        const directvBlock = getBlock(
            '.theme-directv .epg-container.layout-classic .epg-time-slot.epg-time-slot-occluded'
        );
        expect(classicBlock).toContain('color: transparent');
        expect(emberBlock).toContain('color: transparent');
        expect(directvBlock).toContain('color: transparent');

        const previousBodyClassName = document.body.className;
        const container = document.createElement('div');

        try {
            document.body.className = 'theme-ember-steel';
            container.className = 'epg-container layout-classic';

            const slot = document.createElement('div');
            slot.className = 'epg-time-slot epg-time-slot-occluded';
            slot.textContent = '4:00 PM';
            container.appendChild(slot);
            document.body.appendChild(container);

            expect(getComputedStyle(slot).color).toBe('rgba(0, 0, 0, 0)');
        } finally {
            container.remove();
            document.body.className = previousBodyClassName;
        }
    });

    it('keeps focused movie rail anchoring stable while renderer owns time visibility', () => {
        const timeBlock = getBlock(
            '.epg-cell.focused.epg-cell-focused-movie-overlay .epg-cell-time'
        );
        expect(timeBlock).not.toContain('display: block');
        expect(timeBlock).toContain('align-self: flex-end');
        expect(timeBlock).toContain('margin-top: auto');

        const container = document.createElement('div');
        container.className = 'epg-container';
        document.body.appendChild(container);

        for (const tier of ['epg-cell-tier-tiny', 'epg-cell-tier-medium']) {
            for (const badgeHidden of [true, false]) {
                const cell = document.createElement('div');
                cell.className = `epg-cell focused epg-cell-focused-movie-overlay ${tier}`;

                const rail = document.createElement('div');
                rail.className = 'epg-cell-rail';

                const badge = document.createElement('span');
                badge.className = 'epg-live-badge';
                badge.hidden = badgeHidden;
                if (!badgeHidden) {
                    badge.classList.add('epg-live-badge-compact');
                }

                const time = document.createElement('div');
                time.className = 'epg-cell-time';
                time.textContent = '1:00 PM';

                rail.append(badge, time);
                cell.appendChild(rail);
                container.appendChild(cell);

                const railStyle = getComputedStyle(rail);
                const timeStyle = getComputedStyle(time);

                expect(railStyle.position).toBe('absolute');
                expect(railStyle.top).toBe('8px');
                expect(railStyle.right).toBe('10px');
                expect(railStyle.bottom).toBe('8px');
                expect(railStyle.alignItems).toBe('flex-end');
                expect(railStyle.justifyContent).toBe('space-between');
                expect(timeStyle.alignSelf).toBe('flex-end');
                expect(timeStyle.marginTop).toBe('auto');
                if (tier === 'epg-cell-tier-medium') {
                    expect(timeStyle.display).toBe('block');
                }
                if (badgeHidden) {
                    expect(getComputedStyle(badge).display).toBe('none');
                }
            }
        }
    });

    it('lets row-aware episode title cells reserve time space only for the subtitle row', () => {
        const layoutBlock = getBlock('.epg-cell.epg-cell-title-full-row');
        expect(layoutBlock).toContain('grid-template-columns: 1fr');

        const railBlock = getBlock('.epg-cell.epg-cell-title-full-row .epg-cell-rail');
        expect(railBlock).toContain('position: absolute');
        expect(railBlock).toContain('right: var(--space-3)');
        expect(railBlock).toContain('bottom: var(--space-2)');
        expect(railBlock).toContain('pointer-events: none');

        const subtitleBlock = getBlock('.epg-cell.epg-cell-title-full-row .epg-cell-subtitle');
        expect(subtitleBlock).toContain('max-width: calc(100% - 172px)');

        const cell = document.createElement('div');
        cell.className = 'epg-cell epg-cell-title-full-row epg-cell-tier-wide';

        const content = document.createElement('div');
        content.className = 'epg-cell-content';
        const title = document.createElement('div');
        title.className = 'epg-cell-title';
        const subtitle = document.createElement('div');
        subtitle.className = 'epg-cell-subtitle';
        content.append(title, subtitle);

        const rail = document.createElement('div');
        rail.className = 'epg-cell-rail';

        cell.append(content, rail);
        document.body.appendChild(cell);

        expect(getComputedStyle(cell).gridTemplateColumns).toBe('1fr');
        expect(getComputedStyle(rail).position).toBe('absolute');
        expect(getComputedStyle(title).maxWidth).toBe('');
        expect(getComputedStyle(subtitle).maxWidth).toBe('calc(100% - 172px)');
    });

    it('keeps current-cell progress contrast owned by local EPG CSS', () => {
        const progressBlock = getBlock('\n.epg-cell-progress {');
        expect(progressBlock).toContain('--epg-current-progress-track: rgba(13, 17, 24, 0.78)');
        expect(progressBlock).toContain('--epg-current-progress-fill: #ffd45a');
        expect(progressBlock).toContain('height: 5px');
        expect(progressBlock).toContain('background: var(--epg-current-progress-track)');
        expect(progressBlock).toContain('display: none');

        const currentBlock = getBlock('.epg-cell.current .epg-cell-progress');
        expect(currentBlock).toContain('display: block');

        const fillBlock = getBlock('.epg-cell-progress-fill');
        expect(fillBlock).toContain('background: var(--epg-current-progress-fill)');
        expect(fillBlock).toContain('box-shadow: 0 -1px 0 rgba(255, 255, 255, 0.36)');

        const cell = document.createElement('div');
        cell.className = 'epg-cell current';
        const progress = document.createElement('div');
        progress.className = 'epg-cell-progress';
        const fill = document.createElement('div');
        fill.className = 'epg-cell-progress-fill';
        progress.appendChild(fill);
        cell.appendChild(progress);
        document.body.appendChild(cell);

        const progressStyle = getComputedStyle(progress);
        expect(progressStyle.display).toBe('block');
        expect(progressStyle.height).toBe('5px');
        expect(progressStyle.getPropertyValue('--epg-current-progress-track').trim())
            .toBe('rgba(13, 17, 24, 0.78)');
        expect(progressStyle.getPropertyValue('--epg-current-progress-fill').trim()).toBe('#ffd45a');
    });

    it('keeps classic and forced-colors progress contrast overrides explicit', () => {
        const classicBlock = getBlock('.epg-container.layout-classic .epg-cell-progress');
        expect(classicBlock).toContain('--epg-current-progress-track: rgba(0, 0, 0, 0.62)');
        expect(classicBlock).toContain('--epg-current-progress-fill: var(--color-primary-light, var(--color-primary))');
        expect(classicBlock).toContain('height: 4px');

        const classicFillBlock = getBlock('.epg-container.layout-classic .epg-cell-progress-fill');
        expect(classicFillBlock).toContain('box-shadow: 0 -1px 0 rgba(255, 255, 255, 0.42)');

        const forcedColorsBlock = getAtRuleBlocks('@media (forced-colors: active)')
            .find((block) => block.includes('.epg-cell.current .epg-cell-progress'));
        expect(forcedColorsBlock).toBeDefined();
        const block = forcedColorsBlock ?? '';
        expect(block).toContain('background: CanvasText');
        expect(block).toContain('.epg-cell-progress-fill');
        expect(block).toContain('background: Highlight');

        const container = document.createElement('div');
        container.className = 'epg-container layout-classic';
        const cell = document.createElement('div');
        cell.className = 'epg-cell current';
        const progress = document.createElement('div');
        progress.className = 'epg-cell-progress';
        cell.appendChild(progress);
        container.appendChild(cell);
        document.body.appendChild(container);

        const progressStyle = getComputedStyle(progress);
        expect(progressStyle.display).toBe('block');
        expect(progressStyle.height).toBe('4px');
        expect(progressStyle.getPropertyValue('--epg-current-progress-track').trim())
            .toBe('rgba(0, 0, 0, 0.62)');
    });

    it('keeps generic focused narrow/tiny selectors from matching focused movie overlays', () => {
        expect(css).toContain(
            '.epg-cell.focused:not(.epg-cell-focused-compact):not(.epg-cell-focused-movie-overlay).epg-cell-tier-narrow,\n' +
            '.epg-cell.focused:not(.epg-cell-focused-compact):not(.epg-cell-focused-movie-overlay).epg-cell-tier-tiny'
        );
        expect(css).toContain(
            '.epg-cell.focused:not(.epg-cell-focused-compact):not(.epg-cell-focused-movie-overlay).epg-cell-tier-narrow .epg-cell-rail,\n' +
            '.epg-cell.focused:not(.epg-cell-focused-compact):not(.epg-cell-focused-movie-overlay).epg-cell-tier-tiny .epg-cell-rail'
        );
    });

    it('composes the base info-panel block through the seam import chain', () => {
        const block = getBlock('\n.epg-info-panel {');
        expect(block).toContain('height: var(--epg-info-panel-height)');
        expect(block).toContain('padding: var(--epg-info-panel-padding-y) var(--epg-info-panel-padding-x)');
        expect(block).not.toContain('border: var(--panel-border)');
        expect(block).not.toContain('border-radius: var(--panel-radius)');
        expect(block).not.toContain('box-shadow: var(--shadow-md)');
    });

    it('resolves focused tiny movie overlays to single-column + absolute rail in computed styles', () => {
        const cell = document.createElement('div');
        cell.className = 'epg-cell focused epg-cell-focused-movie-overlay epg-cell-tier-tiny';
        const rail = document.createElement('div');
        rail.className = 'epg-cell-rail';
        cell.appendChild(rail);
        document.body.appendChild(cell);

        const cellStyle = getComputedStyle(cell);
        const railStyle = getComputedStyle(rail);

        expect(cellStyle.gridTemplateColumns).toBe('1fr');
        expect(railStyle.position).toBe('absolute');
        expect(railStyle.pointerEvents).toBe('none');
    });

    it('keeps overlay rails corner-anchored when text-shifted', () => {
        const compact = document.createElement('div');
        compact.className = 'epg-cell focused text-shifted epg-cell-focused-compact';
        const compactRail = document.createElement('div');
        compactRail.className = 'epg-cell-rail';
        compact.appendChild(compactRail);
        document.body.appendChild(compact);

        const movie = document.createElement('div');
        movie.className = 'epg-cell focused text-shifted epg-cell-focused-movie-overlay epg-cell-tier-tiny';
        const movieRail = document.createElement('div');
        movieRail.className = 'epg-cell-rail';
        movie.appendChild(movieRail);
        document.body.appendChild(movie);

        expect(getComputedStyle(compactRail).transform).toBe('none');
        expect(getComputedStyle(movieRail).transform).toBe('none');
    });

    it('keeps channel-row focus selectors aligned with theme focus tokens', () => {
        const baseBlock = getBlock('.epg-channel-row.focused');
        expect(baseBlock).toContain('rgba(var(--focus-color-rgb),');

        const classicBlock = getBlock('.epg-container.layout-classic .epg-channel-row.focused');
        expect(classicBlock).toContain('rgba(var(--focus-color-rgb),');

        const glassBlock = getBlock('.theme-glass .epg-channel-row.focused::before');
        expect(glassBlock).toContain('rgba(var(--focus-color-rgb), 0.14)');

        const emberBlock = getBlock('.theme-ember-steel .epg-channel-row.focused');
        expect(emberBlock).toContain('rgba(var(--focus-color-rgb),');

        const swissBlock = getBlock('.theme-swiss .epg-channel-row.focused');
        expect(swissBlock).toContain('rgba(var(--focus-color-rgb),');

        const directvBlock = getBlock('.theme-directv .epg-container.layout-classic .epg-channel-row.focused');
        expect(directvBlock).toContain('var(--directv-focus-fill)');
    });

    it('keeps an explicit glass classic row-focus selector so the pill overlay owns the focus fill', () => {
        const block = getBlock('.theme-glass .epg-container.layout-classic .epg-channel-row.focused');
        expect(block).toContain('background: transparent');
    });

    it('keeps an explicit swiss classic row-focus selector so classic swiss does not inherit the generic classic tint', () => {
        const block = getBlock('.theme-swiss .epg-container.layout-classic .epg-channel-row.focused');
        expect(block).toContain('rgba(var(--focus-color-rgb), 0.12)');
    });

    it('keeps reduced-motion ticker suppression selectors', () => {
        const reducedMotionBlock = getAtRuleBlocks('@media (prefers-reduced-motion: reduce)')
            .find((block) => block.includes('.epg-cell-title.epg-cell-title-ticker-ready'));
        expect(reducedMotionBlock).toBeDefined();
        const block = reducedMotionBlock ?? '';
        expect(block).toContain('.epg-cell-title.epg-cell-title-ticker-ready');
        expect(block).toContain('.epg-cell-subtitle.epg-cell-subtitle-ticker-running');
        expect(block).toContain('animation: none');
        expect(block).toContain('transform: none');
    });

    it('keeps library-picker forced-colors selectors scoped to the grid seam', () => {
        const forcedColorsBlock = getAtRuleBlocks('@media (forced-colors: active)')
            .find((block) => block.includes('.epg-library-pill.focused'));
        expect(forcedColorsBlock).toBeDefined();
        const block = forcedColorsBlock ?? '';
        expect(block).toContain('.epg-library-pill');
        expect(block).toContain('.epg-library-picker-panel');
        expect(block).toContain('.epg-library-picker-item');
        expect(block).toContain('.epg-library-pill.focused');
        expect(block).toContain('.epg-library-picker-item.focused');
        expect(block).toContain('background: Highlight');
        expect(block).toContain('color: HighlightText');
        expect(block).toContain('outline: 2px solid Highlight');
        expect(block).toContain('.epg-library-picker-item.selected:not(.focused)');
        expect(block).toContain('text-decoration: underline');
    });

    it('keeps swiss minimal overrides owned by the theme seam without important flags', () => {
        const block = getBlock(
            '.theme-swiss .epg-info-panel .epg-info-backdrop,\n' +
            '.theme-swiss .epg-info-panel .epg-info-tags'
        );
        expect(block).toContain('display: none');
        expect(block).not.toContain('!important');
        expect(css).not.toContain('.theme-swiss .epg-cell-meta,\n.theme-swiss .epg-cell-subtitle');
        expect(css).not.toContain('.theme-swiss .epg-info-backdrop,\n.theme-swiss .epg-info-tags');
    });

    it('keeps directv backdrop theming out of bleed mode', () => {
        const block = getBlock('.theme-directv .epg-info-panel:not(.epg-info-mode-bleed) .epg-info-backdrop');
        expect(block).toContain('var(--directv-panel-gradient-start)');
        expect(block).toContain('var(--directv-panel-gradient-strong-end)');
        expect(css).not.toContain('.theme-directv .epg-info-panel .epg-info-backdrop {');
    });
});
