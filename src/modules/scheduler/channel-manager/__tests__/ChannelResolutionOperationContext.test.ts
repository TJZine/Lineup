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

    it('blocks resolution while suspended and admits it after resume', async () => {
        const operations = new ChannelResolutionOperationContext();
        const work = jest.fn(async () => 'resolved');

        await operations.supersedeAndDrain();
        await expect(operations.run(null, work)).rejects.toMatchObject({ name: 'AbortError' });
        expect(work).not.toHaveBeenCalled();

        operations.resume();
        await expect(operations.run(null, work)).resolves.toBe('resolved');
        expect(work).toHaveBeenCalledTimes(1);
    });
});
