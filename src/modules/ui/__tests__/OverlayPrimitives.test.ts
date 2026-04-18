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

    it('skips creating a title element when title is missing', () => {
        const primitives = createOverlayPrimitives(
            {
                panel: 'test-panel',
                header: 'test-header',
                title: 'test-title',
            },
            {
                panel: {},
            }
        );

        expect(primitives.headerEl).not.toBeNull();
        expect(primitives.titleEl).toBeNull();
        expect(primitives.panelEl.querySelector('h1')).toBeNull();
    });

    it('attaches provided meta, hints, and actions slots to their sections', () => {
        const metaSlot = document.createElement('span');
        metaSlot.textContent = 'meta';
        const hintsSlot = document.createElement('span');
        hintsSlot.textContent = 'hint';
        const actionsSlot = document.createElement('button');
        actionsSlot.textContent = 'Go';

        const primitives = createOverlayPrimitives(
            {
                panel: 'test-panel',
                meta: 'test-meta',
                hints: 'test-hints',
                actions: 'test-actions',
            },
            {
                panel: {},
                metaSlot,
                hintsSlot,
                actionsSlot,
            }
        );

        expect(primitives.metaEl?.className).toBe('test-meta');
        expect(primitives.metaEl?.firstChild).toBe(metaSlot);
        expect(primitives.hintsEl?.className).toBe('test-hints');
        expect(primitives.hintsEl?.firstChild).toBe(hintsSlot);
        expect(primitives.actionsEl?.className).toBe('test-actions');
        expect(primitives.actionsEl?.firstChild).toBe(actionsSlot);
    });
});
