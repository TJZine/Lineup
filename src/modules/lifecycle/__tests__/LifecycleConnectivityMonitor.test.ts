/**
 * @jest-environment jsdom
 */

import { LifecycleConnectivityMonitor } from '../LifecycleConnectivityMonitor';
import { NETWORK_CHECK_PROBE_URL, TIMING_CONFIG } from '../constants';

describe('LifecycleConnectivityMonitor', () => {
    let onNetworkChange: jest.Mock<(payload: { isAvailable: boolean }) => void>;
    let onNetworkWarning: jest.Mock<(payload: { message: string; isAvailable: boolean; timestamp: number }) => void>;
    let reportAsyncError: jest.Mock<(error: unknown, context: string) => void>;

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

    it('does not register duplicate online/offline listeners', () => {
        const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
        const monitor = createMonitor();

        monitor.setupListeners();
        monitor.setupListeners();

        expect(addEventListenerSpy.mock.calls.filter((call) => call[0] === 'online')).toHaveLength(1);
        expect(addEventListenerSpy.mock.calls.filter((call) => call[0] === 'offline')).toHaveLength(1);
    });

    it('emits network changes from browser connectivity events', () => {
        const monitor = createMonitor();
        monitor.setupListeners();

        window.dispatchEvent(new Event('offline'));
        window.dispatchEvent(new Event('online'));

        expect(onNetworkChange).toHaveBeenNthCalledWith(1, { isAvailable: false });
        expect(onNetworkChange).toHaveBeenNthCalledWith(2, { isAvailable: true });
    });

    it('emits browser connectivity events even when availability is unchanged', () => {
        const monitor = createMonitor();
        monitor.setInitialAvailability(false);
        monitor.setupListeners();

        window.dispatchEvent(new Event('offline'));
        window.dispatchEvent(new Event('offline'));

        expect(onNetworkChange).toHaveBeenNthCalledWith(1, { isAvailable: false });
        expect(onNetworkChange).toHaveBeenNthCalledWith(2, { isAvailable: false });

        monitor.setInitialAvailability(true);
        window.dispatchEvent(new Event('online'));
        window.dispatchEvent(new Event('online'));

        expect(onNetworkChange).toHaveBeenNthCalledWith(3, { isAvailable: true });
        expect(onNetworkChange).toHaveBeenNthCalledWith(4, { isAvailable: true });
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

    it('does not emit duplicate network changes for same-state successful probes', async () => {
        const originalFetch = globalThis.fetch;
        const fetchMock = jest.fn().mockResolvedValue({
            ok: false,
            type: 'opaque',
        });
        (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
        const monitor = createMonitor();
        monitor.setInitialAvailability(true);

        try {
            await expect(monitor.checkNetworkStatus()).resolves.toBe(true);
        } finally {
            globalThis.fetch = originalFetch;
        }

        expect(onNetworkChange).not.toHaveBeenCalled();
    });

    it('starts network monitoring only once until stopped', () => {
        const monitor = createMonitor();
        const checkSpy = jest.spyOn(monitor, 'checkNetworkStatus').mockResolvedValue(true);

        monitor.startMonitoring();
        monitor.startMonitoring();
        jest.advanceTimersByTime(TIMING_CONFIG.NETWORK_CHECK_INTERVAL_MS);
        monitor.stopMonitoring();
        jest.advanceTimersByTime(TIMING_CONFIG.NETWORK_CHECK_INTERVAL_MS);

        expect(checkSpy).toHaveBeenCalledTimes(1);
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
