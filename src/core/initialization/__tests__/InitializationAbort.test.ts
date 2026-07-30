import {
    createStartupPassValidity,
} from '../InitializationAbort';

describe('InitializationAbort', () => {
    it('composes discovery receipt invalidation into startup currentness and cancellation', () => {
        const auth = new AbortController();
        const discovery = new AbortController();
        const discoveryError = new Error('discovery selection superseded');
        const validity = createStartupPassValidity(null, {
            signal: auth.signal,
            assertCurrent: jest.fn(),
        }, {
            signal: discovery.signal,
            assertCurrent: (): void => {
                if (discovery.signal.aborted) throw discoveryError;
            },
        });

        discovery.abort(discoveryError);

        expect(validity.signal.aborted).toBe(true);
        expect(validity.signal.reason).toBe(discoveryError);
        expect(() => validity.assertCurrent()).toThrow(discoveryError);
        validity.dispose();
    });
});
