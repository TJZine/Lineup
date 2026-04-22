/**
 * @jest-environment jsdom
 * @fileoverview Unit tests for AppLifecycle.
 * @module modules/lifecycle/__tests__/AppLifecycle.test
 */

import { AppLifecycle } from '../AppLifecycle';
import { StateManager } from '../StateManager';
import { ErrorRecovery } from '../ErrorRecovery';
import { NETWORK_CHECK_PROBE_URL } from '../constants';
import { AppErrorCode, PersistentState } from '../types';
import type { IAppLifecycle } from '../interfaces';
import type { PlatformLifecycleService } from '../../../platform';
import { expectConsoleWarn, flushPromisesAndTimers } from '../../../__tests__/helpers';

describe('AppLifecycle', () => {
    let lifecycle: AppLifecycle;
    let mockStateManager: jest.Mocked<StateManager>;
    let mockErrorRecovery: jest.Mocked<ErrorRecovery>;
    let addEventListenerSpy: jest.SpyInstance;
    let removeEventListenerSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.useFakeTimers();
        // Mock StateManager
        mockStateManager = {
            save: jest.fn(),
            load: jest.fn().mockReturnValue(null),
            clear: jest.fn(),
            createDefaultState: jest.fn().mockReturnValue({
                version: 1,
                userPreferences: { theme: 'dark', volume: 100, subtitleLanguage: null, audioLanguage: null },
                lastUpdated: Date.now(),
            }),
        } as unknown as jest.Mocked<StateManager>;

        // Mock ErrorRecovery
        mockErrorRecovery = {
            handleError: jest.fn().mockReturnValue([]),
            executeRecovery: jest.fn().mockResolvedValue(true),
            createError: jest.fn().mockImplementation((code, message, context) => ({
                code,
                message,
                recoverable: true,
                context,
            })),
            registerCallbacks: jest.fn(),
            getUserMessage: jest.fn().mockReturnValue('Error'),
        } as unknown as jest.Mocked<ErrorRecovery>;

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

        lifecycle = new AppLifecycle(mockStateManager, mockErrorRecovery);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    describe('initialization', () => {
        it('should set phase to initializing then authenticating when no saved state', async () => {
            mockStateManager.load.mockReturnValue(null);

            await lifecycle.initialize();

            expect(lifecycle.getPhase()).toBe('authenticating');
        });

        it('should restore state and set phase to authenticating when state exists', async () => {
            const savedState: PersistentState = {
                version: 1,
                userPreferences: { theme: 'dark', volume: 100, subtitleLanguage: null, audioLanguage: null },
                lastUpdated: Date.now(),
            };
            mockStateManager.load.mockReturnValue(savedState);

            await lifecycle.initialize();

            expect(lifecycle.getPhase()).toBe('authenticating');
        });

        it('should emit stateRestored event with saved state', async () => {
            const savedState: PersistentState = {
                version: 1,
                userPreferences: { theme: 'dark', volume: 100, subtitleLanguage: null, audioLanguage: null },
                lastUpdated: Date.now(),
            };
            mockStateManager.load.mockReturnValue(savedState);

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
            mockStateManager.load.mockReturnValue(savedState);

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
            lifecycle.setPhase('loading_data');
            await Promise.resolve();
            lifecycle.setPhase('ready');
            await Promise.resolve();
            await lifecycle.shutdown();

            expect(lifecycle.getPhase()).toBe('terminating');
        });

        it('should emit beforeTerminate event', async () => {
            await lifecycle.initialize();
            // Follow valid transition path: authenticating -> loading_data -> ready
            lifecycle.setPhase('loading_data');
            await Promise.resolve();
            lifecycle.setPhase('ready');
            await Promise.resolve();

            const handler = jest.fn();
            lifecycle.on('beforeTerminate', handler);

            await lifecycle.shutdown();

            expect(handler).toHaveBeenCalled();
        });

        it('should allow removing terminate callbacks via disposable subscription', async () => {
            await lifecycle.initialize();
            lifecycle.setPhase('loading_data');
            await Promise.resolve();
            lifecycle.setPhase('ready');
            await Promise.resolve();

            const terminateCallback = jest.fn();
            const subscription = lifecycle.onTerminate(terminateCallback) as unknown as { dispose?: () => void };
            expect(typeof subscription?.dispose).toBe('function');
            subscription.dispose?.();

            await lifecycle.shutdown();

            expect(terminateCallback).not.toHaveBeenCalled();
        });

        it('does not break callback iteration when a callback disposes another callback during shutdown', async () => {
            await lifecycle.initialize();
            lifecycle.setPhase('loading_data');
            await Promise.resolve();
            lifecycle.setPhase('ready');
            await Promise.resolve();

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
                mockStateManager,
                mockErrorRecovery,
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

            await lifecycle.saveState();
            jest.advanceTimersByTime(600); // Past debounce time

            // Wait for async operations
            await Promise.resolve();

            expect(mockStateManager.save).toHaveBeenCalled();
        });

        it('exposes the narrowed lifecycle public seam', () => {
            const lifecyclePublicSurface: Pick<IAppLifecycle, 'saveState' | 'getPhase' | 'setPhase' | 'on'> = lifecycle;

            expect(typeof lifecyclePublicSurface.saveState).toBe('function');
            expect(typeof lifecyclePublicSurface.getPhase).toBe('function');
            expect(typeof lifecyclePublicSurface.setPhase).toBe('function');
            expect(typeof lifecyclePublicSurface.on).toBe('function');
        });

        it('exposes getErrorUserMessage and does not expose getErrorRecovery', () => {
            const lifecycleWithErrorMessage = lifecycle as unknown as {
                getErrorUserMessage?: (code: AppErrorCode) => string;
                getErrorRecovery?: unknown;
            };

            expect(typeof lifecycleWithErrorMessage.getErrorUserMessage).toBe('function');
            expect('getErrorRecovery' in lifecycleWithErrorMessage).toBe(false);
        });
    });

    describe('visibility', () => {
        it('removes the exact lifecycle subscription instance on dispose', () => {
            const pauseCallback = jest.fn();
            const first = lifecycle.onPause(pauseCallback) as unknown as { dispose?: () => void };
            const second = lifecycle.onPause(pauseCallback) as unknown as { dispose?: () => void };

            const callbacks = (lifecycle as unknown as { _pauseCallbacks: Array<() => unknown> })._pauseCallbacks;
            expect(callbacks).toHaveLength(2);
            expect(callbacks[0]).not.toBe(callbacks[1]);

            const firstWrapped = callbacks[0];
            const secondWrapped = callbacks[1];

            second.dispose?.();
            expect(callbacks).toHaveLength(1);
            expect(callbacks[0]).toBe(firstWrapped);
            expect(callbacks).not.toContain(secondWrapped);

            first.dispose?.();
            expect(callbacks).toHaveLength(0);
        });

        it('should call pause callbacks when hidden', async () => {
            await lifecycle.initialize();
            // Follow valid transition path: authenticating -> loading_data -> ready
            lifecycle.setPhase('loading_data');
            await flushPromisesAndTimers();
            lifecycle.setPhase('ready');
            await flushPromisesAndTimers();

            const pauseCallback = jest.fn();
            lifecycle.onPause(pauseCallback);

            // Simulate visibility change to hidden
            Object.defineProperty(document, 'hidden', { value: true, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));

            // Wait for async callbacks
            await flushPromisesAndTimers();

            expect(pauseCallback).toHaveBeenCalled();
        });

        it('should allow removing pause callbacks via disposable subscription', async () => {
            await lifecycle.initialize();
            // Follow valid transition path: authenticating -> loading_data -> ready
            lifecycle.setPhase('loading_data');
            await flushPromisesAndTimers();
            lifecycle.setPhase('ready');
            await flushPromisesAndTimers();

            const pauseCallback = jest.fn();
            const subscription = lifecycle.onPause(pauseCallback) as unknown as { dispose?: () => void };
            expect(typeof subscription?.dispose).toBe('function');
            subscription.dispose?.();

            // Simulate visibility change to hidden
            Object.defineProperty(document, 'hidden', { value: true, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));

            // Wait for async callbacks
            await flushPromisesAndTimers();

            expect(pauseCallback).not.toHaveBeenCalled();
        });

        it('should call resume callbacks when visible', async () => {
            await lifecycle.initialize();
            // Follow valid transition path: authenticating -> loading_data -> ready
            lifecycle.setPhase('loading_data');
            await flushPromisesAndTimers();
            lifecycle.setPhase('ready');
            await flushPromisesAndTimers();

            const resumeCallback = jest.fn();
            lifecycle.onResume(resumeCallback);

            // First hide
            Object.defineProperty(document, 'hidden', { value: true, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
            await flushPromisesAndTimers();

            // Then show
            Object.defineProperty(document, 'hidden', { value: false, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
            await flushPromisesAndTimers();

            expect(resumeCallback).toHaveBeenCalled();
        });

        it('should allow removing resume callbacks via disposable subscription', async () => {
            await lifecycle.initialize();
            // Follow valid transition path: authenticating -> loading_data -> ready
            lifecycle.setPhase('loading_data');
            await flushPromisesAndTimers();
            lifecycle.setPhase('ready');
            await flushPromisesAndTimers();

            const resumeCallback = jest.fn();
            const subscription = lifecycle.onResume(resumeCallback) as unknown as { dispose?: () => void };
            expect(typeof subscription?.dispose).toBe('function');
            subscription.dispose?.();

            // First hide
            Object.defineProperty(document, 'hidden', { value: true, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
            await flushPromisesAndTimers();

            // Then show
            Object.defineProperty(document, 'hidden', { value: false, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));
            await flushPromisesAndTimers();

            expect(resumeCallback).not.toHaveBeenCalled();
        });

        it('should emit visibilityChange event', async () => {
            await lifecycle.initialize();
            // Follow valid transition path: authenticating -> loading_data -> ready
            lifecycle.setPhase('loading_data');
            await flushPromisesAndTimers();
            lifecycle.setPhase('ready');
            await flushPromisesAndTimers();

            const handler = jest.fn();
            lifecycle.on('visibilityChange', handler);

            Object.defineProperty(document, 'hidden', { value: true, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));

            await flushPromisesAndTimers();

            expect(handler).toHaveBeenCalledWith({ isVisible: false });
        });

        it('should set phase to backgrounded when ready and hidden', async () => {
            await lifecycle.initialize();
            // Follow valid transition path: authenticating -> loading_data -> ready
            lifecycle.setPhase('loading_data');
            await flushPromisesAndTimers();
            lifecycle.setPhase('ready');
            await flushPromisesAndTimers();

            Object.defineProperty(document, 'hidden', { value: true, configurable: true });
            document.dispatchEvent(new Event('visibilitychange'));

            await flushPromisesAndTimers();

            expect(lifecycle.getPhase()).toBe('backgrounded');
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
            lifecycle.setPhase('loading_data');
            await flushPromisesAndTimers();
            lifecycle.setPhase('ready');
            await flushPromisesAndTimers();

            lifecycle.reportError({
                code: AppErrorCode.AUTH_EXPIRED,
                message: 'Session expired',
                recoverable: true,
            });
            await flushPromisesAndTimers();

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

            lifecycle.setPhase('loading_data');
            await flushPromisesAndTimers();

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
            lifecycle.setPhase('loading_data');
            await flushPromisesAndTimers();
            expectConsoleWarn('Invalid phase transition');

            const handler = jest.fn();
            lifecycle.on('phaseChange', handler);

            lifecycle.setPhase('loading_data');
            await flushPromisesAndTimers();

            expect(handler).not.toHaveBeenCalled();
        });

        it('should return correct state object', async () => {
            await lifecycle.initialize();
            // Follow valid transition path: authenticating -> loading_data -> ready
            lifecycle.setPhase('loading_data');
            await flushPromisesAndTimers();
            lifecycle.setPhase('ready');
            await flushPromisesAndTimers();

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
            lifecycle.setPhase('ready');
            await flushPromisesAndTimers();

            // Phase should NOT have changed
            expect(lifecycle.getPhase()).toBe('authenticating');
        });

        it('should reject invalid phase transition from ready to authenticating', async () => {
            await lifecycle.initialize();
            // Progress through valid transitions to reach 'ready'
            lifecycle.setPhase('loading_data');
            await flushPromisesAndTimers();
            lifecycle.setPhase('ready');
            await flushPromisesAndTimers();

            expect(lifecycle.getPhase()).toBe('ready');

            expectConsoleWarn('Invalid phase transition');

            // Try to go back to 'authenticating' (invalid transition)
            lifecycle.setPhase('authenticating');
            await Promise.resolve();

            // Phase should NOT have changed
            expect(lifecycle.getPhase()).toBe('ready');
        });

        it('should reject transition from loading_data to authenticating', async () => {
            await lifecycle.initialize();
            lifecycle.setPhase('loading_data');
            await Promise.resolve();

            expect(lifecycle.getPhase()).toBe('loading_data');

            expectConsoleWarn('Invalid phase transition');

            // Try invalid backward transition
            lifecycle.setPhase('authenticating');
            await Promise.resolve();

            expect(lifecycle.getPhase()).toBe('loading_data');
        });
    });
});
