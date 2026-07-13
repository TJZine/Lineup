import { readAbortSignalReason } from './abortSignalReason';

export interface OperationContextUpstream {
    readonly signal?: AbortSignal | null;
    assertCurrent(): void;
}

export interface RetainedOperationLease {
    readonly signal: AbortSignal;
    assertCurrent(): void;
    release(): void;
}

export class RetainedOperationContext implements RetainedOperationLease {
    private readonly _controller = new AbortController();
    private readonly _abortListeners = new Map<AbortSignal, () => void>();
    private _leaseCount = 1;
    private _ownerReleased = false;
    private _disposed = false;
    private _closedReason: unknown;

    constructor(private readonly _upstreams: readonly OperationContextUpstream[]) {
        try {
            this._assertUpstreamsCurrent();
            for (const upstream of _upstreams) {
                const signal = upstream.signal;
                if (!signal || this._abortListeners.has(signal)) continue;
                const onAbort = (): void => this.close(readAbortSignalReason(signal));
                this._abortListeners.set(signal, onAbort);
                signal.addEventListener('abort', onAbort, { once: true });
            }
            for (const signal of this._abortListeners.keys()) {
                if (signal.aborted) {
                    this.close(readAbortSignalReason(signal));
                    break;
                }
            }
            this.assertCurrent();
        } catch (error: unknown) {
            this.release();
            throw error;
        }
    }

    get signal(): AbortSignal {
        return this._controller.signal;
    }

    assertCurrent(): void {
        if (this._disposed) throw createOperationContextAbortError();
        if (this._closedReason !== undefined) throw this._closedReason;
        try {
            this._assertUpstreamsCurrent();
        } catch (error: unknown) {
            this.close(error);
            throw error;
        }
        if (this._closedReason !== undefined) throw this._closedReason;
    }

    retain(_label: string): RetainedOperationLease {
        this.assertCurrent();
        this._leaseCount += 1;
        let released = false;
        return {
            signal: this.signal,
            assertCurrent: (): void => this.assertCurrent(),
            release: (): void => {
                if (released) return;
                released = true;
                this._releaseLease();
            },
        };
    }

    close(reason: unknown = createOperationContextAbortError()): void {
        if (this._closedReason !== undefined) return;
        this._closedReason = reason;
        this._controller.abort(reason);
    }

    release(): void {
        if (this._ownerReleased) return;
        this._ownerReleased = true;
        this._releaseLease();
    }

    private _assertUpstreamsCurrent(): void {
        for (const upstream of this._upstreams) {
            const signal = upstream.signal;
            if (signal?.aborted) throw readAbortSignalReason(signal);
            upstream.assertCurrent();
        }
    }

    private _releaseLease(): void {
        this._leaseCount -= 1;
        if (this._leaseCount !== 0) return;
        this._disposed = true;
        for (const [signal, listener] of this._abortListeners) {
            signal.removeEventListener('abort', listener);
        }
        this._abortListeners.clear();
    }
}

function createOperationContextAbortError(): Error {
    if (typeof DOMException !== 'undefined') {
        return new DOMException('Operation context was superseded.', 'AbortError');
    }
    const error = new Error('Operation context was superseded.');
    error.name = 'AbortError';
    return error;
}
