import { NETWORK_CHECK_PROBE_URL, TIMING_CONFIG } from './constants';
import type { LifecycleEventMap } from './types';

export interface LifecycleConnectivityMonitorDeps {
    onNetworkChange: (payload: LifecycleEventMap['networkChange']) => void;
    onNetworkWarning: (payload: LifecycleEventMap['networkWarning']) => void;
    reportAsyncError: (error: unknown, context: string) => void;
}

export class LifecycleConnectivityMonitor {
    private readonly _onNetworkChange: (payload: LifecycleEventMap['networkChange']) => void;
    private readonly _onNetworkWarning: (payload: LifecycleEventMap['networkWarning']) => void;
    private readonly _reportAsyncError: (error: unknown, context: string) => void;
    private _onlineHandler: (() => void) | null = null;
    private _offlineHandler: (() => void) | null = null;
    private _networkCheckInterval: number | null = null;
    private _isNetworkAvailable: boolean = true;
    private _nextNetworkWarningAt: number = 0;

    public constructor(deps: LifecycleConnectivityMonitorDeps) {
        this._onNetworkChange = deps.onNetworkChange;
        this._onNetworkWarning = deps.onNetworkWarning;
        this._reportAsyncError = deps.reportAsyncError;
    }

    public setInitialAvailability(isAvailable: boolean): void {
        this._isNetworkAvailable = isAvailable;
    }

    public isNetworkAvailable(): boolean {
        return this._isNetworkAvailable;
    }

    public setupListeners(): void {
        if (this._onlineHandler !== null || this._offlineHandler !== null) {
            return;
        }

        this._onlineHandler = (): void => {
            this._setAvailabilityFromBrowserEvent(true);
        };

        this._offlineHandler = (): void => {
            this._setAvailabilityFromBrowserEvent(false);
        };

        window.addEventListener('online', this._onlineHandler);
        window.addEventListener('offline', this._offlineHandler);
    }

    public removeListeners(): void {
        if (this._onlineHandler) {
            window.removeEventListener('online', this._onlineHandler);
            this._onlineHandler = null;
        }
        if (this._offlineHandler) {
            window.removeEventListener('offline', this._offlineHandler);
            this._offlineHandler = null;
        }
    }

    public startMonitoring(): void {
        if (this._networkCheckInterval !== null) {
            return;
        }

        this._networkCheckInterval = window.setInterval(() => {
            void this.checkNetworkStatus().catch((error) => {
                this._reportAsyncError(error, 'network-monitor');
            });
        }, TIMING_CONFIG.NETWORK_CHECK_INTERVAL_MS) as unknown as number;
    }

    public stopMonitoring(): void {
        if (this._networkCheckInterval !== null) {
            clearInterval(this._networkCheckInterval);
            this._networkCheckInterval = null;
        }
    }

    public async checkNetworkStatus(): Promise<boolean> {
        let timeoutId: number | null = null;
        try {
            const controller = new AbortController();
            timeoutId = window.setTimeout(
                () => controller.abort(),
                TIMING_CONFIG.NETWORK_CHECK_TIMEOUT_MS
            ) as unknown as number;

            const response = await fetch(NETWORK_CHECK_PROBE_URL, {
                method: 'HEAD',
                signal: controller.signal,
                mode: 'no-cors',
            });

            const available = response.type === 'opaque';
            this._setAvailability(available);
            return available;
        } catch {
            this._setAvailability(false);
            this._maybeEmitNetworkWarning('Network connectivity check failed');
            return false;
        } finally {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }
        }
    }

    private _setAvailability(isAvailable: boolean): void {
        if (isAvailable === this._isNetworkAvailable) {
            return;
        }
        this._isNetworkAvailable = isAvailable;
        this._onNetworkChange({ isAvailable });
    }

    private _setAvailabilityFromBrowserEvent(isAvailable: boolean): void {
        this._isNetworkAvailable = isAvailable;
        this._onNetworkChange({ isAvailable });
    }

    private _maybeEmitNetworkWarning(message: string): void {
        const now = Date.now();
        if (now < this._nextNetworkWarningAt) {
            return;
        }
        this._nextNetworkWarningAt = now + TIMING_CONFIG.NETWORK_WARNING_BACKOFF_MS;
        this._onNetworkWarning({
            message,
            isAvailable: this._isNetworkAvailable,
            timestamp: now,
        });
    }
}
