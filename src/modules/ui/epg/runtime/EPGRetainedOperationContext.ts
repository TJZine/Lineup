import {
    RetainedOperationContext,
    type OperationContextUpstream,
} from '../../../../utils/RetainedOperationContext';

const epgOperationBrand: unique symbol = Symbol('EpgOperationAuthority');
export type EpgOperationAuthority = Readonly<{ [epgOperationBrand]: true }>;

export interface EpgRetainedOperationContext extends OperationContextUpstream {
    readonly authority: EpgOperationAuthority;
    readonly signal: AbortSignal;
    retain(label: string): EpgRetainedOperationContext;
    release(): void;
}

export function createEpgRetainedOperationContext(
    upstreams: readonly OperationContextUpstream[]
): EpgRetainedOperationContext {
    const authority = Object.freeze({ [epgOperationBrand]: true as const });
    const root = new RetainedOperationContext(upstreams);
    return wrap(authority, root, (label) => root.retain(label));
}

function wrap(
    authority: EpgOperationAuthority,
    owner: {
        signal: AbortSignal;
        assertCurrent(): void;
        release(): void;
    },
    retainRoot: (label: string) => {
        signal: AbortSignal;
        assertCurrent(): void;
        release(): void;
    }
): EpgRetainedOperationContext {
    return {
        authority,
        signal: owner.signal,
        assertCurrent: (): void => owner.assertCurrent(),
        retain: (label): EpgRetainedOperationContext => {
            const child = retainRoot(label);
            return wrap(authority, child, retainRoot);
        },
        release: (): void => owner.release(),
    };
}
