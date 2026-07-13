import {
    RetainedOperationContext,
    type RetainedOperationLease,
} from '../../utils/RetainedOperationContext';

export class ChannelTuningOperationContext {
    private _scope = this._createScope();
    private _suspended = false;

    get isSuspended(): boolean {
        return this._suspended;
    }

    capture(signal?: AbortSignal): RetainedOperationLease {
        if (this._suspended) throw createTuningSuspendedError();
        const scopeLease = this._scope.retain('channel-tune');
        let context: RetainedOperationContext;
        try {
            context = new RetainedOperationContext([
                scopeLease,
                ...(signal ? [{
                    signal,
                    assertCurrent: (): void => {
                        if (signal.aborted) throw signal.reason ?? createTuningSuspendedError();
                    },
                }] : []),
            ]);
        } catch (error: unknown) {
            scopeLease.release();
            throw error;
        }
        return {
            signal: context.signal,
            assertCurrent: (): void => context.assertCurrent(),
            release: (): void => {
                context.release();
                scopeLease.release();
            },
        };
    }

    suspend(): void {
        if (this._suspended) return;
        this._suspended = true;
        this._scope.close(createTuningSuspendedError());
    }

    resume(): void {
        if (!this._suspended) return;
        this._scope.release();
        this._scope = this._createScope();
        this._suspended = false;
    }

    private _createScope(): RetainedOperationContext {
        return new RetainedOperationContext([{ assertCurrent: (): void => undefined }]);
    }
}

export function createTuningSuspendedError(): Error {
    if (typeof DOMException !== 'undefined') {
        return new DOMException('Channel tuning is suspended.', 'AbortError');
    }
    const error = new Error('Channel tuning is suspended.');
    error.name = 'AbortError';
    return error;
}
