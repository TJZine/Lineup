/**
 * @jest-environment jsdom
 */

import {
    installMockLocalStorage,
    mockLocalStorage,
    resetMockLocalStorage,
    restoreOriginalLocalStorage,
} from './localStorage';

describe('shared localStorage mock owner', () => {
    beforeEach(() => {
        resetMockLocalStorage();
    });

    afterEach(() => {
        restoreOriginalLocalStorage();
        resetMockLocalStorage();
    });

    it('installs the shared mock on globalThis and keeps methods spy-friendly', () => {
        installMockLocalStorage();

        mockLocalStorage.setItem('theme', 'ember-steel');

        expect(globalThis.localStorage).toBe(mockLocalStorage);
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'ember-steel');
        expect(mockLocalStorage.getItem('theme')).toBe('ember-steel');
        expect(mockLocalStorage.length).toBe(1);
        expect(mockLocalStorage.key(0)).toBe('theme');
    });

    it('reset restores the default store-backed implementations after overrides', () => {
        installMockLocalStorage();
        mockLocalStorage.setItem('before-reset', 'present');
        mockLocalStorage.setItem.mockImplementation((): void => {
            throw new Error('blocked');
        });

        expect(() => mockLocalStorage.setItem('after-override', 'blocked')).toThrow('blocked');

        resetMockLocalStorage();

        expect(mockLocalStorage.getItem('before-reset')).toBeNull();
        expect(() => mockLocalStorage.setItem('after-reset', 'restored')).not.toThrow();
        expect(mockLocalStorage.getItem('after-reset')).toBe('restored');
    });

    it('restores the real jsdom localStorage after the mock is installed', () => {
        const originalLocalStorage = globalThis.localStorage;
        originalLocalStorage.clear();
        originalLocalStorage.setItem('real-key', 'real-value');

        installMockLocalStorage();
        mockLocalStorage.setItem('mock-key', 'mock-value');

        restoreOriginalLocalStorage();

        expect(globalThis.localStorage).not.toBe(mockLocalStorage);
        expect(globalThis.localStorage.getItem('real-key')).toBe('real-value');
        expect(globalThis.localStorage.getItem('mock-key')).toBeNull();

        originalLocalStorage.clear();
    });
});
