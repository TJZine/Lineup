/**
 * @jest-environment jsdom
 */

import { RETUNE_EVENT_NAMES } from '../config/events';
import { RETUNE_STORAGE_KEYS } from '../config/storageKeys';

const setDevBuild = (value: boolean): void => {
    Object.defineProperty(globalThis, '__RETUNE_DEV_BUILD__', {
        value,
        configurable: true,
        writable: true,
    });
};

const flushPromises = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
};

type BootstrapModule = typeof import('../bootstrap');

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
    module.installRetuneBootstrap();
    await flushPromises();
    if (options?.autoDispatchDomReady !== false && start.mock.calls.length === 0) {
        document.dispatchEvent(new Event('DOMContentLoaded'));
        await flushPromises();
    }
    return { module, start, shutdown, getOrchestrator };
};

describe('bootstrap seam', () => {
    beforeEach(() => {
        jest.resetModules();
        localStorage.clear();
        document.body.innerHTML = '<div id="app"></div>';
        setDevBuild(true);
        delete (window as { __RETUNE__?: unknown }).__RETUNE__;
    });

    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = '';
        localStorage.clear();
    });

    it('registers global handlers and boots App', async () => {
        const windowAddEventListenerSpy = jest.spyOn(window, 'addEventListener');

        const { module, start, shutdown } = await importBootstrapModule();

        expect(windowAddEventListenerSpy).toHaveBeenCalledWith(
            RETUNE_EVENT_NAMES.DEBUG_LOGGING_CHANGED,
            expect.any(Function)
        );
        expect(windowAddEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
        expect(windowAddEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
        expect(windowAddEventListenerSpy).toHaveBeenCalledWith('pagehide', expect.any(Function));
        expect(start).toHaveBeenCalledTimes(1);

        await module.cleanup();
        expect(shutdown).toHaveBeenCalledTimes(1);
    });

    it('exposes and clears debug surface based on build/debug flags', async () => {
        const orchestrator = {
            openEPG: jest.fn(),
            closeEPG: jest.fn(),
            toggleEPG: jest.fn(),
            getModuleStatus: jest.fn(() => new Map()),
            isReady: jest.fn(() => true),
        };
        const getOrchestrator = jest.fn(() => orchestrator);

        const { module } = await importBootstrapModule({ getOrchestrator });

        module.bootstrapInternals.syncWindowDebugApi({
            getOrchestrator: () => orchestrator,
        } as never);
        const debugApi = (window as { __RETUNE__?: {
            openEPG: () => void;
            closeEPG: () => void;
            toggleEPG: () => void;
            domSnapshot: () => unknown;
            hideVideo: () => void;
            showVideo: () => void;
            orchestratorStatus: () => unknown;
        } }).__RETUNE__;
        expect(debugApi).toBeDefined();

        const video = document.createElement('video');
        document.body.appendChild(video);
        debugApi?.openEPG();
        debugApi?.closeEPG();
        debugApi?.toggleEPG();
        debugApi?.hideVideo();
        expect(video.style.display).toBe('none');
        debugApi?.showVideo();
        expect(video.style.display).toBe('block');
        expect(debugApi?.domSnapshot()).toBeTruthy();
        expect(debugApi?.orchestratorStatus()).toEqual({
            isReady: true,
            status: [],
        });
        expect(orchestrator.openEPG).toHaveBeenCalledTimes(1);
        expect(orchestrator.closeEPG).toHaveBeenCalledTimes(1);
        expect(orchestrator.toggleEPG).toHaveBeenCalledTimes(1);

        module.bootstrapInternals.syncWindowDebugApi(null);
        expect((window as { __RETUNE__?: unknown }).__RETUNE__).toBeUndefined();

        module.bootstrapInternals.syncWindowDebugApi({
            getOrchestrator: () => null,
        } as never);
        const nullStatus = (window as { __RETUNE__?: { orchestratorStatus: () => unknown } }).__RETUNE__
            ?.orchestratorStatus();
        expect(nullStatus).toBeNull();

        setDevBuild(false);
        localStorage.removeItem(RETUNE_STORAGE_KEYS.DEBUG_LOGGING);
        localStorage.removeItem(RETUNE_STORAGE_KEYS.DEBUG_LOGGING_LEGACY);
        module.bootstrapInternals.syncWindowDebugApi({
            getOrchestrator: () => orchestrator,
        } as never);
        expect((window as { __RETUNE__?: unknown }).__RETUNE__).toBeUndefined();
    });

    it('normalizes safe error messages and deduplicates overlay creation', async () => {
        const { module } = await importBootstrapModule();

        expect(module.bootstrapInternals.toSafeErrorMessage(new Error('token=abc'))).not.toContain('abc');
        expect(module.bootstrapInternals.toSafeErrorMessage('token=abc')).not.toContain('abc');
        expect(module.bootstrapInternals.toSafeErrorMessage({})).toBe('An unexpected error occurred.');

        module.bootstrapInternals.showGlobalErrorOverlay('First message');
        module.bootstrapInternals.showGlobalErrorOverlay('Second message');

        const overlays = document.querySelectorAll('#global-error-overlay');
        expect(overlays).toHaveLength(1);
        expect(overlays[0]?.textContent ?? '').toContain('First message');
    });

    it('handles error and rejection events via overlay path', async () => {
        const { module } = await importBootstrapModule();
        const preventDefault = jest.fn();

        module.bootstrapInternals.handleGlobalError({
            error: new Error('boom'),
            message: 'boom',
            preventDefault,
        } as never);
        expect(preventDefault).toHaveBeenCalledTimes(1);
        expect(document.getElementById('global-error-overlay')).not.toBeNull();

        module.bootstrapInternals.handleGlobalError({
            message: 'plain boom',
            preventDefault,
        } as never);
        expect(preventDefault).toHaveBeenCalledTimes(2);

        module.bootstrapInternals.handleUnhandledRejection({
            reason: 'oops',
            preventDefault,
        } as never);
        expect(preventDefault).toHaveBeenCalledTimes(3);
    });

    it('describes DOM elements for debug snapshots', async () => {
        const { module } = await importBootstrapModule();
        const el = document.createElement('div');
        el.id = 'target';
        el.className = 'box';
        document.body.appendChild(el);

        const snapshot = module.bootstrapInternals.describeElement(el) as {
            id: string | null;
            className: string | null;
            computed: { display: string } | null;
        };
        const missing = module.bootstrapInternals.describeElement(null);

        expect(snapshot.id).toBe('target');
        expect(snapshot.className).toBe('box');
        expect(snapshot.computed).not.toBeNull();
        expect(missing).toBeNull();
    });

    it('suppresses console noise when debug logging is off in lean mode', async () => {
        setDevBuild(false);
        localStorage.removeItem(RETUNE_STORAGE_KEYS.DEBUG_LOGGING);
        localStorage.removeItem(RETUNE_STORAGE_KEYS.DEBUG_LOGGING_LEGACY);

        const { module } = await importBootstrapModule();
        module.bootstrapInternals.configureLoggingPolicy();
        const suppressedLog = (globalThis as { console: { log: (...args: unknown[]) => void } }).console.log;

        localStorage.setItem(RETUNE_STORAGE_KEYS.DEBUG_LOGGING, 'true');
        module.bootstrapInternals.configureLoggingPolicy();
        const restoredLog = (globalThis as { console: { log: (...args: unknown[]) => void } }).console.log;

        expect(suppressedLog).not.toBe(restoredLog);
    });

    it('waits for DOMContentLoaded when document is loading', async () => {
        Object.defineProperty(document, 'readyState', {
            value: 'loading',
            configurable: true,
        });

        const { start } = await importBootstrapModule({ autoDispatchDomReady: false });
        expect(start).not.toHaveBeenCalled();

        document.dispatchEvent(new Event('DOMContentLoaded'));
        await flushPromises();
        expect(start).toHaveBeenCalledTimes(1);

        Object.defineProperty(document, 'readyState', {
            value: 'complete',
            configurable: true,
        });
    });
});
