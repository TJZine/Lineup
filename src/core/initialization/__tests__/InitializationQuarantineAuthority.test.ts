import {
    InitializationQuarantineAuthority,
    InitializationQuarantinedError,
} from '../InitializationQuarantineAuthority';

describe('InitializationQuarantineAuthority', () => {
    it('closes admission, aborts and drains active ordinary startup, then reopens only on release', async () => {
        const authority = new InitializationQuarantineAuthority();
        const lease = authority.begin();
        if (!lease) throw new Error('Expected startup admission.');
        let settleStartup!: () => void;
        const startup = new Promise<void>((resolve) => { settleStartup = resolve; });
        lease.track(startup);

        const preparation = authority.prepare();
        expect(lease.signal.aborted).toBe(true);
        expect(lease.signal.reason).toBeInstanceOf(InitializationQuarantinedError);
        expect(authority.begin()).toBeNull();
        let drained = false;
        void preparation.then(() => { drained = true; });
        await Promise.resolve();
        expect(drained).toBe(false);

        settleStartup();
        await preparation;
        expect(authority.begin()).toBeNull();
        authority.release();
        expect(authority.begin()).not.toBeNull();
    });
});
