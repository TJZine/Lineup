/**
 * @jest-environment jsdom
 */

import { createScreenShell } from '../common/ScreenShell';

describe('ScreenShell', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    it('renders title/subtitle and supports status aria-live', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const shell = createScreenShell(container, {
            title: 'Welcome',
            subtitle: 'Choose an option',
            status: {
                title: 'Ready',
                detail: 'Awaiting input',
                tone: 'neutral',
                ariaLive: 'polite',
            },
            error: null,
            actions: [],
        });

        expect(container.querySelector('.screen-title')?.textContent).toBe('Welcome');
        expect(container.querySelector('.screen-subtitle')?.textContent).toBe('Choose an option');

        const status = container.querySelector('.screen-status') as HTMLElement;
        expect(status.textContent).toBe('Ready');
        expect(status.getAttribute('aria-live')).toBe('polite');

        shell.setStatus({
            title: 'Loading',
            detail: 'Please wait',
            tone: 'loading',
            ariaLive: 'assertive',
        });
        expect(status.getAttribute('aria-live')).toBe('assertive');
        expect((container.querySelector('.screen-detail') as HTMLElement).textContent).toBe('Please wait');
    });

    it('clears error block content cleanly', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const shell = createScreenShell(container, {
            title: 'Errors',
            status: null,
            error: null,
            actions: [],
        });

        shell.setError({
            title: 'Connection error',
            message: 'Network timeout',
            recoveryHint: 'Try again',
        });

        const errorEl = container.querySelector('.screen-error') as HTMLElement;
        expect(errorEl.textContent).toContain('Connection error');
        expect(errorEl.children.length).toBeGreaterThan(0);

        shell.setError(null);
        expect(errorEl.textContent).toBe('');
        expect(errorEl.children.length).toBe(0);
    });

    it('renders stable action ids and triggers click handlers', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const onPrimary = jest.fn();
        const onSecondary = jest.fn();

        createScreenShell(container, {
            title: 'Actions',
            status: null,
            error: null,
            actions: [
                { id: 'action-primary', label: 'Continue', variant: 'primary', onSelect: onPrimary },
                { id: 'action-secondary', label: 'Cancel', variant: 'secondary', onSelect: onSecondary },
            ],
        });

        const primary = container.querySelector('#action-primary') as HTMLButtonElement;
        const secondary = container.querySelector('#action-secondary') as HTMLButtonElement;

        expect(primary).toBeTruthy();
        expect(secondary).toBeTruthy();

        primary.click();
        secondary.click();

        expect(onPrimary).toHaveBeenCalledTimes(1);
        expect(onSecondary).toHaveBeenCalledTimes(1);
    });
});
