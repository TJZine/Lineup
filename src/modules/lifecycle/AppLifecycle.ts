import { IAppLifecycle } from './interfaces';
import {
    AppPhase,
    AppError,
    PersistentState,
    AppLifecycleState,
    MemoryUsage,
    LifecycleEventMap,
    LifecycleCallback,
    LifecycleAppError,
    AppErrorCode,
} from './types';
import { StateManager } from './StateManager';
import { ErrorRecovery } from './ErrorRecovery';
import { LifecycleConnectivityMonitor } from './LifecycleConnectivityMonitor';
import { LifecycleMemoryMonitor } from './LifecycleMemoryMonitor';
import { LifecycleStatePersistenceQueue } from './LifecycleStatePersistenceQueue';
import { LifecycleAsyncErrorReporter } from './LifecycleAsyncErrorReporter';
import { EventEmitter } from '../../utils/EventEmitter';
import type { IDisposable } from '../../utils/interfaces';
import {
    TIMING_CONFIG,
    VALID_PHASE_TRANSITIONS,
} from './constants';
import type { PlatformLifecycleService } from '../../platform';
import { createWebOsPlatformServices } from '../../platform';

export class AppLifecycle implements IAppLifecycle {
    private readonly _emitter: EventEmitter<LifecycleEventMap>;
    private readonly _stateManager: StateManager;
    private readonly _errorRecovery: ErrorRecovery;
    private readonly _statePersistenceQueue: LifecycleStatePersistenceQueue;
    private readonly _connectivityMonitor: LifecycleConnectivityMonitor;
    private readonly _memoryMonitor: LifecycleMemoryMonitor;
    private readonly _asyncErrorReporter: LifecycleAsyncErrorReporter;

    private _phase: AppPhase = 'initializing';
    private _isVisible: boolean = true;
    private _isNetworkAvailable: boolean = true;
    private _lastActiveTime: number = Date.now();
    private _lastError: AppError | null = null;

    private readonly _pauseCallbacks: LifecycleCallback[] = [];
    private readonly _resumeCallbacks: LifecycleCallback[] = [];
    private readonly _terminateCallbacks: LifecycleCallback[] = [];

    private _visibilityHandler: (() => void) | null = null;
    private _webOSRelaunchDisposer: (() => void) | null = null;
    private readonly _lifecycleService: PlatformLifecycleService;
    private _pendingTransition: Promise<void> = Promise.resolve();

    private _initialized: boolean = false;
    private _shutdownStarted: boolean = false;

    constructor(
        stateManager?: StateManager,
        errorRecovery?: ErrorRecovery,
        lifecycleService?: PlatformLifecycleService
    ) {
        this._emitter = new EventEmitter<LifecycleEventMap>();
        this._stateManager = stateManager !== undefined ? stateManager : new StateManager();
        this._errorRecovery = errorRecovery !== undefined ? errorRecovery : new ErrorRecovery();
        this._lifecycleService = lifecycleService ?? createWebOsPlatformServices().lifecycle;
        this._statePersistenceQueue = new LifecycleStatePersistenceQueue({
            stateManager: this._stateManager,
            buildState: (): PersistentState => this._buildCurrentState(),
            emitPersistenceWarning: (warning): void => {
                this._emitter.emit('persistenceWarning', warning);
            },
        });
        this._asyncErrorReporter = new LifecycleAsyncErrorReporter({
            emitAsyncError: (payload): void => {
                this._emitter.emit('asyncError', payload);
            },
            reportError: (error): void => {
                this.reportError(error);
            },
        });
        this._connectivityMonitor = new LifecycleConnectivityMonitor({
            onNetworkChange: ({ isAvailable }): void => {
                this._isNetworkAvailable = isAvailable;
                this._emitter.emit('networkChange', { isAvailable });
            },
            onNetworkWarning: (warning): void => {
                this._emitter.emit('networkWarning', warning);
            },
            reportAsyncError: (error, context): void => {
                this._handleAsyncError(error, context);
            },
        });
        this._memoryMonitor = new LifecycleMemoryMonitor({
            onMemoryWarning: (warning): void => {
                this._emitter.emit('memoryWarning', warning);
            },
            clearCaches: (): void => {
                this.performMemoryCleanup();
            },
        });
    }

    /**
     * Sets up event listeners and restores state.
     */
    public async initialize(): Promise<void> {
        if (this._initialized) {
            return;
        }
        this._initialized = true;

        this._setupVisibilityListeners();
        this._connectivityMonitor.setupListeners();

        const initialNetworkAvailability = navigator.onLine;
        this._isNetworkAvailable = initialNetworkAvailability;
        this._connectivityMonitor.setInitialAvailability(initialNetworkAvailability);

        this._memoryMonitor.startMonitoring();
        this._connectivityMonitor.startMonitoring();

        const savedState = this._stateManager.load();

        // Auth is managed by PlexAuth storage; initialization settles in authenticating
        // before restored-state observers run so the phase contract is coherent.
        await this._transitionPhase('authenticating');

        if (savedState !== null) {
            this._emitter.emit('stateRestored', savedState);
        }
    }

