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
});
