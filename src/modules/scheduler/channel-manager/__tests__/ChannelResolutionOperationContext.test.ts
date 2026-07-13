import { ChannelResolutionOperationContext } from '../resolution/ChannelResolutionOperationContext';

describe('ChannelResolutionOperationContext', () => {
    it('returns a rejected promise and releases scope for an already-aborted general resolution', async () => {
        const operations = new ChannelResolutionOperationContext();
        const caller = new AbortController();
        const reason = new DOMException('caller aborted', 'AbortError');
        caller.abort(reason);

        const resolution = operations.run(caller.signal, async () => 'unused');

        expect(resolution).toBeInstanceOf(Promise);
        await expect(resolution).rejects.toBe(reason);
        await expect(operations.supersedeAndDrain()).resolves.toBeUndefined();
    });

    it('cleans up general resolution scope when work throws synchronously', async () => {
        const operations = new ChannelResolutionOperationContext();
        const reason = new Error('synchronous general resolution failure');

        const resolution = operations.run(null, () => { throw reason; });

        expect(resolution).toBeInstanceOf(Promise);
        await expect(resolution).rejects.toBe(reason);
        await expect(operations.supersedeAndDrain()).resolves.toBeUndefined();
    });

    it('returns a rejected promise for an authorization invalidated before use', async () => {
        const operations = new ChannelResolutionOperationContext();
        const validator = new AbortController();
        await operations.supersedeAndDrain();
        const authorization = operations.createInitialTuneAuthorization('channel-1', {
            signal: validator.signal,
            assertCurrent: (): void => {
                if (validator.signal.aborted) throw validator.signal.reason;
            },
        });
        const reason = new DOMException('initial tune superseded', 'AbortError');
        validator.abort(reason);

        const resolution = operations.runInitialTune(
            'channel-1',
            authorization,
            async () => 'unused'
        );

        expect(resolution).toBeInstanceOf(Promise);
        await expect(resolution).rejects.toBe(reason);
        await expect(operations.supersedeAndDrain()).resolves.toBeUndefined();
    });

    it('cleans up tracked scope work when the authorized callback throws synchronously', async () => {
        const operations = new ChannelResolutionOperationContext();
        await operations.supersedeAndDrain();
        const authorization = operations.createInitialTuneAuthorization(
            'channel-1',
            { assertCurrent: (): void => undefined }
        );
        const reason = new Error('synchronous resolver failure');

        const resolution = operations.runInitialTune(
            'channel-1',
            authorization,
            () => { throw reason; }
        );

        await expect(resolution).rejects.toBe(reason);
        await expect(operations.supersedeAndDrain()).resolves.toBeUndefined();
    });

    it('consumes an authorization once before deferred work begins', async () => {
        const operations = new ChannelResolutionOperationContext();
        await operations.supersedeAndDrain();
        const authorization = operations.createInitialTuneAuthorization(
            'channel-1',
            { assertCurrent: (): void => undefined }
        );
        const work = jest.fn(async () => 'resolved');

        const first = operations.runInitialTune('channel-1', authorization, work);
        const duplicate = operations.runInitialTune('channel-1', authorization, work);

        await expect(first).resolves.toBe('resolved');
        await expect(duplicate).rejects.toMatchObject({ name: 'AbortError' });
        expect(work).toHaveBeenCalledTimes(1);
    });
});
