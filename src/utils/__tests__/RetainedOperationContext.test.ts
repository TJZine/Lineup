import { RetainedOperationContext } from '../RetainedOperationContext';

describe('RetainedOperationContext', () => {
    it('forwards upstream invalidation and keeps child currentness after owner release', () => {
        const upstream = new AbortController();
        const reason = new DOMException('scope changed', 'AbortError');
        const context = new RetainedOperationContext([{
            signal: upstream.signal,
            assertCurrent: (): void => {
                if (upstream.signal.aborted) throw reason;
            },
        }]);
        const child = context.retain('child');

        context.release();
        expect(() => child.assertCurrent()).not.toThrow();
        upstream.abort(reason);

        expect(child.signal.aborted).toBe(true);
        expect(() => child.assertCurrent()).toThrow(reason);
        child.release();
        child.release();
    });

    it('isolates child release and rejects retention after closure', () => {
        const context = new RetainedOperationContext([{ assertCurrent: jest.fn() }]);
        const first = context.retain('first');
        const second = context.retain('second');

        first.release();
        expect(() => second.assertCurrent()).not.toThrow();
        context.close();
        expect(() => context.retain('late')).toThrow(
            expect.objectContaining({ name: 'AbortError' })
        );
        second.release();
        context.release();
    });

    it('registers one abort listener for duplicate upstream signals', () => {
        const controller = new AbortController();
        const add = jest.spyOn(controller.signal, 'addEventListener');
        const remove = jest.spyOn(controller.signal, 'removeEventListener');
        const context = new RetainedOperationContext([
            { signal: controller.signal, assertCurrent: jest.fn() },
            { signal: controller.signal, assertCurrent: jest.fn() },
        ]);

        expect(add).toHaveBeenCalledTimes(1);
        context.release();
        expect(remove).toHaveBeenCalledTimes(1);
        expect(() => context.retain('after-dispose')).toThrow(
            expect.objectContaining({ name: 'AbortError' })
        );
    });

    it('removes installed abort listeners when final construction validation fails', () => {
        const controller = new AbortController();
        const reason = new Error('upstream changed during construction');
        const add = jest.spyOn(controller.signal, 'addEventListener');
        const remove = jest.spyOn(controller.signal, 'removeEventListener');
        const assertCurrent = jest.fn()
            .mockImplementationOnce(() => undefined)
            .mockImplementationOnce(() => { throw reason; });

        expect(() => new RetainedOperationContext([{
            signal: controller.signal,
            assertCurrent,
        }])).toThrow(reason);

        expect(add).toHaveBeenCalledTimes(1);
        expect(remove).toHaveBeenCalledTimes(1);
        expect(remove).toHaveBeenCalledWith(
            'abort',
            add.mock.calls[0]?.[1]
        );
    });
});
