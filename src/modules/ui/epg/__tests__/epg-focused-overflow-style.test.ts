import fs from 'node:fs';
import path from 'node:path';

describe('focused EPG overflow style contract', () => {
    const cssPath = path.resolve(__dirname, '..', 'styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');
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