    public async shutdown(): Promise<void> {
        if (this._shutdownStarted) {
            return;
        }
        this._shutdownStarted = true;

        await this._transitionPhase('terminating');

        this._emitter.emit('beforeTerminate', undefined);

        await this._executeCallbacksWithTimeout(
            this._terminateCallbacks,
            TIMING_CONFIG.CALLBACK_TIMEOUT_MS
        );

        // Save final state (already saved by _transitionPhase, but flush any pending)
        await this._statePersistenceQueue.flush({ finalShutdown: true });

        this._memoryMonitor.stopMonitoring();
        this._connectivityMonitor.stopMonitoring();

        this._removeVisibilityListeners();
        this._connectivityMonitor.removeListeners();

        this._emitter.removeAllListeners();
    }

    public saveState(): Promise<void> {
        return this._statePersistenceQueue.saveState();
    }

    public onPause(callback: LifecycleCallback): IDisposable {
        return this._registerLifecycleCallback(this._pauseCallbacks, callback);
    }

    public onResume(callback: LifecycleCallback): IDisposable {
        return this._registerLifecycleCallback(this._resumeCallbacks, callback);
    }

    public onTerminate(callback: LifecycleCallback): IDisposable {
        return this._registerLifecycleCallback(this._terminateCallbacks, callback);
    }

    public isNetworkAvailable(): boolean {
        return this._isNetworkAvailable;
    }

    public async checkNetworkStatus(): Promise<boolean> {
        return this._connectivityMonitor.checkNetworkStatus();
    }

    public getMemoryUsage(): MemoryUsage {
        return this._memoryMonitor.getMemoryUsage();
    }

    public performMemoryCleanup(): void {
        this._emitter.emit('clearCaches', undefined);
    }

    public getPhase(): AppPhase {
        return this._phase;
    }

    public getState(): AppLifecycleState {
        return {
            phase: this._phase,
            isVisible: this._isVisible,
            isNetworkAvailable: this._isNetworkAvailable,
            lastActiveTime: this._lastActiveTime,
            plexConnectionStatus: 'disconnected', // Updated by external module
            currentError: this._lastError,
        };
    }

    public setPhase(phase: AppPhase): void {
        this._trackPendingTransition(this._setPhaseAndTrack(phase));
    }

    public async setPhaseAndWait(phase: AppPhase): Promise<boolean> {
        const transition = this._setPhaseAndTrack(phase);
        this._trackPendingTransition(transition);
        return transition;
    }

    public waitForPendingTransition(): Promise<void> {
        return this._pendingTransition;
    }

    private _setPhaseAndTrack(phase: AppPhase): Promise<boolean> {
        const validTransitions = VALID_PHASE_TRANSITIONS[this._phase];
        if (validTransitions && !validTransitions.includes(phase)) {
            console.warn(
                `[AppLifecycle] Invalid phase transition: ${this._phase} -> ${phase}`
            );
            return Promise.resolve(false);
        }
        return this._transitionPhase(phase);
    }

    private _trackPendingTransition(transition: Promise<unknown>): void {
        const previousTransition = this._pendingTransition;
        this._pendingTransition = previousTransition.then(
            () => transition,
            () => transition
        ).then(
            () => undefined,
            () => undefined
        );
    }

    /**
     * Internal: Transition phase with validation and state save.
     * MUST reject invalid transitions per spec.
     * @param phase - New phase
     * @returns true if transition succeeded
     */
    private async _transitionPhase(phase: AppPhase): Promise<boolean> {
        if (this._phase === phase) {
            return true;
        }

        const validTransitions = VALID_PHASE_TRANSITIONS[this._phase];
        if (validTransitions && !validTransitions.includes(phase)) {
            // Reject invalid transition per spec
            return false;
        }

        // Save state BEFORE transition (per spec)
        await this._statePersistenceQueue.flush();

        const from = this._phase;
        this._phase = phase;

        this._emitter.emit('phaseChange', { from, to: phase });
        return true;
    }

    public reportError(error: AppError): void {
        this._lastError = error;

        const lifecycleError: LifecycleAppError = {
            ...error,
            phase: this._phase,
            timestamp: Date.now(),
            userMessage: this.getErrorUserMessage(error.code),
            actions: [],
        };

        // Set phase to error if not already
        if (this._phase !== 'error' && this._phase !== 'terminating') {
            this._trackPendingTransition(this._transitionPhase('error'));
        }

        this._emitter.emit('error', lifecycleError);
    }

