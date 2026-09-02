/**
 * @jest-environment jsdom
 */

import { createSettingsToggle } from '../SettingsToggle';

describe('createSettingsToggle', () => {
    afterEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('toggles state, classes, and callback behavior through activation', () => {
        const onChange = jest.fn(() => ({ ok: true } as const));
        const toggle = createSettingsToggle({
            id: 'theme-toggle',
            label: 'Theme',
            description: 'Enable the theme.',
            value: false,
            onChange,
        });

        toggle.activate();

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
            onChange: jest.fn(() => ({ ok: true } as const)),
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

    it('ignores disabled activation and restores callback behavior after re-enable', () => {
        const onChange = jest.fn(() => ({ ok: true } as const));
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
        toggle.activate();
        expect(onChange).not.toHaveBeenCalled();

        toggle.setDisabled(false);
        expect(toggle.isDisabled()).toBe(false);
        toggle.activate();

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('rolls back a failed change, announces the failure, and restores metadata after success', () => {
        const onChange = jest.fn()
            .mockReturnValueOnce({ ok: false, message: 'Storage failed.' })
            .mockReturnValueOnce({ ok: true });
        const toggle = createSettingsToggle({
            id: 'theme-toggle',
            label: 'Theme',
            description: 'Enable the theme.',
            value: false,
            onChange,
        });

        toggle.activate();

        const meta = toggle.element.querySelector('.setup-toggle-meta');
        expect(toggle.element.querySelector('.setup-toggle-state')?.textContent).toBe('Off');
        expect(meta?.textContent).toBe('Storage failed.');
        expect(meta?.getAttribute('role')).toBe('status');
        expect(meta?.getAttribute('aria-live')).toBe('polite');

        toggle.activate();

        expect(toggle.element.querySelector('.setup-toggle-state')?.textContent).toBe('On');
        expect(meta?.textContent).toBe('Enable the theme.');
    });
});
