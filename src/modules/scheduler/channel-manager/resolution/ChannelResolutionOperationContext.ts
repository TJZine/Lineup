import {
    RetainedOperationContext,
    type OperationContextUpstream,
} from '../../../../utils/RetainedOperationContext';
import {
    SourceResolutionScope,
    type SourceResolutionOperationContext,
} from './SourceResolutionEntryAuthority';
import {
    createChannelInitialResolutionAuthorization,
    type ChannelInitialResolutionAuthorization,
} from '../contracts/ChannelResolutionAuthority';

export type { ChannelInitialResolutionAuthorization } from '../contracts/ChannelResolutionAuthority';

export interface ChannelResolutionLease extends SourceResolutionOperationContext {}

type InitialResolutionAuthority = {
    channelId: string;
    context: RetainedOperationContext;
    consumed: boolean;
};

export class ChannelResolutionOperationContext {
    private _scope = this._createScope();
    private _suspended = false;
    private readonly _active = new Set<Promise<unknown>>();
    private _suspendedAuthority = new RetainedOperationContext([{ assertCurrent: (): void => undefined }]);
    private readonly _initialAuthorities = new WeakMap<
        ChannelInitialResolutionAuthorization,
        InitialResolutionAuthority
    >();

    assertGeneralAdmission(): void {
        if (this._suspended) throw createResolutionAbortError();
    }

    run<T>(signal: AbortSignal | null | undefined, work: (lease: ChannelResolutionLease) => Promise<T>): Promise<T> {
        if (this._suspended) return Promise.reject(createResolutionAbortError());
        let scopeLease: SourceResolutionOperationContext;
        try {
            scopeLease = this._scope.retain('channel-resolution');
        } catch (error: unknown) {
            return Promise.reject(error);
        }
        const callerUpstream = signal
            ? {
                signal,
                assertCurrent: (): void => {
                    if (signal.aborted) throw signal.reason ?? createResolutionAbortError();
                },
            }
            : { assertCurrent: (): void => undefined };
        let retained: RetainedOperationContext;
        try {
            retained = new RetainedOperationContext([
                scopeLease,
                callerUpstream,
            ]);
        } catch (error: unknown) {
            scopeLease.release();
            return Promise.reject(error);
        }
        const lease: ChannelResolutionLease = {
            authority: scopeLease.authority,
            commonScope: scopeLease.commonScope,
            signal: retained.signal,
            assertCurrent: (): void => retained.assertCurrent(),
            retain: (label): ChannelResolutionLease => {
                const child = retained.retain(label);
                return {
                    authority: scopeLease.authority,
                    commonScope: scopeLease.commonScope,
                    signal: child.signal,
                    assertCurrent: (): void => child.assertCurrent(),
                    retain: (nestedLabel): ChannelResolutionLease => lease.retain(nestedLabel),
                    release: (): void => child.release(),
                };
            },
            release: (): void => retained.release(),
        };
        const promise = Promise.resolve()
            .then(() => work(lease))
            .finally(() => {
                lease.release();
                scopeLease.release();
            });
        this._active.add(promise);
        void promise.then(
            () => this._active.delete(promise),
            () => this._active.delete(promise)
        );
        return promise;
    }

    async supersedeAndDrain(): Promise<void> {
        this._suspended = true;
        this._suspendedAuthority.close(createResolutionAbortError());
        this._suspendedAuthority.release();
        this._suspendedAuthority = new RetainedOperationContext([{ assertCurrent: (): void => undefined }]);
        const oldScope = this._scope;
        oldScope.close(createResolutionAbortError());
        const active = [...this._active];
        await Promise.allSettled(active);
        oldScope.release();
    }

    resume(): void {
        if (!this._suspended) return;
        this._suspendedAuthority.close(createResolutionAbortError());
        this._suspendedAuthority.release();
        this._scope = this._createScope();
        this._suspended = false;
    }

    createInitialTuneAuthorization(
        channelId: string,
        validator: OperationContextUpstream
    ): ChannelInitialResolutionAuthorization {
        if (!this._suspended) throw createResolutionAbortError();
        const token = createChannelInitialResolutionAuthorization();
        this._initialAuthorities.set(token, {
            channelId,
            context: new RetainedOperationContext([this._suspendedAuthority, validator]),
            consumed: false,
        });
        return token;
    }

    runInitialTune<T>(
        channelId: string,
        token: ChannelInitialResolutionAuthorization,
        work: (lease: ChannelResolutionLease) => Promise<T>
    ): Promise<T> {
        const authority = this._initialAuthorities.get(token);
        if (
            !this._suspended
            || !authority
            || authority.channelId !== channelId
            || authority.consumed
        ) {
            return Promise.reject(createResolutionAbortError());
        }
        let resolution: Promise<T>;
        try {
            authority.context.assertCurrent();
            authority.consumed = true;
            resolution = this._runWithScope(authority.context, work);
        } catch (error: unknown) {
            resolution = Promise.reject(error);
        }
        return resolution.finally(() => {
            authority.context.release();
        });
    }

    private _createScope(): SourceResolutionScope {
        return new SourceResolutionScope([{ assertCurrent: (): void => undefined }]);
    }

    private _runWithScope<T>(
        upstream: OperationContextUpstream,
        work: (lease: ChannelResolutionLease) => Promise<T>
    ): Promise<T> {
        const scope = new SourceResolutionScope([upstream]);
        const lease = scope.retain('authorized-channel-resolution');
        const promise = Promise.resolve()
            .then(() => work(lease))
            .finally(() => {
                lease.release();
                scope.release();
            });
        this._active.add(promise);
        void promise.then(
            () => this._active.delete(promise),
            () => this._active.delete(promise)
        );
        return promise;
    }
}

function createResolutionAbortError(): Error {
    if (typeof DOMException !== 'undefined') {
        return new DOMException('Channel resolution scope changed.', 'AbortError');
    }
    const error = new Error('Channel resolution scope changed.');
    error.name = 'AbortError';
    return error;
}
