import { TIMING_CONFIG } from '../config/timing';

export class PersistenceWarningBackoffPolicy {
    private _nextWarningAt = 0;
    private _quotaBackoffMs: number = TIMING_CONFIG.PERSISTENCE_WARNING_BACKOFF_MS;

    public shouldEmitWarning(isQuotaError: boolean): boolean {
        const now = Date.now();
        if (now < this._nextWarningAt) {
            return false;
        }

        const backoffMs = isQuotaError
            ? this._quotaBackoffMs
            : TIMING_CONFIG.PERSISTENCE_WARNING_BACKOFF_MS;
        this._nextWarningAt = now + backoffMs;

        if (isQuotaError) {
            this._quotaBackoffMs = Math.min(
                this._quotaBackoffMs * 2,
                TIMING_CONFIG.PERSISTENCE_WARNING_MAX_BACKOFF_MS
            );
        } else {
            this.resetQuotaBackoff();
        }

        return true;
    }

    public resetQuotaBackoff(): void {
        this._quotaBackoffMs = TIMING_CONFIG.PERSISTENCE_WARNING_BACKOFF_MS;
    }

    public resetAll(): void {
        this._nextWarningAt = 0;
        this.resetQuotaBackoff();
    }
}
