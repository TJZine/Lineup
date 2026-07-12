import {
    RetainedOperationContext,
    type OperationContextUpstream,
    type RetainedOperationLease,
} from '../../utils/RetainedOperationContext';

const lineageBrand: unique symbol = Symbol('ChannelInitialTuneLineage');
const permitBrand: unique symbol = Symbol('ChannelInitialTunePermit');

export type ChannelInitialTuneLineage = Readonly<{ [lineageBrand]: true }>;
export type ChannelInitialTunePermit = Readonly<{ [permitBrand]: true }>;

type ActiveLineage = {
    lineage: ChannelInitialTuneLineage;
    context: RetainedOperationContext;
    permit: ChannelInitialTunePermit | null;
    consumed: boolean;
};

export class ChannelInitialTuneAuthority {
    private _active: ActiveLineage | null = null;

    beginLineage(validators: readonly OperationContextUpstream[]): ChannelInitialTuneLineage {
        this.revokeActive();
        const lineage = Object.freeze({ [lineageBrand]: true as const });
        this._active = {
            lineage,
            context: new RetainedOperationContext(validators),
            permit: null,
            consumed: false,
        };
        return lineage;
    }

    mintPermit(lineage: ChannelInitialTuneLineage): ChannelInitialTunePermit {
        const active = this._requireActiveLineage(lineage);
        active.context.assertCurrent();
        if (active.permit || active.consumed) throw createInitialTuneAuthorityError();
        active.permit = Object.freeze({ [permitBrand]: true as const });
        return active.permit;
    }

    consumePermit(permit: ChannelInitialTunePermit): RetainedOperationLease {
        const active = this._active;
        if (!active || active.permit !== permit || active.consumed) {
            throw createInitialTuneAuthorityError();
        }
        active.context.assertCurrent();
        active.consumed = true;
        active.permit = null;
        return active.context.retain('initial-channel-tune');
    }

    completeLineage(lineage: ChannelInitialTuneLineage): void {
        const active = this._requireActiveLineage(lineage);
        active.context.assertCurrent();
        active.context.close();
        active.context.release();
        this._active = null;
    }

    revokeActive(): void {
        const active = this._active;
        if (!active) return;
        active.context.close();
        active.context.release();
        this._active = null;
    }

    private _requireActiveLineage(lineage: ChannelInitialTuneLineage): ActiveLineage {
        const active = this._active;
        if (!active || active.lineage !== lineage) throw createInitialTuneAuthorityError();
        return active;
    }
}

function createInitialTuneAuthorityError(): Error {
    if (typeof DOMException !== 'undefined') {
        return new DOMException('Initial channel tune authority is not current.', 'AbortError');
    }
    const error = new Error('Initial channel tune authority is not current.');
    error.name = 'AbortError';
    return error;
}
