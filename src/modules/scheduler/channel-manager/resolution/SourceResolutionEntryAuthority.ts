import {
    RetainedOperationContext,
    type OperationContextUpstream,
    type RetainedOperationLease,
} from '../../../../utils/RetainedOperationContext';

const sourceResolutionScopeBrand: unique symbol = Symbol('SourceResolutionScopeAuthority');

export type SourceResolutionScopeAuthority = Readonly<{
    [sourceResolutionScopeBrand]: true;
}>;

export interface SourceResolutionOperationContext extends RetainedOperationLease {
    readonly authority: SourceResolutionScopeAuthority;
    readonly commonScope: SourceResolutionScope;
    retain(label: string): SourceResolutionOperationContext;
}

export class SourceResolutionScope implements SourceResolutionOperationContext {
    readonly authority: SourceResolutionScopeAuthority = Object.freeze({
        [sourceResolutionScopeBrand]: true as const,
    });
    private readonly _context: RetainedOperationContext;

    get commonScope(): SourceResolutionScope {
        return this;
    }

    constructor(upstreams: readonly OperationContextUpstream[]) {
        this._context = new RetainedOperationContext(upstreams);
    }

    get signal(): AbortSignal {
        return this._context.signal;
    }

    assertCurrent(): void {
        this._context.assertCurrent();
    }

    retain(label: string): SourceResolutionOperationContext {
        const lease = this._context.retain(label);
        return {
            authority: this.authority,
            commonScope: this,
            signal: lease.signal,
            assertCurrent: (): void => lease.assertCurrent(),
            release: (): void => lease.release(),
            retain: (childLabel): SourceResolutionOperationContext => this.retain(childLabel),
        };
    }

    close(reason?: unknown): void {
        this._context.close(reason);
    }

    release(): void {
        this._context.release();
    }
}

export class SourceResolutionEntryAuthority implements RetainedOperationLease {
    private readonly _context: RetainedOperationContext;

    constructor(readonly scope: SourceResolutionOperationContext) {
        this._context = new RetainedOperationContext([scope]);
    }

    get signal(): AbortSignal {
        return this._context.signal;
    }

    assertCurrent(): void {
        this._context.assertCurrent();
    }

    retain(label: string): SourceResolutionOperationContext {
        const lease = this._context.retain(label);
        return {
            authority: this.scope.authority,
            commonScope: this.scope.commonScope,
            signal: lease.signal,
            assertCurrent: (): void => lease.assertCurrent(),
            release: (): void => lease.release(),
            retain: (childLabel): SourceResolutionOperationContext => this.retain(childLabel),
        };
    }

    close(reason?: unknown): void {
        this._context.close(reason);
    }

    release(): void {
        this._context.release();
        this.scope.release();
    }
}
