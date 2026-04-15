/**
 * @jest-environment jsdom
 */

import { createSettingsToggle } from '../SettingsToggle';

describe('createSettingsToggle', () => {
    afterEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('toggles state, classes, and callback behavior on click', () => {
        const onChange = jest.fn();
        const toggle = createSettingsToggle({
            id: 'theme-toggle',
            label: 'Theme',
            description: 'Enable the theme.',
            value: false,
            onChange,
        });

        toggle.element.click();

        expect(toggle.element.classList.contains('selected')).toBe(true);
        expect(toggle.element.querySelector('.setup-toggle-state')?.textContent).toBe('On');
        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('prefers the disabled reason while disabled and restores the description when re-enabled', () => {
        const toggle = createSettingsToggle({
            id: 'theme-toggle',
            label: 'Theme',
            description: 'Enable the theme.',
            value: true,
            disabled: false,
            disabledReason: 'Unavailable until setup completes.',
            onChange: jest.fn(),
        });

        toggle.setDisabled(true);
        expect(toggle.isDisabled()).toBe(true);
        expect(toggle.element.classList.contains('disabled')).toBe(true);
        expect(toggle.element.querySelector('.setup-toggle-meta')?.textContent).toBe(
            'Unavailable until setup completes.'
        );

        toggle.setDisabled(false);
        expect(toggle.isDisabled()).toBe(false);
        expect(toggle.element.querySelector('.setup-toggle-meta')?.textContent).toBe('Enable the theme.');
    });

    it('ignores disabled clicks and restores callback behavior after re-enable', () => {
        const onChange = jest.fn();
        const toggle = createSettingsToggle({
            id: 'theme-toggle',
            label: 'Theme',
            description: 'Enable the theme.',
            value: false,
            disabled: false,
            onChange,
        });

        toggle.setDisabled(true);
        expect(toggle.isDisabled()).toBe(true);
        toggle.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(onChange).not.toHaveBeenCalled();

        toggle.setDisabled(false);
        expect(toggle.isDisabled()).toBe(false);
        toggle.element.click();

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(true);
    });
});
