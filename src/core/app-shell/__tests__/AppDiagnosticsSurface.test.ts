/**
 * @jest-environment jsdom
 */

import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import { flushPromises } from '../../../__tests__/helpers';
import { AppDiagnosticsSurface, type DiagnosticsOrchestrator } from '../AppDiagnosticsSurface';

const createContainer = (): HTMLDivElement => {
    const el = document.createElement('div');
    el.id = 'dev-menu';
    el.style.display = 'none';
    return el;
};

const createSnapshot = (): { channel: null; program: null; stream: null } => ({
    channel: null,
    program: null,
    stream: null,
});

describe('AppDiagnosticsSurface', () => {
    let surface: AppDiagnosticsSurface | null = null;

    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '';
        Object.defineProperty(globalThis, '__LINEUP_DEV_BUILD__', {
            value: true,
            configurable: true,
            writable: true,
        });
    });

    afterEach(() => {
        surface?.dispose();
        surface = null;
        jest.restoreAllMocks();
        document.body.innerHTML = '';
        localStorage.clear();
        try {
            delete (window as { lineup?: unknown }).lineup;
        } catch {
            // ignore
        }
    });

    it('binds debug key handlers and global lineup helper when enabled', async () => {
        const toggleServerSelect = jest.fn();
        const refreshPlaybackInfoSnapshot = jest.fn().mockResolvedValue(createSnapshot());
        const showToast = jest.fn();
        const container = createContainer();
        document.body.appendChild(container);

        surface = new AppDiagnosticsSurface({
            getOrchestrator: (): DiagnosticsOrchestrator => ({ toggleServerSelect, refreshPlaybackInfoSnapshot }),
            showToast,
        });
        surface.setContainer(container);
        surface.initialize();

        expect(typeof (window as { lineup?: { toggleDevMenu: () => void } }).lineup?.toggleDevMenu).toBe('function');

        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI' }));
        expect(toggleServerSelect).toHaveBeenCalledTimes(1);

        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', ctrlKey: true, shiftKey: true }));
        await flushPromises();

        expect(container.style.display).toBe('block');
    });

    it('does not expose helper or react to shortcuts when debug surface is disabled', async () => {
        Object.defineProperty(globalThis, '__LINEUP_DEV_BUILD__', {
            value: false,
            configurable: true,
            writable: true,
        });
        localStorage.removeItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING);
        const toggleServerSelect = jest.fn();
        const refreshPlaybackInfoSnapshot = jest.fn().mockResolvedValue(createSnapshot());
        const container = createContainer();
        document.body.appendChild(container);

        surface = new AppDiagnosticsSurface({
            getOrchestrator: (): DiagnosticsOrchestrator => ({ toggleServerSelect, refreshPlaybackInfoSnapshot }),
            showToast: jest.fn(),
        });
        surface.setContainer(container);
        surface.initialize();

        expect((window as { lineup?: unknown }).lineup).toBeUndefined();

        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI' }));
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', ctrlKey: true, shiftKey: true }));
        await flushPromises();

        expect(toggleServerSelect).not.toHaveBeenCalled();
        expect(container.style.display).toBe('none');
        expect(container.innerHTML).toBe('');
    });

    it('renders playback info on open and supports refresh button', async () => {
        const refreshPlaybackInfoSnapshot = jest.fn().mockResolvedValue(createSnapshot());
        const container = createContainer();
        document.body.appendChild(container);

        surface = new AppDiagnosticsSurface({
            getOrchestrator: (): DiagnosticsOrchestrator => ({ toggleServerSelect: jest.fn(), refreshPlaybackInfoSnapshot }),
            showToast: jest.fn(),
        });
        surface.setContainer(container);
        surface.initialize();

        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', ctrlKey: true, shiftKey: true }));
        await flushPromises();

        const playbackPre = container.querySelector('#dev-playback-info');
        const refreshButton = container.querySelector('#dev-playback-refresh');
        expect(playbackPre).toBeInstanceOf(HTMLPreElement);
        expect(refreshButton).toBeInstanceOf(HTMLButtonElement);
        expect((playbackPre as HTMLPreElement).textContent ?? '').toContain('PLAYBACK INFO');
        expect(refreshPlaybackInfoSnapshot).toHaveBeenCalledTimes(1);

        (refreshButton as HTMLButtonElement).click();
        await flushPromises();

        expect(refreshPlaybackInfoSnapshot).toHaveBeenCalledTimes(2);
    });

    it('dispose removes key handlers and lineup helper', async () => {
        const toggleServerSelect = jest.fn();
        const refreshPlaybackInfoSnapshot = jest.fn().mockResolvedValue(createSnapshot());
        const container = createContainer();
        document.body.appendChild(container);

        surface = new AppDiagnosticsSurface({
            getOrchestrator: (): DiagnosticsOrchestrator => ({ toggleServerSelect, refreshPlaybackInfoSnapshot }),
            showToast: jest.fn(),
        });
        surface.setContainer(container);
        surface.initialize();

        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI' }));
        expect(toggleServerSelect).toHaveBeenCalledTimes(1);

        surface.dispose();
        surface = null;

        expect((window as { lineup?: unknown }).lineup).toBeUndefined();

        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI' }));
        expect(toggleServerSelect).toHaveBeenCalledTimes(1);
    });

    it('keeps the close button safe after dispose when the menu was already rendered', async () => {
        const refreshPlaybackInfoSnapshot = jest.fn().mockResolvedValue(createSnapshot());
        const container = createContainer();
        document.body.appendChild(container);

        surface = new AppDiagnosticsSurface({
            getOrchestrator: (): DiagnosticsOrchestrator => ({ toggleServerSelect: jest.fn(), refreshPlaybackInfoSnapshot }),
            showToast: jest.fn(),
        });
        surface.setContainer(container);
        surface.initialize();

        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', ctrlKey: true, shiftKey: true }));
        await flushPromises();

        const closeButton = container.querySelector('#dev-close');
        expect(closeButton).toBeInstanceOf(HTMLButtonElement);
        expect(container.style.display).toBe('block');

        surface.dispose();
        surface = null;

        expect(() => (closeButton as HTMLButtonElement).click()).not.toThrow();
        expect(container.style.display).toBe('none');
    });
});
