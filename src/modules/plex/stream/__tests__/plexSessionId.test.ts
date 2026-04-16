import { generatePlexSessionId } from '../plexSessionId';

describe('plexSessionId', () => {
    const originalCrypto = globalThis.crypto;

    afterEach(() => {
        Object.defineProperty(globalThis, 'crypto', {
            value: originalCrypto,
            configurable: true,
        });
        jest.restoreAllMocks();
    });

    it('uses crypto.randomUUID when available', () => {
        Object.defineProperty(globalThis, 'crypto', {
            value: { randomUUID: jest.fn(() => 'uuid-from-crypto') },
            configurable: true,
        });

        expect(generatePlexSessionId()).toBe('uuid-from-crypto');
    });

    it('falls back to a UUID-like random string when crypto.randomUUID is unavailable', () => {
        Object.defineProperty(globalThis, 'crypto', {
            value: {},
            configurable: true,
        });
        jest.spyOn(Math, 'random').mockReturnValue(0.5);

        expect(generatePlexSessionId()).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
        );
    });
});
