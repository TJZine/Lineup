/**
 * @jest-environment jsdom
 */

import { createSettingsSelect } from '../SettingsSelect';

describe('createSettingsSelect', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('rejects setValue when nextValue is not in options', () => {
        const onChange = jest.fn(() => ({ ok: true } as const));
        const select = createSettingsSelect({
            id: 'settings-test-select',
            label: 'Test',
            value: 1,
            options: [
                { label: 'One', value: 1 },
                { label: 'Two', value: 2 },
            ],
            onChange,
        });

        document.body.appendChild(select.element);

        expect(select.element.textContent).toContain('One');
        expect(select.element.getAttribute('aria-haspopup')).toBe('listbox');
        expect(select.element.getAttribute('aria-controls')).toBe('settings-dropdown');
        expect(select.element.getAttribute('aria-expanded')).toBe('false');

        const changed = select.setValue(999);

        expect(changed).toBe(false);
        expect(onChange).not.toHaveBeenCalled();
        expect(select.element.textContent).toContain('One');
    });

    it('keeps a failed explicit selection rolled back and restores metadata after retry', () => {
        const onChange = jest.fn()
            .mockReturnValueOnce({
                ok: false,
                message: 'Storage failed.',
                effectiveValue: 1,
            } as const)
            .mockReturnValueOnce({ ok: true } as const);
        const select = createSettingsSelect({
            id: 'settings-test-select',
            label: 'Test',
            description: 'Normal metadata.',
            value: 1,
            options: [
                { label: 'One', value: 1 },
                { label: 'Two', value: 2 },
                { label: 'Three', value: 3 },
            ],
            onChange,
        });

        expect(select.setValue(2)).toBe(true);
        expect(select.getValue()).toBe(1);
        expect(select.element.querySelector('.setup-toggle-value')?.textContent).toBe('One');
        expect(select.element.querySelector('.setup-toggle-meta')?.textContent).toBe('Storage failed.');

        expect(select.setValue(2)).toBe(true);
        expect(select.getValue()).toBe(2);
        expect(select.element.querySelector('.setup-toggle-meta')?.textContent).toBe('Normal metadata.');
    });

    it('does not persist from a direct element click before a chooser is opened', () => {
        const onChange = jest.fn(() => ({ ok: true } as const));
        const select = createSettingsSelect({
            id: 'settings-test-select',
            label: 'Test',
            value: 1,
            options: [
                { label: 'One', value: 1 },
                { label: 'Two', value: 2 },
            ],
            onChange,
        });

        select.element.click();

        expect(select.getValue()).toBe(1);
        expect(onChange).not.toHaveBeenCalled();
    });
});
