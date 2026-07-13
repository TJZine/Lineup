import { InitializationStartupHandoff } from '../InitializationStartupHandoff';

describe('InitializationStartupHandoff', () => {
    it('synchronously invalidates older selected authority and transfers tuning ownership', () => {
        const transfer = jest.fn();
        const owner = new InitializationStartupHandoff(transfer);
        const selected = owner.beginSelectedServerLineage();

        owner.beginStartup();

        expect(selected.signal?.aborted).toBe(true);
        expect(() => selected.assertCurrent()).toThrow('superseded by newer startup');
        expect(transfer).toHaveBeenCalledTimes(1);
    });

    it('returns only a startup strictly newer than the exact selected lineage', async () => {
        const owner = new InitializationStartupHandoff();
        const older = owner.beginStartup();
        owner.trackStartup(older, Promise.resolve());
        const selected = owner.beginSelectedServerLineage();
        expect(owner.getSupersedingStartupHandoff(selected)).toBeNull();

        let settle!: () => void;
        const newer = owner.beginStartup();
        owner.trackStartup(newer, new Promise<void>((resolve) => { settle = resolve; }));
        const handoff = owner.getSupersedingStartupHandoff(selected);
        expect(handoff).not.toBeNull();
        settle();
        await expect(handoff).resolves.toBeUndefined();
        expect(owner.getSupersedingStartupHandoff(selected)).toBe(handoff);
        owner.releaseSelectedServerLineage(selected);
        expect(owner.getSupersedingStartupHandoff(selected)).toBeNull();
    });

    it('does not expose a newer startup through another selected lineage', () => {
        const owner = new InitializationStartupHandoff();
        const first = owner.beginSelectedServerLineage();
        const startup = owner.beginStartup();
        owner.trackStartup(startup, Promise.resolve());
        const second = owner.beginSelectedServerLineage();

        expect(owner.getSupersedingStartupHandoff(first)).not.toBeNull();
        expect(owner.getSupersedingStartupHandoff(second)).toBeNull();
    });

    it('keeps a replacement settlement for the same generation until it completes', async () => {
        const owner = new InitializationStartupHandoff();
        const selected = owner.beginSelectedServerLineage();
        const startup = owner.beginStartup();
        let settleFirst!: () => void;
        let settleReplacement!: () => void;
        owner.trackStartup(startup, new Promise<void>((resolve) => { settleFirst = resolve; }));
        owner.trackStartup(startup, new Promise<void>((resolve) => { settleReplacement = resolve; }));
        const replacement = owner.getSupersedingStartupHandoff(selected);

        settleFirst();
        await Promise.resolve();
        await Promise.resolve();

        expect(owner.getSupersedingStartupHandoff(selected)).toBe(replacement);
        settleReplacement();
        await expect(replacement).resolves.toBeUndefined();
        expect(owner.getSupersedingStartupHandoff(selected)).toBe(replacement);
        owner.releaseSelectedServerLineage(selected);
        expect(owner.getSupersedingStartupHandoff(selected)).toBeNull();
    });

    it.each(['fulfilled', 'rejected'] as const)(
        'retains a %s startup settlement for a late selected observer until release',
        async (outcome) => {
            const owner = new InitializationStartupHandoff();
            const selected = owner.beginSelectedServerLineage();
            const startup = owner.beginStartup();
            owner.trackStartup(startup, outcome === 'fulfilled'
                ? Promise.resolve()
                : Promise.reject(new Error('startup failed')));
            const settlement = owner.getSupersedingStartupHandoff(selected);

            await expect(settlement).resolves.toBeUndefined();
            expect(owner.getSupersedingStartupHandoff(selected)).toBe(settlement);
            owner.releaseSelectedServerLineage(selected);
            expect(owner.getSupersedingStartupHandoff(selected)).toBeNull();
        }
    );

    it('waits for every selected dependent to release before cleanup', async () => {
        const owner = new InitializationStartupHandoff();
        const first = owner.beginSelectedServerLineage();
        const second = owner.beginSelectedServerLineage();
        const startup = owner.beginStartup();
        owner.trackStartup(startup, Promise.resolve());
        const settlement = owner.getSupersedingStartupHandoff(first);
        await expect(settlement).resolves.toBeUndefined();

        owner.releaseSelectedServerLineage(first);
        expect(owner.getSupersedingStartupHandoff(second)).toBe(settlement);
        owner.releaseSelectedServerLineage(second);
        expect(owner.getSupersedingStartupHandoff(second)).toBeNull();
    });
});
