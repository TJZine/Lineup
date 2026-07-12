import type { OperationContextUpstream } from '../../utils/RetainedOperationContext';

const selectedLineageBrand: unique symbol = Symbol('InitializationSelectedServerLineage');
export type InitializationSelectedServerLineage = OperationContextUpstream & Readonly<{
    [selectedLineageBrand]: true;
}>;

type StartupRequest = Readonly<{ generation: number }>;
type SelectedAuthority = {
    generation: number;
    controller: AbortController;
    lineage: InitializationSelectedServerLineage;
    supersededBy: number | null;
};

export class InitializationSelectedServerSupersededError extends Error {
    constructor() {
        super('Selected-server initialization was superseded by newer startup.');
        this.name = 'InitializationSelectedServerSupersededError';
    }
}

export class InitializationStartupHandoff {
    private _generation = 0;
    private readonly _startupSettlements = new Map<number, Promise<void>>();
    private readonly _selectedAuthorities = new Set<SelectedAuthority>();
    private readonly _authorityByLineage = new WeakMap<InitializationSelectedServerLineage, SelectedAuthority>();

    constructor(private readonly _onSelectedAuthorityInvalidated: () => void = () => undefined) {}

    beginStartup(): StartupRequest {
        const request = Object.freeze({ generation: ++this._generation });
        let invalidated = false;
        for (const authority of this._selectedAuthorities) {
            if (authority.generation >= request.generation || authority.supersededBy !== null) continue;
            authority.supersededBy = request.generation;
            authority.controller.abort(new InitializationSelectedServerSupersededError());
            invalidated = true;
        }
        if (invalidated) this._onSelectedAuthorityInvalidated();
        return request;
    }

    trackStartup(request: StartupRequest, startup: Promise<void>): void {
        const settlement = startup.then(() => undefined, () => undefined);
        this._startupSettlements.set(request.generation, settlement);
    }

    beginSelectedServerLineage(): InitializationSelectedServerLineage {
        const controller = new AbortController();
        let authority!: SelectedAuthority;
        const lineage = Object.freeze({
            [selectedLineageBrand]: true as const,
            signal: controller.signal,
            assertCurrent: (): void => {
                if (authority.supersededBy !== null) throw new InitializationSelectedServerSupersededError();
            },
        });
        authority = { generation: this._generation, controller, lineage, supersededBy: null };
        this._selectedAuthorities.add(authority);
        this._authorityByLineage.set(lineage, authority);
        return lineage;
    }

    releaseSelectedServerLineage(lineage: InitializationSelectedServerLineage): void {
        const authority = this._authorityByLineage.get(lineage);
        if (authority) this._selectedAuthorities.delete(authority);
    }

    getSupersedingStartupHandoff(lineage: InitializationSelectedServerLineage): Promise<void> | null {
        const generation = this._authorityByLineage.get(lineage)?.supersededBy;
        return generation === null || generation === undefined
            ? null
            : this._startupSettlements.get(generation) ?? null;
    }
}
