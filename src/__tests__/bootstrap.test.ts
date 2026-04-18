/**
 * @jest-environment jsdom
 */

import fs from 'node:fs';
import path from 'node:path';

import { LINEUP_EVENT_NAMES } from '../config/events';
import { LINEUP_STORAGE_KEYS } from '../config/storageKeys';

import { flushPromises } from './helpers';

const setDevBuild = (value: boolean): void => {
    Object.defineProperty(globalThis, '__LINEUP_DEV_BUILD__', {
        value,
        configurable: true,
        writable: true,
    });
};

type BootstrapModule = typeof import('../bootstrap');

type DebugApi = {
    openEPG: () => void;
    closeEPG: () => void;
    toggleEPG: () => void;
    domSnapshot: () => unknown;
    hideVideo: () => void;
    showVideo: () => void;
    orchestratorStatus: () => unknown;
};

type LineupWindow = Window & { __LINEUP__?: DebugApi };

let installedModule: BootstrapModule | null = null;

const getWindowListener = (
    spy: jest.SpyInstance,
    eventName: string
): ((event: Event) => void) | null => {
    const calls = spy.mock.calls as unknown[][];
    for (let index = calls.length - 1; index >= 0; index -= 1) {
        const [name, handler] = calls[index] ?? [];
        if (name === eventName && typeof handler === 'function') {
            return handler as (event: Event) => void;
        }
    }
    return null;
};

const importBootstrapModule = async (options?: {
    start?: jest.Mock;
    shutdown?: jest.Mock;
    getOrchestrator?: jest.Mock;
    autoDispatchDomReady?: boolean;
}): Promise<{
    module: BootstrapModule;
    start: jest.Mock;
    shutdown: jest.Mock;
    getOrchestrator: jest.Mock;
}> => {
    const start = options?.start ?? jest.fn().mockResolvedValue(undefined);
    const shutdown = options?.shutdown ?? jest.fn().mockResolvedValue(undefined);
    const getOrchestrator = options?.getOrchestrator ?? jest.fn(() => null);

    jest.doMock('../App', () => ({
        App: jest.fn().mockImplementation(() => ({
            start,
            shutdown,
            getOrchestrator,
        })),
    }));

    const module = await import('../bootstrap');
    installedModule = module;
    module.installLineupBootstrap();
    await flushPromises();
    if (options?.autoDispatchDomReady !== false && start.mock.calls.length === 0) {
        document.dispatchEvent(new Event('DOMContentLoaded'));
        await flushPromises();
    }
    return { module, start, shutdown, getOrchestrator };
};

const expectBootstrapFailureState = (module: BootstrapModule): void => {
    expect(document.querySelectorAll('#global-error-overlay')).toHaveLength(1);
    expect(module.app).toBeNull();
    expect((window as LineupWindow).__LINEUP__).toBeUndefined();
};

const readShellChromeCss = (): string =>
    fs.readFileSync(path.resolve(__dirname, '../styles/shell.chrome.css'), 'utf8');

