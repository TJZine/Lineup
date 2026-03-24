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
        const logoMark = container.querySelector('.splash-logo-mark');
        expect(logoMark).not.toBeNull();
        expect((logoMark as HTMLImageElement).getAttribute('src')).toBe('./lineup-logo-mark.png');
        expect((logoMark as HTMLImageElement).getAttribute('alt')).toBe('');
        expect((logoMark as HTMLImageElement).getAttribute('aria-hidden')).toBe('true');
        const wordmark = container.querySelector('.splash-wordmark');
        expect(wordmark).not.toBeNull();
        expect((wordmark as HTMLImageElement).getAttribute('src')).toBe('./lineup-wordmark.png');
        expect((wordmark as HTMLImageElement).getAttribute('alt')).toBe('Lineup');
        expect(container.querySelector('.splash-subtitle')?.textContent).toContain('Connecting Plex');
        const status = container.querySelector('.splash-status');
        expect(status?.textContent).toBe('Starting up…');
        expect(status?.getAttribute('role')).toBe('status');
        expect(status?.getAttribute('aria-live')).toBe('polite');
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
