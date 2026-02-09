/**
 * @jest-environment jsdom
 */

import { createOverlayPrimitives } from '../common/OverlayPrimitives';

describe('OverlayPrimitives', () => {
    it('builds panel/header/content slots', () => {
        const primitives = createOverlayPrimitives(
            {
                panel: 'test-panel',
                header: 'test-header',
                title: 'test-title',
                content: 'test-content',
            },
            {
                panel: {
                    maxWidth: '960px',
                    safeMarginPct: 8,
                },
                title: 'Overlay Title',
            }
        );

        expect(primitives.panelEl.className).toBe('test-panel');
        expect(primitives.headerEl?.className).toBe('test-header');
        expect(primitives.titleEl?.className).toBe('test-title');
        expect(primitives.contentEl?.className).toBe('test-content');
        expect(primitives.titleEl?.textContent).toBe('Overlay Title');
        expect(primitives.panelEl.style.maxWidth).toBe('960px');
        expect(primitives.panelEl.style.getPropertyValue('--overlay-safe-margin-pct')).toBe('8');
    });

    it('does not mutate provided classnames', () => {
        const classNames = {
            panel: 'alpha beta',
            header: 'gamma',
            title: 'delta',
        };
        const primitives = createOverlayPrimitives(classNames, { panel: {}, title: 'x' });

        expect(classNames.panel).toBe('alpha beta');
        expect(classNames.header).toBe('gamma');
        expect(classNames.title).toBe('delta');
        expect(primitives.panelEl.className).toBe('alpha beta');
        expect(primitives.headerEl?.className).toBe('gamma');
        expect(primitives.titleEl?.className).toBe('delta');
    });
});