describe('bootstrap seam', () => {
    beforeEach(() => {
        jest.resetModules();
        localStorage.clear();
        document.body.innerHTML = '<div id="app"></div><div id="video-container"></div>';
        setDevBuild(true);
        delete (window as LineupWindow).__LINEUP__;
    });

    afterEach(async () => {
        try {
            if (installedModule) {
                await installedModule.cleanupAndUninstallLineupBootstrap();
            }
        } finally {
            installedModule = null;
            jest.restoreAllMocks();
            document.body.innerHTML = '';
            localStorage.clear();
        }
    });

    it('registers global handlers and boots App', async () => {
        const windowAddEventListenerSpy = jest.spyOn(window, 'addEventListener');

        const { module, start, shutdown } = await importBootstrapModule();

        expect(windowAddEventListenerSpy).toHaveBeenCalledWith(
            LINEUP_EVENT_NAMES.DEBUG_LOGGING_CHANGED,
            expect.any(Function)
        );
        expect(windowAddEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
        expect(windowAddEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
        expect(windowAddEventListenerSpy).toHaveBeenCalledWith('pagehide', expect.any(Function));
        expect(windowAddEventListenerSpy).toHaveBeenCalledWith('pageshow', expect.any(Function));
        expect(start).toHaveBeenCalledTimes(1);

        await module.cleanup();
        expect(shutdown).toHaveBeenCalledTimes(1);
    });

    it('rejects from bootstrap() when App.start fails', async () => {
        const start = jest.fn().mockRejectedValue(new Error('start failed'));
        const { module } = await importBootstrapModule({ start, autoDispatchDomReady: false });

        await expect(module.bootstrap()).rejects.toThrow('start failed');
    });

    it('shows fatal overlay and clears app/debug state when DOMContentLoaded bootstrap fails', async () => {
        Object.defineProperty(document, 'readyState', {
            value: 'loading',
            configurable: true,
        });
        const start = jest.fn().mockRejectedValue(new Error('start failed'));

        try {
            const { module } = await importBootstrapModule({ start, autoDispatchDomReady: false });
            document.dispatchEvent(new Event('DOMContentLoaded'));
            await flushPromises();

            expectBootstrapFailureState(module);
        } finally {
            Object.defineProperty(document, 'readyState', {
                value: 'complete',
                configurable: true,
            });
        }
    });

    it('shows fatal overlay and clears app/debug state when immediate bootstrap fails', async () => {
        const start = jest.fn().mockRejectedValue(new Error('start failed'));

        const { module } = await importBootstrapModule({ start });

        expectBootstrapFailureState(module);
    });

    it('uses the fatal overlay stylesheet contract for topmost stacking without inline z-index styling', async () => {
        const shellSurface = document.createElement('div');
        shellSurface.id = 'existing-shell-surface';
        shellSurface.style.position = 'fixed';
        shellSurface.style.zIndex = '999999';
        document.body.appendChild(shellSurface);

        const start = jest.fn().mockRejectedValue(new Error('start failed'));

        await importBootstrapModule({ start });

        const overlay = document.getElementById('global-error-overlay');
        expect(overlay).not.toBeNull();
        expect(overlay?.classList.contains('error-overlay')).toBe(true);
        expect(overlay?.classList.contains('error-overlay-fatal')).toBe(true);
        expect((overlay as HTMLElement).style.zIndex).toBe('');

        const shellChromeCss = readShellChromeCss();
        expect(shellChromeCss).toMatch(/\.error-overlay\s*\{[^}]*z-index:\s*var\(--z-overlay\);/s);
        expect(shellChromeCss).toMatch(/\.error-overlay-fatal\s*\{[^}]*z-index:\s*2147483647;/s);
    });

    it('shows fatal overlay and clears app/debug state when pageshow bootstrap fails after cleanup', async () => {
        const start = jest
            .fn()
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error('start failed'));

        const { module } = await importBootstrapModule({ start });
        await module.cleanup();

        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
        await flushPromises();

        expectBootstrapFailureState(module);
    });

    it('clears app state and debug surface even when shutdown fails', async () => {
        const shutdown = jest.fn().mockRejectedValueOnce(new Error('shutdown failed'));

        const { module } = await importBootstrapModule({ shutdown });

        await expect(module.cleanup()).rejects.toThrow('shutdown failed');
        expect(module.app).toBeNull();
        expect((window as LineupWindow).__LINEUP__).toBeUndefined();
    });

    it('exposes debug surface and supports video visibility toggles', async () => {
        const orchestrator = {
            openEPG: jest.fn(),
            closeEPG: jest.fn(),
            toggleEPG: jest.fn(),
            getModuleStatus: jest.fn(() => new Map()),
            isReady: jest.fn(() => true),
        };
        const getOrchestrator = jest.fn(() => orchestrator);

        await importBootstrapModule({ getOrchestrator });

        const debugApi = (window as LineupWindow).__LINEUP__;
        expect(debugApi).toBeDefined();

        const video = document.createElement('video');
        document.body.appendChild(video);

        debugApi?.openEPG();
        debugApi?.closeEPG();
        debugApi?.toggleEPG();
        debugApi?.hideVideo();
        expect(video.style.display).toBe('none');
        debugApi?.showVideo();
        expect(video.style.display).toBe('');
        expect(debugApi?.orchestratorStatus()).toEqual({
            isReady: true,
            status: [],
        });

        expect(orchestrator.openEPG).toHaveBeenCalledTimes(1);
        expect(orchestrator.closeEPG).toHaveBeenCalledTimes(1);
        expect(orchestrator.toggleEPG).toHaveBeenCalledTimes(1);
    });

    it('clears debug surface after cleanup', async () => {
        const { module } = await importBootstrapModule();
        expect((window as LineupWindow).__LINEUP__).toBeDefined();

        await module.cleanup();

        expect((window as LineupWindow).__LINEUP__).toBeUndefined();
    });

    it('returns null orchestratorStatus when orchestrator is absent', async () => {
        await importBootstrapModule();

        const nullStatus = (window as LineupWindow).__LINEUP__?.orchestratorStatus();

        expect(nullStatus).toBeNull();
    });

    it('suppresses debug surface when not in dev build and debug logging is off', async () => {
        setDevBuild(false);
        localStorage.removeItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING);

        await importBootstrapModule();

        expect((window as LineupWindow).__LINEUP__).toBeUndefined();
    });

    it('drives error and unhandledrejection handlers through installed listeners', async () => {
        const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
        const preventDefault = jest.spyOn(Event.prototype, 'preventDefault');

        await importBootstrapModule();

        const errorEvent = new ErrorEvent('error', {
            message: 'X-Plex-Token=abc123',
            error: new Error('X-Plex-Token=abc123'),
            cancelable: true,
        });
        const errorDispatch = window.dispatchEvent(errorEvent);

        const overlaysAfterError = document.querySelectorAll('#global-error-overlay');
        expect(errorDispatch).toBe(false);
        expect(preventDefault).toHaveBeenCalled();
        expect(overlaysAfterError).toHaveLength(1);
        expect(overlaysAfterError[0]?.textContent ?? '').toContain('X-Plex-Token=REDACTED');
        expect(overlaysAfterError[0]?.textContent ?? '').not.toContain('abc123');

        window.dispatchEvent(
            new ErrorEvent('error', {
                message: 'second error',
                error: new Error('second error'),
                cancelable: true,
            })
        );
        expect(document.querySelectorAll('#global-error-overlay')).toHaveLength(1);
        document.getElementById('global-error-overlay')?.remove();
        expect(document.querySelectorAll('#global-error-overlay')).toHaveLength(0);

        const preventDefaultCallsBeforeRejection = preventDefault.mock.calls.length;

        if (typeof PromiseRejectionEvent !== 'undefined') {
            const rejectionEvent = new PromiseRejectionEvent('unhandledrejection', {
                promise: Promise.resolve(undefined),
                reason: 'token=abc123',
                cancelable: true,
            });
            const rejectionDispatch = window.dispatchEvent(rejectionEvent);
            expect(rejectionDispatch).toBe(false);
            expect(preventDefault.mock.calls.length).toBeGreaterThan(preventDefaultCallsBeforeRejection);
        } else {
            const onUnhandledRejection = getWindowListener(addEventListenerSpy, 'unhandledrejection');
            expect(onUnhandledRejection).toBeTruthy();
            const manualPreventDefault = jest.fn();
            onUnhandledRejection?.({ reason: 'token=abc123', preventDefault: manualPreventDefault } as unknown as Event);
            expect(manualPreventDefault).toHaveBeenCalledTimes(1);
        }

        const overlaysAfterRejection = document.querySelectorAll('#global-error-overlay');
        expect(overlaysAfterRejection).toHaveLength(1);
        expect(overlaysAfterRejection[0]?.textContent ?? '').toContain('token=REDACTED');
        expect(overlaysAfterRejection[0]?.textContent ?? '').not.toContain('abc123');
    });

    it('does not remove legacy debug logging key if migration write fails', async () => {
        const primaryKey = LINEUP_STORAGE_KEYS.DEBUG_LOGGING;
        const legacyKey = 'lineup_debug_transcode';
        localStorage.setItem(legacyKey, '1');

        Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
        jest.doMock('../utils/storage', () => {
            const actual = jest.requireActual('../utils/storage') as typeof import('../utils/storage');
            return {
                ...actual,
                safeLocalStorageSet: jest.fn(() => false),
                safeLocalStorageRemove: jest.fn(actual.safeLocalStorageRemove),
            };
        });

        try {
            await importBootstrapModule({ autoDispatchDomReady: false });

            expect(localStorage.getItem(primaryKey)).toBeNull();
            expect(localStorage.getItem(legacyKey)).toBe('1');

            const storage = await (import('../utils/storage') as unknown as Promise<{
                safeLocalStorageSet: jest.Mock;
                safeLocalStorageRemove: jest.Mock;
            }>);
            expect(storage.safeLocalStorageSet).toHaveBeenCalledWith(primaryKey, '1');
            expect(storage.safeLocalStorageRemove).not.toHaveBeenCalled();
        } finally {
            jest.unmock('../utils/storage');
            Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
        }
    });

    it('includes element identity and computed metadata in debug dom snapshots', async () => {
        await importBootstrapModule();

        const target = document.createElement('div');
        target.id = 'target';
        target.className = 'box';
        document.body.appendChild(target);

        const debugApi = (window as LineupWindow).__LINEUP__;
        const snapshot = debugApi?.domSnapshot() as {
            app: { id: string | null; computed: { display: string } | null } | null;
            video: { id: string | null; className: string | null; computed: { display: string } | null } | null;
        };

        expect(snapshot.app?.id).toBe('app');
        expect(snapshot.app?.computed).not.toBeNull();
        expect(snapshot.video).toBeNull();
    });

    it('re-evaluates console noise suppression when debug logging setting changes', async () => {
        setDevBuild(false);
        localStorage.removeItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING);

        await importBootstrapModule();
        const suppressedLog = (globalThis as { console: { log: (...args: unknown[]) => void } }).console.log;

        localStorage.setItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING, 'true');
        window.dispatchEvent(new Event(LINEUP_EVENT_NAMES.DEBUG_LOGGING_CHANGED));
        const restoredLog = (globalThis as { console: { log: (...args: unknown[]) => void } }).console.log;

        expect(suppressedLog).not.toBe(restoredLog);
    });

    it('waits for DOMContentLoaded when document is loading', async () => {
        Object.defineProperty(document, 'readyState', {
            value: 'loading',
            configurable: true,
        });

        try {
            const { start } = await importBootstrapModule({ autoDispatchDomReady: false });
            expect(start).not.toHaveBeenCalled();

            document.dispatchEvent(new Event('DOMContentLoaded'));
            await flushPromises();
            expect(start).toHaveBeenCalledTimes(1);
        } finally {
            Object.defineProperty(document, 'readyState', {
                value: 'complete',
                configurable: true,
            });
        }
    });
});