    public getLastError(): AppError | null {
        return this._lastError;
    }

    public getErrorUserMessage(code: AppErrorCode): string {
        return this._errorRecovery.getUserMessage(code);
    }

    public on<K extends keyof LifecycleEventMap>(
        event: K,
        handler: (payload: LifecycleEventMap[K]) => void
    ): IDisposable {
        return this._emitter.on(event, handler);
    }

    private _setupVisibilityListeners(): void {
        this._visibilityHandler = (): void => {
            const transition = document.hidden ? this._handlePause() : this._handleResume();
            this._trackPendingTransition(transition);
        };
        document.addEventListener('visibilitychange', this._visibilityHandler);

        const relaunchHandler = (_event: Event): void => {
            this._trackPendingTransition(this._handleResume());
        };
        this._webOSRelaunchDisposer = this._lifecycleService.bindRelaunch(relaunchHandler);
    }

    private _removeVisibilityListeners(): void {
        if (this._visibilityHandler) {
            document.removeEventListener('visibilitychange', this._visibilityHandler);
            this._visibilityHandler = null;
        }
        if (this._webOSRelaunchDisposer) {
            this._webOSRelaunchDisposer();
            this._webOSRelaunchDisposer = null;
        }
    }

    /**
     * Handle app pause (backgrounding).
     */
    private async _handlePause(): Promise<void> {
        if (!this._isVisible) {
            return;
        }

        this._isVisible = false;
        this._emitter.emit('visibilityChange', { isVisible: false });

        // Save state immediately on pause
        await this._statePersistenceQueue.flush();

        await this._executeCallbacksWithTimeout(
            this._pauseCallbacks,
            TIMING_CONFIG.CALLBACK_TIMEOUT_MS
        );

        if (this._phase === 'ready' && !this._isVisible) {
            await this._transitionPhase('backgrounded');
        }
    }

    /**
     * Handle app resume (foregrounding).
     */
    private async _handleResume(): Promise<void> {
        if (this._isVisible) {
            return;
        }

        this._isVisible = true;
        this._lastActiveTime = Date.now();
        this._emitter.emit('visibilityChange', { isVisible: true });

        if (this._phase === 'backgrounded') {
            await this._transitionPhase('resuming');
        }

        await this._executeCallbacksWithTimeout(
            this._resumeCallbacks,
            TIMING_CONFIG.CALLBACK_TIMEOUT_MS
        );

        if (this._phase === 'resuming') {
            await this._transitionPhase('ready');
            if (!this._isVisible) {
                await this._transitionPhase('backgrounded');
            }
        }
    }

    /**
     * Execute callbacks with a timeout.
     */
    private async _executeCallbacksWithTimeout(
        callbacks: LifecycleCallback[],
        timeoutMs: number
    ): Promise<void> {
        const toRun = callbacks.slice();
        const promises = toRun.map((callback) => {
            return new Promise<void>((resolve) => {
                const timeoutId = setTimeout(() => {
                    resolve();
                }, timeoutMs);

                try {
                    const result = callback();
                    if (result && typeof result.then === 'function') {
                        result.then(() => {
                            clearTimeout(timeoutId);
                            resolve();
                        }).catch(() => {
                            clearTimeout(timeoutId);
                            resolve();
                        });
                    } else {
                        clearTimeout(timeoutId);
                        resolve();
                    }
                } catch {
                    clearTimeout(timeoutId);
                    resolve();
                }
            });
        });

        await Promise.all(promises);
    }

    private _registerLifecycleCallback(
        callbacks: LifecycleCallback[],
        callback: LifecycleCallback
    ): IDisposable {
        let disposed = false;
        const wrapped: LifecycleCallback = () => (disposed ? undefined : callback());
        callbacks.push(wrapped);
        return {
            dispose: (): void => {
                if (disposed) return;
                disposed = true;
                const idx = callbacks.indexOf(wrapped);
                if (idx >= 0) {
                    callbacks.splice(idx, 1);
                }
            },
        };
    }

    private _handleAsyncError(error: unknown, context: string): void {
        this._asyncErrorReporter.handle(error, context);
    }

    /**
     * Build current state for saving.
     */
    private _buildCurrentState(): PersistentState {
        const existingState =
            this._stateManager.load() ?? this._stateManager.createDefaultState();

        // Return lifecycle-owned state with updated timestamp.
        // Other modules own their own persistence boundaries and keys.
        return {
            ...existingState,
            lastUpdated: Date.now(),
        };
    }
}
