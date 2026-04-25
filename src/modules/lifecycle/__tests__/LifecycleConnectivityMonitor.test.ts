/**
 * @jest-environment jsdom
 */

import { LifecycleConnectivityMonitor } from '../LifecycleConnectivityMonitor';
import { NETWORK_CHECK_PROBE_URL, TIMING_CONFIG } from '../constants';

describe('LifecycleConnectivityMonitor', () => {
    let onNetworkChange: jest.Mock<void, [{ isAvailable: boolean }]>;
    let onNetworkWarning: jest.Mock<void, [{ message: string; isAvailable: boolean; timestamp: number }]>;
    let reportAsyncError: jest.Mock<void, [unknown, string]>;

    beforeEach(() => {
        jest.useFakeTimers();
        onNetworkChange = jest.fn();
        onNetworkWarning = jest.fn();
        reportAsyncError = jest.fn();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    function createMonitor(): LifecycleConnectivityMonitor {
        return new LifecycleConnectivityMonitor({
            onNetworkChange,
            onNetworkWarning,
            reportAsyncError,
        });
    }

    it('registers and removes online/offline listeners', () => {
        const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
        const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
        const monitor = createMonitor();

        monitor.setupListeners();
        monitor.removeListeners();

        const onlineHandler = addEventListenerSpy.mock.calls.find((call) => call[0] === 'online')?.[1];
        const offlineHandler = addEventListenerSpy.mock.calls.find((call) => call[0] === 'offline')?.[1];

        expect(removeEventListenerSpy).toHaveBeenCalledWith('online', onlineHandler);
        expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', offlineHandler);
    });

    it('emits network changes from browser connectivity events', () => {
        const monitor = createMonitor();
        monitor.setupListeners();

        window.dispatchEvent(new Event('offline'));
        window.dispatchEvent(new Event('online'));

        expect(onNetworkChange).toHaveBeenNthCalledWith(1, { isAvailable: false });
        expect(onNetworkChange).toHaveBeenNthCalledWith(2, { isAvailable: true });
    });

    it('treats a resolved no-cors probe as available and clears the timeout', async () => {
        const originalFetch = globalThis.fetch;
        const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');
        const fetchMock = jest.fn().mockResolvedValue({
            ok: false,
            type: 'opaque',
        });
        (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
        const monitor = createMonitor();
        monitor.setInitialAvailability(false);

        try {
            await expect(monitor.checkNetworkStatus()).resolves.toBe(true);
        } finally {
            globalThis.fetch = originalFetch;
        }

        expect(fetchMock).toHaveBeenCalledWith(
            NETWORK_CHECK_PROBE_URL,
            expect.objectContaining({
                method: 'HEAD',
                mode: 'no-cors',
                signal: expect.any(AbortSignal),
            })
        );
        expect(onNetworkChange).toHaveBeenCalledWith({ isAvailable: true });
        expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('throttles network warnings after failed probes', async () => {
        const originalFetch = globalThis.fetch;
        const fetchMock = jest.fn().mockRejectedValue(new Error('offline'));
        (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
        const monitor = createMonitor();

        try {
            await monitor.checkNetworkStatus();
            await monitor.checkNetworkStatus();
            jest.advanceTimersByTime(TIMING_CONFIG.NETWORK_WARNING_BACKOFF_MS);
            await monitor.checkNetworkStatus();
        } finally {
            globalThis.fetch = originalFetch;
        }

        expect(onNetworkWarning).toHaveBeenCalledTimes(2);
    });
});
