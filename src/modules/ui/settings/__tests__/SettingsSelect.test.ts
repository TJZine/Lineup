/**
 * @jest-environment jsdom
 */

import { createSettingsSelect } from '../SettingsSelect';

describe('createSettingsSelect', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('rejects setValue when nextValue is not in options', () => {
        const onChange = jest.fn();
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

        const changed = select.setValue(999);

        expect(changed).toBe(false);
        expect(onChange).not.toHaveBeenCalled();
        expect(select.element.textContent).toContain('One');
    });
});

