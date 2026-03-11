/**
 * @jest-environment jsdom
 */

import { PLEX_AUTH_CONSTANTS } from '../constants';
import { resolveClientIdentifier } from '../clientIdentifier';

describe('resolveClientIdentifier', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
    });

    it('uses a sane preferred value first', () => {
        localStorage.setItem(PLEX_AUTH_CONSTANTS.CLIENT_ID_KEY, 'stored-client-id');

        const resolved = resolveClientIdentifier('preferred-client-id');

        expect(resolved).toBe('preferred-client-id');
        expect(localStorage.getItem(PLEX_AUTH_CONSTANTS.CLIENT_ID_KEY)).toBe('preferred-client-id');
    });

    it('uses sane stored value when preferred is absent or invalid', () => {
        localStorage.setItem(PLEX_AUTH_CONSTANTS.CLIENT_ID_KEY, 'stored-client-id');

        expect(resolveClientIdentifier()).toBe('stored-client-id');
        expect(resolveClientIdentifier('')).toBe('stored-client-id');
        expect(resolveClientIdentifier('bad id with spaces')).toBe('stored-client-id');
    });

    it('generates and stores lineup fallback when preferred and stored are invalid', () => {
        const originalCrypto = globalThis.crypto;
        Object.defineProperty(globalThis, 'crypto', {
            value: { randomUUID: (): string => { throw new Error('no uuid'); } },
            configurable: true,
        });

        try {
            localStorage.setItem(PLEX_AUTH_CONSTANTS.CLIENT_ID_KEY, 'not valid!');
            const resolved = resolveClientIdentifier('');

            expect(resolved).toMatch(/^lineup-[a-z0-9]+$/);
            expect(localStorage.getItem(PLEX_AUTH_CONSTANTS.CLIENT_ID_KEY)).toBe(resolved);
        } finally {
            Object.defineProperty(globalThis, 'crypto', {
                value: originalCrypto,
                configurable: true,
            });
        }
    });

    it('returns a resolved identifier when storage read/write throws', () => {
        const getItemSpy = jest
            .spyOn(Storage.prototype, 'getItem')
            .mockImplementation(() => {
                throw new Error('blocked');
            });
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });

        const resolved = resolveClientIdentifier();

        expect(resolved.startsWith('lineup-')).toBe(true);
        expect(getItemSpy).toHaveBeenCalledWith(PLEX_AUTH_CONSTANTS.CLIENT_ID_KEY);
    });
});
