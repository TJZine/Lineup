/**
 * @jest-environment jsdom
 */

import {
    readTrimmedStringAndClean,
    readStoredBoolean,
    readStoredBooleanAndClean,
    readStoredBooleanMaybeAndClean,
    safeLocalStorageRemoveWithResult,
    safeLocalStorageSetWithResult,
    safeLocalStorageRemoveByPrefixes,
    writeTrimmedStringOrRemove,
    writeTrimmedStringOrRemoveWithResult,
} from '../storage';

describe('storage helpers', () => {
    afterEach(() => {
        localStorage.clear();
    });

    it('reads booleans from storage keys', () => {
        localStorage.setItem('k', '1');
        expect(readStoredBoolean('k', false)).toBe(true);
    });

    it('returns null for invalid stored boolean values and removes invalid entries', () => {
        localStorage.setItem('flag', 'maybe');

        expect(readStoredBooleanMaybeAndClean('flag')).toBe(null);
        expect(localStorage.getItem('flag')).toBe(null);
    });

    it('reads booleans with fallback and removes invalid entries', () => {
        localStorage.setItem('flag', 'oops');

        expect(readStoredBooleanAndClean('flag', true)).toBe(true);
        expect(localStorage.getItem('flag')).toBe(null);
    });

    it('readStoredBooleanMaybeAndClean parses 1 and does not remove the key', () => {
        localStorage.setItem('flag', '1');

        expect(readStoredBooleanMaybeAndClean('flag')).toBe(true);
        expect(localStorage.getItem('flag')).toBe('1');
    });

    it('readStoredBooleanMaybeAndClean parses 0 and does not remove the key', () => {
        localStorage.setItem('flag', '0');

        expect(readStoredBooleanMaybeAndClean('flag')).toBe(false);
        expect(localStorage.getItem('flag')).toBe('0');
    });

    it('readStoredBooleanMaybeAndClean returns null when key is missing', () => {
        expect(readStoredBooleanMaybeAndClean('missing')).toBe(null);
    });

    it('readStoredBooleanAndClean returns fallback when key is missing', () => {
        expect(readStoredBooleanAndClean('missing', true)).toBe(true);
    });

    it('readTrimmedStringAndClean trims valid strings and removes blank values', () => {
        localStorage.setItem('profile', '  user-1  ');
        expect(readTrimmedStringAndClean('profile')).toBe('user-1');
        expect(localStorage.getItem('profile')).toBe('  user-1  ');

        localStorage.setItem('profile', '   ');
        expect(readTrimmedStringAndClean('profile')).toBeNull();
        expect(localStorage.getItem('profile')).toBeNull();
    });

    it('writeTrimmedStringOrRemove persists trimmed values and removes nullish or blank inputs', () => {
        writeTrimmedStringOrRemove('profile', '  user-2  ');
        expect(localStorage.getItem('profile')).toBe('user-2');

        writeTrimmedStringOrRemove('profile', '   ');
        expect(localStorage.getItem('profile')).toBeNull();

        writeTrimmedStringOrRemove('profile', null);
        expect(localStorage.getItem('profile')).toBeNull();
    });

    it('safeLocalStorageSetWithResult returns ok on success and quota-exceeded for quota errors', () => {
        expect(safeLocalStorageSetWithResult('k', 'v')).toEqual({ ok: true });

        const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('quota', 'QuotaExceededError');
        });
        try {
            expect(safeLocalStorageSetWithResult('k', 'v')).toEqual({
                ok: false,
                reason: 'quota-exceeded',
            });
        } finally {
            setSpy.mockRestore();
        }
    });

    it('safeLocalStorageRemoveWithResult returns unavailable when storage is blocked', () => {
        const removeSpy = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw new DOMException('blocked', 'SecurityError');
        });
        try {
            expect(safeLocalStorageRemoveWithResult('k')).toEqual({
                ok: false,
                reason: 'unavailable',
            });
        } finally {
            removeSpy.mockRestore();
        }
    });

    it('writeTrimmedStringOrRemoveWithResult returns result for set/remove paths', () => {
        expect(writeTrimmedStringOrRemoveWithResult('profile', '  user-3  ')).toEqual({ ok: true });
        expect(localStorage.getItem('profile')).toBe('user-3');

        expect(writeTrimmedStringOrRemoveWithResult('profile', '   ')).toEqual({ ok: true });
        expect(localStorage.getItem('profile')).toBeNull();

        expect(writeTrimmedStringOrRemoveWithResult('profile', null)).toEqual({ ok: true });
        expect(localStorage.getItem('profile')).toBeNull();
    });

    it('safeLocalStorageRemoveByPrefixes removes only matching keys', () => {
        localStorage.setItem('lineup_channels_build_tmp_v1:a', '1');
        localStorage.setItem('lineup_current_channel_build_tmp_v1:b', '1');
        localStorage.setItem('lineup_channel_setup_v3:server-1:user-1', 'keep');

        const removed = safeLocalStorageRemoveByPrefixes([
            'lineup_channels_build_tmp_v1:',
            'lineup_current_channel_build_tmp_v1:',
        ]);

        expect(removed).toEqual([
            'lineup_channels_build_tmp_v1:a',
            'lineup_current_channel_build_tmp_v1:b',
        ]);
        expect(localStorage.getItem('lineup_channels_build_tmp_v1:a')).toBe(null);
        expect(localStorage.getItem('lineup_current_channel_build_tmp_v1:b')).toBe(null);
        expect(localStorage.getItem('lineup_channel_setup_v3:server-1:user-1')).toBe('keep');
    });

    it('safeLocalStorageRemoveByPrefixes returns empty list when storage access throws', () => {
        const getLength = jest.spyOn(Storage.prototype, 'length', 'get').mockImplementation(() => {
            throw new Error('blocked');
        });
        try {
            expect(safeLocalStorageRemoveByPrefixes(['lineup_'])).toEqual([]);
        } finally {
            getLength.mockRestore();
        }
    });

    it('safeLocalStorageRemoveByPrefixes trims prefixes and ignores blank prefixes', () => {
        localStorage.setItem('lineup_channels_build_tmp_v1:a', '1');
        localStorage.setItem('other_key', '1');

        const removed = safeLocalStorageRemoveByPrefixes([
            '   ',
            '  lineup_channels_build_tmp_v1:  ',
        ]);

        expect(removed).toEqual(['lineup_channels_build_tmp_v1:a']);
        expect(localStorage.getItem('lineup_channels_build_tmp_v1:a')).toBe(null);
        expect(localStorage.getItem('other_key')).toBe('1');
        expect(safeLocalStorageRemoveByPrefixes([''])).toEqual([]);
    });

    it('safeLocalStorageRemoveByPrefixes returns keys successfully removed before a per-key failure', () => {
        const originalLocalStorage = globalThis.localStorage;
        const removeItem = jest.fn((key: string) => {
            if (key === 'lineup_second') {
                throw new DOMException('blocked', 'SecurityError');
            }
        });
        const customStorage = {
            get length(): number {
                return 3;
            },
            key: (index: number): string | null => {
                if (index === 0) return 'lineup_first';
                if (index === 1) return 'lineup_second';
                if (index === 2) return 'lineup_third';
                return null;
            },
            removeItem,
            clear: jest.fn(),
        } as Pick<Storage, 'length' | 'key' | 'removeItem'> as Storage;

        try {
            Object.defineProperty(globalThis, 'localStorage', {
                configurable: true,
                value: customStorage,
            });

            expect(safeLocalStorageRemoveByPrefixes(['lineup_'])).toEqual([
                'lineup_first',
                'lineup_third',
            ]);
            expect(removeItem).toHaveBeenNthCalledWith(1, 'lineup_first');
            expect(removeItem).toHaveBeenNthCalledWith(2, 'lineup_second');
            expect(removeItem).toHaveBeenNthCalledWith(3, 'lineup_third');
        } finally {
            Object.defineProperty(globalThis, 'localStorage', {
                configurable: true,
                value: originalLocalStorage,
            });
        }
    });

});
