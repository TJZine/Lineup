/**
 * @jest-environment jsdom
 */

jest.mock('../styles.css', () => ({}), { virtual: true });

import { SplashScreen } from '../SplashScreen';
import type { InitializationRestoreProjection } from '../../../../core/initialization/InitializationRestoreProjection';

const restoring = (change: Partial<InitializationRestoreProjection> = {}): InitializationRestoreProjection => ({
    generation: 1, phase: 'read-lineup', outcome: null, channelCount: null,
    requiredComplete: false, optionalComplete: null, reason: null, actions: [], ...change,
});

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

    it('shows real restore phase/count and ignores a superseded generation', () => {
        const container = document.createElement('div');
        const switchServer = jest.fn();
        const screen = new SplashScreen(container, switchServer);
        screen.updateRestoreProjection(restoring({ generation: 2, phase: 'prepare-guide', channelCount: 3 }));

        expect(container.querySelector('.splash-restore-title')?.textContent).toBe('Loading your lineup…');
        expect(container.querySelector('.splash-restore-phase')?.textContent).toBe('Preparing the Guide… 3 saved channels.');
        container.querySelector<HTMLButtonElement>('.splash-switch-server')?.click();
        expect(switchServer).toHaveBeenCalledTimes(1);

        screen.updateRestoreProjection(restoring({ generation: 1, phase: 'server' }));
        expect(container.querySelector('.splash-restore-phase')?.textContent).toBe('Preparing the Guide… 3 saved channels.');
        screen.updateRestoreProjection(restoring({ generation: 3, phase: 'server' }));
        expect(container.querySelector('.splash-restore-phase')?.textContent).toBe('Connecting to your server…');
    });

    it('registers Switch server for remote focus only during visible restore', () => {
        const container = document.createElement('div');
        const navigation = { registerFocusable: jest.fn(), unregisterFocusable: jest.fn(), setFocus: jest.fn() };
        const screen = new SplashScreen(container, jest.fn(), () => navigation);
        screen.show();
        screen.updateRestoreProjection(restoring());
        expect(navigation.registerFocusable).toHaveBeenCalledWith(expect.objectContaining({ id: 'splash-switch-server' }));
        expect(navigation.setFocus).toHaveBeenCalledWith('splash-switch-server');
        screen.hide();
        expect(navigation.unregisterFocusable).toHaveBeenCalledWith('splash-switch-server');
        screen.show();
        expect(navigation.registerFocusable).toHaveBeenCalledTimes(2);
        screen.updateRestoreProjection(restoring({ phase: 'complete' }));
        expect(navigation.unregisterFocusable).toHaveBeenCalledTimes(2);
    });
});
