/**
 * @jest-environment jsdom
 */

import { renderCappedWarnings } from '../render/renderCappedWarnings';

describe('renderCappedWarnings', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    it('renders capped warning rows with class output and plural remainder copy', () => {
        const container = document.createElement('div');

        renderCappedWarnings({
            warnings: ['A', 'B', 'C', 'D'],
            container,
            maxItems: 2,
            itemClassName: 'setup-preview-warning',
        });

        const rows = Array.from(container.querySelectorAll('.setup-preview-warning'));
        expect(rows).toHaveLength(3);
        expect(rows.map((row) => row.textContent)).toEqual(['A', 'B', 'And 2 more warnings…']);
    });

    it('uses singular remainder wording for exactly one extra warning', () => {
        const container = document.createElement('div');

        renderCappedWarnings({
            warnings: ['A', 'B', 'C'],
            container,
            maxItems: 2,
            itemClassName: 'setup-preview-warning',
        });

        expect(container.textContent).toContain('And 1 more warning…');
    });

    it('renders all warnings without remainder when under cap', () => {
        const container = document.createElement('div');

        renderCappedWarnings({
            warnings: ['A', 'B'],
            container,
            maxItems: 5,
            itemClassName: 'setup-preview-warning',
        });

        const rows = Array.from(container.querySelectorAll('.setup-preview-warning'));
        expect(rows.map((row) => row.textContent)).toEqual(['A', 'B']);
        expect(container.textContent).not.toContain('And ');
    });
});
