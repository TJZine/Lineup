/**
 * @jest-environment jsdom
 * @fileoverview Unit tests for AppLifecycle.
 * @module modules/lifecycle/__tests__/AppLifecycle.test
 */

import { AppLifecycle } from '../AppLifecycle';
import { LifecycleStateStore } from '../LifecycleStateStore';
import { LifecycleErrorMessageCatalog } from '../LifecycleErrorMessageCatalog';
import { NETWORK_CHECK_PROBE_URL, TIMING_CONFIG } from '../constants';
import { AppErrorCode } from '../../../types/app-errors';
import { PersistentState } from '../types';
import type { IAppLifecycle } from '../interfaces';
import type { PlatformLifecycleService } from '../../../platform';
import { createDeferred, expectConsoleWarn } from '../../../__tests__/helpers';

describe('AppLifecycle', () => {
    let lifecycle: AppLifecycle;
    let mockLifecycleStateStore: jest.Mocked<LifecycleStateStore>;
    let mockErrorMessages: jest.Mocked<LifecycleErrorMessageCatalog>;
    let addEventListenerSpy: jest.SpyInstance;
    let removeEventListenerSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.useFakeTimers();
        // Mock LifecycleStateStore
        mockLifecycleStateStore = {
            save: jest.fn(),
            load: jest.fn().mockReturnValue(null),
            clear: jest.fn(),
            createDefaultState: jest.fn().mockReturnValue({
                version: 1,
                userPreferences: { theme: 'dark', volume: 100, subtitleLanguage: null, audioLanguage: null },
                lastUpdated: Date.now(),
            }),
        } as unknown as jest.Mocked<LifecycleStateStore>;

        mockErrorMessages = {
            getUserMessage: jest.fn().mockReturnValue('Error'),
        } as jest.Mocked<LifecycleErrorMessageCatalog>;

        // Spy on document event listeners
        addEventListenerSpy = jest.spyOn(document, 'addEventListener');
        removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

        // Mock navigator.onLine
        Object.defineProperty(navigator, 'onLine', {
            value: true,
            writable: true,
            configurable: true,
        });

        // Mock document.hidden
        Object.defineProperty(document, 'hidden', {
            value: false,
            writable: true,
            configurable: true,
        });

        // Mock performance.memory
        Object.defineProperty(performance, 'memory', {
            value: {
                usedJSHeapSize: 100 * 1024 * 1024,
                totalJSHeapSize: 200 * 1024 * 1024,
                jsHeapSizeLimit: 300 * 1024 * 1024,
            },
            writable: true,
            configurable: true,
        });

        lifecycle = new AppLifecycle(mockLifecycleStateStore, mockErrorMessages);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    describe('initialization', () => {
        it('should set phase to initializing then authenticating when no saved state', async () => {
            mockLifecycleStateStore.load.mockReturnValue(null);

            await lifecycle.initialize();

            expect(lifecycle.getPhase()).toBe('authenticating');
        });

        it('should restore state and set phase to authenticating when state exists', async () => {
            const savedState: PersistentState = {
                version: 1,
                userPreferences: { theme: 'dark', volume: 100, subtitleLanguage: null, audioLanguage: null },
                lastUpdated: Date.now(),
            };
            mockLifecycleStateStore.load.mockReturnValue(savedState);

            await lifecycle.initialize();

            expect(lifecycle.getPhase()).toBe('authenticating');
        });

        it('should emit stateRestored event with saved state', async () => {
            const savedState: PersistentState = {
                version: 1,
                userPreferences: { theme: 'dark', volume: 100, subtitleLanguage: null, audioLanguage: null },
                lastUpdated: Date.now(),
            };
            mockLifecycleStateStore.load.mockReturnValue(savedState);

            const handler = jest.fn();
            lifecycle.on('stateRestored', handler);

            await lifecycle.initialize();

            expect(handler).toHaveBeenCalledWith(savedState);
        });

        it('transitions to authenticating before stateRestored observers run', async () => {
            const savedState: PersistentState = {
                version: 1,
                userPreferences: { theme: 'dark', volume: 100, subtitleLanguage: null, audioLanguage: null },
                lastUpdated: Date.now(),
            };
            mockLifecycleStateStore.load.mockReturnValue(savedState);

            const eventOrder: string[] = [];
            lifecycle.on('phaseChange', ({ from, to }) => {
                eventOrder.push(`phase:${from}->${to}`);
            });
            lifecycle.on('stateRestored', () => {
                eventOrder.push(`restored:${lifecycle.getPhase()}`);
            });

            await lifecycle.initialize();

            expect(eventOrder).toEqual([
                'phase:initializing->authenticating',
                'restored:authenticating',
            ]);
        });

        it('should register visibility listeners', async () => {
            await lifecycle.initialize();

            expect(addEventListenerSpy).toHaveBeenCalledWith(
                'visibilitychange',
                expect.any(Function)
            );
        });

        it('should register webOSRelaunch listener', async () => {
            await lifecycle.initialize();

            expect(addEventListenerSpy).toHaveBeenCalledWith(
                'webOSRelaunch',
                expect.any(Function)
            );
        });
    });

    describe('shutdown', () => {
        it('should remove visibility listeners', async () => {
            await lifecycle.initialize();
            await lifecycle.shutdown();

            expect(removeEventListenerSpy).toHaveBeenCalledWith(
                'visibilitychange',
                expect.any(Function)
            );
        });

        it('should set phase to terminating', async () => {
            await lifecycle.initialize();
            // Follow valid transition path: authenticating -> loading_data -> ready
            await lifecycle.setPhaseAndWait('loading_data');
            await lifecycle.setPhaseAndWait('ready');
            await lifecycle.shutdown();

            expect(lifecycle.getPhase()).toBe('terminating');
        });

        it('should emit beforeTerminate event', async () => {
            await lifecycle.initialize();
            // Follow valid transition path: authenticating -> loading_data -> ready
            await lifecycle.setPhaseAndWait('loading_data');
            await lifecycle.setPhaseAndWait('ready');

            const handler = jest.fn();
            lifecycle.on('beforeTerminate', handler);

            await lifecycle.shutdown();

            expect(handler).toHaveBeenCalled();
        });

        it('should allow removing terminate callbacks via disposable subscription', async () => {
            await lifecycle.initialize();
            await lifecycle.setPhaseAndWait('loading_data');
            await lifecycle.setPhaseAndWait('ready');

            const terminateCallback = jest.fn();
            const subscription = lifecycle.onTerminate(terminateCallback) as unknown as { dispose?: () => void };
            expect(typeof subscription?.dispose).toBe('function');
            subscription.dispose?.();

            await lifecycle.shutdown();

            expect(terminateCallback).not.toHaveBeenCalled();
        });

        it('does not break callback iteration when a callback disposes another callback during shutdown', async () => {
            await lifecycle.initialize();
            await lifecycle.setPhaseAndWait('loading_data');
            await lifecycle.setPhaseAndWait('ready');

            let secondSubscription: { dispose?: () => void } | null = null;
            const firstCallback = jest.fn(() => {
                secondSubscription?.dispose?.();
            });
            lifecycle.onTerminate(firstCallback);

            const secondCallback = jest.fn();
            secondSubscription = lifecycle.onTerminate(secondCallback) as unknown as { dispose?: () => void };

            await lifecycle.shutdown();

            expect(firstCallback).toHaveBeenCalled();
            expect(secondCallback).not.toHaveBeenCalled();
        });

        it('logs final pending-save flush failures during shutdown', async () => {
            const saveError = new DOMException('Quota exceeded', 'QuotaExceededError');
            let savePromise: Promise<void> | null = null;
            mockLifecycleStateStore.save.mockImplementation(() => {
                throw saveError;
            });
            await lifecycle.initialize();
            lifecycle.onTerminate(() => {
                savePromise = lifecycle.saveState();
            });
            expectConsoleWarn([
                'Final shutdown flush failed',
                expect.objectContaining({
                    subsystem: 'lifecycle',
                    error: expect.objectContaining({
                        name: 'QuotaExceededError',
                        message: 'Quota exceeded',
                    }),
                }),
            ]);

            await lifecycle.shutdown();

            if (savePromise === null) {
                throw new Error('Expected terminate callback to enqueue saveState');
            }
            await expect(savePromise).rejects.toBe(saveError);
        });

        it('keeps relaunch add/remove symmetry and removes the exact same handler', async () => {
            const lifecycleService: PlatformLifecycleService = {
                bindRelaunch: jest.fn((handler: (event: Event) => void) => {
                    document.addEventListener('webOSRelaunch', handler);
                    return () => {
                        document.removeEventListener('webOSRelaunch', handler);
                    };
                }),
            };
            const lifecycleWithService = new AppLifecycle(
                mockLifecycleStateStore,
                mockErrorMessages,
                lifecycleService
            );

            await lifecycleWithService.initialize();
            await lifecycleWithService.shutdown();

            const added = addEventListenerSpy.mock.calls.find(
                (call) => call[0] === 'webOSRelaunch'
            )?.[1];
            const removed = removeEventListenerSpy.mock.calls.find(
                (call) => call[0] === 'webOSRelaunch'
            )?.[1];

            expect(lifecycleService.bindRelaunch).toHaveBeenCalledTimes(1);
            expect(added).toBeDefined();
            expect(removed).toBe(added);
        });
    });

    describe('persistence', () => {
        it('should save state to localStorage', async () => {
            jest.useFakeTimers();
            await lifecycle.initialize();

            const savePromise = lifecycle.saveState();
            jest.advanceTimersByTime(TIMING_CONFIG.SAVE_DEBOUNCE_MS);

            await savePromise;

            expect(mockLifecycleStateStore.save).toHaveBeenCalled();
        });

        it('keeps saveState pending until the debounced flush persists state', async () => {
            await lifecycle.initialize();

            let settled = false;
            const savePromise = lifecycle.saveState().finally(() => {
                settled = true;
            });

            expect(settled).toBe(false);

            jest.advanceTimersByTime(TIMING_CONFIG.SAVE_DEBOUNCE_MS - 1);
            expect(settled).toBe(false);

            jest.advanceTimersByTime(1);
            await savePromise;

            expect(mockLifecycleStateStore.save).toHaveBeenCalledTimes(1);
            expect(settled).toBe(true);
        });

        it('rejects saveState when the debounced persistence flush fails', async () => {
            const saveError = new DOMException('Quota exceeded', 'QuotaExceededError');
            mockLifecycleStateStore.save.mockImplementation(() => {
                throw saveError;
            });
            await lifecycle.initialize();

            const savePromise = lifecycle.saveState();
            jest.advanceTimersByTime(TIMING_CONFIG.SAVE_DEBOUNCE_MS);

            await expect(savePromise).rejects.toBe(saveError);
        });

        it('rejects saveState with the persistence error even when warning observers throw', async () => {
            const saveError = new DOMException('Quota exceeded', 'QuotaExceededError');
            mockLifecycleStateStore.save.mockImplementation(() => {
                throw saveError;
            });
            await lifecycle.initialize();
            expectConsoleWarn([
                "[EventEmitter] Handler error for event 'persistenceWarning':",
                expect.objectContaining({
                    message: 'observer failed',
                }),
            ]);
            lifecycle.on('persistenceWarning', () => {
                throw new Error('observer failed');
            });

            const savePromise = lifecycle.saveState();
            jest.advanceTimersByTime(TIMING_CONFIG.SAVE_DEBOUNCE_MS);

            await expect(savePromise).rejects.toBe(saveError);
        });

        it('keeps non-final phase transitions moving when a flush fails', async () => {
            const saveError = new DOMException('Quota exceeded', 'QuotaExceededError');
            const persistenceWarning = jest.fn();
            mockLifecycleStateStore.save.mockImplementation(() => {
                throw saveError;
            });
            await lifecycle.initialize();
            lifecycle.on('persistenceWarning', persistenceWarning);

            const savePromise = lifecycle.saveState();

            await expect(lifecycle.setPhaseAndWait('loading_data')).resolves.toBe(true);
            await expect(savePromise).rejects.toBe(saveError);

            expect(lifecycle.getPhase()).toBe('loading_data');
            expect(persistenceWarning).toHaveBeenCalledWith(
                expect.objectContaining({
                    isQuotaError: true,
                    message: 'Persistent storage quota exceeded; save deferred',
                })
            );
        });

        it('exposes the narrowed lifecycle public seam', () => {
            const lifecyclePublicSurface: Pick<
                IAppLifecycle,
                'saveState' | 'getPhase' | 'setPhase' | 'setPhaseAndWait' | 'waitForPendingTransition' | 'on'
            > = lifecycle;

            expect(typeof lifecyclePublicSurface.saveState).toBe('function');
            expect(typeof lifecyclePublicSurface.getPhase).toBe('function');
            expect(typeof lifecyclePublicSurface.setPhase).toBe('function');
            expect(typeof lifecyclePublicSurface.setPhaseAndWait).toBe('function');
            expect(typeof lifecyclePublicSurface.waitForPendingTransition).toBe('function');
            expect(typeof lifecyclePublicSurface.on).toBe('function');
        });

        it('exposes getErrorUserMessage and does not expose its message catalog', () => {
            const lifecycleWithErrorMessage = lifecycle as unknown as {
                getErrorUserMessage?: (code: AppErrorCode) => string;
                getErrorMessageCatalog?: unknown;
            };

            expect(typeof lifecycleWithErrorMessage.getErrorUserMessage).toBe('function');
            expect('getErrorMessageCatalog' in lifecycleWithErrorMessage).toBe(false);
        });
    });

    describe('visibility', () => {
        it('removes duplicate pause subscriptions independently via the public pause lifecycle', async () => {
            await lifecycle.initialize();
            await lifecycle.setPhaseAndWait('loading_data');
            await lifecycle.setPhaseAndWait('ready');

            const pauseCallback = jest.fn();
            const first = lifecycle.onPause(pauseCallback) as unknown as { dispose?: () => void };
            const second = lifecycle.onPause(pauseCallback) as unknown as { dispose?: () => void };

            second.dispose?.();

            Object.defineProperty(document, 'hidden', { value: true, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
            await lifecycle.waitForPendingTransition();

            expect(pauseCallback).toHaveBeenCalledTimes(1);

            first.dispose?.();

            Object.defineProperty(document, 'hidden', { value: false, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
            await lifecycle.waitForPendingTransition();

            Object.defineProperty(document, 'hidden', { value: true, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
            await lifecycle.waitForPendingTransition();

            expect(pauseCallback).toHaveBeenCalledTimes(1);
        });

        it('should call pause callbacks when hidden', async () => {
            await lifecycle.initialize();
            // Follow valid transition path: authenticating -> loading_data -> ready
            await lifecycle.setPhaseAndWait('loading_data');
            await lifecycle.setPhaseAndWait('ready');

            const pauseCallback = jest.fn();
            lifecycle.onPause(pauseCallback);

            // Simulate visibility change to hidden
            Object.defineProperty(document, 'hidden', { value: true, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));

            await lifecycle.waitForPendingTransition();

            expect(pauseCallback).toHaveBeenCalled();
        });

        it('should allow removing pause callbacks via disposable subscription', async () => {
            await lifecycle.initialize();
            // Follow valid transition path: authenticating -> loading_data -> ready
            await lifecycle.setPhaseAndWait('loading_data');
            await lifecycle.setPhaseAndWait('ready');

            const pauseCallback = jest.fn();
            const subscription = lifecycle.onPause(pauseCallback) as unknown as { dispose?: () => void };
            expect(typeof subscription?.dispose).toBe('function');
            subscription.dispose?.();

            // Simulate visibility change to hidden
            Object.defineProperty(document, 'hidden', { value: true, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));

            await lifecycle.waitForPendingTransition();

            expect(pauseCallback).not.toHaveBeenCalled();
        });

        it('should call resume callbacks when visible', async () => {
            await lifecycle.initialize();
            // Follow valid transition path: authenticating -> loading_data -> ready
            await lifecycle.setPhaseAndWait('loading_data');
            await lifecycle.setPhaseAndWait('ready');

            const resumeCallback = jest.fn();
            lifecycle.onResume(resumeCallback);

            // First hide
            Object.defineProperty(document, 'hidden', { value: true, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
            await lifecycle.waitForPendingTransition();

            // Then show
            Object.defineProperty(document, 'hidden', { value: false, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
            await lifecycle.waitForPendingTransition();

            expect(resumeCallback).toHaveBeenCalled();
        });

        it('should allow removing resume callbacks via disposable subscription', async () => {
            await lifecycle.initialize();
            // Follow valid transition path: authenticating -> loading_data -> ready
            await lifecycle.setPhaseAndWait('loading_data');
            await lifecycle.setPhaseAndWait('ready');

            const resumeCallback = jest.fn();
            const subscription = lifecycle.onResume(resumeCallback) as unknown as { dispose?: () => void };
            expect(typeof subscription?.dispose).toBe('function');
            subscription.dispose?.();

            // First hide
            Object.defineProperty(document, 'hidden', { value: true, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
            await lifecycle.waitForPendingTransition();

            // Then show
            Object.defineProperty(document, 'hidden', { value: false, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
            await lifecycle.waitForPendingTransition();

            expect(resumeCallback).not.toHaveBeenCalled();
        });

        it('should emit visibilityChange event', async () => {
            await lifecycle.initialize();
            // Follow valid transition path: authenticating -> loading_data -> ready
            await lifecycle.setPhaseAndWait('loading_data');
            await lifecycle.setPhaseAndWait('ready');

            const handler = jest.fn();
            lifecycle.on('visibilityChange', handler);

            Object.defineProperty(document, 'hidden', { value: true, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
            await lifecycle.waitForPendingTransition();

            expect(handler).toHaveBeenCalledWith({ isVisible: false });
        });

        it('should set phase to backgrounded when ready and hidden', async () => {
            await lifecycle.initialize();
            // Follow valid transition path: authenticating -> loading_data -> ready
            await lifecycle.setPhaseAndWait('loading_data');
            await lifecycle.setPhaseAndWait('ready');

            Object.defineProperty(document, 'hidden', { value: true, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
            await lifecycle.waitForPendingTransition();

            expect(lifecycle.getPhase()).toBe('backgrounded');
        });

        it('keeps pause callbacks and backgrounding alive when a flush fails', async () => {
            const saveError = new DOMException('Quota exceeded', 'QuotaExceededError');
            const pauseCallback = jest.fn();
            const persistenceWarning = jest.fn();
            mockLifecycleStateStore.save.mockImplementation(() => {
                throw saveError;
            });
            await lifecycle.initialize();
            await lifecycle.setPhaseAndWait('loading_data');
            await lifecycle.setPhaseAndWait('ready');
            lifecycle.on('persistenceWarning', persistenceWarning);
            lifecycle.onPause(pauseCallback);

            const savePromise = lifecycle.saveState();

            Object.defineProperty(document, 'hidden', { value: true, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
            await lifecycle.waitForPendingTransition();

            await expect(savePromise).rejects.toBe(saveError);
            expect(pauseCallback).toHaveBeenCalledTimes(1);
            expect(persistenceWarning).toHaveBeenCalledWith(
                expect.objectContaining({
                    isQuotaError: true,
                    message: 'Persistent storage quota exceeded; save deferred',
                })
            );
            expect(lifecycle.getPhase()).toBe('backgrounded');
        });

        it('waits for an earlier visibility transition even when a later transition settles first', async () => {
            await lifecycle.initialize();
            await lifecycle.setPhaseAndWait('loading_data');
            await lifecycle.setPhaseAndWait('ready');
            const pauseDeferred = createDeferred<void>();
            lifecycle.onPause(() => pauseDeferred.promise);
            let waitSettled = false;

            Object.defineProperty(document, 'hidden', { value: true, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));

            Object.defineProperty(document, 'hidden', { value: false, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));

            const wait = lifecycle.waitForPendingTransition().then(() => {
                waitSettled = true;
            });

            await Promise.resolve();
            expect(waitSettled).toBe(false);

            pauseDeferred.resolve();
            await wait;
            expect(waitSettled).toBe(true);
            expect(lifecycle.getPhase()).toBe('ready');
            expect(lifecycle.getState().isVisible).toBe(true);
        });

        it('does not leave the app backgrounded when visibility resumes before a slow pause settles', async () => {
            await lifecycle.initialize();
            await lifecycle.setPhaseAndWait('loading_data');
            await lifecycle.setPhaseAndWait('ready');
            const pauseDeferred = createDeferred<void>();
            lifecycle.onPause(() => pauseDeferred.promise);

            Object.defineProperty(document, 'hidden', { value: true, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));

            Object.defineProperty(document, 'hidden', { value: false, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));

            pauseDeferred.resolve();
            await lifecycle.waitForPendingTransition();

            expect(lifecycle.getState().isVisible).toBe(true);
            expect(lifecycle.getPhase()).toBe('ready');
        });
    });

    describe('error handling', () => {
        it('should store reported error', async () => {
            await lifecycle.initialize();

            const error = {
                code: AppErrorCode.NETWORK_UNAVAILABLE,
                message: 'No network',
                recoverable: true,
            };

            lifecycle.reportError(error);

            expect(lifecycle.getLastError()).toEqual(error);
        });

        it('should set phase to error on reportError', async () => {
            await lifecycle.initialize();
            // Follow valid transition path: authenticating -> loading_data -> ready
            await lifecycle.setPhaseAndWait('loading_data');
            await lifecycle.setPhaseAndWait('ready');

            lifecycle.reportError({
                code: AppErrorCode.AUTH_EXPIRED,
                message: 'Session expired',
                recoverable: true,
            });
            await lifecycle.waitForPendingTransition();

            expect(lifecycle.getPhase()).toBe('error');
        });

        it('should emit error event with lifecycle context', async () => {
            await lifecycle.initialize();

            const handler = jest.fn();
            lifecycle.on('error', handler);

            lifecycle.reportError({
                code: AppErrorCode.NETWORK_TIMEOUT,
                message: 'Timeout',
                recoverable: true,
            });

            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: AppErrorCode.NETWORK_TIMEOUT,
                    phase: expect.any(String),
                    timestamp: expect.any(Number),
                })
            );
        });
    });

    describe('network monitoring', () => {
        it('should detect online status', async () => {
            Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
            await lifecycle.initialize();

            expect(lifecycle.isNetworkAvailable()).toBe(true);
        });

        it('checkNetworkStatus should treat resolved no-cors fetch as available', async () => {
            const originalFetch = globalThis.fetch;
            const fetchMock = jest.fn().mockResolvedValue({
                ok: false,
                type: 'opaque',
            });
            try {
                (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

                await lifecycle.initialize();

                const result = await lifecycle.checkNetworkStatus();
                expect(result).toBe(true);
                expect(lifecycle.isNetworkAvailable()).toBe(true);
                expect(fetchMock).toHaveBeenCalledWith(
                    NETWORK_CHECK_PROBE_URL,
                    expect.objectContaining({
                        method: 'HEAD',
                        mode: 'no-cors',
                        signal: expect.any(AbortSignal),
                    })
                );
            } finally {
                globalThis.fetch = originalFetch;
            }
        });

        it('should detect offline status', async () => {
            Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
            await lifecycle.initialize();

            expect(lifecycle.isNetworkAvailable()).toBe(false);
        });

        it('should emit networkChange on connectivity change', async () => {
            await lifecycle.initialize();

            const handler = jest.fn();
            lifecycle.on('networkChange', handler);

            window.dispatchEvent(new Event('offline'));

            expect(handler).toHaveBeenCalledWith({ isAvailable: false });
        });
    });

    describe('memory monitoring', () => {
        it('should return memory usage when API available', async () => {
            await lifecycle.initialize();

            const usage = lifecycle.getMemoryUsage();

            expect(usage.used).toBeGreaterThan(0);
            expect(usage.limit).toBeGreaterThan(0);
            expect(usage.percentage).toBeGreaterThanOrEqual(0);
        });

        it('should emit clearCaches when cleanup performed', async () => {
            await lifecycle.initialize();

            const handler = jest.fn();
            lifecycle.on('clearCaches', handler);

            lifecycle.performMemoryCleanup();

            expect(handler).toHaveBeenCalled();
        });
    });

    describe('phase management', () => {
        it('should emit phaseChange event on phase transition', async () => {
            await lifecycle.initialize();
            // Follow valid transition path: authenticating -> loading_data
            const handler = jest.fn();
            lifecycle.on('phaseChange', handler);

            await lifecycle.setPhaseAndWait('loading_data');

            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: 'authenticating',
                    to: 'loading_data',
                })
            );
        });

        it('should not emit if phase unchanged', async () => {
            await lifecycle.initialize();
            // Follow valid transition path: authenticating -> loading_data
            await lifecycle.setPhaseAndWait('loading_data');
            expectConsoleWarn('Invalid phase transition');

            const handler = jest.fn();
            lifecycle.on('phaseChange', handler);

            await lifecycle.setPhaseAndWait('loading_data');

            expect(handler).not.toHaveBeenCalled();
        });

        it('should return correct state object', async () => {
            await lifecycle.initialize();
            // Follow valid transition path: authenticating -> loading_data -> ready
            await lifecycle.setPhaseAndWait('loading_data');
            await lifecycle.setPhaseAndWait('ready');

            const state = lifecycle.getState();

            expect(state.phase).toBe('ready');
            expect(typeof state.isVisible).toBe('boolean');
            expect(typeof state.isNetworkAvailable).toBe('boolean');
            expect(typeof state.lastActiveTime).toBe('number');
        });

        // ========================================
        // LIFE-003: Invalid Phase Transitions
        // ========================================

        it('should reject invalid phase transition from authenticating to ready', async () => {
            await lifecycle.initialize();
            // Should be in 'authenticating' phase
            expect(lifecycle.getPhase()).toBe('authenticating');

            expectConsoleWarn('Invalid phase transition');

            // Try to jump directly to 'ready' (invalid: should go through loading_data)
            await lifecycle.setPhaseAndWait('ready');

            // Phase should NOT have changed
            expect(lifecycle.getPhase()).toBe('authenticating');
        });

        it('should reject invalid phase transition from ready to authenticating', async () => {
            await lifecycle.initialize();
            // Progress through valid transitions to reach 'ready'
            await lifecycle.setPhaseAndWait('loading_data');
            await lifecycle.setPhaseAndWait('ready');

            expect(lifecycle.getPhase()).toBe('ready');

            expectConsoleWarn('Invalid phase transition');

            // Try to go back to 'authenticating' (invalid transition)
            await lifecycle.setPhaseAndWait('authenticating');

            // Phase should NOT have changed
            expect(lifecycle.getPhase()).toBe('ready');
        });

        it('should reject transition from loading_data to authenticating', async () => {
            await lifecycle.initialize();
            await lifecycle.setPhaseAndWait('loading_data');

            expect(lifecycle.getPhase()).toBe('loading_data');

            expectConsoleWarn('Invalid phase transition');

            // Try invalid backward transition
            await lifecycle.setPhaseAndWait('authenticating');

            expect(lifecycle.getPhase()).toBe('loading_data');
        });
    });
});
