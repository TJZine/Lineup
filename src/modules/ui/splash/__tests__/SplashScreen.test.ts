/**
 * @jest-environment jsdom
 */

jest.mock('../styles.css', () => ({}), { virtual: true });

import { SplashScreen } from '../SplashScreen';

describe('SplashScreen', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('builds the splash UI shell on construction', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new SplashScreen(container);
        expect(screen).toBeInstanceOf(SplashScreen);
        expect(container.className).toContain('splash-screen');
        expect(container.querySelector('.splash-title')?.textContent).toBe('RETUNE');
        expect(container.querySelector('.splash-subtitle')?.textContent).toContain('Warming up Plex');
        expect(container.querySelector('.splash-status')?.textContent).toBe('Starting up…');
    });

    it('updates status text when status element exists', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new SplashScreen(container);
        screen.updateStatus('Loading channels');

        expect(container.querySelector('.splash-status')?.textContent).toBe('Loading channels');
    });

    it('handles updateStatus when status element is unavailable', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new SplashScreen(container);
        container.querySelector('.splash-status')?.remove();

        expect(() => screen.updateStatus('No-op update')).not.toThrow();
    });

    it('show and hide manage visible class', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const screen = new SplashScreen(container);

        screen.show();
        expect(container.classList.contains('visible')).toBe(true);

        screen.hide();
        expect(container.classList.contains('visible')).toBe(false);
    });
});
