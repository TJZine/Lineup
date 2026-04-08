/** @jest-environment jsdom */

import fs from 'node:fs';
import path from 'node:path';

describe('focused EPG overflow style contract', () => {
    const cssPath = path.resolve(__dirname, '..', 'styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');
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
        expect(block).toContain('padding: 4px 6px');
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
    });

    it('keeps focused movie rail anchoring stable across badge visibility in tiny and medium tiers', () => {
        const timeBlock = getBlock(
            '.epg-cell.focused.epg-cell-focused-movie-overlay .epg-cell-time'
        );
        expect(timeBlock).toContain('display: block');
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
});
